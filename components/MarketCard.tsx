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

function parseKnockoutMatchTitle(title: string) {
  const match = title.match(/^Will (.+?) eliminate (.+?) in the (Round of 32)\??$/i);

  if (!match) {
    return null;
  }

  const [, teamA, teamB, stage] = match;

  return { teamA, teamB, stage };
}

const ROUND_OF_32_MATCH_METADATA: Record<
  string,
  {
    kickoffTime: string;
    teamACountryCode: string;
    teamBCountryCode: string;
  }
> = {
  "Will Brazil eliminate Japan in the Round of 32?": {
    kickoffTime: "2026-06-29T17:00:00Z",
    teamACountryCode: "br",
    teamBCountryCode: "jp",
  },
  "Will Germany eliminate Paraguay in the Round of 32?": {
    kickoffTime: "2026-06-29T20:30:00Z",
    teamACountryCode: "de",
    teamBCountryCode: "py",
  },
  "Will Netherlands eliminate Morocco in the Round of 32?": {
    kickoffTime: "2026-06-30T01:00:00Z",
    teamACountryCode: "nl",
    teamBCountryCode: "ma",
  },
  "Will Ivory Coast eliminate Norway in the Round of 32?": {
    kickoffTime: "2026-06-30T17:00:00Z",
    teamACountryCode: "ci",
    teamBCountryCode: "no",
  },
  "Will France eliminate Sweden in the Round of 32?": {
    kickoffTime: "2026-06-30T21:00:00Z",
    teamACountryCode: "fr",
    teamBCountryCode: "se",
  },
  "Will Mexico eliminate Ecuador in the Round of 32?": {
    kickoffTime: "2026-07-01T01:00:00Z",
    teamACountryCode: "mx",
    teamBCountryCode: "ec",
  },
  "Will England eliminate DR Congo in the Round of 32?": {
    kickoffTime: "2026-07-01T16:00:00Z",
    teamACountryCode: "gb-eng",
    teamBCountryCode: "cd",
  },
  "Will Belgium eliminate Senegal in the Round of 32?": {
    kickoffTime: "2026-07-01T20:00:00Z",
    teamACountryCode: "be",
    teamBCountryCode: "sn",
  },
  "Will United States eliminate Bosnia and Herzegovina in the Round of 32?": {
    kickoffTime: "2026-07-02T00:00:00Z",
    teamACountryCode: "us",
    teamBCountryCode: "ba",
  },
  "Will Spain eliminate Austria in the Round of 32?": {
    kickoffTime: "2026-07-02T19:00:00Z",
    teamACountryCode: "es",
    teamBCountryCode: "at",
  },
  "Will Portugal eliminate Croatia in the Round of 32?": {
    kickoffTime: "2026-07-02T23:00:00Z",
    teamACountryCode: "pt",
    teamBCountryCode: "hr",
  },
  "Will Switzerland eliminate Algeria in the Round of 32?": {
    kickoffTime: "2026-07-03T03:00:00Z",
    teamACountryCode: "ch",
    teamBCountryCode: "dz",
  },
  "Will Australia eliminate Egypt in the Round of 32?": {
    kickoffTime: "2026-07-03T18:00:00Z",
    teamACountryCode: "au",
    teamBCountryCode: "eg",
  },
  "Will Argentina eliminate Cape Verde in the Round of 32?": {
    kickoffTime: "2026-07-03T22:00:00Z",
    teamACountryCode: "ar",
    teamBCountryCode: "cv",
  },
  "Will Colombia eliminate Ghana in the Round of 32?": {
    kickoffTime: "2026-07-04T01:30:00Z",
    teamACountryCode: "co",
    teamBCountryCode: "gh",
  },
};

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
  const knockoutMatch =
    market.category === "World Cup" ? getKnockoutMatchPresentation(market) : null;

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
        {knockoutMatch ? (
          <MatchupHeader match={knockoutMatch} />
        ) : (
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
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <OddsBlock
            label={knockoutMatch ? knockoutMatch.teamA : "YES"}
            value={yesPercent}
            tone="yes"
            interactive={false}
          />
          <OddsBlock
            label={knockoutMatch ? knockoutMatch.teamB : "NO"}
            value={noPercent}
            tone="no"
            interactive={false}
          />
        </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#EAECEF]">
          <span className="truncate font-semibold">{market.category}</span>
          <span className="shrink-0 text-[#707A8A]">
            {knockoutMatch?.kickoffLabel ?? "Preview"}
          </span>
        </div>
      </article>
    );
  }

  const content = (
    <article
      className="interactive-card interactive-card-clickable market-card-hover group flex min-h-[156px] flex-col justify-between rounded-xl border border-[#2B3139] bg-[#1E2329] p-3 text-[#EAECEF]"
    >
      {knockoutMatch ? (
        <MatchupHeader match={knockoutMatch} />
      ) : (
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
      )}

      <div className="mt-3">
        {isSettled && settlementOutcome ? (
          <SettledResult outcome={settlementOutcome} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <OddsBlock
              label={knockoutMatch ? knockoutMatch.teamA : "YES"}
              value={yesPercent}
              tone="yes"
              interactive
            />
            <OddsBlock
              label={knockoutMatch ? knockoutMatch.teamB : "NO"}
              value={noPercent}
              tone="no"
              interactive
            />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#EAECEF]">
        <span className="truncate font-semibold">{market.category}</span>
        <span className="shrink-0 text-[#707A8A]">
          {knockoutMatch?.kickoffLabel ?? (isSettled ? "Settled" : `${displayVolume} / ${oracleLabel}`)}
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

function MatchupHeader({
  match,
}: {
  match: {
    teamA: string;
    teamB: string;
    stage: string;
    teamAFlagCode?: string;
    teamBFlagCode?: string;
  };
}) {
  return (
    <div className="min-h-[60px] px-1 pt-0.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 text-[16px] font-black leading-snug text-[#EAECEF]">
        <div className="flex min-w-0 items-center gap-2.5">
          <FlagAvatar flagCode={match.teamAFlagCode} team={match.teamA} />
          <span className="truncate">{match.teamA}</span>
        </div>
        <div className="px-0.5 text-center">
          <div className="text-[10px] font-black uppercase text-[#707A8A]">vs</div>
          <div className="mt-1 whitespace-nowrap text-[11px] font-semibold normal-case text-[#707A8A]">
            {match.stage}
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2.5">
          <span className="truncate text-right">{match.teamB}</span>
          <FlagAvatar flagCode={match.teamBFlagCode} team={match.teamB} />
        </div>
      </div>
    </div>
  );
}

function getKnockoutMatchPresentation(market: MarketCardData) {
  const match = parseKnockoutMatchTitle(market.title);

  if (!match) {
    return null;
  }

  const metadata = ROUND_OF_32_MATCH_METADATA[market.title];
  const storedMetadata = market as MarketCardData & {
    kickoffTime?: string;
    homeCountryCode?: string;
    awayCountryCode?: string;
  };
  const kickoffTime = storedMetadata.kickoffTime ?? metadata?.kickoffTime;
  const teamACountryCode =
    storedMetadata.homeCountryCode ?? metadata?.teamACountryCode;
  const teamBCountryCode =
    storedMetadata.awayCountryCode ?? metadata?.teamBCountryCode;

  return {
    ...match,
    teamAFlagCode: normalizeFlagCode(teamACountryCode),
    teamBFlagCode: normalizeFlagCode(teamBCountryCode),
    kickoffLabel: formatUtcKickoff(kickoffTime),
  };
}

function normalizeFlagCode(countryCode?: string) {
  return countryCode?.trim().toLowerCase() || undefined;
}

function FlagAvatar({
  flagCode,
  team,
}: {
  flagCode?: string;
  team: string;
}) {
  const fallback = team
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2B3139] bg-[#0B0E11]">
      {flagCode ? (
        <img
          alt={`${team} flag`}
          className="h-full w-full object-cover"
          loading="lazy"
          src={`https://flagcdn.com/${flagCode}.svg`}
        />
      ) : (
        <span className="text-[10px] font-black text-[#EAECEF]">{fallback}</span>
      )}
    </span>
  );
}

function formatUtcKickoff(kickoffTime?: string) {
  if (!kickoffTime) {
    return "";
  }

  const date = new Date(kickoffTime);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const monthDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);

  return `${monthDay} \u00b7 ${time} UTC`;
}

function SettledResult({ outcome }: { outcome: string }) {
  const normalized = outcome.toUpperCase();
  const isYes = normalized === "YES";
  const isNo = normalized === "NO";
  const toneClass = isYes
    ? "border-[#0ECB81] bg-[#0ECB81]/15 text-[#BFFFE7]"
    : isNo
      ? "border-[#F6465D] bg-[#F6465D]/15 text-[#FFD7DD]"
      : "border-[#FF8A00] bg-[#FF8A00]/15 text-[#FF9D2E]";

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
  label: string;
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
      <div className="truncate text-xs font-black">{label === "YES" ? "Yes" : label === "NO" ? "No" : label}</div>
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
  const normalizedLabel = label.toLowerCase();
  const isArcLogo = imageSrc?.toLowerCase().includes("/brand/arc-logo.png");

  const shouldUseARCMLogo =
    !imageSrc &&
    (normalizedLabel === "as" ||
      normalizedLabel === "arcm" ||
      normalizedLabel.includes("arcm"));

  return (
    <div
      className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border text-xs font-black shadow-[inset_0_0_22px_rgba(255,255,255,0.04)] ${
        tone === "onchain"
          ? "border-[#3A424D] bg-[#0B0E11] text-[#FF8A00]"
          : "border-[#2B3139] bg-[#0B0E11] text-[#707A8A]"
      }`}
    >
      {!isArcLogo && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,138,0,0.16),transparent_46%)]" />
      )}

      {imageSrc ? (
        <img
          alt={alt ?? `${label} market`}
          className={`relative z-10 ${
            isArcLogo ? "h-full w-full object-cover" : "h-11 w-11 object-contain"
          }`}
          src={imageSrc}
        />
      ) : shouldUseARCMLogo ? (
        <img
          alt="ARCM"
          className="relative z-10 h-11 w-11 object-contain"
          src="/brand/ARCM-logo-orange.png"
        />
      ) : (
        <span className="relative z-10">{label.slice(0, 3)}</span>
      )}
    </div>
  );
}

