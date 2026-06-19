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

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

interface MarketRecord {
  contractVersion?: number;
  contract_version?: number;
}

function getContractVersion(market: MarketRecord) {
  return market.contractVersion ?? market.contract_version ?? 1;
}

function getMarketsFilePath() {
  return path.resolve(process.cwd(), "data", "markets.json");
}

export async function GET() {
  try {
    const data = fs.readFileSync(getMarketsFilePath(), "utf-8");
    const parsed = JSON.parse(data) as MarketRecord[] | Record<string, MarketRecord>;
    const markets = Array.isArray(parsed) ? parsed : Object.values(parsed);
    const hideLegacy = process.env.NEXT_PUBLIC_HIDE_LEGACY_V1 === "true";

    return NextResponse.json(
      hideLegacy
        ? markets.filter((market) => getContractVersion(market) === 2)
        : markets,
    );
  } catch {
    return NextResponse.json([]);
  }
}
