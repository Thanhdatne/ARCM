/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { formatUnits } from "viem";
import { Database, ShieldCheck } from "lucide-react";

interface MarketHeaderProps {
  pairName: string | undefined;
  question: string | undefined;
  priceRequested: boolean | undefined;
  receivedSettlementPrice: boolean | undefined;
  settlementPrice: bigint | undefined;
}

type FixtureVisual = {
  type: "fixture";
  homeTeam: string;
  awayTeam: string;
  homeFlagCode?: string;
  awayFlagCode?: string;
};

type AssetVisual = {
  type: "asset";
  label: string;
  subtitle: string;
  imageSrc: string;
  accent: "yellow" | "green" | "blue" | "red";
};

type GenericVisual = {
  type: "generic";
};

type MarketVisualData = FixtureVisual | AssetVisual | GenericVisual;

const countryFlagCode: Record<string, string> = {
  "algeria": "dz",
  "argentina": "ar",
  "australia": "au",
  "austria": "at",
  "belgium": "be",
  "bosnia and herzegovina": "ba",
  "bosnia": "ba",
  "brazil": "br",
  "canada": "ca",
  "cape verde": "cv",
  "colombia": "co",
  "croatia": "hr",
  "curacao": "cw",
  "czechia": "cz",
  "czech republic": "cz",
  "dr congo": "cd",
  "congo dr": "cd",
  "drc": "cd",
  "ecuador": "ec",
  "egypt": "eg",
  "england": "gb-eng",
  "france": "fr",
  "germany": "de",
  "ghana": "gh",
  "haiti": "ht",
  "iran": "ir",
  "iraq": "iq",
  "ivory coast": "ci",
  "cote divoire": "ci",
  "cÃ´te divoire": "ci",
  "japan": "jp",
  "jordan": "jo",
  "mexico": "mx",
  "morocco": "ma",
  "netherlands": "nl",
  "new zealand": "nz",
  "norway": "no",
  "panama": "pa",
  "paraguay": "py",
  "portugal": "pt",
  "qatar": "qa",
  "saudi arabia": "sa",
  "scotland": "gb-sct",
  "senegal": "sn",
  "south africa": "za",
  "south korea": "kr",
  "korea republic": "kr",
  "spain": "es",
  "sweden": "se",
  "switzerland": "ch",
  "tunisia": "tn",
  "turkey": "tr",
  "united states": "us",
  "usa": "us",
  "us": "us",
  "uruguay": "uy",
  "uzbekistan": "uz",
};

function normalizeTeamName(value: string) {
  return value
    .trim()
    .replace(/[?!.]+$/g, "")
    .replace(/\s+/g, " ");
}

