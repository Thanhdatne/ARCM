import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "@/lib/chain";
import { getAdminRequestError } from "@/lib/adminGuard";

export const runtime = "nodejs";
export const maxDuration = 300;

const YES_PRICE = 1000000000000000000n;
const NO_PRICE = 0n;
const MAX_ACTIONS_PER_RUN = 9;

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
  {
    inputs: [
      { name: "requester", type: "address" },
      { name: "identifier", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "ancillaryData", type: "bytes" },
      { name: "proposedPrice", type: "int256" },
    ],
    name: "proposePrice",
    outputs: [{ name: "totalBond", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "requester", type: "address" },
      { name: "identifier", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "ancillaryData", type: "bytes" },
    ],
    name: "settle",
    outputs: [{ name: "payout", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const ERC20_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "ownerAddress", type: "address" },
      { name: "value", type: "uint256" },
    ],
    name: "allocateTo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

type OutcomeType = "home_win" | "draw" | "away_win";
type ResultValue = OutcomeType;

interface WorldCupDeployment {
  worldCupMarketId: string;
  fixtureId: string;
  group: string;
  question: string;
  outcomeType: string;
  marketAddress: string;
  ammAddress: string;
  createdAt: string;
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
  result?: ResultValue | null;
  updatedAt: string;
  source?: string;
}

interface AutoResolveItem {
  fixtureId: string;
  worldCupMarketId: string;
  question: string;
  outcomeType: string;
  expectedResult: string;
  proposedSide: "YES" | "NO";
  action: "proposed" | "settled" | "skipped" | "failed";
  reason?: string;
  state?: number;
  txHash?: Hex;
}

function dataPath(fileName: string) {
  return path.resolve(process.cwd(), "data", fileName);
}

function readJsonFile<T>(fileName: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(dataPath(fileName), "utf-8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function readDeployments() {
  return readJsonFile<WorldCupDeployment[]>("world-cup-deployments.json", []);
}

function readResults() {
  const parsed = readJsonFile<Record<string, WorldCupResultRecord> | WorldCupResultRecord[]>(
    "world-cup-results.json",
    {},
  );

  if (Array.isArray(parsed)) return parsed;

  if (parsed && typeof parsed === "object") {
    return Object.values(parsed);
  }

  return [];
}

function isOutcomeType(value: string): value is OutcomeType {
  return value === "home_win" || value === "draw" || value === "away_win";
}

function outcomePrice(outcomeType: string, result: ResultValue | null | undefined) {
  if (!result || !isOutcomeType(outcomeType)) return null;
  return outcomeType === result ? YES_PRICE : NO_PRICE;
}

function outcomeLabel(price: bigint): "YES" | "NO" {
  return price === YES_PRICE ? "YES" : "NO";
}

function envAddress(name: string) {
  const value = process.env[name]?.trim();
  if (!value || !value.startsWith("0x")) {
    throw new Error(`${name} is not configured.`);
  }

  return value as Address;
}

function getPrivateKey() {
  const value = process.env.PRIVATE_KEY?.trim();
  if (!value) throw new Error("PRIVATE_KEY is not configured.");

  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function shouldRetry(error: unknown) {
  const message = errorMessage(error).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("http request failed") ||
    message.includes("temporarily unavailable")
  );
}

async function withRetry<T>(label: string, operation: () => Promise<T>, maxAttempts = 4) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === maxAttempts) break;

      const delayMs = Math.min(5_000 * attempt, 20_000);
      console.warn(`[auto-resolve] ${label} retry ${attempt}/${maxAttempts - 1}`, errorMessage(error));
      await sleep(delayMs);
    }
  }

  throw new Error(`${label} failed: ${errorMessage(lastError)}`);
}

async function waitForTx(
  publicClient: ReturnType<typeof createPublicClient>,
  hash: Hex,
) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: 2_000,
    timeout: 180_000,
  });

  if (receipt.status === "reverted") {
    throw new Error(`Transaction reverted after mining: ${hash}`);
  }

  return receipt;
}

async function getOracleRequestContext(
  publicClient: ReturnType<typeof createPublicClient>,
  marketAddress: Address,
) {
  const [priceRequested, receivedSettlementPrice, requestTimestamp, priceIdentifier, ancillaryData] =
    await Promise.all([
      withRetry("Read priceRequested", () =>
        publicClient.readContract({
          address: marketAddress,
          abi: MARKET_ABI,
          functionName: "priceRequested",
        }),
      ),
      withRetry("Read receivedSettlementPrice", () =>
        publicClient.readContract({
          address: marketAddress,
          abi: MARKET_ABI,
          functionName: "receivedSettlementPrice",
        }),
      ),
      withRetry("Read requestTimestamp", () =>
        publicClient.readContract({
          address: marketAddress,
          abi: MARKET_ABI,
          functionName: "requestTimestamp",
        }),
      ),
      withRetry("Read priceIdentifier", () =>
        publicClient.readContract({
          address: marketAddress,
          abi: MARKET_ABI,
          functionName: "priceIdentifier",
        }),
      ),
      withRetry("Read customAncillaryData", () =>
        publicClient.readContract({
          address: marketAddress,
          abi: MARKET_ABI,
          functionName: "customAncillaryData",
        }),
      ),
    ]);

  return {
    priceRequested: Boolean(priceRequested),
    receivedSettlementPrice: Boolean(receivedSettlementPrice),
    requestTimestamp: requestTimestamp as bigint,
    priceIdentifier: priceIdentifier as Hex,
    ancillaryData: ancillaryData as Hex,
  };
}

