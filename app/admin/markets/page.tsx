"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreateMarketDialog } from "@/components/CreateMarketDialog";
import { Input } from "@/components/ui/input";
import {
  MARKET_TEMPLATES,
  type MarketTemplateCategory,
} from "@/lib/marketTemplates";
import { CheckCircle2, KeyRound, Layers3, RefreshCw, Search, ShieldCheck, Trophy } from "lucide-react";


type OutcomeType = "home_win" | "draw" | "away_win";

interface WorldCupResultRecord {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "pending" | "final" | "postponed" | "cancelled";
  result?: OutcomeType | null;
  updatedAt: string;
  source?: string;
}

interface WorldCupDeployment {
  worldCupMarketId?: string;
  fixtureId: string;
  group?: string;
  question: string;
  outcomeType: OutcomeType | string;
  marketAddress: string;
  ammAddress?: string;
  contractVersion?: number;
  collateralSymbol?: string;
  createdAt?: string;
}

interface ResolverItem {
  fixtureId: string;
  outcomeType: string;
  question: string;
  proposedSide?: "YES" | "NO";
  action: "prepared" | "proposed" | "settled" | "skipped" | "failed";
  reason: string;
  state?: number;
  txHash?: string;
}

interface ResolverResponse {
  success?: boolean;
  error?: string;
  action?: string;
  fixtureId?: string;
  proposed?: number;
  settled?: number;
  skipped?: number;
  failed?: number;
  items?: ResolverItem[];
}

