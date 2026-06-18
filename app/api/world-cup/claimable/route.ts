import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import {
  createPublicClient,
  http,
  type Address,
} from "viem";
import { arcTestnet } from "@/lib/chain";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE = 1000000000000000000n;
const CONCURRENCY = 10;
const CACHE_TTL_MS = 10 * 60 * 1000;

const MARKET_ABI = [
  {
    inputs: [],
    name: "receivedSettlementPrice",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "settlementPrice",
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "longToken",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "shortToken",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface WorldCupDeployment {
  worldCupMarketId: string;
  fixtureId: string;
  group: string;
  question: string;
  outcomeType: string;
  marketAddress: string;
  ammAddress: string;
  createdAt?: string;
  txHash?: string;
  transactionHash?: string;
}

interface WorldCupResultRecord {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "pending" | "final" | "postponed" | "cancelled";
  result?: "home_win" | "draw" | "away_win" | null;
  updatedAt: string;
  source?: string;
}

interface ClaimableMarket {
  id: string;
  fixtureId: string;
  group: string;
  title: string;
  address: string;
  ammAddress: string;
  winningSide: "YES" | "NO" | "Mixed";
  claimLongAmount: string;
  claimShortAmount: string;
  payoutAmount: string;
  yesBalance: string;
  noBalance: string;
}

function dataPath(fileName: string) {
  return path.resolve(process.cwd(), "data", fileName);
}

function readJsonFile<T>(fileName: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(dataPath(fileName), "utf-8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readDeploymentsFromJson() {
  const parsed = readJsonFile<WorldCupDeployment[] | Record<string, WorldCupDeployment>>(
    "world-cup-deployments.json",
    [],
  );

  return Array.isArray(parsed) ? parsed : Object.values(parsed);
}

function readResultsFromJson() {
  const parsed = readJsonFile<WorldCupResultRecord[] | Record<string, WorldCupResultRecord>>(
    "world-cup-results.json",
    [],
  );

  return Array.isArray(parsed) ? parsed : Object.values(parsed);
}

async function readDeployments() {
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from("world_cup_deployments")
      .select("*")
      .order("fixture_id", { ascending: true });

    if (!error && data) {
      return data.map((item) => ({
        worldCupMarketId: item.world_cup_market_id,
        fixtureId: item.fixture_id,
        group: item.group,
        question: item.question,
        outcomeType: item.outcome_type,
        marketAddress: item.market_address,
        ammAddress: item.amm_address,
        createdAt: item.created_at ?? undefined,
        txHash: item.tx_hash ?? undefined,
        transactionHash: item.transaction_hash ?? undefined,
      })) satisfies WorldCupDeployment[];
    }
  }

  return readDeploymentsFromJson();
}

async function readResults() {
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from("world_cup_results")
      .select("*")
      .eq("status", "final");

    if (!error && data) {
      return data.map((item) => ({
        fixtureId: item.fixture_id,
        homeTeam: item.home_team,
        awayTeam: item.away_team,
        homeScore: item.home_score,
        awayScore: item.away_score,
        status: item.status,
        result: item.result,
        updatedAt: item.result_updated_at ?? item.updated_at,
        source: item.source ?? undefined,
      })) satisfies WorldCupResultRecord[];
    }
  }

  return readResultsFromJson();
}

function validAddress(value: string | null | undefined): value is Address {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function run() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );

  return results;
}

function cacheRowToMarket(row: any): ClaimableMarket {
  return {
    id: row.world_cup_market_id || row.market_address,
    fixtureId: row.fixture_id,
    group: row.group,
    title: row.title,
    address: row.market_address,
    ammAddress: row.amm_address,
    winningSide: row.winning_side,
    claimLongAmount: String(row.claim_long_amount),
    claimShortAmount: String(row.claim_short_amount),
    payoutAmount: String(row.payout_amount),
    yesBalance: String(row.yes_balance),
    noBalance: String(row.no_balance),
  };
}

async function readFreshCache(wallet: Address) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from("claimable_cache")
    .select("*")
    .eq("wallet_address", wallet.toLowerCase())
    .eq("claimed", false)
    .gt("payout_amount", "0")
    .gt("updated_at", cutoff)
    .order("updated_at", { ascending: false });

  if (error || !data || data.length === 0) return null;

  return data.map(cacheRowToMarket);
}

