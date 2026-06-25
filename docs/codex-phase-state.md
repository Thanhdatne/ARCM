# ARCM Phase State

## Project

Project: ARCM
Path: `C:\project\arcsignal-onchain`
Active branch: `main`
Production domain: `https://arcm-market.vercel.app`

## Latest stable checkpoint

Latest confirmed stable commit:

```txt
0856ce9 Improve deposit forwarding and transaction links
```

Current stable baseline:

* `npm run build` passes.
* Deposit flow was improved and pushed.
* Repo should stay clean before each new phase.
* Do not commit `.env.local`.

## Completed phases

* Phase 1: collateral capability foundation.
* Phase 2: dynamic per-market collateral metadata.
* Phase 3: collateral-aware Market Detail and Trading UI.
* Phase 4A: USDC/EURC V2 architecture decision.
* Phase 4B: Market V2 and AMM V2 implementation specification and test plan.
* Phase 5A-1: EventBasedPredictionMarketV2 core contract and direct tests.
* Phase 5A-2: PredictionMarketAMMV2 core contract and direct tests.
* Phase 5A-3: atomic MarketV2Factory deployment path and direct tests.
* Phase B1: V2 integration audit completed.
* Phase B2: V2 trading hooks/components patched for collateral-address-aware and decimal-aware buy/sell behavior.
* Phase B3: smoke verification completed.
* Phase B4: V2 deploy/readiness path completed enough for local V2 market creation.
* Deposit BridgeKit / Forwarding Service UI phase completed.
* Deposit success can show source chain TX and Arc TX when available.
* Market detail metadata fallback was patched so V2 markets can show title + USDC metadata instead of ARCT fallback.

## Current confirmed technical state

V2 USDC market creation API works locally:

```txt
POST /api/create-market-v2
```

A local test returned:

```txt
success: true
contractVersion: 2
collateralSymbol: USDC
collateralDecimals: 6
```

Recent local test market:

```txt
marketAddress: 0xbe3b2baCa67aC0Ee2f5BAF7e1724Fc76508fBE52
ammAddress:    0x33B55820781F66ec47126d52aeBa563bc1DC1cC2
collateral:    USDC / 6 decimals
```

`/api/markets` can read this V2 metadata.

## Important addresses

Arc Testnet:

```txt
chainId: 5042002
rpc fallback: https://rpc.testnet.arc.network
```

Arc native USDC:

```txt
0x3600000000000000000000000000000000000000
```

V2 contracts/config:

```txt
MarketV2Factory:
0xDd184B30EDd59004A8Dbd1b584bD5F12191C491E

CollateralAllowlist:
0xA51b6278cD6ce23FE0ec8a23B0d5697B280C696e

UMA Optimistic Oracle V2:
0xE384b500Da57da2C1b1172a18fA616bC321aE58B

UMA Finder:
0xF98bf22A41540ceB573b231C27c766b5631C50
```

## Current active task

Fix Admin Markets template deployment.

Current bug:

* On Admin Markets, clicking `Deploy on Arc` still opens MetaMask.
* MetaMask may show Ethereum Sepolia.
* This means the UI is still using a client wallet / legacy flow.
* It may still be connected to `CreateMarketDialog` or old ARCT deployment behavior.

Desired behavior:

* Clicking `Deploy on Arc` calls server route:

  * `POST /api/create-market-v2`
* No MetaMask popup.
* No RainbowKit deploy transaction.
* No ARCT.
* Server deploys using `PRIVATE_KEY`.
* Collateral is Arc native USDC:

  * `0x3600000000000000000000000000000000000000`
* The returned market should be V2:

  * `contractVersion: 2`
  * `collateralSymbol: USDC`
  * `collateralDecimals: 6`

## Files expected for current phase

Read first:

* `AGENTS.md`
* `docs/codex-phase-state.md`

Then read only these files unless absolutely necessary:

* `app/admin/markets/page.tsx`
* `app/api/create-market-v2/route.ts`
* `lib/adminGuard.ts`
* `lib/contracts/addresses.ts`

Expected modification:

* `app/admin/markets/page.tsx`

Do not modify unless absolutely necessary:

* contracts
* deploy scripts
* trading hooks
* AMM math
* `components/deposit/DepositBridge.tsx`
* market detail files
* wallet connect logic
* claim logic
* `.env.local`

## Admin deploy implementation target

For template card deployment, request body should include:

```txt
title: template title/question
category: template category
pairName: stable template id or slug
collateralAddress: 0x3600000000000000000000000000000000000000
proposerReward: "1"
proposerBond: "1"
initialLiquidity: "1"
liveness: 7200
feeBps: 200
```

Include `worldCupMarketId` only if the template already has one.

UI states:

* idle:

  * `Deploy on Arc`
* loading:

  * `Deploying…`
* success:

  * `Deployed`
  * show short market address
  * show tx link if returned
* error:

  * concise error message

## Validation for current phase

Run:

```bash
npm run build
```

Local test:

```txt
http://localhost:3000/admin/markets
```

Expected:

* click `Deploy on Arc`
* no MetaMask popup
* browser calls `/api/create-market-v2`
* result is V2 USDC
* market appears in `/api/markets`
* existing filters/search/layout remain unchanged
