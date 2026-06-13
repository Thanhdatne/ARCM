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

import { useEffect, useRef, useState } from "react";
import { useMarketState, useTokenBalances, useOracleState } from "@/hooks/useMarket";
import { useAMMState } from "@/hooks/useAMM";
import { useWallet } from "@/contexts/WalletContext";
import { formatCollateral, oracleStateLabel } from "@/hooks/market/helpers";
import { OracleState } from "@/lib/contracts";
import { MarketHeader } from "./MarketHeader";
import { MarketStatusSection } from "./MarketStatusSection";
import { ProbabilityBar } from "./ProbabilityBar";
import { PortfolioSection } from "./PortfolioSection";
import { Activity, CalendarClock, Database, Gauge, Landmark, ShieldCheck, Users } from "lucide-react";

export function MarketDetail() {
  const {
    pairName,
    question,
    priceRequested,
    receivedSettlementPrice,
    settlementPrice,
    longTokenAddress,
    shortTokenAddress,
    priceIdentifier,
    requestTimestamp,
    ancillaryDataHex,
    livenessTime,
    isLoading,
  } = useMarketState();
  const { address } = useWallet();
  const { arctBalance, longBalance, shortBalance } =
    useTokenBalances(longTokenAddress, shortTokenAddress);

  const {
    yesPrice,
    noPrice,
    reserveYes,
    reserveNo,
    feeBps,
    dataUpdatedAt,
    initialized: ammInitialized,
    isLoading: isAMMLoading,
  } = useAMMState();

  const { oracleState, expirationTime } = useOracleState(priceIdentifier, requestTimestamp, ancillaryDataHex);

  if (isLoading || isAMMLoading) {
    return (
      <div className="exchange-panel p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-[#1E2329]" />
          <div className="h-4 w-full bg-[#1E2329]" />
          <div className="h-4 w-3/4 bg-[#1E2329]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MarketHeader
        pairName={pairName}
        question={question}
        priceRequested={priceRequested}
        receivedSettlementPrice={receivedSettlementPrice}
        settlementPrice={settlementPrice}
      />

      <MarketStatusSection
        oracleState={oracleState}
        priceRequested={priceRequested}
        receivedSettlementPrice={receivedSettlementPrice}
        expirationTime={expirationTime}
      />

      <ProbabilityBar
        yesPrice={yesPrice}
        noPrice={noPrice}
        ammInitialized={ammInitialized}
        receivedSettlementPrice={receivedSettlementPrice}
      />

      <AmmPriceChart
        yesPrice={yesPrice}
        noPrice={noPrice}
        ammInitialized={ammInitialized}
        dataUpdatedAt={dataUpdatedAt}
      />

      <MarketStatsPanel
        reserveYes={reserveYes}
        reserveNo={reserveNo}
        requestTimestamp={requestTimestamp}
        feeBps={feeBps}
      />

      {address && (
        <PortfolioSection
          arctBalance={arctBalance}
          longBalance={longBalance}
          shortBalance={shortBalance}
          yesPrice={yesPrice}
          noPrice={noPrice}
        />
      )}

      <SettlementRulesPanel />

      <LifecyclePanel
        ammInitialized={ammInitialized}
        priceRequested={priceRequested}
        receivedSettlementPrice={receivedSettlementPrice}
        oracleState={oracleState}
        livenessTime={livenessTime}
      />
    </div>
  );
}

interface ChartPoint {
  at: number;
  yes: number;
  no: number;
}

function AmmPriceChart({
  yesPrice,
  noPrice,
  ammInitialized,
  dataUpdatedAt,
}: {
  yesPrice: number | undefined;
  noPrice: number | undefined;
  ammInitialized: boolean | undefined;
  dataUpdatedAt: number | undefined;
}) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const lastPointKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ammInitialized || yesPrice === undefined || noPrice === undefined || dataUpdatedAt === undefined) return;

    const key = `${dataUpdatedAt}:${yesPrice}:${noPrice}`;
    if (lastPointKey.current === key) return;
    lastPointKey.current = key;

    setPoints((current) => [
      ...current.slice(-59),
      {
        at: dataUpdatedAt || Date.now(),
        yes: yesPrice,
        no: noPrice,
      },
    ]);
  }, [ammInitialized, dataUpdatedAt, yesPrice, noPrice]);

  const currentYes = points.at(-1)?.yes ?? yesPrice;
  const currentNo = points.at(-1)?.no ?? noPrice;
  const hasLine = points.length > 1;
  const yesPath = hasLine ? buildPath(points, "yes") : "";
  const noPath = hasLine ? buildPath(points, "no") : "";
  const firstPoint = points[0]?.at;
  const lastPoint = points.at(-1)?.at;

  return (
    <div className="exchange-panel">
      <div className="terminal-titlebar flex flex-col gap-1 px-3 py-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold">
            AMM Price Chart
          </h2>
          <p className="text-xs text-[#E0F7FF]">
            Session movement from live AMM reads.
          </p>
        </div>
        <span className="rounded border border-[#2B3139] bg-[#1E2329] px-2 py-1 text-xs font-bold text-[#EAECEF]">
          Session chart only - no historical indexer yet.
        </span>
      </div>

      <div className="p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap gap-3">
            <span className="font-bold text-[#0ECB81]">YES {currentYes !== undefined ? `${Math.round(currentYes)}%` : "--"}</span>
            <span className="font-bold text-[#F6465D]">NO {currentNo !== undefined ? `${Math.round(currentNo)}%` : "--"}</span>
          </div>
          <span className="text-[#707A8A]">
            {lastPoint ? `Last read ${new Date(lastPoint).toLocaleTimeString()}` : "Waiting for AMM read"}
          </span>
        </div>

        <div className="terminal-card bg-[#0B1220] p-2.5">
          <div className="grid grid-cols-[32px_1fr] gap-2">
            <div className="flex h-40 flex-col justify-between text-right font-mono text-[10px] font-bold text-[#707A8A]">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            <div className="relative h-40 rounded-lg border border-[#2B3139] bg-[#0B0E11]">
              <div className="absolute inset-0 bg-[linear-gradient(#1E2329_1px,transparent_1px),linear-gradient(90deg,#1E2329_1px,transparent_1px)] bg-[size:100%_25%,12.5%_100%]" />
              {hasLine ? (
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Session AMM price movement">
                  <polyline
                    fill="none"
                    points={yesPath}
                    stroke="#0ECB81"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    fill="none"
                    points={noPath}
                    stroke="#F6465D"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-bold text-[#707A8A]">
                  Chart will update as AMM prices change during this session.
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-[#707A8A]">
            <span>{firstPoint ? new Date(firstPoint).toLocaleTimeString() : "Session start"}</span>
            <span>{points.length} live AMM read{points.length === 1 ? "" : "s"}</span>
            <span>{lastPoint ? new Date(lastPoint).toLocaleTimeString() : "Latest"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildPath(points: ChartPoint[], key: "yes" | "no") {
  const denominator = Math.max(points.length - 1, 1);

  return points
    .map((point, index) => {
      const x = (index / denominator) * 100;
      const y = 100 - clamp(point[key], 0, 100);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function MarketStatsPanel({
  reserveYes,
  reserveNo,
  requestTimestamp,
  feeBps,
}: {
  reserveYes: bigint | undefined;
  reserveNo: bigint | undefined;
  requestTimestamp: bigint | undefined;
  feeBps: bigint | undefined;
}) {
  const liquidity =
    reserveYes !== undefined && reserveNo !== undefined
      ? `${formatCollateral(reserveYes + reserveNo)} ARCT`
      : "Pending AMM";
  const closeDate = requestTimestamp
    ? new Date(Number(requestTimestamp) * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    : "Oracle schedule";
  const feeLabel = feeBps !== undefined ? `${Number(feeBps) / 100}% fee` : "AMM fee";

  const stats = [
    { label: "Volume", value: liquidity, icon: Activity },
    { label: "Liquidity", value: liquidity, icon: Landmark },
    { label: "Participants", value: "Public wallets", icon: Users },
    { label: "Close date", value: closeDate, icon: CalendarClock },
    { label: "Collateral", value: "ARCT test collateral", icon: Database },
    { label: "Oracle", value: `UMA OO V2 / ${feeLabel}`, icon: Gauge },
  ];

  return (
    <div className="exchange-panel">
      <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">
        Market stats
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="terminal-card p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-[#707A8A]">
                <Icon className="h-3.5 w-3.5 text-[#FCD535]" />
                {stat.label}
              </div>
              <p className="text-sm font-bold text-[#EAECEF]">{stat.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettlementRulesPanel() {
  const rules = [
    ["Settlement source", "UMA Optimistic Oracle V2"],
    ["Collateral", "ARCT test collateral"],
    ["Gas", "Arc Testnet USDC"],
    ["Privacy", "Preview UX only. Positions are public today."],
  ];

  return (
    <div className="exchange-panel">
      <div className="terminal-titlebar flex items-center gap-2 px-3 py-1.5">
        <ShieldCheck className="h-4 w-4 text-[#E0F7FF]" />
        <h2 className="text-sm font-bold">
          Settlement rules
        </h2>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {rules.map(([label, value]) => (
          <div key={label} className="terminal-card p-3">
            <p className="text-xs text-[#707A8A]">{label}</p>
            <p className="mt-1 text-sm font-semibold text-[#EAECEF]">{value}</p>
          </div>
        ))}
      </div>
      <div className="terminal-card mx-3 mb-3 p-3 text-xs leading-5 text-[#707A8A]">
        Privacy Preview is a UI narrative only in this phase. ArcSignal trades and positions remain public on Arc Testnet.
      </div>
    </div>
  );
}

function LifecyclePanel({
  ammInitialized,
  priceRequested,
  receivedSettlementPrice,
  oracleState,
  livenessTime,
}: {
  ammInitialized: boolean | undefined;
  priceRequested: boolean | undefined;
  receivedSettlementPrice: boolean | undefined;
  oracleState: OracleState | undefined;
  livenessTime: bigint | undefined;
}) {
  const resolving =
    oracleState === OracleState.Requested ||
    oracleState === OracleState.Proposed ||
    oracleState === OracleState.Expired ||
    oracleState === OracleState.Resolved ||
    oracleState === OracleState.Disputed;
  const steps = [
    { label: "Created", active: true },
    { label: "Open", active: !!priceRequested || !!ammInitialized },
    { label: "Trading", active: !!ammInitialized && !receivedSettlementPrice },
    { label: "Resolving", active: resolving && !receivedSettlementPrice },
    { label: "Settled", active: !!receivedSettlementPrice || oracleState === OracleState.Settled },
  ];

  return (
    <div className="exchange-panel">
      <div className="terminal-titlebar flex flex-col gap-1 px-3 py-1.5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-bold">
          Activity lifecycle
        </h2>
        <span className="text-xs text-[#E0F7FF]">
          Oracle state: {oracleStateLabel(oracleState, { priceRequested: !!priceRequested })}
          {livenessTime !== undefined ? ` / ${Number(livenessTime)}s liveness` : ""}
        </span>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-5">
        {steps.map((step) => (
          <div
            key={step.label}
            className={`p-3 text-center ${step.active
                ? "terminal-card text-[#FCD535]"
                : "terminal-surface text-[#707A8A]"
              }`}
          >
            <div className={`mx-auto mb-2 h-2 w-2 ${step.active ? "bg-[#0ECB81]" : "bg-[#2B3139]"}`} />
            <p className="text-xs font-bold">{step.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
