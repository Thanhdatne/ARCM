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

interface ProbabilityBarProps {
  yesPrice: number | undefined;
  noPrice: number | undefined;
  ammInitialized: boolean | undefined;
  receivedSettlementPrice: boolean | undefined;
}

export function ProbabilityBar({
  yesPrice,
  noPrice,
  ammInitialized,
  receivedSettlementPrice,
}: ProbabilityBarProps) {
  const yesPct = yesPrice !== undefined ? Math.round(yesPrice) : null;
  const noPct = noPrice !== undefined ? Math.round(noPrice) : null;

  if (!ammInitialized || receivedSettlementPrice || yesPct === null || noPct === null) {
    return null;
  }

  return (
    <div className="exchange-panel">
      <div className="terminal-titlebar flex items-center justify-between gap-3 px-3 py-1.5">
        <h2 className="text-sm font-bold">
          Outcome odds
        </h2>
        <span className="text-xs">
          AMM price
        </span>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-2">
        <div className="terminal-card p-4 text-[#0ECB81]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]">Yes</p>
              <p className="mt-1 text-xs text-[#707A8A]">Bullish outcome</p>
            </div>
            <p className="font-mono text-4xl font-black leading-none">{yesPct}%</p>
          </div>
          <p className="mt-3 text-xs text-[#707A8A]">
            {yesPrice !== undefined ? (yesPrice / 100).toFixed(2) : "--"} ARCT
          </p>
        </div>
        <div className="terminal-card p-4 text-[#F6465D]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]">No</p>
              <p className="mt-1 text-xs text-[#707A8A]">Bearish outcome</p>
            </div>
            <p className="font-mono text-4xl font-black leading-none">{noPct}%</p>
          </div>
          <p className="mt-3 text-xs text-[#707A8A]">
            {noPrice !== undefined ? (noPrice / 100).toFixed(2) : "--"} ARCT
          </p>
        </div>
      </div>

      <div className="mx-3 flex h-3 overflow-hidden rounded border border-[#2B3139] bg-[#0B0E11]">
        <div
          className="bg-[#0ECB81] transition-all duration-500"
          style={{ width: `${yesPct}%` }}
        />
        <div
          className="bg-[#F6465D] transition-all duration-500"
          style={{ width: `${noPct}%` }}
        />
      </div>
      <div className="mx-3 mb-3 mt-2 flex justify-between text-xs text-[#707A8A]">
        <span>Yes liquidity pressure</span>
        <span>No liquidity pressure</span>
      </div>
    </div>
  );
}
