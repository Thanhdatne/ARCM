import * as fs from "fs";
import * as path from "path";
import { createPublicClient, http, isAddress, type Address } from "viem";
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
const CACHE_TTL_MS = 60_000;
const DEFAULT_FAST_SCAN_LIMIT = 55;

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
  partialReadSucceeded?: boolean;
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
  totalAvailableMarkets?: number;
  skippedByFastMode?: number;
  scanMode?: WalletPositionScanMode;
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
  }) => Promise<
    Array<
      | { status: "success"; result: unknown }
      | { status: "failure"; error?: unknown }
    >
  >;
  readContract: (call: ContractRead) => Promise<unknown>;
};

interface ContractReadResult {
  status: "success" | "failure";
  result?: unknown;
  error?: string;
}

export type WalletPositionScanMode = "fast" | "full";

export interface WalletPositionScanOptions {
  mode?: WalletPositionScanMode;
  maxMarkets?: number;
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
  (serverState.__arcmWalletPositionScansInFlight = new Map<
    string,
    Promise<WalletPositionScan>
  >());

function dataPath(fileName: string) {
  return path.resolve(process.cwd(), "data", fileName);
}

function readJsonFile<T>(fileName: string, fallback: T): T {
  try {
    const raw = fs
      .readFileSync(dataPath(fileName), "utf-8")
      .replace(/^\uFEFF/, "");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeDeployment(
  item: Record<string, unknown>,
): WorldCupDeployment {
  return {
    worldCupMarketId: text(item.worldCupMarketId ?? item.world_cup_market_id),
    fixtureId: text(item.fixtureId ?? item.fixture_id),
    group: text(item.group),
    question: text(item.question),
    outcomeType: text(item.outcomeType ?? item.outcome_type),
    marketAddress: text(item.marketAddress ?? item.market_address),
    ammAddress: text(item.ammAddress ?? item.amm_address),
    contractVersion:
      optionalNumber(item.contractVersion ?? item.contract_version) ?? 1,
    collateralAddress:
      text(item.collateralAddress ?? item.collateral_address) || undefined,
    collateralSymbol:
      text(item.collateralSymbol ?? item.collateral_symbol) || undefined,
    collateralDecimals: optionalNumber(
      item.collateralDecimals ?? item.collateral_decimals,
    ),
    outcomeDecimals: optionalNumber(
      item.outcomeDecimals ?? item.outcome_decimals,
    ),
    homeTeam: text(item.homeTeam ?? item.home_team) || undefined,
    awayTeam: text(item.awayTeam ?? item.away_team) || undefined,
    stage: text(item.stage) || undefined,
    kickoffTime: text(item.kickoffTime ?? item.kickoff_time) || undefined,
    homeCountryCode:
      text(item.homeCountryCode ?? item.home_country_code) || undefined,
    awayCountryCode:
      text(item.awayCountryCode ?? item.away_country_code) || undefined,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseRoundOf32Title(title: string) {
  const match = title.match(
    /^Will (.+?) eliminate (.+?) in the (Round of 32)\??$/i,
  );
  if (!match) return null;

  return {
    homeTeam: match[1].trim(),
    awayTeam: match[2].trim(),
    stage: match[3].trim(),
  };
}

function roundOf32MarketToDeployment(
  item: Record<string, unknown>,
): WorldCupDeployment | null {
  const title = text(item.title);
  const parsedTitle = parseRoundOf32Title(title);
  const category = text(item.category).toLowerCase();
  const marketAddress = text(
    item.marketAddress ?? item.market_address ?? item.address,
  );
  const ammAddress = text(item.ammAddress ?? item.amm_address);
  const contractVersion = optionalNumber(
    item.contractVersion ?? item.contract_version,
  );
  const collateralSymbol = text(
    item.collateralSymbol ?? item.collateral_symbol,
  );
  const collateralDecimals = optionalNumber(
    item.collateralDecimals ?? item.collateral_decimals,
  );

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

  const homeTeam =
    text(item.homeTeam ?? item.home_team) || parsedTitle.homeTeam;
  const awayTeam =
    text(item.awayTeam ?? item.away_team) || parsedTitle.awayTeam;
  const stage = text(item.stage) || parsedTitle.stage;
  const id =
    text(item.id) || `round-of-32-${slugify(homeTeam)}-${slugify(awayTeam)}`;

  return {
    worldCupMarketId: id,
    fixtureId: `${slugify(homeTeam)}-vs-${slugify(awayTeam)}`,
    group: stage,
    question: title,
    outcomeType: "knockout",
    marketAddress,
    ammAddress,
    contractVersion,
    collateralAddress:
      text(item.collateralAddress ?? item.collateral_address) || undefined,
    collateralSymbol: collateralSymbol || undefined,
    collateralDecimals,
    outcomeDecimals: optionalNumber(
      item.outcomeDecimals ?? item.outcome_decimals,
    ),
    homeTeam,
    awayTeam,
    stage,
    kickoffTime: text(item.kickoffTime ?? item.kickoff_time) || undefined,
    homeCountryCode:
      text(item.homeCountryCode ?? item.home_country_code) || undefined,
    awayCountryCode:
      text(item.awayCountryCode ?? item.away_country_code) || undefined,
  };
}

function readRoundOf32MarketDeployments() {
  const parsed = readJsonFile<
    Record<string, unknown>[] | Record<string, Record<string, unknown>>
  >("markets.json", []);
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
    const fallbackKey =
      item.worldCupMarketId || `${item.fixtureId}:${item.outcomeType}`;
    const key = marketKey || fallbackKey;
    if (!key) continue;

    const existing = byKey.get(key);
    byKey.set(key, {
      ...existing,
      ...item,
      collateralAddress: item.collateralAddress ?? existing?.collateralAddress,
      collateralSymbol: item.collateralSymbol ?? existing?.collateralSymbol,
      collateralDecimals:
        item.collateralDecimals ?? existing?.collateralDecimals,
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
  const parsed = readJsonFile<
    Record<string, unknown>[] | Record<string, Record<string, unknown>>
  >("world-cup-deployments.json", []);
  const deployments = (
    Array.isArray(parsed) ? parsed : Object.values(parsed)
  ).map(normalizeDeployment);
  deployments.push(...readRoundOf32MarketDeployments());
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from("world_cup_deployments")
      .select("*")
      .order("fixture_id", { ascending: true });

    if (!error && data) {
      deployments.push(
        ...data.map((item) =>
          normalizeDeployment(item as Record<string, unknown>),
        ),
      );
    }
  }

  return mergeDeployments(deployments)
    .filter(
      (item) =>
        isAddress(item.marketAddress) &&
        isAddress(item.ammAddress) &&
        item.contractVersion === 2,
    )
    .sort((a, b) =>
      `${a.fixtureId}-${a.outcomeType}`.localeCompare(
        `${b.fixtureId}-${b.outcomeType}`,
      ),
    );
}

function tokenText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function validDecimals(value: unknown, fallback: number) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 255
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientRpcError(error: unknown) {
  const message = errorText(error).toLowerCase();
  return [
    "http request failed",
    "request failed",
    "network",
    "timeout",
    "timed out",
    "rate limit",
    "too many requests",
    "fetch failed",
    "transport",
    "connection",
    "econnreset",
    "socket",
    "rpc",
  ].some((part) => message.includes(part));
}

async function withRpcRetry<T>(
  task: () => Promise<T>,
  maxRetries = 2,
): Promise<T> {
  const delays = [250, 600];
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isTransientRpcError(error)) break;
      await sleep(delays[attempt] ?? delays[delays.length - 1]);
    }
  }

  throw lastError;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );

  return results;
}

async function readContractsDetailed(
  publicClient: ReadContractClient,
  calls: ContractRead[],
) {
  if (calls.length === 0) return [];

  try {
    const results = await withRpcRetry(() =>
      publicClient.multicall({
        allowFailure: true,
        contracts: calls,
      }),
    );

    const detailed = results.map((result): ContractReadResult =>
      result.status === "success"
        ? { status: "success", result: result.result }
        : { status: "failure", error: errorText(result.error) },
    );

    const retried = await Promise.all(
      detailed.map(async (result, index): Promise<ContractReadResult> => {
        if (result.status === "success" || !isTransientRpcError(result.error))
          return result;

        try {
          const value = await withRpcRetry(() =>
            publicClient.readContract(calls[index]),
          );
          return { status: "success", result: value };
        } catch (error) {
          return { status: "failure", error: errorText(error) };
        }
      }),
    );

    return retried;
  } catch {
    const results: ContractReadResult[] = [];

    for (const call of calls) {
      try {
        const value = await withRpcRetry(() => publicClient.readContract(call));
        results.push({ status: "success", result: value });
      } catch (error) {
        results.push({ status: "failure", error: errorText(error) });
      }
    }

    return results;
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

function parseTimeMs(value?: string) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function prioritizeDeployments(
  deployments: WorldCupDeployment[],
  mode: WalletPositionScanMode,
  maxMarkets = DEFAULT_FAST_SCAN_LIMIT,
) {
  if (mode === "full" || deployments.length <= maxMarkets) return deployments;

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const byKey = new Map<string, WorldCupDeployment>();
  const add = (deployment: WorldCupDeployment) => {
    const key =
      normalizeAddress(deployment.marketAddress) ||
      deployment.worldCupMarketId ||
      `${deployment.fixtureId}:${deployment.outcomeType}`;
    if (key && !byKey.has(key)) byKey.set(key, deployment);
  };

  const roundOf32 = deployments.filter(isRoundOf32Deployment);
  roundOf32.forEach(add);

  const scored = deployments
    .filter((deployment) => !isRoundOf32Deployment(deployment))
    .map((deployment) => {
      const kickoffMs = parseTimeMs(deployment.kickoffTime);
      const isV2 = deployment.contractVersion === 2;
      const isUpcoming = kickoffMs !== null && kickoffMs >= now;
      const isRecent =
        kickoffMs !== null && kickoffMs < now && now - kickoffMs <= sevenDaysMs;
      const hasKickoff = kickoffMs !== null;
      const score =
        (isUpcoming ? 1000 : 0) +
        (isRecent ? 800 : 0) +
        (isV2 ? 200 : 0) +
        (hasKickoff ? 50 : 0);
      return { deployment, kickoffMs: kickoffMs ?? Number.MAX_SAFE_INTEGER, score };
    })
    .sort((a, b) => b.score - a.score || a.kickoffMs - b.kickoffMs);

  for (const { deployment } of scored) {
    if (byKey.size >= maxMarkets) break;
    add(deployment);
  }

  return Array.from(byKey.values());
}

async function performScan(
  wallet: Address,
  includeDebug = false,
  options: WalletPositionScanOptions = {},
): Promise<WalletPositionScan> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL?.trim() ||
    "https://rpc.testnet.arc.network";

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  }) as unknown as ReadContractClient;

  const allDeployments = await readDeployments();
  const scanMode = options.mode ?? "fast";
  const deployments = prioritizeDeployments(
    allDeployments,
    scanMode,
    options.maxMarkets,
  );
  const roundOf32Deployments = deployments.filter(isRoundOf32Deployment);
  const roundOf32BalanceReads = new Map<string, RoundOf32PositionDebug>();

  if (includeDebug) {
    for (const deployment of roundOf32Deployments) {
      roundOf32BalanceReads.set(
        normalizeAddress(deployment.marketAddress) ?? deployment.marketAddress,
        {
          title: deployment.question,
          marketAddress: deployment.marketAddress,
          ammAddress: deployment.ammAddress,
          balanceReadsSucceeded: false,
          yesBalance: "0",
          noBalance: "0",
          outcomeDecimals: null,
          contractVersion: deployment.contractVersion,
        },
      );
    }
  }

  let failed = 0;
  let settledMarketCount = 0;

  type MarketMetadata = {
    deployment: WorldCupDeployment;
    collateralAddress: string;
    isSettled: boolean;
    settlementPrice: bigint;
    longToken: string;
    shortToken: string;
  };

  async function readMarketMetadata(
    deployment: WorldCupDeployment,
  ): Promise<MarketMetadata | null> {
    const address = deployment.marketAddress as Address;
    const roundOf32Key =
      normalizeAddress(deployment.marketAddress) ?? deployment.marketAddress;
    const roundOf32Debug = roundOf32BalanceReads.get(roundOf32Key);

    const [
      collateralTokenResult,
      receivedSettlementPriceResult,
      settlementPriceResult,
      longTokenResult,
      shortTokenResult,
    ] = await readContractsDetailed(publicClient, [
      { address, abi: MARKET_ABI, functionName: "collateralToken" },
      { address, abi: MARKET_ABI, functionName: "receivedSettlementPrice" },
      { address, abi: MARKET_ABI, functionName: "settlementPrice" },
      { address, abi: MARKET_ABI, functionName: "longToken" },
      { address, abi: MARKET_ABI, functionName: "shortToken" },
    ]);

    const collateralToken = readResultValue(collateralTokenResult);
    const receivedSettlementPrice = readResultValue(
      receivedSettlementPriceResult,
    );
    const settlementPrice = readResultValue(settlementPriceResult);
    const longToken = readResultValue(longTokenResult);
    const shortToken = readResultValue(shortTokenResult);

    const missingRequired = [
      typeof collateralToken !== "string"
        ? `collateralToken: ${readResultError(collateralTokenResult) ?? "invalid value"}`
        : "",
      typeof longToken !== "string"
        ? `longToken: ${readResultError(longTokenResult) ?? "invalid value"}`
        : "",
      typeof shortToken !== "string"
        ? `shortToken: ${readResultError(shortTokenResult) ?? "invalid value"}`
        : "",
    ].filter(Boolean);

    if (missingRequired.length > 0) {
      failed += 1;
      if (roundOf32Debug) {
        roundOf32Debug.failureReason = missingRequired.join("; ");
      }
      return null;
    }

    const isSettled =
      typeof receivedSettlementPrice === "boolean"
        ? receivedSettlementPrice
        : false;

    if (isSettled && typeof settlementPrice !== "bigint") {
      failed += 1;
      if (roundOf32Debug) {
        roundOf32Debug.failureReason =
          readResultError(settlementPriceResult) ||
          "Settled market settlementPrice read returned an invalid value";
      }
      return null;
    }

    const collateralTokenAddress = collateralToken as string;
    const longTokenAddress = longToken as string;
    const shortTokenAddress = shortToken as string;

    const collateralAddress = normalizeAddress(collateralTokenAddress);
    if (
      !collateralAddress ||
      longTokenAddress === ZERO_ADDRESS ||
      shortTokenAddress === ZERO_ADDRESS ||
      !isAddress(longTokenAddress) ||
      !isAddress(shortTokenAddress)
    ) {
      failed += 1;
      if (roundOf32Debug) {
        roundOf32Debug.failureReason =
          "Market returned an invalid collateral, long token, or short token address";
      }
      return null;
    }

    if (isSettled) settledMarketCount += 1;

    if (
      roundOf32Debug &&
      typeof receivedSettlementPrice !== "boolean" &&
      readResultError(receivedSettlementPriceResult)
    ) {
      roundOf32Debug.failureReason = `Settlement status unavailable, treated as open: ${readResultError(receivedSettlementPriceResult)}`;
    }

    return {
      deployment,
      collateralAddress,
      isSettled,
      settlementPrice:
        typeof settlementPrice === "bigint" ? settlementPrice : 0n,
      longToken: longTokenAddress,
      shortToken: shortTokenAddress,
    };
  }

  async function readPosition(
    market: MarketMetadata,
  ): Promise<WalletPosition | null> {
    const roundOf32Key =
      normalizeAddress(market.deployment.marketAddress) ??
      market.deployment.marketAddress;
    const roundOf32Debug = roundOf32BalanceReads.get(roundOf32Key);

    const [
      yesBalanceResult,
      noBalanceResult,
      collateralBalanceResult,
      symbolResult,
      nameResult,
      decimalsResult,
      outcomeDecimalsResult,
    ] = await readContractsDetailed(publicClient, [
      {
        address: market.longToken as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet],
      },
      {
        address: market.shortToken as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet],
      },
      {
        address: market.collateralAddress as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet],
      },
      {
        address: market.collateralAddress as Address,
        abi: ERC20_ABI,
        functionName: "symbol",
      },
      {
        address: market.collateralAddress as Address,
        abi: ERC20_ABI,
        functionName: "name",
      },
      {
        address: market.collateralAddress as Address,
        abi: ERC20_ABI,
        functionName: "decimals",
      },
      {
        address: market.longToken as Address,
        abi: ERC20_ABI,
        functionName: "decimals",
      },
    ]);

    const yesBalanceRaw = readResultValue(yesBalanceResult);
    const noBalanceRaw = readResultValue(noBalanceResult);
    const collateralBalanceRaw = readResultValue(collateralBalanceResult);
    const symbolRaw = readResultValue(symbolResult);
    const nameRaw = readResultValue(nameResult);
    const decimalsRaw = readResultValue(decimalsResult);
    const outcomeDecimalsRaw = readResultValue(outcomeDecimalsResult);

    const yesReadSucceeded = typeof yesBalanceRaw === "bigint";
    const noReadSucceeded = typeof noBalanceRaw === "bigint";
    const yesBalance = yesReadSucceeded ? yesBalanceRaw : 0n;
    const noBalance = noReadSucceeded ? noBalanceRaw : 0n;
    const partialReadSucceeded = yesReadSucceeded || noReadSucceeded;

    if (!partialReadSucceeded) {
      failed += 1;
      if (roundOf32Debug) {
        roundOf32Debug.failureReason = [
          `YES balance: ${readResultError(yesBalanceResult) ?? "invalid value"}`,
          `NO balance: ${readResultError(noBalanceResult) ?? "invalid value"}`,
        ].join("; ");
      }
      return null;
    }

    const configuredCollateral = getCollateralMetadataByAddress(
      market.collateralAddress,
    );
    const collateralDecimals = validDecimals(
      decimalsRaw,
      configuredCollateral.decimals,
    );
    const outcomeDecimals = validDecimals(
      outcomeDecimalsRaw,
      market.deployment.outcomeDecimals ?? collateralDecimals,
    );
    const collateralBalance =
      typeof collateralBalanceRaw === "bigint" ? collateralBalanceRaw : 0n;
    const collateralSymbol = tokenText(
      symbolRaw,
      configuredCollateral.symbol,
      16,
    );
    const collateralName = tokenText(nameRaw, configuredCollateral.name, 64);

    if (roundOf32Debug) {
      roundOf32Debug.balanceReadsSucceeded =
        yesReadSucceeded && noReadSucceeded;
      roundOf32Debug.partialReadSucceeded = partialReadSucceeded;
      roundOf32Debug.yesBalance = yesBalance.toString();
      roundOf32Debug.noBalance = noBalance.toString();
      roundOf32Debug.outcomeDecimals = outcomeDecimals;
      roundOf32Debug.failureReason =
        [
          !yesReadSucceeded
            ? `YES balance: ${readResultError(yesBalanceResult) ?? "invalid value after retries"}`
            : "",
          !noReadSucceeded
            ? `NO balance: ${readResultError(noBalanceResult) ?? "invalid value after retries"}`
            : "",
          yesBalance <= 0n && noBalance <= 0n
            ? "Wallet has zero YES and NO balance"
            : "",
        ]
          .filter(Boolean)
          .join("; ") || undefined;
    }

    if (yesBalance <= 0n && noBalance <= 0n) return null;

    const claimLongAmount =
      market.isSettled && market.settlementPrice > 0n ? yesBalance : 0n;
    const claimShortAmount =
      market.isSettled && market.settlementPrice < ONE ? noBalance : 0n;
    const claimablePayout =
      (claimLongAmount * market.settlementPrice +
        claimShortAmount * (ONE - market.settlementPrice)) /
      ONE;

    return {
      id: market.deployment.worldCupMarketId || market.deployment.marketAddress,
      fixtureId: market.deployment.fixtureId,
      group: market.deployment.group,
      title: market.deployment.question,
      address: market.deployment.marketAddress,
      ammAddress: market.deployment.ammAddress,
      yesBalance: yesBalance.toString(),
      noBalance: noBalance.toString(),
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
      claimablePayoutFormatted: formatTokenAmount(
        claimablePayout,
        collateralDecimals,
      ),
      collateralAddress: market.collateralAddress,
      collateralSymbol,
      collateralName,
      collateralDecimals,
      collateralBalance: collateralBalance.toString(),
      collateralBalanceFormatted: formatTokenAmount(
        collateralBalance,
        collateralDecimals,
      ),
      collateralWarning: configuredCollateral.warning,
      contractVersion: market.deployment.contractVersion,
      outcomeDecimals,
    };
  }

  const marketMetadata = (
    await mapWithConcurrency(deployments, 3, readMarketMetadata)
  ).filter((market): market is MarketMetadata => Boolean(market));

  const positions = (await mapWithConcurrency(marketMetadata, 3, readPosition))
    .filter((position): position is WalletPosition => Boolean(position))
    .sort((a, b) => {
      if (a.isSettled !== b.isSettled)
        return Number(a.isSettled) - Number(b.isSettled);
      return a.title.localeCompare(b.title);
    });

  const openPositions = positions.filter((position) => !position.isSettled);
  const settledPositions = positions.filter((position) => position.isSettled);
  const claimablePositions = settledPositions.filter(
    (position) => BigInt(position.claimablePayout) > 0n,
  );

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
          totalAvailableMarkets: allDeployments.length,
          skippedByFastMode: Math.max(allDeployments.length - deployments.length, 0),
          scanMode,
        }
      : undefined,
  };
}

export async function scanWalletPositions(
  wallet: Address,
  forceRefresh = false,
  includeDebug = false,
  options: WalletPositionScanOptions = {},
): Promise<WalletPositionScan> {
  const mode = options.mode ?? "fast";
  const key = `${wallet.toLowerCase()}:${mode}:${options.maxMarkets ?? "default"}`;
  const cached = scanCache.get(key);

  if (
    !includeDebug &&
    !forceRefresh &&
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.value;
  }

  if (!includeDebug && !forceRefresh) {
    const inFlight = scansInFlight.get(key);
    if (inFlight) return inFlight;
  }

  const scan = performScan(wallet, includeDebug, { ...options, mode });
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
