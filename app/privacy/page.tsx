"use client";

import { Badge } from "@/components/ui/badge";
import { Activity, EyeOff, FileCheck2, KeyRound, ReceiptText, ShieldCheck } from "lucide-react";

const features = [
  ["Shielded positions", "Concept only. Current Arc Testnet positions and wallet balances are public.", ShieldCheck],
  ["Hidden order amounts", "Not live. Current trade amounts are not shielded by this interface.", EyeOff],
  ["Private activity feed", "Future roadmap only. Public wallet activity remains visible today.", Activity],
  ["Auditable settlement", "Live rule: market outcomes and payout verification remain public and explicit.", FileCheck2],
  ["View key access", "Not live. Mock auditor access is only a future privacy support concept.", KeyRound],
  ["Private receipts", "Concept only. Current receipts, settlement, and claims are public testnet flows.", ReceiptText],
] as const;

const modelRows = [
  ["Position size", "Public on Arc Testnet", "Future concept only"],
  ["Trader identity", "Wallet address / pseudonymous public activity", "Future privacy concept only"],
  ["Market outcome", "Public", "Public outcome, private metadata concept only"],
  ["Settlement", "Public onchain settlement", "Must remain auditable"],
  ["View key", "Not live", "Future roadmap only"],
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="exchange-panel">
        <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Privacy Preview</div>
        <div className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {["Concept only", "Arc Testnet", "Public today"].map((badge) => (
            <Badge key={badge} variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
              {badge}
            </Badge>
          ))}
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#EAECEF] sm:text-2xl">
          Arc Privacy Preview: Concept Only
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#A7B1C2]">
          This page shows a future privacy concept only. The current ARCM app does not hide trades, positions, wallet activity, claims, or settlement on Arc Testnet.
        </p>
        <p className="terminal-card mt-4 max-w-3xl p-4 text-sm font-bold leading-6 text-[#EAECEF]">
          Privacy Preview is concept-only. Current Arc Testnet trades, positions, wallet activity, claims, and settlement are public.
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
            <p className="text-xs leading-5 text-[#A7B1C2]">{copy}</p>
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
              <div className="p-3 text-[#A7B1C2]">{today}</div>
              <div className="p-3 text-[#FCD535]">{preview}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="exchange-panel">
          <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Activity Preview</div>
          <div className="grid gap-3 p-3">
            <ActivityRow label="Public today" detail="0xde...f825 bought YES" amount="0.02 USDC" />
            <ActivityRow label="Future concept only" detail="Shielded trader opened YES" amount="Not live" />
          </div>
        </section>

        <section className="exchange-panel">
          <div className="terminal-titlebar px-3 py-1.5 text-sm font-bold">Important Notes</div>
          <div className="space-y-2 p-3 text-sm text-[#A7B1C2]">
            {[
              "Current Arc Testnet trades, positions, wallet activity, and claims are public.",
              "Frontend-only privacy is not a privacy guarantee.",
              "Oracle settlement must remain auditable and explicit.",
              "Future privacy support may be integrated later, but it is not live today.",
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A7B1C2]">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[#EAECEF]">{detail}</span>
        <span className="font-mono text-[#A7B1C2]">{amount}</span>
      </div>
    </div>
  );
}
