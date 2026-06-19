import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { nonceManager, privateKeyToAccount } from "viem/accounts";
import { getAdminRequestError } from "@/lib/adminGuard";
import { arcTestnet } from "@/lib/chain";
import {
  ARC_USDC_ADDRESS,
  COLLATERAL_ALLOWLIST_ADDRESS,
  MARKET_V2_FACTORY_ADDRESS,
} from "@/lib/contracts/addresses";
import {
  COLLATERAL_ALLOWLIST_ABI,
  MARKET_V2_FACTORY_ABI,
} from "@/lib/contracts/abis";
import { getCollateralByAddress, normalizeAddress } from "@/lib/collateral";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

const ERC20_V2_CREATE_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
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
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
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
] as const;

interface StoredMarketV2 {
  id: string;
  address: string;
  marketAddress: string;
  ammAddress: string;
  title: string;
  category: string;
  createdAt: string;
  transactionHash: string;
  contractVersion: 2;
  collateralAddress: string;
  collateralSymbol: string;
  collateralDecimals: number;
  outcomeDecimals: number;
}

function validConfiguredAddress(value: string): value is Address {
  return isAddress(value) && value !== "0x0000000000000000000000000000000000000000";
}

function requiredText(value: unknown, name: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim().slice(0, maxLength);
}

function optionalText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function amountText(value: unknown, fallback: string, name: string) {
  const text = value === undefined ? fallback : String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) {
    throw new Error(`${name} must be a non-negative decimal amount.`);
  }
  return text;
}

function integerInRange(
  value: unknown,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function dataPath(fileName: string) {
  return path.resolve(process.cwd(), "data", fileName);
}

function readRecords<T>(fileName: string): T[] {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(dataPath(fileName), "utf-8").replace(/^\uFEFF/, ""),
    ) as T[] | Record<string, T>;
    return Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch {
    return [];
  }
}

function writeRecords<T>(fileName: string, records: T[]) {
  fs.mkdirSync(path.resolve(process.cwd(), "data"), { recursive: true });
  fs.writeFileSync(dataPath(fileName), `${JSON.stringify(records, null, 2)}\n`);
}

