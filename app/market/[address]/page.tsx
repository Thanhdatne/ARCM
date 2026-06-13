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

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { MarketDetail } from "@/components/MarketDetail";
import { TradingPanel } from "@/components/TradingPanel";
import { MARKET_ADDRESS, AMM_ADDRESS } from "@/lib/contracts";
import { MARKETS, type DynamicMarket } from "@/lib/markets";
import { MarketAddressProvider } from "@/contexts/MarketAddressContext";
import { type Address } from "viem";

function useResolveMarket(address: string) {
  const [resolved, setResolved] = useState<{
    marketAddress: Address;
    ammAddress: Address;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check static MARKETS first
    const staticMatch = MARKETS.find(
      (m) => m.address.toLowerCase() === address.toLowerCase() && m.isReal
    );
    if (staticMatch && staticMatch.ammAddress) {
      setResolved({
        marketAddress: staticMatch.address as Address,
        ammAddress: staticMatch.ammAddress as Address,
      });
      setLoading(false);
      return;
    }

    // Check dynamic markets
    fetch("/api/markets")
      .then((res) => res.json())
      .then((markets: DynamicMarket[]) => {
        const dynamicMatch = markets.find(
          (m) => m.address.toLowerCase() === address.toLowerCase()
        );
        if (dynamicMatch) {
          setResolved({
            marketAddress: dynamicMatch.address as Address,
            ammAddress: dynamicMatch.ammAddress as Address,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [address]);

  return { resolved, loading };
}

export default function MarketPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { resolved, loading } = useResolveMarket(address);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 overflow-x-hidden px-3 py-4 sm:px-4 lg:px-5">
      <Link
        href="/"
        className="terminal-button inline-flex w-fit items-center gap-2 px-3 py-1.5 text-xs font-bold"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Markets
      </Link>

      {loading ? (
        <div className="exchange-panel p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-7 w-64 bg-[#1E2329]" />
            <div className="h-4 w-full bg-[#1E2329]" />
            <div className="h-48 bg-[#1E2329]" />
          </div>
        </div>
      ) : !resolved ? (
        <div className="exchange-panel p-6 text-center">
          <p className="font-bold text-[#F59E0B]">Market not found</p>
          <p className="mt-2 text-sm text-[#707A8A]">
            This market address does not match any configured contract.
          </p>
        </div>
      ) : (
        <MarketAddressProvider
          marketAddress={resolved.marketAddress}
          ammAddress={resolved.ammAddress}
        >
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[#707A8A]">
            <span className="terminal-card inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-[#EAECEF]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Arc Testnet market
            </span>
            <span>Trading and settlement use Arc Testnet market contracts.</span>
          </div>
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <MarketDetail />
            <TradingPanel />
          </div>
        </MarketAddressProvider>
      )}
    </div>
  );
}
