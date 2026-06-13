"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { type Address } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TxStatus } from "@/components/trading/TxStatus";
import { MarketAddressProvider } from "@/contexts/MarketAddressContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  useMarketState,
  useOracleState,
  useSettlePosition,
  useTokenBalances,
} from "@/hooks/useMarket";
import { formatCollateral } from "@/hooks/market/helpers";
import { AMM_ADDRESS, MARKET_ADDRESS } from "@/lib/contracts";
import {
  MARKETS,
  ZERO_ADDRESS,
  dynamicToCardData,
  type DynamicMarket,
  type MarketCardData,
} from "@/lib/markets";
import { ShieldCheck } from "lucide-react";

const ONE = 1000000000000000000n;

interface ClaimMarket {
  id: string;
  title: string;
  address: Address;
  ammAddress: Address;
}

interface ClaimSnapshot {
  isClaimable: boolean;
  isHistoryVisible: boolean;
  isLoaded: boolean;
}

export default function ClaimsPage() {
  const { address, isConnected } = useWallet();
  const [dynamicMarkets, setDynamicMarkets] = useState<MarketCardData[]>([]);
  const [claimSnapshots, setClaimSnapshots] = useState<Record<string, ClaimSnapshot>>({});

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

  const claimMarkets = useMemo(() => {
    const byAddress = new Map<string, ClaimMarket>();

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

  const claimMarketKeys = useMemo(
    () => claimMarkets.map((market) => market.address.toLowerCase()),
    [claimMarkets],
  );
  const reportClaimSnapshot = useCallback((marketKey: string, snapshot: ClaimSnapshot) => {
    setClaimSnapshots((current) => {
      const previous = current[marketKey];
      if (
        previous?.isLoaded === snapshot.isLoaded &&
        previous.isClaimable === snapshot.isClaimable &&
        previous.isHistoryVisible === snapshot.isHistoryVisible
      ) {
        return current;
      }

      return { ...current, [marketKey]: snapshot };
    });
  }, []);
  const claimableCount = claimMarketKeys.filter((key) => claimSnapshots[key]?.isClaimable).length;
  const historyCount = claimMarketKeys.filter((key) => claimSnapshots[key]?.isHistoryVisible).length;

  useEffect(() => {
    const activeKeys = new Set(claimMarketKeys);
    setClaimSnapshots((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([key]) => activeKeys.has(key)),
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [claimMarketKeys]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Claims</div>
        <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {["Claims", "Arc Testnet", "UMA OO V2", "ARCT test collateral"].map((badge) => (
                <Badge key={badge} variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                  {badge}
                </Badge>
              ))}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#EAECEF] sm:text-2xl">
              Claims
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#707A8A]">
              Claim settled market payouts through Arc Testnet market contracts.
              Payout buttons only appear when real wallet balances are claimable.
            </p>
          </div>
          <WalletPill address={address} isConnected={isConnected} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="exchange-panel">
          <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Claimable Payouts</div>
          <div className="space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#EAECEF]">Ready to claim</h2>
                <p className="text-xs text-[#707A8A]">
                  Only settled winning positions with real claimable ARCT rewards appear here.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                {claimableCount} claimable
              </Badge>
            </div>

            {!isConnected ? (
              <EmptyState title="Connect wallet to view claimable payouts." />
            ) : claimMarkets.length === 0 ? (
              <EmptyState title="No configured onchain market address found. Deploy contracts or create a market first." />
            ) : (
              <>
                <div className="space-y-2">
                  {claimMarkets.map((market) => (
                    <MarketAddressProvider
                      key={`claimable-${market.id}-${market.address}`}
                      marketAddress={market.address}
                      ammAddress={market.ammAddress}
                    >
                      <ClaimMarketRow
                        fallbackTitle={market.title}
                        marketAddress={market.address}
                        mode="claimable"
                        onSnapshot={reportClaimSnapshot}
                      />
                    </MarketAddressProvider>
                  ))}
                </div>
                {claimableCount === 0 && (
                  <EmptyState title="No claimable rewards yet. Settled winning markets will appear here after settlement." />
                )}
              </>
            )}
          </div>
        </section>

        <section className="exchange-panel">
          <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Settlement Status</div>
          <div className="grid gap-2 p-3">
            <StatusTile label="Network" value="Arc Testnet" />
            <StatusTile label="Collateral" value="ARCT test collateral" />
            <StatusTile label="Settlement" value="UMA Optimistic Oracle V2" />
            <p className="terminal-card p-3 text-xs leading-5 text-[#707A8A]">
              Claim Reward redeems real winning YES/NO tokens for ARCT payout. Frontend data does not trigger payouts.
            </p>
          </div>
        </section>
      </section>

      <details className="exchange-panel">
        <summary className="terminal-titlebar flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-bold">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Other settled markets / History
          </span>
          <span className="rounded-full border border-[#2B3139] px-2 py-0.5 text-[11px] text-[#707A8A]">
            {historyCount} rows
          </span>
        </summary>
        <div className="space-y-1.5 p-3">
          {!isConnected ? (
            <EmptyState title="Connect wallet to view market history." />
          ) : claimMarkets.length === 0 ? (
            <EmptyState title="No tracked onchain markets found." />
          ) : (
            <>
              {claimMarkets.map((market) => (
                <MarketAddressProvider
                  key={`history-${market.id}-${market.address}`}
                  marketAddress={market.address}
                  ammAddress={market.ammAddress}
                >
                  <ClaimMarketRow
                    fallbackTitle={market.title}
                    marketAddress={market.address}
                    mode="history"
                    onSnapshot={reportClaimSnapshot}
                  />
                </MarketAddressProvider>
              ))}
              {historyCount === 0 && (
                <EmptyState title="No pending, settled, or claimed markets to show." />
              )}
            </>
          )}
        </div>
      </details>
    </div>
  );
}

function ClaimMarketRow({
  fallbackTitle,
  marketAddress,
  mode,
  onSnapshot,
}: {
  fallbackTitle: string;
  marketAddress: Address;
  mode: "claimable" | "history";
  onSnapshot: (marketKey: string, snapshot: ClaimSnapshot) => void;
}) {
  const queryClient = useQueryClient();
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
    refetch: refetchMarket,
  } = useMarketState();
  const {
    longBalance,
    shortBalance,
    refetch: refetchBalances,
  } = useTokenBalances(longTokenAddress, shortTokenAddress);
  const { refetch: refetchOracle } = useOracleState(
    priceIdentifier,
    requestTimestamp,
    ancillaryDataHex,
  );
  const settlePos = useSettlePosition();

  const claimableLong =
    receivedSettlementPrice && settlementPrice !== undefined && settlementPrice > 0n
      ? longBalance ?? 0n
      : 0n;
  const claimableShort =
    receivedSettlementPrice && settlementPrice !== undefined && settlementPrice < ONE
      ? shortBalance ?? 0n
      : 0n;
  const payoutAmount =
    settlementPrice !== undefined
      ? (claimableLong * settlementPrice + claimableShort * (ONE - settlementPrice)) / ONE
      : 0n;
  const isClaimable = Boolean(receivedSettlementPrice && payoutAmount > 0n);
  const isClaimed = settlePos.isSuccess;
  const showAsClaimable = isClaimable && !isClaimed;
  const showInHistory = !showAsClaimable;
  const marketTitle = question ?? pairName ?? fallbackTitle;
  const outcome = receivedSettlementPrice
    ? settlementPrice === ONE
      ? "YES"
      : settlementPrice === 0n
        ? "NO"
        : "Undetermined"
    : "Pending";
  const status = !receivedSettlementPrice
    ? priceRequested
      ? "Pending settlement"
      : "Pending"
    : isClaimed
      ? "Claimed"
      : isClaimable
        ? "Claimable"
        : "No payout";

  useEffect(() => {
    onSnapshot(marketAddress.toLowerCase(), {
      isClaimable: showAsClaimable,
      isHistoryVisible: showInHistory,
      isLoaded: true,
    });
  }, [marketAddress, onSnapshot, showAsClaimable, showInHistory]);

  useEffect(() => {
    if (!settlePos.isSuccess) return;

    queryClient.invalidateQueries({ queryKey: ["readContracts"] });
    queryClient.invalidateQueries({ queryKey: ["readContract"] });
    refetchBalances();
    refetchMarket();
    refetchOracle();
  }, [settlePos.isSuccess, queryClient, refetchBalances, refetchMarket, refetchOracle]);

  if (mode === "claimable") {
    if (!showAsClaimable) return null;

    return (
      <article className="terminal-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-bold text-[#EAECEF]">{marketTitle}</h3>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#707A8A]">
              <span>
                Winning side: <span className="font-bold text-[#EAECEF]">{outcome}</span>
              </span>
              <span>
                Claimable:{" "}
                <span className="font-mono font-bold text-[#FCD535]">
                  {formatCollateral(payoutAmount)} ARCT
                </span>
              </span>
            </div>
          </div>
          <Button
            className="h-9 w-full lg:w-auto"
            onClick={() => settlePos.settle(claimableLong, claimableShort)}
            disabled={settlePos.isPending || settlePos.isConfirming}
          >
            {settlePos.isPending || settlePos.isConfirming ? "Claiming..." : "Claim Reward"}
          </Button>
        </div>
        <TxStatus {...settlePos} />
      </article>
    );
  }

  if (!showInHistory) return null;

  return (
    <article className="grid gap-2 rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-2 text-xs text-[#707A8A] md:grid-cols-[1fr_auto_auto_auto] md:items-center">
      <h3 className="line-clamp-1 text-sm font-semibold text-[#EAECEF]">{marketTitle}</h3>
      <span className="rounded-full border border-[#2B3139] px-2 py-1 font-bold text-[#EAECEF]">
        {status}
      </span>
      <span className="font-mono">
        {isClaimed ? "claimed" : `${formatCollateral(payoutAmount)} ARCT`}
      </span>
      <Link className="interactive-link w-fit text-xs" href={`/market/${marketAddress}`}>
        Open market detail
      </Link>
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

function EmptyState({ title }: { title: string }) {
  return (
    <div className="terminal-card p-6 text-center text-sm text-[#707A8A]">
      {title}
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
