/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Bell,
  ChevronRight,
  LoaderCircle,
  Search,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";

interface ClaimNotificationMarket {
  id: string;
  title: string;
  address: string;
  winningSide: "YES" | "NO" | "Mixed";
  payoutAmountFormatted?: string;
  collateralSymbol?: string;
}

interface ClaimNotificationResponse {
  success?: boolean;
  error?: string;
  markets?: ClaimNotificationMarket[];
}

function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function MarketSearchFallback() {
  return (
    <div className="relative z-10 w-full max-w-[420px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FF8A00]" />
      <div className="h-10 w-full rounded-lg border border-[#2B3139] bg-[#1E2329] pl-10 pr-10 text-sm font-medium text-[#707A8A]">
        <span className="flex h-full items-center">Search ARCM markets</span>
      </div>
    </div>
  );
}

function MarketSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const qFromUrl = searchParams.get("q") ?? "";
  const [value, setValue] = useState(qFromUrl);

  const searchParamsString = useMemo(
    () => searchParams.toString(),
    [searchParams],
  );

  useEffect(() => {
    setValue(qFromUrl);
  }, [qFromUrl]);

  const buildSearchUrl = useCallback(
    (nextValue: string) => {
      const query = nextValue.trim();
      const params = new URLSearchParams(searchParamsString);

      if (query) {
        params.set("q", query);
      } else {
        params.delete("q");
      }

      const queryString = params.toString();
      return queryString ? `/?${queryString}` : "/";
    },
    [searchParamsString],
  );

  const applySearch = useCallback(
    (nextValue: string, mode: "push" | "replace" = "push") => {
      const targetUrl = buildSearchUrl(nextValue);
      const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;

      if (targetUrl === currentUrl) return;

      if (mode === "replace" && pathname === "/") {
        router.replace(targetUrl, { scroll: false });
        return;
      }

      router.push(targetUrl, { scroll: false });
    },
    [buildSearchUrl, pathname, router, searchParamsString],
  );

  useEffect(() => {
    if (pathname !== "/") return;

    const timeout = window.setTimeout(() => {
      applySearch(value, "replace");
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [applySearch, pathname, value]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applySearch(value, "push");
  };

  const clearSearch = () => {
    setValue("");
    applySearch("", "replace");
  };

  return (
    <form
      className="relative z-10 w-full max-w-[420px]"
      onSubmit={submitSearch}
      role="search"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FF8A00]" />

      <input
        aria-label="Search ARCM markets"
        autoComplete="off"
        className="focus-ring h-10 w-full rounded-lg border border-[#2B3139] bg-[#1E2329] pl-10 pr-10 text-sm font-medium text-[#EAECEF] outline-none transition placeholder:text-[#707A8A] hover:border-[#3A424D] focus:border-[#FF8A00]"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search ARCM markets"
        type="text"
        value={value}
      />

      {value ? (
        <button
          aria-label="Clear market search"
          className="focus-ring absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#707A8A] transition hover:bg-[#2B3139] hover:text-[#EAECEF]"
          onClick={clearSearch}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </form>
  );
}

function ClaimNotificationBell() {
  const { address, isConnected } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [markets, setMarkets] = useState<ClaimNotificationMarket[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const hasRewards = markets.length > 0;
  const badgeCount = markets.length > 9 ? "9+" : String(markets.length);

  const loadRewards = useCallback(async () => {
    if (!isConnected || !address) {
      setMarkets([]);
      setError("");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/world-cup/claimable?address=${address}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as ClaimNotificationResponse;

      if (!response.ok) {
        throw new Error(data.error || "Could not load rewards.");
      }

      setMarkets(data.markets ?? []);
    } catch (claimError) {
      setMarkets([]);
      setError(claimError instanceof Error ? claimError.message : "Could not load rewards.");
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    void loadRewards();
  }, [isMounted, loadRewards]);

  useEffect(() => {
    if (!isMounted || !isConnected || !address) return;

    const interval = window.setInterval(() => {
      void loadRewards();
    }, 45_000);

    return () => window.clearInterval(interval);
  }, [address, isConnected, isMounted, loadRewards]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const toggleMenu = () => {
    if (!isMounted || !isConnected || !address) return;
    setIsOpen((current) => !current);
    void loadRewards();
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        aria-expanded={isOpen}
        aria-label={hasRewards ? `${markets.length} rewards ready to claim` : "Open reward notifications"}
        className={`focus-ring relative flex h-10 w-10 items-center justify-center rounded-xl border text-sm transition ${
          hasRewards
            ? "border-[#FF8A00]/70 bg-[#FF8A00]/10 text-[#FF8A00] shadow-[0_0_0_1px_rgba(255,138,0,0.12),0_10px_30px_rgba(255,138,0,0.08)]"
            : "border-[#2B3139] bg-[#1E2329] text-[#A7B1C2] hover:border-[#FF8A00]/70 hover:text-[#FF8A00]"
        } disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={!isMounted || !isConnected || !address}
        onClick={toggleMenu}
        title="Reward notifications"
        type="button"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2.3} />
        {hasRewards ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#0B0E11] bg-[#FF8A00] px-1 text-[10px] font-black leading-none text-[#181A20]">
            {badgeCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[#2B3139] bg-[#181A20] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="border-b border-[#2B3139] bg-[#1E2329] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#707A8A]">
                  Rewards
                </p>
                <h2 className="mt-1 text-sm font-bold text-[#EAECEF]">
                  {hasRewards ? `${markets.length} market${markets.length > 1 ? "s" : ""} won` : "No rewards yet"}
                </h2>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#FF8A00]/30 bg-[#FF8A00]/10 text-[#FF8A00]">
                {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              </span>
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {error ? (
              <div className="rounded-xl border border-[#F6465D]/30 bg-[#F6465D]/5 px-3 py-3 text-xs leading-5 text-[#FF9BA8]">
                {error}
              </div>
            ) : hasRewards ? (
              <div className="space-y-2">
                {markets.slice(0, 5).map((market) => (
                  <Link
                    key={`${market.id}-${market.address}`}
                    className="group block rounded-xl border border-[#2B3139] bg-[#0B0E11] px-3 py-3 transition hover:border-[#FF8A00]/70 hover:bg-[#12161D]"
                    href="/claims"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-[#0ECB81]/50 bg-[#0ECB81]/10 px-2 py-0.5 text-[10px] font-bold text-[#84DDB8]">
                            {market.winningSide} won
                          </span>
                          <span className="rounded-full border border-[#FF8A00]/30 bg-[#FF8A00]/10 px-2 py-0.5 text-[10px] font-bold text-[#FF8A00]">
                            Claimable
                          </span>
                        </div>
                        <p className="line-clamp-2 text-sm font-bold leading-5 text-[#EAECEF]">
                          {market.title}
                        </p>
                        <p className="mt-1 text-xs text-[#A7B1C2]">
                          Reward:{" "}
                          <span className="font-mono font-bold text-[#FF8A00]">
                            {market.payoutAmountFormatted ?? "Ready"} {market.collateralSymbol ?? "USDC"}
                          </span>
                        </p>
                      </div>
                      <ChevronRight className="mt-7 h-4 w-4 shrink-0 text-[#707A8A] transition group-hover:translate-x-0.5 group-hover:text-[#FF8A00]" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] px-3 py-5 text-center">
                <p className="text-sm font-bold text-[#EAECEF]">Nothing to claim right now</p>
                <p className="mt-1 text-xs leading-5 text-[#707A8A]">
                  Winning settled positions will appear here automatically.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[#2B3139] bg-[#1E2329] p-3">
            <button
              className="focus-ring rounded-lg px-2 py-1.5 text-xs font-bold text-[#A7B1C2] transition hover:bg-[#2B3139] hover:text-[#EAECEF]"
              disabled={isLoading}
              onClick={() => void loadRewards()}
              type="button"
            >
              Refresh
            </button>
            <Link
              className="focus-ring rounded-lg bg-[#FF8A00] px-3 py-1.5 text-xs font-black text-[#181A20] transition hover:bg-[#FF9D2E]"
              href="/claims"
              onClick={() => setIsOpen(false)}
            >
              View Claims
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WalletAvatar() {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#FF8A00]/40 bg-[#FF8A00] text-[#181A20] shadow-[0_0_0_2px_rgba(255,138,0,0.12)]"
    >
      <Wallet className="h-3.5 w-3.5" strokeWidth={2.6} />
    </span>
  );
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#2B3139] bg-[#0B0E11]/95 px-3 backdrop-blur sm:px-5">
      <div className="flex min-w-0 flex-1 items-center">
        <Suspense fallback={<MarketSearchFallback />}>
          <MarketSearch />
        </Suspense>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ClaimNotificationBell />

        <ConnectButton.Custom>
          {({
            account,
            chain,
            mounted,
            openAccountModal,
            openChainModal,
            openConnectModal,
          }) => {
            const ready = mounted;
            const connected = ready && account && chain;

            if (!ready) {
              return (
                <button
                  className="terminal-button focus-ring h-10 rounded-lg px-4 text-sm font-bold opacity-70"
                  disabled
                  type="button"
                >
                  Loading
                </button>
              );
            }

            if (!connected) {
              return (
                <button
                  className="terminal-button focus-ring h-10 rounded-lg px-4 text-sm font-bold"
                  onClick={openConnectModal}
                  type="button"
                >
                  Connect Wallet
                </button>
              );
            }

            if (chain.unsupported) {
              return (
                <button
                  className="focus-ring h-10 rounded-lg border border-[#F6465D] bg-[#F6465D] px-4 text-sm font-bold text-white"
                  onClick={openChainModal}
                  type="button"
                >
                  Wrong Network
                </button>
              );
            }

            return (
              <button
                className="focus-ring flex h-10 items-center gap-2 rounded-xl border border-[#2B3139] bg-[#1E2329] px-3 text-sm font-bold text-[#EAECEF] transition hover:border-[#FF8A00] hover:bg-[#252B33]"
                onClick={openAccountModal}
                type="button"
              >
                <WalletAvatar />
                <span className="max-w-[130px] truncate">
                  {account.displayName ?? shortAddress(account.address)}
                </span>
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  );
}
