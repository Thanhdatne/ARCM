export type WorldCupMarketStatus = "external";
export type WorldCupOutcomeType = "home_win" | "draw" | "away_win";
export type WorldCupGroup =
  | "Group A"
  | "Group B"
  | "Group C"
  | "Group D"
  | "Group E"
  | "Group F"
  | "Group G"
  | "Group H"
  | "Group I"
  | "Group J"
  | "Group K"
  | "Group L";

export interface WorldCupFixture {
  fixtureId: string;
  group: WorldCupGroup;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  estimatedEndTime: string;
  resultUpdateAllowedAt: string;
}

export interface WorldCupMarket {
  id: string;
  fixtureId: string;
  group: WorldCupGroup;
  homeTeam: string;
  awayTeam: string;
  question: string;
  outcomeType: WorldCupOutcomeType;
  kickoffTime: string;
  estimatedEndTime: string;
  resultUpdateAllowedAt: string;
  category: "World Cup";
  subcategory: "Games";
  settlementRule: string;
  imageSrc: string;
  imageAlt: string;
  status: WorldCupMarketStatus;
  externalYesPrice?: number;
  externalNoPrice?: number;
  marketAddress?: string;
  ammAddress?: string;
}

export const WORLD_CUP_GROUP_FILTERS: Array<"All" | WorldCupGroup> = [
  "All",
  "Group A",
  "Group B",
  "Group C",
  "Group D",
  "Group E",
  "Group F",
  "Group G",
  "Group H",
  "Group I",
  "Group J",
  "Group K",
  "Group L",
];

function addMinutes(value: string, minutes: number) {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}

function fixture(
  fixtureId: string,
  group: WorldCupGroup,
  homeTeam: string,
  awayTeam: string,
  kickoffTime: string,
): WorldCupFixture {
  return {
    fixtureId,
    group,
    homeTeam,
    awayTeam,
    kickoffTime,
    estimatedEndTime: addMinutes(kickoffTime, 120),
    resultUpdateAllowedAt: addMinutes(kickoffTime, 130),
  };
}

export const WORLD_CUP_FIXTURES: WorldCupFixture[] = [
  fixture("group-a-brazil-vs-morocco", "Group A", "Brazil", "Morocco", "2026-06-13T00:00:00.000Z"),
  fixture("group-a-mexico-vs-japan", "Group A", "Mexico", "Japan", "2026-06-13T03:00:00.000Z"),
  fixture("group-b-argentina-vs-france", "Group B", "Argentina", "France", "2026-06-13T06:00:00.000Z"),
  fixture("group-b-usa-vs-ghana", "Group B", "USA", "Ghana", "2026-06-13T09:00:00.000Z"),
  fixture("group-c-england-vs-croatia", "Group C", "England", "Croatia", "2026-06-13T12:00:00.000Z"),
  fixture("group-c-spain-vs-senegal", "Group C", "Spain", "Senegal", "2026-06-13T15:00:00.000Z"),
  fixture("group-d-germany-vs-south-korea", "Group D", "Germany", "South Korea", "2026-06-13T18:00:00.000Z"),
  fixture("group-d-portugal-vs-canada", "Group D", "Portugal", "Canada", "2026-06-13T21:00:00.000Z"),
  fixture("group-e-netherlands-vs-egypt", "Group E", "Netherlands", "Egypt", "2026-06-14T00:00:00.000Z"),
  fixture("group-e-uruguay-vs-australia", "Group E", "Uruguay", "Australia", "2026-06-14T03:00:00.000Z"),
  fixture("group-f-italy-vs-nigeria", "Group F", "Italy", "Nigeria", "2026-06-14T06:00:00.000Z"),
  fixture("group-f-colombia-vs-switzerland", "Group F", "Colombia", "Switzerland", "2026-06-14T09:00:00.000Z"),
  fixture("group-g-belgium-vs-usa", "Group G", "Belgium", "USA", "2026-06-14T12:00:00.000Z"),
  fixture("group-g-chile-vs-poland", "Group G", "Chile", "Poland", "2026-06-14T15:00:00.000Z"),
  fixture("group-h-denmark-vs-serbia", "Group H", "Denmark", "Serbia", "2026-06-14T18:00:00.000Z"),
  fixture("group-h-turkiye-vs-costa-rica", "Group H", "Turkiye", "Costa Rica", "2026-06-14T21:00:00.000Z"),
  fixture("group-i-sweden-vs-ecuador", "Group I", "Sweden", "Ecuador", "2026-06-15T00:00:00.000Z"),
  fixture("group-i-qatar-vs-ivory-coast", "Group I", "Qatar", "Ivory Coast", "2026-06-15T03:00:00.000Z"),
  fixture("group-j-wales-vs-peru", "Group J", "Wales", "Peru", "2026-06-15T06:00:00.000Z"),
  fixture("group-j-iran-vs-cameroon", "Group J", "Iran", "Cameroon", "2026-06-15T09:00:00.000Z"),
  fixture("group-k-ukraine-vs-panama", "Group K", "Ukraine", "Panama", "2026-06-15T12:00:00.000Z"),
  fixture("group-k-norway-vs-saudi-arabia", "Group K", "Norway", "Saudi Arabia", "2026-06-15T15:00:00.000Z"),
  fixture("group-l-austria-vs-jamaica", "Group L", "Austria", "Jamaica", "2026-06-15T18:00:00.000Z"),
  fixture("group-l-paraguay-vs-new-zealand", "Group L", "Paraguay", "New Zealand", "2026-06-15T21:00:00.000Z"),
];

