/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

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
  stringToHex,
} from "viem";
import { privateKeyToAccount, nonceManager } from "viem/accounts";
import { arcTestnet } from "@/lib/chain";
import { getAdminRequestError } from "@/lib/adminGuard";

export const runtime = "nodejs";
export const maxDuration = 600;

// --- Config -----------------------------------------------------------

const PROPOSER_REWARD = parseEther("10"); // 10 ARCT
const MARKET_LIVENESS = 60n; // 1 minute (testnet)
const PROPOSER_BOND = parseEther("100"); // 100 ARCT
const AMM_FEE_BPS = 200n; // 2%
const SEED_LIQUIDITY = parseEther("100"); // 100 ARCT - safer for bulk testnet deployment

// --- Load artifacts ---------------------------------------------------

function loadArtifact(contractPath: string) {
  const fullPath = path.resolve(process.cwd(), "artifacts", "contracts", contractPath);
  const artifact = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  return { abi: artifact.abi, bytecode: artifact.bytecode as Hex };
}

// --- Minimal ABIs for interactions -----------------------------------

const ERC20_ABI = [
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
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
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

const MARKET_INIT_ABI = [
  {
    inputs: [],
    name: "initializeMarket",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const MARKET_READ_ABI = [
  {
    inputs: [],
    name: "priceRequested",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const AMM_INIT_ABI = [
  {
    inputs: [{ name: "_initialLiquidity", type: "uint256" }],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ----- Markets JSON file ----------------------------------------------

interface StoredMarket {
  id: string;
  address: string;
  ammAddress: string;
  title: string;
  category: string;
  createdAt: string;
}

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

function getMarketsFilePath() {
  return path.resolve(process.cwd(), "data", "markets.json");
}

function getWorldCupDeploymentsFilePath() {
  return path.resolve(process.cwd(), "data", "world-cup-deployments.json");
}

function ensureDataDirectory() {
  fs.mkdirSync(path.resolve(process.cwd(), "data"), { recursive: true });
}

function readMarkets(): StoredMarket[] {
  try {
    const data = fs.readFileSync(getMarketsFilePath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeMarkets(markets: StoredMarket[]) {
  ensureDataDirectory();
  fs.writeFileSync(getMarketsFilePath(), JSON.stringify(markets, null, 2) + "\n");
}

function readWorldCupDeployments(): WorldCupDeployment[] {
  try {
    const data = fs.readFileSync(getWorldCupDeploymentsFilePath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeWorldCupDeployments(deployments: WorldCupDeployment[]) {
  ensureDataDirectory();
  fs.writeFileSync(getWorldCupDeploymentsFilePath(), JSON.stringify(deployments, null, 2) + "\n");
}

function upsertWorldCupDeployment(deployment: WorldCupDeployment) {
  const deployments = readWorldCupDeployments();
  const nextDeployments = [
    deployment,
    ...deployments.filter((item) => item.worldCupMarketId !== deployment.worldCupMarketId),
  ];
  writeWorldCupDeployments(nextDeployments);
}

/** Waits for a tx receipt and throws if the tx was mined as reverted. */
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPriceRequested(
  publicClient: ReturnType<typeof createPublicClient>,
  marketAddress: Address,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const priceRequested = await withRpcRetry("Read priceRequested", () =>
      publicClient.readContract({
        address: marketAddress,
        abi: MARKET_READ_ABI,
        functionName: "priceRequested",
      }),
    );

    if (priceRequested) {
      return true;
    }

    await sleep(2_000);
  }

  return false;
}

function getErrorChain(error: unknown) {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; current && depth < 10 && !seen.has(current); depth += 1) {
    chain.push(current);
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
  }

  return chain;
}

function getHeaders(error: unknown): Headers | undefined {
  for (const item of getErrorChain(error)) {
    const directHeaders = (item as { headers?: Headers }).headers;
    if (directHeaders?.get) return directHeaders;

    const responseHeaders = (item as { response?: { headers?: Headers } }).response?.headers;
    if (responseHeaders?.get) return responseHeaders;
  }

  return undefined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function isRateLimited(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("ratelimit") ||
    message.includes("too many requests")
  ) {
    return true;
  }

  return getErrorChain(error).some((item) => {
    const status = (item as { status?: number; response?: { status?: number } }).status
      ?? (item as { status?: number; response?: { status?: number } }).response?.status;

    return status === 429;
  });
}

function isTransientRpcError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    isRateLimited(error) ||
    message.includes("http request failed") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("temporarily unavailable")
  );
}

function getRetryDelayMs(error: unknown, attempt: number) {
  const headers = getHeaders(error);
  const resetHeader = headers?.get("x-ratelimit-reset");
  const resetSeconds = resetHeader ? Number.parseInt(resetHeader, 10) : Number.NaN;

  if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
    return Math.min((resetSeconds + 5) * 1_000, 90_000);
  }

  if (isRateLimited(error)) {
    return 45_000;
  }

  return Math.min(8_000 * attempt, 25_000);
}

async function withRpcRetry<T>(
  label: string,
  operation: () => Promise<T>,
  maxAttempts = 4,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientRpcError(error) || attempt === maxAttempts) {
        break;
      }

      const delayMs = getRetryDelayMs(error, attempt);
      console.warn(
        `[create-market] ${label} hit transient RPC issue. Retry ${attempt}/${maxAttempts - 1} in ${Math.round(delayMs / 1000)}s.`,
        getErrorMessage(error),
      );
      await sleep(delayMs);
    }
  }

  throw new Error(`${label} failed: ${getErrorMessage(lastError)}`);
}


function makeStableHash(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

function makePairName(title: string, worldCupMarketId: string | null) {
  const source = worldCupMarketId ?? title;
  const cleanedPrefix = (worldCupMarketId ? "WC" : title)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  const prefix = (worldCupMarketId ? "WC" : cleanedPrefix.slice(0, 2) || "MK").slice(0, 2);
  const suffix = makeStableHash(source).replace(/[^A-Z0-9]/g, "").slice(0, 8);

  return `${prefix}${suffix}`.slice(0, 10);
}

// --- POST handler ------------------------------------------------------

export async function POST(request: Request) {
  const adminError = getAdminRequestError(
    request,
    "Public market creation is disabled during testnet preview.",
  );
  if (adminError) return adminError;

  try {
    const body = await request.json();
    const { title, category, fixtureId, group, outcomeType, worldCupMarketId } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const trimmedTitle = title.trim();
    const trimmedCategory =
      typeof category === "string" && category.trim().length > 0
        ? category.trim().slice(0, 40)
        : "Crypto";
    const trimmedWorldCupMarketId =
      typeof worldCupMarketId === "string" && worldCupMarketId.trim().length > 0
        ? worldCupMarketId.trim().slice(0, 80)
        : null;
    const trimmedFixtureId =
      typeof fixtureId === "string" && fixtureId.trim().length > 0
        ? fixtureId.trim().slice(0, 100)
        : "";
    const trimmedGroup =
      typeof group === "string" && group.trim().length > 0
        ? group.trim().slice(0, 40)
        : "";
    const trimmedOutcomeType =
      typeof outcomeType === "string" && outcomeType.trim().length > 0
        ? outcomeType.trim().slice(0, 40)
        : "";

    if (trimmedWorldCupMarketId) {
      const existingDeployment = readWorldCupDeployments().find(
        (deployment) =>
          deployment.worldCupMarketId === trimmedWorldCupMarketId &&
          deployment.marketAddress &&
          deployment.ammAddress,
      );

      if (existingDeployment) {
        return NextResponse.json({
          success: true,
          skipped: true,
          deployment: existingDeployment,
          market: {
            id: `world-cup-${existingDeployment.worldCupMarketId}`,
            address: existingDeployment.marketAddress,
            ammAddress: existingDeployment.ammAddress,
            title: existingDeployment.question,
            category: "World Cup",
            createdAt: existingDeployment.createdAt,
          },
        });
      }
    }

    // Validate env vars
    const privateKey = process.env.PRIVATE_KEY?.trim();
    if (!privateKey) {
      return NextResponse.json({ error: "Server deployer is not configured." }, { status: 500 });
    }

    const arctAddress = process.env.NEXT_PUBLIC_ARCT_ADDRESS as Address;
    const finderAddress = process.env.NEXT_PUBLIC_FINDER_ADDRESS as Address;
    const timerAddress = process.env.NEXT_PUBLIC_TIMER_ADDRESS as Address;

    if (!arctAddress || !finderAddress || !timerAddress) {
      return NextResponse.json(
        { error: "Server contract configuration is incomplete." },
        { status: 500 }
      );
    }

    // Generate a short UMA identifier.
    //
    // The old implementation used the first 10 chars of the title, which causes
    // collisions for repeated team prefixes:
    // - "Will Australia beat Turkey?"      -> WILLAUSTRA
    // - "Will Australia beat Paraguay?"   -> WILLAUSTRA
    //
    // UMA's IdentifierWhitelist should receive a unique identifier per market.
    // Use worldCupMarketId when available so World Cup markets are stable and
    // unique even when titles start with the same words.
    const pairName = makePairName(trimmedTitle, trimmedWorldCupMarketId);

    // Set up viem clients
    // Use the direct Arc RPC for server-side transactions. Alchemy's mempool tracker
    // for Arc testnet is unreliable — it reports stale pending nonces, causing viem's
    // nonceManager to assign wrong nonces and transactions to hang indefinitely.
    const formattedKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as Hex;
    const account = privateKeyToAccount(formattedKey, { nonceManager });
    const rpcUrl = "https://rpc.testnet.arc.network";

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(rpcUrl),
    });

    // Avoid repeated eth_getTransactionCount calls for every tx. Arc public RPC
    // rate-limits pending nonce reads aggressively, so we read once and then
    // increment locally for this sequential server request.
    let nextNonce = await withRpcRetry(
      "Read deployer pending nonce",
      () => publicClient.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      }),
      6,
    );

    const sendWithManagedNonce = async (
      label: string,
      operation: (nonce: number) => Promise<Hex>,
    ) => {
      const nonce = nextNonce;
      const hash = await withRpcRetry(label, () => operation(nonce), 6);
      nextNonce = nonce + 1;
      return hash;
    };

    // Load artifacts
    const marketArtifact = loadArtifact(
      "EventBasedPredictionMarket.sol/EventBasedPredictionMarket.json"
    );
    const ammArtifact = loadArtifact(
      "PredictionMarketAMM.sol/PredictionMarketAMM.json"
    );

    // Check deployer's ARCT balance and mint more if needed
    const totalNeeded = PROPOSER_REWARD + SEED_LIQUIDITY + parseEther("25"); // proposer reward + AMM seed + buffer
    const balance = await withRpcRetry("Read ARCT balance", () =>
      publicClient.readContract({
        address: arctAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      }),
    );

    if (balance < totalNeeded) {
      const mintAmount = totalNeeded - balance + parseEther("100"); // mint extra buffer
      const mintHash = await sendWithManagedNonce("Mint ARCT collateral", (nonce) =>
        walletClient.writeContract({
          address: arctAddress,
          abi: ERC20_ABI,
          functionName: "allocateTo",
          args: [account.address, mintAmount],
          nonce,
        }),
      );
      await waitForTx(publicClient, mintHash);
    }

    // Encode the question as bytes
    const customAncillaryData = stringToHex(trimmedTitle);

    // --- Deploy EventBasedPredictionMarket -----------------------------------

    const marketHash = await sendWithManagedNonce("Deploy prediction market", (nonce) =>
      walletClient.deployContract({
        abi: marketArtifact.abi,
        bytecode: marketArtifact.bytecode,
        args: [
          pairName,
          arctAddress,
          customAncillaryData,
          finderAddress,
          timerAddress,
          PROPOSER_REWARD,
          MARKET_LIVENESS,
          PROPOSER_BOND,
        ],
        nonce,
      }),
    );

    const marketReceipt = await waitForTx(publicClient, marketHash);
    const marketAddress = marketReceipt.contractAddress;

    if (!marketAddress) {
      return NextResponse.json({ error: "Market deployment failed" }, { status: 500 });
    }

    // --- Initialize market --------------------------------------------

    // Approve proposer reward to market
    const approveMarketHash = await sendWithManagedNonce("Approve proposer reward", (nonce) =>
      walletClient.writeContract({
        address: arctAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [marketAddress, PROPOSER_REWARD],
        nonce,
      }),
    );
    await waitForTx(publicClient, approveMarketHash);

    // Initialize market (requests price from OO)
    const initMarketHash = await sendWithManagedNonce("Initialize prediction market", (nonce) =>
      walletClient.writeContract({
        address: marketAddress,
        abi: MARKET_INIT_ABI,
        functionName: "initializeMarket",
        nonce,
      }),
    );
    await waitForTx(publicClient, initMarketHash);

    const priceRequested = await waitForPriceRequested(publicClient, marketAddress);

    if (!priceRequested) {
      throw new Error(
        "Market initialized tx was mined, but priceRequested is still false. Retry this card after a few seconds.",
      );
    }

    // --- Deploy PredictionMarketAMM ------------------------------------------

    const ammHash = await sendWithManagedNonce("Deploy AMM", (nonce) =>
      walletClient.deployContract({
        abi: ammArtifact.abi,
        bytecode: ammArtifact.bytecode,
        args: [marketAddress, AMM_FEE_BPS],
        nonce,
      }),
    );

    const ammReceipt = await waitForTx(publicClient, ammHash);
    const ammAddress = ammReceipt.contractAddress;

    if (!ammAddress) {
      return NextResponse.json({ error: "AMM deployment failed" }, { status: 500 });
    }

    // --- Seed AMM with liquidity ---------------------------------------------

    // A previous request or partially completed deployment may have consumed ARCT
    // after the initial balance check. Top up again immediately before seeding
    // the AMM so initialize() does not revert with "transfer amount exceeds balance".
    const balanceBeforeAmmSeed = await withRpcRetry("Read ARCT balance before AMM seed", () =>
      publicClient.readContract({
        address: arctAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      }),
    );

    if (balanceBeforeAmmSeed < SEED_LIQUIDITY) {
      const topUpAmount = SEED_LIQUIDITY - balanceBeforeAmmSeed + parseEther("25");
      const topUpHash = await sendWithManagedNonce("Top up ARCT before AMM seed", (nonce) =>
        walletClient.writeContract({
          address: arctAddress,
          abi: ERC20_ABI,
          functionName: "allocateTo",
          args: [account.address, topUpAmount],
          nonce,
        }),
      );
      await waitForTx(publicClient, topUpHash);
    }

    // Approve ARCT to AMM
    const approveAmmHash = await sendWithManagedNonce("Approve AMM liquidity", (nonce) =>
      walletClient.writeContract({
        address: arctAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ammAddress, SEED_LIQUIDITY],
        nonce,
      }),
    );
    await waitForTx(publicClient, approveAmmHash);

    // Initialize AMM
    const initAmmHash = await sendWithManagedNonce("Initialize AMM liquidity", (nonce) =>
      walletClient.writeContract({
        address: ammAddress,
        abi: AMM_INIT_ABI,
        functionName: "initialize",
        args: [SEED_LIQUIDITY],
        nonce,
      }),
    );
    await waitForTx(publicClient, initAmmHash);

    // --- Save to markets.json ------------------------------------------------

    const markets = readMarkets();
    const newMarket: StoredMarket = {
      id: `user-${Date.now()}`,
      address: marketAddress,
      ammAddress: ammAddress,
      title: trimmedTitle,
      category: trimmedCategory,
      createdAt: new Date().toISOString(),
    };
    markets.unshift(newMarket);
    writeMarkets(markets);

    if (trimmedWorldCupMarketId) {
      upsertWorldCupDeployment({
        worldCupMarketId: trimmedWorldCupMarketId,
        fixtureId: trimmedFixtureId,
        group: trimmedGroup,
        question: trimmedTitle,
        outcomeType: trimmedOutcomeType,
        marketAddress,
        ammAddress,
        createdAt: newMarket.createdAt,
        txHash: marketHash,
        transactionHash: marketHash,
      });
    }

    return NextResponse.json({
      success: true,
      market: newMarket,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Market creation failed. Check server configuration and try again.";

    console.error("Market creation failed:", error);

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
