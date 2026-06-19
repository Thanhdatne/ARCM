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

import { formatUnits } from "viem";

interface PortfolioSectionProps {
  collateralBalance: bigint | undefined;
  longBalance: bigint | undefined;
  shortBalance: bigint | undefined;
  yesPrice?: number;
  noPrice?: number;
  collateralSymbol?: string;
  collateralDecimals?: number;
}

function formatTokenAmount(amount: bigint | undefined, decimals: number): string {
  if (amount === undefined) return "0";
  const value = Number(formatUnits(amount, decimals));
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  if (value < 0.0001) return value.toExponential(2);
  return value.toFixed(4);
}

export function PortfolioSection({
  collateralBalance,
  longBalance,
  shortBalance,
  yesPrice,
  noPrice,
  collateralSymbol = "ARCT",
  collateralDecimals = 18,
}: PortfolioSectionProps) {
  const yesTokenValue = longBalance !== undefined && yesPrice !== undefined
    ? Number(formatUnits(longBalance, collateralDecimals)) * (yesPrice / 100)
    : undefined;

  const noTokenValue = shortBalance !== undefined && noPrice !== undefined
    ? Number(formatUnits(shortBalance, collateralDecimals)) * (noPrice / 100)
    : undefined;

  return (
    <div className="exchange-panel">
      <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Your Portfolio</div>
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
        <div className="terminal-card p-3">
          <p className="text-xs font-bold text-[#707A8A]">Collateral Balance</p>
          <p className="mt-1 font-mono text-lg font-bold text-[#EAECEF]">
            {formatTokenAmount(collateralBalance, collateralDecimals)} {collateralSymbol}
          </p>
        </div>

        <div className="terminal-card p-3">
          <p className="text-xs font-bold text-[#0ECB81]">Yes Tokens</p>
          <p className="mt-1 font-mono text-lg font-bold text-[#0ECB81]">
            {formatTokenAmount(longBalance, collateralDecimals)}
          </p>
          {yesTokenValue !== undefined && yesTokenValue > 0 && (
            <p className="mt-1 font-mono text-xs text-[#707A8A]">
              ~{yesTokenValue.toFixed(4)} {collateralSymbol}
            </p>
          )}
        </div>

        <div className="terminal-card p-3">
          <p className="text-xs font-bold text-[#F6465D]">No Tokens</p>
          <p className="mt-1 font-mono text-lg font-bold text-[#F6465D]">
            {formatTokenAmount(shortBalance, collateralDecimals)}
          </p>
          {noTokenValue !== undefined && noTokenValue > 0 && (
            <p className="mt-1 font-mono text-xs text-[#707A8A]">
              ~{noTokenValue.toFixed(4)} {collateralSymbol}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
