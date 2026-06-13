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

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { type Address } from "viem";
import { CreateMarketDialog } from "@/components/CreateMarketDialog";
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

const categories = ["All", "Trending", "World Cup", "Arc", "Crypto", "Stablecoins", "AI", "Macro", "RWA", "Privacy"];
const filters = ["Featured", "Newest", "Volume", "Open", "Settled"];
const adminMarketCreateEnabled = process.env.NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE === "true";
const adminResultOverrideEnabled = process.env.NEXT_PUBLIC_ENABLE_ADMIN_RESULT_OVERRIDE === "true";
const ONE = 1000000000000000000n;
const arcScanBaseUrl = "https://testnet.arcscan.app";

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

export default function Home() {
  const { isConnected } = useWallet();
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

  const onchainMarkets = [...dynamicMarkets, ...MARKETS].filter(isConfiguredOnchainMarket);

  const handleWorldCupCreated = useCallback(
    (worldCupMarketId: string) => async (market?: DynamicMarket) => {
      await fetchDynamicMarkets();
      await fetchWorldCupDeployments();
      if (market?.address && market.ammAddress) {
        setDeployedWorldCupMarkets((current) => ({
          ...current,
          [worldCupMarketId]: {
            marketAddress: market.address,
            ammAddress: market.ammAddress,
          },
        }));
      }
    },
    [fetchDynamicMarkets, fetchWorldCupDeployments],
  );

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
        deployedWorldCupMarkets[market.id]?.marketAddress ??
        savedWorldCupDeployments[market.id]?.marketAddress ??
        persistedWorldCupDeployments[market.id]?.marketAddress ??
        market.marketAddress,
      ammAddress:
        deployedWorldCupMarkets[market.id]?.ammAddress ??
        savedWorldCupDeployments[market.id]?.ammAddress ??
        persistedWorldCupDeployments[market.id]?.ammAddress ??
        market.ammAddress,
    }))
    .sort((a, b) => Number(Boolean(b.marketAddress && b.ammAddress)) - Number(Boolean(a.marketAddress && a.ammAddress)));

  const onchainMarketAddresses = new Set(onchainMarkets.map((market) => market.address.toLowerCase()));
  const deployedWorldCupCards: MarketCardData[] = worldCupMarkets
    .filter((market) => market.marketAddress && market.ammAddress)
    .filter((market) => !onchainMarketAddresses.has(market.marketAddress!.toLowerCase()))
    .map((market) => ({
      id: `world-cup-${market.id}`,
      address: market.marketAddress!,
      ammAddress: market.ammAddress!,
      title: market.question,
      icon: "WC",
      yesPrice: market.externalYesPrice ?? 0.5,
      noPrice: market.externalNoPrice ?? 0.5,
      volume: market.group,
      category: market.category,
      isReal: true,
      imageSrc: market.imageSrc,
      imageAlt: market.imageAlt,
    }));
  const tradableMarkets = [...onchainMarkets, ...deployedWorldCupCards];
  const visibleWorldCupMarkets = worldCupMarkets.filter(
    (market) => selectedWorldCupGroup === "All" || market.group === selectedWorldCupGroup,
  );
  const deployedWorldCupMarketsForSettlement = worldCupMarkets.filter((market) => market.marketAddress && market.ammAddress);
  const visibleSettlementMarkets = deployedWorldCupMarketsForSettlement.filter(
    (market) => selectedWorldCupGroup === "All" || market.group === selectedWorldCupGroup,
  );
  const worldCupResultsByFixture = worldCupResults.reduce<Record<string, WorldCupResultRecord>>((acc, result) => {
    acc[result.fixtureId] = result;
    return acc;
  }, {});
  const visibleSettlementFixtures = visibleSettlementMarkets.reduce<WorldCupMarket[]>((acc, market) => {
    if (!acc.some((item) => item.fixtureId === market.fixtureId)) {
      acc.push(market);
    }
    return acc;
  }, []);
  const selectedWorldCupMarkets = visibleWorldCupMarkets.filter((market) => selectedWorldCupMarketIds.includes(market.id));

  const deployWorldCupMarkets = useCallback(
    async (marketsToDeploy: WorldCupMarket[]) => {
      if (isBulkDeploying) return;

      const uniqueMarkets = marketsToDeploy.filter(
        (market, index, source) => source.findIndex((item) => item.id === market.id) === index,
      );

      setIsBulkDeploying(true);

      try {
        for (const market of uniqueMarkets) {
          if (market.marketAddress && market.ammAddress) {
            setBulkDeployStatuses((current) => ({
              ...current,
              [market.id]: { state: "skipped", message: "Already deployed" },
            }));
            continue;
          }

          setBulkDeployStatuses((current) => ({
            ...current,
            [market.id]: { state: "pending", message: "Deploying market + AMM" },
          }));

          try {
            const response = await fetch("/api/create-market", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: market.question,
                category: "World Cup",
                settlementRule: market.settlementRule,
                worldCupMarketId: market.id,
                fixtureId: market.fixtureId,
                group: market.group,
                outcomeType: market.outcomeType,
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
          } catch (error) {
            setBulkDeployStatuses((current) => ({
              ...current,
              [market.id]: {
                state: "failed",
                message: error instanceof Error ? error.message : "Deployment failed",
              },
            }));
          }
        }
      } finally {
        await fetchDynamicMarkets();
        await fetchWorldCupDeployments();
        setSelectedWorldCupMarketIds([]);
        setIsBulkDeploying(false);
      }
    },
    [fetchDynamicMarkets, fetchWorldCupDeployments, isBulkDeploying],
  );

  const toggleWorldCupSelection = useCallback((marketId: string, selected: boolean) => {
    setSelectedWorldCupMarketIds((current) =>
      selected ? [...new Set([...current, marketId])] : current.filter((id) => id !== marketId),
    );
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-4 px-3 py-3 sm:px-5">
      <section className="flex flex-col gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((category, index) => (
            <button
              className={index === 0 ? "focus-ring market-chip-active shrink-0 px-3 py-1.5 text-xs font-bold" : "focus-ring market-chip shrink-0 px-3 py-1.5 text-xs font-bold transition hover:border-[#FCD535] hover:text-[#EAECEF]"}
              key={category}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {filters.map((filter, index) => (
            <button
              className={index === 0 ? "focus-ring market-chip-active shrink-0 px-2.5 py-1 text-[11px] font-bold" : "focus-ring market-chip shrink-0 px-2.5 py-1 text-[11px] font-bold transition hover:border-[#FCD535] hover:text-[#EAECEF]"}
              key={filter}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      {tradableMarkets.length === 0 ? (
        <EmptyMarketState isConnected={isConnected} />
      ) : (
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#EAECEF]">Markets</h2>
              <p className="mt-1 text-xs text-[#707A8A]">
                {tradableMarkets.length} tradable ArcSignal market{tradableMarkets.length === 1 ? "" : "s"} on Arc Testnet.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 min-[1720px]:grid-cols-4">
            {tradableMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
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
              Admin-only catalog. Undeployed templates use the existing create-market flow before they become tradable.
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
              Admin only: bulk deploy uses the server-side PRIVATE_KEY and reuses existing UMA/ARCT infrastructure.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="terminal-button focus-ring px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed"
                disabled={isBulkDeploying || selectedWorldCupMarkets.length === 0}
                onClick={() => deployWorldCupMarkets(selectedWorldCupMarkets)}
                type="button"
              >
                {isBulkDeploying ? "Deploying..." : `Deploy selected markets (${selectedWorldCupMarkets.length})`}
              </button>
              <button
                className="terminal-button focus-ring px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed"
                disabled={isBulkDeploying}
                onClick={() => deployWorldCupMarkets(visibleWorldCupMarkets)}
                type="button"
              >
                Deploy visible
              </button>
              <button
                className="terminal-button focus-ring px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed"
                disabled={isBulkDeploying || selectedWorldCupGroup === "All"}
                onClick={() => deployWorldCupMarkets(visibleWorldCupMarkets)}
                type="button"
              >
                Deploy group
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
              onCreated={handleWorldCupCreated(market.id)}
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
              Final scores are display-only. Settlement uses ArcSignal resolver / UMA flow.
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

function WorldCupSignalCard({
  adminCreateEnabled,
  bulkStatus,
  market,
  onCreated,
  onSelectedChange,
  selected,
}: {
  adminCreateEnabled: boolean;
  bulkStatus?: BulkDeployStatus;
  market: WorldCupMarket;
  onCreated: (market?: DynamicMarket) => void | Promise<void>;
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
        <WorldCupThumbnail alt={market.imageAlt} imageSrc={market.imageSrc} label="WC" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 min-h-[40px] pt-0.5 text-[15px] font-bold leading-snug text-[#EAECEF]">
            {market.question}
          </h3>
          <p className="mt-1 truncate text-[11px] text-[#707A8A]">
            {market.homeTeam} vs {market.awayTeam}
          </p>
        </div>
        {adminCreateEnabled && !isTradable && (
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
          isTradable={isTradable}
          market={market}
          onCreated={onCreated}
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
  market,
  onSaved,
  result,
}: {
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
      const response = await fetch("/api/world-cup/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        Final scores are display-only. Settlement uses ArcSignal resolver / UMA flow.
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
          Final scores are display-only. Settlement uses ArcSignal resolver / UMA flow.
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
  isTradable,
  market,
  onCreated,
}: {
  adminCreateEnabled: boolean;
  bulkStatus?: BulkDeployStatus;
  isTradable: boolean;
  market: WorldCupMarket;
  onCreated: (market?: DynamicMarket) => void | Promise<void>;
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
    return <span className="shrink-0 text-[#F6465D]" title={bulkStatus.message}>Failed</span>;
  }

  if (bulkStatus?.state === "skipped") {
    return <span className="shrink-0 text-[#707A8A]">Skipped</span>;
  }

  if (adminCreateEnabled) {
    return (
      <CreateMarketDialog
        initialCategory="World Cup"
        initialSettlementRule={market.settlementRule}
        initialTitle={market.question}
        onCreated={onCreated}
        redirectOnCreated={false}
        triggerClassName="interactive-link border-0 bg-transparent p-0 text-[11px] font-bold shadow-none hover:bg-transparent"
        triggerLabel="Deploy on Arc"
        fixtureId={market.fixtureId}
        group={market.group}
        outcomeType={market.outcomeType}
        worldCupMarketId={market.id}
      />
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

function EmptyMarketState({
  isConnected,
}: {
  isConnected: boolean;
}) {
  return (
    <section className="exchange-panel p-8 text-center sm:p-12">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-[#FCD535] bg-[#FCD535] text-[#181A20]">
        <PlusCircle className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-bold text-[#EAECEF]">No onchain markets found yet.</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#707A8A]">
        Create your first ArcSignal market on Arc Testnet, then open it to trade YES or NO with ARCT test collateral.
      </p>
      {!isConnected && (
        <p className="mx-auto mt-4 max-w-lg rounded-lg border border-[#FCD535] bg-[#FCD535]/15 px-4 py-3 text-sm font-bold text-[#FFF3AF]">
          Connect wallet to trade on Arc Testnet.
        </p>
      )}
    </section>
  );
}
