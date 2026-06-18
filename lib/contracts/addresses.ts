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

import { type Address } from "viem";

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

export const ARCT_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_ARCT_ADDRESS as Address) ??
  ZERO_ADDRESS;

export const ARC_USDC_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS as Address) ??
  ZERO_ADDRESS;

export const ARC_EURC_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_ARC_EURC_ADDRESS as Address) ??
  ZERO_ADDRESS;

export const ARC_GATEWAY_WALLET_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_ARC_GATEWAY_WALLET_ADDRESS as Address) ??
  ZERO_ADDRESS;

const configuredCctpDomain = process.env.NEXT_PUBLIC_ARC_CCTP_DOMAIN?.trim();
const parsedCctpDomain = configuredCctpDomain
  ? Number(configuredCctpDomain)
  : Number.NaN;

export const ARC_CCTP_DOMAIN =
  Number.isSafeInteger(parsedCctpDomain) && parsedCctpDomain >= 0
    ? parsedCctpDomain
    : undefined;

export const MARKET_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_MARKET_ADDRESS as Address) ??
  ZERO_ADDRESS;

export const AMM_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_AMM_ADDRESS as Address) ??
  ZERO_ADDRESS;

export const OO_V2_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_OO_V2_ADDRESS as Address) ??
  ZERO_ADDRESS;

export const TIMER_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_TIMER_ADDRESS as Address) ??
  ZERO_ADDRESS;

export const FINDER_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_FINDER_ADDRESS as Address) ??
  ZERO_ADDRESS;

export const COLLATERAL_DECIMALS = 18;
