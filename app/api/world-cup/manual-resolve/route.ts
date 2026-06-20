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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const TIMER_ABI = [
  {
    inputs: [{ name: "time", type: "uint256" }],
    name: "setCurrentTime",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

type OutcomeType = "home_win" | "draw" | "away_win";
type ResolverAction =
  | "resolveFixture"
  | "settleFixture"
  | "settleReady"
  | "resolveAndFastSettle";

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
  result?: OutcomeType | null;
  updatedAt: string;
  source?: string;
}

interface ResolverItem {
  fixtureId: string;
  outcomeType: string;
  question: string;
  proposedSide?: "YES" | "NO";
  action:
    | "prepared"
    | "proposed"
    | "timerAdvanced"
    | "settled"
    | "skipped"
    | "failed";
  reason: string;
  state?: number;
  txHash?: Hex;
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

function envAddress(name: string) {
  const value = process.env[name]?.trim();
  if (!value || !value.startsWith("0x")) {
    throw new Error(`${name} is not configured.`);
  }

  return value as Address;
}

function optionalAddress(name: string) {
  const value = process.env[name]?.trim();

  if (!value || !value.startsWith("0x") || value === ZERO_ADDRESS) {
    return null;
  }

  return value as Address;
}

function getPrivateKey() {
  const value = process.env.PRIVATE_KEY?.trim();
  if (!value) throw new Error("PRIVATE_KEY is not configured.");

  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
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

function isOutcomeType(value: string): value is OutcomeType {
  return value === "home_win" || value === "draw" || value === "away_win";
}

function outcomePrice(outcomeType: string, result: OutcomeType | null | undefined) {
  if (!result || !isOutcomeType(outcomeType)) return null;
  return outcomeType === result ? YES_PRICE : NO_PRICE;
}

function outcomeLabel(price: bigint): "YES" | "NO" {
  return price === YES_PRICE ? "YES" : "NO";
}

function getExpirationTime(requestData: unknown) {
  const tuple = requestData as { expirationTime?: unknown; [key: number]: unknown };
  const value = tuple?.expirationTime ?? tuple?.[7];

  return typeof value === "bigint" ? value : 0n;
}

function isSettleableState(state: number) {
  // UMA OO V2 active proposal becomes settleable after liveness expires.
  // State 3 is the explicit expired state. State 5 is resolved, but calling
  // settle there can revert with "_settle: not settleable" on this flow.
  return state === 3;
}

async function getOracleRequestContext(
  publicClient: ReturnType<typeof createPublicClient>,
  marketAddress: Address,
) {
  const [priceRequested, receivedSettlementPrice, requestTimestamp, priceIdentifier, ancillaryData] =
    await Promise.all([
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

  return {
    priceRequested: Boolean(priceRequested),
    receivedSettlementPrice: Boolean(receivedSettlementPrice),
    requestTimestamp: requestTimestamp as bigint,
    priceIdentifier: priceIdentifier as Hex,
    ancillaryData: ancillaryData as Hex,
  };
}

function settleReadyState(state: number) {
  return state === 3;
}

function proposalActiveState(state: number) {
  return state === 2;
}

async function queueCollateralSetup({
  publicClient,
  walletClient,
  accountAddress,
  arctAddress,
  oracleAddress,
  getNonce,
  items,
}: {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: any;
  accountAddress: Address;
  arctAddress: Address;
  oracleAddress: Address;
  getNonce: () => number;
  items: ResolverItem[];
}) {
  const minimumBalance = parseEther("1000");
  const approvalAmount = parseEther("1000000");

  const [balance, allowance] = await Promise.all([
    publicClient.readContract({
      address: arctAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [accountAddress],
    }),
    publicClient.readContract({
      address: arctAddress,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [accountAddress, oracleAddress],
    }),
  ]);

  if ((balance as bigint) < minimumBalance) {
    const hash = await walletClient.writeContract({
      address: arctAddress,
      abi: ERC20_ABI,
      functionName: "allocateTo",
      args: [accountAddress, approvalAmount],
      nonce: getNonce(),
    });

    items.push({
      fixtureId: "setup",
      outcomeType: "collateral",
      question: "Top up resolver ARCT",
      action: "prepared",
      reason: "Queued ARCT top up for resolver wallet.",
      txHash: hash as Hex,
    });
  }

  if ((allowance as bigint) < minimumBalance) {
    const hash = await walletClient.writeContract({
      address: arctAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [oracleAddress, approvalAmount],
      nonce: getNonce(),
    });

    items.push({
      fixtureId: "setup",
      outcomeType: "approval",
      question: "Approve ARCT for UMA Oracle",
      action: "prepared",
      reason: "Queued ARCT approval for UMA Oracle.",
      txHash: hash as Hex,
    });
  }
}

async function queueTimerSync({
  walletClient,
  getNonce,
  items,
  targetTime,
  marketItem,
  recordItem = true,
}: {
  walletClient: any;
  getNonce: () => number;
  items: ResolverItem[];
  targetTime?: bigint;
  marketItem?: Pick<ResolverItem, "fixtureId" | "outcomeType" | "question">;
  recordItem?: boolean;
}) {
  const timerAddress = optionalAddress("NEXT_PUBLIC_TIMER_ADDRESS");

  if (!timerAddress) return null;

  const nextTime = targetTime ?? BigInt(Math.floor(Date.now() / 1000));

  const hash = await walletClient.writeContract({
    address: timerAddress,
    abi: TIMER_ABI,
    functionName: "setCurrentTime",
    args: [nextTime],
    nonce: getNonce(),
  });

  if (recordItem) {
    items.push({
      fixtureId: marketItem?.fixtureId ?? "setup",
      outcomeType: marketItem?.outcomeType ?? "timer",
      question: marketItem?.question ?? "Fast-forward UMA timer",
      action: marketItem ? "timerAdvanced" : "prepared",
      reason: marketItem
        ? `Queued UMA Timer advance to ${nextTime.toString()}.`
        : "Queued UMA Timer sync before oracle settlement.",
      txHash: hash as Hex,
    });
  }

  return hash as Hex;
}

function getProposedPrice(requestData: unknown) {
  const tuple = requestData as { proposedPrice?: unknown; [key: number]: unknown };
  const value = tuple?.proposedPrice ?? tuple?.[5];

  return typeof value === "bigint" ? value : null;
}

export async function POST(request: Request) {
  const adminError = getAdminRequestError(
    request,
    "Admin fixture resolver is disabled.",
  );
  if (adminError) return adminError;

  let body: { action?: ResolverAction; fixtureId?: string; limit?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action;
  const fixtureId = typeof body.fixtureId === "string" ? body.fixtureId : "";
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.min(Math.max(Math.floor(body.limit), 1), 18)
      : 9;

  if (
    action !== "resolveFixture" &&
    action !== "settleFixture" &&
    action !== "settleReady" &&
    action !== "resolveAndFastSettle"
  ) {
    return NextResponse.json({ error: "Invalid resolver action." }, { status: 400 });
  }

  if ((action === "resolveFixture" || action === "settleFixture") && !fixtureId) {
    return NextResponse.json({ error: "fixtureId is required." }, { status: 400 });
  }

  const items: ResolverItem[] = [];
  let scanned = 0;
  let proposed = 0;
  let timerAdvanced = 0;
  let settled = 0;
  let skipped = 0;
  let failed = 0;

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

    const walletClient: any = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(rpcUrl),
    });

    let nextNonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: "pending",
    });

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

    let deployments = readDeployments()
      .filter((deployment) =>
        action !== "resolveAndFastSettle" ||
        (Boolean(deployment.marketAddress) && Boolean(deployment.ammAddress)),
      )
      .filter((deployment) => {
        if (
          action === "resolveFixture" ||
          action === "settleFixture" ||
          (action === "resolveAndFastSettle" && fixtureId)
        ) {
          return deployment.fixtureId === fixtureId;
        }

        const result = resultsByFixtureId[deployment.fixtureId];
        return result?.status === "final" && !!result.result;
      })
      .sort((a, b) =>
        `${a.fixtureId}-${a.outcomeType}`.localeCompare(`${b.fixtureId}-${b.outcomeType}`),
      );

    if (action === "resolveAndFastSettle" && !fixtureId) {
      const fixtureIds = [...new Set(deployments.map((deployment) => deployment.fixtureId))]
        .slice(0, Math.min(limit, 3));
      const selectedFixtureIds = new Set(fixtureIds);
      deployments = deployments.filter((deployment) =>
        selectedFixtureIds.has(deployment.fixtureId),
      );
    } else {
      deployments = deployments.slice(0, action === "settleReady" ? limit : 3);
    }

    scanned = deployments.length;

    if (deployments.length === 0) {
      return NextResponse.json({
        success: true,
        action,
        fixtureId,
        scanned,
        proposed,
        timerAdvanced,
        settled,
        skipped,
        failed,
        items: [
          {
            fixtureId: fixtureId || "all",
            outcomeType: "none",
            question: "No deployed markets found",
            action: "skipped",
            reason: "No deployed World Cup markets matched this request.",
          },
        ],
      });
    }

    if (action === "resolveFixture" || (action === "resolveAndFastSettle" && fixtureId)) {
      const result = resultsByFixtureId[fixtureId];
      if (!result || result.status !== "final" || !result.result) {
        return NextResponse.json(
          { error: "This fixture has no final result yet." },
          { status: 422 },
        );
      }
    }

    if (action === "resolveFixture" || action === "resolveAndFastSettle") {
      await queueCollateralSetup({
        publicClient,
        walletClient,
        accountAddress: account.address,
        arctAddress,
        oracleAddress,
        getNonce,
        items,
      });
    }

    if (action === "settleFixture" || action === "settleReady") {
      await queueTimerSync({
        walletClient,
        getNonce,
        items,
      });
    }

    for (const deployment of deployments) {
      const result = resultsByFixtureId[deployment.fixtureId];
      const marketAddress = deployment.marketAddress as Address;
      const context = await getOracleRequestContext(publicClient, marketAddress);

      const baseItem = {
        fixtureId: deployment.fixtureId,
        outcomeType: deployment.outcomeType,
        question: deployment.question,
      };

      try {
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
          await publicClient.readContract({
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
        );

        if (action === "resolveFixture") {
          const price = outcomePrice(deployment.outcomeType, result?.result);

          if (price === null) {
            skipped += 1;
            items.push({
              ...baseItem,
              action: "skipped",
              reason: "Missing final result or unsupported outcome type.",
              state,
            });
            continue;
          }

          if (state !== 0 && state !== 1) {
            skipped += 1;
            items.push({
              ...baseItem,
              proposedSide: outcomeLabel(price),
              action: "skipped",
              reason:
                state === 2
                  ? "Already proposed. Wait for liveness, then settle."
                  : settleReadyState(state)
                    ? "Already ready to settle. Use Settle Fixture."
                    : `Oracle state ${state} cannot be proposed now.`,
              state,
            });
            continue;
          }

          const hash = await walletClient.writeContract({
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
          });

          proposed += 1;
          items.push({
            ...baseItem,
            proposedSide: outcomeLabel(price),
            action: "proposed",
            reason: `Queued ${outcomeLabel(price)} proposal.`,
            state,
            txHash: hash as Hex,
          });
          continue;
        }

        if (action === "resolveAndFastSettle") {
          const price = outcomePrice(deployment.outcomeType, result?.result);

          if (price === null) {
            skipped += 1;
            items.push({
              ...baseItem,
              action: "skipped",
              reason: "Missing final result or unsupported outcome type.",
              state,
            });
            continue;
          }

          let currentState = state;

          if (currentState === 0 || currentState === 1) {
            const proposalHash = await walletClient.writeContract({
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
            });
            const proposalReceipt = await publicClient.waitForTransactionReceipt({
              hash: proposalHash,
            });

            if (proposalReceipt.status !== "success") {
              throw new Error("Proposal transaction reverted.");
            }

            proposed += 1;
            items.push({
              ...baseItem,
              proposedSide: outcomeLabel(price),
              action: "proposed",
              reason: `Confirmed ${outcomeLabel(price)} proposal.`,
              state,
              txHash: proposalHash as Hex,
            });
            currentState = 2;
          }

          if (proposalActiveState(currentState)) {
            const requestData = await publicClient.readContract({
              address: oracleAddress,
              abi: OO_V2_ABI,
              functionName: "getRequest",
              args: [
                marketAddress,
                context.priceIdentifier,
                context.requestTimestamp,
                context.ancillaryData,
              ],
            });
            const expirationTime = getExpirationTime(requestData);
            const proposedPrice = getProposedPrice(requestData);

            if (expirationTime === 0n) {
              throw new Error("Proposal expiration time was not readable.");
            }

            if (proposedPrice === null || proposedPrice !== price) {
              throw new Error(
                `Existing proposal does not match the required ${outcomeLabel(price)} result.`,
              );
            }

            const timerHash = await queueTimerSync({
              walletClient,
              getNonce,
              items,
              targetTime: expirationTime + 1n,
              marketItem: baseItem,
              recordItem: false,
            });

            if (!timerHash) {
              throw new Error("NEXT_PUBLIC_TIMER_ADDRESS is required for fast settlement.");
            }

            const timerReceipt = await publicClient.waitForTransactionReceipt({ hash: timerHash });
            if (timerReceipt.status !== "success") {
              throw new Error("UMA Timer transaction reverted.");
            }

            timerAdvanced += 1;
            items.push({
              ...baseItem,
              proposedSide: outcomeLabel(price),
              action: "timerAdvanced",
              reason: `Confirmed UMA Timer advance past expiration ${expirationTime.toString()}.`,
              state: currentState,
              txHash: timerHash,
            });
            currentState = Number(
              await publicClient.readContract({
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
            );
          }

          if (!isSettleableState(currentState)) {
            skipped += 1;
            items.push({
              ...baseItem,
              proposedSide: outcomeLabel(price),
              action: "skipped",
              reason:
                currentState === 6
                  ? "Oracle request already settled."
                  : `Oracle state ${currentState} is not ready to settle after Timer advance.`,
              state: currentState,
            });
            continue;
          }

          const settleHash = await walletClient.writeContract({
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
          });
          const settleReceipt = await publicClient.waitForTransactionReceipt({ hash: settleHash });

          if (settleReceipt.status !== "success") {
            throw new Error("Settlement transaction reverted.");
          }

          settled += 1;
          items.push({
            ...baseItem,
            proposedSide: outcomeLabel(price),
            action: "settled",
            reason: "Confirmed settlement after UMA Timer fast-forward.",
            state: currentState,
            txHash: settleHash as Hex,
          });
          continue;
        }

        if (proposalActiveState(state)) {
          const requestData = await publicClient.readContract({
            address: oracleAddress,
            abi: OO_V2_ABI,
            functionName: "getRequest",
            args: [
              marketAddress,
              context.priceIdentifier,
              context.requestTimestamp,
              context.ancillaryData,
            ],
          });

          const expirationTime = getExpirationTime(requestData);
          const now = BigInt(Math.floor(Date.now() / 1000));

          if (expirationTime === 0n || expirationTime > now) {
            skipped += 1;
            items.push({
              ...baseItem,
              action: "skipped",
              reason:
                expirationTime === 0n
                  ? "Proposal is active, but expiration time was not readable yet. Refresh status and wait."
                  : `Wait until ${new Date(Number(expirationTime) * 1000).toLocaleString()} before settling.`,
              state,
            });
            continue;
          }
        } else if (!isSettleableState(state)) {
          skipped += 1;
          items.push({
            ...baseItem,
            action: "skipped",
            reason:
              state === 6
                ? "Oracle request already settled."
                : `Oracle state ${state} is not ready to settle.`,
            state,
          });
          continue;
        }

        const hash = await walletClient.writeContract({
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
        });

        settled += 1;
        items.push({
          ...baseItem,
          action: "settled",
          reason: "Queued settle transaction.",
          state,
          txHash: hash as Hex,
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

    return NextResponse.json({
      success: true,
      action,
      fixtureId,
      scanned,
      proposed,
      timerAdvanced,
      settled,
      skipped,
      failed,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: errorMessage(error),
        action,
        fixtureId,
        scanned,
        proposed,
        timerAdvanced,
        settled,
        skipped,
        failed,
        items,
      },
      { status: 500 },
    );
  }
}
