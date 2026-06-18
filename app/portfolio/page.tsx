"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeDollarSign, RefreshCw, WalletCards } from "lucide-react";
import { type Address } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import {
  formatCollateral,
  formatTokenDisplayAmount,
} from "@/hooks/market/helpers";

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

  const loadPortfolio = useCallback(async () => {
    if (!walletReady || !address) {
      setPortfolio(null);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/portfolio/positions?address=${address}`, {
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
  const arctBalance = BigInt(portfolio?.arctBalance ?? "0");
  const marketsWithPositions = portfolio?.totals?.marketsWithPositions ?? positions.length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Portfolio</div>
        <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {["Portfolio", "Arc Testnet", "ARCT"].map((badge) => (
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
              Your live wallet balance and open YES/NO positions. Claimable rewards stay on Claims.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <WalletPill address={address} isConnected={walletReady} />
            <Button
              className="h-8 gap-2 px-3 text-xs"
              disabled={!walletReady || isLoading}
              onClick={loadPortfolio}
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
        <OverviewCard
          label="ARCT balance"
          value={walletReady ? `${formatCollateral(arctBalance)} ARCT` : "Connect wallet"}
        />
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

  return (
    <article className="terminal-card p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                settled
                  ? "border-[#FCD535] bg-[#FCD535]/15 text-[#FFF3AF]"
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
              {position.collateralSymbol ?? "ARCT"} collateral
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
                  {formatCollateral(yesBalance)}
                </span>
              </span>
            )}
            {noBalance > 0n && (
              <span>
                NO{" "}
                <span className="font-mono font-bold text-[#F6465D]">
                  {formatCollateral(noBalance)}
                </span>
              </span>
            )}
            {settled && claimablePayout > 0n && (
              <span>
                Claimable{" "}
                <span className="font-mono font-bold text-[#FCD535]">
                  {position.claimablePayoutFormatted ??
                    formatTokenDisplayAmount(
                      claimablePayout,
                      position.collateralDecimals ?? 18,
                    )}{" "}
                  {position.collateralSymbol ?? "ARCT"}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 lg:justify-end">
          <Link className="interactive-link w-fit text-xs" href={`/market/${position.address}`}>
            Open detail
          </Link>
          {settled && claimablePayout > 0n && (
            <Link className="interactive-link w-fit text-xs" href="/claims">
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
