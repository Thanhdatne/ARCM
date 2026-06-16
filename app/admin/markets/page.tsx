"use client";

import { useEffect, useMemo, useState } from "react";
import { CreateMarketDialog } from "@/components/CreateMarketDialog";
import { Input } from "@/components/ui/input";
import {
  MARKET_TEMPLATES,
  type MarketTemplateCategory,
} from "@/lib/marketTemplates";
import { KeyRound, Layers3, Search, ShieldCheck } from "lucide-react";

const adminMarketCreateEnabled =
  process.env.NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE === "true";

const categories: ("All" | MarketTemplateCategory)[] = [
  "All",
  "Arc",
  "Crypto",
  "Stablecoins",
  "AI",
  "Macro",
  "RWA",
  "Privacy",
];

const categoryCopy: Record<MarketTemplateCategory, { label: string; icon: string; description: string }> = {
  Arc: {
    label: "Arc",
    icon: "ARC",
    description: "Arc Testnet ecosystem and builder markets.",
  },
  Crypto: {
    label: "Crypto",
    icon: "BTC",
    description: "Token price and crypto market structure.",
  },
  Stablecoins: {
    label: "Stablecoins",
    icon: "USDC",
    description: "Peg, supply, and stablecoin infrastructure.",
  },
  AI: {
    label: "AI",
    icon: "AI",
    description: "Models, agents, GPUs, and AI product launches.",
  },
  Macro: {
    label: "Macro",
    icon: "MAC",
    description: "Rates, CPI, unemployment, and macro events.",
  },
  RWA: {
    label: "RWA",
    icon: "RWA",
    description: "Tokenized assets, treasuries, and onchain finance.",
  },
  Privacy: {
    label: "Privacy",
    icon: "ZK",
    description: "ZK, shielded positions, and privacy demos.",
  },
};

