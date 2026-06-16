/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BarChart3,
  CircleHelp,
  Compass,
  EyeOff,
  Flame,
  Layers3,
  Newspaper,
  Settings2,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { CreateMarketDialog } from "@/components/CreateMarketDialog";

const navItems = [
  { label: "Markets", href: "/", icon: Compass },
  { label: "Portfolio", href: "/portfolio", icon: BarChart3 },
  { label: "Claims", href: "/claims", icon: BadgeDollarSign },
  { label: "How it works", href: "/how-it-works", icon: CircleHelp },
  { label: "Privacy Preview", href: "/privacy", icon: EyeOff },
];

const adminNavItems = [
  { label: "Admin Markets", href: "/admin/markets", icon: Settings2 },
];

const comingSoonItems = [
  { label: "5-Minute Signals", icon: Flame },
  { label: "Arc Ecosystem", icon: Layers3 },
  { label: "Leaderboard", icon: Trophy },
  { label: "News", icon: Newspaper },
];

const adminMarketCreateEnabled =
  process.env.NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE === "true";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[#2B3139] bg-[#0B0E11] px-3 py-4 text-[#EAECEF] lg:flex">
        <div className="mb-5 flex shrink-0 items-center justify-center">
          <Link
            href="/"
            aria-label="Go to ARCM home"
            className="focus-ring flex h-16 w-16 items-center justify-center rounded-xl border border-[#2B3139] bg-[#0B0E11] transition hover:border-[#FCD535] hover:shadow-[0_0_0_1px_#FCD535,0_0_18px_rgba(252,213,53,0.16)]"
          >
            <Image
              src="/brand/ARCM-logo.png"
              alt="ARCM"
              width={52}
              height={52}
              priority
              className="h-[52px] w-[52px] object-contain"
            />
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#2B3139_transparent]">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/" || pathname.startsWith("/market/")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={`nav-item flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold ${
                    active
                      ? "border border-[#FCD535] bg-[#FCD535] text-[#181A20]"
                      : "border border-transparent text-[#707A8A]"
                  }`}
                  href={item.href}
                  key={item.label}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}

            {adminMarketCreateEnabled ? (
              <>
                <div className="my-3 border-t border-[#2B3139]" />

                {adminNavItems.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      className={`nav-item flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold ${
                        active
                          ? "border border-[#FCD535] bg-[#FCD535] text-[#181A20]"
                          : "border border-transparent text-[#707A8A]"
                      }`}
                      href={item.href}
                      key={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}

                <CreateMarketDialog
                  onCreated={() => undefined}
                  triggerClassName="mt-2 flex w-full items-center justify-start gap-3 px-3 py-2.5 text-sm"
                  triggerLabel="Create Market"
                />
              </>
            ) : null}
          </nav>

          <details className="mt-6 text-[#707A8A]">
            <summary className="cursor-pointer px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#707A8A]">
              Coming soon
            </summary>

            <div className="mt-2 space-y-1 opacity-75">
              {comingSoonItems.map((item) => (
                <div
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center justify-between gap-3 rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-1.5 text-xs font-medium text-[#707A8A]"
                  key={item.label}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>

                  <span className="rounded border border-[#2B3139] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">
                    Soon
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div className="mt-4 shrink-0 rounded-xl border border-[#2B3139] bg-[#1E2329] p-3 shadow-[0_-12px_30px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-2 text-sm font-bold text-[#FCD535]">
            <ShieldCheck className="h-4 w-4" />
            Arc Testnet MVP
          </div>

          <p className="mt-2 text-xs leading-5 text-[#707A8A]">
            Real trades use Arc Testnet contracts. Completed markets stay out of Home and rewards live in Claims.
          </p>
        </div>
      </aside>

      <div aria-hidden="true" className="hidden w-64 shrink-0 lg:block" />
    </>
  );
}

