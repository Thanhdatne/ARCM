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
import { parseUnits, formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { oracleStateLabel } from "@/hooks/market/helpers";
import { OracleState, COLLATERAL_DECIMALS } from "@/lib/contracts";
import { TxStatus, type TxStatusProps } from "./TxStatus";

const ONE = 1000000000000000000n;

function formatTokenAmount(amount: bigint | undefined, decimals: number, full = false): string {
  if (amount === undefined) return full ? "0" : "...";
  const formatted = formatUnits(amount, decimals);
  if (full) return formatted;
  const value = Number(formatted);
  if (!Number.isFinite(value)) return formatted;
  if (value === 0) return "0";
  if (value < 0.0001) return value.toExponential(2);
  return value.toFixed(4);
}

interface ResolveTabProps {
  oracleState: OracleState | undefined;
  priceRequested: boolean | undefined;
  receivedSettlementPrice: boolean | undefined;
  settlementPrice: bigint | undefined;
  longBalance: bigint | undefined;
  shortBalance: bigint | undefined;
  proposer: string | undefined;
  proposedPrice: bigint | undefined;
  expirationTime: bigint | undefined;
  bond: bigint | undefined;
  needsOracleApproval: boolean;
  isOracleAllowanceLoading: boolean;
  approveArctForOO: TxStatusProps & { approve: (amount: bigint) => void };
  proposePrice: TxStatusProps & { propose: (price: bigint) => void };
  disputePrice: TxStatusProps & { dispute: () => void };
  settleOracle: TxStatusProps & { settleOracle: () => void };
  settleOracleWithTimer: TxStatusProps & { settleOracle: (targetTimestamp?: bigint) => void };
  isOracleSettlementRefreshing: boolean;
  settlePos: TxStatusProps & { settle: (longAmt: bigint, shortAmt: bigint) => void };
  adminSettlementEnabled: boolean;
  collateralSymbol?: string;
  collateralDecimals?: number;
  outcomeDecimals?: number | null;
}

export function ResolveTab({
  oracleState,
  priceRequested,
  receivedSettlementPrice,
  settlementPrice,
  longBalance,
  shortBalance,
  proposer,
  proposedPrice,
  expirationTime,
  bond,
  needsOracleApproval,
  isOracleAllowanceLoading,
  approveArctForOO,
  proposePrice,
  disputePrice,
  settleOracle,
  settleOracleWithTimer,
  isOracleSettlementRefreshing,
  settlePos,
  adminSettlementEnabled,
  collateralSymbol = "ARCT",
  collateralDecimals = COLLATERAL_DECIMALS,
  outcomeDecimals,
}: ResolveTabProps) {
  const [longSettleAmt, setLongSettleAmt] = useState("");
  const [shortSettleAmt, setShortSettleAmt] = useState("");
  const [advancedClaimOpen, setAdvancedClaimOpen] = useState(false);
  const [disputeEscalated, setDisputeEscalated] = useState(false);
  const tokenDecimals = outcomeDecimals ?? collateralDecimals;

  useEffect(() => {
    if (proposePrice.isSuccess) setDisputeEscalated(false);
  }, [proposePrice.isSuccess]);

  useEffect(() => {
    if (disputePrice.isSuccess) setDisputeEscalated(true);
  }, [disputePrice.isSuccess]);

  // Once the user sees "Disputed", freeze the display there until they
  // leave/reload. Prevents the Disputed → Unknown → No Proposal Yet blink.
  const [disputeSticky, setDisputeSticky] = useState(false);
  useEffect(() => {
    if (oracleState === OracleState.Disputed) setDisputeSticky(true);
  }, [oracleState]);

  const displayOracleState = disputeSticky && oracleState !== OracleState.Proposed && oracleState !== OracleState.Expired && oracleState !== OracleState.Resolved && oracleState !== OracleState.Settled
    ? OracleState.Disputed
    : oracleState;

  useEffect(() => {
    if (settlePos.isSuccess) {
      setLongSettleAmt("");
      setShortSettleAmt("");
      setAdvancedClaimOpen(false);
    }
  }, [settlePos.isSuccess]);

  // Countdown for proposal expiration
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const expirationSeconds = expirationTime !== undefined ? Number(expirationTime) - now : undefined;
  const expirationDisplay = expirationSeconds !== undefined && expirationSeconds > 0
    ? `${Math.floor(expirationSeconds / 60)}m ${expirationSeconds % 60}s`
    : undefined;
  const isSettleOracleBusy =
    settleOracle.isPending ||
    settleOracle.isConfirming ||
    isOracleSettlementRefreshing;
  const isSettleOracleWithTimerBusy =
    settleOracleWithTimer.isPending ||
    settleOracleWithTimer.isConfirming ||
    isOracleSettlementRefreshing;
  const fastForwardSettleTime = expirationTime !== undefined ? expirationTime + 1n : undefined;
  const settlementPriceNumber = settlementPrice !== undefined ? Number(settlementPrice) / 1e18 : undefined;
  const longPaysOut = settlementPriceNumber !== undefined && settlementPriceNumber > 0;
  const shortPaysOut = settlementPriceNumber !== undefined && settlementPriceNumber < 1;
  const claimableLong = receivedSettlementPrice && longPaysOut ? longBalance ?? 0n : 0n;
  const claimableShort = receivedSettlementPrice && shortPaysOut ? shortBalance ?? 0n : 0n;
  const hasClaimablePayout = claimableLong > 0n || claimableShort > 0n;
  const proposalLivenessActive =
    displayOracleState === OracleState.Proposed &&
    expirationSeconds !== undefined &&
    expirationSeconds > 0;
  const readyToSettleOracle =
    displayOracleState === OracleState.Expired ||
    displayOracleState === OracleState.Resolved ||
    (displayOracleState === OracleState.Proposed &&
      expirationSeconds !== undefined &&
      expirationSeconds <= 0);

  return (
    <div className="space-y-4">
      {/* Oracle status badge */}
      <div className="terminal-card p-3 text-center">
        <p className="mb-1 text-xs font-bold text-[#707A8A]">Oracle Status</p>
        <p className="font-mono text-sm font-semibold">
          {oracleStateLabel(displayOracleState, { priceRequested: !!priceRequested })}
        </p>
      </div>

      <ResolveStatePanel
        hasClaimablePayout={hasClaimablePayout}
        priceRequested={priceRequested}
        proposalLivenessActive={proposalLivenessActive}
        readyToSettleOracle={readyToSettleOracle}
        receivedSettlementPrice={receivedSettlementPrice}
        oracleState={displayOracleState}
      />

      {!priceRequested && (
        <div className="terminal-card p-3 text-xs leading-5 text-[#707A8A]">
          Market not initialized. The market must request a price from UMA Optimistic Oracle V2 before resolution actions are available.
        </div>
      )}

      {!adminSettlementEnabled && !receivedSettlementPrice && (
        <div className="terminal-card p-3 text-xs leading-5 text-[#707A8A]">
          Settlement admin controls are hidden during public preview. Public users can trade active markets and claim rewards after onchain settlement.
        </div>
      )}

      {/* Phase 1: Awaiting proposal */}
      {adminSettlementEnabled && (oracleState === OracleState.Requested || oracleState === OracleState.Disputed || (oracleState === OracleState.Invalid && priceRequested) || (disputeEscalated && disputePrice.isSuccess)) && (
        <div className="space-y-3">
          <p className="terminal-card p-3 text-xs leading-5 text-[#707A8A]">
            No one has proposed a resolution yet. Propose YES (1e18), NO (0), or Undetermined (5e17).
            Requires a bond of {bond !== undefined ? formatTokenAmount(bond, collateralDecimals) : "..."} {collateralSymbol}.
          </p>
          {isOracleAllowanceLoading ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : needsOracleApproval ? (
            <>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => approveArctForOO.approve(parseUnits("1000000", collateralDecimals))}
                disabled={approveArctForOO.isPending || approveArctForOO.isConfirming}
              >
                {approveArctForOO.isPending || approveArctForOO.isConfirming
                  ? "Approving..."
                  : `Approve ${collateralSymbol} for Oracle`}
              </Button>
              <TxStatus {...approveArctForOO} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  className="terminal-button text-[#22C55E]"
                  onClick={() => proposePrice.propose(BigInt("1000000000000000000"))}
                  disabled={proposePrice.isPending || proposePrice.isConfirming}
                >
                  Yes
                </Button>
                <Button
                  size="sm"
                  className="terminal-button text-[#F43F5E]"
                  onClick={() => proposePrice.propose(0n)}
                  disabled={proposePrice.isPending || proposePrice.isConfirming}
                >
                  No
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => proposePrice.propose(BigInt("500000000000000000"))}
                  disabled={proposePrice.isPending || proposePrice.isConfirming}
                >
                  Undetermined
                </Button>
              </div>
              <TxStatus {...proposePrice} />
            </>
          )}
        </div>
      )}

      {/* Phase 2: Proposal active - can dispute */}
      {adminSettlementEnabled && oracleState === OracleState.Proposed && (
        <div className="space-y-3">
          <div className="terminal-card space-y-1 p-3">
            <p className="text-xs font-bold text-[#707A8A]">Proposed Resolution</p>
            <p className="font-mono text-lg font-semibold">
              {proposedPrice !== undefined
                ? proposedPrice >= BigInt("1000000000000000000") ? "YES"
                  : proposedPrice === 0n ? "NO"
                    : proposedPrice === BigInt("500000000000000000") ? "UNDETERMINED"
                      : `${formatUnits(proposedPrice, 18)}`
                : "..."}
            </p>
            <p className="text-xs text-[#707A8A]">
              by {proposer ? `${proposer.slice(0, 6)}...${proposer.slice(-4)}` : "..."}
            </p>
            {expirationDisplay && (
              <p className="font-mono text-xs font-bold text-[#FF9D2E]">
                Dispute window: {expirationDisplay}
              </p>
            )}
          </div>
          {isOracleAllowanceLoading ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : needsOracleApproval ? (
            <>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => approveArctForOO.approve(parseUnits("1000000", collateralDecimals))}
                disabled={approveArctForOO.isPending || approveArctForOO.isConfirming}
              >
                {approveArctForOO.isPending || approveArctForOO.isConfirming
                  ? "Approving..."
                  : `Approve ${collateralSymbol} for Oracle`}
              </Button>
              <TxStatus {...approveArctForOO} />
            </>
          ) : expirationSeconds !== undefined && expirationSeconds <= 0 ? (
            <>
              <Button
                className="w-full"
                onClick={() => settleOracleWithTimer.settleOracle(fastForwardSettleTime)}
                disabled={isSettleOracleWithTimerBusy}
              >
                {isSettleOracleWithTimerBusy
                  ? isOracleSettlementRefreshing
                    ? "Finalizing Oracle..."
                    : "Settling Oracle..."
                  : "Settle Oracle Request"}
              </Button>
              <TxStatus {...settleOracleWithTimer} />
              {isOracleSettlementRefreshing && (
                <p className="text-xs font-bold text-[#FF8A00]">
                  Refreshing oracle state until settlement is fully reflected in the UI...
                </p>
              )}
            </>
          ) : (
            <>
              <Button
                className="w-full"
                onClick={() => settleOracleWithTimer.settleOracle(fastForwardSettleTime)}
                disabled={isSettleOracleWithTimerBusy || fastForwardSettleTime === undefined}
              >
                {isSettleOracleWithTimerBusy
                  ? isOracleSettlementRefreshing
                    ? "Finalizing Oracle..."
                    : "Fast-forwarding..."
                  : "Fast-forward + Settle Oracle"}
              </Button>
              <TxStatus {...settleOracleWithTimer} />
              {isOracleSettlementRefreshing && (
                <p className="text-xs font-bold text-[#FF8A00]">
                  Refreshing oracle state until settlement is fully reflected in the UI...
                </p>
              )}


              <Button
                className="w-full text-[#F43F5E]"
                variant="outline"
                onClick={() => disputePrice.dispute()}
                disabled={disputePrice.isPending || disputePrice.isConfirming}
              >
                {disputePrice.isPending || disputePrice.isConfirming ? "Disputing..." : "Dispute"}
              </Button>
              <TxStatus {...disputePrice} />
            </>
          )}
        </div>
      )}

      {/* Phase 3: Expired or Resolved - settle the OO request */}
      {adminSettlementEnabled && (oracleState === OracleState.Expired || oracleState === OracleState.Resolved) && (
        <div className="space-y-3">
          <p className="terminal-card p-3 text-xs leading-5 text-[#707A8A]">
            The oracle request is ready to be settled. Anyone can call settle to finalize the resolution.
          </p>
          <Button
            className="w-full"
            onClick={() => settleOracle.settleOracle()}
            disabled={isSettleOracleBusy}
          >
            {isSettleOracleBusy
              ? isOracleSettlementRefreshing
                ? "Finalizing Oracle..."
                : "Settling Oracle..."
              : "Settle Oracle Request"}
          </Button>
          <TxStatus {...settleOracle} />
          {isOracleSettlementRefreshing && (
            <p className="text-xs font-bold text-[#FF8A00]">
              Refreshing oracle state until settlement is fully reflected in the UI...
            </p>
          )}
        </div>
      )}

      {/* Phase 5: Market settled - redeem tokens */}
      {(receivedSettlementPrice || oracleState === OracleState.Settled) && (() => {
        const price = settlementPriceNumber;
        const redeemableLong = longPaysOut ? longBalance ?? 0n : 0n;
        const redeemableShort = shortPaysOut ? shortBalance ?? 0n : 0n;
        const hasRedeemableTokens = redeemableLong > 0n || redeemableShort > 0n;
        const isClaiming = settlePos.isPending || settlePos.isConfirming;
        const isClaimed = settlePos.isSuccess;
        const payoutAmount =
          settlementPrice !== undefined
            ? (redeemableLong * settlementPrice + redeemableShort * (ONE - settlementPrice)) / ONE
            : 0n;

        const priceLabel = settlementPrice !== undefined
          ? settlementPrice === BigInt("1000000000000000000") ? "YES (1.0)"
            : settlementPrice === 0n ? "NO (0.0)"
              : settlementPrice === BigInt("500000000000000000") ? "UNDETERMINED (0.5)"
                : String(price)
          : "...";

        return (
          <>
            <div className="terminal-card p-3">
              <p className="text-xs font-bold text-[#707A8A]">Settlement Price</p>
              <p className="font-mono text-lg font-bold text-[#22C55E]">{priceLabel}</p>
            </div>

            {!hasRedeemableTokens ? (
              <p className="terminal-card px-3 py-4 text-center text-sm text-[#707A8A]">
                {(!longBalance && !shortBalance)
                  ? "Market resolved. You have no tokens to settle."
                  : `Market resolved to ${price === 1 ? "Yes" : price === 0 ? "No" : price}. Your ${longBalance ? "Yes" : "No"} tokens have no payout.`}
              </p>
            ) : receivedSettlementPrice ? (
              <>
                <div className="terminal-card p-3">
                  <p className="text-xs font-bold text-[#707A8A]">Claimable reward</p>
                  <div className="mt-2 grid gap-2 text-sm font-bold">
                    <div className="flex items-center justify-between gap-3">
                      <span>{collateralSymbol} payout</span>
                      <span className="font-mono">{formatTokenAmount(payoutAmount, collateralDecimals)} {collateralSymbol}</span>
                    </div>
                    {redeemableLong > 0n && (
                      <div className="flex items-center justify-between gap-3">
                        <span>YES tokens</span>
                        <span className="font-mono">{formatTokenAmount(redeemableLong, tokenDecimals)} tokens</span>
                      </div>
                    )}
                    {redeemableShort > 0n && (
                      <div className="flex items-center justify-between gap-3">
                        <span>NO tokens</span>
                        <span className="font-mono">{formatTokenAmount(redeemableShort, tokenDecimals)} tokens</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#707A8A]">
                    Claim Reward redeems your winning YES/NO tokens for {collateralSymbol} payout.
                  </p>
                </div>

                <Button
                  className="w-full text-[#22C55E]"
                  onClick={() => settlePos.settle(redeemableLong, redeemableShort)}
                  disabled={isClaiming || isClaimed}
                >
                  {isClaiming ? "Claiming..." : isClaimed ? "Claimed" : "Claim Reward"}
                </Button>
                <TxStatus {...settlePos} />

                {!isClaimed && (
                  <button
                    className="text-[11px] font-bold text-[#707A8A] underline underline-offset-2 hover:text-[#FF8A00]"
                    onClick={() => setAdvancedClaimOpen((value) => !value)}
                    type="button"
                  >
                    {advancedClaimOpen ? "Hide advanced amount" : "Advanced: partial amount"}
                  </button>
                )}

                {advancedClaimOpen && !isClaimed && (
                  <div className="space-y-3 rounded-lg border border-[#2B3139] bg-[#1E2329] p-3">
                    <p className="text-xs font-bold text-[#707A8A]">
                      Optional manual amount. Normal users should use Claim Reward.
                    </p>
                    <div className={redeemableLong > 0n && redeemableShort > 0n ? "grid grid-cols-2 gap-2" : ""}>
                      {redeemableLong > 0n && (
                        <div>
                          <p className="mb-1 text-xs font-bold text-[#707A8A]">
                            Yes tokens
                            <span className="float-right font-mono">{formatTokenAmount(redeemableLong, tokenDecimals)}</span>
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="0"
                              min="0"
                              max={formatTokenAmount(redeemableLong, tokenDecimals, true)}
                              value={longSettleAmt}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (!raw || parseFloat(raw) <= 0) {
                                  setLongSettleAmt(raw);
                                  return;
                                }
                                const parsed = parseUnits(raw, tokenDecimals);
                                if (parsed > redeemableLong) {
                                  setLongSettleAmt(formatUnits(redeemableLong, tokenDecimals));
                                } else {
                                  setLongSettleAmt(raw);
                                }
                              }}
                              className="font-mono"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLongSettleAmt(formatUnits(redeemableLong, tokenDecimals))}
                            >
                              MAX
                            </Button>
                          </div>
                        </div>
                      )}
                      {redeemableShort > 0n && (
                        <div>
                          <p className="mb-1 text-xs font-bold text-[#707A8A]">
                            No tokens
                            <span className="float-right font-mono">{formatTokenAmount(redeemableShort, tokenDecimals)}</span>
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="0"
                              min="0"
                              max={formatTokenAmount(redeemableShort, tokenDecimals, true)}
                              value={shortSettleAmt}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (!raw || parseFloat(raw) <= 0) {
                                  setShortSettleAmt(raw);
                                  return;
                                }
                                const parsed = parseUnits(raw, tokenDecimals);
                                if (parsed > redeemableShort) {
                                  setShortSettleAmt(formatUnits(redeemableShort, tokenDecimals));
                                } else {
                                  setShortSettleAmt(raw);
                                }
                              }}
                              className="font-mono"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShortSettleAmt(formatUnits(redeemableShort, tokenDecimals))}
                            >
                              MAX
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full text-[#22C55E]"
                      onClick={() => {
                        const longVal = longSettleAmt ? parseUnits(longSettleAmt, tokenDecimals) : 0n;
                        const shortVal = shortSettleAmt ? parseUnits(shortSettleAmt, tokenDecimals) : 0n;
                        settlePos.settle(
                          longVal > redeemableLong ? redeemableLong : longVal,
                          shortVal > redeemableShort ? redeemableShort : shortVal,
                        );
                      }}
                      disabled={
                        isClaiming ||
                        isClaimed ||
                        (!Number(longSettleAmt) && !Number(shortSettleAmt))
                      }
                    >
                      {isClaiming ? "Claiming..." : "Claim Selected Amount"}
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </>
        );
      })()}
    </div>
  );
}

function ResolveStatePanel({
  hasClaimablePayout,
  priceRequested,
  proposalLivenessActive,
  readyToSettleOracle,
  receivedSettlementPrice,
  oracleState,
}: {
  hasClaimablePayout: boolean;
  priceRequested: boolean | undefined;
  proposalLivenessActive: boolean;
  readyToSettleOracle: boolean;
  receivedSettlementPrice: boolean | undefined;
  oracleState: OracleState | undefined;
}) {
  const rows = [
    {
      label: "Market initialized",
      value: priceRequested ? "Price requested" : "Not initialized",
      active: !!priceRequested,
    },
    {
      label: "Proposal",
      value:
        oracleState === OracleState.Proposed
          ? "Proposal pending"
          : oracleState === OracleState.Requested
            ? "Awaiting proposal"
            : oracleState === OracleState.Disputed || oracleState === OracleState.Invalid
              ? "Dispute / arbitration"
              : receivedSettlementPrice
                ? "Resolved"
                : "Pending",
      active:
        oracleState === OracleState.Proposed ||
        oracleState === OracleState.Requested ||
        oracleState === OracleState.Disputed ||
        oracleState === OracleState.Invalid,
    },
    {
      label: "Liveness",
      value: proposalLivenessActive ? "Active" : readyToSettleOracle ? "Expired" : "Waiting",
      active: proposalLivenessActive || readyToSettleOracle,
    },
    {
      label: "Settlement",
      value: receivedSettlementPrice ? "Settled" : readyToSettleOracle ? "Ready to settle" : "Not settled",
      active: !!receivedSettlementPrice || readyToSettleOracle,
    },
    {
      label: "Claim",
      value: hasClaimablePayout ? "Claimable payout available" : receivedSettlementPrice ? "No claimable payout" : "Not available",
      active: hasClaimablePayout,
    },
  ];

  return (
    <div className="grid gap-1">
      {rows.map((row) => (
        <div
          className={`flex items-center justify-between gap-3 rounded border border-[#2B3139] px-2.5 py-1.5 text-[11px] ${
            row.active ? "bg-[#0ECB81]/15" : "bg-[#1E2329]"
          }`}
          key={row.label}
        >
          <span className="font-bold text-[#707A8A]">{row.label}</span>
          <span className="text-right font-bold text-[#EAECEF]">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
