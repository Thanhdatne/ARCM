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

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { useWallet } from "@/contexts/WalletContext";
import { useMarketAddress } from "@/contexts/MarketAddressContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarketState,
  useTokenBalances,
  useOracleState,
  useSettlePosition,
  useProposePriceWithTimer,
  useDisputePrice,
  useSettleOracleRequest,
  useApproveArct,
  useApproveToken,
  useOracleAllowance,
  useSettleOracleWithTimer,
} from "@/hooks/useMarket";
import {
  useAMMState,
  useCalcBuy,
  useCalcSell,
  useBuyYes,
  useBuyNo,
  useSellYes,
  useSellNo,
  useApproveArctForAMM,
  useApproveTokenForAMM,
  useAMMAllowances,
} from "@/hooks/useAMM";
import { ARCT_ADDRESS, OO_V2_ADDRESS, OracleState } from "@/lib/contracts";
import { ArctFaucetButton } from "@/components/wallet/ArctFaucetButton";
import { BuyTab } from "./BuyTab";
import { SellTab } from "./SellTab";
import { ResolveTab } from "./ResolveTab";

type Tab = "buy" | "sell" | "resolve";
type Outcome = "yes" | "no";
const adminSettlementEnabled = process.env.NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE === "true";
const ARC_TESTNET_CHAIN_ID = 5042002;
const ARC_TESTNET_ADD_CHAIN_PARAMS = {
  chainId: "0x4CEF52",
  chainName: "Arc Network Testnet",
  rpcUrls: ["https://rpc.testnet.arc.network"],
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

function safeParseAmount(amount: string, decimals: number | null): bigint {
  if (!amount || decimals === null) return 0n;
  try {
    const parsed = parseUnits(amount, decimals);
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

type MarketMetadata = {
  address?: string;
  marketAddress?: string;
  kickoffTime?: string;
  startsAt?: string;
  startTime?: string;
};

function parseMarketKickoffMs(market?: MarketMetadata) {
  const raw = market?.kickoffTime ?? market?.startsAt ?? market?.startTime;
  if (!raw) return null;

  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function sameAddress(a?: string, b?: string) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export function TradingPanel() {
  const { isConnected } = useWallet();
  const { chainId } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { marketAddress } = useMarketAddress();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("buy");
  const [outcome, setOutcome] = useState<Outcome>("yes");
  const [amount, setAmount] = useState("");
  const [clientNowMs, setClientNowMs] = useState<number | null>(null);
  const [marketKickoffMs, setMarketKickoffMs] = useState<number | null>(null);
  const [switchChainError, setSwitchChainError] = useState<string | null>(null);

  const {
    priceRequested,
    receivedSettlementPrice,
    settlementPrice,
    longTokenAddress,
    shortTokenAddress,
    priceIdentifier,
    requestTimestamp,
    ancillaryDataHex,
    proposerBond,
    collateralAddress,
    collateralSymbol,
    collateralDecimals,
    outcomeDecimals,
    collateralEnabled,
    collateralWarning,
    isLoading: isMarketLoading,
    refetch: refetchMarket,
  } = useMarketState();

  const { collateralBalance, longBalance, shortBalance, isLoading: isBalancesLoading, refetch: refetchBalances } = useTokenBalances(
    collateralAddress ?? undefined,
    longTokenAddress,
    shortTokenAddress
  );

  const { yesPrice, noPrice, initialized: ammInitialized, refetch: refetchAMM, isLoading: isAMMLoading } = useAMMState();

  const { collateralAllowance, longAllowance, shortAllowance, isLoading: isAllowancesLoading, refetch: refetchAllowances } =
    useAMMAllowances(collateralAddress ?? undefined, longTokenAddress, shortTokenAddress);

  const { oracleAllowance, isLoading: isOracleAllowanceLoading, refetch: refetchOracleAllowance } =
    useOracleAllowance(collateralAddress ?? undefined);

  const {
    oracleState,
    proposer,
    proposedPrice,
    expirationTime,
    bond,
    refetch: refetchOracle,
  } = useOracleState(priceIdentifier, requestTimestamp, ancillaryDataHex);

  // AMM hooks
  const approveCollateral = useApproveArctForAMM(collateralAddress ?? undefined);
  const approveLong = useApproveTokenForAMM(longTokenAddress);
  const approveShort = useApproveTokenForAMM(shortTokenAddress);
  const buyYes = useBuyYes(collateralDecimals);
  const buyNo = useBuyNo(collateralDecimals);
  const sellYesHook = useSellYes(outcomeDecimals);
  const sellNoHook = useSellNo(outcomeDecimals);
  const settlePos = useSettlePosition();

  // OO hooks
  const approveArctForOO = useApproveToken(OO_V2_ADDRESS, collateralAddress ?? undefined);
  const proposePrice = useProposePriceWithTimer(priceIdentifier, requestTimestamp, ancillaryDataHex);
  const disputePrice = useDisputePrice(priceIdentifier, requestTimestamp, ancillaryDataHex);
  const settleOracle = useSettleOracleRequest(priceIdentifier, requestTimestamp, ancillaryDataHex);
  const settleOracleWithTimer = useSettleOracleWithTimer(priceIdentifier, requestTimestamp, ancillaryDataHex);

  // Preview calculations
  const { tokensOut: buyPreview } = useCalcBuy(outcome, tab === "buy" ? amount : "", collateralDecimals);
  const { collateralOut: sellPreview } = useCalcSell(outcome, tab === "sell" ? amount : "", outcomeDecimals);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const updateNow = () => setClientNowMs(Date.now());

    updateNow();
    const interval = window.setInterval(updateNow, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMarketKickoff() {
      try {
        const response = await fetch("/api/markets", { cache: "no-store" });
        if (!response.ok) return;

        const payload = await response.json();
        const markets = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.markets)
            ? payload.markets
            : [];
        const market = markets.find((item: MarketMetadata) =>
          sameAddress(item.marketAddress, marketAddress) || sameAddress(item.address, marketAddress),
        );

        if (!cancelled) {
          setMarketKickoffMs(parseMarketKickoffMs(market));
        }
      } catch {
        if (!cancelled) setMarketKickoffMs(null);
      }
    }

    if (marketAddress === "0x0000000000000000000000000000000000000000") {
      setMarketKickoffMs(null);
      return;
    }

    loadMarketKickoff();
    return () => {
      cancelled = true;
    };
  }, [marketAddress]);

  // Auto-switch to resolve tab when market is settled
  useEffect(() => {
    if (receivedSettlementPrice) setTab("resolve");
  }, [receivedSettlementPrice]);

  useEffect(() => {
    if (searchParams.get("tab") === "resolve" && (adminSettlementEnabled || receivedSettlementPrice)) {
      setTab("resolve");
    }
  }, [searchParams, receivedSettlementPrice]);

  // Refetch allowances after approvals
  useEffect(() => {
    if (approveCollateral.isSuccess || approveLong.isSuccess || approveShort.isSuccess || approveArctForOO.isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['readContracts'] });
      queryClient.invalidateQueries({ queryKey: ['readContract'] });
      refetchAllowances();
      refetchOracleAllowance();
    }
  }, [approveCollateral.isSuccess, approveLong.isSuccess, approveShort.isSuccess, approveArctForOO.isSuccess, queryClient, refetchAllowances, refetchOracleAllowance]);

  // Refetch everything after trades, settle, oracle actions
  useEffect(() => {
    if (buyYes.isSuccess || buyNo.isSuccess || sellYesHook.isSuccess || sellNoHook.isSuccess ||
      settlePos.isSuccess || proposePrice.isSuccess || disputePrice.isSuccess || settleOracle.isSuccess ||
      settleOracleWithTimer.isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['readContracts'] });
      queryClient.invalidateQueries({ queryKey: ['readContract'] });
      refetchAMM();
      refetchAllowances();
      refetchBalances();
      refetchMarket();
      refetchOracle();
    }
  }, [buyYes.isSuccess, buyNo.isSuccess, sellYesHook.isSuccess, sellNoHook.isSuccess,
  settlePos.isSuccess, proposePrice.isSuccess, disputePrice.isSuccess, settleOracle.isSuccess,
  settleOracleWithTimer.isSuccess,
    queryClient, refetchAMM, refetchAllowances, refetchBalances, refetchMarket, refetchOracle]);

  const isOracleSettlementRefreshing =
    (settleOracle.isSuccess || settleOracleWithTimer.isSuccess) &&
    !receivedSettlementPrice &&
    oracleState !== OracleState.Settled;

  useEffect(() => {
    if (!isOracleSettlementRefreshing) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["readContracts"] });
      queryClient.invalidateQueries({ queryKey: ["readContract"] });
      refetchMarket();
      refetchOracle();
    }, 1_000);

    return () => clearInterval(interval);
  }, [isOracleSettlementRefreshing, queryClient, refetchMarket, refetchOracle]);

  const requestedBuyAmount = safeParseAmount(tab === "buy" ? amount : "", collateralDecimals);
  const requestedSellAmount = safeParseAmount(tab === "sell" ? amount : "", outcomeDecimals);
  const needsBuyApproval =
    tab === "buy" && requestedBuyAmount > 0n && collateralAllowance !== undefined &&
    collateralAllowance < requestedBuyAmount;

  const needsSellApproval =
    tab === "sell" &&
    requestedSellAmount > 0n &&
    ((outcome === "yes" && longAllowance !== undefined && longAllowance < requestedSellAmount) ||
      (outcome === "no" && shortAllowance !== undefined && shortAllowance < requestedSellAmount));

  const needsOracleApproval =
    !approveArctForOO.isSuccess &&
    oracleAllowance !== undefined && proposerBond !== undefined &&
    oracleAllowance < proposerBond;

  const walletOnWrongTradingChain = mounted && isConnected && chainId !== ARC_TESTNET_CHAIN_ID;

  const handleSwitchToArcTestnet = () => {
    setSwitchChainError(null);

    switchChain(
      { chainId: ARC_TESTNET_CHAIN_ID },
      {
        onError: async () => {
          const ethereum = (window as typeof window & {
            ethereum?: {
              request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            };
          }).ethereum;

          if (!ethereum?.request) {
            setSwitchChainError("Wallet network switching is unavailable in this browser.");
            return;
          }

          try {
            await ethereum.request({
              method: "wallet_addEthereumChain",
              params: [ARC_TESTNET_ADD_CHAIN_PARAMS],
            });
          } catch {
            setSwitchChainError("Could not switch wallet to Arc Network Testnet.");
          }
        },
      },
    );
  };

  if ((isMarketLoading || isAMMLoading || isBalancesLoading)) {
    return (
      <div className="sticky top-20 rounded-xl border border-[#2B3139] bg-[#1E2329]">
        <div className="px-4 py-3 text-sm font-bold text-[#EAECEF]">Trade</div>
        <div className="flex border-b border-[#2B3139]">
          {["buy", "sell", "resolve"].map((t) => (
            <div key={t} className="flex-1 flex justify-center py-3">
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-4 w-20" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-px w-full" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    );
  }

  const showResolveTab = adminSettlementEnabled || receivedSettlementPrice;
  const visibleTabs = (showResolveTab ? ["buy", "sell", "resolve"] : ["buy", "sell"]) as Tab[];
  const marketSettled = Boolean(receivedSettlementPrice);
  const marketClosedByKickoff =
    !marketSettled &&
    marketKickoffMs !== null &&
    clientNowMs !== null &&
    clientNowMs >= marketKickoffMs;
  const tradingClosed = marketSettled || marketClosedByKickoff;
  const tradingEnabled =
    collateralEnabled && !collateralWarning && collateralAddress !== null && outcomeDecimals !== null;
  const isArctCollateral =
    collateralAddress?.toLowerCase() === ARCT_ADDRESS.toLowerCase();

  return (
    <aside className="sticky top-20 overflow-hidden rounded-xl border border-[#2B3139] bg-[#1E2329] text-[#EAECEF] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="border-b border-[#2B3139] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-base font-black">{tradingClosed ? "Market actions" : "Trade"}</span>
            <p className="mt-0.5 text-xs text-[#707A8A]">
              {marketSettled
                ? "Claim rewards from settled positions."
                : marketClosedByKickoff
                  ? "Betting closed at kickoff. Waiting for final result."
                  : `Buy or sell YES / NO with ${collateralSymbol}.`}
            </p>
          </div>
          <span className="rounded-full border border-[#FF8A00]/70 bg-[#FF8A00]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#FF9D2E]">
            Arc Testnet
          </span>
        </div>
      </div>

      <div className="border-b border-[#2B3139] px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-semibold text-[#707A8A]">Wallet balance</p>
            <p className="mt-1 font-mono text-sm font-black text-[#EAECEF]">
              {tradingEnabled && collateralBalance !== undefined
                ? formatUnits(collateralBalance, collateralDecimals)
                : "--"} {collateralSymbol}
            </p>
          </div>
          {tradingEnabled && isArctCollateral ? <ArctFaucetButton /> : null}
        </div>
      </div>

      {marketSettled ? (
        <div className="border-b border-[#2B3139] bg-[#0ECB81]/10 px-4 py-3">
          <p className="text-xs font-bold text-[#BFFFE7]">Market settled</p>
          <p className="mt-1 text-xs leading-5 text-[#707A8A]">
            Trading is closed. Winning YES/NO shares can be redeemed from the Claim tab or Claims page.
          </p>
        </div>
      ) : marketClosedByKickoff ? (
        <div className="border-b border-[#2B3139] bg-[#FF8A00]/10 px-4 py-3">
          <p className="text-xs font-bold text-[#FF9D2E]">Betting closed</p>
          <p className="mt-1 text-xs leading-5 text-[#707A8A]">
            This fixture has kicked off. The market is waiting for admin result entry and settlement.
          </p>
        </div>
      ) : null}

      <div className={`grid gap-1 border-b border-[#2B3139] bg-[#0B0E11] p-1.5 ${showResolveTab ? "grid-cols-3" : "grid-cols-2"}`}>
        {visibleTabs.map((t) => {
          const isTradingTab = t === "buy" || t === "sell";
          const disabled = isTradingTab && (tradingClosed || !tradingEnabled);
          const label =
            t === "resolve"
              ? adminSettlementEnabled && !marketSettled
                ? "Admin"
                : "Claim"
              : t === "buy"
                ? "Buy"
                : "Sell";

          return (
            <button
              key={t}
              onClick={() => {
                if (!disabled) {
                  setTab(t);
                  setAmount("");
                }
              }}
              disabled={disabled}
              className={`focus-ring rounded-xl px-3 py-2 text-sm font-black transition active:translate-y-px ${
                disabled
                  ? "cursor-not-allowed text-[#4A525E]"
                  : tab === t
                    ? "bg-[#FF8A00] text-[#181A20]"
                    : "text-[#707A8A] hover:bg-[#1E2329] hover:text-[#EAECEF]"
              }`}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4 p-4">
        {(tab === "buy" || tab === "sell") && walletOnWrongTradingChain ? (
          <div className="rounded-xl border border-[#FF8A00]/35 bg-[#FF8A00]/10 p-4">
            <p className="text-sm font-bold text-[#FF9D2E]">
              Switch to Arc Network Testnet to trade.
            </p>
            <button
              type="button"
              onClick={handleSwitchToArcTestnet}
              disabled={isSwitchingChain}
              className="focus-ring mt-3 w-full rounded-xl bg-[#FF8A00] px-4 py-3 text-sm font-black text-[#181A20] transition hover:bg-[#FF9D2E] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSwitchingChain ? "Switching..." : "Switch to Arc Network Testnet"}
            </button>
            {switchChainError ? (
              <p className="mt-3 text-xs leading-5 text-[#F6465D]">{switchChainError}</p>
            ) : null}
          </div>
        ) : (tab === "buy" || tab === "sell") && marketClosedByKickoff ? (
          <p className="rounded-xl border border-[#FF8A00]/35 bg-[#FF8A00]/10 p-4 text-sm leading-6 text-[#FF9D2E]">
            Betting is closed because this fixture has already kicked off. Enter the final result from Admin Markets after the match ends.
          </p>
        ) : (tab === "buy" || tab === "sell") && !tradingEnabled ? (
          <p className="rounded-xl border border-[#FF8A00]/35 bg-[#FF8A00]/10 p-4 text-sm leading-6 text-[#FF9D2E]">
            Trading is unavailable because this market&apos;s collateral or outcome-token metadata is not enabled and valid.
          </p>
        ) : !mounted || !isConnected ? (
          <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-4 text-center">
            <p className="mb-3 text-sm font-semibold text-[#EAECEF]">
              Connect wallet to trade on Arc Testnet.
            </p>
            <div className="flex justify-center">
              <ConnectButton showBalance={false} chainStatus="name" />
            </div>
          </div>
        ) : !ammInitialized && tab !== "resolve" ? (
          <div className="space-y-3">
            <p className="rounded-xl border border-[#2B3139] bg-[#0B0E11] px-4 py-8 text-center text-sm text-[#707A8A]">
              AMM is not initialized for this market yet.
            </p>
          </div>
        ) : tab === "buy" ? (
          <BuyTab
            outcome={outcome}
            onOutcomeChange={setOutcome}
            amount={amount}
            onAmountChange={setAmount}
            yesPrice={yesPrice}
            noPrice={noPrice}
            collateralBalance={collateralBalance}
            buyPreview={buyPreview}
            needsApproval={needsBuyApproval}
            isAllowancesLoading={isAllowancesLoading}
            approveCollateral={approveCollateral}
            buyHook={outcome === "yes" ? buyYes : buyNo}
            collateralSymbol={collateralSymbol}
            collateralDecimals={collateralDecimals}
            outcomeDecimals={outcomeDecimals!}
          />
        ) : tab === "sell" ? (
          <SellTab
            outcome={outcome}
            onOutcomeChange={setOutcome}
            amount={amount}
            onAmountChange={setAmount}
            yesPrice={yesPrice}
            noPrice={noPrice}
            longBalance={longBalance}
            shortBalance={shortBalance}
            sellPreview={sellPreview}
            needsApproval={needsSellApproval}
            isAllowancesLoading={isAllowancesLoading}
            approveHook={outcome === "yes" ? approveLong : approveShort}
            sellHook={outcome === "yes" ? sellYesHook : sellNoHook}
            collateralSymbol={collateralSymbol}
            collateralDecimals={collateralDecimals}
            outcomeDecimals={outcomeDecimals!}
          />
        ) : (
          <ResolveTab
            oracleState={oracleState}
            priceRequested={priceRequested}
            receivedSettlementPrice={receivedSettlementPrice}
            settlementPrice={settlementPrice}
            longBalance={longBalance}
            shortBalance={shortBalance}
            proposer={proposer}
            proposedPrice={proposedPrice}
            expirationTime={expirationTime}
            bond={bond}
            needsOracleApproval={needsOracleApproval}
            isOracleAllowanceLoading={isOracleAllowanceLoading}
            approveArctForOO={approveArctForOO}
            proposePrice={proposePrice}
            disputePrice={disputePrice}
            settleOracle={settleOracle}
            settleOracleWithTimer={settleOracleWithTimer}
            isOracleSettlementRefreshing={isOracleSettlementRefreshing}
            settlePos={settlePos}
            adminSettlementEnabled={adminSettlementEnabled}
            collateralSymbol={collateralSymbol}
            collateralDecimals={collateralDecimals}
            outcomeDecimals={outcomeDecimals}
          />
        )}

        {!marketSettled && !adminSettlementEnabled ? (
          <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-3 text-xs leading-5 text-[#707A8A]">
            Resolution tools are hidden for public users. After settlement, rewards will appear in Claims.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
