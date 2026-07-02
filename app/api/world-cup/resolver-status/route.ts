import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import {
  createPublicClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { arcTestnet } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARKET_ABI = [
  {
    inputs: [],
    name: "priceRequested",
    outputs: [{ name: "", type: "bool" }],
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
    name: "requestTimestamp",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "priceIdentifier",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "customAncillaryData",
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const OO_V2_ABI = [
  {
    inputs: [
      { name: "requester", type: "address" },
      { name: "identifier", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "ancillaryData", type: "bytes" },
    ],
    name: "getState",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "requester", type: "address" },
      { name: "identifier", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "ancillaryData", type: "bytes" },
    ],
    name: "getRequest",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "proposer", type: "address" },
          { name: "disputer", type: "address" },
          { name: "currency", type: "address" },
          { name: "settled", type: "bool" },
          {
            name: "requestSettings",
            type: "tuple",
            components: [
              { name: "eventBased", type: "bool" },
              { name: "refundOnDispute", type: "bool" },
              { name: "callbackOnPriceProposed", type: "bool" },
              { name: "callbackOnPriceDisputed", type: "bool" },
              { name: "callbackOnPriceSettled", type: "bool" },
              { name: "bond", type: "uint256" },
              { name: "customLiveness", type: "uint256" },
            ],
          },
          { name: "proposedPrice", type: "int256" },
          { name: "resolvedPrice", type: "int256" },
          { name: "expirationTime", type: "uint256" },
          { name: "reward", type: "uint256" },
          { name: "finalFee", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

type OutcomeType = "home_win" | "draw" | "away_win";
const ARC_NATIVE_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

interface WorldCupDeployment {
  worldCupMarketId: string;
  fixtureId: string;
  group: string;
  question: string;
  outcomeType: string;
  marketAddress: string;
  ammAddress: string;
  contractVersion?: number;
  collateralAddress?: string;
  collateralSymbol?: string;
  collateralDecimals?: number;
  isRoundOf32V2?: boolean;
}

interface WorldCupResultRecord {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "pending" | "final" | "postponed" | "cancelled";
  result?: OutcomeType | null;
  updatedAt: string;
  source?: string;
  marketAddress?: string;
}

interface StoredMarketRecord {
  id?: string;
  address?: string;
  marketAddress?: string;
  ammAddress?: string;
  title?: string;
  category?: string;
  homeTeam?: string;
  awayTeam?: string;
  stage?: string;
  contractVersion?: number;
  collateralAddress?: string;
  collateralSymbol?: string;
  collateralDecimals?: number;
  finalHomeScore?: number;
  finalAwayScore?: number;
  winningSide?: "YES" | "NO";
  resultUpdatedAt?: string;
  resultStatus?: "saved" | "proposed" | "settled";
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

function readDeployments() {
  const parsed = readJsonFile<WorldCupDeployment[] | Record<string, WorldCupDeployment>>(
    "world-cup-deployments.json",
    [],
  );

  return Array.isArray(parsed) ? parsed : Object.values(parsed);
}

function readResults() {
  const parsed = readJsonFile<Record<string, WorldCupResultRecord> | WorldCupResultRecord[]>(
    "world-cup-results.json",
    {},
  );

  return Array.isArray(parsed) ? parsed : Object.values(parsed);
}

function readMarkets() {
  const parsed = readJsonFile<StoredMarketRecord[] | Record<string, StoredMarketRecord>>(
    "markets.json",
    [],
  );

  return Array.isArray(parsed) ? parsed : Object.values(parsed);
}

function isRoundOf32Title(value?: string) {
  return /^Will .+? eliminate .+? in the Round of 32\??$/i.test(value ?? "");
}

function normalizeMatchText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function roundOf32Title(homeTeam?: string, awayTeam?: string) {
  if (!homeTeam || !awayTeam) return "";
  return `Will ${homeTeam} eliminate ${awayTeam} in the Round of 32?`;
}

function roundOf32DeploymentMatchesResult(
  deployment: WorldCupDeployment,
  result: WorldCupResultRecord,
) {
  if (!deployment.isRoundOf32V2) return false;

  const resultMarketAddress = result.marketAddress?.toLowerCase();
  if (resultMarketAddress && deployment.marketAddress.toLowerCase() === resultMarketAddress) {
    return true;
  }

  const normalizedQuestion = normalizeMatchText(deployment.question);
  const exactTitle = normalizeMatchText(roundOf32Title(result.homeTeam, result.awayTeam));
  if (exactTitle && normalizedQuestion === exactTitle) return true;

  const homeTeam = normalizeMatchText(result.homeTeam);
  const awayTeam = normalizeMatchText(result.awayTeam);
  if (!homeTeam || !awayTeam) return false;

  return (
    normalizedQuestion.includes("round of 32") &&
    normalizedQuestion.includes(homeTeam) &&
    normalizedQuestion.includes(awayTeam)
  );
}

function isSavedRoundOf32Market(market: StoredMarketRecord) {
  const hasSavedResult =
    market.resultStatus === "saved" ||
    market.resultStatus === "proposed" ||
    market.resultStatus === "settled";

  return (
    (market.category ?? "").toLowerCase().includes("world cup") &&
    isRoundOf32Title(market.title) &&
    market.contractVersion === 2 &&
    hasSavedResult &&
    (market.winningSide === "YES" || market.winningSide === "NO") &&
    Boolean(market.marketAddress || market.address) &&
    Boolean(market.ammAddress)
  );
}

function roundOf32FixtureId(market: StoredMarketRecord) {
  return market.id || market.marketAddress || market.address || "";
}

function readRoundOf32Deployments(): WorldCupDeployment[] {
  return readMarkets()
    .filter(isSavedRoundOf32Market)
    .map((market) => ({
      worldCupMarketId: roundOf32FixtureId(market),
      fixtureId: roundOf32FixtureId(market),
      group: "Round of 32",
      question: market.title ?? "World Cup Round of 32 market",
      outcomeType: "home_win",
      marketAddress: market.marketAddress ?? market.address ?? "",
      ammAddress: market.ammAddress ?? "",
      contractVersion: 2,
      collateralAddress:
        market.collateralAddress ??
        (market.collateralSymbol?.toUpperCase() === "USDC"
          ? ARC_NATIVE_USDC_ADDRESS
          : undefined),
      collateralSymbol: market.collateralSymbol ?? "USDC",
      collateralDecimals: market.collateralDecimals ?? 6,
      isRoundOf32V2: true,
    }));
}

function readRoundOf32Results(): WorldCupResultRecord[] {
  return readMarkets()
    .filter(isSavedRoundOf32Market)
    .map((market) => ({
      fixtureId: roundOf32FixtureId(market),
      homeTeam: market.homeTeam ?? "",
      awayTeam: market.awayTeam ?? "",
      homeScore: typeof market.finalHomeScore === "number" ? market.finalHomeScore : null,
      awayScore: typeof market.finalAwayScore === "number" ? market.finalAwayScore : null,
      status: "final",
      result: market.winningSide === "YES" ? "home_win" : "away_win",
      updatedAt: market.resultUpdatedAt ?? new Date(0).toISOString(),
      marketAddress: market.marketAddress ?? market.address,
    }));
}

function envAddress(name: string) {
  const value = process.env[name]?.trim();
  if (!value || !value.startsWith("0x")) {
    throw new Error(`${name} is not configured.`);
  }

  return value as Address;
}

function getExpirationTime(requestData: unknown) {
  const tuple = requestData as { expirationTime?: unknown; [key: number]: unknown };
  const value = tuple?.expirationTime ?? tuple?.[7];

  return typeof value === "bigint" ? value : 0n;
}

function reasonForStatus({
  status,
  needsResolve,
  waiting,
  readyToSettle,
  settled,
  oracleSettled,
  failed,
  total,
  fastSettleAvailable,
}: {
  status: string;
  needsResolve: number;
  waiting: number;
  readyToSettle: number;
  settled: number;
  oracleSettled: number;
  failed: number;
  total: number;
  fastSettleAvailable: boolean;
}) {
  const marketLabel = total === 1 ? "market" : "markets";

  if (status === "settled") return `All ${total} ${marketLabel} are settled. Winners can claim.`;
  if (status === "readyToSettle") return `${readyToSettle}/${total} ${marketLabel} ${total === 1 ? "is" : "are"} ready to settle. Timer will sync before settlement.`;
  if (status === "waiting") {
    return fastSettleAvailable
      ? `${waiting}/${total} ${marketLabel} ${total === 1 ? "was" : "were"} proposed. Test Timer fast settlement is configured.`
      : `${waiting}/${total} ${marketLabel} ${total === 1 ? "was" : "were"} proposed. Waiting for UMA liveness; test Timer fast settlement is not configured.`;
  }
  if (status === "needsResolve") return `${needsResolve}/${total} ${marketLabel} still ${total === 1 ? "needs" : "need"} a proposal.`;
  if (status === "oracleSettled") return `${oracleSettled}/${total} oracle requests are settled but market state is not updated.`;
  if (status === "notDeployed") return "No deployed markets found for this fixture.";
  if (failed > 0) return `${failed}/${total} markets failed status checks.`;
  return "Mixed status. Refresh or inspect latest resolver run.";
}

export async function GET() {
  try {
    const oracleAddress = envAddress("NEXT_PUBLIC_OO_V2_ADDRESS");
    const rpcUrl =
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL?.trim() ||
      "https://rpc.testnet.arc.network";

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrl),
    });

    const results = [...readResults(), ...readRoundOf32Results()].filter((result) => result.status === "final" && result.result);
    const timerAddress = process.env.NEXT_PUBLIC_TIMER_ADDRESS?.trim() ?? "";
    const fastSettleAvailable =
      timerAddress.startsWith("0x") &&
      timerAddress.toLowerCase() !== "0x0000000000000000000000000000000000000000";
    const deployments = [...readDeployments(), ...readRoundOf32Deployments()];
    const deploymentsByFixture = deployments.reduce<Record<string, WorldCupDeployment[]>>(
      (acc, deployment) => {
        if (!acc[deployment.fixtureId]) acc[deployment.fixtureId] = [];
        acc[deployment.fixtureId].push(deployment);
        return acc;
      },
      {},
    );

    for (const result of results) {
      for (const deployment of deployments) {
        if (
          result.fixtureId !== deployment.fixtureId &&
          roundOf32DeploymentMatchesResult(deployment, result)
        ) {
          deploymentsByFixture[result.fixtureId] = [
            ...(deploymentsByFixture[result.fixtureId] ?? []),
            deployment,
          ];
        }
      }
    }

    const fixtures = [];

    for (const result of results) {
      const fixtureDeployments = (deploymentsByFixture[result.fixtureId] ?? [])
        .filter((deployment) => (
          deployment.outcomeType === "home_win" ||
          deployment.outcomeType === "draw" ||
          deployment.outcomeType === "away_win"
        ));

      const total = fixtureDeployments.length;

      if (total === 0) {
        fixtures.push({
          fixtureId: result.fixtureId,
          status: "notDeployed",
          reason: "No deployed markets found for this fixture.",
          marketsTotal: 0,
          needsResolve: 0,
          waiting: 0,
          readyToSettle: 0,
          settled: 0,
          oracleSettled: 0,
          failed: 0,
          fastSettleAvailable,
        });
        continue;
      }

      let needsResolve = 0;
      let waiting = 0;
      let readyToSettle = 0;
      let settled = 0;
      let oracleSettled = 0;
      let failed = 0;

      for (const deployment of fixtureDeployments) {
        try {
          const marketAddress = deployment.marketAddress as Address;

          const [
            priceRequested,
            receivedSettlementPrice,
            requestTimestamp,
            priceIdentifier,
            ancillaryData,
          ] = await Promise.all([
            publicClient.readContract({
              address: marketAddress,
              abi: MARKET_ABI,
              functionName: "priceRequested",
            }),
            publicClient.readContract({
              address: marketAddress,
              abi: MARKET_ABI,
              functionName: "receivedSettlementPrice",
            }),
            publicClient.readContract({
              address: marketAddress,
              abi: MARKET_ABI,
              functionName: "requestTimestamp",
            }),
            publicClient.readContract({
              address: marketAddress,
              abi: MARKET_ABI,
              functionName: "priceIdentifier",
            }),
            publicClient.readContract({
              address: marketAddress,
              abi: MARKET_ABI,
              functionName: "customAncillaryData",
            }),
          ]);

          if (receivedSettlementPrice) {
            settled += 1;
            continue;
          }

          if (!priceRequested) {
            needsResolve += 1;
            continue;
          }

          const state = Number(
            await publicClient.readContract({
              address: oracleAddress,
              abi: OO_V2_ABI,
              functionName: "getState",
              args: [
                marketAddress,
                priceIdentifier as Hex,
                requestTimestamp as bigint,
                ancillaryData as Hex,
              ],
            }),
          );

          if (state === 0 || state === 1) {
            needsResolve += 1;
            continue;
          }

          if (state === 2) {
            const requestData = await publicClient.readContract({
              address: oracleAddress,
              abi: OO_V2_ABI,
              functionName: "getRequest",
              args: [
                marketAddress,
                priceIdentifier as Hex,
                requestTimestamp as bigint,
                ancillaryData as Hex,
              ],
            });

            const expirationTime = getExpirationTime(requestData);

            // Do not mark a Proposed request as ready solely from wall-clock time.
            // The onchain OO state must become Expired before settle() is safe.
            waiting += 1;

            continue;
          }

          if (state === 3) {
            readyToSettle += 1;
            continue;
          }

          if (state === 5) {
            oracleSettled += 1;
            continue;
          }

          if (state === 6) {
            oracleSettled += 1;
            continue;
          }

          failed += 1;
        } catch {
          failed += 1;
        }
      }

      const status =
        total > 0 && settled === total
          ? "settled"
          : readyToSettle > 0
            ? "readyToSettle"
            : waiting > 0
              ? "waiting"
              : needsResolve === total
                ? "needsResolve"
                : oracleSettled > 0
                  ? "oracleSettled"
                  : needsResolve > 0
                    ? "partial"
                    : failed > 0
                      ? "unknown"
                      : "partial";

      fixtures.push({
        fixtureId: result.fixtureId,
        status,
        reason: reasonForStatus({
          status,
          needsResolve,
          waiting,
          readyToSettle,
          settled,
          oracleSettled,
          failed,
          total,
          fastSettleAvailable,
        }),
        marketsTotal: total,
        needsResolve,
        waiting,
        readyToSettle,
        settled,
        oracleSettled,
        failed,
        fastSettleAvailable,
      });
    }

    return NextResponse.json({
      success: true,
      fixtures,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Status check failed.",
        fixtures: [],
      },
      { status: 500 },
    );
  }
}
