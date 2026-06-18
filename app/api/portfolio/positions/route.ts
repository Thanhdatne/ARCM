import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import {
  createPublicClient,
  http,
  isAddress,
  type Address,
} from "viem";
import { arcTestnet } from "@/lib/chain";
import { ARCT_ADDRESS, COLLATERAL_DECIMALS } from "@/lib/contracts";
import { ERC20_ABI } from "@/lib/contracts/abis/erc20";
import {
  formatTokenAmount,
  getCollateralMetadataByAddress,
  normalizeAddress,
} from "@/lib/collateral";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE = 1000000000000000000n;
const CONCURRENCY = 10;

const MARKET_ABI = [
  {
    inputs: [],
    name: "collateralToken",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
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

interface WorldCupDeployment {
  worldCupMarketId: string;
  fixtureId: string;
  group: string;
  question: string;
  outcomeType: string;
  marketAddress: string;
  ammAddress: string;
  createdAt?: string;
}

interface DynamicMarket {
  id?: string;
  title?: string;
  question?: string;
  address?: string;
  marketAddress?: string;
  ammAddress?: string;
  isReal?: boolean;
}

interface PortfolioPosition {
  id: string;
  fixtureId?: string;
  group?: string;
  title: string;
  address: string;
  ammAddress: string;
  yesBalance: string;
  noBalance: string;
  isSettled: boolean;
  winningSide: "YES" | "NO" | "Mixed" | null;
  claimablePayout: string;
  claimablePayoutFormatted: string;
  collateralAddress: string;
  collateralSymbol: string;
  collateralName: string;
  collateralDecimals: number;
  collateralBalance: string;
  collateralBalanceFormatted: string;
  collateralWarning: boolean;
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

function validAddress(value: string | null | undefined): value is Address {
  return Boolean(value && isAddress(value));
}

function normalizeDynamicMarket(item: DynamicMarket): WorldCupDeployment | null {
  const marketAddress = item.marketAddress || item.address;
  const ammAddress = item.ammAddress;

  if (!validAddress(marketAddress) || !validAddress(ammAddress)) return null;

  return {
    worldCupMarketId: item.id || marketAddress,
    fixtureId: "dynamic",
    group: "Market",
    question: item.question || item.title || "Prediction market",
    outcomeType: "dynamic",
    marketAddress,
    ammAddress,
  };
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
      })) satisfies WorldCupDeployment[];
    }
  }

  const parsed = readJsonFile<WorldCupDeployment[] | Record<string, WorldCupDeployment>>(
    "world-cup-deployments.json",
    [],
  );

  return Array.isArray(parsed) ? parsed : Object.values(parsed);
}

