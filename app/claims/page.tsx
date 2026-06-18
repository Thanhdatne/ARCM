"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Address } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TxStatus } from "@/components/trading/TxStatus";
import { MarketAddressProvider } from "@/contexts/MarketAddressContext";
import { useWallet } from "@/contexts/WalletContext";
import { useSettlePosition } from "@/hooks/useMarket";
import { formatCollateral } from "@/hooks/market/helpers";
import { BadgeDollarSign, RefreshCw, ShieldCheck } from "lucide-react";

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
  const [claimedIds, setClaimedIds] = useState<Record<string, boolean>>({});

  const walletReady = isHydrated && isConnected && !!address;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const claimableMarkets = useMemo(() => {
    return (response?.markets ?? []).filter((market) => !claimedIds[market.id]);
  }, [claimedIds, response?.markets]);

  const claimedCount = Object.values(claimedIds).filter(Boolean).length;

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
                  <MarketAddressProvider
                    key={`${market.id}-${market.address}`}
                    marketAddress={market.address}
                    ammAddress={market.ammAddress}
                  >
                    <ApiClaimRow
                      market={market}
                      onClaimed={() => {
                        setClaimedIds((current) => ({ ...current, [market.id]: true }));
                        window.setTimeout(() => void loadClaimable(true), 2_500);
                      }}
                    />
                  </MarketAddressProvider>
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

      <section className="exchange-panel">
        <div className="terminal-titlebar flex items-center justify-between gap-3 px-3 py-2 text-sm font-bold">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Claim History
          </span>
          <span className="rounded-full border border-[#2B3139] px-2 py-0.5 text-[11px] text-[#707A8A]">
            {claimedCount} claimed this session
          </span>
        </div>
        <div className="space-y-1.5 p-3">
          {claimedCount === 0 ? (
            <EmptyState title="No claimed rewards in this session." />
          ) : (
            <EmptyState title={`${claimedCount} reward claim transaction submitted in this session.`} />
          )}
        </div>
      </section>
    </div>
  );
}

function ApiClaimRow({
  market,
  onClaimed,
}: {
  market: ApiClaimMarket;
  onClaimed: () => void;
}) {
  const settlePos = useSettlePosition();
  const claimLongAmount = BigInt(market.claimLongAmount);
  const claimShortAmount = BigInt(market.claimShortAmount);
  const payoutAmount = BigInt(market.payoutAmount);

  useEffect(() => {
    if (settlePos.isSuccess) onClaimed();
  }, [onClaimed, settlePos.isSuccess]);

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
              {market.collateralSymbol ?? "ARCT"} collateral
            </Badge>
          </div>
          <h3 className="line-clamp-2 text-sm font-bold text-[#EAECEF]">{market.title}</h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#707A8A]">
            <span>
              Reward:{" "}
              <span className="font-mono font-bold text-[#FCD535]">
                {market.payoutAmountFormatted ?? formatCollateral(payoutAmount)}{" "}
                {market.collateralSymbol ?? "ARCT"}
              </span>
            </span>
            <span>
              YES {formatCollateral(BigInt(market.yesBalance))} / NO{" "}
              {formatCollateral(BigInt(market.noBalance))}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <Button
            className="h-9 w-full lg:w-auto"
            onClick={() => settlePos.settle(claimLongAmount, claimShortAmount)}
            disabled={settlePos.isPending || settlePos.isConfirming || settlePos.isSuccess}
          >
            {settlePos.isPending || settlePos.isConfirming
              ? "Claiming..."
              : settlePos.isSuccess
                ? "Claimed"
                : "Claim Reward"}
          </Button>
          <Link className="interactive-link w-fit text-xs" href={`/market/${market.address}`}>
            Open detail
          </Link>
        </div>
      </div>
      <TxStatus {...settlePos} />
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
