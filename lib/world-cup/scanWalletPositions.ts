import * as fs from "fs";
import * as path from "path";
import {
  createPublicClient,
  http,
  isAddress,
  type Address,
} from "viem";
import { arcTestnet } from "@/lib/chain";
import {
  formatTokenAmount,
  getCollateralMetadataByAddress,
  normalizeAddress,
} from "@/lib/collateral";
import { ERC20_ABI } from "@/lib/contracts/abis/erc20";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE = 1000000000000000000n;
const CACHE_TTL_MS = 30_000;

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
  contractVersion: number;
  collateralAddress?: string;
  collateralSymbol?: string;
  collateralDecimals?: number;
  outcomeDecimals?: number;
  homeTeam?: string;
  awayTeam?: string;
  stage?: string;
  kickoffTime?: string;
  homeCountryCode?: string;
  awayCountryCode?: string;
}

export interface WalletPosition {
  id: string;
  fixtureId: string;
  group: string;
  title: string;
  address: string;
  ammAddress: string;
  yesBalance: string;
  noBalance: string;
  isSettled: boolean;
  winningSide: "YES" | "NO" | "Mixed" | null;
  claimLongAmount: string;
  claimShortAmount: string;
  claimablePayout: string;
  claimablePayoutFormatted: string;
  collateralAddress: string;
  collateralSymbol: string;
  collateralName: string;
  collateralDecimals: number;
  collateralBalance: string;
  collateralBalanceFormatted: string;
  collateralWarning: boolean;
  contractVersion: number;
  outcomeDecimals: number;
}

export interface WalletPositionScan {
  openPositions: WalletPosition[];
  settledPositions: WalletPosition[];
  claimablePositions: WalletPosition[];
  scanned: number;
  settledMarketCount: number;
  failed: number;
  debug?: WalletPositionScanDebug;
}

export interface RoundOf32PositionDebug {
  title: string;
  marketAddress: string;
  ammAddress: string;
  balanceReadsSucceeded: boolean;
  yesBalance: string;
  noBalance: string;
  outcomeDecimals: number | null;
  contractVersion: number;
  failureReason?: string;
}

export interface WalletPositionScanDebug {
  totalScannedMarkets: number;
  totalRoundOf32MarketsIncluded: number;
  roundOf32Markets: Array<{
    title: string;
    marketAddress: string;
    ammAddress: string;
  }>;
  roundOf32BalanceReads: RoundOf32PositionDebug[];
}

interface CacheEntry {
  expiresAt: number;
  value: WalletPositionScan;
}

interface ContractRead {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}

type ReadContractClient = {
  multicall: (args: {
    allowFailure: boolean;
    contracts: ContractRead[];
  }) => Promise<Array<{ status: "success"; result: unknown } | { status: "failure"; error?: unknown }>>;
  readContract: (call: ContractRead) => Promise<unknown>;
};

interface ContractReadResult {
  status: "success" | "failure";
  result?: unknown;
  error?: string;
}

const serverState = globalThis as typeof globalThis & {
  __arcmWalletPositionScanCache?: Map<string, CacheEntry>;
  __arcmWalletPositionScansInFlight?: Map<string, Promise<WalletPositionScan>>;
};

const scanCache =
  serverState.__arcmWalletPositionScanCache ??
  (serverState.__arcmWalletPositionScanCache = new Map<string, CacheEntry>());

