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

import { Badge } from "@/components/ui/badge";
import { formatUnits } from "viem";
import { Database, ShieldCheck } from "lucide-react";

interface MarketHeaderProps {
  pairName: string | undefined;
  question: string | undefined;
  priceRequested: boolean | undefined;
  receivedSettlementPrice: boolean | undefined;
  settlementPrice: bigint | undefined;
}

export function MarketHeader({
  pairName,
  question,
  priceRequested,
  receivedSettlementPrice,
  settlementPrice,
}: MarketHeaderProps) {
  const status = receivedSettlementPrice
    ? "Settled"
    : priceRequested
      ? "Open"
      : "Not Initialized";

  const statusColor = receivedSettlementPrice
    ? "text-[#0ECB81]"
    : priceRequested
      ? "text-[#FCD535]"
      : "text-[#FCD535]";

  let outcomeText: string | undefined;
  if (receivedSettlementPrice && settlementPrice !== undefined) {
    const price = formatUnits(settlementPrice, 18);
    if (price === "1") outcomeText = "YES";
    else if (price === "0.5") outcomeText = "Cannot be determined";
    else if (price === "0") outcomeText = "NO";
    else outcomeText = `Unknown (${price})`;
  }

  return (
    <div className="exchange-panel overflow-hidden">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#FCD535] bg-[#FCD535] text-xl text-[#181A20]">
            {pairName?.startsWith("BTC") ? "\u20BF" : "\u{1F52E}"}
          </div>
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                {pairName ?? "Market"}
              </Badge>
              <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                UMA OO V2
              </Badge>
              <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                ARCT collateral
              </Badge>
            </div>
            <h1 className="max-w-4xl text-2xl font-bold leading-tight tracking-tight text-[#EAECEF] sm:text-3xl">
              {question ?? pairName ?? "Market"}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#707A8A]">
              <span className="market-chip inline-flex items-center gap-1.5 px-3 py-1.5">
                <Database className="h-3.5 w-3.5 text-[#FCD535]" />
                Arc Testnet market
              </span>
              <span className="market-chip inline-flex items-center gap-1.5 px-3 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#FCD535]" />
                Positions public today
              </span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`h-8 border-[#2B3139] bg-[#1E2329] px-3 text-xs font-bold text-[#EAECEF] ${statusColor}`}>
          {status}
        </Badge>
      </div>

      {outcomeText && (
        <div className="m-5 mt-0 rounded-xl border border-[#2B3139] bg-[#0B0E11] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#707A8A]">Settlement outcome</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#0ECB81]">{outcomeText}</p>
        </div>
      )}
    </div>
  );
}
