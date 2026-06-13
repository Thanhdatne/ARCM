# ArcSignal Cleanup Audit Report

Date: 2026-06-14

Scope: documentation-only audit for unused, old, duplicate, or obsolete files/code. No files were deleted. This pass avoided contracts, deployed address configuration, `scripts/deploy.ts`, wallet/trading/claim/resolve hooks, World Cup deploy logic, market routing, `.env.local`, and `C:\project\arcsignal-v2`.

## Verification Method

- Read `AGENTS.md`.
- Applied local agent-skill guidance from:
  - `docs/agent-skills/code-review-and-quality/SKILL.md`
  - `docs/agent-skills/debugging-and-error-recovery/SKILL.md`
  - `docs/agent-skills/security-and-hardening/SKILL.md`
- Checked Next.js active routes under `app/`.
- Searched imports and route/API references with `rg`.
- Checked package scripts and build-sensitive folders.
- Checked data, artifacts, images, docs, and API routes for dynamic references.

## Safe to Remove

These are low-risk cleanup candidates based on current import/reference searches. Remove in a separate pass and run the required tests after each group.

### 1. Unused default Next.js public SVG assets

Files:

- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`

Reason: No app, component, docs, or CSS references were found. These appear to be default scaffold assets.

Risk level: low

Required test after removal:

- `npm run build`
- Manually inspect `/` for missing image icons.

### 2. Unused `PREVIEW_MARKETS` export

Files:

- `lib/markets.ts`

Candidate:

- `PREVIEW_MARKETS`

Reason: `PREVIEW_MARKETS` is exported but no current route/component imports it. Public grid behavior now comes from tracked onchain markets and World Cup deployment mappings, not this old preview list.

Risk level: low

Required test after removal:

- `npm run build`
- Inspect `/` to confirm preview/deployed market rendering still works.

### 3. Unused UI primitive

Files:

- `components/ui/separator.tsx`

Reason: No imports or route usage were found for the separator primitive.

Risk level: low

Required test after removal:

- `npm run build`

### 4. Unused barrel exports for active component folders

Files:

- `components/market/index.ts`
- `components/trading/index.ts`

Reason: Current active imports use direct files, including top-level compatibility shims (`components/MarketDetail.tsx`, `components/TradingPanel.tsx`) and direct subcomponent imports. No imports from these barrel paths were found.

Risk level: low

Required test after removal:

- `npm run build`
- Open a market detail page and verify the trade panel still renders.

### 5. Unused legacy CSS utility classes

Files:

- `app/globals.css`

Candidates:

- `exchange-card`
- `exchange-card-hover`
- `exchange-label`
- `exchange-meta`
- `terminal-link`

Reason: No class usage was found for these legacy design utilities. They appear to be leftovers from earlier premium/terminal styling passes.

Risk level: low

Required test after removal:

- `npm run build`
- Inspect `/`, `/portfolio`, `/claims`, `/privacy`, and market detail for visual regressions.

## Maybe Remove Later

These are plausible cleanup opportunities, but they are medium-risk or useful as historical/reference code. Remove only after a focused follow-up audit.

### 1. Legacy official sample action components

Files:

- `components/actions/ActionTxStatus.tsx`
- `components/actions/ApproveSection.tsx`
- `components/actions/CreateSection.tsx`
- `components/actions/index.ts`
- `components/actions/MarketActions.tsx`
- `components/actions/RedeemSection.tsx`
- `components/actions/SettleSection.tsx`
- `components/MarketActions.tsx`

Reason: Current active market detail/trading UI uses the newer `components/market/*` and `components/trading/*` paths. These older action components were not found in active route imports. However, they wrap real contract hooks and preserve sample-app behavior history, so they should not be removed casually.

Risk level: medium

Required test after removal:

- `npm run build`
- Verify market detail route.
- Verify approve, buy, sell, resolve, settle, and claim reward flows on Arc Testnet.

### 2. Legacy wallet UI components

Files:

- `components/ConnectWallet.tsx`
- `components/Navbar.tsx`
- `components/wallet/ConnectDialog.tsx`
- `components/wallet/ConnectWallet.tsx`
- `components/wallet/CopyableText.tsx`
- `components/wallet/index.ts`

Reason: The active topbar uses RainbowKit `ConnectButton`, and these older custom wallet components were not found in active app route imports. Keep `components/wallet/ArctFaucetButton.tsx`; it is active in the trading panel.

Risk level: medium

Required test after removal:

- `npm run build`
- Verify RainbowKit wallet connect renders in the topbar.
- Verify ARCT faucet button still renders in the trading panel when expected.

### 3. Legacy informational sample components

Files:

- `components/MarketInfo.tsx`
- `components/TokenBalances.tsx`

Reason: No active route imports were found. These appear to be old sample-app informational panels superseded by the current market detail and portfolio/claims pages.

Risk level: medium

Required test after removal:

- `npm run build`
- Verify market detail and portfolio pages still show required real balances/status.

### 4. UI primitives only used by legacy components

Files:

- `components/ui/card.tsx`
- `components/ui/popover.tsx`
- `components/ui/tabs.tsx`

Reason: These primitives appear tied to old sample components such as legacy action tabs and custom wallet popovers. They should only be removed if the legacy components above are removed in the same cleanup pass.

Risk level: medium

Required test after removal:

- `npm run build`
- Verify create dialog, trade ticket, claims page, and wallet topbar still render.

### 5. Disabled live-score API placeholder

Files:

- `app/api/world-cup/live/route.ts`

Reason: No active UI caller was found. Current product rule is post-match final result updates only, and this route returns a disabled/no-live-polling style placeholder. It may be worth keeping as an intentional API boundary and safety reminder.

Risk level: medium

Required test after removal:

- `npm run build`
- Search docs/UI for `/api/world-cup/live`.
- Verify World Cup final result and settlement admin flows still work.

### 6. Obsolete design/planning documents

Files:

- `docs/ARCSIGNAL_DESIGN_SYSTEM.md`
- `docs/ARCSIGNAL_RETRO_UI_DIRECTION.md`
- `docs/MYRIAD_STYLE_ARCSIGNAL_UI_PLAN.md`
- `docs/WORLD_CUP_LIVE_SCORE_AND_SETTLEMENT_PLAN.md`
- `docs/WORLD_CUP_EXTERNAL_MARKETS.md`

Reason: These describe older UI directions or earlier external/live-score plans. The current design source is protected at `docs/design/binance.md`, and current product behavior uses deployed World Cup markets plus post-match final result updates. Keep these if project history is useful.

Risk level: low to medium

Required test after removal:

- Documentation-only review.
- Confirm README or onboarding docs do not link to removed files.

### 7. README-only screenshot asset

Files:

- `public/screenshot.png`

Reason: Referenced by README only, not by the app. Remove only if the README is updated or the screenshot is replaced.

Risk level: low

Required test after removal:

- `npm run build`
- Check README rendering if published.

### 8. `shadcn` package dependency

Files:

- `package.json`
- `package-lock.json`
- `app/globals.css`

Reason: `shadcn` is still referenced by `@import "shadcn/tailwind.css";` and `components.json`. It may be removable only after replacing that CSS import and checking generated UI primitives. Not safe in this pass.

Risk level: medium

Required test after removal:

- `npm run build`
- Full visual pass on dialogs, buttons, inputs, and tabs.

## Do Not Remove

These files/folders are active, protected, security-sensitive, or required by the current onchain app.

### Protected instruction and design files

Files/folders:

- `AGENTS.md`
- `docs/agent-skills/`
- `docs/design/binance.md`

Reason: Explicitly protected by the task and used for repo rules/design guidance.

Risk level: high

Required test after accidental change:

- Revert or restore before further work.

### Protected World Cup data and market templates

Files:

- `data/world-cup-deployments.json`
- `data/world-cup-results.json`
- `src/lib/worldCupMarkets.ts`
- `src/lib/worldCupResults.ts`

Reason: Active World Cup deployment/result flow depends on these. `worldCupMarkets.ts` is explicitly protected. Deployment mappings and final-result data drive tradable card status and admin settlement context.

Risk level: high

Required test after accidental change:

- `npm run build`
- Verify deployed World Cup markets still appear as tradable.
- Verify final result suggestion and settlement panels still work.

### Active onchain market data/config

Files:

- `data/markets.json`
- `lib/contracts.ts`
- `lib/contracts/*`
- `lib/chain.ts`
- `lib/markets.ts`
- `lib/utils.ts`

Reason: Active pages/API routes use these for Arc Testnet config, deployed addresses, market reads, market display, ArcScan links, and formatting.

Risk level: high

Required test after change:

- `npm run build`
- Verify `/`, market detail, create-market API, claims, and portfolio.

### Active ABI/artifact/config dependencies

Files/folders:

- `artifacts/`
- `typechain-types/`
- `contracts/`
- `hardhat.config.ts`
- `scripts/deploy.ts`

Reason: `artifacts/` is gitignored but runtime-critical: `/api/create-market` loads market and AMM artifacts, and deployment tooling depends on generated artifacts. Contracts and deployment scripts are explicitly out of scope.

Risk level: high

Required test after accidental change:

- Restore artifacts/contracts output if missing.
- `npm run build`
- Verify `/api/create-market` can still deploy a market.

### Active app routes and API routes

Files/folders:

- `app/page.tsx`
- `app/market/[address]/page.tsx`
- `app/claims/page.tsx`
- `app/portfolio/page.tsx`
- `app/privacy/page.tsx`
- `app/api/create-market/route.ts`
- `app/api/markets/route.ts`
- `app/api/world-cup/deployments/route.ts`
- `app/api/world-cup/results/route.ts`

Reason: These are current public routes and active API flows. The create-market, markets, deployments, and results APIs are part of the current onchain and World Cup lifecycle.

Risk level: high

Required test after change:

- `npm run build`
- Verify active pages and API routes manually.

### Active shell, topbar, market, trading, and wallet components

Files/folders:

- `components/layout/AppShell.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/Topbar.tsx`
- `components/CreateMarketDialog.tsx`
- `components/MarketCard.tsx`
- `components/MarketDetail.tsx`
- `components/TradingPanel.tsx`
- `components/market/`
- `components/trading/`
- `components/wallet/ArctFaucetButton.tsx`

Reason: These are imported by current app routes and preserve active wallet, market detail, trade, resolve, settle, and claim behavior.

Risk level: high

Required test after change:

- `npm run build`
- Verify connect wallet, create market, buy/sell, resolve/settle, and claim reward.

### Active providers, hooks, and contexts

Files/folders:

- `app/providers.tsx`
- `contexts/WalletContext.tsx`
- `hooks/`
- `lib/circle.ts`

Reason: Active wallet, wagmi/RainbowKit, Circle wallet support, and onchain hook behavior depend on these. Several hook files are exposed through legacy barrels used by current components.

Risk level: high

Required test after change:

- `npm run build`
- Verify wallet connection, market reads, buy/sell, and claim reward.

### Environment and secret files

Files:

- `.env.local`
- `.env.example`
- `.gitignore`

Reason: `.env.local` must not be read, printed, committed, or modified. `.env.example` documents placeholders. `.gitignore` protects local secrets and generated files.

Risk level: high

Required test after change:

- Security review.
- Confirm no secrets are exposed.

## Duplicate or Obsolete Code Summary

- Old sample components remain in `components/actions/*`, old wallet components, and old informational panels. They are likely unused by active routes but should be removed only after a separate flow verification pass.
- Old design docs remain from Myriad, retro, and earlier design-system passes. These are not build dependencies and can be archived or removed if project history is no longer needed.
- Default Next.js public SVG assets are the cleanest low-risk removal opportunity.
- `PREVIEW_MARKETS` is the cleanest low-risk code cleanup opportunity.
- The disabled live-score API route is a product decision: technically unused, but useful as a safety boundary documenting that ArcSignal does not live-poll scores.

## Candidate Counts

- Safe cleanup candidate groups: 5
- Medium/risky cleanup candidate groups: 8
- High-risk/protected groups: 8

## Recommended Cleanup Order

1. Remove unused default public SVG assets.
2. Remove unused legacy CSS utility classes.
3. Remove `components/ui/separator.tsx` and unused barrel exports.
4. Remove `PREVIEW_MARKETS` from `lib/markets.ts` if no preview section will return.
5. In a separate PR, remove legacy sample components only after manually verifying create, buy/sell, resolve/settle, and claim reward on Arc Testnet.
6. Archive obsolete docs only after README links and team expectations are checked.
