/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function MarketSearchFallback() {
  return (
    <div className="relative z-10 w-full max-w-[420px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FCD535]" />
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

      if (mode === "replace" && pathname === "/") {
        router.replace(targetUrl, { scroll: false });
        return;
      }

      router.push(targetUrl, { scroll: false });
    },
    [buildSearchUrl, pathname, router],
  );

  useEffect(() => {
    if (pathname !== "/") return;

    const timeout = window.setTimeout(() => {
      applySearch(value, "replace");
    }, 250);

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
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FCD535]" />

      <input
        aria-label="Search ARCM markets"
        autoComplete="off"
        className="focus-ring h-10 w-full rounded-lg border border-[#2B3139] bg-[#1E2329] pl-10 pr-10 text-sm font-medium text-[#EAECEF] outline-none transition placeholder:text-[#707A8A] hover:border-[#3A424D] focus:border-[#FCD535]"
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

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#2B3139] bg-[#0B0E11]/95 px-3 backdrop-blur sm:px-5">
      <div className="flex min-w-0 flex-1 items-center">
        <Suspense fallback={<MarketSearchFallback />}>
          <MarketSearch />
        </Suspense>
      </div>

      <div className="flex shrink-0 items-center">
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
                className="focus-ring flex h-10 items-center gap-2 rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 text-sm font-bold text-[#EAECEF] transition hover:border-[#FCD535]"
                onClick={openAccountModal}
                type="button"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FCD535] text-[10px] text-[#181A20]">
                  â—
                </span>
                <span>
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