const outcomeTemplates: Array<{
  idSuffix: "home" | "draw" | "away";
  outcomeType: WorldCupOutcomeType;
  odds: number;
  question: (fixture: WorldCupFixture) => string;
  rule: (fixture: WorldCupFixture) => string;
}> = [
  {
    idSuffix: "home",
    outcomeType: "home_win",
    odds: 0.48,
    question: ({ homeTeam, awayTeam }) => `Will ${homeTeam} beat ${awayTeam}?`,
    rule: ({ homeTeam, awayTeam }) =>
      `YES if the official FIFA group-stage result is ${homeTeam} win over ${awayTeam}. If the match is cancelled, abandoned, or rescheduled, mark settlement pending and do not auto-settle. Final result display data is informational only; settlement uses ArcSignal resolver / UMA flow.`,
  },
  {
    idSuffix: "draw",
    outcomeType: "draw",
    odds: 0.27,
    question: ({ homeTeam, awayTeam }) => `Will ${homeTeam} vs ${awayTeam} end in a draw?`,
    rule: ({ homeTeam, awayTeam }) =>
      `YES if the official FIFA group-stage result for ${homeTeam} vs ${awayTeam} is a draw. If the match is cancelled, abandoned, or rescheduled, mark settlement pending and do not auto-settle. Final result display data is informational only; settlement uses ArcSignal resolver / UMA flow.`,
  },
  {
    idSuffix: "away",
    outcomeType: "away_win",
    odds: 0.39,
    question: ({ homeTeam, awayTeam }) => `Will ${awayTeam} beat ${homeTeam}?`,
    rule: ({ homeTeam, awayTeam }) =>
      `YES if the official FIFA group-stage result is ${awayTeam} win over ${homeTeam}. If the match is cancelled, abandoned, or rescheduled, mark settlement pending and do not auto-settle. Final result display data is informational only; settlement uses ArcSignal resolver / UMA flow.`,
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function groupSlug(group: WorldCupGroup) {
  return group.toLowerCase().replace(/\s+/g, "-");
}

function marketId(fixture: WorldCupFixture, idSuffix: "home" | "draw" | "away") {
  return `worldcup-${groupSlug(fixture.group)}-${slugify(fixture.homeTeam)}-vs-${slugify(fixture.awayTeam)}-${idSuffix}`;
}

export const WORLD_CUP_MARKETS: WorldCupMarket[] = WORLD_CUP_FIXTURES.flatMap((fixture, fixtureIndex) =>
  outcomeTemplates.map((template, templateIndex) => {
    const yesPrice = Math.min(Math.max(template.odds + ((fixtureIndex + templateIndex) % 5) * 0.02 - 0.04, 0.18), 0.82);

    return {
      id: marketId(fixture, template.idSuffix),
      fixtureId: fixture.fixtureId,
      group: fixture.group,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      question: template.question(fixture),
      outcomeType: template.outcomeType,
      kickoffTime: fixture.kickoffTime,
      estimatedEndTime: fixture.estimatedEndTime,
      resultUpdateAllowedAt: fixture.resultUpdateAllowedAt,
      category: "World Cup",
      subcategory: "Games",
      settlementRule: template.rule(fixture),
      imageSrc: "/market-images/world-cup.svg",
      imageAlt: `${fixture.homeTeam} versus ${fixture.awayTeam} World Cup market`,
      status: "external",
      externalYesPrice: yesPrice,
      externalNoPrice: 1 - yesPrice,
    };
  }),
);
