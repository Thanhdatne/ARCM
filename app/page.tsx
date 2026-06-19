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

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type Address } from "viem";
import { MarketCard } from "@/components/MarketCard";
import { MarketAddressProvider } from "@/contexts/MarketAddressContext";
import { useWallet } from "@/contexts/WalletContext";
import { useMarketState, useOracleState, useTokenBalances } from "@/hooks/useMarket";
import { formatCollateral, oracleStateLabel } from "@/hooks/market/helpers";
import { OracleState } from "@/lib/contracts";
import {
  MARKETS,
  ZERO_ADDRESS,
  dynamicToCardData,
  type DynamicMarket,
  type MarketCardData,
} from "@/lib/markets";
import {
  WORLD_CUP_GROUP_FILTERS,
  WORLD_CUP_FIXTURES,
  WORLD_CUP_MARKETS,
  type WorldCupGroup,
  type WorldCupMarket,
} from "@/src/lib/worldCupMarkets";
import {
  calculateFixtureResult,
  calculateSuggestedResult,
  canUpdateFixtureResult,
  formatFixtureScore,
  type WorldCupResultRecord,
  type WorldCupResultStatus,
} from "@/src/lib/worldCupResults";
import { PlusCircle } from "lucide-react";

const categories = ["All", "Trending", "World Cup", "Arc", "Crypto", "Stablecoins", "AI", "Macro", "RWA", "Privacy"] as const;
const filters = ["Featured", "Newest", "Volume", "Open"] as const;

type CategoryFilter = (typeof categories)[number];
type MarketViewFilter = (typeof filters)[number];
const adminMarketCreateEnabled = process.env.NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE === "true";
const adminResultOverrideEnabled = process.env.NEXT_PUBLIC_ENABLE_ADMIN_RESULT_OVERRIDE === "true";
const hideLegacyV1 = process.env.NEXT_PUBLIC_HIDE_LEGACY_V1 === "true";
const ONE = 1000000000000000000n;
const arcScanBaseUrl = "https://testnet.arcscan.app";

const WORLD_CUP_DEPLOY_COOLDOWN_MS = 20_000;
const WORLD_CUP_DEPLOY_RETRY_DELAY_MS = 45_000;

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

type BulkDeployStatus = {
  state: "pending" | "success" | "failed" | "skipped";
  message?: string;
};

interface WorldCupDeployment {
  worldCupMarketId: string;
  fixtureId: string;
  group: string;
  question: string;
  outcomeType: string;
  marketAddress: string;
  ammAddress: string;
  createdAt: string;
  txHash?: string;
  transactionHash?: string;
  contractVersion?: number;
  collateralAddress?: string;
  collateralSymbol?: string;
  collateralDecimals?: number;
  outcomeDecimals?: number;
}

type SettlementFilter = "All" | "Open" | "Resolved" | "Settled" | "Claimable";

const settlementFilters: SettlementFilter[] = ["All", "Open", "Resolved", "Settled", "Claimable"];

function isConfiguredOnchainMarket(market: MarketCardData) {
  return (
    !!market.isReal &&
    market.address !== ZERO_ADDRESS &&
    market.ammAddress !== undefined &&
    market.ammAddress !== ZERO_ADDRESS
  );
}

type FilterableMarket = MarketCardData & {
  createdAt?: string | number;
  featured?: boolean;
  group?: string;
  isSettled?: boolean;
  settled?: boolean;
  status?: string;
  trending?: boolean;
  volumeLabel?: string;
  volumeValue?: number;
};

type WorldCupFixtureOutcomeOption = {
  outcomeType: WorldCupMarket["outcomeType"];
  label: string;
  probability: number;
  marketAddress: string;
  ammAddress: string;
  market: WorldCupMarket;
};

type WorldCupFixtureCardData = {
  fixtureId: string;
  category: string;
  group: WorldCupGroup;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  imageSrc?: string;
  imageAlt?: string;
  isCompleted: boolean;
  options: WorldCupFixtureOutcomeOption[];
};

function normalizeMarketText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function getMarketCategory(market: MarketCardData) {
  const category = (market as FilterableMarket).category;
  return category && category.trim().length > 0 ? category.trim() : "Arc";
}

function isMarketFeatured(market: MarketCardData) {
  const filterable = market as FilterableMarket;
  return filterable.featured === true || filterable.trending === true;
}

function isMarketSettled(market: MarketCardData) {
  const filterable = market as FilterableMarket;
  const status = normalizeMarketText(filterable.status);

  return (
    filterable.settled === true ||
    filterable.isSettled === true ||
    status === "settled" ||
    status === "closed" ||
    status === "claimed"
  );
}

