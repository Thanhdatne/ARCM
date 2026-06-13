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
import { formatCollateral } from "@/hooks/market/helpers";
import { COLLATERAL_DECIMALS } from "@/lib/contracts";

interface PortfolioSectionProps {
  arctBalance: bigint | undefined;
  longBalance: bigint | undefined;
  shortBalance: bigint | undefined;
  yesPrice: number | undefined;
  noPrice: number | undefined;
}

export function PortfolioSection({
  arctBalance,
  longBalance,
  shortBalance,
  yesPrice,
  noPrice,
}: PortfolioSectionProps) {
  const yesTokenValue = longBalance !== undefined && yesPrice !== undefined
    ? parseFloat(formatUnits(longBalance, COLLATERAL_DECIMALS)) * (yesPrice / 100)
    : undefined;
  const noTokenValue = shortBalance !== undefined && noPrice !== undefined
    ? parseFloat(formatUnits(shortBalance, COLLATERAL_DECIMALS)) * (noPrice / 100)
    : undefined;

  return (
    <div className="exchange-panel">
      <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Your Portfolio</div>
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
        <div className="terminal-card p-3">
          <p className="text-xs font-bold text-[#707A8A]">ARCT Balance</p>
          <p className="mt-1 font-mono text-lg font-bold text-[#EAECEF]">{formatCollateral(arctBalance)}</p>
        </div>
        <div className="terminal-card p-3">
          <p className="text-xs font-bold text-[#22C55E]">Yes Tokens</p>
          <p className="mt-1 font-mono text-lg font-bold text-[#22C55E]">
            {formatCollateral(longBalance)}
          </p>
          {yesTokenValue !== undefined && yesTokenValue > 0 && (
            <p className="mt-1 font-mono text-xs text-[#707A8A]">
              ~{yesTokenValue.toFixed(2)} ARCT
            </p>
          )}
        </div>
        <div className="terminal-card p-3">
          <p className="text-xs font-bold text-[#F43F5E]">No Tokens</p>
          <p className="mt-1 font-mono text-lg font-bold text-[#F43F5E]">
            {formatCollateral(shortBalance)}
          </p>
          {noTokenValue !== undefined && noTokenValue > 0 && (
            <p className="mt-1 font-mono text-xs text-[#707A8A]">
              ~{noTokenValue.toFixed(2)} ARCT
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
