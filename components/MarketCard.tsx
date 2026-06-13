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

import Link from "next/link";
import type { MarketCardData } from "@/lib/markets";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketCardData } from "@/hooks/useMarket";
import { type Address } from "viem";

export function MarketCard({
  market,
}: {
  market: MarketCardData;
  featured?: boolean;
}) {
  const { status, volume, settlementOutcome, ammYesPrice, isLoading } = useMarketCardData(
    market.address as Address,
    market.ammAddress as Address | undefined,
    !!market.isReal,
  );

  const isSettled = market.isReal && status === "Settled";
  const hasAmmPrice = market.isReal && ammYesPrice !== undefined;
  const yesPercent = hasAmmPrice
    ? Math.round(ammYesPrice * 100)
    : !market.isReal
      ? Math.round(market.yesPrice * 100)
      : null;
  const noPercent = yesPercent !== null ? 100 - yesPercent : null;
  const displayVolume = market.isReal ? (volume ?? "-") : "Preview";
  const oracleLabel = isSettled ? "Settled" : status === "Active" ? "UMA live" : "Pending";

  if (market.isReal && isLoading) {
    return (
      <div className="rounded-xl border border-[#2B3139] bg-[#1E2329] p-3">
        <Skeleton className="mb-3 h-14 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  if (!market.isReal) {
    return (
      <article className="interactive-card interactive-card-static market-card-hover flex min-h-[156px] flex-col justify-between rounded-xl border border-[#2B3139] bg-[#1E2329] p-3 text-[#EAECEF] opacity-80">
        <div className="flex min-h-[56px] gap-3">
          <Thumbnail
            alt={market.imageAlt}
            imageSrc={market.imageSrc}
            label={market.icon}
            tone="preview"
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 pt-0.5 text-[15px] font-bold leading-snug text-[#EAECEF]">
              {market.title}
            </h3>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <OddsBlock label="YES" value={yesPercent} tone="yes" interactive={false} />
          <OddsBlock label="NO" value={noPercent} tone="no" interactive={false} />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#EAECEF]">
          <span className="truncate font-semibold">{market.category}</span>
          <span className="shrink-0 text-[#707A8A]">Preview</span>
        </div>
      </article>
    );
  }

  const content = (
    <article
      className="interactive-card interactive-card-clickable market-card-hover group flex min-h-[156px] flex-col justify-between rounded-xl border border-[#2B3139] bg-[#1E2329] p-3 text-[#EAECEF]"
    >
      <div className="flex min-h-[56px] gap-3">
        <Thumbnail
          alt={market.imageAlt}
          imageSrc={market.imageSrc}
          label={market.icon}
          tone="onchain"
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 pt-0.5 text-[15px] font-bold leading-snug text-[#EAECEF]">{market.title}</h3>
        </div>
      </div>

      <div className="mt-3">
        {isSettled && settlementOutcome ? (
          <SettledResult outcome={settlementOutcome} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <OddsBlock label="YES" value={yesPercent} tone="yes" interactive />
            <OddsBlock label="NO" value={noPercent} tone="no" interactive />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#EAECEF]">
        <span className="truncate font-semibold">{market.category}</span>
        <span className="shrink-0 text-[#707A8A]">
          {isSettled ? "Settled" : `${displayVolume} / ${oracleLabel}`}
        </span>
      </div>
    </article>
  );

  return (
    <Link href={`/market/${market.address}`} className="block">
      {content}
    </Link>
  );
}

function SettledResult({ outcome }: { outcome: string }) {
  const normalized = outcome.toUpperCase();
  const isYes = normalized === "YES";
  const isNo = normalized === "NO";
  const toneClass = isYes
    ? "border-[#0ECB81] bg-[#0ECB81]/15 text-[#BFFFE7]"
    : isNo
      ? "border-[#F6465D] bg-[#F6465D]/15 text-[#FFD7DD]"
      : "border-[#FCD535] bg-[#FCD535]/15 text-[#FFF3AF]";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.04em]">Settled</p>
      <p className="mt-0.5 text-lg font-black">{outcome}</p>
    </div>
  );
}

function OddsBlock({
  label,
  value,
  tone,
  interactive,
}: {
  label: "YES" | "NO";
  value: number | null;
  tone: "yes" | "no";
  interactive: boolean;
}) {
  const toneClass = tone === "yes" ? "market-action-yes" : "market-action-no";

  return (
    <div
      className={`${toneClass} rounded-lg px-3 py-2.5 text-center ${
        interactive ? "market-action-interactive" : "market-action-display"
      }`}
    >
      <div className="text-xs font-black">{label === "YES" ? "Yes" : "No"}</div>
      <div className="mt-0.5 font-mono text-xl font-black leading-none">
        {value !== null ? `${value}%` : "--"}
      </div>
    </div>
  );
}

function Thumbnail({
  alt,
  imageSrc,
  label,
  tone,
}: {
  alt?: string;
  imageSrc?: string;
  label: string;
  tone: "onchain" | "preview";
}) {
  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border text-xs font-black ${
        tone === "onchain"
          ? "border-[#2B3139] bg-[#2B3139] text-[#FCD535]"
          : "border-[#2B3139] bg-[#2B3139] text-[#707A8A]"
      }`}
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={alt ?? `${label} market`}
          className="h-full w-full object-cover"
          src={imageSrc}
        />
      ) : (
        label.slice(0, 3)
      )}
    </div>
  );
}
