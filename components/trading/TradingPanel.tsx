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
import { useWallet } from "@/contexts/WalletContext";
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
import { OO_V2_ADDRESS, OracleState } from "@/lib/contracts";
import { formatCollateral } from "@/hooks/market/helpers";
import { ArctFaucetButton } from "@/components/wallet/ArctFaucetButton";
import { BuyTab } from "./BuyTab";
import { SellTab } from "./SellTab";
import { ResolveTab } from "./ResolveTab";

type Tab = "buy" | "sell" | "resolve";
type Outcome = "yes" | "no";
const adminSettlementEnabled = process.env.NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE === "true";

// TODO(collateral): replace ARCT display labels after verified per-market
// collateral metadata is exposed by the existing trading hooks.

export function TradingPanel() {
  const { isConnected } = useWallet();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("buy");
  const [outcome, setOutcome] = useState<Outcome>("yes");
  const [amount, setAmount] = useState("");

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
    collateralSymbol,
    collateralEnabled,
    isLoading: isMarketLoading,
    refetch: refetchMarket,
  } = useMarketState();

  const { arctBalance, longBalance, shortBalance, isLoading: isBalancesLoading, refetch: refetchBalances } = useTokenBalances(
    longTokenAddress,
    shortTokenAddress
  );

  const { yesPrice, noPrice, initialized: ammInitialized, refetch: refetchAMM, isLoading: isAMMLoading } = useAMMState();

  const { arctAllowance, longAllowance, shortAllowance, isLoading: isAllowancesLoading, refetch: refetchAllowances } =
    useAMMAllowances(longTokenAddress, shortTokenAddress);

  const { oracleAllowance, isLoading: isOracleAllowanceLoading, refetch: refetchOracleAllowance } = useOracleAllowance();

  const {
    oracleState,
    proposer,
    proposedPrice,
    expirationTime,
    bond,
    refetch: refetchOracle,
  } = useOracleState(priceIdentifier, requestTimestamp, ancillaryDataHex);

  // AMM hooks
  const approveArct = useApproveArctForAMM();
  const approveLong = useApproveTokenForAMM(longTokenAddress);
  const approveShort = useApproveTokenForAMM(shortTokenAddress);
  const buyYes = useBuyYes();
  const buyNo = useBuyNo();
  const sellYesHook = useSellYes();
  const sellNoHook = useSellNo();
  const settlePos = useSettlePosition();

  // OO hooks
  const approveArctForOO = useApproveArct(OO_V2_ADDRESS);
  const proposePrice = useProposePriceWithTimer(priceIdentifier, requestTimestamp, ancillaryDataHex);
  const disputePrice = useDisputePrice(priceIdentifier, requestTimestamp, ancillaryDataHex);
  const settleOracle = useSettleOracleRequest(priceIdentifier, requestTimestamp, ancillaryDataHex);
  const settleOracleWithTimer = useSettleOracleWithTimer(priceIdentifier, requestTimestamp, ancillaryDataHex);

  // Preview calculations
  const { tokensOut: buyPreview } = useCalcBuy(outcome, tab === "buy" ? amount : "");
  const { collateralOut: sellPreview } = useCalcSell(outcome, tab === "sell" ? amount : "");

  useEffect(() => setMounted(true), []);

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
    if (approveArct.isSuccess || approveLong.isSuccess || approveShort.isSuccess || approveArctForOO.isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['readContracts'] });
      queryClient.invalidateQueries({ queryKey: ['readContract'] });
      refetchAllowances();
      refetchOracleAllowance();
    }
  }, [approveArct.isSuccess, approveLong.isSuccess, approveShort.isSuccess, approveArctForOO.isSuccess, queryClient, refetchAllowances, refetchOracleAllowance]);

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

  const needsBuyApproval =
    tab === "buy" && !approveArct.isSuccess && arctAllowance !== undefined &&
    arctAllowance === 0n;

  const needsSellApproval =
    tab === "sell" &&
    ((outcome === "yes" && !approveLong.isSuccess && longAllowance !== undefined && longAllowance === 0n) ||
      (outcome === "no" && !approveShort.isSuccess && shortAllowance !== undefined && shortAllowance === 0n));

  const needsOracleApproval =
    !approveArctForOO.isSuccess &&
    oracleAllowance !== undefined && proposerBond !== undefined &&
    oracleAllowance < proposerBond;

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
  const tradingEnabled = collateralEnabled && collateralSymbol === "ARCT";

  return (
    <aside className="sticky top-20 overflow-hidden rounded-xl border border-[#2B3139] bg-[#1E2329] text-[#EAECEF] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="border-b border-[#2B3139] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-base font-black">{marketSettled ? "Market actions" : "Trade"}</span>
            <p className="mt-0.5 text-xs text-[#707A8A]">
              {marketSettled ? "Claim rewards from settled positions." : `Buy or sell YES / NO with ${collateralSymbol}.`}
            </p>
          </div>
          <span className="rounded-full border border-[#FCD535]/70 bg-[#FCD535]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#FFF3AF]">
            Arc Testnet
          </span>
        </div>
      </div>

      <div className="border-b border-[#2B3139] px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-semibold text-[#707A8A]">Wallet balance</p>
            <p className="mt-1 font-mono text-sm font-black text-[#EAECEF]">
              {tradingEnabled ? formatCollateral(arctBalance) : "--"} {collateralSymbol}
            </p>
          </div>
          {tradingEnabled ? <ArctFaucetButton /> : null}
        </div>
      </div>

      {marketSettled ? (
        <div className="border-b border-[#2B3139] bg-[#0ECB81]/10 px-4 py-3">
          <p className="text-xs font-bold text-[#BFFFE7]">Market settled</p>
          <p className="mt-1 text-xs leading-5 text-[#707A8A]">
            Trading is closed. Winning YES/NO shares can be redeemed from the Claim tab or Claims page.
          </p>
        </div>
      ) : null}

      <div className={`grid gap-1 border-b border-[#2B3139] bg-[#0B0E11] p-1.5 ${showResolveTab ? "grid-cols-3" : "grid-cols-2"}`}>
        {visibleTabs.map((t) => {
          const isTradingTab = t === "buy" || t === "sell";
          const disabled = isTradingTab && (marketSettled || !tradingEnabled);
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
                    ? "bg-[#FCD535] text-[#181A20]"
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
        {(tab === "buy" || tab === "sell") && !tradingEnabled ? (
          <p className="rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 p-4 text-sm leading-6 text-[#FFF3AF]">
            Trading for this collateral is not enabled yet. ARCT markets remain fully tradable.
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
            arctBalance={arctBalance}
            buyPreview={buyPreview}
            needsApproval={needsBuyApproval}
            isAllowancesLoading={isAllowancesLoading}
            approveArct={approveArct}
            buyHook={outcome === "yes" ? buyYes : buyNo}
            collateralSymbol={collateralSymbol}
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
