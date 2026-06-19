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
import { TxStatus, type TxStatusProps } from "./TxStatus";
import { OutcomeSelector } from "./OutcomeSelector";

type Outcome = "yes" | "no";

interface SellTabProps {
  outcome: Outcome;
  onOutcomeChange: (o: Outcome) => void;
  amount: string;
  onAmountChange: (a: string) => void;
  yesPrice?: number;
  noPrice?: number;
  longBalance: bigint | undefined;
  shortBalance: bigint | undefined;
  sellPreview: bigint | undefined;
  needsApproval: boolean;
  isAllowancesLoading: boolean;
  approveHook: TxStatusProps & { approve: (amount: bigint) => void };
  sellHook: TxStatusProps & { sell: (amount: string) => void };
  collateralSymbol?: string;
  collateralDecimals: number;
  outcomeDecimals: number;
}

export function SellTab({
  outcome,
  onOutcomeChange,
  amount,
  onAmountChange,
  yesPrice,
  noPrice,
  longBalance,
  shortBalance,
  sellPreview,
  needsApproval,
  isAllowancesLoading,
  approveHook,
  sellHook,
  collateralSymbol = "ARCT",
  collateralDecimals,
  outcomeDecimals,
}: SellTabProps) {
  const selectedBalance = outcome === "yes" ? longBalance : shortBalance;
  const hasTokens = selectedBalance && selectedBalance > 0n;
  let amountBigInt = 0n;
  try {
    amountBigInt = amount ? parseUnits(amount, outcomeDecimals) : 0n;
  } catch {
    amountBigInt = 0n;
  }
  const spotPrice = outcome === "yes" ? yesPrice : noPrice;

  let avgPrice: number | undefined;
  let priceImpact: number | undefined;

  if (sellPreview !== undefined && amountBigInt > 0n) {
    const received = parseFloat(formatUnits(sellPreview, collateralDecimals));
    const tokensSpent = parseFloat(amount);
    if (tokensSpent > 0) {
      avgPrice = received / tokensSpent;
      const otherPrice = outcome === "yes" ? noPrice : yesPrice;
      if (spotPrice !== undefined && spotPrice > 0 && otherPrice !== undefined && otherPrice > 0) {
        const marginalRate = spotPrice / otherPrice;
        priceImpact = Math.abs((avgPrice - marginalRate) / marginalRate) * 100;
      }
    }
  }

  return (
    <div className="space-y-4">
      <OutcomeSelector
        outcome={outcome}
        onSelect={onOutcomeChange}
        label="Token to sell"
      />

      {!hasTokens ? (
        <p className="rounded-xl border border-[#2B3139] bg-[#0B0E11] px-3 py-4 text-center text-sm text-[#707A8A]">
          You don&apos;t have any {outcome === "yes" ? "Yes" : "No"} tokens to sell.
          {(!longBalance || longBalance === 0n) && (!shortBalance || shortBalance === 0n)
            ? " Buy tokens first on the Buy tab."
            : ` Try selling your ${outcome === "yes" ? "No" : "Yes"} tokens instead.`}
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-xs font-bold text-[#707A8A]">Amount</label>
              <span className="text-xs text-[#707A8A]">
                Balance{" "}
                <span className="font-mono font-bold text-[#EAECEF]">
                  {selectedBalance !== undefined ? formatUnits(selectedBalance, outcomeDecimals) : "0"} {outcome === "yes" ? "YES" : "NO"}
                </span>
              </span>
            </div>
            <div className="relative">
            <Input
              type="number"
              placeholder="0"
              min="0"
              max={selectedBalance !== undefined ? formatUnits(selectedBalance, outcomeDecimals) : "0"}
              value={amount}
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw || parseFloat(raw) <= 0) {
                  onAmountChange(raw);
                  return;
                }
                try {
                  const parsed = parseUnits(raw, outcomeDecimals);
                  const safeMax = selectedBalance > 1n ? selectedBalance - 1n : selectedBalance;
                  if (parsed > safeMax) {
                    onAmountChange(formatUnits(safeMax, outcomeDecimals));
                  } else {
                    onAmountChange(raw);
                  }
                } catch {
                  onAmountChange(raw);
                }
              }}
                className="h-14 rounded-xl border-[#2B3139] bg-[#1E2329] pr-20 text-right font-mono text-2xl font-bold text-[#EAECEF]"
            />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#707A8A]">
                {outcome === "yes" ? "YES" : "NO"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {["10", "25", "50"].map((v) => (
                <button
                  key={v}
                  onClick={() => onAmountChange(v)}
                  className="preset-button focus-ring rounded-lg px-2 py-2 text-xs font-bold"
                >
                  {v}
                </button>
              ))}
              <button
                onClick={() => {
                  const safeMax = selectedBalance > 1n ? selectedBalance - 1n : selectedBalance;
                  onAmountChange(formatUnits(safeMax, outcomeDecimals));
                }}
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
                {sellPreview !== undefined
                  ? `${parseFloat(formatUnits(sellPreview, collateralDecimals)).toFixed(2)}`
                  : "0.00"} {collateralSymbol}
              </span>
            </div>
            {avgPrice !== undefined && (
              <div className="flex justify-between">
                <span className="text-[#707A8A]">Avg price</span>
                <span className="font-mono text-[#EAECEF]">{avgPrice.toFixed(4)} {collateralSymbol}</span>
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
                onClick={() => approveHook.approve(amountBigInt)}
                disabled={amountBigInt <= 0n || approveHook.isPending || approveHook.isConfirming}
              >
                {approveHook.isPending || approveHook.isConfirming
                  ? "Approving..."
                  : `Approve ${outcome === "yes" ? "YES" : "NO"}`}
              </Button>
              <TxStatus {...approveHook} />
            </>
          ) : (
            <>
              <Button
                className={`focus-ring h-12 w-full rounded-xl text-base font-black text-white transition active:translate-y-px disabled:cursor-not-allowed disabled:border-[#2B3139] disabled:bg-[#2B3139] disabled:text-[#707A8A] ${outcome === "yes"
                  ? "border border-[#0ECB81] bg-[#0ECB81] hover:-translate-y-px hover:bg-[#00D084] hover:shadow-[0_0_18px_rgba(14,203,129,0.18)]"
                  : "border border-[#F6465D] bg-[#F6465D] hover:-translate-y-px hover:bg-[#FF4D4F] hover:shadow-[0_0_18px_rgba(246,70,93,0.18)]"
                }`}
                onClick={() => sellHook.sell(amount)}
                disabled={
                  sellHook.isPending || sellHook.isConfirming ||
                  !amount ||
                  amountBigInt <= 0n
                }
              >
                {sellHook.isPending || sellHook.isConfirming
                  ? "Selling..."
                  : `Sell ${outcome === "yes" ? "YES" : "NO"}`}
              </Button>
              <TxStatus {...sellHook} />
            </>
          )}
        </>
      )}
    </div>
  );
}
