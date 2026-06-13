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

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BarChart3,
  Compass,
  EyeOff,
  Flame,
  Globe2,
  Layers3,
  Newspaper,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { CreateMarketDialog } from "@/components/CreateMarketDialog";

const navItems = [
  { label: "Markets", href: "/", icon: Compass },
  { label: "Portfolio", href: "/portfolio", icon: BarChart3 },
  { label: "Claims", href: "/claims", icon: BadgeDollarSign },
  { label: "Privacy Preview", href: "/privacy", icon: EyeOff },
];

const comingSoonItems = [
  { label: "World Cup", icon: Globe2 },
  { label: "5-Minute Signals", icon: Flame },
  { label: "Arc Ecosystem", icon: Layers3 },
  { label: "Leaderboard", icon: Trophy },
  { label: "News", icon: Newspaper },
];

const adminMarketCreateEnabled = process.env.NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE === "true";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-[#2B3139] bg-[#0B0E11] px-3 py-4 text-[#EAECEF] lg:block">
      <Link className="interactive-card interactive-card-clickable mb-5 flex items-center gap-3 rounded-xl border border-[#2B3139] bg-[#1E2329] px-3 py-3" href="/">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FCD535] text-[#181A20]">
          <Layers3 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-base font-bold leading-tight text-[#EAECEF]">ArcSignal</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#707A8A]">
            Testnet
          </p>
        </div>
      </Link>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/market/")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              className={`nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-semibold ${
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
          <CreateMarketDialog
            onCreated={() => undefined}
            triggerClassName="mt-2 flex w-full items-center justify-start gap-3 px-3 py-2.5 text-sm"
            triggerLabel="Create Market"
          />
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

      <div className="mt-8 rounded-xl border border-[#2B3139] bg-[#1E2329] p-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#FCD535]">
          <ShieldCheck className="h-4 w-4" />
          Arc Privacy Preview
        </div>
        <p className="mt-2 text-xs leading-5 text-[#707A8A]">
          Privacy is mock UX only. Trades and positions are public on Arc Testnet today.
        </p>
      </div>
    </aside>
  );
}
