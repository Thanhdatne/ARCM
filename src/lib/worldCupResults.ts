import type { WorldCupFixture, WorldCupOutcomeType } from "./worldCupMarkets";

export type WorldCupResultStatus = "pending" | "final" | "postponed" | "cancelled";
export type WorldCupFixtureResult = WorldCupOutcomeType | "pending";
export type WorldCupSuggestedResult = "YES" | "NO" | "pending";

export interface WorldCupResultRecord {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: WorldCupResultStatus;
  result: WorldCupFixtureResult;
  updatedAt: string;
  source: "manual_admin";
}

export function calculateFixtureResult(
  homeScore: number | null,
  awayScore: number | null,
  status: WorldCupResultStatus,
): WorldCupFixtureResult {
  if (status !== "final" || homeScore === null || awayScore === null) return "pending";
  if (homeScore > awayScore) return "home_win";
  if (homeScore < awayScore) return "away_win";
  return "draw";
}

export function calculateSuggestedResult(
  result: WorldCupFixtureResult,
  outcomeType: WorldCupOutcomeType,
  status: WorldCupResultStatus,
): WorldCupSuggestedResult {
  if (status !== "final" || result === "pending") return "pending";
  return result === outcomeType ? "YES" : "NO";
}

export function canUpdateFixtureResult(
  fixture: Pick<WorldCupFixture, "resultUpdateAllowedAt">,
  options: { overrideEnabled?: boolean; now?: Date } = {},
) {
  if (options.overrideEnabled) return true;
  return (options.now ?? new Date()).getTime() >= new Date(fixture.resultUpdateAllowedAt).getTime();
}

export function formatFixtureScore(result: WorldCupResultRecord | undefined) {
  if (!result) return "Pending";
  if (result.status === "postponed") return "Postponed";
  if (result.status === "cancelled") return "Cancelled";
  if (result.homeScore === null || result.awayScore === null) return "Pending";
  return `${result.homeTeam} ${result.homeScore}-${result.awayScore} ${result.awayTeam}`;
}
