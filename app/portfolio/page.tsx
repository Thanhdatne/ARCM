"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/contexts/WalletContext";
import { MarketAddressProvider } from "@/contexts/MarketAddressContext";
import { useMarketState, useOracleState, useTokenBalances } from "@/hooks/useMarket";
import { useAMMState } from "@/hooks/useAMM";
import { formatCollateral, oracleStateLabel } from "@/hooks/market/helpers";
import { AMM_ADDRESS, MARKET_ADDRESS } from "@/lib/contracts";
import { ZERO_ADDRESS } from "@/lib/markets";
import { Activity, BadgeDollarSign, Database, ShieldCheck, Wallet } from "lucide-react";

const hasConfiguredMarket = MARKET_ADDRESS !== ZERO_ADDRESS && AMM_ADDRESS !== ZERO_ADDRESS;

export default function PortfolioPage() {
  return (
    <MarketAddressProvider marketAddress={MARKET_ADDRESS} ammAddress={AMM_ADDRESS}>
      <PortfolioContent />
    </MarketAddressProvider>
  );
}

function PortfolioContent() {
  const { address, isConnected } = useWallet();
  const {
    question,
    pairName,
    priceRequested,
    receivedSettlementPrice,
    longTokenAddress,
    shortTokenAddress,
    priceIdentifier,
    requestTimestamp,
    ancillaryDataHex,
  } = useMarketState();
  const { longBalance, shortBalance, arctBalance } = useTokenBalances(
    longTokenAddress,
    shortTokenAddress,
  );
  const { yesPrice, noPrice } = useAMMState();
  const { oracleState } = useOracleState(priceIdentifier, requestTimestamp, ancillaryDataHex);

  const hasYes = (longBalance ?? 0n) > 0n;
  const hasNo = (shortBalance ?? 0n) > 0n;
  const hasPosition = isConnected && (hasYes || hasNo);
  const marketTitle = question ?? pairName ?? "Configured market";
  const marketStatus = receivedSettlementPrice ? "Settled" : priceRequested ? "Open" : "Not initialized";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Portfolio</div>
        <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {["Arc Testnet", "Onchain positions", "ARCT test collateral"].map((badge) => (
                <Badge key={badge} variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                  {badge}
                </Badge>
              ))}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#EAECEF] sm:text-2xl">
              ArcSignal Portfolio
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#707A8A]">
              Track real wallet balances for the configured Arc Testnet market. No simulated positions are shown as wallet data.
            </p>
          </div>
          <WalletPill address={address} isConnected={isConnected} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OverviewCard icon={Wallet} label="ARCT balance" value={isConnected ? `${formatCollateral(arctBalance)} ARCT` : "Connect wallet"} />
        <OverviewCard icon={Activity} label="YES tokens" value={isConnected ? formatCollateral(longBalance) : "Connect wallet"} />
        <OverviewCard icon={Activity} label="NO tokens" value={isConnected ? formatCollateral(shortBalance) : "Connect wallet"} />
        <OverviewCard icon={BadgeDollarSign} label="Claim status" value={receivedSettlementPrice ? "Check claims" : "Not settled"} />
      </section>

      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Open Positions</div>
        <div className="p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#EAECEF]">Open positions</h2>
            <p className="text-xs text-[#707A8A]">
              Reads YES/NO token balances from the configured onchain market.
            </p>
          </div>
          <Badge variant="outline" className="w-fit border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
            {marketStatus}
          </Badge>
        </div>

        {!hasConfiguredMarket ? (
          <EmptyState title="No configured onchain market address found. Deploy contracts or create a market first." />
        ) : !isConnected ? (
          <EmptyState title="Connect wallet to view onchain positions." />
        ) : !hasPosition ? (
          <EmptyState title="No onchain positions found for this wallet." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {hasYes && (
              <PositionCard
                market={marketTitle}
                side="YES"
                amount={`${formatCollateral(longBalance)} shares`}
                odds={yesPrice !== undefined ? `${Math.round(yesPrice)}%` : "--"}
                status={marketStatus}
              />
            )}
            {hasNo && (
              <PositionCard
                market={marketTitle}
                side="NO"
                amount={`${formatCollateral(shortBalance)} shares`}
                odds={noPrice !== undefined ? `${Math.round(noPrice)}%` : "--"}
                status={marketStatus}
              />
            )}
          </div>
        )}

        {hasConfiguredMarket && (
          <Link
            href={`/market/${MARKET_ADDRESS}`}
            className="terminal-button mt-4 inline-flex px-4 py-2 text-sm font-bold"
          >
            Open trading panel
          </Link>
        )}
        </div>
      </section>

      <section className="exchange-panel">
        <div className="terminal-titlebar flex items-center gap-2 px-3 py-1.5">
          <ShieldCheck className="h-4 w-4" />
          <h2 className="text-sm font-bold">Settlement status</h2>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatusTile label="Oracle" value={oracleStateLabel(oracleState, { priceRequested: !!priceRequested })} />
          <StatusTile label="Collateral" value="ARCT test collateral" />
          <StatusTile label="Gas" value="Arc Testnet USDC" />
          <StatusTile label="Privacy" value="Positions public today" />
        </div>
      </section>
    </div>
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
  icon: typeof Wallet;
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

function PositionCard({
  market,
  side,
  amount,
  odds,
  status,
}: {
  market: string;
  side: "YES" | "NO";
  amount: string;
  odds: string;
  status: string;
}) {
  const isYes = side === "YES";

  return (
    <article className="terminal-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant="outline" className={isYes ? "border-[#0ECB81] bg-[#0ECB81]/15 text-[#BFFFE7]" : "border-[#F6465D] bg-[#F6465D]/15 text-[#FFD7DD]"}>
            {side}
          </Badge>
          <h3 className="mt-3 text-sm font-bold leading-snug text-[#EAECEF]">{market}</h3>
        </div>
        <p className="font-mono text-2xl font-black text-[#EAECEF]">{odds}</p>
      </div>
      <div className="mt-4 grid gap-2 text-[11px] text-[#707A8A] sm:grid-cols-3">
        <MetaLine icon={Activity} value={amount} />
        <MetaLine icon={Database} value="ARCT collateral" />
        <MetaLine icon={ShieldCheck} value={status} />
      </div>
    </article>
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

function MetaLine({ icon: Icon, value }: { icon: typeof Activity; value: string }) {
  return (
    <div className="terminal-card flex items-center gap-1.5 px-2 py-1.5">
      <Icon className="h-3.5 w-3.5 text-[#FCD535]" />
      <span>{value}</span>
    </div>
  );
}
