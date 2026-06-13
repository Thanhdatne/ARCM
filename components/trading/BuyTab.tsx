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

import { parseUnits, formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCollateral } from "@/hooks/market/helpers";
import { COLLATERAL_DECIMALS } from "@/lib/contracts";
import { TxStatus, type TxStatusProps } from "./TxStatus";
import { OutcomeSelector } from "./OutcomeSelector";

type Outcome = "yes" | "no";

interface BuyTabProps {
  outcome: Outcome;
  onOutcomeChange: (o: Outcome) => void;
  amount: string;
  onAmountChange: (a: string) => void;
  yesPrice?: number;
  noPrice?: number;
  arctBalance: bigint | undefined;
  buyPreview: bigint | undefined;
  needsApproval: boolean;
  isAllowancesLoading: boolean;
  approveArct: TxStatusProps & { approve: (amount: bigint) => void };
  buyHook: TxStatusProps & { buy: (amount: string) => void };
}

export function BuyTab({
  outcome,
  onOutcomeChange,
  amount,
  onAmountChange,
  yesPrice,
  noPrice,
  arctBalance,
  buyPreview,
  needsApproval,
  isAllowancesLoading,
  approveArct,
  buyHook,
}: BuyTabProps) {
  const amountBigInt = amount ? parseUnits(amount, COLLATERAL_DECIMALS) : 0n;
  const spotPrice = outcome === "yes" ? yesPrice : noPrice;
  const quickAmounts = ["10", "25", "50"];

  let avgPrice: number | undefined;
  let priceImpact: number | undefined;

  if (buyPreview !== undefined && amountBigInt > 0n) {
    const tokensReceived = parseFloat(formatUnits(buyPreview, COLLATERAL_DECIMALS));
    const spent = parseFloat(amount);
    if (tokensReceived > 0) {
      avgPrice = spent / tokensReceived;
      if (spotPrice !== undefined && spotPrice > 0) {
        priceImpact = Math.abs((avgPrice - spotPrice / 100) / (spotPrice / 100)) * 100;
      }
    }
  }

  return (
    <div className="space-y-4">
      <OutcomeSelector
        outcome={outcome}
        onSelect={onOutcomeChange}
        yesPrice={yesPrice}
        noPrice={noPrice}
      />

      <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-xs font-bold text-[#707A8A]">Amount</label>
          <span className="text-xs text-[#707A8A]">
            Balance <span className="font-mono font-bold text-[#EAECEF]">{formatCollateral(arctBalance)} ARCT</span>
          </span>
        </div>
        <div className="relative">
        <Input
          type="number"
          placeholder="0"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
            className="h-14 rounded-xl border-[#2B3139] bg-[#1E2329] pr-16 text-right font-mono text-2xl font-bold text-[#EAECEF]"
        />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#707A8A]">
            ARCT
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {quickAmounts.map((v) => (
            <button
              key={v}
              onClick={() => onAmountChange(v)}
              className="preset-button focus-ring rounded-lg px-2 py-2 text-xs font-bold"
            >
              {v}
            </button>
          ))}
          <button
            onClick={() => onAmountChange(formatCollateral(arctBalance, true))}
            className="preset-button focus-ring rounded-lg px-2 py-2 text-xs font-bold"
          >
            Max
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-[#2B3139] bg-[#0B0E11] p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-[#707A8A]">Estimated receive</span>
          <span className="font-mono font-bold text-[#EAECEF]">
            {buyPreview !== undefined
              ? `${parseFloat(formatUnits(buyPreview, COLLATERAL_DECIMALS)).toFixed(2)} ${outcome === "yes" ? "YES" : "NO"}`
              : `0 ${outcome === "yes" ? "YES" : "NO"}`}
          </span>
        </div>
        {avgPrice !== undefined && (
          <div className="flex justify-between">
            <span className="text-[#707A8A]">Avg price</span>
            <span className="font-mono text-[#EAECEF]">{avgPrice.toFixed(4)} ARCT</span>
          </div>
        )}
        {priceImpact !== undefined && priceImpact > 0.1 && (
          <div className="flex justify-between">
            <span className={priceImpact > 5 ? "font-bold text-[#F6465D]" : "text-[#707A8A]"}>
              Price impact
            </span>
            <span className={`font-mono font-bold ${priceImpact > 5 ? "text-[#F6465D]" : "text-[#FCD535]"}`}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {isAllowancesLoading ? (
        <Skeleton className="h-10 w-full rounded-md" />
      ) : needsApproval ? (
        <>
          <Button
            className="focus-ring h-12 w-full rounded-xl border border-[#FCD535] bg-[#FCD535] text-base font-black text-[#181A20] hover:bg-[#F0B90B] active:translate-y-px disabled:cursor-not-allowed disabled:border-[#2B3139] disabled:bg-[#2B3139] disabled:text-[#707A8A]"
            variant="outline"
            onClick={() =>
              approveArct.approve(parseUnits("1000000", COLLATERAL_DECIMALS))
            }
            disabled={approveArct.isPending || approveArct.isConfirming}
          >
            {approveArct.isPending || approveArct.isConfirming
              ? "Approving..."
              : "Approve ARCT"}
          </Button>
          <TxStatus {...approveArct} />
        </>
      ) : (
        <>
          <Button
            className={`focus-ring h-12 w-full rounded-xl text-base font-black text-white transition active:translate-y-px disabled:cursor-not-allowed disabled:border-[#2B3139] disabled:bg-[#2B3139] disabled:text-[#707A8A] ${outcome === "yes"
              ? "border border-[#0ECB81] bg-[#0ECB81] hover:-translate-y-px hover:bg-[#00D084] hover:shadow-[0_0_18px_rgba(14,203,129,0.18)]"
              : "border border-[#F6465D] bg-[#F6465D] hover:-translate-y-px hover:bg-[#FF4D4F] hover:shadow-[0_0_18px_rgba(246,70,93,0.18)]"
            }`}
            onClick={() => buyHook.buy(amount)}
            disabled={
              buyHook.isPending || buyHook.isConfirming ||
              !amount ||
              parseFloat(amount) <= 0
            }
          >
            {buyHook.isPending || buyHook.isConfirming
              ? "Buying..."
              : `Buy ${outcome === "yes" ? "YES" : "NO"}`}
          </Button>
          <TxStatus {...buyHook} />
        </>
      )}
    </div>
  );
}