function normalizeKey(value: string) {
  return normalizeTeamName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[â€™']/g, "")
    .toLowerCase();
}

function getFlagCode(team: string) {
  return countryFlagCode[normalizeKey(team)];
}

function extractFixtureVisual(question?: string): FixtureVisual | null {
  if (!question) return null;

  const cleanQuestion = question.trim().replace(/\s+/g, " ");

  const drawMatch = cleanQuestion.match(/^Will\s+(.+?)\s+vs\.?\s+(.+?)\s+end\s+in\s+a\s+draw\??$/i);
  if (drawMatch) {
    const homeTeam = normalizeTeamName(drawMatch[1]);
    const awayTeam = normalizeTeamName(drawMatch[2]);

    return {
      type: "fixture",
      homeTeam,
      awayTeam,
      homeFlagCode: getFlagCode(homeTeam),
      awayFlagCode: getFlagCode(awayTeam),
    };
  }

  const beatMatch = cleanQuestion.match(/^Will\s+(.+?)\s+beat\s+(.+?)\??$/i);
  if (beatMatch) {
    const homeTeam = normalizeTeamName(beatMatch[1]);
    const awayTeam = normalizeTeamName(beatMatch[2]);

    return {
      type: "fixture",
      homeTeam,
      awayTeam,
      homeFlagCode: getFlagCode(homeTeam),
      awayFlagCode: getFlagCode(awayTeam),
    };
  }

  return null;
}

function getAssetVisual(question?: string, pairName?: string): AssetVisual | null {
  const text = `${question ?? ""} ${pairName ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\beth\b|ethereum/.test(text)) {
    return {
      type: "asset",
      label: "ETH",
      subtitle: "Crypto price market",
      imageSrc: "/market-images/eth.svg",
      accent: "blue",
    };
  }

  if (/\bbtc\b|bitcoin/.test(text)) {
    return {
      type: "asset",
      label: "BTC",
      subtitle: "Crypto price market",
      imageSrc: "/market-images/btc.svg",
      accent: "yellow",
    };
  }

  if (/\bsol\b|solana/.test(text)) {
    return {
      type: "asset",
      label: "SOL",
      subtitle: "Crypto price market",
      imageSrc: "/market-images/sol.svg",
      accent: "green",
    };
  }

  if (/\busdc\b|stablecoin|depeg|peg/.test(text)) {
    return {
      type: "asset",
      label: "USDC",
      subtitle: "Stablecoin market",
      imageSrc: "/market-images/usdc.svg",
      accent: "blue",
    };
  }

  if (/\bai\b|openai|agent|model|llm|gpu|nvidia/.test(text)) {
    return {
      type: "asset",
      label: "AI",
      subtitle: "AI event market",
      imageSrc: "/market-images/ai.svg",
      accent: "green",
    };
  }

  if (/fed|rate|cpi|inflation|macro|unemployment|gdp/.test(text)) {
    return {
      type: "asset",
      label: "Macro",
      subtitle: "Macro market",
      imageSrc: "/market-images/macro.svg",
      accent: "yellow",
    };
  }

  if (/treasury|rwa|bond|yield|real world asset|tokenized/.test(text)) {
    return {
      type: "asset",
      label: "RWA",
      subtitle: "Tokenized asset market",
      imageSrc: "/market-images/rwa.svg",
      accent: "blue",
    };
  }

  if (/privacy|zk|zero knowledge|shield|private/.test(text)) {
    return {
      type: "asset",
      label: "Privacy",
      subtitle: "Privacy market",
      imageSrc: "/market-images/privacy.svg",
      accent: "green",
    };
  }

  if (/arc|arcm|arc testnet|builder demos|mainnet/.test(text)) {
    return {
      type: "asset",
      label: "Arc",
      subtitle: "Arc ecosystem market",
      imageSrc: "/brand/arc-logo.png",
      accent: "blue",
    };
  }

  return null;
}

function getMarketVisual(question?: string, pairName?: string): MarketVisualData {
  const fixtureVisual = extractFixtureVisual(question);
  if (fixtureVisual) return fixtureVisual;

  const assetVisual = getAssetVisual(question, pairName);
  if (assetVisual) return assetVisual;

  return { type: "generic" };
}

export function MarketHeader({
  pairName,
  question,
  priceRequested,
  receivedSettlementPrice,
  settlementPrice,
}: MarketHeaderProps) {
  const status = receivedSettlementPrice
    ? "Settled"
    : priceRequested
      ? "Open"
      : "Not Initialized";

  const statusColor = receivedSettlementPrice
    ? "text-[#0ECB81]"
    : priceRequested
      ? "text-[#FCD535]"
      : "text-[#FCD535]";

  let outcomeText: string | undefined;
  if (receivedSettlementPrice && settlementPrice !== undefined) {
    const price = formatUnits(settlementPrice, 18);
    if (price === "1") outcomeText = "YES";
    else if (price === "0.5") outcomeText = "Cannot be determined";
    else if (price === "0") outcomeText = "NO";
    else outcomeText = `Unknown (${price})`;
  }

  const visual = getMarketVisual(question, pairName);

  return (
    <div className="exchange-panel overflow-hidden">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
          <MarketVisual visual={visual} />
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                {pairName ?? visualLabel(visual)}
              </Badge>
              <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                UMA OO V2
              </Badge>
              <Badge variant="outline" className="border-[#2B3139] bg-[#1E2329] text-[#EAECEF]">
                ARCT collateral
              </Badge>
            </div>
            <h1 className="max-w-4xl text-2xl font-bold leading-tight tracking-tight text-[#EAECEF] sm:text-3xl">
              {question ?? pairName ?? "Market"}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#707A8A]">
              <span className="market-chip inline-flex items-center gap-1.5 px-3 py-1.5">
                <Database className="h-3.5 w-3.5 text-[#FCD535]" />
                Arc Testnet market
              </span>
              <span className="market-chip inline-flex items-center gap-1.5 px-3 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#FCD535]" />
                Positions public today
              </span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`h-8 border-[#2B3139] bg-[#1E2329] px-3 text-xs font-bold text-[#EAECEF] ${statusColor}`}>
          {status}
        </Badge>
      </div>

      {outcomeText && (
        <div className="m-5 mt-0 rounded-xl border border-[#2B3139] bg-[#0B0E11] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#707A8A]">Settlement outcome</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#0ECB81]">{outcomeText}</p>
        </div>
      )}
    </div>
  );
}

function visualLabel(visual: MarketVisualData) {
  if (visual.type === "fixture") return `${visual.homeTeam} vs ${visual.awayTeam}`;
  if (visual.type === "asset") return visual.label;
  return "Market";
}

function MarketVisual({ visual }: { visual: MarketVisualData }) {
  if (visual.type === "fixture") return <FixtureVisual visual={visual} />;
  if (visual.type === "asset") return <AssetMarketVisual visual={visual} />;

  return (
    <div className="flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#2B3139] bg-[#0B0E11] p-3 shadow-[inset_0_0_24px_rgba(255,255,255,0.04)] sm:w-36">
      <ARCMLogoMark className="h-16 w-16" />
    </div>
  );
}

function FixtureVisual({ visual }: { visual: FixtureVisual }) {
  return (
    <div className="flex h-24 w-full shrink-0 items-center justify-center rounded-2xl border border-[#3A424D] bg-[#0B0E11] p-3 shadow-[inset_0_0_24px_rgba(255,255,255,0.04)] sm:w-36">
      <div className="flex items-center gap-2">
        <FlagAvatar team={visual.homeTeam} flagCode={visual.homeFlagCode} />
        <span className="rounded-md border border-[#2B3139] bg-[#1E2329] px-1.5 py-1 text-[10px] font-black uppercase text-[#FCD535]">
          vs
        </span>
        <FlagAvatar team={visual.awayTeam} flagCode={visual.awayFlagCode} />
      </div>
    </div>
  );
}

function FlagAvatar({
  flagCode,
  team,
}: {
  flagCode?: string;
  team: string;
}) {
  const initials = team
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[#3A424D] bg-[#1E2329]">
      {flagCode ? (
        <img
          alt={`${team} flag`}
          className="h-full w-full object-cover"
          loading="lazy"
          src={`https://flagcdn.com/w80/${flagCode}.png`}
        />
      ) : (
        <span className="font-mono text-sm font-black text-[#EAECEF]">{initials}</span>
      )}
    </div>
  );
}

function AssetMarketVisual({ visual }: { visual: AssetVisual }) {
  const isArcLogo = visual.imageSrc.toLowerCase().includes("/brand/arc-logo.png");

  const lineClass =
    visual.accent === "green"
      ? "stroke-[#0ECB81]"
      : visual.accent === "blue"
        ? "stroke-[#5B8DEF]"
        : visual.accent === "red"
          ? "stroke-[#F6465D]"
          : "stroke-[#FCD535]";

  if (isArcLogo) {
    return (
      <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-2xl border border-[#3A424D] bg-[#071426] shadow-[inset_0_0_24px_rgba(255,255,255,0.04)] sm:w-36">
        <img
          alt={`${visual.label} market`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          src={visual.imageSrc}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#020617]/90 via-[#020617]/55 to-transparent px-3 pb-2 pt-8">
          <p className="font-mono text-sm font-black text-[#EAECEF]">{visual.label}</p>
          <p className="text-[10px] font-bold text-[#CBD5E1]">{visual.subtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-24 w-full shrink-0 overflow-hidden rounded-2xl border border-[#3A424D] bg-[#0B0E11] p-3 shadow-[inset_0_0_24px_rgba(255,255,255,0.04)] sm:w-36">
      <div className="absolute inset-x-3 bottom-4 h-12 opacity-70">
        <svg className="h-full w-full" viewBox="0 0 120 48" fill="none" aria-hidden="true">
          <path
            d="M0 36 C18 28 24 31 36 20 C50 6 63 19 76 13 C92 5 103 14 120 8"
            className={lineClass}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M0 42 C18 34 28 38 43 27 C58 16 70 27 84 20 C101 12 108 19 120 15"
            stroke="#0ECB81"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.62"
          />
        </svg>
      </div>

      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#2B3139] bg-[#1E2329] p-2 shadow-[0_10px_28px_rgba(0,0,0,0.25)]">
          <img
            alt={`${visual.label} market`}
            className="h-full w-full object-contain"
            loading="lazy"
            src={visual.imageSrc}
          />
        </div>
        <div>
          <p className="font-mono text-sm font-black text-[#EAECEF]">{visual.label}</p>
          <p className="text-[10px] font-bold text-[#707A8A]">{visual.subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function ARCMLogoMark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg
      aria-label="ARCM logo"
      className={className}
      fill="none"
      viewBox="0 0 56 56"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="56" height="56" rx="14" fill="#0B0E11" />
      <path
        d="M28 8L47 48H38.8L34.9 39.2H20.9L17 48H8.8L28 8Z"
        fill="#FCD535"
      />
      <path d="M27.9 20.7L34 34.3H22L27.9 20.7Z" fill="#0B0E11" />
      <path
        d="M16.5 45.5C25.9 35.3 35.6 29.5 48 27.8"
        stroke="#0B0E11"
        strokeLinecap="round"
        strokeWidth="5"
      />
      <path
        d="M15.5 45C25.4 35.9 35.1 30.9 47.2 29.5"
        stroke="#FCD535"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

