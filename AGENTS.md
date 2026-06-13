# ArcSignal Codex Rules

Project:
C:\project\arcsignal-onchain

## Never modify

- C:\project\arcsignal-v2
- deployed contracts unless explicitly requested
- scripts/deploy.ts unless explicitly requested
- .env.local
- PRIVATE_KEY

## Do not

- redeploy UMA/ARCT/Finder/Timer/OO
- change Buy/Sell logic without explicit approval
- change Claim Reward logic without explicit approval
- fake tradable markets
- expose PRIVATE_KEY
- commit .env.local
- copy Kalshi/BRKT branding or assets

## Always preserve

- Arc Testnet chainId 5042002
- RPC: https://rpc.testnet.arc.network
- existing /api/create-market flow
- real marketAddress + ammAddress mapping
- real Market detail routing
- real Buy/Sell/Approve/Resolve/Settle/Claim flow

## World Cup rules

ArcSignal markets are binary YES/NO.

Every football fixture must be split into 3 binary markets:

1. home_win
2. draw
3. away_win

Example:
Brazil vs Morocco:

- Will Brazil beat Morocco?
- Will Brazil vs Morocco end in a draw?
- Will Morocco beat Brazil?

Main public grid only shows deployed/tradable markets:

- marketAddress exists
- ammAddress exists

Non-deployed templates stay admin-only.

## Admin deploy rules

Use only:

- existing /api/create-market
- data/world-cup-deployments.json
- NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE=true

Do not run scripts/deploy.ts for new World Cup markets.

## Required checks before finishing

Always run:

npm run build

When relevant, also verify:

- homepage opens
- market detail opens
- Buy/Sell unchanged
- Claim Reward unchanged
- mapping file not corrupted

## Agent skills available

Use these local skill instructions when relevant:

- docs/agent-skills/frontend-ui-engineering/SKILL.md
- docs/agent-skills/debugging-and-error-recovery/SKILL.md
- docs/agent-skills/test-driven-development/SKILL.md
- docs/agent-skills/code-review-and-quality/SKILL.md
- docs/agent-skills/security-and-hardening/SKILL.md
- docs/agent-skills/api-and-interface-design/SKILL.md

Before coding, pick only the relevant skills for the task.
Do not load every skill for every task.