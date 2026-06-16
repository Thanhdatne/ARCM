/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { MARKET_ADDRESS, AMM_ADDRESS } from "./contracts";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface MarketCardData {
  id: string;
  address: string;
  ammAddress?: string;
  title: string;
  icon: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  category: string;
  isReal?: boolean;
  imageSrc?: string;
  imageAlt?: string;
}

export interface DynamicMarket {
  id: string;
  address: string;
  ammAddress: string;
  title: string;
  category: string;
  createdAt: string;
}

type VisualAsset = {
  icon: string;
  imageSrc: string;
  imageAlt: string;
};

function normalize(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getMarketVisualAsset(title: string, category: string): VisualAsset {
  const text = normalize(`${title} ${category}`);

  if (/\beth\b|ethereum/.test(text)) {
    return {
      icon: "ETH",
      imageSrc: "/market-images/eth.svg",
      imageAlt: "Ethereum price market",
    };
  }

  if (/\bbtc\b|bitcoin/.test(text)) {
    return {
      icon: "BTC",
      imageSrc: "/market-images/btc.svg",
      imageAlt: "Bitcoin price market",
    };
  }

  if (/\bsol\b|solana/.test(text)) {
    return {
      icon: "SOL",
      imageSrc: "/market-images/sol.svg",
      imageAlt: "Solana price market",
    };
  }

  if (/\busdc\b|stablecoin|depeg|peg/.test(text)) {
    return {
      icon: "USDC",
      imageSrc: "/market-images/usdc.svg",
      imageAlt: "Stablecoin market",
    };
  }

  if (/\bai\b|openai|agent|model|llm|gpu|nvidia/.test(text) || normalize(category) === "ai") {
    return {
      icon: "AI",
      imageSrc: "/market-images/ai.svg",
      imageAlt: "AI market",
    };
  }

  if (/fed|rate|cpi|inflation|macro|unemployment|gdp/.test(text) || normalize(category) === "macro") {
    return {
      icon: "MAC",
      imageSrc: "/market-images/macro.svg",
      imageAlt: "Macro market",
    };
  }

  if (/treasury|rwa|bond|yield|real world asset|tokenized/.test(text) || normalize(category) === "rwa") {
    return {
      icon: "RWA",
      imageSrc: "/market-images/rwa.svg",
      imageAlt: "RWA market",
    };
  }

  if (/privacy|zk|zero knowledge|shield|private/.test(text) || normalize(category) === "privacy") {
    return {
      icon: "ZK",
      imageSrc: "/market-images/privacy.svg",
      imageAlt: "Privacy market",
    };
  }

  if (/world cup|beat|draw|football|soccer/.test(text) || normalize(category) === "world cup") {
    return {
      icon: "WC",
      imageSrc: "/market-images/world-cup.svg",
      imageAlt: "World Cup market",
    };
  }

  if (/arc|arc testnet|ARCM/.test(text) || normalize(category).includes("arc")) {
    return {
      icon: "ARC",
      imageSrc: "/branding/ARCM-logo.png",
      imageAlt: "ARCM market",
    };
  }

  return {
    icon: "AS",
    imageSrc: "/branding/ARCM-logo.png",
    imageAlt: "ARCM market",
  };
}

export function dynamicToCardData(market: DynamicMarket): MarketCardData {
  const visual = getMarketVisualAsset(market.title, market.category);

  return {
    id: market.id,
    address: market.address,
    ammAddress: market.ammAddress,
    title: market.title,
    icon: visual.icon,
    yesPrice: 0.5,
    noPrice: 0.5,
    volume: "Onchain",
    category: market.category,
    isReal: true,
    imageSrc: visual.imageSrc,
    imageAlt: visual.imageAlt,
  };
}

// Configured onchain market from the official deployment flow. If env vars are
// unset this resolves to zero addresses and is hidden by the homepage.
export const MARKETS: MarketCardData[] = [
  {
    id: "configured-sample",
    address: MARKET_ADDRESS,
    ammAddress: AMM_ADDRESS,
    title: "Configured Arc prediction market",
    icon: "ARC",
    yesPrice: 0.5,
    noPrice: 0.5,
    volume: "Onchain",
    category: "Arc Testnet",
    isReal: true,
    imageSrc: "/branding/ARCM-logo.png",
    imageAlt: "ARCM market",
  },
];

export const PREVIEW_MARKETS: MarketCardData[] = [
  {
    id: "preview-btc",
    address: "0x0000000000000000000000000000000000000001",
    title: "Example: Will BTC close above its weekly high?",
    icon: "BTC",
    yesPrice: 0.58,
    noPrice: 0.42,
    volume: "Preview",
    category: "Preview",
    imageSrc: "/market-images/btc.svg",
    imageAlt: "Bitcoin market preview",
  },
  {
    id: "preview-stables",
    address: "0x0000000000000000000000000000000000000002",
    title: "Example: Will USDC keep its $1 peg this week?",
    icon: "USDC",
    yesPrice: 0.64,
    noPrice: 0.36,
    volume: "Preview",
    category: "Preview",
    imageSrc: "/market-images/usdc.svg",
    imageAlt: "Stablecoin market preview",
  },
  {
    id: "preview-arc",
    address: "0x0000000000000000000000000000000000000003",
    title: "Example: Will a new Arc ecosystem app launch?",
    icon: "ARC",
    yesPrice: 0.47,
    noPrice: 0.53,
    volume: "Preview",
    category: "Preview",
    imageSrc: "/branding/ARCM-logo.png",
    imageAlt: "Arc ecosystem market preview",
  },
];