export default function AdminMarketsPage() {
  const [activeCategory, setActiveCategory] =
    useState<"All" | MarketTemplateCategory>("All");
  const [query, setQuery] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAdminKey(window.localStorage.getItem("ARCM-admin-key") ?? "");
  }, []);

  const categoryCounts = useMemo(() => {
    return MARKET_TEMPLATES.reduce<Record<MarketTemplateCategory, number>>(
      (acc, template) => {
        acc[template.category] += 1;
        return acc;
      },
      {
        Arc: 0,
        Crypto: 0,
        Stablecoins: 0,
        AI: 0,
        Macro: 0,
        RWA: 0,
        Privacy: 0,
      },
    );
  }, []);

  const visibleTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return MARKET_TEMPLATES.filter((template) => {
      const categoryMatch =
        activeCategory === "All" || template.category === activeCategory;

      if (!categoryMatch) return false;
      if (!normalizedQuery) return true;

      return [
        template.title,
        template.category,
        template.source,
        template.settlementRule,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeCategory, query]);

  const saveAdminKey = () => {
    window.localStorage.setItem("ARCM-admin-key", adminKey.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1_500);
  };

  if (!adminMarketCreateEnabled) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <section className="exchange-panel p-6">
          <h1 className="text-xl font-bold text-[#EAECEF]">Admin disabled</h1>
          <p className="mt-2 text-sm text-[#707A8A]">
            Market deployment is hidden unless admin market creation is enabled.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel overflow-hidden">
        <div className="terminal-titlebar flex items-center justify-between gap-3 px-3 py-2 text-sm font-bold">
          <span>Admin Market Catalog</span>
          <span className="rounded-full border border-[#FCD535]/50 bg-[#FCD535]/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#FCD535]">
            Protected deploy
          </span>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_380px]">
          <div>
            <h1 className="text-2xl font-black text-[#EAECEF]">
              Deploy real Arc Testnet markets
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#707A8A]">
              Templates stay hidden from public Home until deployed. Each card creates a real market
              contract, initializes UMA settlement, deploys an AMM, and seeds ARCT liquidity.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <AdminMetric
                icon={<Layers3 className="h-4 w-4" />}
                label="Templates"
                value={String(MARKET_TEMPLATES.length)}
              />
              <AdminMetric
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Server guard"
                value="Required"
              />
              <AdminMetric
                icon={<KeyRound className="h-4 w-4" />}
                label="Admin key"
                value={adminKey.trim() ? "Ready" : "Missing"}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FCD535] text-[#181A20]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-[#EAECEF]">Admin deploy key</p>
                <p className="mt-1 text-xs leading-5 text-[#707A8A]">
                  Must match server <span className="font-mono text-[#EAECEF]">ADMIN_API_KEY</span>.
                  Stored locally in this browser only.
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Input
                aria-label="Admin API key"
                className="font-mono"
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="Paste ADMIN_API_KEY"
                type="password"
                value={adminKey}
              />
              <button
                className="terminal-button focus-ring shrink-0 px-3 py-2 text-sm font-black"
                onClick={saveAdminKey}
                type="button"
              >
                {saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[#2B3139] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707A8A]" />
              <Input
                aria-label="Search templates"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search market templates"
                value={query}
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {categories.map((category) => (
                <button
                  className={
                    activeCategory === category
                      ? "focus-ring market-chip-active shrink-0 px-3 py-1.5 text-xs font-bold"
                      : "focus-ring market-chip shrink-0 px-3 py-1.5 text-xs font-bold transition hover:border-[#FCD535] hover:text-[#EAECEF]"
                  }
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  type="button"
                >
                  {category}
                  {category !== "All" ? (
                    <span className="ml-1 text-[#707A8A]">
                      {categoryCounts[category]}
                    </span>
                  ) : (
                    <span className="ml-1 text-[#707A8A]">{MARKET_TEMPLATES.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleTemplates.map((template) => {
          const copy = categoryCopy[template.category];

          return (
            <article
              className="group flex min-h-[320px] flex-col justify-between rounded-xl border border-[#2B3139] bg-[#1E2329] p-4 transition hover:-translate-y-0.5 hover:border-[#FCD535]/70 hover:shadow-[0_14px_40px_rgba(252,213,53,0.08)]"
              key={template.id}
            >
              <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#3A424D] bg-[#0B0E11] font-mono text-sm font-black text-[#FCD535]">
                      {copy.icon}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#707A8A]">
                        {copy.label}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-[#707A8A]">
                        {copy.description}
                      </p>
                    </div>
                  </div>

                  <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${riskClass(template.riskLevel)}`}>
                    {template.riskLevel}
                  </span>
                </div>

                <h2 className="text-base font-black leading-snug text-[#EAECEF]">
                  {template.title}
                </h2>

                <div className="mt-4 grid gap-2 text-xs">
                  <Meta label="Source" value={template.source} />
                  <Meta label="End date" value={template.endDate} />
                </div>

                <div className="mt-3 rounded-xl border border-[#2B3139] bg-[#0B0E11] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#707A8A]">
                    Settlement rule
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#AEB4BC]">
                    {template.settlementRule}
                  </p>
                </div>
              </div>

              <CreateMarketDialog
                adminKey={adminKey.trim()}
                initialCategory={template.category}
                initialSettlementRule={template.settlementRule}
                initialTitle={template.title}
                onCreated={() => undefined}
                redirectOnCreated={false}
                triggerClassName="terminal-button focus-ring mt-4 w-full px-3 py-2 text-sm font-bold"
                triggerLabel="Deploy on Arc"
              />
            </article>
          );
        })}
      </section>

      {visibleTemplates.length === 0 ? (
        <section className="exchange-panel p-6 text-center">
          <p className="font-bold text-[#EAECEF]">No templates found.</p>
          <p className="mt-1 text-sm text-[#707A8A]">
            Try another category or search term.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function AdminMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-3">
      <div className="flex items-center gap-2 text-[#FCD535]">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#707A8A]">
          {label}
        </p>
      </div>
      <p className="mt-2 font-mono text-lg font-black text-[#EAECEF]">{value}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#2B3139] bg-[#0B0E11] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#707A8A]">
        {label}
      </p>
      <p className="mt-1 line-clamp-2 text-xs font-bold text-[#EAECEF]">{value}</p>
    </div>
  );
}

function riskClass(riskLevel: string) {
  if (riskLevel === "Low") {
    return "border-[#0ECB81]/40 bg-[#0ECB81]/10 text-[#BFFFE7]";
  }

  if (riskLevel === "High") {
    return "border-[#F6465D]/40 bg-[#F6465D]/10 text-[#FFD7DD]";
  }

  return "border-[#FCD535]/40 bg-[#FCD535]/10 text-[#FFF3AF]";
}