interface FixtureResolverStatus {
  fixtureId: string;
  status:
    | "notDeployed"
    | "needsResolve"
    | "waiting"
    | "readyToSettle"
    | "settled"
    | "partial"
    | "oracleSettled"
    | "unknown";
  reason: string;
  marketsTotal: number;
  needsResolve: number;
  waiting: number;
  readyToSettle: number;
  settled: number;
  oracleSettled: number;
  failed: number;
}

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
  const [worldCupResults, setWorldCupResults] = useState<WorldCupResultRecord[]>([]);
  const [worldCupDeployments, setWorldCupDeployments] = useState<WorldCupDeployment[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [deploymentsLoading, setDeploymentsLoading] = useState(true);
  const [resolverBusy, setResolverBusy] = useState("");
  const [resolverError, setResolverError] = useState("");
  const [resolverResponse, setResolverResponse] =
    useState<ResolverResponse | null>(null);
  const [resolverStatuses, setResolverStatuses] = useState<
    Record<string, FixtureResolverStatus>
  >({});
  const [statusesLoading, setStatusesLoading] = useState(true);

  useEffect(() => {
    setAdminKey(window.localStorage.getItem("ARCM-admin-key") ?? "");
  }, []);

  const loadWorldCupResults = async () => {
    setResultsLoading(true);

    try {
      const response = await fetch("/api/world-cup/results", {
        cache: "no-store",
      });
      const data = (await response.json()) as
        | WorldCupResultRecord[]
        | Record<string, WorldCupResultRecord>;

      setWorldCupResults(Array.isArray(data) ? data : Object.values(data ?? {}));
    } catch {
      setWorldCupResults([]);
    } finally {
      setResultsLoading(false);
    }
  };

  const loadWorldCupDeployments = async () => {
    setDeploymentsLoading(true);

    try {
      const response = await fetch("/api/world-cup/deployments", {
        cache: "no-store",
      });
      const data = (await response.json()) as
        | WorldCupDeployment[]
        | {
            deployments?: WorldCupDeployment[];
            markets?: WorldCupDeployment[];
            data?: WorldCupDeployment[];
          }
        | Record<string, WorldCupDeployment>;

      const deployments = Array.isArray(data)
        ? data
        : Array.isArray(data.deployments)
          ? data.deployments
          : Array.isArray(data.markets)
            ? data.markets
            : Array.isArray(data.data)
              ? data.data
              : Object.values(data ?? {});

      setWorldCupDeployments(
        deployments.filter((deployment) => (
          Boolean(deployment.fixtureId) &&
          Boolean(deployment.marketAddress)
        )),
      );
    } catch {
      setWorldCupDeployments([]);
    } finally {
      setDeploymentsLoading(false);
    }
  };

  const loadResolverStatuses = async () => {
    setStatusesLoading(true);

    try {
      const response = await fetch("/api/world-cup/resolver-status", {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        fixtures?: FixtureResolverStatus[];
      };
      const nextStatuses = Object.fromEntries(
        (data.fixtures ?? []).map((fixture) => [fixture.fixtureId, fixture]),
      );

      setResolverStatuses(nextStatuses);
    } catch {
      setResolverStatuses({});
    } finally {
      setStatusesLoading(false);
    }
  };

  useEffect(() => {
    void loadWorldCupResults();
    void loadWorldCupDeployments();
    void loadResolverStatuses();
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

  const finalResults = useMemo(() => {
    return worldCupResults
      .filter((result) => result.status === "final" && result.result)
      .sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));
  }, [worldCupResults]);

  const visibleFinalResults = useMemo(() => {
    return finalResults.filter((result) => (
      resolverStatuses[result.fixtureId]?.status !== "settled"
    ));
  }, [finalResults, resolverStatuses]);

  const deploymentsByFixture = useMemo(() => {
    const grouped: Record<string, WorldCupDeployment[]> = {};

    for (const deployment of worldCupDeployments) {
      if (!deployment.fixtureId) continue;

      grouped[deployment.fixtureId] = [
        ...(grouped[deployment.fixtureId] ?? []),
        deployment,
      ];
    }

    for (const fixtureDeployments of Object.values(grouped)) {
      fixtureDeployments.sort((a, b) => (
        outcomeRank(a.outcomeType) - outcomeRank(b.outcomeType)
      ));
    }

    return grouped;
  }, [worldCupDeployments]);

  const settledFixtureCount = finalResults.length - visibleFinalResults.length;
  const readyToSettleCount = visibleFinalResults.filter((result) => (
    resolverStatuses[result.fixtureId]?.status === "readyToSettle"
  )).length;
  const waitingFixtureCount = visibleFinalResults.filter((result) => (
    resolverStatuses[result.fixtureId]?.status === "waiting"
  )).length;

  const runResolver = async (
    action: "resolveFixture" | "settleFixture" | "settleReady",
    fixtureId?: string,
  ) => {
    const key = adminKey.trim();

    if (!key) {
      setResolverError("Paste ADMIN_API_KEY first.");
      return;
    }

    const busyKey = fixtureId ? `${action}:${fixtureId}` : action;
    setResolverBusy(busyKey);
    setResolverError("");

    try {
      const response = await fetch("/api/world-cup/manual-resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": key,
        },
        body: JSON.stringify({ action, fixtureId, limit: 12 }),
      });

      const data = (await response.json().catch(() => ({}))) as ResolverResponse;

      if (!response.ok) {
        throw new Error(data.error || "Resolver request failed.");
      }

      setResolverResponse(data);
      window.setTimeout(() => {
        void loadResolverStatuses();
      }, 1_500);
      window.setTimeout(() => {
        void loadResolverStatuses();
      }, 7_000);
    } catch (error) {
      setResolverError(
        error instanceof Error ? error.message : "Resolver request failed.",
      );
    } finally {
      setResolverBusy("");
    }
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

      <section className="exchange-panel overflow-hidden border border-[#FCD535]/20">
        <div className="terminal-titlebar flex items-center justify-between gap-3 px-3 py-2 text-sm font-bold">
          <span>World Cup Results & Resolver</span>
          <span className="rounded-full border border-[#0ECB81]/50 bg-[#0ECB81]/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#BFFFE7]">
            Manual safe mode
          </span>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[1fr_380px]">
          <div>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FCD535] text-[#181A20]">
                <Trophy className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-[#EAECEF]">
                  Resolve finished fixtures
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#707A8A]">
                  Pick one finished match, click Resolve Fixture once, wait for UMA liveness,
                  then click Settle Fixture. One fixture controls all 3 markets: home win, draw, away win.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="focus-ring rounded-lg border border-[#2B3139] bg-[#0B0E11] px-4 py-2 text-sm font-black text-[#EAECEF] transition hover:border-[#FCD535]"
                onClick={() => {
                  void loadWorldCupResults();
                  void loadWorldCupDeployments();
                  void loadResolverStatuses();
                }}
                type="button"
              >
                Refresh status
              </button>

              {readyToSettleCount > 0 ? (
                <button
                  className="terminal-button focus-ring px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!adminKey.trim() || !!resolverBusy}
                  onClick={() => void runResolver("settleReady")}
                  type="button"
                >
                  {resolverBusy === "settleReady"
                    ? "Settling..."
                    : `Settle ${readyToSettleCount} ready fixture${readyToSettleCount > 1 ? "s" : ""}`}
                </button>
              ) : null}

              {waitingFixtureCount > 0 ? (
                <span className="rounded-lg border border-[#FCD535]/30 bg-[#FCD535]/10 px-3 py-2 text-xs font-bold text-[#FFF3AF]">
                  {waitingFixtureCount} fixture{waitingFixtureCount > 1 ? "s" : ""} waiting UMA liveness
                </span>
              ) : null}

              {settledFixtureCount > 0 ? (
                <span className="rounded-lg border border-[#0ECB81]/30 bg-[#0ECB81]/10 px-3 py-2 text-xs font-bold text-[#BFFFE7]">
                  {settledFixtureCount} settled hidden
                </span>
              ) : null}
            </div>

            {!adminKey.trim() ? (
              <p className="mt-3 rounded-lg border border-[#FCD535]/40 bg-[#FCD535]/10 px-3 py-2 text-xs font-bold text-[#FFF3AF]">
                Paste and save ADMIN_API_KEY above before resolving.
              </p>
            ) : null}

            {resolverError ? (
              <p className="mt-3 rounded-lg border border-[#F6465D]/40 bg-[#F6465D]/10 px-3 py-2 text-xs font-bold text-[#FFD7DD]">
                {resolverError}
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {resultsLoading ? (
                <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-4 text-sm font-bold text-[#707A8A]">
                  Loading World Cup results...
                </div>
              ) : null}

              {!resultsLoading && visibleFinalResults.length === 0 ? (
                <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-4 text-sm font-bold text-[#707A8A]">
                  No unresolved final fixtures. Settled fixtures are hidden.
                </div>
              ) : null}

              {visibleFinalResults.map((result) => {
                const busyResolve = resolverBusy === `resolveFixture:${result.fixtureId}`;
                const busySettle = resolverBusy === `settleFixture:${result.fixtureId}`;
                const status = resolverStatuses[result.fixtureId];
                const statusKey = status?.status ?? "unknown";
                const fixtureDeployments = deploymentsByFixture[result.fixtureId] ?? [];
                const deployedCount = fixtureDeployments.length;
                const canResolve =
                  statusKey === "needsResolve" ||
                  statusKey === "partial" ||
                  statusKey === "unknown";
                const canSettle = statusKey === "readyToSettle";

                return (
                  <article
                    className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-3"
                    key={result.fixtureId}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#707A8A]">
                          {result.fixtureId}
                        </p>
                        <h3 className="mt-1 text-lg font-black text-[#EAECEF]">
                          {result.homeTeam} {result.homeScore ?? "-"} - {result.awayScore ?? "-"} {result.awayTeam}
                        </h3>
                      </div>

                      <span className="rounded-full border border-[#0ECB81]/40 bg-[#0ECB81]/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#BFFFE7]">
                        {result.result?.replace("_", " ")}
                      </span>
                    </div>

                    <div className="mt-3 rounded-lg border border-[#1E2329] bg-[#181A20] px-3 py-2 text-xs leading-5 text-[#AEB4BC]">
                      <span className="font-black uppercase tracking-[0.12em] text-[#FCD535]">
                        {statusLabel(statusKey)}
                      </span>
                      <span className="ml-2">
                        {statusesLoading ? "Loading status..." : status?.reason ?? "Status not loaded yet."}
                      </span>
                    </div>

                    <div className="mt-3 rounded-lg border border-[#1E2329] bg-[#06080A] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#707A8A]">
                          Deployed V2 markets
                        </p>
                        <span className="font-mono text-[11px] font-black text-[#FCD535]">
                          {deploymentsLoading ? "..." : `${deployedCount}/3`}
                        </span>
                      </div>

                      {deploymentsLoading ? (
                        <p className="mt-2 text-xs font-bold text-[#707A8A]">
                          Loading deployed markets...
                        </p>
                      ) : fixtureDeployments.length === 0 ? (
                        <p className="mt-2 text-xs font-bold text-[#707A8A]">
                          No deployed V2 markets indexed for this finished fixture.
                        </p>
                      ) : (
                        <div className="mt-2 grid gap-2">
                          {fixtureDeployments.map((deployment) => {
                            const proposedSide = suggestedSideFor(result, deployment);

                            return (
                              <Link
                                className="focus-ring flex items-center justify-between gap-3 rounded-lg border border-[#2B3139] bg-[#181A20] px-3 py-2 text-xs transition hover:border-[#FCD535]/70"
                                href={`/market/${deployment.marketAddress}?tab=resolve`}
                                key={`${deployment.fixtureId}-${deployment.outcomeType}-${deployment.marketAddress}`}
                              >
                                <span className="min-w-0">
                                  <span className="block font-black text-[#EAECEF]">
                                    {outcomeLabel(deployment.outcomeType)}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[#707A8A]">
                                    {deployment.question}
                                  </span>
                                </span>

                                <span className="flex shrink-0 items-center gap-2">
                                  <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${proposedSideClass(proposedSide)}`}>
                                    Propose {proposedSide}
                                  </span>
                                  <span className="interactive-link text-[11px]">
                                    Resolve
                                  </span>
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {canResolve ? (
                        <button
                          className="terminal-button focus-ring px-3 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!adminKey.trim() || !!resolverBusy}
                          onClick={() => void runResolver("resolveFixture", result.fixtureId)}
                          type="button"
                        >
                          {busyResolve ? "Resolving..." : "Resolve Fixture"}
                        </button>
                      ) : null}

                      {canSettle ? (
                        <button
                          className="terminal-button focus-ring px-3 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!adminKey.trim() || !!resolverBusy}
                          onClick={() => void runResolver("settleFixture", result.fixtureId)}
                          type="button"
                        >
                          {busySettle ? "Settling..." : "Settle Fixture"}
                        </button>
                      ) : null}

                      {statusKey === "waiting" ? (
                        <button
                          className="rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-2 text-sm font-black text-[#707A8A]"
                          disabled
                          type="button"
                        >
                          Waiting liveness
                        </button>
                      ) : null}

                      {statusKey === "oracleSettled" ? (
                        <button
                          className="rounded-lg border border-[#F6465D]/40 bg-[#F6465D]/10 px-3 py-2 text-sm font-black text-[#FFD7DD]"
                          disabled
                          type="button"
                        >
                          Oracle settled, market not updated
                        </button>
                      ) : null}

                      {statusKey === "notDeployed" ? (
                        <button
                          className="rounded-lg border border-[#2B3139] bg-[#1E2329] px-3 py-2 text-sm font-black text-[#707A8A]"
                          disabled
                          type="button"
                        >
                          Not deployed
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#2B3139] bg-[#0B0E11] p-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#707A8A]">
              Latest resolver run
            </p>

            {resolverResponse ? (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <ResolveMetric label="Proposed" value={resolverResponse.proposed ?? 0} />
                  <ResolveMetric label="Settled" value={resolverResponse.settled ?? 0} />
                  <ResolveMetric label="Failed" value={resolverResponse.failed ?? 0} />
                </div>

                <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-[#2B3139] bg-[#06080A]">
                  {resolverResponse.items?.map((item, index) => (
                    <div
                      className="border-b border-[#1E2329] px-3 py-2 text-xs last:border-b-0"
                      key={`${item.fixtureId}-${item.outcomeType}-${index}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#EAECEF]">
                          {item.outcomeType}
                          {item.proposedSide ? ` → ${item.proposedSide}` : ""}
                        </span>
                        <span className="font-mono text-[#FCD535]">{item.action}</span>
                      </div>
                      <p className="mt-1 text-[#707A8A]">{item.reason}</p>
                      {item.txHash ? (
                        <p className="mt-1 break-all font-mono text-[#0ECB81]">{item.txHash}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#707A8A]">
                Click Resolve Fixture on one finished match. After 60–90 seconds,
                click Settle Fixture for the same match.
              </p>
            )}
          </div>
        </div>
      </section>

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
              contract, initializes UMA settlement, deploys an AMM, and seeds configured collateral liquidity.
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


function outcomeRank(outcomeType: string) {
  if (outcomeType === "home_win") return 0;
  if (outcomeType === "draw") return 1;
  if (outcomeType === "away_win") return 2;

  return 99;
}

function outcomeLabel(outcomeType: string) {
  if (outcomeType === "home_win") return "Home win";
  if (outcomeType === "draw") return "Draw";
  if (outcomeType === "away_win") return "Away win";

  return outcomeType.replaceAll("_", " ");
}

function suggestedSideFor(
  result: WorldCupResultRecord,
  deployment: WorldCupDeployment,
): "YES" | "NO" {
  return deployment.outcomeType === result.result ? "YES" : "NO";
}

function proposedSideClass(side: "YES" | "NO") {
  return side === "YES"
    ? "border-[#0ECB81]/40 bg-[#0ECB81]/10 text-[#BFFFE7]"
    : "border-[#F6465D]/40 bg-[#F6465D]/10 text-[#FFD7DD]";
}

function statusLabel(status: FixtureResolverStatus["status"] | "unknown") {
  switch (status) {
    case "needsResolve":
      return "Needs resolve";
    case "waiting":
      return "Waiting settle";
    case "readyToSettle":
      return "Ready to settle";
    case "settled":
      return "Settled";
    case "partial":
      return "Partial";
    case "oracleSettled":
      return "Oracle settled";
    case "notDeployed":
      return "Not deployed";
    default:
      return "Unknown";
  }
}

function ResolveMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#2B3139] bg-[#1E2329] p-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#707A8A]">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-black text-[#FCD535]">{value}</p>
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