const scansInFlight =
  serverState.__arcmWalletPositionScansInFlight ??
  (serverState.__arcmWalletPositionScansInFlight = new Map<string, Promise<WalletPositionScan>>());

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

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeDeployment(item: Record<string, unknown>): WorldCupDeployment {
  return {
    worldCupMarketId: text(item.worldCupMarketId ?? item.world_cup_market_id),
    fixtureId: text(item.fixtureId ?? item.fixture_id),
    group: text(item.group),
    question: text(item.question),
    outcomeType: text(item.outcomeType ?? item.outcome_type),
    marketAddress: text(item.marketAddress ?? item.market_address),
    ammAddress: text(item.ammAddress ?? item.amm_address),
    contractVersion: optionalNumber(item.contractVersion ?? item.contract_version) ?? 1,
    collateralAddress: text(item.collateralAddress ?? item.collateral_address) || undefined,
    collateralSymbol: text(item.collateralSymbol ?? item.collateral_symbol) || undefined,
    collateralDecimals: optionalNumber(item.collateralDecimals ?? item.collateral_decimals),
    outcomeDecimals: optionalNumber(item.outcomeDecimals ?? item.outcome_decimals),
    homeTeam: text(item.homeTeam ?? item.home_team) || undefined,
    awayTeam: text(item.awayTeam ?? item.away_team) || undefined,
    stage: text(item.stage) || undefined,
    kickoffTime: text(item.kickoffTime ?? item.kickoff_time) || undefined,
    homeCountryCode: text(item.homeCountryCode ?? item.home_country_code) || undefined,
    awayCountryCode: text(item.awayCountryCode ?? item.away_country_code) || undefined,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseRoundOf32Title(title: string) {
  const match = title.match(/^Will (.+?) eliminate (.+?) in the (Round of 32)\??$/i);
  if (!match) return null;

  return {
    homeTeam: match[1].trim(),
    awayTeam: match[2].trim(),
    stage: match[3].trim(),
  };
}

function roundOf32MarketToDeployment(item: Record<string, unknown>): WorldCupDeployment | null {
  const title = text(item.title);
  const parsedTitle = parseRoundOf32Title(title);
  const category = text(item.category).toLowerCase();
  const marketAddress = text(item.marketAddress ?? item.market_address ?? item.address);
  const ammAddress = text(item.ammAddress ?? item.amm_address);
  const contractVersion = optionalNumber(item.contractVersion ?? item.contract_version);
  const collateralSymbol = text(item.collateralSymbol ?? item.collateral_symbol);
  const collateralDecimals = optionalNumber(item.collateralDecimals ?? item.collateral_decimals);

  if (
    !parsedTitle ||
    !category.includes("world cup") ||
    contractVersion !== 2 ||
    !isAddress(marketAddress) ||
    !isAddress(ammAddress) ||
    (collateralSymbol && collateralSymbol.toUpperCase() !== "USDC") ||
    (collateralDecimals !== undefined && collateralDecimals !== 6)
  ) {
    return null;
  }

  const homeTeam = text(item.homeTeam ?? item.home_team) || parsedTitle.homeTeam;
  const awayTeam = text(item.awayTeam ?? item.away_team) || parsedTitle.awayTeam;
  const stage = text(item.stage) || parsedTitle.stage;
  const id = text(item.id) || `round-of-32-${slugify(homeTeam)}-${slugify(awayTeam)}`;

  return {
    worldCupMarketId: id,
    fixtureId: `${slugify(homeTeam)}-vs-${slugify(awayTeam)}`,
    group: stage,
    question: title,
    outcomeType: "knockout",
    marketAddress,
    ammAddress,
    contractVersion,
    collateralAddress: text(item.collateralAddress ?? item.collateral_address) || undefined,
    collateralSymbol: collateralSymbol || undefined,
    collateralDecimals,
    outcomeDecimals: optionalNumber(item.outcomeDecimals ?? item.outcome_decimals),
    homeTeam,
    awayTeam,
    stage,
    kickoffTime: text(item.kickoffTime ?? item.kickoff_time) || undefined,
    homeCountryCode: text(item.homeCountryCode ?? item.home_country_code) || undefined,
    awayCountryCode: text(item.awayCountryCode ?? item.away_country_code) || undefined,
  };
}

function readRoundOf32MarketDeployments() {
  const parsed = readJsonFile<Record<string, unknown>[] | Record<string, Record<string, unknown>>>(
    "markets.json",
    [],
  );
  const markets = Array.isArray(parsed) ? parsed : Object.values(parsed);

  return markets.flatMap((item) => {
    const deployment = roundOf32MarketToDeployment(item);
    return deployment ? [deployment] : [];
  });
}

function mergeDeployments(items: WorldCupDeployment[]) {
  const byKey = new Map<string, WorldCupDeployment>();

  for (const item of items) {
    const marketKey = normalizeAddress(item.marketAddress);
    const fallbackKey = item.worldCupMarketId || `${item.fixtureId}:${item.outcomeType}`;
    const key = marketKey || fallbackKey;
    if (!key) continue;

    const existing = byKey.get(key);
    byKey.set(key, {
      ...existing,
      ...item,
      collateralAddress: item.collateralAddress ?? existing?.collateralAddress,
      collateralSymbol: item.collateralSymbol ?? existing?.collateralSymbol,
      collateralDecimals: item.collateralDecimals ?? existing?.collateralDecimals,
      outcomeDecimals: item.outcomeDecimals ?? existing?.outcomeDecimals,
      homeTeam: item.homeTeam ?? existing?.homeTeam,
      awayTeam: item.awayTeam ?? existing?.awayTeam,
      stage: item.stage ?? existing?.stage,
      kickoffTime: item.kickoffTime ?? existing?.kickoffTime,
      homeCountryCode: item.homeCountryCode ?? existing?.homeCountryCode,
      awayCountryCode: item.awayCountryCode ?? existing?.awayCountryCode,
    });
  }

  return Array.from(byKey.values());
}

async function readDeployments() {
  const parsed = readJsonFile<Record<string, unknown>[] | Record<string, Record<string, unknown>>>(
    "world-cup-deployments.json",
    [],
  );
  const deployments = (Array.isArray(parsed) ? parsed : Object.values(parsed)).map(normalizeDeployment);
  deployments.push(...readRoundOf32MarketDeployments());
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from("world_cup_deployments")
      .select("*")
      .order("fixture_id", { ascending: true });

    if (!error && data) {
      deployments.push(...data.map((item) => normalizeDeployment(item as Record<string, unknown>)));
    }
  }

  return mergeDeployments(deployments)
    .filter((item) => isAddress(item.marketAddress) && isAddress(item.ammAddress) && item.contractVersion === 2)
    .sort((a, b) => `${a.fixtureId}-${a.outcomeType}`.localeCompare(`${b.fixtureId}-${b.outcomeType}`));
}

function tokenText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function validDecimals(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255
    ? value
    : fallback;
}

function errorText(error: unknown) {
  if (error instanceof Error) {
    const shortMessage =
      "shortMessage" in error && typeof error.shortMessage === "string"
        ? error.shortMessage
        : undefined;
    return shortMessage ?? error.message;
  }
  return typeof error === "string" ? error : "Contract read failed";
}

async function readContractsDetailed(publicClient: ReadContractClient, calls: ContractRead[]) {
  if (calls.length === 0) return [];

  try {
    const results = await publicClient.multicall({
      allowFailure: true,
      contracts: calls,
    });

    return results.map((result): ContractReadResult =>
      result.status === "success"
        ? { status: "success", result: result.result }
        : { status: "failure", error: errorText(result.error) },
    );
  } catch (error) {
    const results = await Promise.allSettled(
      calls.map((call) => publicClient.readContract(call)),
    );

    return results.map((result): ContractReadResult =>
      result.status === "fulfilled"
        ? { status: "success", result: result.value }
        : { status: "failure", error: errorText(result.reason) },
    );
  }
}

function readResultValue(result: ContractReadResult | undefined) {
  return result?.status === "success" ? result.result : undefined;
}

function readResultError(result: ContractReadResult | undefined) {
  return result?.status === "failure" ? result.error : undefined;
}

function isRoundOf32Deployment(deployment: WorldCupDeployment) {
  return Boolean(parseRoundOf32Title(deployment.question));
}

async function performScan(wallet: Address, includeDebug = false): Promise<WalletPositionScan> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL?.trim() ||
    "https://rpc.testnet.arc.network";

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  }) as unknown as ReadContractClient;

  const deployments = await readDeployments();
  const roundOf32Deployments = deployments.filter(isRoundOf32Deployment);
  const roundOf32BalanceReads = new Map<string, RoundOf32PositionDebug>();

  if (includeDebug) {
    for (const deployment of roundOf32Deployments) {
      roundOf32BalanceReads.set(normalizeAddress(deployment.marketAddress) ?? deployment.marketAddress, {
        title: deployment.question,
        marketAddress: deployment.marketAddress,
        ammAddress: deployment.ammAddress,
        balanceReadsSucceeded: false,
        yesBalance: "0",
        noBalance: "0",
        outcomeDecimals: null,
        contractVersion: deployment.contractVersion,
      });
    }
  }

  const marketCalls: ContractRead[] = deployments.flatMap((deployment) => {
    const address = deployment.marketAddress as Address;
    return [
      "collateralToken",
      "receivedSettlementPrice",
      "settlementPrice",
      "longToken",
      "shortToken",
    ].map((functionName) => ({
      address,
      abi: MARKET_ABI,
      functionName,
    }));
  });

  const marketResults = await readContractsDetailed(publicClient, marketCalls);
  let failed = 0;
  let settledMarketCount = 0;

  const marketMetadata = deployments.flatMap((deployment, index) => {
    const [collateralTokenResult, receivedSettlementPriceResult, settlementPriceResult, longTokenResult, shortTokenResult] =
      marketResults.slice(index * 5, index * 5 + 5);
    const collateralToken = readResultValue(collateralTokenResult);
    const receivedSettlementPrice = readResultValue(receivedSettlementPriceResult);
    const settlementPrice = readResultValue(settlementPriceResult);
    const longToken = readResultValue(longTokenResult);
    const shortToken = readResultValue(shortTokenResult);
    const roundOf32Key = normalizeAddress(deployment.marketAddress) ?? deployment.marketAddress;
    const roundOf32Debug = roundOf32BalanceReads.get(roundOf32Key);

    if (
      typeof collateralToken !== "string" ||
      typeof receivedSettlementPrice !== "boolean" ||
      typeof longToken !== "string" ||
      typeof shortToken !== "string"
    ) {
      failed += 1;
      if (roundOf32Debug) {
        roundOf32Debug.failureReason = [
          readResultError(collateralTokenResult) ? `collateralToken: ${readResultError(collateralTokenResult)}` : "",
          readResultError(receivedSettlementPriceResult) ? `receivedSettlementPrice: ${readResultError(receivedSettlementPriceResult)}` : "",
          readResultError(longTokenResult) ? `longToken: ${readResultError(longTokenResult)}` : "",
          readResultError(shortTokenResult) ? `shortToken: ${readResultError(shortTokenResult)}` : "",
        ].filter(Boolean).join("; ") || "Required market metadata read returned an invalid value";
      }
      return [];
    }

    if (receivedSettlementPrice && typeof settlementPrice !== "bigint") {
      failed += 1;
      if (roundOf32Debug) {
        roundOf32Debug.failureReason =
          readResultError(settlementPriceResult) || "Settled market settlementPrice read returned an invalid value";
      }
      return [];
    }

    const collateralAddress = normalizeAddress(collateralToken);
    if (
      !collateralAddress ||
      longToken === ZERO_ADDRESS ||
      shortToken === ZERO_ADDRESS ||
      !isAddress(longToken) ||
      !isAddress(shortToken)
    ) {
      failed += 1;
      if (roundOf32Debug) {
        roundOf32Debug.failureReason = "Market returned an invalid collateral, long token, or short token address";
      }
      return [];
    }

    if (receivedSettlementPrice) settledMarketCount += 1;

    return [{
      deployment,
      collateralAddress,
      isSettled: receivedSettlementPrice,
      settlementPrice: typeof settlementPrice === "bigint" ? settlementPrice : 0n,
      longToken,
      shortToken,
    }];
  });

  const tokenCalls: ContractRead[] = marketMetadata.flatMap((market) => [
    { address: market.longToken as Address, abi: ERC20_ABI, functionName: "balanceOf", args: [wallet] },
    { address: market.shortToken as Address, abi: ERC20_ABI, functionName: "balanceOf", args: [wallet] },
    { address: market.collateralAddress as Address, abi: ERC20_ABI, functionName: "balanceOf", args: [wallet] },
    { address: market.collateralAddress as Address, abi: ERC20_ABI, functionName: "symbol" },
    { address: market.collateralAddress as Address, abi: ERC20_ABI, functionName: "name" },
    { address: market.collateralAddress as Address, abi: ERC20_ABI, functionName: "decimals" },
    { address: market.longToken as Address, abi: ERC20_ABI, functionName: "decimals" },
  ]);

  const tokenResults = await readContractsDetailed(publicClient, tokenCalls);

  const positions = marketMetadata.flatMap((market, index): WalletPosition[] => {
    const [
      yesBalanceResult,
      noBalanceResult,
      collateralBalanceResult,
      symbolResult,
      nameResult,
      decimalsResult,
      outcomeDecimalsResult,
    ] = tokenResults.slice(index * 7, index * 7 + 7);
    const yesBalanceRaw = readResultValue(yesBalanceResult);
    const noBalanceRaw = readResultValue(noBalanceResult);
    const collateralBalanceRaw = readResultValue(collateralBalanceResult);
    const symbolRaw = readResultValue(symbolResult);
    const nameRaw = readResultValue(nameResult);
    const decimalsRaw = readResultValue(decimalsResult);
    const outcomeDecimalsRaw = readResultValue(outcomeDecimalsResult);
    const roundOf32Key = normalizeAddress(market.deployment.marketAddress) ?? market.deployment.marketAddress;
    const roundOf32Debug = roundOf32BalanceReads.get(roundOf32Key);

    if (typeof yesBalanceRaw !== "bigint" || typeof noBalanceRaw !== "bigint") {
      failed += 1;
      if (roundOf32Debug) {
        roundOf32Debug.failureReason = [
          readResultError(yesBalanceResult) ? `YES balance: ${readResultError(yesBalanceResult)}` : "",
          readResultError(noBalanceResult) ? `NO balance: ${readResultError(noBalanceResult)}` : "",
        ].filter(Boolean).join("; ") || "YES or NO balance read returned an invalid value";
      }
      return [];
    }

    const configuredCollateral = getCollateralMetadataByAddress(market.collateralAddress);
    const collateralDecimals = validDecimals(decimalsRaw, configuredCollateral.decimals);
    const outcomeDecimals = validDecimals(
      outcomeDecimalsRaw,
      market.deployment.outcomeDecimals ?? collateralDecimals,
    );
    const collateralBalance = typeof collateralBalanceRaw === "bigint" ? collateralBalanceRaw : 0n;
    const collateralSymbol = tokenText(symbolRaw, configuredCollateral.symbol, 16);
    const collateralName = tokenText(nameRaw, configuredCollateral.name, 64);

    if (roundOf32Debug) {
      roundOf32Debug.balanceReadsSucceeded = true;
      roundOf32Debug.yesBalance = yesBalanceRaw.toString();
      roundOf32Debug.noBalance = noBalanceRaw.toString();
      roundOf32Debug.outcomeDecimals = outcomeDecimals;
      if (yesBalanceRaw <= 0n && noBalanceRaw <= 0n) {
        roundOf32Debug.failureReason = "Wallet has zero YES and NO balance";
      }
    }

    if (yesBalanceRaw <= 0n && noBalanceRaw <= 0n) return [];

    const claimLongAmount = market.isSettled && market.settlementPrice > 0n ? yesBalanceRaw : 0n;
    const claimShortAmount = market.isSettled && market.settlementPrice < ONE ? noBalanceRaw : 0n;
    const claimablePayout =
      (claimLongAmount * market.settlementPrice + claimShortAmount * (ONE - market.settlementPrice)) / ONE;

    return [{
      id: market.deployment.worldCupMarketId || market.deployment.marketAddress,
      fixtureId: market.deployment.fixtureId,
      group: market.deployment.group,
      title: market.deployment.question,
      address: market.deployment.marketAddress,
      ammAddress: market.deployment.ammAddress,
      yesBalance: yesBalanceRaw.toString(),
      noBalance: noBalanceRaw.toString(),
      isSettled: market.isSettled,
      winningSide: market.isSettled
        ? market.settlementPrice === ONE
          ? "YES"
          : market.settlementPrice === 0n
            ? "NO"
            : "Mixed"
        : null,
      claimLongAmount: claimLongAmount.toString(),
      claimShortAmount: claimShortAmount.toString(),
      claimablePayout: claimablePayout.toString(),
      claimablePayoutFormatted: formatTokenAmount(claimablePayout, collateralDecimals),
      collateralAddress: market.collateralAddress,
      collateralSymbol,
      collateralName,
      collateralDecimals,
      collateralBalance: collateralBalance.toString(),
      collateralBalanceFormatted: formatTokenAmount(collateralBalance, collateralDecimals),
      collateralWarning: configuredCollateral.warning,
      contractVersion: market.deployment.contractVersion,
      outcomeDecimals,
    }];
  }).sort((a, b) => {
    if (a.isSettled !== b.isSettled) return Number(a.isSettled) - Number(b.isSettled);
    return a.title.localeCompare(b.title);
  });

  const openPositions = positions.filter((position) => !position.isSettled);
  const settledPositions = positions.filter((position) => position.isSettled);
  const claimablePositions = settledPositions.filter((position) => BigInt(position.claimablePayout) > 0n);

  return {
    openPositions,
    settledPositions,
    claimablePositions,
    scanned: deployments.length,
    settledMarketCount,
    failed,
    debug: includeDebug
      ? {
        totalScannedMarkets: deployments.length,
        totalRoundOf32MarketsIncluded: roundOf32Deployments.length,
        roundOf32Markets: roundOf32Deployments.map((deployment) => ({
          title: deployment.question,
          marketAddress: deployment.marketAddress,
          ammAddress: deployment.ammAddress,
        })),
        roundOf32BalanceReads: Array.from(roundOf32BalanceReads.values()),
      }
      : undefined,
  };
}

export async function scanWalletPositions(
  wallet: Address,
  forceRefresh = false,
  includeDebug = false,
): Promise<WalletPositionScan> {
  const key = wallet.toLowerCase();
  const cached = scanCache.get(key);

  if (!includeDebug && !forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!includeDebug && !forceRefresh) {
    const inFlight = scansInFlight.get(key);
    if (inFlight) return inFlight;
  }

  const scan = performScan(wallet, includeDebug);
  scansInFlight.set(key, scan);

  try {
    const result = await scan;
    if (!includeDebug) {
      scanCache.set(key, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: result,
      });
    }
    return result;
  } finally {
    if (scansInFlight.get(key) === scan) {
      scansInFlight.delete(key);
    }
  }
}
