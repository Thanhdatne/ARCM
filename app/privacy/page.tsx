"use client";

import { Badge } from "@/components/ui/badge";
import { Activity, EyeOff, FileCheck2, KeyRound, ReceiptText, ShieldCheck } from "lucide-react";

const features = [
  ["Shielded positions", "Preview-only position-size hiding. Current positions are public on Arc Testnet.", ShieldCheck],
  ["Hidden order amounts", "Future interface concept for activity rows with redacted size.", EyeOff],
  ["Private activity feed", "Reduced public metadata preview, not live privacy.", Activity],
  ["Auditable settlement", "Market outcomes and payout verification remain explicit.", FileCheck2],
  ["View key access", "Mock auditor-access concept for future privacy support.", KeyRound],
  ["Private receipts", "Receipt preview for private metadata with public settlement.", ReceiptText],
] as const;

const modelRows = [
  ["Position size", "Public on Arc Testnet", "Preview-hidden size"],
  ["Trader identity", "Wallet address / pseudonymous public activity", "Pseudonymous private activity concept"],
  ["Market outcome", "Public", "Public outcome, private metadata concept"],
  ["Settlement", "Public onchain settlement", "Auditable private receipt concept"],
  ["View key", "Not live", "Optional mock auditor access"],
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Privacy Preview</div>
        <div className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {["Privacy Preview", "Arc Testnet", "Public today"].map((badge) => (
            <Badge key={badge} variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
              {badge}
            </Badge>
          ))}
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#EAECEF] sm:text-2xl">
          Arc Privacy Preview
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#707A8A]">
          Preview how shielded position metadata and auditable settlement could feel if privacy support is integrated later.
        </p>
        <p className="terminal-card mt-4 max-w-3xl p-4 text-sm font-bold leading-6 text-[#EAECEF]">
          Privacy Preview is mock UX only. Current Arc Testnet trades and positions are public.
        </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {features.map(([title, copy, Icon]) => (
          <article key={title} className="terminal-surface p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-[#EAECEF]">{title}</h2>
              <Icon className="h-4 w-4 text-[#FCD535]" />
            </div>
            <p className="text-xs leading-5 text-[#707A8A]">{copy}</p>
          </article>
        ))}
      </section>

      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Privacy Model</div>
        <div className="terminal-card m-3 overflow-hidden">
          <div className="grid grid-cols-[0.85fr_1.2fr_1.2fr] border-b border-[#2B3139] bg-[#1E2329] text-xs font-bold uppercase tracking-[0.12em] text-[#EAECEF]">
            <div className="p-3">Field</div>
            <div className="p-3">Today</div>
            <div className="p-3">Preview</div>
          </div>
          {modelRows.map(([field, today, preview]) => (
            <div key={field} className="grid grid-cols-[0.85fr_1.2fr_1.2fr] border-b border-[#2B3139] text-sm last:border-b-0">
              <div className="p-3 font-semibold text-[#EAECEF]">{field}</div>
              <div className="p-3 text-[#707A8A]">{today}</div>
              <div className="p-3 text-[#FCD535]">{preview}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="exchange-panel">
          <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Activity Preview</div>
          <div className="grid gap-3 p-3">
            <ActivityRow label="Public today" detail="0xde...f825 bought YES" amount="120 ARCT" />
            <ActivityRow label="Privacy preview" detail="Shielded trader opened YES" amount="Amount hidden" />
          </div>
        </section>

        <section className="exchange-panel">
          <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Important Notes</div>
          <div className="space-y-2 p-3 text-sm text-[#707A8A]">
            {[
              "Core prediction markets remain public EVM today.",
              "Frontend-only privacy is not a privacy guarantee.",
              "Oracle settlement should remain auditable.",
              "Future privacy support may be integrated when available.",
            ].map((note) => (
              <p key={note} className="terminal-card px-3 py-2">
                {note}
              </p>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function ActivityRow({
  label,
  detail,
  amount,
}: {
  label: string;
  detail: string;
  amount: string;
}) {
  return (
    <div className="terminal-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#707A8A]">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[#EAECEF]">{detail}</span>
        <span className="font-mono text-[#707A8A]">{amount}</span>
      </div>
    </div>
  );
}
