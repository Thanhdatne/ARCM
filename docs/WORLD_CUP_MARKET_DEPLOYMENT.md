# World Cup Market Deployment

World Cup cards start as display-only market templates. They become tradable
ARCM markets only after an admin deploys them through the V2 USDC
`/api/create-market-v2` flow.

## Infrastructure Reuse

Do not redeploy UMA or collateral infrastructure for each World Cup market.

The following infrastructure deploys once:

- Arc USDC collateral and the V2 collateral allowlist
- Finder
- Timer
- UMA Optimistic Oracle V2 / sample oracle setup

Each World Cup market deployment creates only:

- one prediction market contract
- one AMM contract
- initial market setup and AMM liquidity through the V2 create-market flow

## Admin Flag

Bulk deploy UI is hidden unless:

```env
NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE=true
```

Keep this disabled for public demos when `/api/create-market-v2` uses a
server-side `PRIVATE_KEY`.

## Bulk Deploy Flow

The homepage admin panel supports:

- `Deploy selected markets`
- `Deploy all visible World Cup markets`

Bulk deploy is one admin UX action, but it sends multiple sequential onchain
deployment requests. For each selected template, the frontend calls:

```http
POST /api/create-market-v2
```

with:

```json
{
  "title": "World Cup market question",
  "category": "World Cup",
  "worldCupMarketId": "wc-brazil-morocco",
  "fixtureId": "wc-brazil-morocco-fixture",
  "group": "Group C",
  "outcomeType": "home_win",
  "proposerReward": "1",
  "proposerBond": "1",
  "initialLiquidity": "1"
}
```

The endpoint defaults collateral to the configured Arc USDC address, reuses the
already configured V2 infrastructure addresses, and deploys the market + AMM
pair. The legacy `/api/create-market` V1 ARCT endpoint remains available for
non-World-Cup fallback flows.

## Deployment Mapping

Successful World Cup deployments are persisted in:

```text
data/world-cup-deployments.json
```

Each record stores:

- `worldCupMarketId`
- `question`
- `marketAddress`
- `ammAddress`
- `createdAt`
- `txHash` when available
- `contractVersion: 2`
- `collateralAddress`
- `collateralSymbol: USDC`
- `collateralDecimals: 6`
- `outcomeDecimals: 6`

The homepage reads this file through `/api/world-cup/deployments`. A World Cup
card becomes `Trade on Arc` only when the mapping has both `marketAddress` and
`ammAddress`.

## Duplicate Avoidance

The UI skips a World Cup template when it already has both:

- `arcMarketAddress`
- `arcAmmAddress`

The admin UI checks the existing deployment mapping before calling the V2 route,
so already deployed templates remain skipped and are not sent for deployment.

To avoid duplicate deploys:

1. Wait for each market to show `Deployed` or `Trade on Arc`.
2. Refresh the market list after bulk deploy completes.
3. Do not re-run bulk deploy for templates already marked deployed.
4. If a deployment failed halfway, retry only failed or still undeployed cards.

## Progress States

Each card can show:

- `Pending`
- `Success`
- `Failed`
- `Skipped`

Failed cards do not become tradable. A card routes to the real market detail
only when both market and AMM addresses are present.

## Settlement Safety

World Cup live scores and final results are display data only. They must not
trigger payout automatically.

Resolution remains the ARCM onchain resolver / UMA Optimistic Oracle V2
sample flow.