async function writeCache(wallet: Address, markets: ClaimableMarket[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase
    .from("claimable_cache")
    .delete()
    .eq("wallet_address", wallet.toLowerCase());

  if (!markets.length) return;

  await supabase.from("claimable_cache").upsert(
    markets.map((market) => ({
      wallet_address: wallet.toLowerCase(),
      market_address: market.address.toLowerCase(),
      amm_address: market.ammAddress.toLowerCase(),
      world_cup_market_id: market.id,
      fixture_id: market.fixtureId,
      group: market.group,
      title: market.title,
      winning_side: market.winningSide,
      claim_long_amount: market.claimLongAmount,
      claim_short_amount: market.claimShortAmount,
      payout_amount: market.payoutAmount,
      yes_balance: market.yesBalance,
      no_balance: market.noBalance,
      claimed: false,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "wallet_address,market_address" },
  );
}

function formatBigInt(value: bigint) {
  return value.toString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("address");
  const refresh = url.searchParams.get("refresh") === "1";

  if (!validAddress(wallet)) {
    return NextResponse.json(
      {
        error: "Valid wallet address is required.",
        markets: [],
        scanned: 0,
        settled: 0,
        withWinningBalance: 0,
      },
      { status: 400 },
    );
  }

  if (!refresh) {
    const cachedMarkets = await readFreshCache(wallet);
    if (cachedMarkets) {
      return NextResponse.json(
        {
          success: true,
          source: "supabase_cache",
          scanned: 0,
          settled: 0,
          failed: 0,
          withWinningBalance: cachedMarkets.length,
          markets: cachedMarkets,
        },
        {
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL?.trim() ||
    "https://rpc.testnet.arc.network";

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  const finalFixtureIds = new Set(
    (await readResults())
      .filter((result) => result.status === "final" && result.result)
      .map((result) => result.fixtureId),
  );

  const deployments = (await readDeployments())
    .filter((deployment) => (
      validAddress(deployment.marketAddress) &&
      validAddress(deployment.ammAddress) &&
      (finalFixtureIds.size === 0 || finalFixtureIds.has(deployment.fixtureId))
    ))
    .sort((a, b) =>
      `${a.fixtureId}-${a.outcomeType}`.localeCompare(`${b.fixtureId}-${b.outcomeType}`),
    );

  let settled = 0;
  let failed = 0;

  const scannedMarkets = await mapLimit(deployments, CONCURRENCY, async (deployment) => {
    try {
      const marketAddress = deployment.marketAddress as Address;

      const [receivedSettlementPrice, settlementPriceRaw, longToken, shortToken] =
        await Promise.all([
          publicClient.readContract({
            address: marketAddress,
            abi: MARKET_ABI,
            functionName: "receivedSettlementPrice",
          }),
          publicClient.readContract({
            address: marketAddress,
            abi: MARKET_ABI,
            functionName: "settlementPrice",
          }),
          publicClient.readContract({
            address: marketAddress,
            abi: MARKET_ABI,
            functionName: "longToken",
          }),
          publicClient.readContract({
            address: marketAddress,
            abi: MARKET_ABI,
            functionName: "shortToken",
          }),
        ]);

      if (!receivedSettlementPrice) return null;

      settled += 1;

      const settlementPrice = settlementPriceRaw as bigint;
      const longTokenAddress = longToken as Address;
      const shortTokenAddress = shortToken as Address;

      if (
        longTokenAddress === ZERO_ADDRESS ||
        shortTokenAddress === ZERO_ADDRESS
      ) {
        return null;
      }

      const [longBalanceRaw, shortBalanceRaw] = await Promise.all([
        publicClient.readContract({
          address: longTokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.readContract({
          address: shortTokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [wallet],
        }),
      ]);

      const longBalance = longBalanceRaw as bigint;
      const shortBalance = shortBalanceRaw as bigint;

      const claimLongAmount = settlementPrice > 0n ? longBalance : 0n;
      const claimShortAmount = settlementPrice < ONE ? shortBalance : 0n;
      const payoutAmount =
        (claimLongAmount * settlementPrice + claimShortAmount * (ONE - settlementPrice)) / ONE;

      if (payoutAmount <= 0n) return null;

      return {
        id: deployment.worldCupMarketId || deployment.marketAddress,
        fixtureId: deployment.fixtureId,
        group: deployment.group,
        title: deployment.question,
        address: deployment.marketAddress,
        ammAddress: deployment.ammAddress,
        winningSide:
          settlementPrice === ONE ? "YES" : settlementPrice === 0n ? "NO" : "Mixed",
        claimLongAmount: formatBigInt(claimLongAmount),
        claimShortAmount: formatBigInt(claimShortAmount),
        payoutAmount: formatBigInt(payoutAmount),
        yesBalance: formatBigInt(longBalance),
        noBalance: formatBigInt(shortBalance),
      } satisfies ClaimableMarket;
    } catch {
      failed += 1;
      return null;
    }
  });

  const markets = scannedMarkets.filter(Boolean) as ClaimableMarket[];

  await writeCache(wallet, markets);

  return NextResponse.json(
    {
      success: true,
      source: "onchain_scan",
      scanned: deployments.length,
      settled,
      failed,
      withWinningBalance: markets.length,
      markets,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
