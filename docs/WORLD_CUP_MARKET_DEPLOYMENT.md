# World Cup Market Deployment

World Cup cards start as display-only market templates. They become tradable
ArcSignal markets only after an admin deploys them through the existing
`/api/create-market` flow.

## Infrastructure Reuse

Do not redeploy UMA or collateral infrastructure for each World Cup market.

The following infrastructure deploys once:

- ARCT test collateral
- Finder
- Timer
- UMA Optimistic Oracle V2 / sample oracle setup

Each World Cup market deployment creates only:

- one prediction market contract
- one AMM contract
- initial market setup and AMM liquidity through the existing create-market flow

## Admin Flag

Bulk deploy UI is hidden unless:

```env
NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE=true
```

Keep this disabled for public demos when `/api/create-market` uses a
server-side `PRIVATE_KEY`.

## Bulk Deploy Flow

The homepage admin panel supports:

- `Deploy selected markets`
- `Deploy all visible World Cup markets`

Bulk deploy is one admin UX action, but it sends multiple sequential onchain
deployment requests. For each selected template, the frontend calls:

```http
POST /api/create-market
```

with:

```json
{
  "title": "World Cup market question",
  "category": "World Cup",
  "worldCupMarketId": "wc-brazil-morocco",
  "settlementRule": "Official full-time result including stoppage time..."
}
```

The endpoint reuses the already configured infrastructure addresses and deploys
the market + AMM pair.

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

The homepage reads this file through `/api/world-cup/deployments`. A World Cup
card becomes `Trade on Arc` only when the mapping has both `marketAddress` and
`ammAddress`.

## Duplicate Avoidance

The UI skips a World Cup template when it already has both:

- `arcMarketAddress`
- `arcAmmAddress`

The `/api/create-market` route also checks `data/world-cup-deployments.json`
before deploying. If the template already has a saved market + AMM pair, the API
returns the existing addresses and marks the request as skipped instead of
sending another deployment transaction.

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

Resolution remains the ArcSignal onchain resolver / UMA Optimistic Oracle V2
sample flow.
