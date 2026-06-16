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

// Source snapshot: FIFA World Cup 2026 group-stage schedule.
// Times are stored in UTC ISO format so UI sorting stays stable across user time zones.
export const WORLD_CUP_FIXTURES: WorldCupFixture[] = [
  fixture("group-a-mexico-vs-south-africa", "Group A", "Mexico", "South Africa", "2026-06-11T19:00:00.000Z"),
  fixture("group-a-korea-republic-vs-czechia", "Group A", "South Korea", "Czechia", "2026-06-12T02:00:00.000Z"),
  fixture("group-b-canada-vs-bosnia-and-herzegovina", "Group B", "Canada", "Bosnia and Herzegovina", "2026-06-12T19:00:00.000Z"),
  fixture("group-d-united-states-vs-paraguay", "Group D", "United States", "Paraguay", "2026-06-13T01:00:00.000Z"),
  fixture("group-b-qatar-vs-switzerland", "Group B", "Qatar", "Switzerland", "2026-06-13T19:00:00.000Z"),
  fixture("group-c-brazil-vs-morocco", "Group C", "Brazil", "Morocco", "2026-06-13T22:00:00.000Z"),
  fixture("group-c-haiti-vs-scotland", "Group C", "Haiti", "Scotland", "2026-06-14T01:00:00.000Z"),
  fixture("group-d-australia-vs-turkey", "Group D", "Australia", "Turkey", "2026-06-14T04:00:00.000Z"),
  fixture("group-e-germany-vs-curacao", "Group E", "Germany", "Curacao", "2026-06-14T17:00:00.000Z"),
  fixture("group-f-netherlands-vs-japan", "Group F", "Netherlands", "Japan", "2026-06-14T20:00:00.000Z"),
  fixture("group-e-cote-divoire-vs-ecuador", "Group E", "Ivory Coast", "Ecuador", "2026-06-14T23:00:00.000Z"),
  fixture("group-f-sweden-vs-tunisia", "Group F", "Sweden", "Tunisia", "2026-06-15T02:00:00.000Z"),
  fixture("group-h-spain-vs-cape-verde", "Group H", "Spain", "Cape Verde", "2026-06-15T16:00:00.000Z"),
  fixture("group-g-belgium-vs-egypt", "Group G", "Belgium", "Egypt", "2026-06-15T19:00:00.000Z"),
  fixture("group-h-saudi-arabia-vs-uruguay", "Group H", "Saudi Arabia", "Uruguay", "2026-06-15T22:00:00.000Z"),
  fixture("group-g-iran-vs-new-zealand", "Group G", "Iran", "New Zealand", "2026-06-16T01:00:00.000Z"),
  fixture("group-i-france-vs-senegal", "Group I", "France", "Senegal", "2026-06-16T19:00:00.000Z"),
  fixture("group-i-iraq-vs-norway", "Group I", "Iraq", "Norway", "2026-06-16T22:00:00.000Z"),
  fixture("group-j-argentina-vs-algeria", "Group J", "Argentina", "Algeria", "2026-06-17T01:00:00.000Z"),
  fixture("group-j-austria-vs-jordan", "Group J", "Austria", "Jordan", "2026-06-17T04:00:00.000Z"),
  fixture("group-k-portugal-vs-dr-congo", "Group K", "Portugal", "DR Congo", "2026-06-17T17:00:00.000Z"),
  fixture("group-l-england-vs-croatia", "Group L", "England", "Croatia", "2026-06-17T20:00:00.000Z"),
  fixture("group-l-ghana-vs-panama", "Group L", "Ghana", "Panama", "2026-06-17T23:00:00.000Z"),
  fixture("group-k-uzbekistan-vs-colombia", "Group K", "Uzbekistan", "Colombia", "2026-06-18T02:00:00.000Z"),
  fixture("group-a-czechia-vs-south-africa", "Group A", "Czechia", "South Africa", "2026-06-18T16:00:00.000Z"),
  fixture("group-b-switzerland-vs-bosnia-and-herzegovina", "Group B", "Switzerland", "Bosnia and Herzegovina", "2026-06-18T19:00:00.000Z"),
  fixture("group-b-canada-vs-qatar", "Group B", "Canada", "Qatar", "2026-06-18T22:00:00.000Z"),
  fixture("group-a-mexico-vs-korea-republic", "Group A", "Mexico", "South Korea", "2026-06-19T01:00:00.000Z"),
  fixture("group-d-united-states-vs-australia", "Group D", "United States", "Australia", "2026-06-19T19:00:00.000Z"),
  fixture("group-c-scotland-vs-morocco", "Group C", "Scotland", "Morocco", "2026-06-19T22:00:00.000Z"),
  fixture("group-c-brazil-vs-haiti", "Group C", "Brazil", "Haiti", "2026-06-20T00:30:00.000Z"),
  fixture("group-d-turkey-vs-paraguay", "Group D", "Turkey", "Paraguay", "2026-06-20T03:00:00.000Z"),
  fixture("group-f-netherlands-vs-sweden", "Group F", "Netherlands", "Sweden", "2026-06-20T17:00:00.000Z"),
  fixture("group-e-germany-vs-cote-divoire", "Group E", "Germany", "Ivory Coast", "2026-06-20T20:00:00.000Z"),
  fixture("group-e-ecuador-vs-curacao", "Group E", "Ecuador", "Curacao", "2026-06-21T00:00:00.000Z"),
  fixture("group-f-tunisia-vs-japan", "Group F", "Tunisia", "Japan", "2026-06-21T04:00:00.000Z"),
  fixture("group-h-spain-vs-saudi-arabia", "Group H", "Spain", "Saudi Arabia", "2026-06-21T16:00:00.000Z"),
  fixture("group-g-belgium-vs-iran", "Group G", "Belgium", "Iran", "2026-06-21T19:00:00.000Z"),
  fixture("group-h-uruguay-vs-cape-verde", "Group H", "Uruguay", "Cape Verde", "2026-06-21T22:00:00.000Z"),
  fixture("group-g-new-zealand-vs-egypt", "Group G", "New Zealand", "Egypt", "2026-06-22T01:00:00.000Z"),
  fixture("group-j-argentina-vs-austria", "Group J", "Argentina", "Austria", "2026-06-22T17:00:00.000Z"),
  fixture("group-i-france-vs-iraq", "Group I", "France", "Iraq", "2026-06-22T21:00:00.000Z"),
  fixture("group-i-norway-vs-senegal", "Group I", "Norway", "Senegal", "2026-06-23T00:00:00.000Z"),
  fixture("group-j-jordan-vs-algeria", "Group J", "Jordan", "Algeria", "2026-06-23T03:00:00.000Z"),
  fixture("group-k-portugal-vs-uzbekistan", "Group K", "Portugal", "Uzbekistan", "2026-06-23T17:00:00.000Z"),
  fixture("group-l-england-vs-ghana", "Group L", "England", "Ghana", "2026-06-23T20:00:00.000Z"),
  fixture("group-l-panama-vs-croatia", "Group L", "Panama", "Croatia", "2026-06-23T23:00:00.000Z"),
  fixture("group-k-colombia-vs-dr-congo", "Group K", "Colombia", "DR Congo", "2026-06-24T02:00:00.000Z"),
  fixture("group-b-switzerland-vs-canada", "Group B", "Switzerland", "Canada", "2026-06-24T19:00:00.000Z"),
  fixture("group-b-bosnia-and-herzegovina-vs-qatar", "Group B", "Bosnia and Herzegovina", "Qatar", "2026-06-24T19:00:00.000Z"),
  fixture("group-c-morocco-vs-haiti", "Group C", "Morocco", "Haiti", "2026-06-24T22:00:00.000Z"),
  fixture("group-c-scotland-vs-brazil", "Group C", "Scotland", "Brazil", "2026-06-24T22:00:00.000Z"),
  fixture("group-a-south-africa-vs-korea-republic", "Group A", "South Africa", "South Korea", "2026-06-25T01:00:00.000Z"),
  fixture("group-a-czechia-vs-mexico", "Group A", "Czechia", "Mexico", "2026-06-25T01:00:00.000Z"),
  fixture("group-e-curacao-vs-cote-divoire", "Group E", "Curacao", "Ivory Coast", "2026-06-25T20:00:00.000Z"),
  fixture("group-e-ecuador-vs-germany", "Group E", "Ecuador", "Germany", "2026-06-25T20:00:00.000Z"),
  fixture("group-f-tunisia-vs-netherlands", "Group F", "Tunisia", "Netherlands", "2026-06-25T23:00:00.000Z"),
  fixture("group-f-japan-vs-sweden", "Group F", "Japan", "Sweden", "2026-06-25T23:00:00.000Z"),
  fixture("group-d-turkey-vs-united-states", "Group D", "Turkey", "United States", "2026-06-26T02:00:00.000Z"),
  fixture("group-d-paraguay-vs-australia", "Group D", "Paraguay", "Australia", "2026-06-26T02:00:00.000Z"),
  fixture("group-i-norway-vs-france", "Group I", "Norway", "France", "2026-06-26T19:00:00.000Z"),
  fixture("group-i-senegal-vs-iraq", "Group I", "Senegal", "Iraq", "2026-06-26T19:00:00.000Z"),
  fixture("group-h-cape-verde-vs-saudi-arabia", "Group H", "Cape Verde", "Saudi Arabia", "2026-06-27T00:00:00.000Z"),
  fixture("group-h-uruguay-vs-spain", "Group H", "Uruguay", "Spain", "2026-06-27T00:00:00.000Z"),
  fixture("group-g-new-zealand-vs-belgium", "Group G", "New Zealand", "Belgium", "2026-06-27T03:00:00.000Z"),
  fixture("group-g-egypt-vs-iran", "Group G", "Egypt", "Iran", "2026-06-27T03:00:00.000Z"),
  fixture("group-l-panama-vs-england", "Group L", "Panama", "England", "2026-06-27T21:00:00.000Z"),
  fixture("group-l-croatia-vs-ghana", "Group L", "Croatia", "Ghana", "2026-06-27T21:00:00.000Z"),
  fixture("group-k-colombia-vs-portugal", "Group K", "Colombia", "Portugal", "2026-06-27T23:30:00.000Z"),
  fixture("group-k-dr-congo-vs-uzbekistan", "Group K", "DR Congo", "Uzbekistan", "2026-06-27T23:30:00.000Z"),
  fixture("group-j-algeria-vs-austria", "Group J", "Algeria", "Austria", "2026-06-28T02:00:00.000Z"),
  fixture("group-j-jordan-vs-argentina", "Group J", "Jordan", "Argentina", "2026-06-28T02:00:00.000Z"),
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
    odds: 0.44,
    question: ({ homeTeam, awayTeam }) => `Will ${homeTeam} beat ${awayTeam}?`,
    rule: ({ homeTeam, awayTeam }) =>
      `YES if the official FIFA group-stage result is ${homeTeam} win over ${awayTeam}. If the match is cancelled, abandoned, or rescheduled, settlement should remain pending until an admin/UMA resolution is proposed. Final score display is informational only; payout uses ARCM resolver / UMA flow.`,
  },
  {
    idSuffix: "draw",
    outcomeType: "draw",
    odds: 0.28,
    question: ({ homeTeam, awayTeam }) => `Will ${homeTeam} vs ${awayTeam} end in a draw?`,
    rule: ({ homeTeam, awayTeam }) =>
      `YES if the official FIFA group-stage result for ${homeTeam} vs ${awayTeam} is a draw. If the match is cancelled, abandoned, or rescheduled, settlement should remain pending until an admin/UMA resolution is proposed. Final score display is informational only; payout uses ARCM resolver / UMA flow.`,
  },
  {
    idSuffix: "away",
    outcomeType: "away_win",
    odds: 0.36,
    question: ({ homeTeam, awayTeam }) => `Will ${awayTeam} beat ${homeTeam}?`,
    rule: ({ homeTeam, awayTeam }) =>
      `YES if the official FIFA group-stage result is ${awayTeam} win over ${homeTeam}. If the match is cancelled, abandoned, or rescheduled, settlement should remain pending until an admin/UMA resolution is proposed. Final score display is informational only; payout uses ARCM resolver / UMA flow.`,
  },
];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[â€™']/g, "")
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
    const yesPrice = Math.min(
      Math.max(template.odds + ((fixtureIndex + templateIndex) % 5) * 0.02 - 0.04, 0.18),
      0.82,
    );

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