function getMarketVolumeScore(market: MarketCardData) {
  const filterable = market as FilterableMarket;
  const rawVolume = filterable.volumeValue ?? filterable.volume;

  if (typeof rawVolume === "number") return rawVolume;
  if (typeof rawVolume === "bigint") return Number(rawVolume);
  if (typeof rawVolume === "string") {
    const parsed = Number(rawVolume.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getMarketCreatedAtScore(market: MarketCardData) {
  const createdAt = (market as FilterableMarket).createdAt;
  if (!createdAt) return 0;

  if (typeof createdAt === "number") return createdAt;

  const parsed = new Date(createdAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function marketMatchesCategory(market: MarketCardData, activeCategory: CategoryFilter) {
  if (activeCategory === "All") return true;
  if (activeCategory === "Trending") return isMarketFeatured(market);

  return normalizeMarketText(getMarketCategory(market)) === normalizeMarketText(activeCategory);
}

function marketMatchesViewFilter(
  market: MarketCardData,
  activeFilter: MarketViewFilter,
  currentCategoryMarkets: MarketCardData[],
) {
  if (activeFilter === "Featured") {
    const hasFeaturedMarkets = currentCategoryMarkets.some(isMarketFeatured);
    return hasFeaturedMarkets ? isMarketFeatured(market) : true;
  }

  if (activeFilter === "Open") return !isMarketSettled(market);

  return true;
}

function sortMarketsByViewFilter(a: MarketCardData, b: MarketCardData, activeFilter: MarketViewFilter) {
  if (activeFilter === "Newest") {
    return getMarketCreatedAtScore(b) - getMarketCreatedAtScore(a);
  }

  if (activeFilter === "Volume") {
    return getMarketVolumeScore(b) - getMarketVolumeScore(a);
  }

  return 0;
}

function marketMatchesSearch(market: MarketCardData, rawQuery: string) {
  const query = normalizeMarketText(rawQuery);
  if (!query) return true;

  const filterable = market as FilterableMarket;
  const searchableText = [
    market.id,
    market.title,
    market.category,
    market.icon,
    market.address,
    market.ammAddress,
    filterable.group,
    filterable.status,
    filterable.volumeLabel,
    market.volume === undefined ? "" : String(market.volume),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

function getWorldCupOutcomeLabel(market: WorldCupMarket) {
  switch (market.outcomeType) {
    case "home_win":
      return market.homeTeam;
    case "draw":
      return "Draw";
    case "away_win":
      return market.awayTeam;
  }
}

function normalizeFixtureProbabilities(markets: WorldCupMarket[]) {
  const rawValues = markets.map((market) => market.externalYesPrice ?? 0.5);
  const total = rawValues.reduce((sum, value) => sum + value, 0);

  if (!Number.isFinite(total) || total <= 0) {
    return rawValues.map(() => 1 / Math.max(rawValues.length, 1));
  }

  return rawValues.map((value) => value / total);
}

function buildWorldCupFixtureCards(
  markets: WorldCupMarket[],
  resultsByFixture: Record<string, WorldCupResultRecord>,
) {
  const grouped = markets.reduce<Record<string, WorldCupMarket[]>>((acc, market) => {
    acc[market.fixtureId] = [...(acc[market.fixtureId] ?? []), market];
    return acc;
  }, {});

  const outcomeOrder: WorldCupMarket["outcomeType"][] = ["home_win", "draw", "away_win"];

  return Object.values(grouped)
    .map<WorldCupFixtureCardData | null>((fixtureMarkets) => {
      const orderedMarkets = outcomeOrder
        .map((outcomeType) => fixtureMarkets.find((market) => market.outcomeType === outcomeType))
        .filter((market): market is WorldCupMarket => Boolean(market));

      if (orderedMarkets.length !== 3) return null;
      if (orderedMarkets.some((market) => !market.marketAddress || !market.ammAddress)) return null;

      const fixtureLead = orderedMarkets[0];
      const result = resultsByFixture[fixtureLead.fixtureId];
      const isCompleted = isWorldCupResultClosed(result);
      const normalizedProbabilities = normalizeFixtureProbabilities(orderedMarkets);

      return {
        fixtureId: fixtureLead.fixtureId,
        category: fixtureLead.category,
        group: fixtureLead.group,
        homeTeam: fixtureLead.homeTeam,
        awayTeam: fixtureLead.awayTeam,
        kickoffTime: fixtureLead.kickoffTime,
        imageSrc: fixtureLead.imageSrc,
        imageAlt: fixtureLead.imageAlt,
        isCompleted,
        options: orderedMarkets.map((market, index) => ({
          outcomeType: market.outcomeType,
          label: getWorldCupOutcomeLabel(market),
          probability: normalizedProbabilities[index] ?? 0,
          marketAddress: market.marketAddress!,
          ammAddress: market.ammAddress!,
          market,
        })),
      };
    })
    .filter((fixture): fixture is WorldCupFixtureCardData => Boolean(fixture));
}

function fixtureMatchesCategory(fixture: WorldCupFixtureCardData, activeCategory: CategoryFilter) {
  if (activeCategory === "All") return true;
  if (activeCategory === "Trending") return true;

  return normalizeMarketText(fixture.category) === normalizeMarketText(activeCategory);
}

function fixtureMatchesViewFilter(activeFilter: MarketViewFilter) {
  return activeFilter === "Featured" || activeFilter === "Newest" || activeFilter === "Volume" || activeFilter === "Open";
}

function fixtureMatchesSearch(fixture: WorldCupFixtureCardData, rawQuery: string) {
  const query = normalizeMarketText(rawQuery);
  if (!query) return true;

  const searchableText = [
    fixture.fixtureId,
    fixture.category,
    fixture.group,
    fixture.homeTeam,
    fixture.awayTeam,
    ...fixture.options.map((option) => option.label),
    ...fixture.options.map((option) => option.marketAddress),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

function formatFixtureProbability(probability: number) {
  return `${Math.max(0, Math.round(probability * 100))}%`;
}

function getFixtureKickoffScore(fixture: WorldCupFixtureCardData) {
  const parsed = new Date(fixture.kickoffTime).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortFixturesByKickoff(fixtures: WorldCupFixtureCardData[]) {
  return [...fixtures].sort((a, b) => getFixtureKickoffScore(a) - getFixtureKickoffScore(b));
}

function getFixtureDateKey(kickoffTime: string) {
  const parsed = new Date(kickoffTime);
  if (Number.isNaN(parsed.getTime())) return "unknown";

  return parsed.toISOString().slice(0, 10);
}

function formatFixtureDateHeading(kickoffTime: string) {
  const parsed = new Date(kickoffTime);
  if (Number.isNaN(parsed.getTime())) return "Date TBA";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
    year: "numeric",
  }).format(parsed);
}

function formatFixtureKickoffTime(kickoffTime: string) {
  const parsed = new Date(kickoffTime);
  if (Number.isNaN(parsed.getTime())) return "Time TBA";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(parsed);
}

function formatFixtureCardDate(kickoffTime: string) {
  const parsed = new Date(kickoffTime);
  if (Number.isNaN(parsed.getTime())) return "Date TBA";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  }).format(parsed);
}

function groupFixturesByDate(fixtures: WorldCupFixtureCardData[]) {
  return sortFixturesByKickoff(fixtures).reduce<Array<{
    dateKey: string;
    dateLabel: string;
    fixtures: WorldCupFixtureCardData[];
  }>>((groups, fixture) => {
    const dateKey = getFixtureDateKey(fixture.kickoffTime);
    const existingGroup = groups.find((group) => group.dateKey === dateKey);

    if (existingGroup) {
      existingGroup.fixtures.push(fixture);
      return groups;
    }

    groups.push({
      dateKey,
      dateLabel: formatFixtureDateHeading(fixture.kickoffTime),
      fixtures: [fixture],
    });

    return groups;
  }, []);
}

function getWorldCupKickoffMs(kickoffTime: string) {
  const parsed = new Date(kickoffTime).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function hasWorldCupFixtureStarted(kickoffTime: string, nowMs: number | null) {
  if (nowMs === null) return false;

  const kickoffMs = getWorldCupKickoffMs(kickoffTime);
  return kickoffMs !== null && kickoffMs <= nowMs;
}

function isWorldCupResultClosed(result?: WorldCupResultRecord) {
  return result?.status === "final" || result?.status === "cancelled";
}

function getWorldCupDeployBlockReason(
  market: WorldCupMarket,
  resultsByFixture: Record<string, WorldCupResultRecord>,
  nowMs: number | null,
) {
  if (market.marketAddress && market.ammAddress) return "Already deployed";
  if (isWorldCupResultClosed(resultsByFixture[market.fixtureId])) return "Fixture completed";
  if (hasWorldCupFixtureStarted(market.kickoffTime, nowMs)) return "Fixture already started";

  return null;
}


const countryFlagCodes: Record<string, string> = {
  "Algeria": "dz",
  "Argentina": "ar",
  "Australia": "au",
  "Austria": "at",
  "Belgium": "be",
  "Bosnia and Herzegovina": "ba",
  "Bosnia": "ba",
  "Brazil": "br",
  "Cameroon": "cm",
  "Canada": "ca",
  "Cape Verde": "cv",
  "Chile": "cl",
  "Colombia": "co",
  "Costa Rica": "cr",
  "Croatia": "hr",
  "Curacao": "cw",
  "Czech Republic": "cz",
  "Czechia": "cz",
  "DR Congo": "cd",
  "D.R. Congo": "cd",
  "Democratic Republic of the Congo": "cd",
  "Denmark": "dk",
  "Ecuador": "ec",
  "Egypt": "eg",
  "England": "gb-eng",
  "France": "fr",
  "Germany": "de",
  "Ghana": "gh",
  "Haiti": "ht",
  "Iran": "ir",
  "Iraq": "iq",
  "Italy": "it",
  "Ivory Coast": "ci",
  "Cote d'Ivoire": "ci",
  "Jamaica": "jm",
  "Japan": "jp",
  "Jordan": "jo",
  "South Korea": "kr",
  "Mexico": "mx",
  "Morocco": "ma",
  "Netherlands": "nl",
  "New Zealand": "nz",
  "Nigeria": "ng",
  "Norway": "no",
  "Panama": "pa",
  "Paraguay": "py",
  "Peru": "pe",
  "Poland": "pl",
  "Portugal": "pt",
  "Qatar": "qa",
  "Saudi Arabia": "sa",
  "Scotland": "gb-sct",
  "Senegal": "sn",
  "Serbia": "rs",
  "South Africa": "za",
  "Spain": "es",
  "Sweden": "se",
  "Switzerland": "ch",
  "Tunisia": "tn",
  "Turkey": "tr",
  "Turkiye": "tr",
  "Ukraine": "ua",
  "United States": "us",
  "USA": "us",
  "Uruguay": "uy",
  "Uzbekistan": "uz",
  "Wales": "gb-wls",
};

function normalizeCountryName(team: string) {
  return team
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?!.]+$/g, "");
}

function getCountryFlagCode(team: string) {
  const normalized = normalizeCountryName(team);
  const direct = countryFlagCodes[normalized];

  if (direct) return direct;

  const normalizedKey = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, "")
    .toLowerCase();

  const aliasMap: Record<string, string> = {
    "algeria": "dz",
    "argentina": "ar",
    "australia": "au",
    "austria": "at",
    "belgium": "be",
    "bosnia and herzegovina": "ba",
    "bosnia": "ba",
    "brazil": "br",
    "canada": "ca",
    "cape verde": "cv",
    "colombia": "co",
    "croatia": "hr",
    "curacao": "cw",
    "czech republic": "cz",
    "czechia": "cz",
    "dr congo": "cd",
    "d r congo": "cd",
    "democratic republic of the congo": "cd",
    "ecuador": "ec",
    "egypt": "eg",
    "england": "gb-eng",
    "france": "fr",
    "germany": "de",
    "ghana": "gh",
    "haiti": "ht",
    "iran": "ir",
    "iraq": "iq",
    "ivory coast": "ci",
    "cote divoire": "ci",
    "japan": "jp",
    "jordan": "jo",
    "South Korea": "kr",
    "south korea": "kr",
    "mexico": "mx",
    "morocco": "ma",
    "netherlands": "nl",
    "new zealand": "nz",
    "norway": "no",
    "panama": "pa",
    "paraguay": "py",
    "portugal": "pt",
    "qatar": "qa",
    "saudi arabia": "sa",
    "scotland": "gb-sct",
    "senegal": "sn",
    "south africa": "za",
    "spain": "es",
    "sweden": "se",
    "switzerland": "ch",
    "tunisia": "tn",
    "turkey": "tr",
    "turkiye": "tr",
    "united states": "us",
    "usa": "us",
    "uruguay": "uy",
    "uzbekistan": "uz",
  };

  return aliasMap[normalizedKey];
}

function getCountryFallbackLabel(team: string) {
  const normalized = normalizeCountryName(team);

  const fallbackMap: Record<string, string> = {
    "Czechia": "CZ",
    "South Korea": "KR",
    "South Africa": "ZA",
    "Bosnia and Herzegovina": "BA",
    "Cape Verde": "CV",
    "DR Congo": "CD",
    "Ivory Coast": "CI",
    "New Zealand": "NZ",
    "Saudi Arabia": "SA",
    "United States": "US",
  };

  if (fallbackMap[normalized]) return fallbackMap[normalized];

  return normalized
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function WorldCupFlagCircle({
  team,
  size = "md",
}: {
  team: string;
  size?: "sm" | "md" | "lg";
}) {
  const code = getCountryFlagCode(team);
  const sizeClass =
    size === "lg"
      ? "h-12 w-12"
      : size === "sm"
        ? "h-9 w-9"
        : "h-10 w-10";

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2B3139] bg-[#0B0E11] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]`}
      title={team}
    >
      {code ? (
        <img
          alt={`${team} flag`}
          className="h-full w-full object-cover"
          loading="lazy"
          src={`https://flagcdn.com/${code}.svg`}
        />
      ) : (
        <span className="text-xs font-black text-[#EAECEF]">
          {getCountryFallbackLabel(team)}
        </span>
      )}
    </div>
  );
}

function WorldCupFlagPair({
  awayTeam,
  homeTeam,
}: {
  awayTeam: string;
  homeTeam: string;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <WorldCupFlagCircle team={homeTeam} />
      <div className="-ml-2">
        <WorldCupFlagCircle team={awayTeam} />
      </div>
    </div>
  );
}

function WorldCupTeamLabel({
  align = "left",
  team,
}: {
  align?: "left" | "right";
  team: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "right" ? "justify-end text-right" : "justify-start"
      }`}
    >
      {align === "left" ? <WorldCupFlagCircle size="sm" team={team} /> : null}
      <span className="min-w-0 truncate text-sm font-black text-[#EAECEF]">{team}</span>
      {align === "right" ? <WorldCupFlagCircle size="sm" team={team} /> : null}
    </div>
  );
}

function WorldCupMatchupHeader({
  awayTeam,
  group,
  homeTeam,
}: {
  awayTeam: string;
  group: WorldCupGroup;
  homeTeam: string;
}) {
  return (
    <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-3">
      <div className="flex items-center gap-2">
        <WorldCupTeamLabel team={homeTeam} />
        <span className="shrink-0 rounded-md border border-[#2B3139] bg-[#1E2329] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#FCD535]">
          vs
        </span>
        <WorldCupTeamLabel align="right" team={awayTeam} />
      </div>
      <p className="mt-2 truncate text-center text-[11px] font-semibold text-[#707A8A]">
        World Cup / {group}
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { isConnected } = useWallet();
  const searchParams = useSearchParams();
  const marketSearchQuery = (searchParams.get("q") ?? "").trim();
  const [dynamicMarkets, setDynamicMarkets] = useState<MarketCardData[]>([]);
  const [deployedWorldCupMarkets, setDeployedWorldCupMarkets] = useState<
    Record<string, { marketAddress: string; ammAddress: string }>
  >({});
  const [worldCupDeployments, setWorldCupDeployments] = useState<WorldCupDeployment[]>([]);
  const [worldCupResults, setWorldCupResults] = useState<WorldCupResultRecord[]>([]);
  const [selectedWorldCupMarketIds, setSelectedWorldCupMarketIds] = useState<string[]>([]);
  const [selectedWorldCupGroup, setSelectedWorldCupGroup] = useState<"All" | WorldCupGroup>("All");
  const [selectedSettlementFilter, setSelectedSettlementFilter] = useState<SettlementFilter>("All");
  const [bulkDeployStatuses, setBulkDeployStatuses] = useState<Record<string, BulkDeployStatus>>({});
  const [isBulkDeploying, setIsBulkDeploying] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("All");
  const [activeMarketFilter, setActiveMarketFilter] = useState<MarketViewFilter>("Featured");
  const [clientNowMs, setClientNowMs] = useState<number | null>(null);

  const fetchDynamicMarkets = useCallback(async () => {
    try {
      const response = await fetch("/api/markets");
      if (response.ok) {
        const data: DynamicMarket[] = await response.json();
        setDynamicMarkets(data.map(dynamicToCardData));
      }
    } catch {
      // Keep the market board usable if the local metadata file is unavailable.
    }
  }, []);

  const fetchWorldCupDeployments = useCallback(async () => {
    try {
      const response = await fetch("/api/world-cup/deployments");
      if (response.ok) {
        const data: WorldCupDeployment[] = await response.json();
        setWorldCupDeployments(data);
      }
    } catch {
      // Mapping is an enhancement; external cards remain safe display-only if it is unavailable.
    }
  }, []);

  const fetchWorldCupResults = useCallback(async () => {
    try {
      const response = await fetch("/api/world-cup/results");
      if (response.ok) {
        const data: WorldCupResultRecord[] = await response.json();
        setWorldCupResults(data);
      }
    } catch {
      setWorldCupResults([]);
    }
  }, []);

  useEffect(() => {
    fetchDynamicMarkets();
    fetchWorldCupDeployments();
    fetchWorldCupResults();
  }, [fetchDynamicMarkets, fetchWorldCupDeployments, fetchWorldCupResults]);

  useEffect(() => {
    setAdminKey(window.localStorage.getItem("ARCM-admin-key") ?? "");
  }, []);

  useEffect(() => {
    const updateClientNow = () => setClientNowMs(Date.now());

    updateClientNow();
    const intervalId = window.setInterval(updateClientNow, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const onchainMarkets = [
    ...dynamicMarkets,
    ...(hideLegacyV1 ? [] : MARKETS),
  ].filter(isConfiguredOnchainMarket);

  const savedWorldCupDeployments = worldCupDeployments.reduce<Record<string, { marketAddress: string; ammAddress: string }>>(
    (acc, deployment) => {
      if (deployment.marketAddress && deployment.ammAddress) {
        acc[deployment.worldCupMarketId] = {
          marketAddress: deployment.marketAddress,
          ammAddress: deployment.ammAddress,
        };
      }
      return acc;
    },
    {},
  );

  const persistedWorldCupDeployments = dynamicMarkets.reduce<Record<string, { marketAddress: string; ammAddress: string }>>(
    (acc, market) => {
      const template = WORLD_CUP_MARKETS.find((worldCupMarket) => worldCupMarket.question === market.title);
      if (template && market.address !== ZERO_ADDRESS && market.ammAddress && market.ammAddress !== ZERO_ADDRESS) {
        acc[template.id] = {
          marketAddress: market.address,
          ammAddress: market.ammAddress,
        };
      }
      return acc;
    },
    {},
  );

  const worldCupMarkets = WORLD_CUP_MARKETS
    .map((market) => ({
      ...market,
      marketAddress:
        (hideLegacyV1 ? undefined : deployedWorldCupMarkets[market.id]?.marketAddress) ??
        savedWorldCupDeployments[market.id]?.marketAddress ??
        persistedWorldCupDeployments[market.id]?.marketAddress ??
        (hideLegacyV1 ? undefined : market.marketAddress),
      ammAddress:
        (hideLegacyV1 ? undefined : deployedWorldCupMarkets[market.id]?.ammAddress) ??
        savedWorldCupDeployments[market.id]?.ammAddress ??
        persistedWorldCupDeployments[market.id]?.ammAddress ??
        (hideLegacyV1 ? undefined : market.ammAddress),
    }))
    .sort((a, b) => Number(Boolean(b.marketAddress && b.ammAddress)) - Number(Boolean(a.marketAddress && a.ammAddress)));

  const worldCupResultsByFixture = worldCupResults.reduce<Record<string, WorldCupResultRecord>>((acc, result) => {
    acc[result.fixtureId] = result;
    return acc;
  }, {});

  const deployedWorldCupFixtureCards = buildWorldCupFixtureCards(worldCupMarkets, worldCupResultsByFixture).filter(
    (fixture) => !fixture.isCompleted,
  );
  const deployedWorldCupMarketAddresses = new Set(
    worldCupMarkets
      .filter((market) => market.marketAddress && market.ammAddress)
      .map((market) => market.marketAddress!.toLowerCase()),
  );
  const regularTradableMarkets = onchainMarkets.filter(
    (market) => !deployedWorldCupMarketAddresses.has(market.address.toLowerCase()),
  );
  const homeMarketCount = regularTradableMarkets.length + deployedWorldCupFixtureCards.length;

  const categoryFilteredRegularMarkets = regularTradableMarkets.filter((market) =>
    marketMatchesCategory(market, activeCategory),
  );
  const baseFilteredRegularMarkets = marketSearchQuery
    ? regularTradableMarkets.filter((market) => marketMatchesSearch(market, marketSearchQuery))
    : categoryFilteredRegularMarkets.filter((market) =>
        marketMatchesViewFilter(market, activeMarketFilter, categoryFilteredRegularMarkets),
      );
  const filteredRegularMarkets = [...baseFilteredRegularMarkets].sort((a, b) =>
    sortMarketsByViewFilter(a, b, activeMarketFilter),
  );

  const categoryFilteredFixtureCards = deployedWorldCupFixtureCards.filter((fixture) =>
    fixtureMatchesCategory(fixture, activeCategory),
  );
  const filteredWorldCupFixtureCards = sortFixturesByKickoff(
    marketSearchQuery
      ? deployedWorldCupFixtureCards.filter((fixture) => fixtureMatchesSearch(fixture, marketSearchQuery))
      : categoryFilteredFixtureCards.filter(() => fixtureMatchesViewFilter(activeMarketFilter)),
  );
  const showWorldCupDateSections = activeCategory === "World Cup" && !marketSearchQuery;
  const hasVisibleHomeMarkets = filteredWorldCupFixtureCards.length > 0 || filteredRegularMarkets.length > 0;

  const visibleWorldCupMarkets = worldCupMarkets.filter(
    (market) => selectedWorldCupGroup === "All" || market.group === selectedWorldCupGroup,
  );
  const deployableVisibleWorldCupMarkets = visibleWorldCupMarkets.filter(
    (market) => !getWorldCupDeployBlockReason(market, worldCupResultsByFixture, clientNowMs),
  );
  const nextFixtureWorldCupMarkets = deployableVisibleWorldCupMarkets.slice(0, 3);
  const deployedWorldCupMarketsForSettlement = worldCupMarkets.filter((market) => market.marketAddress && market.ammAddress);
  const visibleSettlementMarkets = deployedWorldCupMarketsForSettlement.filter(
    (market) => selectedWorldCupGroup === "All" || market.group === selectedWorldCupGroup,
  );
  const visibleSettlementFixtures = visibleSettlementMarkets.reduce<WorldCupMarket[]>((acc, market) => {
    if (!acc.some((item) => item.fixtureId === market.fixtureId)) {
      acc.push(market);
    }
    return acc;
  }, []);
  const selectedWorldCupMarkets = visibleWorldCupMarkets.filter(
    (market) =>
      selectedWorldCupMarketIds.includes(market.id) &&
      !getWorldCupDeployBlockReason(market, worldCupResultsByFixture, clientNowMs),
  );
  const selectedSafeWorldCupMarkets = selectedWorldCupMarkets.slice(0, 3);

  const deployWorldCupMarkets = useCallback(
    async (marketsToDeploy: WorldCupMarket[]) => {
      if (isBulkDeploying) return;

      const uniqueMarkets = marketsToDeploy.filter(
        (market, index, source) => source.findIndex((item) => item.id === market.id) === index,
      );
      const deployCheckNowMs = Date.now();
      const deployableMarkets = uniqueMarkets.filter(
        (market) => !getWorldCupDeployBlockReason(market, worldCupResultsByFixture, deployCheckNowMs),
      );
      const blockedMarkets = uniqueMarkets.filter((market) => !deployableMarkets.some((item) => item.id === market.id));

      if (blockedMarkets.length > 0) {
        setBulkDeployStatuses((current) => {
          const next = { ...current };

          for (const market of blockedMarkets) {
            next[market.id] = {
              state: "skipped",
              message:
                getWorldCupDeployBlockReason(market, worldCupResultsByFixture, deployCheckNowMs) ??
                "Skipped: fixture already started or completed.",
            };
          }

          return next;
        });
      }

      if (deployableMarkets.length === 0) return;

      if (!adminKey.trim()) {
        setBulkDeployStatuses((current) => {
          const next = { ...current };

          for (const market of deployableMarkets) {
            next[market.id] = {
              state: "failed",
              message: "Admin deploy key missing. Save it in /admin/markets first.",
            };
          }

          return next;
        });
        return;
      }

      setIsBulkDeploying(true);

      try {
        for (const market of deployableMarkets) {
          if (market.marketAddress && market.ammAddress) {
            setBulkDeployStatuses((current) => ({
              ...current,
              [market.id]: { state: "skipped", message: "Already deployed" },
            }));
            continue;
          }

          setBulkDeployStatuses((current) => ({
            ...current,
            [market.id]: { state: "pending", message: "Deploying market + AMM. Keep this tab open." },
          }));

          let deployed = false;
          let lastErrorMessage = "Deployment failed";

          for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              if (adminKey.trim()) {
                headers["x-admin-key"] = adminKey.trim();
              }

              const response = await fetch("/api/create-market-v2", {
                method: "POST",
                headers,
                body: JSON.stringify({
                  title: market.question,
                  category: "World Cup",
                  worldCupMarketId: market.id,
                  fixtureId: market.fixtureId,
                  group: market.group,
                  outcomeType: market.outcomeType,
                  proposerReward: "0.2",
                  proposerBond: "0.2",
                  initialLiquidity: "0.2",
                }),
              });
              const data = (await response.json()) as {
                market?: DynamicMarket;
                deployment?: WorldCupDeployment;
                error?: string;
                skipped?: boolean;
              };

              if (!response.ok || !data.market?.address || !data.market.ammAddress) {
                throw new Error(data.error ?? "Deployment did not return market and AMM addresses.");
              }

              setDeployedWorldCupMarkets((current) => ({
                ...current,
                [market.id]: {
                  marketAddress: data.market!.address,
                  ammAddress: data.market!.ammAddress,
                },
              }));
              setBulkDeployStatuses((current) => ({
                ...current,
                [market.id]: data.skipped
                  ? { state: "skipped", message: "Already deployed" }
                  : { state: "success", message: "Ready to trade" },
              }));

              deployed = true;
              break;
            } catch (error) {
              lastErrorMessage = error instanceof Error ? error.message : "Deployment failed";

              if (attempt === 1) {
                setBulkDeployStatuses((current) => ({
                  ...current,
                  [market.id]: {
                    state: "pending",
                    message: `RPC delay, retrying once: ${lastErrorMessage}`,
                  },
                }));
                await sleep(WORLD_CUP_DEPLOY_RETRY_DELAY_MS);
                continue;
              }

              setBulkDeployStatuses((current) => ({
                ...current,
                [market.id]: {
                  state: "failed",
                  message: lastErrorMessage,
                },
              }));
            }
          }

          if (deployed) {
            setBulkDeployStatuses((current) => ({
              ...current,
              [market.id]: { state: "success", message: "Ready to trade" },
            }));

            await sleep(WORLD_CUP_DEPLOY_COOLDOWN_MS);
          }
        }
      } finally {
        await fetchDynamicMarkets();
        await fetchWorldCupDeployments();
        setSelectedWorldCupMarketIds([]);
        setIsBulkDeploying(false);
      }
    },
    [adminKey, fetchDynamicMarkets, fetchWorldCupDeployments, isBulkDeploying, worldCupResultsByFixture],
  );

  const toggleWorldCupSelection = useCallback(
    (marketId: string, selected: boolean) => {
      if (selected) {
        const market = worldCupMarkets.find((item) => item.id === marketId);
        if (!market || getWorldCupDeployBlockReason(market, worldCupResultsByFixture, clientNowMs)) return;
      }

      setSelectedWorldCupMarketIds((current) =>
        selected ? [...new Set([...current, marketId])] : current.filter((id) => id !== marketId),
      );
    },
    [clientNowMs, worldCupMarkets, worldCupResultsByFixture],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-4 px-3 py-3 sm:px-5">
      <section className="flex flex-col gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((category) => (
            <button
              className={
                activeCategory === category
                  ? "focus-ring market-chip-active shrink-0 px-3 py-1.5 text-xs font-bold"
                  : "focus-ring market-chip shrink-0 px-3 py-1.5 text-xs font-bold transition hover:border-[#FCD535] hover:text-[#EAECEF]"
              }
              key={category}
              onClick={() => setActiveCategory(category)}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <button
              className={
                activeMarketFilter === filter
                  ? "focus-ring market-chip-active shrink-0 px-2.5 py-1 text-[11px] font-bold"
                  : "focus-ring market-chip shrink-0 px-2.5 py-1 text-[11px] font-bold transition hover:border-[#FCD535] hover:text-[#EAECEF]"
              }
              key={filter}
              onClick={() => setActiveMarketFilter(filter)}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      {homeMarketCount === 0 ? (
        <EmptyMarketState isClientMounted={clientNowMs !== null} isConnected={isConnected} />
      ) : (
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#EAECEF]">Markets</h2>
              <p className="mt-1 text-xs text-[#707A8A]">
                {marketSearchQuery
                  ? `Showing open markets matching "${marketSearchQuery}"`
                  : "Showing open markets on Arc Testnet."}
              </p>
            </div>
            <div className="rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-2 text-xs font-bold text-[#707A8A]">
              {marketSearchQuery ? `Search: ${marketSearchQuery}` : `${activeCategory} / ${activeMarketFilter}`}
            </div>
          </div>

          {hasVisibleHomeMarkets ? (
            showWorldCupDateSections ? (
              <div className="space-y-5">
                <WorldCupDateSections fixtures={filteredWorldCupFixtureCards} />

                {filteredRegularMarkets.length > 0 ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#707A8A]">
                        Other World Cup markets
                      </h3>
                      <span className="text-xs font-semibold text-[#707A8A]">
                        {filteredRegularMarkets.length} markets
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 min-[1720px]:grid-cols-4">
                      {filteredRegularMarkets.map((market) => (
                        <LifecycleOpenMarketCard key={market.id} market={market} />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 min-[1720px]:grid-cols-4">
                {filteredWorldCupFixtureCards.map((fixture) => (
                  <WorldCupFixtureCard fixture={fixture} key={`fixture-${fixture.fixtureId}`} />
                ))}
                {filteredRegularMarkets.map((market) => (
                  <LifecycleOpenMarketCard key={market.id} market={market} />
                ))}
              </div>
            )
          ) : (
            <FilteredMarketEmptyState
              activeCategory={activeCategory}
              activeFilter={activeMarketFilter}
              searchQuery={marketSearchQuery}
            />
          )}
        </section>
      )}

      {adminMarketCreateEnabled && (
      <>
      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#EAECEF]">
              Deploy World Cup Markets
            </h2>
            <p className="mt-1 text-xs text-[#707A8A]">
              Admin-only catalog. Undeployed templates use the V2 USDC create-market flow before they become tradable.
            </p>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {WORLD_CUP_GROUP_FILTERS.map((group) => (
                <button
                  className={
                    selectedWorldCupGroup === group
                      ? "focus-ring market-chip-active shrink-0 px-3 py-1.5 text-xs font-bold"
                      : "focus-ring market-chip shrink-0 px-3 py-1.5 text-xs font-bold transition hover:border-[#FCD535] hover:text-[#EAECEF]"
                  }
                  key={group}
                  onClick={() => {
                    setSelectedWorldCupGroup(group);
                    setSelectedWorldCupMarketIds([]);
                  }}
                  type="button"
                >
                  {group}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[#2B3139] bg-[#1E2329] p-2">
            <p className="mb-2 text-[11px] font-semibold text-[#FCD535]">
              Admin only: safe deploy is limited to one fixture / 3 markets at a time to avoid Arc RPC 429.
              <span className={adminKey.trim() ? "ml-2 text-[#0ECB81]" : "ml-2 text-[#F6465D]"}>
                {adminKey.trim() ? "Admin key ready" : "Admin key missing"}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="terminal-button focus-ring px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed"
                disabled={isBulkDeploying || selectedWorldCupMarkets.length === 0}
                onClick={() => deployWorldCupMarkets(selectedSafeWorldCupMarkets)}
                type="button"
                title="Safe mode deploys max 3 markets at a time to avoid Arc RPC rate limits."
              >
                {isBulkDeploying
                  ? "Deploying..."
                  : `Deploy selected (${Math.min(selectedWorldCupMarkets.length, 3)}/3)`}
              </button>
              <button
                className="terminal-button focus-ring px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed"
                disabled={isBulkDeploying || nextFixtureWorldCupMarkets.length === 0}
                onClick={() => deployWorldCupMarkets(nextFixtureWorldCupMarkets)}
                type="button"
                title="Deploys the next undeployed fixture only: home win, draw, away win."
              >
                Deploy next fixture
              </button>
              <button
                className="terminal-button focus-ring px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed"
                disabled={isBulkDeploying || selectedWorldCupGroup === "All" || nextFixtureWorldCupMarkets.length === 0}
                onClick={() => deployWorldCupMarkets(nextFixtureWorldCupMarkets)}
                type="button"
                title="Safe mode: group deploy is limited to the next fixture to avoid RPC 429."
              >
                Deploy next in group
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 min-[1720px]:grid-cols-4">
          {visibleWorldCupMarkets.map((market) => (
            <WorldCupSignalCard
              adminCreateEnabled={adminMarketCreateEnabled}
              bulkStatus={bulkDeployStatuses[market.id]}
              key={market.id}
              market={market}
              deployBlockReason={getWorldCupDeployBlockReason(market, worldCupResultsByFixture, clientNowMs)}
              onDeploy={deployWorldCupMarkets}
              onSelectedChange={toggleWorldCupSelection}
              selected={selectedWorldCupMarketIds.includes(market.id)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#EAECEF]">
              World Cup Settlement
            </h2>
            <p className="mt-1 text-xs text-[#707A8A]">
              Final scores are display-only. Settlement uses ARCM resolver / UMA flow.
            </p>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {settlementFilters.map((filter) => (
                <button
                  className={
                    selectedSettlementFilter === filter
                      ? "focus-ring market-chip-active shrink-0 px-3 py-1.5 text-xs font-bold"
                      : "focus-ring market-chip shrink-0 px-3 py-1.5 text-xs font-bold transition hover:border-[#FCD535] hover:text-[#EAECEF]"
                  }
                  key={filter}
                  onClick={() => setSelectedSettlementFilter(filter)}
                  type="button"
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[#2B3139] bg-[#1E2329] p-3 text-xs leading-5 text-[#FCD535]">
            External football scores must never trigger payout automatically. Use the market detail Resolve tab for proposals,
            liveness, settlement, and Claim Reward.
          </div>
        </div>

        {visibleSettlementMarkets.length === 0 ? (
          <div className="terminal-card p-5 text-sm text-[#707A8A]">
            No deployed World Cup markets match this group yet.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#707A8A]">
                Final result updates
              </h3>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {visibleSettlementFixtures.map((fixtureMarket) => (
                  <WorldCupResultUpdateCard
                    adminKey={adminKey}
                    key={`result-${fixtureMarket.fixtureId}`}
                    market={fixtureMarket}
                    onSaved={fetchWorldCupResults}
                    result={worldCupResultsByFixture[fixtureMarket.fixtureId]}
                  />
                ))}
              </div>
            </div>
            {WORLD_CUP_GROUP_FILTERS.filter((group): group is WorldCupGroup => group !== "All")
              .map((group) => {
                if (selectedWorldCupGroup !== "All" && selectedWorldCupGroup !== group) return null;
                const groupMarkets = visibleSettlementMarkets.filter((market) => market.group === group);
                if (groupMarkets.length === 0) return null;

                return (
                  <div className="space-y-2" key={group}>
                    <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#707A8A]">{group}</h3>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {groupMarkets.map((market) => (
                        <MarketAddressProvider
                          ammAddress={market.ammAddress as Address}
                          key={`settlement-${market.id}`}
                          marketAddress={market.marketAddress as Address}
                        >
                          <WorldCupSettlementCard
                            filter={selectedSettlementFilter}
                            market={market}
                            mapping={worldCupDeployments.find((deployment) => deployment.worldCupMarketId === market.id)}
                            result={worldCupResultsByFixture[market.fixtureId]}
                          />
                        </MarketAddressProvider>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>
      </>
      )}

    </div>
  );
}

function WorldCupDateSections({
  fixtures,
}: {
  fixtures: WorldCupFixtureCardData[];
}) {
  const groups = groupFixturesByDate(fixtures);

  if (groups.length === 0) {
    return (
      <div className="terminal-card p-5 text-sm text-[#707A8A]">
        No deployed World Cup fixtures match this filter yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group, index) => (
        <section className="space-y-3" key={group.dateKey}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                {index === 0 ? (
                  <span className="rounded-full border border-[#FCD535]/50 bg-[#FCD535]/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#FCD535]">
                    Nearest
                  </span>
                ) : null}
                <h3 className="text-sm font-black text-[#EAECEF]">{group.dateLabel}</h3>
              </div>
              <p className="mt-1 text-xs text-[#707A8A]">
                {group.fixtures.length} fixture{group.fixtures.length === 1 ? "" : "s"} / sorted by kickoff time
              </p>
            </div>
            <span className="text-xs font-semibold text-[#707A8A]">UTC schedule</span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 min-[1720px]:grid-cols-4">
            {group.fixtures.map((fixture) => (
              <WorldCupFixtureCard fixture={fixture} key={`fixture-${fixture.fixtureId}`} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function WorldCupFixtureCard({
  fixture,
}: {
  fixture: WorldCupFixtureCardData;
}) {
  return (
    <article className="interactive-card market-card-hover flex min-h-[236px] flex-col rounded-xl border border-[#2B3139] bg-[#1E2329] p-3 text-[#EAECEF]">
      <WorldCupMatchupHeader
        awayTeam={fixture.awayTeam}
        group={fixture.group}
        homeTeam={fixture.homeTeam}
      />

      <div className="mt-3 flex flex-1 flex-col gap-2">
        {fixture.options.map((option) => (
          <Link
            className="focus-ring group flex min-h-[40px] items-center justify-between rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2 text-sm font-bold text-[#EAECEF] transition hover:border-[#FCD535] hover:bg-[#20262D]"
            href={`/market/${option.marketAddress}`}
            key={option.outcomeType}
          >
            <span className="min-w-0 truncate pr-3">{option.label}</span>
            <span className="font-mono text-base font-black text-[#FCD535] transition group-hover:text-[#FFF3AF]">
              {formatFixtureProbability(option.probability)}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold">
        <span className="min-w-0 truncate text-[#EAECEF]">
          {formatFixtureCardDate(fixture.kickoffTime)}
        </span>
        <span className="shrink-0 font-mono text-[#EAECEF]">
          {formatFixtureKickoffTime(fixture.kickoffTime)} UTC
        </span>
      </div>
    </article>
  );
}

function LifecycleOpenMarketCard({
  market,
}: {
  market: MarketCardData;
}) {
  if (!market.address || !market.ammAddress) return null;

  return (
    <MarketAddressProvider
      ammAddress={market.ammAddress as Address}
      marketAddress={market.address as Address}
    >
      <LifecycleOpenMarketCardInner market={market} />
    </MarketAddressProvider>
  );
}

function LifecycleOpenMarketCardInner({
  market,
}: {
  market: MarketCardData;
}) {
  const {
    priceIdentifier,
    requestTimestamp,
    ancillaryDataHex,
    receivedSettlementPrice,
  } = useMarketState();
  const { oracleState } = useOracleState(
    priceIdentifier,
    requestTimestamp,
    ancillaryDataHex,
  );
  const isCompleted =
    isMarketSettled(market) ||
    Boolean(receivedSettlementPrice) ||
    oracleState === OracleState.Settled;

  if (isCompleted) return null;

  return <MarketCard market={market} />;
}

function HomeFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-4 px-3 py-3 sm:px-5">
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#EAECEF]">Markets</h2>
            <p className="mt-1 text-xs text-[#707A8A]">Loading ARCM markets...</p>
          </div>
          <div className="rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-2 text-xs font-bold text-[#707A8A]">
            Loading
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 min-[1720px]:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="h-[184px] rounded-xl border border-[#2B3139] bg-[#1E2329]"
              key={index}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function WorldCupSignalCard({
  adminCreateEnabled,
  bulkStatus,
  deployBlockReason,
  market,
  onDeploy,
  onSelectedChange,
  selected,
}: {
  adminCreateEnabled: boolean;
  bulkStatus?: BulkDeployStatus;
  deployBlockReason?: string | null;
  market: WorldCupMarket;
  onDeploy: (markets: WorldCupMarket[]) => void | Promise<void>;
  onSelectedChange: (marketId: string, selected: boolean) => void;
  selected: boolean;
}) {
  const yesPercent = market.externalYesPrice !== undefined
    ? Math.round(market.externalYesPrice * 100)
    : null;
  const noPercent = market.externalNoPrice !== undefined
    ? Math.round(market.externalNoPrice * 100)
    : yesPercent !== null
      ? 100 - yesPercent
      : null;
  const isTradable = Boolean(market.marketAddress && market.ammAddress);
  const outcomeText = outcomeTypeLabel(market.outcomeType);

  const content = (
    <article
      className={`interactive-card market-card-hover flex h-[184px] flex-col justify-between rounded-xl border bg-[#1E2329] p-3 text-[#EAECEF] ${
        isTradable
          ? "interactive-card-clickable border-[#2B3139]"
          : "interactive-card-static border-[#2B3139]"
      }`}
    >
      <div className="flex min-h-[58px] gap-3">
        <WorldCupFlagPair awayTeam={market.awayTeam} homeTeam={market.homeTeam} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 min-h-[40px] pt-0.5 text-[15px] font-bold leading-snug text-[#EAECEF]">
            {market.question}
          </h3>
          <p className="mt-1 truncate text-[11px] text-[#707A8A]">
            {market.homeTeam} vs {market.awayTeam}
          </p>
        </div>
        {adminCreateEnabled && !isTradable && !deployBlockReason && (
          <label className="focus-ring flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-[#2B3139] bg-[#2B3139] px-2 text-[10px] font-bold text-[#707A8A] hover:border-[#FCD535] hover:text-[#EAECEF]">
              <input
                checked={selected}
                className="accent-[#FCD535]"
                onChange={(event) => onSelectedChange(market.id, event.target.checked)}
                type="checkbox"
              />
              Select
          </label>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ExternalOddsBox label="YES" value={yesPercent} tone="yes" />
        <ExternalOddsBox label="NO" value={noPercent} tone="no" />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#EAECEF]">
        <span className="min-w-0 flex-1 truncate font-semibold">{market.category}</span>
        <span className="min-w-0 flex-1 truncate text-center text-[#707A8A]">
          {market.group} / {outcomeText}
        </span>
        <CardAction
          adminCreateEnabled={adminCreateEnabled}
          bulkStatus={bulkStatus}
          deployBlockReason={deployBlockReason}
          isTradable={isTradable}
          market={market}
          onDeploy={onDeploy}
        />
      </div>
    </article>
  );

  if (isTradable && market.marketAddress) {
    return (
      <Link className="block" href={`/market/${market.marketAddress}`}>
        {content}
      </Link>
    );
  }

  return content;
}

function WorldCupResultUpdateCard({
  adminKey,
  market,
  onSaved,
  result,
}: {
  adminKey: string;
  market: WorldCupMarket;
  onSaved: () => void | Promise<void>;
  result?: WorldCupResultRecord;
}) {
  const fixture = WORLD_CUP_FIXTURES.find((item) => item.fixtureId === market.fixtureId);
  const [homeScore, setHomeScore] = useState(result?.homeScore?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(result?.awayScore?.toString() ?? "");
  const [status, setStatus] = useState<WorldCupResultStatus>(
    result && result.status !== "pending" ? result.status : "final",
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setHomeScore(result?.homeScore?.toString() ?? "");
    setAwayScore(result?.awayScore?.toString() ?? "");
    setStatus(result && result.status !== "pending" ? result.status : "final");
  }, [result]);

  if (!fixture) return null;

  const homeScoreNumber = homeScore === "" ? null : Number(homeScore);
  const awayScoreNumber = awayScore === "" ? null : Number(awayScore);
  const hasValidScores =
    homeScoreNumber !== null &&
    awayScoreNumber !== null &&
    Number.isInteger(homeScoreNumber) &&
    Number.isInteger(awayScoreNumber) &&
    homeScoreNumber >= 0 &&
    awayScoreNumber >= 0;
  const previewResult = calculateFixtureResult(
    hasValidScores ? homeScoreNumber : null,
    hasValidScores ? awayScoreNumber : null,
    status,
  );
  const updateAllowed = canUpdateFixtureResult(fixture, {
    overrideEnabled: adminResultOverrideEnabled,
  });
  const canSave =
    updateAllowed &&
    saveState !== "saving" &&
    (status === "cancelled" || status === "postponed" || (status === "final" && hasValidScores));

  const saveResult = async () => {
    setSaveState("saving");
    setMessage("");

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminKey.trim()) {
        headers["x-admin-key"] = adminKey.trim();
      }

      const response = await fetch("/api/world-cup/results", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fixtureId: market.fixtureId,
          homeScore: status === "final" ? homeScoreNumber : null,
          awayScore: status === "final" ? awayScoreNumber : null,
          status,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not save final result.");
      }

      setSaveState("success");
      setMessage("Final result saved. Admin must still resolve and settle manually.");
      await onSaved();
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Could not save final result.");
    }
  };

  return (
    <article className="terminal-card space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-[#EAECEF]">
            {market.homeTeam} vs {market.awayTeam}
          </h4>
          <p className="mt-1 text-xs text-[#707A8A]">
            Update allowed after {formatDateTime(fixture.resultUpdateAllowedAt)}
          </p>
        </div>
        <span className="rounded-full border border-[#2B3139] px-2 py-1 text-[10px] font-black uppercase text-[#707A8A]">
          {market.group}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-bold text-[#707A8A]">
          {market.homeTeam}
          <input
            className="focus-ring mt-1 w-full rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2 font-mono text-sm font-bold text-[#EAECEF]"
            disabled={status !== "final"}
            min="0"
            onChange={(event) => setHomeScore(event.target.value)}
            type="number"
            value={homeScore}
          />
        </label>
        <label className="text-xs font-bold text-[#707A8A]">
          {market.awayTeam}
          <input
            className="focus-ring mt-1 w-full rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2 font-mono text-sm font-bold text-[#EAECEF]"
            disabled={status !== "final"}
            min="0"
            onChange={(event) => setAwayScore(event.target.value)}
            type="number"
            value={awayScore}
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-[0.8fr_1fr]">
        <label className="text-xs font-bold text-[#707A8A]">
          Status
          <select
            className="focus-ring mt-1 w-full rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2 text-sm font-bold text-[#EAECEF]"
            onChange={(event) => setStatus(event.target.value as WorldCupResultStatus)}
            value={status}
          >
            <option value="final">Final</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <div className="rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#707A8A]">Result preview</p>
          <p className="mt-1 text-sm font-bold text-[#EAECEF]">{resultLabel(previewResult)}</p>
        </div>
      </div>

      {!updateAllowed && (
        <p className="rounded-lg border border-[#FCD535] bg-[#FCD535]/15 px-3 py-2 text-xs font-bold text-[#FFF3AF]">
          Final result updates unlock after the scheduled result update time.
        </p>
      )}
      <p className="text-[11px] leading-5 text-[#707A8A]">
        Final scores are display-only. Settlement uses ARCM resolver / UMA flow.
      </p>
      <button
        className="terminal-button focus-ring w-full px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canSave}
        onClick={saveResult}
        type="button"
      >
        {saveState === "saving" ? "Saving..." : "Save Final Result"}
      </button>
      {message && (
        <p
          className={`rounded-lg border px-3 py-2 text-xs font-bold ${
            saveState === "error"
              ? "border-[#F6465D] bg-[#F6465D]/15 text-[#FFD7DD]"
              : "border-[#0ECB81] bg-[#0ECB81]/15 text-[#BFFFE7]"
          }`}
        >
          {message}
        </p>
      )}
    </article>
  );
}

function WorldCupSettlementCard({
  filter,
  mapping,
  market,
  result,
}: {
  filter: SettlementFilter;
  mapping?: WorldCupDeployment;
  market: WorldCupMarket;
  result?: WorldCupResultRecord;
}) {
  const {
    priceRequested,
    receivedSettlementPrice,
    settlementPrice,
    longTokenAddress,
    shortTokenAddress,
    priceIdentifier,
    requestTimestamp,
    ancillaryDataHex,
  } = useMarketState();
  const { longBalance, shortBalance } = useTokenBalances(longTokenAddress, shortTokenAddress);
  const { oracleState } = useOracleState(priceIdentifier, requestTimestamp, ancillaryDataHex);

  const claimableLong =
    receivedSettlementPrice && settlementPrice !== undefined && settlementPrice > 0n
      ? longBalance ?? 0n
      : 0n;
  const claimableShort =
    receivedSettlementPrice && settlementPrice !== undefined && settlementPrice < ONE
      ? shortBalance ?? 0n
      : 0n;
  const claimableAmount =
    settlementPrice !== undefined
      ? (claimableLong * settlementPrice + claimableShort * (ONE - settlementPrice)) / ONE
      : 0n;
  const isClaimable = claimableAmount > 0n;
  const status = worldCupLifecycleStatus({
    isClaimable,
    oracleState,
    priceRequested,
    receivedSettlementPrice,
  });

  if (filter !== "All" && filter !== status) return null;

  const marketAddress = market.marketAddress!;
  const ammAddress = market.ammAddress!;
  const txHash = mapping?.txHash ?? mapping?.transactionHash;
  const suggestedResult = result
    ? calculateSuggestedResult(result.result, market.outcomeType, result.status)
    : "pending";
  const winningSide = receivedSettlementPrice
    ? settlementPrice === ONE
      ? "YES"
      : settlementPrice === 0n
        ? "NO"
        : "Undetermined"
    : "Pending";
  const readyToSettleOracle =
    oracleState === OracleState.Expired || oracleState === OracleState.Resolved;

  return (
    <article className="terminal-card flex min-h-[260px] flex-col justify-between p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="line-clamp-2 text-sm font-bold text-[#EAECEF]">{market.question}</h4>
            <p className="mt-1 text-xs text-[#707A8A]">
              {market.group} / {market.homeTeam} vs {market.awayTeam} / {outcomeTypeLabel(market.outcomeType)}
            </p>
          </div>
          <span className={statusBadgeClass(status)}>{status}</span>
        </div>

        <div className="grid gap-2 text-[11px] sm:grid-cols-2">
          <SettlementMeta label="Fixture" value={market.fixtureId} />
          <SettlementMeta label="Outcome type" value={market.outcomeType} />
          <SettlementMeta label="Market" value={shortAddress(marketAddress)} mono />
          <SettlementMeta label="AMM" value={shortAddress(ammAddress)} mono />
          <SettlementMeta label="Oracle" value={oracleStateLabel(oracleState, { priceRequested: !!priceRequested })} />
          <SettlementMeta label="Winning side" value={winningSide} />
          <SettlementMeta label="Final score" value={formatFixtureScore(result)} />
          <SettlementMeta label="Suggested result" value={suggestedResult} />
        </div>

        <p className="rounded-xl border border-[#2B3139] bg-[#0B0E11] px-3 py-2 text-[11px] leading-5 text-[#707A8A]">
          Final scores are display-only. Settlement uses ARCM resolver / UMA flow.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!receivedSettlementPrice && (
          <>
            <LifecycleLink highlight={suggestedResult === "YES"} href={`/market/${marketAddress}?tab=resolve&proposal=yes`}>
              Resolve YES
            </LifecycleLink>
            <LifecycleLink highlight={suggestedResult === "NO"} href={`/market/${marketAddress}?tab=resolve&proposal=no`}>
              Resolve NO
            </LifecycleLink>
          </>
        )}
        {readyToSettleOracle ? (
          <LifecycleLink href={`/market/${marketAddress}?tab=resolve`}>Settle market</LifecycleLink>
        ) : receivedSettlementPrice ? (
          <LifecycleLink href={`/market/${marketAddress}?tab=resolve`}>Claim Reward</LifecycleLink>
        ) : (
          <span className="rounded-full border border-[#2B3139] px-3 py-1.5 text-xs font-bold text-[#707A8A]">
            Settle after resolve
          </span>
        )}
        <LifecycleLink href={`/market/${marketAddress}`}>Open market detail</LifecycleLink>
        {txHash && (
          <a
            className="interactive-link text-xs"
            href={`${arcScanBaseUrl}/tx/${txHash}`}
            rel="noreferrer"
            target="_blank"
          >
            View tx on Arcscan
          </a>
        )}
      </div>
    </article>
  );
}

function worldCupLifecycleStatus({
  isClaimable,
  oracleState,
  priceRequested,
  receivedSettlementPrice,
}: {
  isClaimable: boolean;
  oracleState: OracleState | undefined;
  priceRequested: boolean | undefined;
  receivedSettlementPrice: boolean | undefined;
}): Exclude<SettlementFilter, "All"> {
  if (isClaimable) return "Claimable";
  if (receivedSettlementPrice || oracleState === OracleState.Settled) return "Settled";
  if (
    oracleState === OracleState.Proposed ||
    oracleState === OracleState.Expired ||
    oracleState === OracleState.Resolved ||
    oracleState === OracleState.Disputed ||
    oracleState === OracleState.Invalid
  ) {
    return "Resolved";
  }
  return priceRequested ? "Open" : "Open";
}

function resultLabel(result: ReturnType<typeof calculateFixtureResult>) {
  switch (result) {
    case "home_win":
      return "Home win";
    case "draw":
      return "Draw";
    case "away_win":
      return "Away win";
    case "pending":
      return "Pending";
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function statusBadgeClass(status: Exclude<SettlementFilter, "All">) {
  const base = "shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em]";
  switch (status) {
    case "Claimable":
      return `${base} border-[#0ECB81] bg-[#0ECB81]/15 text-[#BFFFE7]`;
    case "Settled":
      return `${base} border-[#FCD535] bg-[#FCD535]/15 text-[#FFF3AF]`;
    case "Resolved":
      return `${base} border-[#FCD535] bg-[#FCD535]/15 text-[#FFF3AF]`;
    case "Open":
      return `${base} border-[#2B3139] bg-[#0B0E11] text-[#707A8A]`;
  }
}

function SettlementMeta({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#2B3139] bg-[#0B0E11] px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#707A8A]">{label}</p>
      <p className={`mt-1 truncate font-bold text-[#EAECEF] ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function LifecycleLink({
  children,
  highlight,
  href,
}: {
  children: string;
  highlight?: boolean;
  href: string;
}) {
  return (
    <Link
      className={`terminal-button focus-ring px-3 py-1.5 text-xs font-bold ${
        highlight ? "border-[#0ECB81] bg-[#0ECB81] text-white shadow-none" : ""
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}

function CardAction({
  adminCreateEnabled,
  bulkStatus,
  deployBlockReason,
  isTradable,
  market,
  onDeploy,
}: {
  adminCreateEnabled: boolean;
  bulkStatus?: BulkDeployStatus;
  deployBlockReason?: string | null;
  isTradable: boolean;
  market: WorldCupMarket;
  onDeploy: (markets: WorldCupMarket[]) => void | Promise<void>;
}) {
  if (isTradable) {
    return <span className="shrink-0 font-bold text-[#FCD535]">Open Market</span>;
  }

  if (bulkStatus?.state === "pending") {
    return <span className="shrink-0 text-[#FCD535]">Pending</span>;
  }

  if (bulkStatus?.state === "success") {
    return <span className="shrink-0 text-[#0ECB81]">Success</span>;
  }

  if (bulkStatus?.state === "failed") {
    return (
      <span
        className="max-w-[160px] shrink-0 truncate text-right text-[#F6465D]"
        title={bulkStatus.message}
      >
        Failed: {bulkStatus.message}
      </span>
    );
  }

  if (bulkStatus?.state === "skipped") {
    return <span className="shrink-0 text-[#707A8A]">Skipped</span>;
  }

  if (adminCreateEnabled && deployBlockReason) {
    return (
      <span
        className="max-w-[140px] shrink-0 truncate text-right text-[#707A8A]"
        title={deployBlockReason}
      >
        Not deployable
      </span>
    );
  }

  if (adminCreateEnabled) {
    return (
      <button
        className="interactive-link shrink-0 border-0 bg-transparent p-0 text-[11px] font-bold shadow-none hover:bg-transparent"
        onClick={() => onDeploy([market])}
        type="button"
      >
        Deploy on Arc
      </button>
    );
  }

  return <span className="shrink-0 font-semibold">Coming soon</span>;
}

function bulkStatusLabel(status: BulkDeployStatus) {
  switch (status.state) {
    case "pending":
      return "Deploying";
    case "success":
      return "Deployed";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
  }
}

function outcomeTypeLabel(outcomeType: WorldCupMarket["outcomeType"]) {
  switch (outcomeType) {
    case "home_win":
      return "Home win";
    case "draw":
      return "Draw";
    case "away_win":
      return "Away win";
  }
}

function ExternalOddsBox({
  label,
  value,
  tone,
}: {
  label: "YES" | "NO";
  value: number | null;
  tone: "yes" | "no";
}) {
  return (
    <div
      className={`${tone === "yes" ? "market-action-yes" : "market-action-no"} market-action-display rounded-lg px-3 py-2.5 text-center`}
    >
      <div className="text-xs font-black">{label === "YES" ? "Yes" : "No"}</div>
      <div className="mt-0.5 font-mono text-xl font-black leading-none">
        {value !== null ? `${value}%` : "--"}
      </div>
    </div>
  );
}

function WorldCupThumbnail({
  alt,
  imageSrc,
  label,
}: {
  alt?: string;
  imageSrc?: string;
  label: string;
}) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2B3139] bg-[#2B3139] text-xs font-black text-[#707A8A]">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={alt ?? `${label} market`}
          className="h-full w-full object-cover"
          src={imageSrc}
        />
      ) : (
        label
      )}
    </div>
  );
}

function FilteredMarketEmptyState({
  activeCategory,
  activeFilter,
  searchQuery,
}: {
  activeCategory: CategoryFilter;
  activeFilter: MarketViewFilter;
  searchQuery?: string;
}) {
  return (
    <section className="rounded-xl border border-[#2B3139] bg-[#1E2329] p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#2B3139] bg-[#0B0E11] text-sm font-black text-[#FCD535]">
        0
      </div>
      <h3 className="text-lg font-bold text-[#EAECEF]">No markets found</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#707A8A]">
        {searchQuery
          ? `No open markets match "${searchQuery}"`
          : `No open markets are available for ${activeCategory} / ${activeFilter} yet.`}
      </p>
      <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[#707A8A]">
        Markets will appear here after they are deployed and mapped with a real market address and AMM address.
      </p>
    </section>
  );
}

function EmptyMarketState({
  isClientMounted,
  isConnected,
}: {
  isClientMounted: boolean;
  isConnected: boolean;
}) {
  return (
    <section className="exchange-panel p-8 text-center sm:p-12">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-[#FCD535] bg-[#FCD535] text-[#181A20]">
        <PlusCircle className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-bold text-[#EAECEF]">No onchain markets found yet.</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#707A8A]">
        V2 markets will appear here after the factory, allowlist, and verified USDC collateral flow pass end-to-end checks.
      </p>
      {isClientMounted && !isConnected && (
        <p className="mx-auto mt-4 max-w-lg rounded-lg border border-[#FCD535] bg-[#FCD535]/15 px-4 py-3 text-sm font-bold text-[#FFF3AF]">
          Connect wallet to trade on Arc Testnet.
        </p>
      )}
    </section>
  );
}