async function ensureOracleCollateralReady({
  publicClient,
  walletClient,
  accountAddress,
  arctAddress,
  oracleAddress,
  getNonce,
}: {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: any;
  accountAddress: Address;
  arctAddress: Address;
  oracleAddress: Address;
  getNonce: () => number;
}) {
  const minimumBalance = parseEther("1000");
  const approvalAmount = parseEther("1000000");

  const balance = await withRetry("Read ARCT balance", () =>
    publicClient.readContract({
      address: arctAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [accountAddress],
    }),
  );

  if ((balance as bigint) < minimumBalance) {
    const mintHash = await withRetry("Top up ARCT resolver balance", () =>
      walletClient.writeContract({
        address: arctAddress,
        abi: ERC20_ABI,
        functionName: "allocateTo",
        args: [accountAddress, approvalAmount],
        nonce: getNonce(),
      }),
      3,
    );
    await waitForTx(publicClient, mintHash as Hex);
  }

  const allowance = await withRetry("Read OO ARCT allowance", () =>
    publicClient.readContract({
      address: arctAddress,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [accountAddress, oracleAddress],
    }),
  );

  if ((allowance as bigint) < minimumBalance) {
    const approveHash = await withRetry("Approve ARCT for OO", () =>
      walletClient.writeContract({
        address: arctAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [oracleAddress, approvalAmount],
        nonce: getNonce(),
      }),
      3,
    );
    await waitForTx(publicClient, approveHash as Hex);
  }
}

