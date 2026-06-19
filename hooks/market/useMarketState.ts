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

"use client";

import { useReadContracts } from "wagmi";
import { hexToString } from "viem";
import { type Address } from "viem";
import { MARKET_V2_ABI } from "@/lib/contracts";
import { ERC20_ABI } from "@/lib/contracts/abis/erc20";
import { useMarketAddress } from "@/contexts/MarketAddressContext";
import { LIVE_STATE_REFETCH_INTERVAL } from "@/lib/wagmi";
import { getCollateralMetadataByAddress } from "@/lib/collateral";

export function useMarketState() {
  const { marketAddress } = useMarketAddress();

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "pairName" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "customAncillaryData" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "priceRequested" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "receivedSettlementPrice" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "settlementPrice" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "longToken" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "shortToken" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "requestTimestamp" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "priceIdentifier" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "proposerReward" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "optimisticOracleProposerBond" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "optimisticOracleLivenessTime" },
      { address: marketAddress, abi: MARKET_V2_ABI, functionName: "collateralToken" },
    ],
    query: {
      enabled: marketAddress !== "0x0000000000000000000000000000000000000000",
      refetchInterval: LIVE_STATE_REFETCH_INTERVAL,
      refetchIntervalInBackground: false,
    },
  });

  const pairName = data?.[0]?.result as string | undefined;
  const ancillaryDataHex = data?.[1]?.result as `0x${string}` | undefined;
  const priceRequested = data?.[2]?.result as boolean | undefined;
  const receivedSettlementPrice = data?.[3]?.result as boolean | undefined;
  const settlementPrice = data?.[4]?.result as bigint | undefined;
  const longTokenAddress = data?.[5]?.result as Address | undefined;
  const shortTokenAddress = data?.[6]?.result as Address | undefined;
  const requestTimestamp = data?.[7]?.result as bigint | undefined;
  const priceIdentifier = data?.[8]?.result as `0x${string}` | undefined;
  const proposerReward = data?.[9]?.result as bigint | undefined;
  const proposerBond = data?.[10]?.result as bigint | undefined;
  const livenessTime = data?.[11]?.result as bigint | undefined;
  const collateralAddress = data?.[12]?.result as Address | undefined;
  const configuredCollateral = getCollateralMetadataByAddress(collateralAddress);

  const { data: collateralData, isLoading: isCollateralLoading } = useReadContracts({
    contracts: [
      { address: collateralAddress ?? marketAddress, abi: ERC20_ABI, functionName: "symbol" },
      { address: collateralAddress ?? marketAddress, abi: ERC20_ABI, functionName: "name" },
      { address: collateralAddress ?? marketAddress, abi: ERC20_ABI, functionName: "decimals" },
      { address: longTokenAddress ?? marketAddress, abi: ERC20_ABI, functionName: "decimals" },
      { address: shortTokenAddress ?? marketAddress, abi: ERC20_ABI, functionName: "decimals" },
    ],
    query: {
      enabled: collateralAddress !== undefined && longTokenAddress !== undefined && shortTokenAddress !== undefined,
      staleTime: 5 * 60_000,
    },
  });

  const symbolResult = collateralData?.[0]?.result;
  const nameResult = collateralData?.[1]?.result;
  const decimalsResult = collateralData?.[2]?.result;
  const longDecimalsResult = collateralData?.[3]?.result;
  const shortDecimalsResult = collateralData?.[4]?.result;
  const collateralSymbol =
    typeof symbolResult === "string" && symbolResult.trim()
      ? symbolResult.trim()
      : configuredCollateral.warning
        ? "ARCT"
        : configuredCollateral.symbol;
  const collateralName =
    typeof nameResult === "string" && nameResult.trim()
      ? nameResult.trim()
      : configuredCollateral.warning
        ? "Arc Test Collateral"
        : configuredCollateral.name;
  const collateralDecimals =
    typeof decimalsResult === "number" && Number.isSafeInteger(decimalsResult)
      ? decimalsResult
      : configuredCollateral.decimals;
  const outcomeDecimals =
    typeof longDecimalsResult === "number" &&
    Number.isSafeInteger(longDecimalsResult) &&
    longDecimalsResult === shortDecimalsResult
      ? longDecimalsResult
      : null;
  const collateralEnabled = configuredCollateral.enabled && !configuredCollateral.warning;
  const collateralWarning = configuredCollateral.warning || !collateralEnabled || outcomeDecimals === null;

  let question: string | undefined;
  if (ancillaryDataHex) {
    try {
      question = hexToString(ancillaryDataHex);
    } catch {
      question = undefined;
    }
  }

  return {
    pairName,
    question,
    ancillaryDataHex,
    priceRequested,
    receivedSettlementPrice,
    settlementPrice,
    longTokenAddress,
    shortTokenAddress,
    requestTimestamp,
    priceIdentifier,
    proposerReward,
    proposerBond,
    livenessTime,
    collateralAddress: collateralAddress ?? null,
    collateralSymbol,
    collateralName,
    collateralDecimals,
    outcomeDecimals,
    collateralEnabled,
    collateralWarning,
    isLoading: isLoading || (collateralAddress !== undefined && isCollateralLoading),
    refetch,
  };
}
