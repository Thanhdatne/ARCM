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
import { parseUnits } from "viem";
import { AMM_V2_ABI } from "@/lib/contracts";
import { useMarketAddress } from "@/contexts/MarketAddressContext";

function safeParseAmount(amount: string, decimals: number | null): bigint {
  if (!amount || decimals === null) return 0n;
  try {
    const parsed = parseUnits(amount, decimals);
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

export function useCalcBuy(outcome: "yes" | "no", amount: string, collateralDecimals: number) {
  const { ammAddress } = useMarketAddress();

  const amountBigInt = safeParseAmount(amount, collateralDecimals);

  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: ammAddress,
        abi: AMM_V2_ABI,
        functionName: outcome === "yes" ? "calcBuyYes" : "calcBuyNo",
        args: [amountBigInt],
      },
    ],
    query: {
      enabled: amountBigInt > 0n,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    },
  });

  const tokensOut = data?.[0]?.result as bigint | undefined;

  return { tokensOut, isLoading };
}

export function useCalcSell(outcome: "yes" | "no", tokenAmount: string, outcomeDecimals: number | null) {
  const { ammAddress } = useMarketAddress();

  const amountBigInt = safeParseAmount(tokenAmount, outcomeDecimals);

  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: ammAddress,
        abi: AMM_V2_ABI,
        functionName: outcome === "yes" ? "calcSellYes" : "calcSellNo",
        args: [amountBigInt],
      },
    ],
    query: {
      enabled: amountBigInt > 0n,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    },
  });

  const collateralOut = data?.[0]?.result as bigint | undefined;

  return { collateralOut, isLoading };
}
