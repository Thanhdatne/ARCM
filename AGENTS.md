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
* Circle BridgeKit / CCTP deposit flow

## Current confirmed app state

* App builds successfully with `npm run build`.
* Main branch is the active deployment branch.
* Latest stable checkpoint:

  * `0856ce9 Improve deposit forwarding and transaction links`
* Deposit page supports Circle BridgeKit / Forwarding Service.
* Deposit success can show:

  * source chain TX
  * Arc TX
* Market V2 USDC creation API works locally through:

  * `POST /api/create-market-v2`
* A local V2 market creation test succeeded with:

  * `contractVersion: 2`
  * `collateralSymbol: USDC`
  * `collateralDecimals: 6`
* `/api/markets` can read V2 USDC metadata.
* Market detail metadata fallback has been patched so V2 markets can show title + USDC metadata instead of ARCT fallback.
* Admin template deploy is the current active task.

## Never modify unless explicitly requested

* `C:\project\arcsignal-v2`
* deployed smart contracts
* `scripts/deploy.ts`
* `.env.local`
* private keys
* production env secrets
* existing working buy/sell/claim contract calls
* DepositBridge unless the task explicitly asks for deposit changes
* market detail unless the task explicitly asks for detail changes

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
* RPC fallback: `https://rpc.testnet.arc.network`
* real `marketAddress` + `ammAddress` mapping
* real market detail routing
* real Buy / Sell / Approve / Resolve / Settle / Claim flow
* Supabase server-only access pattern
* existing legacy `/api/create-market` flow unless the task explicitly changes legacy behavior

## V2 USDC market rules

New generic/admin template deployments should use Market V2 with Arc native USDC.

Arc native USDC collateral:

```txt
0x3600000000000000000000000000000000000000
```

Market V2 server route:

```txt
POST /api/create-market-v2
```

Expected V2 result:

* `contractVersion: 2`
* `collateralSymbol: USDC`
* `collateralDecimals: 6`
* valid `marketAddress`
* valid `ammAddress`

## Admin deploy rules

For generic Admin Markets templates:

* Use `/api/create-market-v2`.
* Use Arc native USDC collateral.
* Do not open MetaMask.
* Do not use RainbowKit for deployment.
* Do not use `CreateMarketDialog` for V2 template deployment.
* Do not deploy with ARCT.
* Server route should deploy using `PRIVATE_KEY`.
* Client must not expose `PRIVATE_KEY`, `ADMIN_API_KEY`, or Supabase service keys.
* Use the existing admin auth/header pattern expected by `lib/adminGuard.ts`.

Legacy `/api/create-market` is kept only for old ARCT flows and should not be used for new generic Admin template deployment unless explicitly requested.

## World Cup rules

ARCM football markets are binary YES/NO.

Every football fixture must be split into 3 binary markets:

1. `home_win`
2. `draw`
3. `away_win`

Example: Brazil vs Morocco:

* `Will Brazil beat Morocco?`
* `Will Brazil vs Morocco end in a draw?`
* `Will Morocco beat Brazil?`

Main public grid only shows deployed/tradable markets:

* `marketAddress` exists
* `ammAddress` exists

Non-deployed templates stay admin-only.

## Circle / Arc requirements

The final product must align with Circle/Arc prediction market positioning:

* Arc Testnet prediction markets
* UMA Optimistic Oracle V2 resolution
* Arc fast deterministic transaction finality UX
* native USDC collateral where actually configured
* CCTP / BridgeKit USDC deposit where actually configured
* USDC-denominated gas onboarding
* truthful public copy

Important truth:

* Arc supports fast deterministic transaction finality and stablecoin-denominated gas.
* UMA market outcome resolution still has liveness/dispute period.
* Do not claim instant market outcome resolution.
* Do not claim USDC/EURC/CCTP/Gateway is live unless real env/config/addresses and working implementation exist.

Known Arc/Circle testnet references:

* Arc Testnet USDC token address:

  * `0x3600000000000000000000000000000000000000`
* Arc Testnet CCTP domain:

  * `26`
* Arc Testnet Gateway Wallet:

  * `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`

Do not hardcode production behavior without env/config support and verification.

## CCTP / Gateway rules

CCTP / BridgeKit deposit must be real or disabled.

Do not create fake deposit success states.

Current preferred implementation direction:

* browser-wallet signed Circle BridgeKit flow
* real USDC bridge to Arc Testnet
* Circle Forwarding Service may complete the Arc-side mint
* clear status steps:

  * approve
  * burn
  * forwarding
  * completed
* success can show source TX and Arc TX when available

Gateway unified balance is future advanced routing and should not be presented as required for current ARCM trading unless actually implemented and tested.

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