async function waitForSuccess(
  publicClient: ReturnType<typeof createPublicClient>,
  hash: Hex,
) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: 2_000,
    timeout: 180_000,
  });
  if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted.`);
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_MARKET_V2_CREATE !== "true") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const adminError = getAdminRequestError(
    request,
    "V2 market creation is restricted to configured administrators.",
  );
  if (adminError) return adminError;

  try {
    if (
      !validConfiguredAddress(COLLATERAL_ALLOWLIST_ADDRESS) ||
      !validConfiguredAddress(MARKET_V2_FACTORY_ADDRESS)
    ) {
      return NextResponse.json(
        { error: "V2 factory configuration is incomplete." },
        { status: 503 },
      );
    }

    const body = await request.json() as Record<string, unknown>;
    const title = requiredText(body.title, "Title", 280);
    const category = optionalText(body.category, "Markets", 40);
    const pairName = optionalText(body.pairName, `ARCM-${Date.now()}`, 64);
    const requestedCollateral = normalizeAddress(
      typeof body.collateralAddress === "string"
        ? body.collateralAddress
        : ARC_USDC_ADDRESS,
    );

    if (!requestedCollateral) throw new Error("A valid collateral address is required.");

    const collateralConfig = getCollateralByAddress(requestedCollateral);
    if (
      !collateralConfig ||
      collateralConfig.symbol === "ARCT" ||
      !collateralConfig.enabled
    ) {
      throw new Error("Collateral is not enabled in the verified V2 server configuration.");
    }

    const privateKey = process.env.PRIVATE_KEY?.trim();
    if (!privateKey || !/^(?:0x)?[a-fA-F0-9]{64}$/.test(privateKey)) {
      return NextResponse.json(
        { error: "Server deployer is not configured." },
        { status: 503 },
      );
    }

    const formattedKey = (privateKey.startsWith("0x")
      ? privateKey
      : `0x${privateKey}`) as Hex;
    const account = privateKeyToAccount(formattedKey, { nonceManager });
    const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL?.trim()
      || "https://rpc.testnet.arc.network";
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(rpcUrl),
    });

    const [factoryAllowlist, allowed, decimals, symbol] = await Promise.all([
      publicClient.readContract({
        address: MARKET_V2_FACTORY_ADDRESS,
        abi: MARKET_V2_FACTORY_ABI,
        functionName: "collateralAllowlist",
      }),
      publicClient.readContract({
        address: COLLATERAL_ALLOWLIST_ADDRESS,
        abi: COLLATERAL_ALLOWLIST_ABI,
        functionName: "isCollateralAllowed",
        args: [requestedCollateral],
      }),
      publicClient.readContract({
        address: requestedCollateral,
        abi: ERC20_V2_CREATE_ABI,
        functionName: "decimals",
      }),
      publicClient.readContract({
        address: requestedCollateral,
        abi: ERC20_V2_CREATE_ABI,
        functionName: "symbol",
      }),
    ]);

    if (getAddress(factoryAllowlist) !== getAddress(COLLATERAL_ALLOWLIST_ADDRESS)) {
      throw new Error("Factory allowlist does not match the configured V2 allowlist.");
    }
    if (!allowed) throw new Error("Collateral is not allowed by the V2 allowlist contract.");
    if (decimals !== collateralConfig.decimals) {
      throw new Error("Onchain collateral decimals do not match verified configuration.");
    }
    if (symbol.toUpperCase() !== collateralConfig.symbol) {
      throw new Error("Onchain collateral symbol does not match verified configuration.");
    }

    const proposerReward = parseUnits(
      amountText(body.proposerReward, "10", "Proposer reward"),
      decimals,
    );
    const proposerBond = parseUnits(
      amountText(body.proposerBond, "100", "Proposer bond"),
      decimals,
    );
    const initialLiquidity = parseUnits(
      amountText(body.initialLiquidity, "100", "Initial liquidity"),
      decimals,
    );
    if (initialLiquidity === 0n) throw new Error("Initial liquidity must be greater than zero.");

    const liveness = integerInRange(body.liveness, 7_200, "Liveness", 60, 2_592_000);
    const feeBps = integerInRange(body.feeBps, 200, "Fee BPS", 0, 9_999);
    const collateralRequired = proposerReward + initialLiquidity;
    const [balance, allowance] = await Promise.all([
      publicClient.readContract({
        address: requestedCollateral,
        abi: ERC20_V2_CREATE_ABI,
        functionName: "balanceOf",
        args: [account.address],
      }),
      publicClient.readContract({
        address: requestedCollateral,
        abi: ERC20_V2_CREATE_ABI,
        functionName: "allowance",
        args: [account.address, MARKET_V2_FACTORY_ADDRESS],
      }),
    ]);

    if (balance < collateralRequired) {
      throw new Error(`Server deployer has insufficient ${collateralConfig.symbol}.`);
    }

    if (allowance < collateralRequired) {
      if (allowance > 0n) {
        const resetHash = await walletClient.writeContract({
          address: requestedCollateral,
          abi: ERC20_V2_CREATE_ABI,
          functionName: "approve",
          args: [MARKET_V2_FACTORY_ADDRESS, 0n],
        });
        await waitForSuccess(publicClient, resetHash);
      }

      const approveHash = await walletClient.writeContract({
        address: requestedCollateral,
        abi: ERC20_V2_CREATE_ABI,
        functionName: "approve",
        args: [MARKET_V2_FACTORY_ADDRESS, collateralRequired],
      });
      await waitForSuccess(publicClient, approveHash);
    }

    const params = {
      pairName,
      collateralToken: requestedCollateral,
      customAncillaryData: stringToHex(title),
      proposerReward,
      optimisticOracleLivenessTime: BigInt(liveness),
      optimisticOracleProposerBond: proposerBond,
      initialLiquidity,
      feeBps: BigInt(feeBps),
    } as const;
    const simulation = await publicClient.simulateContract({
      account,
      address: MARKET_V2_FACTORY_ADDRESS,
      abi: MARKET_V2_FACTORY_ABI,
      functionName: "createMarket",
      args: [params],
    });
    const [marketAddress, ammAddress] = simulation.result;
    const transactionHash = await walletClient.writeContract(simulation.request);
    await waitForSuccess(publicClient, transactionHash);

    const createdAt = new Date().toISOString();
    const market: StoredMarketV2 = {
      id: optionalText(body.worldCupMarketId, `v2-${Date.now()}`, 100),
      address: marketAddress,
      marketAddress,
      ammAddress,
      title,
      category,
      createdAt,
      transactionHash,
      contractVersion: 2,
      collateralAddress: requestedCollateral,
      collateralSymbol: collateralConfig.symbol,
      collateralDecimals: decimals,
      outcomeDecimals: decimals,
    };

    const markets = readRecords<StoredMarketV2>("markets.json");
    writeRecords("markets.json", [market, ...markets]);

    const worldCupMarketId = typeof body.worldCupMarketId === "string"
      ? body.worldCupMarketId.trim().slice(0, 100)
      : "";
    if (worldCupMarketId) {
      const deployment = {
        worldCupMarketId,
        fixtureId: optionalText(body.fixtureId, "", 100),
        group: optionalText(body.group, "", 40),
        question: title,
        outcomeType: optionalText(body.outcomeType, "", 40),
        marketAddress,
        ammAddress,
        createdAt,
        txHash: transactionHash,
        transactionHash,
        contractVersion: 2,
        collateralAddress: requestedCollateral,
        collateralSymbol: collateralConfig.symbol,
        collateralDecimals: decimals,
        outcomeDecimals: decimals,
      };
      const deployments = readRecords<typeof deployment>("world-cup-deployments.json");
      writeRecords("world-cup-deployments.json", [
        deployment,
        ...deployments.filter((item) => item.worldCupMarketId !== worldCupMarketId),
      ]);

      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase.from("world_cup_deployments").upsert({
          world_cup_market_id: worldCupMarketId,
          fixture_id: deployment.fixtureId,
          group: deployment.group,
          question: title,
          outcome_type: deployment.outcomeType,
          market_address: marketAddress.toLowerCase(),
          amm_address: ammAddress.toLowerCase(),
          tx_hash: transactionHash,
          transaction_hash: transactionHash,
          contract_version: 2,
          collateral_address: requestedCollateral.toLowerCase(),
          collateral_symbol: collateralConfig.symbol,
          collateral_decimals: decimals,
          outcome_decimals: decimals,
          created_at: createdAt,
        }, { onConflict: "world_cup_market_id" });
        if (error) console.error("[create-market-v2] Supabase metadata write failed", error.message);
      }
    }

    return NextResponse.json({ success: true, market }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "V2 market creation failed.";
    console.error("[create-market-v2] failed", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
