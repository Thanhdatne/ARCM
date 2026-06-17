"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Address } from "viem";
import {
  Activity,
  BadgeDollarSign,
  Database,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarketAddressProvider } from "@/contexts/MarketAddressContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  useMarketState,
  useOracleState,
  useTokenBalances,
} from "@/hooks/useMarket";
import { useAMMState } from "@/hooks/useAMM";
import { formatCollateral, oracleStateLabel } from "@/hooks/market/helpers";
import { AMM_ADDRESS, MARKET_ADDRESS } from "@/lib/contracts";
import {
  MARKETS,
  ZERO_ADDRESS,
  dynamicToCardData,
  type DynamicMarket,
  type MarketCardData,
} from "@/lib/markets";

interface PortfolioMarket {
  id: string;
  title: string;
  address: Address;
  ammAddress: Address;
}

interface PortfolioSnapshot {
  hasPosition: boolean;
  hasOpenPosition: boolean;
  hasSettledPosition: boolean;
  sideCount: number;
}

export default function PortfolioPage() {
  const { address, isConnected } = useWallet();
  const [dynamicMarkets, setDynamicMarkets] = useState<MarketCardData[]>([]);
  const [positionSnapshots, setPositionSnapshots] = useState<Record<string, PortfolioSnapshot>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const walletReady = isHydrated && isConnected;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const fetchDynamicMarkets = useCallback(async () => {
    try {
      const response = await fetch("/api/markets");
      if (response.ok) {
        const data: DynamicMarket[] = await response.json();
        setDynamicMarkets(data.map(dynamicToCardData));
      }
    } catch {
      setDynamicMarkets([]);
    }
  }, []);

  useEffect(() => {
    fetchDynamicMarkets();
  }, [fetchDynamicMarkets]);

  const trackedMarkets = useMemo(() => {
    const byAddress = new Map<string, PortfolioMarket>();

    const addMarket = (market: MarketCardData) => {
      if (
        !market.isReal ||
        market.address === ZERO_ADDRESS ||
        !market.ammAddress ||
        market.ammAddress === ZERO_ADDRESS
      ) {
        return;
      }

      byAddress.set(market.address.toLowerCase(), {
        id: market.id,
        title: market.title,
        address: market.address as Address,
        ammAddress: market.ammAddress as Address,
      });
    };

    [...dynamicMarkets, ...MARKETS].forEach(addMarket);

    if (MARKET_ADDRESS !== ZERO_ADDRESS && AMM_ADDRESS !== ZERO_ADDRESS) {
      byAddress.set(MARKET_ADDRESS.toLowerCase(), {
        id: "configured-sample-market",
        title: "Configured market",
        address: MARKET_ADDRESS,
        ammAddress: AMM_ADDRESS,
      });
    }

    return Array.from(byAddress.values());
  }, [dynamicMarkets]);

  const trackedMarketKeys = useMemo(
    () => trackedMarkets.map((market) => market.address.toLowerCase()),
    [trackedMarkets],
  );

  const reportPositionSnapshot = useCallback((marketKey: string, snapshot: PortfolioSnapshot) => {
    setPositionSnapshots((current) => {
      const previous = current[marketKey];

      if (
        previous?.hasPosition === snapshot.hasPosition &&
        previous.hasOpenPosition === snapshot.hasOpenPosition &&
        previous.hasSettledPosition === snapshot.hasSettledPosition &&
        previous.sideCount === snapshot.sideCount
      ) {
        return current;
      }

      return { ...current, [marketKey]: snapshot };
    });
  }, []);

  useEffect(() => {
    const activeKeys = new Set(trackedMarketKeys);

    setPositionSnapshots((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([key]) => activeKeys.has(key)),
      );

      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [trackedMarketKeys]);

  const positionMarketCount = trackedMarketKeys.filter(
    (key) => positionSnapshots[key]?.hasPosition,
  ).length;
  const openPositionMarketCount = trackedMarketKeys.filter(
    (key) => positionSnapshots[key]?.hasOpenPosition,
  ).length;
  const settledPositionMarketCount = trackedMarketKeys.filter(
    (key) => positionSnapshots[key]?.hasSettledPosition,
  ).length;
  const sideCount = trackedMarketKeys.reduce(
    (total, key) => total + (positionSnapshots[key]?.sideCount ?? 0),
    0,
  );
  const firstTrackedMarket = trackedMarkets[0];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Portfolio</div>
        <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {["Portfolio", "Arc Testnet", "Onchain positions", "ARCT test collateral"].map((badge) => (
                <Badge
                  key={badge}
                  variant="outline"
                  className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]"
                >
                  {badge}
                </Badge>
              ))}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#EAECEF] sm:text-2xl">
              ARCM Portfolio
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#707A8A]">
              Track wallet balances, open exposure, and settled position status. Claims are handled only on the Claims page.
            </p>
          </div>
          <WalletPill address={address} isConnected={walletReady} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {firstTrackedMarket ? (
          <MarketAddressProvider
            marketAddress={firstTrackedMarket.address}
            ammAddress={firstTrackedMarket.ammAddress}
          >
            <PortfolioBalanceCard isConnected={walletReady} />
          </MarketAddressProvider>
        ) : (
          <OverviewCard icon={Wallet} label="ARCT balance" value={walletReady ? "--" : "Connect wallet"} />
        )}
        <OverviewCard
          icon={Activity}
          label="Markets with positions"
          value={walletReady ? `${positionMarketCount}` : "Connect wallet"}
        />
        <OverviewCard
          icon={Database}
          label="Position sides"
          value={walletReady ? `${sideCount}` : "Connect wallet"}
        />
        <OverviewCard
          icon={ShieldCheck}
          label="Settled positions"
          value={walletReady ? `${settledPositionMarketCount}` : "Connect wallet"}
        />
      </section>

      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Open Positions</div>
        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#EAECEF]">Active exposure</h2>
              <p className="text-xs text-[#707A8A]">
                Open YES/NO token balances across deployed ARCM markets.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
              {openPositionMarketCount} open
            </Badge>
          </div>

          {!walletReady ? (
            <EmptyState title="Connect wallet to view portfolio positions." />
          ) : trackedMarkets.length === 0 ? (
            <EmptyState title="No deployed onchain markets found yet." />
          ) : (
            <>
              <div className="space-y-3">
                {trackedMarkets.map((market) => (
                  <MarketAddressProvider
                    key={`open-${market.id}-${market.address}`}
                    marketAddress={market.address}
                    ammAddress={market.ammAddress}
                  >
                    <PortfolioMarketRow
                      fallbackTitle={market.title}
                      marketAddress={market.address}
                      mode="open"
                      onSnapshot={reportPositionSnapshot}
                    />
                  </MarketAddressProvider>
                ))}
              </div>

              {openPositionMarketCount === 0 && (
                <EmptyState title="No open positions found for this wallet." />
              )}
            </>
          )}
        </div>
      </section>

      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Position History</div>
        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#EAECEF]">Settled position status</h2>
              <p className="text-xs text-[#707A8A]">
                Settled markets with wallet balances. Claim actions stay on the Claims page.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
              {settledPositionMarketCount} settled
            </Badge>
          </div>

          {!walletReady ? (
            <EmptyState title="Connect wallet to view settled position history." />
          ) : trackedMarkets.length === 0 ? (
            <EmptyState title="No deployed onchain markets found yet." />
          ) : (
            <>
              <div className="space-y-3">
                {trackedMarkets.map((market) => (
                  <MarketAddressProvider
                    key={`history-${market.id}-${market.address}`}
                    marketAddress={market.address}
                    ammAddress={market.ammAddress}
                  >
                    <PortfolioMarketRow
                      fallbackTitle={market.title}
                      marketAddress={market.address}
                      mode="settled"
                      onSnapshot={reportPositionSnapshot}
                    />
                  </MarketAddressProvider>
                ))}
              </div>

              {settledPositionMarketCount === 0 && (
                <EmptyState title="No settled positions found for this wallet." />
              )}
            </>
          )}
        </div>
      </section>

      <section className="exchange-panel">
        <div className="terminal-titlebar flex items-center gap-2 px-3 py-1.5">
          <ShieldCheck className="h-4 w-4" />
          <h2 className="text-sm font-bold">Portfolio rules</h2>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatusTile label="Portfolio" value="Positions only" />
          <StatusTile label="Claims" value="Handled on /claims" />
          <StatusTile label="Collateral" value="ARCT test collateral" />
          <StatusTile label="Privacy" value="Positions public today" />
        </div>
      </section>
    </div>
  );
}

