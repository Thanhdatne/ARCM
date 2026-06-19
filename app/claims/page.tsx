"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Address } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { formatTokenDisplayAmount } from "@/hooks/market/helpers";
import { BadgeDollarSign, RefreshCw } from "lucide-react";

interface ApiClaimMarket {
  id: string;
  fixtureId: string;
  group: string;
  title: string;
  address: Address;
  ammAddress: Address;
  winningSide: "YES" | "NO" | "Mixed";
  claimLongAmount: string;
  claimShortAmount: string;
  payoutAmount: string;
  payoutAmountFormatted?: string;
  yesBalance: string;
  noBalance: string;
  collateralAddress?: Address;
  collateralSymbol?: string;
  collateralName?: string;
  collateralDecimals?: number;
  collateralWarning?: boolean;
  outcomeDecimals?: number;
}

interface ClaimableResponse {
  success?: boolean;
  error?: string;
  scanned?: number;
  settled?: number;
  failed?: number;
  withWinningBalance?: number;
  markets?: ApiClaimMarket[];
}

export default function ClaimsPage() {
  const { address, isConnected } = useWallet();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const [response, setResponse] = useState<ClaimableResponse | null>(null);

  const walletReady = isHydrated && isConnected && !!address;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const claimableMarkets = useMemo(() => response?.markets ?? [], [response?.markets]);

  const loadClaimable = useCallback(async (forceRefresh = false) => {
    if (!walletReady || !address) {
      setResponse(null);
      return;
    }

    setIsLoading(true);
    setScanError("");

    try {
      const refreshParam = forceRefresh ? "&refresh=1" : "";
      const res = await fetch(`/api/world-cup/claimable?address=${address}${refreshParam}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as ClaimableResponse;

      if (!res.ok) {
        throw new Error(data.error || "Failed to scan claimable rewards.");
      }

      setResponse(data);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Failed to scan claimable rewards.");
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  }, [address, walletReady]);

  useEffect(() => {
    void loadClaimable(false);
  }, [loadClaimable]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Claims</div>
        <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {["Claims", "Claim Reward", "Arc Testnet", "Collateral payout"].map((badge) => (
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
              Claim Rewards
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#707A8A]">
              Only settled winning YES/NO positions for the connected wallet appear here.
            </p>
          </div>
          <WalletPill address={address} isConnected={walletReady} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="exchange-panel">
          <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Claimable Rewards</div>
          <div className="space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#EAECEF]">Ready to claim</h2>
                <p className="text-xs text-[#707A8A]">
                  This scans settled World Cup markets and shows only winning balances.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {response ? (
                  <Badge variant="outline" className="w-fit border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                    {claimableMarkets.length} claimable
                  </Badge>
                ) : null}
                <Button
                  className="h-8 gap-2 px-3 text-xs"
                  disabled={!walletReady || isLoading}
                  onClick={() => void loadClaimable(true)}
                  type="button"
                  variant="outline"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  {isLoading ? "Checking..." : "Refresh"}
                </Button>
              </div>
            </div>

            {!walletReady ? (
              <EmptyState title="Connect wallet to view claimable rewards." />
            ) : scanError ? (
              <EmptyState title={scanError} />
            ) : isLoading && !response ? (
              <EmptyState title="Checking claimable rewards..." />
            ) : claimableMarkets.length === 0 ? (
              <EmptyState title="No claimable winning position found for this wallet." />
            ) : (
              <div className="space-y-2">
                {claimableMarkets.map((market) => (
                  <ApiClaimRow key={`${market.id}-${market.address}`} market={market} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="exchange-panel">
          <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Claim Rules</div>
          <div className="grid gap-2 p-3">
            <StatusTile label="Network" value="Arc Testnet" />
            <StatusTile label="Reward token" value="Per-market collateral" />
            <StatusTile label="Settlement" value="UMA Optimistic Oracle V2" />
            <p className="terminal-card p-3 text-xs leading-5 text-[#707A8A]">
              Claims redeem real winning YES/NO tokens for the collateral configured by each market. If you traded the losing side, nothing appears here.
            </p>
          </div>
        </section>
      </section>

    </div>
  );
}

function ApiClaimRow({ market }: { market: ApiClaimMarket }) {
  const payoutAmount = BigInt(market.payoutAmount);
  const collateralDecimals = market.collateralDecimals ?? 6;
  const outcomeDecimals = market.outcomeDecimals ?? collateralDecimals;
  const collateralSymbol = market.collateralSymbol ?? "USDC";

  return (
    <article className="terminal-card p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <BadgeDollarSign className="h-4 w-4 text-[#FCD535]" />
            <Badge variant="outline" className="border-[#0ECB81] bg-[#0ECB81]/15 text-[#BFFFE7]">
              Claimable
            </Badge>
            <Badge variant="outline" className="border-[#FCD535] bg-[#FCD535]/15 text-[#FFF3AF]">
              {market.winningSide} won
            </Badge>
            <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
              {collateralSymbol} collateral
            </Badge>
          </div>
          <h3 className="line-clamp-2 text-sm font-bold text-[#EAECEF]">{market.title}</h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#707A8A]">
            <span>
              Reward:{" "}
              <span className="font-mono font-bold text-[#FCD535]">
                {market.payoutAmountFormatted ?? formatTokenDisplayAmount(payoutAmount, collateralDecimals)}{" "}
                {collateralSymbol}
              </span>
            </span>
            <span>
              YES {formatTokenDisplayAmount(BigInt(market.yesBalance), outcomeDecimals)} / NO{" "}
              {formatTokenDisplayAmount(BigInt(market.noBalance), outcomeDecimals)}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <Link
            className="terminal-button focus-ring px-3 py-2 text-sm font-bold"
            href={`/market/${market.address}?tab=resolve`}
          >
            Open Claim Flow
          </Link>
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
