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
import { WORLD_CUP_FIXTURES } from "@/src/lib/worldCupMarkets";
import {
  calculateFixtureResult,
  canUpdateFixtureResult,
  type WorldCupResultRecord,
  type WorldCupResultStatus,
} from "@/src/lib/worldCupResults";

const resultStatuses: WorldCupResultStatus[] = ["pending", "final", "postponed", "cancelled"];

function getResultsFilePath() {
  return path.resolve(process.cwd(), "data", "world-cup-results.json");
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

export async function GET() {
  return NextResponse.json(readResults());
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE !== "true") {
    return NextResponse.json({ error: "Admin World Cup result updates are disabled." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const input = body as {
      fixtureId?: unknown;
      homeScore?: unknown;
      awayScore?: unknown;
      status?: unknown;
    };
    const fixtureId = typeof input.fixtureId === "string" ? input.fixtureId : "";
    const fixture = WORLD_CUP_FIXTURES.find((item) => item.fixtureId === fixtureId);

    if (!fixture) {
      return NextResponse.json({ error: "Unknown World Cup fixture." }, { status: 404 });
    }

    const status = parseStatus(input.status);
    const homeScore = parseScore(input.homeScore);
    const awayScore = parseScore(input.awayScore);

    if (status === "final" && (homeScore === null || awayScore === null)) {
      return NextResponse.json({ error: "Final results require both home and away scores." }, { status: 422 });
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
