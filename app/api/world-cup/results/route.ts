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
import { getAdminRequestError } from "@/lib/adminGuard";
import { WORLD_CUP_FIXTURES } from "@/src/lib/worldCupMarkets";
import {
  calculateFixtureResult,
  canUpdateFixtureResult,
  type WorldCupResultRecord,
  type WorldCupResultStatus,
} from "@/src/lib/worldCupResults";

const resultStatuses: WorldCupResultStatus[] = ["pending", "final", "postponed", "cancelled"];
type WinningSide = "YES" | "NO";

interface StoredMarketRecord {
  id?: string;
  address?: string;
  marketAddress?: string;
  ammAddress?: string;
  title?: string;
  category?: string;
  homeTeam?: string;
  awayTeam?: string;
  stage?: string;
  kickoffTime?: string;
  contractVersion?: number;
  collateralAddress?: string;
  collateralSymbol?: string;
  collateralDecimals?: number;
  finalHomeScore?: number;
  finalAwayScore?: number;
  winningSide?: WinningSide;
  winningTeam?: string;
  resultSource?: string;
  resultUpdatedAt?: string;
  resultStatus?: "saved" | "proposed" | "settled";
}

function getResultsFilePath() {
  return path.resolve(process.cwd(), "data", "world-cup-results.json");
}

function getMarketsFilePath() {
  return path.resolve(process.cwd(), "data", "markets.json");
}

function readResults(): WorldCupResultRecord[] {
  try {
    const data = fs.readFileSync(getResultsFilePath(), "utf-8");
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      return Object.values(parsed as Record<string, WorldCupResultRecord>);
    }
    return [];
  } catch {
    return [];
  }
}

function writeResults(results: WorldCupResultRecord[]) {
  fs.mkdirSync(path.dirname(getResultsFilePath()), { recursive: true });
  const byFixtureId = results.reduce<Record<string, WorldCupResultRecord>>((acc, result) => {
    acc[result.fixtureId] = result;
    return acc;
  }, {});
  fs.writeFileSync(getResultsFilePath(), `${JSON.stringify(byFixtureId, null, 2)}\n`);
}

