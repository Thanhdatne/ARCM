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

export function dynamicToCardData(market: DynamicMarket): MarketCardData {
  return {
    id: market.id,
    address: market.address,
    ammAddress: market.ammAddress,
    title: market.title,
    icon: "AS",
    yesPrice: 0.5,
    noPrice: 0.5,
    volume: "Onchain",
    category: market.category,
    isReal: true,
    imageSrc: market.category === "World Cup" ? "/market-images/world-cup.svg" : "/market-images/arc.svg",
    imageAlt: `${market.category} market`,
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
    icon: "AS",
    yesPrice: 0.5,
    noPrice: 0.5,
    volume: "Onchain",
    category: "Arc Testnet",
    isReal: true,
    imageSrc: "/market-images/arc.svg",
    imageAlt: "ArcSignal market",
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
    title: "Example: Will stablecoin volume rise this week?",
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
    imageSrc: "/market-images/arc.svg",
    imageAlt: "Arc ecosystem market preview",
  },
];
