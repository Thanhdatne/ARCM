# ARCM Codex Instructions

Project: ARCM
Path: `C:\project\arcsignal-onchain`

ARCM is an Arc Testnet prediction market MVP based on Circle's open-source `arc-prediction-markets` sample architecture.

Core stack:

* Next.js App Router
* TypeScript
* Tailwind
* wagmi / viem / RainbowKit
* UMA Optimistic Oracle V2
* Arc Testnet
* Supabase cache
* YES/NO market tokens
* AMM trading

Current working features:

* Wallet connect
* ARCT faucet
* YES/NO buy/sell
* Approve / trade / settle / claim flow
* UMA propose / liveness / settle flow
* World Cup market deployments/results
* Supabase seeded for World Cup deployments/results
* Claims page uses API/cache pattern
* Portfolio page uses API pattern

## Never modify unless explicitly requested

* `C:\project\arcsignal-v2`
* deployed smart contracts
* `scripts/deploy.ts`
* `.env.local`
* private keys
* production env secrets
* existing working buy/sell/claim contract calls

## Hard rules

* Do not rewrite the app from scratch.
* Do not fake onchain behavior.
* Do not fake CCTP/Gateway deposits.
* Do not fake tradable markets.
* Do not add Polymarket integration.
* Do not expose secrets in client code.
* Never use `NEXT_PUBLIC_` for private keys, service role keys, admin keys, faucet keys, Circle API keys, or entity secrets.
* Do not commit `.env.local`.
* Do not redeploy UMA/ARCT/Finder/Timer/OO unless explicitly requested.
* Do not change Buy/Sell logic without explicit approval.
* Do not change Claim Reward logic without explicit approval.
* Keep admin tools hidden from public users.
* Keep `npm run build` passing after each phase.

## Always preserve

* Arc Testnet chain ID: `5042002`
* RPC: `https://rpc.testnet.arc.network`
* existing `/api/create-market` flow unless the task explicitly changes it
* real `marketAddress` + `ammAddress` mapping
* real market detail routing
* real Buy / Sell / Approve / Resolve / Settle / Claim flow
* Supabase server-only access pattern

## World Cup rules

ARCM markets are binary YES/NO.

Every football fixture must be split into 3 binary markets:

1. `home_win`
2. `draw`
3. `away_win`

Example: Brazil vs Morocco

* `Will Brazil beat Morocco?`
* `Will Brazil vs Morocco end in a draw?`
* `Will Morocco beat Brazil?`

Main public grid only shows deployed/tradable markets:

* `marketAddress` exists
* `ammAddress` exists

Non-deployed templates stay admin-only.

## Admin deploy rules

Use only:

* existing `/api/create-market`
* `data/world-cup-deployments.json`
* Supabase deployment/result tables
* `NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE=true`

Do not run `scripts/deploy.ts` for new World Cup markets unless explicitly requested.

## Circle / Arc final requirements

The final product must align with Circle/Arc prediction market positioning:

* Arc Testnet prediction markets
* UMA Optimistic Oracle V2 resolution
* Arc fast deterministic transaction finality UX
* native USDC/EURC collateral support where actually configured
* CCTP/Gateway USDC deposit where actually configured
* USDC-denominated gas onboarding
* truthful public copy

Important truth:

* Arc supports fast deterministic transaction finality and stablecoin-denominated gas.
* UMA market outcome resolution still has liveness/dispute period.
* Do not claim instant market outcome resolution.
* Do not claim USDC/EURC/CCTP/Gateway is live unless real env/config/addresses and working implementation exist.

Known Arc/Circle testnet references to verify before implementation:

* Arc Testnet CCTP domain: `26`
* Arc Testnet USDC token address: `0x3600000000000000000000000000000000000000`
* Arc Testnet Gateway Wallet: `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`

Do not hardcode these into production behavior without env/config support and verification.

## Design rules

* Keep dark Binance-like ARCM style.
* Yellow accent: `#FCD535`.
* YES = green.
* NO = red.
* Clean, minimal, professional.
* Do not make the UI look AI-generated.
* Do not copy Kalshi/BRKT branding or assets.
* Use them only as layout/UX inspiration.

## Public UX rules

Public users should only see:

* Markets
* Deposit
* Portfolio
* Claims
* How it works

Admin-only items must not appear in public navigation:

* Admin Markets
* Create Market
* Resolver tools
* Deploy buttons
* Debug panels

Admin pages/routes may remain, but must be protected.

## Supabase rules

Supabase is used for cache/index-like data, not as a replacement for contract truth.

Allowed Supabase data:

* World Cup deployments
* World Cup results
* claimable cache
* portfolio/cache snapshots
* resolver run logs
* deposit/bridge history if implemented

Contract truth remains onchain.

Never expose:

* `SUPABASE_SERVICE_ROLE_KEY`
* database service keys
* admin secrets

Client code must never import server-only Supabase admin helpers.

## CCTP/Gateway rules

CCTP/Gateway must be real or disabled.

Do not create fake deposit success states.

Preferred implementation direction:

* browser-wallet signed CCTP/App Kit or Bridge Kit flow
* real USDC bridge to Arc Testnet
* real Gateway Wallet `deposit(token, amount)` call
* no direct ERC20 transfer to Gateway Wallet
* clear status steps: source approval, bridge/burn, attestation, mint, gateway deposit, complete

If dependencies/env/config are missing, return an audit and ask before coding.

## Credit optimization rules

* Do not scan the whole repo unless explicitly asked.
* Do not read `node_modules`, `.next`, build output, or large JSON files unless necessary.
* Before editing, list exact files needed.
* Before editing, list exact files planned for modification.
* Modify only files required for the current phase.
* Prefer small focused patches.
* Do not do broad refactors without approval.
* One phase = one focused task.
* Summarize changed files after each phase.

## Agent skills available

Use local skill instructions only when relevant:

* `docs/agent-skills/frontend-ui-engineering/SKILL.md`
* `docs/agent-skills/debugging-and-error-recovery/SKILL.md`
* `docs/agent-skills/test-driven-development/SKILL.md`
* `docs/agent-skills/code-review-and-quality/SKILL.md`
* `docs/agent-skills/security-and-hardening/SKILL.md`
* `docs/agent-skills/api-and-interface-design/SKILL.md`

Before coding, pick only the relevant skills for the task.
Do not load every skill for every task.

## Required checks before finishing

Always run:

```bash
npm run build
```

When relevant, also verify:

* homepage opens
* market detail opens
* Buy/Sell unchanged
* Claim Reward unchanged
* Portfolio shows only real wallet positions
* Claims shows only real claimable rewards
* mapping files are not corrupted
* admin tools remain protected
* no secrets are exposed in client code
