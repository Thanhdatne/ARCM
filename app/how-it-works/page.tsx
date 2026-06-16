"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CircleHelp,
  Layers3,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

const steps = [
  {
    title: "Pick a market",
    description:
      "Choose a fixture or question from the open Markets page. Home only shows deployed markets that can actually be traded.",
  },
  {
    title: "Choose an outcome",
    description:
      "For football fixtures, one match can show three choices: Team A, Draw, and Team B. Each choice opens the real binary market behind it.",
  },
  {
    title: "Trade with test collateral",
    description:
      "Buy YES or NO using ARCT test collateral on Arc Testnet. Positions are read from your connected wallet.",
  },
  {
    title: "Wait for settlement",
    description:
      "After the event ends, the market goes through the ARCM resolver and UMA Optimistic Oracle style settlement flow.",
  },
  {
    title: "Claim rewards",
    description:
      "Winning settled positions appear in Claims. Portfolio stays focused on balances, exposure, and position status.",
  },
];

const marketCategories = [
  {
    title: "World Cup",
    examples: ["Match winner", "Draw result", "Group-stage outcomes"],
    status: "Live focus",
  },
  {
    title: "Arc ecosystem",
    examples: ["Arc milestones", "Ecosystem launches", "Testnet activity"],
    status: "Next",
  },
  {
    title: "Crypto",
    examples: ["BTC / ETH levels", "Market close prices", "Major protocol events"],
    status: "Planned",
  },
  {
    title: "Stablecoins",
    examples: ["USDC peg checks", "Depeg events", "Stablecoin adoption"],
    status: "Planned",
  },
  {
    title: "AI",
    examples: ["Model releases", "Coding agent launches", "AI product milestones"],
    status: "Planned",
  },
  {
    title: "Macro / RWA",
    examples: ["Rates", "CPI", "Tokenized treasury milestones"],
    status: "Planned",
  },
];

const rules = [
  "No fake tradable markets on Home.",
  "Every public market needs a real market address and AMM address.",
  "Every market needs a clear settlement rule before deployment.",
  "Completed markets are hidden from Home and handled through Portfolio or Claims.",
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">How it works</div>
        <div className="grid gap-5 p-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {["Arc Testnet", "Prediction markets", "Onchain settlement"].map((item) => (
                <span
                  className="rounded-full border border-[#2B3139] bg-[#1E2329] px-3 py-1 text-xs font-bold text-[#707A8A]"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>

            <h1 className="max-w-3xl text-2xl font-black tracking-tight text-[#EAECEF] sm:text-4xl">
              Trade event outcomes on ARCM.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#707A8A]">
              ARCM is an Arc Testnet prediction market MVP. Pick an event, trade an outcome, wait for settlement, then claim rewards if your position wins.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link className="terminal-button focus-ring px-4 py-2 text-sm font-bold" href="/">
                Explore markets
              </Link>
              <Link
                className="focus-ring rounded-lg border border-[#2B3139] bg-[#1E2329] px-4 py-2 text-sm font-bold text-[#EAECEF] transition hover:border-[#FCD535]"
                href="/claims"
              >
                View claims
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-[#2B3139] bg-[#1E2329] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#FCD535]">
              <CircleHelp className="h-4 w-4" />
              MVP rule
            </div>
            <p className="text-sm leading-6 text-[#707A8A]">
              Home is for open tradable markets only. Portfolio is for positions. Claims is for rewards. Admin deployment and settlement tools should stay hidden on public builds.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        {steps.map((step, index) => (
          <article className="terminal-surface p-3" key={step.title}>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[#2B3139] bg-[#0B0E11] font-mono text-sm font-black text-[#FCD535]">
              {index + 1}
            </div>
            <h2 className="text-sm font-black text-[#EAECEF]">{step.title}</h2>
            <p className="mt-2 text-xs leading-5 text-[#707A8A]">{step.description}</p>
          </article>
        ))}
      </section>

      <section className="exchange-panel">
        <div className="terminal-titlebar flex items-center gap-2 px-3 py-1.5">
          <Layers3 className="h-4 w-4" />
          <h2 className="text-sm font-bold">Market variety</h2>
        </div>

        <div className="p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-[#EAECEF]">More categories, same real-market rule</h3>
              <p className="mt-1 text-xs text-[#707A8A]">
                New categories can be added, but they should only appear as tradable when deployed and settlement rules are clear.
              </p>
            </div>
            <span className="w-fit rounded-full border border-[#FCD535] bg-[#FCD535]/15 px-3 py-1 text-xs font-black text-[#FFF3AF]">
              No fake markets
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {marketCategories.map((category) => (
              <article className="terminal-card p-3" key={category.title}>
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-black text-[#EAECEF]">{category.title}</h4>
                  <span className="rounded border border-[#2B3139] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#707A8A]">
                    {category.status}
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {category.examples.map((example) => (
                    <li className="flex items-center gap-2 text-xs text-[#707A8A]" key={example}>
                      <ArrowRight className="h-3.5 w-3.5 text-[#FCD535]" />
                      {example}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="exchange-panel">
          <div className="terminal-titlebar flex items-center gap-2 px-3 py-1.5">
            <ShieldCheck className="h-4 w-4" />
            <h2 className="text-sm font-bold">Market quality rules</h2>
          </div>
          <div className="space-y-2 p-4">
            {rules.map((rule) => (
              <div className="terminal-card flex items-start gap-2 p-3 text-sm text-[#707A8A]" key={rule}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0ECB81]" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="exchange-panel">
          <div className="terminal-titlebar flex items-center gap-2 px-3 py-1.5">
            <Sparkles className="h-4 w-4" />
            <h2 className="text-sm font-bold">Example clean market</h2>
          </div>
          <div className="space-y-3 p-4">
            <div className="terminal-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#707A8A]">Question</p>
              <p className="mt-1 text-sm font-bold text-[#EAECEF]">
                Will ETH close above $4,000 on June 30, 2026?
              </p>
            </div>
            <div className="terminal-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#707A8A]">Settlement rule</p>
              <p className="mt-1 text-sm leading-6 text-[#707A8A]">
                YES if the selected ETH/USD source closes above $4,000 on the target date. Otherwise NO.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniTile icon={Trophy} label="Outcome" value="YES / NO" />
              <MiniTile icon={BadgeDollarSign} label="Collateral" value="ARCT" />
              <MiniTile icon={ShieldCheck} label="Status" value="Deploy only when clear" />
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function MiniTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) {
  return (
    <div className="terminal-card p-3">
      <Icon className="mb-2 h-4 w-4 text-[#FCD535]" />
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#707A8A]">{label}</p>
      <p className="mt-1 text-xs font-bold text-[#EAECEF]">{value}</p>
    </div>
  );
}

