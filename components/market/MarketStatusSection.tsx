/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useEffect, useState } from "react";
import { OracleState } from "@/lib/contracts";

interface MarketStatusSectionProps {
  oracleState: OracleState | undefined;
  priceRequested: boolean | undefined;
  receivedSettlementPrice: boolean | undefined;
  expirationTime: bigint | undefined;
}

type StatusTone = "neutral" | "warning" | "success" | "danger";

function getStatusCopy({
  displayState,
  priceRequested,
  receivedSettlementPrice,
}: {
  displayState: OracleState | undefined;
  priceRequested: boolean | undefined;
  receivedSettlementPrice: boolean | undefined;
}): {
  title: string;
  description: string;
  tone: StatusTone;
} {
  if (receivedSettlementPrice) {
    return {
      title: "Market settled",
      description: "The final result is onchain. Winning positions can be claimed from Claims.",
      tone: "success",
    };
  }

  if (!priceRequested) {
    return {
      title: "Not ready for resolution",
      description: "This market has not requested a resolution from the oracle yet.",
      tone: "neutral",
    };
  }

  switch (displayState) {
    case OracleState.Requested:
      return {
        title: "Waiting for final result",
        description: "Trading is open. A resolution can be proposed after the real-world event ends.",
        tone: "warning",
      };
    case OracleState.Proposed:
      return {
        title: "Result proposed",
        description: "A result has been proposed. It can still be disputed until the liveness window ends.",
        tone: "warning",
      };
    case OracleState.Expired:
    case OracleState.Resolved:
      return {
        title: "Ready to settle",
        description: "The dispute window has ended. Settlement can finalize the market result.",
        tone: "success",
      };
    case OracleState.Disputed:
      return {
        title: "Result disputed",
        description: "The proposed result was disputed and is waiting for oracle arbitration.",
        tone: "danger",
      };
    case OracleState.Invalid:
      return {
        title: "Resolution needs review",
        description: "The previous resolution flow needs another proposal before this market can settle.",
        tone: "danger",
      };
    default:
      return {
        title: "Resolution pending",
        description: "The market is open and waiting for the next settlement step.",
        tone: "neutral",
      };
  }
}

function toneClasses(tone: StatusTone) {
  switch (tone) {
    case "success":
      return {
        dot: "bg-[#0ECB81]",
        title: "text-[#BFFFE7]",
        border: "border-[#0ECB81]/40 bg-[#0ECB81]/10",
      };
    case "warning":
      return {
        dot: "bg-[#FCD535]",
        title: "text-[#FFF3AF]",
        border: "border-[#FCD535]/40 bg-[#FCD535]/10",
      };
    case "danger":
      return {
        dot: "bg-[#F6465D]",
        title: "text-[#FFD7DD]",
        border: "border-[#F6465D]/40 bg-[#F6465D]/10",
      };
    case "neutral":
      return {
        dot: "bg-[#707A8A]",
        title: "text-[#EAECEF]",
        border: "border-[#2B3139] bg-[#1E2329]",
      };
  }
}

export function MarketStatusSection({
  oracleState,
  priceRequested,
  receivedSettlementPrice,
  expirationTime,
}: MarketStatusSectionProps) {
  const [now, setNow] = useState<number | null>(null);
  const [disputeSticky, setDisputeSticky] = useState(false);

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));

    const interval = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (oracleState === OracleState.Disputed) setDisputeSticky(true);
  }, [oracleState]);

  const displayState =
    disputeSticky &&
    oracleState !== OracleState.Proposed &&
    oracleState !== OracleState.Expired &&
    oracleState !== OracleState.Resolved &&
    oracleState !== OracleState.Settled
      ? OracleState.Disputed
      : oracleState;

  if (!priceRequested || receivedSettlementPrice || displayState === undefined) {
    return null;
  }

  const status = getStatusCopy({
    displayState,
    priceRequested,
    receivedSettlementPrice,
  });
  const tone = toneClasses(status.tone);
  const expirationSeconds =
    expirationTime !== undefined && now !== null ? Number(expirationTime) - now : undefined;
  const showCountdown =
    displayState === OracleState.Proposed && expirationSeconds !== undefined && expirationSeconds > 0;

  return (
    <section className={`rounded-xl border p-4 ${tone.border}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
          <div className="min-w-0">
            <h2 className={`text-sm font-black ${tone.title}`}>{status.title}</h2>
            <p className="mt-1 text-xs leading-5 text-[#707A8A]">{status.description}</p>
          </div>
        </div>

        {showCountdown ? (
          <div className="shrink-0 rounded-lg border border-[#FCD535]/40 bg-[#0B0E11] px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#707A8A]">
              Dispute window
            </p>
            <p className="mt-0.5 font-mono text-sm font-black text-[#FCD535]">
              {Math.floor(expirationSeconds / 3600) > 0 ? `${Math.floor(expirationSeconds / 3600)}h ` : ""}
              {Math.floor((expirationSeconds % 3600) / 60)}m {expirationSeconds % 60}s
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
