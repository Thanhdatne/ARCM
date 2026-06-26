"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeDollarSign, RefreshCw, WalletCards } from "lucide-react";
import { type Address } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { formatTokenDisplayAmount } from "@/hooks/market/helpers";

interface PortfolioPosition {
  id: string;
  fixtureId?: string;
  group?: string;
  title: string;
  address: Address;
  ammAddress: Address;
  yesBalance: string;
  noBalance: string;
  isSettled: boolean;
  winningSide: "YES" | "NO" | "Mixed" | null;
  claimablePayout: string;
  claimablePayoutFormatted?: string;
  collateralAddress?: Address;
  collateralSymbol?: string;
  collateralName?: string;
  collateralDecimals?: number;
  collateralBalance?: string;
  collateralBalanceFormatted?: string;
  collateralWarning?: boolean;
  outcomeDecimals?: number;
}

interface PortfolioResponse {
  success?: boolean;
  error?: string;
  arctBalance?: string;
  positions?: PortfolioPosition[];
  totals?: {
    marketsWithPositions: number;
    openPositions: number;
    settledPositions: number;
    sideCount: number;
  };
}

export default function PortfolioPage() {
  const { address, isConnected } = useWallet();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState("");

  const walletReady = isHydrated && isConnected && !!address;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const loadPortfolio = useCallback(async (forceRefresh = false) => {
    if (!walletReady || !address) {
      setPortfolio(null);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const refreshParam = forceRefresh ? "&refresh=1" : "";
      const res = await fetch(`/api/portfolio/positions?address=${address}${refreshParam}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as PortfolioResponse;

      if (!res.ok) {
        throw new Error(data.error || "Failed to load portfolio.");
      }

      setPortfolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portfolio.");
      setPortfolio(null);
    } finally {
      setIsLoading(false);
    }
  }, [address, walletReady]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const positions = portfolio?.positions ?? [];
  const openPositions = useMemo(
    () => positions.filter((position) => !position.isSettled),
    [positions],
  );
  const settledPositions = useMemo(
    () => positions.filter((position) => position.isSettled),
    [positions],
  );
  const marketsWithPositions = portfolio?.totals?.marketsWithPositions ?? positions.length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Portfolio</div>
        <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#EAECEF] sm:text-3xl">
              ARCM Portfolio
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#707A8A]">
              Track open positions, settled rewards, and Arc USDC balance.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <WalletPill address={address} isConnected={walletReady} />
            <Button
              className="h-8 gap-2 px-3 text-xs"
              disabled={!walletReady || isLoading}
              onClick={() => void loadPortfolio(true)}
              type="button"
              variant="outline"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Checking..." : "Refresh"}
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <OverviewCard label="World Cup V2 collateral" value="USDC" />
        <OverviewCard
          label="Markets with positions"
          value={walletReady ? `${marketsWithPositions}` : "Connect wallet"}
        />
        <OverviewCard
          label="Open positions"
          value={walletReady ? `${openPositions.length}` : "Connect wallet"}
        />
      </section>

      <section className="exchange-panel">
        <div className="terminal-titlebar flex items-center justify-between gap-3 px-3 py-2 text-sm font-bold">
          <span className="flex items-center gap-2">
            <WalletCards className="h-4 w-4" />
            Open Positions
          </span>
          <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
            {openPositions.length} open
          </Badge>
        </div>

        <div className="space-y-2 p-3">
          {!walletReady ? (
            <EmptyState title="Connect wallet to view positions." />
          ) : error ? (
            <EmptyState title={error} />
          ) : isLoading && !portfolio ? (
            <EmptyState title="Checking wallet positions..." />
          ) : openPositions.length === 0 ? (
            <EmptyState title="No open YES/NO positions found for this wallet." />
          ) : (
            openPositions.map((position) => (
              <PositionRow key={position.address} position={position} />
            ))
          )}
        </div>
      </section>

      {settledPositions.length > 0 && (
        <section className="exchange-panel">
          <div className="terminal-titlebar flex items-center justify-between gap-3 px-3 py-2 text-sm font-bold">
            <span className="flex items-center gap-2">
              <BadgeDollarSign className="h-4 w-4" />
              Settled Positions
            </span>
            <Link className="interactive-link text-xs" href="/claims">
              Go to Claims
            </Link>
          </div>

          <div className="space-y-2 p-3">
            {settledPositions.map((position) => (
              <PositionRow key={position.address} position={position} settled />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PositionRow({
  position,
  settled = false,
}: {
  position: PortfolioPosition;
  settled?: boolean;
}) {
  const yesBalance = BigInt(position.yesBalance);
  const noBalance = BigInt(position.noBalance);
  const claimablePayout = BigInt(position.claimablePayout);
  const collateralDecimals = position.collateralDecimals ?? 6;
  const outcomeDecimals = position.outcomeDecimals ?? collateralDecimals;
  const collateralSymbol = position.collateralSymbol ?? "USDC";

  return (
    <article className="terminal-card p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                settled
                  ? "border-[#FF8A00] bg-[#FF8A00]/15 text-[#FF9D2E]"
                  : "border-[#0ECB81] bg-[#0ECB81]/15 text-[#BFFFE7]"
              }
            >
              {settled ? "Settled" : "Open"}
            </Badge>
            {position.winningSide && (
              <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                Winner {position.winningSide}
              </Badge>
            )}
            <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
              {collateralSymbol} collateral
            </Badge>
          </div>

          <h3 className="line-clamp-2 text-sm font-bold text-[#EAECEF]">
            {position.title}
          </h3>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#707A8A]">
            {yesBalance > 0n && (
              <span>
                YES{" "}
                <span className="font-mono font-bold text-[#0ECB81]">
                  {formatTokenDisplayAmount(yesBalance, outcomeDecimals)}
                </span>
              </span>
            )}
            {noBalance > 0n && (
              <span>
                NO{" "}
                <span className="font-mono font-bold text-[#F6465D]">
                  {formatTokenDisplayAmount(noBalance, outcomeDecimals)}
                </span>
              </span>
            )}
            {settled && claimablePayout > 0n && (
              <span>
                Claimable{" "}
                <span className="font-mono font-bold text-[#FF8A00]">
                  {position.claimablePayoutFormatted ??
                    formatTokenDisplayAmount(
                      claimablePayout,
                      collateralDecimals,
                    )}{" "}
                  {collateralSymbol}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 lg:justify-end">
          <Link className="interactive-link w-fit text-xs" href={`/market/${position.address}?tab=resolve`}>
            Open Resolve
          </Link>
          {settled && claimablePayout > 0n && (
            <Link className="interactive-link w-fit text-xs" href={`/market/${position.address}?tab=resolve`}>
              Claim
            </Link>
          )}
        </div>
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
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="terminal-surface p-3">
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