function readDynamicMarkets() {
  const parsed = readJsonFile<DynamicMarket[] | Record<string, DynamicMarket>>(
    "markets.json",
    [],
  );

  const markets = Array.isArray(parsed) ? parsed : Object.values(parsed);

  return markets
    .map(normalizeDynamicMarket)
    .filter(Boolean) as WorldCupDeployment[];
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

function uniqueDeployments(items: WorldCupDeployment[]) {
  const byAddress = new Map<string, WorldCupDeployment>();

  for (const item of items) {
    if (!validAddress(item.marketAddress) || !validAddress(item.ammAddress)) continue;
    byAddress.set(item.marketAddress.toLowerCase(), item);
  }

  return Array.from(byAddress.values());
}

function formatBigInt(value: bigint) {
  return value.toString();
}

function tokenText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("address");

  if (!validAddress(wallet)) {
    return NextResponse.json(
      {
        error: "Valid wallet address is required.",
        arctBalance: "0",
        positions: [],
      },
      { status: 400 },
    );
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL?.trim() ||
    "https://rpc.testnet.arc.network";

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  const deployments = uniqueDeployments([
    ...(await readDeployments()),
    ...readDynamicMarkets(),
  ]);

  let failed = 0;

  const arctBalance = validAddress(ARCT_ADDRESS)
    ? await publicClient
        .readContract({
          address: ARCT_ADDRESS,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [wallet],
        })
        .catch(() => 0n)
    : 0n;

  const scanned = await mapLimit(deployments, CONCURRENCY, async (deployment) => {
    try {
      const marketAddress = deployment.marketAddress as Address;

      const [
        collateralToken,
        receivedSettlementPrice,
        settlementPriceRaw,
        longToken,
        shortToken,
      ] =
        await Promise.all([
          publicClient
            .readContract({
              address: marketAddress,
              abi: MARKET_ABI,
              functionName: "collateralToken",
            })
            .catch(() => ARCT_ADDRESS),
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

      const longTokenAddress = longToken as Address;
      const shortTokenAddress = shortToken as Address;
      const collateralAddress =
        normalizeAddress(collateralToken as Address) ?? ARCT_ADDRESS;
      const configuredCollateral = getCollateralMetadataByAddress(collateralAddress);

      if (
        longTokenAddress === ZERO_ADDRESS ||
        shortTokenAddress === ZERO_ADDRESS
      ) {
        return null;
      }

      const [
        yesBalanceRaw,
        noBalanceRaw,
        collateralBalanceRaw,
        collateralSymbolRaw,
        collateralNameRaw,
        collateralDecimalsRaw,
      ] = await Promise.all([
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
        publicClient
          .readContract({
            address: collateralAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [wallet],
          })
          .catch(() => 0n),
        publicClient
          .readContract({
            address: collateralAddress,
            abi: ERC20_ABI,
            functionName: "symbol",
          })
          .catch(() => configuredCollateral.symbol),
        publicClient
          .readContract({
            address: collateralAddress,
            abi: ERC20_ABI,
            functionName: "name",
          })
          .catch(() => configuredCollateral.name),
        publicClient
          .readContract({
            address: collateralAddress,
            abi: ERC20_ABI,
            functionName: "decimals",
          })
          .catch(() => configuredCollateral.decimals),
      ]);

      const yesBalance = yesBalanceRaw as bigint;
      const noBalance = noBalanceRaw as bigint;
      const collateralBalance = collateralBalanceRaw as bigint;
      const collateralDecimals =
        typeof collateralDecimalsRaw === "number" &&
        Number.isInteger(collateralDecimalsRaw) &&
        collateralDecimalsRaw >= 0 &&
        collateralDecimalsRaw <= 255
          ? collateralDecimalsRaw
          : configuredCollateral.decimals;
      const collateralSymbol = tokenText(
        collateralSymbolRaw,
        configuredCollateral.symbol,
        16,
      );
      const collateralName = tokenText(
        collateralNameRaw,
        configuredCollateral.name,
        64,
      );

      if (yesBalance <= 0n && noBalance <= 0n) return null;

      const isSettled = Boolean(receivedSettlementPrice);
      const settlementPrice = settlementPriceRaw as bigint;

      const claimLongAmount = isSettled && settlementPrice > 0n ? yesBalance : 0n;
      const claimShortAmount = isSettled && settlementPrice < ONE ? noBalance : 0n;
      const claimablePayout =
        (claimLongAmount * settlementPrice + claimShortAmount * (ONE - settlementPrice)) / ONE;

      return {
        id: deployment.worldCupMarketId || deployment.marketAddress,
        fixtureId: deployment.fixtureId,
        group: deployment.group,
        title: deployment.question,
        address: deployment.marketAddress,
        ammAddress: deployment.ammAddress,
        yesBalance: formatBigInt(yesBalance),
        noBalance: formatBigInt(noBalance),
        isSettled,
        winningSide: isSettled
          ? settlementPrice === ONE
            ? "YES"
            : settlementPrice === 0n
              ? "NO"
              : "Mixed"
          : null,
        claimablePayout: formatBigInt(claimablePayout),
        claimablePayoutFormatted: formatTokenAmount(
          claimablePayout,
          collateralDecimals,
        ),
        collateralAddress,
        collateralSymbol,
        collateralName,
        collateralDecimals,
        collateralBalance: formatBigInt(collateralBalance),
        collateralBalanceFormatted: formatTokenAmount(
          collateralBalance,
          collateralDecimals,
        ),
        collateralWarning: configuredCollateral.warning,
      } satisfies PortfolioPosition;
    } catch {
      failed += 1;
      return null;
    }
  });

  const positions = (scanned.filter(Boolean) as PortfolioPosition[]).sort((a, b) => {
    if (a.isSettled !== b.isSettled) return Number(a.isSettled) - Number(b.isSettled);
    return a.title.localeCompare(b.title);
  });

  const openPositions = positions.filter((position) => !position.isSettled).length;
  const settledPositions = positions.filter((position) => position.isSettled).length;
  const sideCount = positions.reduce(
    (total, position) =>
      total +
      (BigInt(position.yesBalance) > 0n ? 1 : 0) +
      (BigInt(position.noBalance) > 0n ? 1 : 0),
    0,
  );

  return NextResponse.json(
    {
      success: true,
      decimals: COLLATERAL_DECIMALS,
      scanned: deployments.length,
      failed,
      arctBalance: formatBigInt(arctBalance as bigint),
      positions,
      totals: {
        marketsWithPositions: positions.length,
        openPositions,
        settledPositions,
        sideCount,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
