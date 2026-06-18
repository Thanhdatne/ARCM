import {
  formatUnits,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
} from "viem";
import {
  ARCT_ADDRESS,
  ARC_CCTP_DOMAIN,
  ARC_EURC_ADDRESS,
  ARC_GATEWAY_WALLET_ADDRESS,
  ARC_USDC_ADDRESS,
} from "@/lib/contracts/addresses";

export type CollateralSymbol = "ARCT" | "USDC" | "EURC";

export interface CollateralConfig {
  symbol: CollateralSymbol;
  name: string;
  address: Address | null;
  decimals: number;
  enabled: boolean;
  isTestCollateral: boolean;
  isNativeGasToken: boolean;
}

export interface CircleRailsConfig {
  cctp: {
    requested: boolean;
    enabled: boolean;
    domain: number | undefined;
    usdcAddress: Address | null;
  };
  gateway: {
    requested: boolean;
    enabled: boolean;
    walletAddress: Address | null;
    usdcAddress: Address | null;
  };
}

function configuredAddress(address: Address): Address | null {
  return isAddress(address) && address.toLowerCase() !== zeroAddress
    ? address
    : null;
}

function publicFlagEnabled(value: string | undefined): boolean {
  return value === "true";
}

const arctAddress = configuredAddress(ARCT_ADDRESS);
const usdcAddress = configuredAddress(ARC_USDC_ADDRESS);
const eurcAddress = configuredAddress(ARC_EURC_ADDRESS);
const gatewayWalletAddress = configuredAddress(ARC_GATEWAY_WALLET_ADDRESS);

const usdcCollateralRequested = publicFlagEnabled(
  process.env.NEXT_PUBLIC_ENABLE_USDC_COLLATERAL,
);
const eurcCollateralRequested = publicFlagEnabled(
  process.env.NEXT_PUBLIC_ENABLE_EURC_COLLATERAL,
);

const COLLATERALS: readonly CollateralConfig[] = [
  {
    symbol: "ARCT",
    name: "Arc Test Collateral",
    address: arctAddress,
    decimals: 18,
    enabled: true,
    isTestCollateral: true,
    isNativeGasToken: false,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: usdcAddress,
    decimals: 6,
    enabled: usdcCollateralRequested && usdcAddress !== null,
    isTestCollateral: false,
    // Arc gas is USDC-denominated; this does not enable ERC20 collateral use.
    isNativeGasToken: true,
  },
  {
    symbol: "EURC",
    name: "EURC",
    address: eurcAddress,
    decimals: 6,
    enabled: eurcCollateralRequested && eurcAddress !== null,
    isTestCollateral: false,
    isNativeGasToken: false,
  },
];

export function getCollateralBySymbol(
  symbol: CollateralSymbol,
): CollateralConfig | undefined {
  return COLLATERALS.find((collateral) => collateral.symbol === symbol);
}

export function getEnabledCollaterals(): CollateralConfig[] {
  return COLLATERALS.filter((collateral) => collateral.enabled);
}

export function getDefaultCollateral(): CollateralConfig {
  return COLLATERALS[0];
}

export function formatTokenAmount(raw: bigint, decimals: number): string {
  assertDecimals(decimals);
  return formatUnits(raw, decimals);
}

export function parseTokenAmount(input: string, decimals: number): bigint {
  assertDecimals(decimals);
  const normalized = input.trim();

  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) {
    throw new Error("Token amount must be a non-negative decimal value.");
  }

  const fractionalDigits = normalized.split(".")[1]?.length ?? 0;
  if (fractionalDigits > decimals) {
    throw new Error(`Token amount supports at most ${decimals} decimal places.`);
  }

  return parseUnits(normalized, decimals);
}

export function getCircleRailsConfig(): CircleRailsConfig {
  const cctpRequested = publicFlagEnabled(
    process.env.NEXT_PUBLIC_ENABLE_CCTP_DEPOSIT,
  );
  const gatewayRequested = publicFlagEnabled(
    process.env.NEXT_PUBLIC_ENABLE_GATEWAY_DEPOSIT,
  );

  return {
    cctp: {
      requested: cctpRequested,
      enabled:
        cctpRequested &&
        usdcAddress !== null &&
        ARC_CCTP_DOMAIN !== undefined,
      domain: ARC_CCTP_DOMAIN,
      usdcAddress,
    },
    gateway: {
      requested: gatewayRequested,
      enabled:
        gatewayRequested &&
        usdcAddress !== null &&
        gatewayWalletAddress !== null,
      walletAddress: gatewayWalletAddress,
      usdcAddress,
    },
  };
}

export function isCircleRailsEnabled(): boolean {
  const config = getCircleRailsConfig();
  return config.cctp.enabled || config.gateway.enabled;
}

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error("Token decimals must be an integer between 0 and 255.");
  }
}