function readMarkets(): StoredMarketRecord[] {
  try {
    const data = fs.readFileSync(getMarketsFilePath(), "utf-8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(data) as StoredMarketRecord[] | Record<string, StoredMarketRecord>;
    return Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch {
    return [];
  }
}

function writeMarkets(markets: StoredMarketRecord[]) {
  fs.writeFileSync(getMarketsFilePath(), `${JSON.stringify(markets, null, 2)}\n`);
}

function parseScore(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 99) {
    throw new Error("Scores must be whole numbers from 0 to 99.");
  }
  return value;
}

function parseStatus(value: unknown): WorldCupResultStatus {
  if (typeof value !== "string" || !resultStatuses.includes(value as WorldCupResultStatus)) {
    throw new Error("Status must be final, postponed, or cancelled.");
  }
  return value as WorldCupResultStatus;
}

function parseWinningSide(value: unknown): WinningSide {
  if (value !== "YES" && value !== "NO") {
    throw new Error("winningSide must be YES or NO.");
  }

  return value;
}

function isRoundOf32Market(market: StoredMarketRecord) {
  return (
    (market.category ?? "").toLowerCase().includes("world cup") &&
    /^Will .+? eliminate .+? in the Round of 32\??$/i.test(market.title ?? "") &&
    market.contractVersion === 2 &&
    Boolean(market.marketAddress || market.address) &&
    Boolean(market.ammAddress) &&
    Boolean(market.homeTeam) &&
    Boolean(market.awayTeam)
  );
}

function normalizeMatchText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function roundOf32Title(homeTeam?: string, awayTeam?: string) {
  if (!homeTeam || !awayTeam) return "";
  return `Will ${homeTeam} eliminate ${awayTeam} in the Round of 32?`;
}

function roundOf32MarketMatchesInput(
  market: StoredMarketRecord,
  input: { fixtureId: string; marketAddress: string; homeTeam?: string; awayTeam?: string },
) {
  const idMatch = marketFixtureId(market) === input.fixtureId;
  const address = (market.marketAddress || market.address || "").toLowerCase();
  if (idMatch || (!!input.marketAddress && address === input.marketAddress)) {
    return true;
  }

  const exactTitle = normalizeMatchText(roundOf32Title(input.homeTeam, input.awayTeam));
  const marketTitle = normalizeMatchText(market.title);
  if (exactTitle && marketTitle === exactTitle) return true;

  const homeTeam = normalizeMatchText(input.homeTeam);
  const awayTeam = normalizeMatchText(input.awayTeam);
  if (!homeTeam || !awayTeam) return false;

  return (
    normalizeMatchText(market.stage) === "round of 32" &&
    marketTitle.includes(homeTeam) &&
    marketTitle.includes(awayTeam)
  );
}

function marketFixtureId(market: StoredMarketRecord) {
  return market.id || market.marketAddress || market.address || "";
}

function roundOf32ResultRecord(market: StoredMarketRecord): WorldCupResultRecord | null {
  const hasSavedResult =
    market.resultStatus === "saved" ||
    market.resultStatus === "proposed" ||
    market.resultStatus === "settled";

  if (!isRoundOf32Market(market) || !hasSavedResult || !market.winningSide) {
    return null;
  }

  return {
    fixtureId: marketFixtureId(market),
    homeTeam: market.homeTeam ?? "",
    awayTeam: market.awayTeam ?? "",
    homeScore: typeof market.finalHomeScore === "number" ? market.finalHomeScore : null,
    awayScore: typeof market.finalAwayScore === "number" ? market.finalAwayScore : null,
    status: "final",
    result: market.winningSide === "YES" ? "home_win" : "away_win",
    updatedAt: market.resultUpdatedAt ?? new Date(0).toISOString(),
    source: "manual_admin",
  };
}

export async function GET() {
  const savedRoundOf32Results = readMarkets()
    .map(roundOf32ResultRecord)
    .filter((record): record is WorldCupResultRecord => Boolean(record));

  return NextResponse.json([...readResults(), ...savedRoundOf32Results]);
}

export async function POST(request: Request) {
  const adminError = getAdminRequestError(
    request,
    "Admin World Cup result updates are disabled.",
  );
  if (adminError) return adminError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const input = body as {
      fixtureId?: unknown;
      marketAddress?: unknown;
      homeTeam?: unknown;
      awayTeam?: unknown;
      homeScore?: unknown;
      awayScore?: unknown;
      status?: unknown;
      winningSide?: unknown;
      resultSource?: unknown;
    };
    const fixtureId = typeof input.fixtureId === "string" ? input.fixtureId : "";
    const fixture = WORLD_CUP_FIXTURES.find((item) => item.fixtureId === fixtureId);

    const status = parseStatus(input.status);
    const homeScore = parseScore(input.homeScore);
    const awayScore = parseScore(input.awayScore);

    if (status === "final" && (homeScore === null || awayScore === null)) {
      return NextResponse.json({ error: "Final results require both home and away scores." }, { status: 422 });
    }

    if (!fixture) {
      const marketAddress = typeof input.marketAddress === "string" ? input.marketAddress.toLowerCase() : "";
      const markets = readMarkets();
      const marketIndex = markets.findIndex((market) => {
        return isRoundOf32Market(market) && roundOf32MarketMatchesInput(market, {
          fixtureId,
          marketAddress,
          homeTeam: typeof input.homeTeam === "string" ? input.homeTeam : undefined,
          awayTeam: typeof input.awayTeam === "string" ? input.awayTeam : undefined,
        });
      });

      if (marketIndex === -1) {
        return NextResponse.json({ error: "Unknown World Cup fixture." }, { status: 404 });
      }

      const market = markets[marketIndex];
      const winningSide = parseWinningSide(input.winningSide);
      const source =
        typeof input.resultSource === "string" && input.resultSource.trim()
          ? input.resultSource.trim().slice(0, 160)
          : "Official match result";

      const nextMarket: StoredMarketRecord = {
        ...market,
        finalHomeScore: homeScore ?? undefined,
        finalAwayScore: awayScore ?? undefined,
        winningSide,
        winningTeam: winningSide === "YES" ? market.homeTeam : market.awayTeam,
        resultSource: source,
        resultUpdatedAt: new Date().toISOString(),
        resultStatus: "saved",
      };

      markets[marketIndex] = nextMarket;
      writeMarkets(markets);

      return NextResponse.json({
        fixtureId: marketFixtureId(nextMarket),
        marketAddress: nextMarket.marketAddress ?? nextMarket.address,
        finalHomeScore: nextMarket.finalHomeScore,
        finalAwayScore: nextMarket.finalAwayScore,
        winningSide: nextMarket.winningSide,
        winningTeam: nextMarket.winningTeam,
        resultSource: nextMarket.resultSource,
        resultUpdatedAt: nextMarket.resultUpdatedAt,
        resultStatus: nextMarket.resultStatus,
      });
    }

    if (
      !canUpdateFixtureResult(fixture, {
        overrideEnabled: process.env.NEXT_PUBLIC_ENABLE_ADMIN_RESULT_OVERRIDE === "true",
      })
    ) {
      return NextResponse.json(
        {
          error: "Final result updates are not allowed until after the scheduled result update time.",
          resultUpdateAllowedAt: fixture.resultUpdateAllowedAt,
        },
        { status: 403 },
      );
    }

    const record: WorldCupResultRecord = {
      fixtureId: fixture.fixtureId,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeScore: status === "final" ? homeScore : null,
      awayScore: status === "final" ? awayScore : null,
      status,
      result: calculateFixtureResult(homeScore, awayScore, status),
      updatedAt: new Date().toISOString(),
      source: "manual_admin",
    };

    const existing = readResults();
    const next = [
      ...existing.filter((item) => item.fixtureId !== fixture.fixtureId),
      record,
    ].sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));
    writeResults(next);

    return NextResponse.json(record);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid World Cup result update." },
      { status: 422 },
    );
  }
}