export async function POST(request: Request) {
  const adminError = getAdminRequestError(
    request,
    "Admin auto resolve is disabled.",
  );
  if (adminError) return adminError;

  let maxActions = MAX_ACTIONS_PER_RUN;

  try {
    const body = await request.json().catch(() => ({}));
    const requestedMaxActions =
      typeof body?.maxActions === "number" && Number.isFinite(body.maxActions)
        ? Math.floor(body.maxActions)
        : MAX_ACTIONS_PER_RUN;
    maxActions = Math.min(Math.max(requestedMaxActions, 1), 18);
  } catch {
    maxActions = MAX_ACTIONS_PER_RUN;
  }

  const items: AutoResolveItem[] = [];
  let proposed = 0;
  let settled = 0;
  let skipped = 0;
  let failed = 0;
  let checked = 0;
  let actions = 0;
  let stoppedEarly = false;

  try {
    const privateKey = getPrivateKey();
    const oracleAddress = envAddress("NEXT_PUBLIC_OO_V2_ADDRESS");
    const arctAddress = envAddress("NEXT_PUBLIC_ARCT_ADDRESS");

    const account = privateKeyToAccount(privateKey);
    const rpcUrl =
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL?.trim() ||
      "https://rpc.testnet.arc.network";

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(rpcUrl),
    });

    let nextNonce = await withRetry("Read resolver nonce", () =>
      publicClient.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      }),
      5,
    );

    const getNonce = () => {
      const nonce = nextNonce;
      nextNonce += 1;
      return nonce;
    };

    const resultsByFixtureId = readResults().reduce<Record<string, WorldCupResultRecord>>(
      (acc, result) => {
        if (result.fixtureId) acc[result.fixtureId] = result;
        return acc;
      },
      {},
    );

    const deployments = readDeployments()
      .filter((deployment) => {
        const result = resultsByFixtureId[deployment.fixtureId];
        return result?.status === "final" && !!result.result;
      })
      .sort((a, b) =>
        `${a.fixtureId}-${a.outcomeType}`.localeCompare(`${b.fixtureId}-${b.outcomeType}`),
      );

    if (deployments.length > 0) {
      await ensureOracleCollateralReady({
        publicClient,
        walletClient,
        accountAddress: account.address,
        arctAddress,
        oracleAddress,
        getNonce,
      });
    }

    for (const deployment of deployments) {
      if (actions >= maxActions) {
        stoppedEarly = true;
        break;
      }

      checked += 1;
      const result = resultsByFixtureId[deployment.fixtureId];
      const price = outcomePrice(deployment.outcomeType, result?.result);

      const baseItem = {
        fixtureId: deployment.fixtureId,
        worldCupMarketId: deployment.worldCupMarketId,
        question: deployment.question,
        outcomeType: deployment.outcomeType,
        expectedResult: result?.result ?? "unknown",
        proposedSide: price !== null ? outcomeLabel(price) : "NO",
      } satisfies Omit<AutoResolveItem, "action">;

      if (price === null) {
        skipped += 1;
        items.push({
          ...baseItem,
          action: "skipped",
          reason: "Missing final result or unsupported outcome type.",
        });
        continue;
      }

      const marketAddress = deployment.marketAddress as Address;

      try {
        const context = await getOracleRequestContext(publicClient, marketAddress);

        if (!context.priceRequested) {
          skipped += 1;
          items.push({
            ...baseItem,
            action: "skipped",
            reason: "Market has not requested an oracle price yet.",
          });
          continue;
        }

        if (context.receivedSettlementPrice) {
          skipped += 1;
          items.push({
            ...baseItem,
            action: "skipped",
            reason: "Market already received settlement price.",
          });
          continue;
        }

        const state = Number(
          await withRetry("Read OO state", () =>
            publicClient.readContract({
              address: oracleAddress,
              abi: OO_V2_ABI,
              functionName: "getState",
              args: [
                marketAddress,
                context.priceIdentifier,
                context.requestTimestamp,
                context.ancillaryData,
              ],
            }),
          ),
        );

        // 1 = Requested, 0 = Invalid. In practice initialized markets should be
        // Requested. Treat Invalid as propose-able only when priceRequested is true.
        if (state === 1 || state === 0) {
          const hash = await withRetry("Propose World Cup outcome", () =>
            walletClient.writeContract({
              address: oracleAddress,
              abi: OO_V2_ABI,
              functionName: "proposePrice",
              args: [
                marketAddress,
                context.priceIdentifier,
                context.requestTimestamp,
                context.ancillaryData,
                price,
              ],
              nonce: getNonce(),
            }),
            3,
          );
          await waitForTx(publicClient, hash as Hex);
          actions += 1;
          proposed += 1;
          items.push({
            ...baseItem,
            action: "proposed",
            reason: `Proposed ${outcomeLabel(price)}.`,
            state,
            txHash: hash as Hex,
          });
          continue;
        }

        // 2 = Proposed. Settle only after liveness expiration.
        if (state === 2) {
          const requestData = await withRetry("Read OO request", () =>
            publicClient.readContract({
              address: oracleAddress,
              abi: OO_V2_ABI,
              functionName: "getRequest",
              args: [
                marketAddress,
                context.priceIdentifier,
                context.requestTimestamp,
                context.ancillaryData,
              ],
            }),
          );

          const expirationTime =
            typeof requestData === "object" && requestData && "expirationTime" in requestData
              ? (requestData as { expirationTime: bigint }).expirationTime
              : 0n;
          const now = BigInt(Math.floor(Date.now() / 1000));

          if (expirationTime > now) {
            skipped += 1;
            items.push({
              ...baseItem,
              action: "skipped",
              reason: `Proposal active. Settle after ${new Date(Number(expirationTime) * 1000).toISOString()}.`,
              state,
            });
            continue;
          }

          const hash = await withRetry("Settle expired OO proposal", () =>
            walletClient.writeContract({
              address: oracleAddress,
              abi: OO_V2_ABI,
              functionName: "settle",
              args: [
                marketAddress,
                context.priceIdentifier,
                context.requestTimestamp,
                context.ancillaryData,
              ],
              nonce: getNonce(),
            }),
            3,
          );
          await waitForTx(publicClient, hash as Hex);
          actions += 1;
          settled += 1;
          items.push({
            ...baseItem,
            action: "settled",
            reason: "Settled expired oracle proposal.",
            state,
            txHash: hash as Hex,
          });
          continue;
        }

        // 3 = Expired, 5 = Resolved. Both are settle-able.
        if (state === 3 || state === 5) {
          const hash = await withRetry("Settle ready OO request", () =>
            walletClient.writeContract({
              address: oracleAddress,
              abi: OO_V2_ABI,
              functionName: "settle",
              args: [
                marketAddress,
                context.priceIdentifier,
                context.requestTimestamp,
                context.ancillaryData,
              ],
              nonce: getNonce(),
            }),
            3,
          );
          await waitForTx(publicClient, hash as Hex);
          actions += 1;
          settled += 1;
          items.push({
            ...baseItem,
            action: "settled",
            reason: "Settled ready oracle request.",
            state,
            txHash: hash as Hex,
          });
          continue;
        }

        skipped += 1;
        items.push({
          ...baseItem,
          action: "skipped",
          reason:
            state === 4
              ? "Oracle request is disputed."
              : state === 6
                ? "Oracle request already settled."
                : `Oracle state ${state} is not actionable.`,
          state,
        });
      } catch (error) {
        failed += 1;
        items.push({
          ...baseItem,
          action: "failed",
          reason: errorMessage(error),
        });
      }
    }

    const processed = proposed + settled + skipped + failed;

    return NextResponse.json({
      success: true,
      checked,
      processed,
      proposed,
      settled,
      skipped,
      failed,
      actions,
      maxActions,
      stoppedEarly,
      hasMore: stoppedEarly,
      totalFinalMarkets: deployments.length,
      remainingApprox: Math.max(deployments.length - checked, 0),
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: errorMessage(error),
        checked,
        proposed,
        settled,
        skipped,
        failed,
        items,
      },
      { status: 500 },
    );
  }
}