function PortfolioBalanceCard({ isConnected }: { isConnected: boolean }) {
  const { longTokenAddress, shortTokenAddress } = useMarketState();
  const { arctBalance } = useTokenBalances(longTokenAddress, shortTokenAddress);

  return (
    <OverviewCard
      icon={Wallet}
      label="ARCT balance"
      value={isConnected ? `${formatCollateral(arctBalance)} ARCT` : "Connect wallet"}
    />
  );
}

function PortfolioMarketRow({
  fallbackTitle,
  marketAddress,
  mode,
  onSnapshot,
}: {
  fallbackTitle: string;
  marketAddress: Address;
  mode: "open" | "settled";
  onSnapshot: (marketKey: string, snapshot: PortfolioSnapshot) => void;
}) {
  const {
    question,
    pairName,
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
  const { yesPrice, noPrice } = useAMMState();
  const { oracleState } = useOracleState(priceIdentifier, requestTimestamp, ancillaryDataHex);

  const yesBalance = longBalance ?? 0n;
  const noBalance = shortBalance ?? 0n;
  const hasYes = yesBalance > 0n;
  const hasNo = noBalance > 0n;
  const hasPosition = hasYes || hasNo;
  const isSettled = Boolean(receivedSettlementPrice);
  const hasOpenPosition = hasPosition && !isSettled;
  const hasSettledPosition = hasPosition && isSettled;
  const sideCount = Number(hasYes) + Number(hasNo);
  const marketTitle = question ?? pairName ?? fallbackTitle;
  const winningSide = isSettled
    ? settlementPrice === 1000000000000000000n
      ? "YES"
      : settlementPrice === 0n
        ? "NO"
        : "Undetermined"
    : "Pending";
  const marketStatus = isSettled
    ? "Settled"
    : priceRequested
      ? "Open"
      : "Not initialized";

  useEffect(() => {
    onSnapshot(marketAddress.toLowerCase(), {
      hasPosition,
      hasOpenPosition,
      hasSettledPosition,
      sideCount,
    });
  }, [hasOpenPosition, hasPosition, hasSettledPosition, marketAddress, onSnapshot, sideCount]);

  if (mode === "open" && !hasOpenPosition) return null;
  if (mode === "settled" && !hasSettledPosition) return null;

  return (
    <article className="terminal-surface p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
              {marketStatus}
            </Badge>
            <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#707A8A]">
              {oracleStateLabel(oracleState, { priceRequested: !!priceRequested })}
            </Badge>
          </div>
          <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-[#EAECEF]">
            {marketTitle}
          </h3>
          {isSettled && (
            <p className="mt-2 text-xs text-[#707A8A]">
              Winning side: <span className="font-bold text-[#EAECEF]">{winningSide}</span>. Rewards, if any, are managed in Claims.
            </p>
          )}
        </div>

        <Link
          className="interactive-link w-fit shrink-0 text-xs"
          href={`/market/${marketAddress}`}
        >
          Open market detail
        </Link>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {hasYes && (
          <PositionSideCard
            amount={`${formatCollateral(yesBalance)} shares`}
            currentPrice={yesPrice !== undefined ? `${Math.round(yesPrice)}%` : "--"}
            side="YES"
            status={marketStatus}
          />
        )}
        {hasNo && (
          <PositionSideCard
            amount={`${formatCollateral(noBalance)} shares`}
            currentPrice={noPrice !== undefined ? `${Math.round(noPrice)}%` : "--"}
            side="NO"
            status={marketStatus}
          />
        )}
      </div>
    </article>
  );
}

function WalletPill({
  address,
  isConnected,
}: {
  address: string | undefined;
  isConnected: boolean;
}) {
  return (
    <div className="terminal-card p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#707A8A]">Wallet</p>
      <p className="mt-2 font-mono text-sm font-bold text-[#EAECEF]">
        {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connect wallet"}
      </p>
    </div>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="terminal-surface p-3">
      <div className="terminal-card mb-3 flex h-8 w-8 items-center justify-center text-[#FCD535]">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#707A8A]">{label}</p>
      <p className="mt-2 font-mono text-lg font-bold text-[#EAECEF]">{value}</p>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="terminal-card p-6 text-center text-sm text-[#707A8A]">
      {title}
    </div>
  );
}

function PositionSideCard({
  amount,
  currentPrice,
  side,
  status,
}: {
  amount: string;
  currentPrice: string;
  side: "YES" | "NO";
  status: string;
}) {
  const isYes = side === "YES";

  return (
    <div className="rounded-lg border border-[#2B3139] bg-[#0B0E11] p-3">
      <div className="flex items-center justify-between gap-3">
        <Badge
          variant="outline"
          className={
            isYes
              ? "border-[#0ECB81] bg-[#0ECB81]/15 text-[#BFFFE7]"
              : "border-[#F6465D] bg-[#F6465D]/15 text-[#FFD7DD]"
          }
        >
          {side}
        </Badge>
        <p className="font-mono text-xl font-black text-[#EAECEF]">{currentPrice}</p>
      </div>
      <div className="mt-3 grid gap-2 text-[11px] text-[#707A8A] sm:grid-cols-3">
        <MetaLine icon={Activity} value={amount} />
        <MetaLine icon={Database} value="ARCT" />
        <MetaLine icon={ShieldCheck} value={status} />
      </div>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="terminal-card p-3">
      <p className="text-xs text-[#707A8A]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#EAECEF]">{value}</p>
    </div>
  );
}

function MetaLine({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="terminal-card flex items-center gap-1.5 px-2 py-1.5">
      <Icon className="h-3.5 w-3.5 text-[#FCD535]" />
      <span>{value}</span>
    </div>
  );
}

