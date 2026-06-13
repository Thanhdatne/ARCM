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

// --- Config -----------------------------------------------------------

const PROPOSER_REWARD = parseEther("10"); // 10 ARCT
const MARKET_LIVENESS = 60n; // 1 minute (testnet)
const PROPOSER_BOND = parseEther("100"); // 100 ARCT
const AMM_FEE_BPS = 200n; // 2%
const SEED_LIQUIDITY = parseEther("1000"); // 1000 ARCT

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

/** Waits for a tx receipt with a reasonable timeout and polling interval. */
async function waitForTx(
  publicClient: ReturnType<typeof createPublicClient>,
  hash: Hex,
) {
  return publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: 2_000,
    timeout: 120_000,
  });
}

// --- POST handler ------------------------------------------------------

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE !== "true") {
    return NextResponse.json({ error: "Public market creation is disabled during testnet preview." }, { status: 403 });
  }

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

    // Generate pair name from title (first 10 chars, uppercase, no spaces)
    const pairName = trimmedTitle
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 10)
      .toUpperCase();

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

    // Load artifacts
    const marketArtifact = loadArtifact(
      "EventBasedPredictionMarket.sol/EventBasedPredictionMarket.json"
    );
    const ammArtifact = loadArtifact(
      "PredictionMarketAMM.sol/PredictionMarketAMM.json"
    );

    // Check deployer's ARCT balance and mint more if needed
    const totalNeeded = PROPOSER_REWARD + SEED_LIQUIDITY; // 1010 ARCT
    const balance = await publicClient.readContract({
      address: arctAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });

    if (balance < totalNeeded) {
      const mintAmount = totalNeeded - balance + parseEther("100"); // mint extra buffer
      const mintHash = await walletClient.writeContract({
        address: arctAddress,
        abi: ERC20_ABI,
        functionName: "allocateTo",
        args: [account.address, mintAmount],
      });
      await waitForTx(publicClient, mintHash);
    }

    // Encode the question as bytes
    const customAncillaryData = stringToHex(trimmedTitle);

    // --- Deploy EventBasedPredictionMarket -----------------------------------

    const marketHash = await walletClient.deployContract({
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
    });

    const marketReceipt = await waitForTx(publicClient, marketHash);
    const marketAddress = marketReceipt.contractAddress;

    if (!marketAddress) {
      return NextResponse.json({ error: "Market deployment failed" }, { status: 500 });
    }

    // --- Initialize market --------------------------------------------

    // Approve proposer reward to market
    const approveMarketHash = await walletClient.writeContract({
      address: arctAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [marketAddress, PROPOSER_REWARD],
    });
    await waitForTx(publicClient, approveMarketHash);

    // Initialize market (requests price from OO)
    const initMarketHash = await walletClient.writeContract({
      address: marketAddress,
      abi: MARKET_INIT_ABI,
      functionName: "initializeMarket",
    });
    await waitForTx(publicClient, initMarketHash);

    // --- Deploy PredictionMarketAMM ------------------------------------------

    const ammHash = await walletClient.deployContract({
      abi: ammArtifact.abi,
      bytecode: ammArtifact.bytecode,
      args: [marketAddress, AMM_FEE_BPS],
    });

    const ammReceipt = await waitForTx(publicClient, ammHash);
    const ammAddress = ammReceipt.contractAddress;

    if (!ammAddress) {
      return NextResponse.json({ error: "AMM deployment failed" }, { status: 500 });
    }

    // --- Seed AMM with liquidity ---------------------------------------------

    // Approve ARCT to AMM
    const approveAmmHash = await walletClient.writeContract({
      address: arctAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ammAddress, SEED_LIQUIDITY],
    });
    await waitForTx(publicClient, approveAmmHash);

    // Initialize AMM
    const initAmmHash = await walletClient.writeContract({
      address: ammAddress,
      abi: AMM_INIT_ABI,
      functionName: "initialize",
      args: [SEED_LIQUIDITY],
    });
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
  } catch {
    console.error("Market creation failed.");
    return NextResponse.json({ error: "Market creation failed. Check server configuration and try again." }, { status: 500 });
  }
}
