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

import { parseUnits } from "viem";
import { AMM_V2_ABI } from "@/lib/contracts";
import { useContractWrite } from "@/hooks/useContractWrite";
import { useMarketAddress } from "@/contexts/MarketAddressContext";

function safeParseAmount(amount: string, decimals: number | null): bigint | null {
  if (!amount || decimals === null) return null;
  try {
    const parsed = parseUnits(amount, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function defaultDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
}

export function useBuyYes(collateralDecimals: number) {
  const { write, isPending, isConfirming, isSuccess, error, hash } = useContractWrite();
  const { ammAddress } = useMarketAddress();

  const buy = (amount: string) => {
    const parsed = safeParseAmount(amount, collateralDecimals);
    if (parsed === null) return;
    write({
      address: ammAddress,
      abi: AMM_V2_ABI,
      functionName: "buyYes",
      args: [parsed, 0n, defaultDeadline()],
    });
  };

  return { buy, isPending, isConfirming, isSuccess, error, hash };
}

export function useBuyNo(collateralDecimals: number) {
  const { write, isPending, isConfirming, isSuccess, error, hash } = useContractWrite();
  const { ammAddress } = useMarketAddress();

  const buy = (amount: string) => {
    const parsed = safeParseAmount(amount, collateralDecimals);
    if (parsed === null) return;
    write({
      address: ammAddress,
      abi: AMM_V2_ABI,
      functionName: "buyNo",
      args: [parsed, 0n, defaultDeadline()],
    });
  };

  return { buy, isPending, isConfirming, isSuccess, error, hash };
}

export function useSellYes(outcomeDecimals: number | null) {
  const { write, isPending, isConfirming, isSuccess, error, hash } = useContractWrite();
  const { ammAddress } = useMarketAddress();

  const sell = (tokenAmount: string) => {
    const parsed = safeParseAmount(tokenAmount, outcomeDecimals);
    if (parsed === null) return;
    write({
      address: ammAddress,
      abi: AMM_V2_ABI,
      functionName: "sellYes",
      args: [parsed, 0n, defaultDeadline()],
    });
  };

  return { sell, isPending, isConfirming, isSuccess, error, hash };
}

export function useSellNo(outcomeDecimals: number | null) {
  const { write, isPending, isConfirming, isSuccess, error, hash } = useContractWrite();
  const { ammAddress } = useMarketAddress();

  const sell = (tokenAmount: string) => {
    const parsed = safeParseAmount(tokenAmount, outcomeDecimals);
    if (parsed === null) return;
    write({
      address: ammAddress,
      abi: AMM_V2_ABI,
      functionName: "sellNo",
      args: [parsed, 0n, defaultDeadline()],
    });
  };

  return { sell, isPending, isConfirming, isSuccess, error, hash };
}
