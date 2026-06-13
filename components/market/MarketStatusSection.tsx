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

import { useState, useEffect } from "react";
import { oracleStateLabel } from "@/hooks/market/helpers";
import { OracleState } from "@/lib/contracts";

interface MarketStatusSectionProps {
  oracleState: OracleState | undefined;
  priceRequested: boolean | undefined;
  receivedSettlementPrice: boolean | undefined;
  expirationTime: bigint | undefined;
}

export function MarketStatusSection({
  oracleState,
  priceRequested,
  receivedSettlementPrice,
  expirationTime,
}: MarketStatusSectionProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const expirationSeconds = expirationTime !== undefined ? Number(expirationTime) - now : undefined;

  // Once the user sees "Disputed", freeze the display there until they
  // leave/reload. Prevents the Disputed → Unknown → No Proposal Yet blink.
  const [disputeSticky, setDisputeSticky] = useState(false);
  useEffect(() => {
    if (oracleState === OracleState.Disputed) setDisputeSticky(true);
  }, [oracleState]);

  const displayState = disputeSticky && oracleState !== OracleState.Proposed && oracleState !== OracleState.Expired && oracleState !== OracleState.Resolved && oracleState !== OracleState.Settled
    ? OracleState.Disputed
    : oracleState;

  if (!priceRequested || receivedSettlementPrice || displayState === undefined) {
    return null;
  }

  return (
    <div className="exchange-panel">
      <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">
        Oracle status
      </div>
      <div className="m-3 flex items-center gap-2 terminal-card px-4 py-3">
        <span className={`inline-block h-2 w-2 ${displayState === OracleState.Requested ? "animate-pulse bg-[#f59e0b]" :
            displayState === OracleState.Proposed ? "bg-[#FCD535]" :
              displayState === OracleState.Expired || displayState === OracleState.Resolved ? "bg-[#22C55E]" :
                displayState === OracleState.Disputed ? "bg-[#F43F5E]" :
                  displayState === OracleState.Invalid && priceRequested ? "bg-[#F43F5E]" :
                    "bg-[#2B3139]"
          }`} />
        <span className="font-semibold text-[#EAECEF]">
          {oracleStateLabel(displayState, { priceRequested: !!priceRequested })}
        </span>
      </div>

      {displayState === OracleState.Requested && (
        <div className="terminal-card m-3 p-4">
          <p className="text-sm font-bold text-[#F59E0B]">Awaiting Proposal</p>
          <p className="mt-1 text-xs leading-5 text-[#707A8A]">
            The market is open and waiting for someone to propose a resolution.
            Anyone can propose YES, NO, or Undetermined via the Resolve tab.
          </p>
        </div>
      )}

      {displayState === OracleState.Proposed && (
        <div className="terminal-card m-3 space-y-2 p-4">
          <p className="text-sm font-bold text-[#FCD535]">Proposal Active</p>
          <p className="text-xs leading-5 text-[#707A8A]">
            A resolution has been proposed. It can be disputed during the liveness window. Trading remains open.
          </p>
          {expirationSeconds !== undefined && (
            expirationSeconds > 0 ? (
              <p className="text-sm font-mono font-bold text-[#F59E0B]">
                Dispute window: {Math.floor(expirationSeconds / 3600) > 0 ? `${Math.floor(expirationSeconds / 3600)}h ` : ""}
                {Math.floor((expirationSeconds % 3600) / 60)}m {expirationSeconds % 60}s
              </p>
            ) : (
              <p className="text-sm font-mono font-bold text-[#22C55E]">
                Liveness expired - ready to settle
              </p>
            )
          )}
        </div>
      )}

      {(displayState === OracleState.Expired || displayState === OracleState.Resolved) && (
        <div className="terminal-card m-3 p-4">
          <p className="text-sm font-bold text-[#22C55E]">Ready to Settle</p>
          <p className="mt-1 text-xs leading-5 text-[#707A8A]">
            The liveness window has passed. Settle the oracle request via the Resolve tab to finalize the market.
          </p>
        </div>
      )}

      {displayState === OracleState.Disputed && (
        <div className="terminal-card m-3 p-4">
          <p className="text-sm font-bold text-[#F43F5E]">Dispute Submitted</p>
          <p className="mt-1 text-xs leading-5 text-[#707A8A]">
            The proposed price was disputed. The dispute has been escalated to UMA&apos;s DVM for arbitration.
            A new price request will be made once the DVM resolves.
          </p>
        </div>
      )}

      {displayState === OracleState.Invalid && priceRequested && (
        <div className="terminal-card m-3 p-4">
          <p className="text-sm font-bold text-[#F43F5E]">Dispute Escalated</p>
          <p className="mt-1 text-xs leading-5 text-[#707A8A]">
            A previous proposal was disputed and escalated to UMA&apos;s DVM for arbitration.
            The market remains open for trading. A new proposal can be submitted.
          </p>
        </div>
      )}
    </div>
  );
}
