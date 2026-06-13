# World Cup Live Score And Settlement Plan

## Product Goal

ArcSignal should support real-time World Cup market display while keeping onchain payout tied to oracle / resolver settlement.

The World Cup UI can show live fixture status, scores, match clocks, and final results as a display layer. That display layer must not directly settle markets or trigger payouts. Settlement should remain a separate onchain lifecycle using the existing Arc prediction market sample flow, UMA Optimistic Oracle V2, or a future resolver/oracle flow.

## Data Layers

### 1. Live Score Display Layer

Purpose: show users what is happening in a fixture.

Data:
- Fixtures
- Kickoff time
- Live score
- Match clock
- Match status
- Final result
- Team names, crests, country codes
- Group standings if available

This layer powers UI context only. It should be treated as informative and cached.

### 2. Market Trading Layer

Purpose: show markets, odds, liquidity, and enable buy/sell actions.

Data:
- Market address
- AMM address
- Market question
- YES / NO prices
- Collateral token
- Market status
- User balances and allowances

This layer should continue using the existing onchain sample hooks and trading flow.

### 3. Oracle Settlement Layer

Purpose: finalize the official market outcome.

Data:
- Fixture final result
- Settlement source
- Settlement rule
- Proposed outcome
- Liveness / dispute state
- Settlement transaction status

The final result can inform a proposal, but the oracle / resolver process must remain the settlement source.

### 4. Claim Payout Layer

Purpose: let users claim after settlement.

Data:
- Settled outcome
- User winning/losing token balances
- Claimable collateral
- Claim transaction hash
- Claim status

Claims should only become available after the market is settled onchain.

## Live Score Provider Requirements

The sports data provider should support:

- Fixtures by competition and date range
- Kickoff time with timezone-safe timestamps
- Live score
- Match clock
- Match status such as scheduled, first half, halftime, second half, extra time, penalties, full time, abandoned, postponed
- Final result
- Team metadata such as names, abbreviations, flags, crests, and ids
- Group standings if available
- Stable fixture ids
- Reasonable rate limits for live polling
- Clear licensing terms for public display

## Environment Variables

Proposed variables:

```bash
SPORTS_API_BASE_URL=
SPORTS_API_KEY=
SPORTS_API_PROVIDER=
SPORTS_API_CACHE_SECONDS=
```

Notes:
- `SPORTS_API_KEY` must stay server-side only.
- Public client components should call ArcSignal API routes, not the sports provider directly.
- Provider-specific variables can be added later if the selected provider requires league ids, season ids, or host headers.

## API Route Design

Frontend-safe routes:

```text
/api/world-cup/fixtures
/api/world-cup/live
/api/world-cup/result/[fixtureId]
```

### `/api/world-cup/fixtures`

Returns scheduled World Cup fixtures and static metadata.

Useful for:
- Fixture hub
- Upcoming cards
- Match page headers
- Group/knockout navigation

### `/api/world-cup/live`

Returns active fixture score states.

Useful for:
- Live match clocks
- In-play badges
- Score ticker
- UI-only realtime display

### `/api/world-cup/result/[fixtureId]`

Returns a normalized final result for a fixture.

Useful for:
- Resolver dashboards
- Oracle proposal preparation
- Settlement rule checks

These API routes should hide provider API keys server-side and return normalized ArcSignal response shapes.

## Caching Strategy

### Fixtures

Fixtures change slowly. Cache longer.

Suggested cache:
- 15 minutes to 24 hours before tournament start
- 5 to 15 minutes during tournament days
- Revalidate manually or on short intervals if fixtures can move

### Live Matches

Live match data should be fresh but rate-limit aware.

Suggested cache:
- 5 to 30 seconds during live matches
- Use provider rate limits to tune polling
- Prefer server-side caching so many clients do not multiply provider calls

### Final Results

Final results should be cached aggressively after full time.

Suggested cache:
- Short cache immediately after full time while provider data may correct
- Long or persistent cache after result is confirmed
- Store normalized final result if the app later adds a database

### Vercel Compatibility

The API routes should work with Vercel serverless or edge-compatible route handlers.

Options:
- Use Next.js route handlers with `fetch` cache options.
- Use `revalidate` where appropriate.
- Avoid long-running processes.
- Keep polling client-driven or scheduled outside request handlers.

## Settlement Safety

The frontend live score must not directly trigger payout.

Settlement should work like this:

1. Live score provider displays match status in the UI.
2. When a fixture is final, ArcSignal normalizes the final result.
3. A resolver or proposer uses the final result and the market rule to propose an outcome.
4. UMA dispute flow or the existing sample oracle flow handles challenge/liveness.
5. The market settles onchain.
6. Users can claim payout only after onchain settlement.

Important safety rules:
- Frontend data is informational.
- Onchain settlement is authoritative for payouts.
- The resolver/oracle flow must reference a specific settlement source.
- Each market must define whether it resolves on:
  - 90 minutes plus stoppage time
  - full result including extra time
  - penalties
  - official group standings
  - official tournament winner
  - official match statistics

## World Cup Market Examples

### Match Winner

Question:
Will Brazil beat Germany?

Example rule:
90 minutes plus stoppage time only. Extra time and penalties do not count.

### Draw

Question:
Will Netherlands vs Uruguay end in a draw?

Example rule:
Resolves YES if the match is level after 90 minutes plus stoppage time.

### Over / Under 2.5

Question:
Will Spain vs Portugal have over 2.5 total goals?

Example rule:
Official full-time goals after 90 minutes plus stoppage time. Penalty shootout goals do not count.

### Team To Score 2+

Question:
Will Brazil score 2 or more goals?

Example rule:
Official match statistics from the selected sports data provider.

### Group Winner

Question:
Will England win Group B?

Example rule:
Final group standings from the official competition source.

### Tournament Winner

Question:
Will Brazil win the World Cup?

Example rule:
Official tournament winner, including any extra time and penalties required to determine the champion.

## Legal / Wording Note

Recommended wording:
- prediction markets
- signal markets
- Arc Testnet
- test collateral
- oracle settlement
- market signals

Avoid wording that presents ArcSignal as real-money sports betting.

Avoid:
- sportsbook
- betting odds
- wager
- cash-out betting language
- guaranteed payout language

Current safe framing:
ArcSignal is an Arc Testnet prediction market / signal market interface. World Cup live scores are a display preview until a sports data provider is integrated, and settlement should use oracle / resolver flow rather than frontend-only data.

## Recommended Next Implementation Step

Add static frontend-safe API route scaffolds that return the existing typed mock data:

```text
/api/world-cup/fixtures
/api/world-cup/live
/api/world-cup/result/[fixtureId]
```

These routes should initially read from `lib/worldCupMarkets.ts`, return normalized response shapes, and include comments showing where a future sports provider fetch will be added. No real API key or provider call should be added until the provider is selected.
