# Myriad-Style ARCM UI Migration Plan

## Scope

This document plans the UI migration from the official `circlefin/arc-prediction-markets` sample app into ARCM: a Myriad-inspired, multi-category prediction market interface on Arc Testnet.

This planning step is documentation-only.

Do not modify in this step:

- `contracts/`
- `scripts/deploy.ts`
- `hardhat.config.ts`
- deployed-address or ABI wiring
- server deployment API behavior
- `C:\project\ARCM-v2`

The official onchain flow must remain intact while the UI is gradually redesigned.

## Current Official Sample Structure

The current app is a working onchain prediction market sample with:

- Next.js App Router
- wagmi + viem
- injected wallet support
- Circle modular passkey wallet support
- Hardhat deployment to Arc Testnet
- UMA Optimistic Oracle V2 integration
- a binary YES/NO prediction market contract
- a constant-product YES/NO AMM
- server-side custom market creation

Important routes:

- `/` - market grid
- `/market/[address]` - onchain market detail page
- `/api/create-market` - server route that deploys new market + AMM contracts
- `/api/markets` - serves user-created market metadata from `data/markets.json`

Important frontend files:

- `app/layout.tsx` - wraps the app in providers and renders `Navbar`
- `app/page.tsx` - current market grid, category filters, and `CreateMarketDialog`
- `app/market/[address]/page.tsx` - detail route provider for selected market
- `components/Navbar.tsx` - current top navigation and wallet connect
- `components/MarketCard.tsx` - current grid card; reads onchain data for real markets
- `components/CreateMarketDialog.tsx` - current create-market UI; calls `/api/create-market`
- `components/market/*` - market detail display components
- `components/trading/*` - buy/sell/resolve trading panel
- `components/actions/*` - approve/create/redeem/settle action UI
- `contexts/WalletContext.tsx` - MetaMask/Circle wallet abstraction
- `contexts/MarketAddressContext.tsx` - per-market address context
- `hooks/market/*` - market state/actions/oracle/portfolio hooks
- `hooks/amm/*` - AMM state, pricing, approvals, buy/sell hooks
- `hooks/useContractWrite.ts` - unified contract write path for MetaMask and Circle wallets
- `lib/chain.ts` and `lib/wagmi.ts` - Arc Testnet chain and wagmi config
- `lib/contracts/*` - addresses, ABIs, types
- `lib/markets.ts` - current static/demo market grid data and real market mapping

## ARCM UI Prototype Reference

The separate `C:\project\ARCM-v2` prototype contains useful UI patterns that can be referenced, but not modified from this project.

Relevant prototype concepts:

- sidebar shell
- topbar with search and wallet status
- category tabs
- filter row
- promo banners
- spotlight market
- dense prediction market cards
- portfolio / claims / privacy pages
- 5-minute signals, ecosystem, leaderboard, news pages
- privacy badges and Privacy Preview narrative

The onchain migration should borrow the interaction shape and visual hierarchy, not copy the prototype blindly. The onchain sample has real market actions and must keep those flows wired.

## Target Product Direction

ARCM = real-time multi-category prediction markets on Arc Testnet.

Core verticals:

- World Cup
- Crypto
- Arc Ecosystem
- Stablecoins
- AI
- Macro
- RWA
- Privacy Preview

World Cup should be the first real-time vertical, while the app remains multi-category.

## Target Information Architecture

### Sidebar Navigation

Add an app shell sidebar with:

- Markets
- World Cup
- 5-Minute Signals
- Arc Ecosystem
- Leaderboard
- News
- Portfolio
- Claims
- Privacy Preview
- Create

Implementation direction:

- Replace the current simple `Navbar` shell with a two-column app layout.
- Keep the existing wallet connection components available inside the new topbar.
- Preserve the current `/` route initially, or alias it to the redesigned Markets experience.
- Add new routes gradually with mock/read-only UI first, except where onchain flows already exist.

Likely new components:

- `components/layout/AppShell.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/Topbar.tsx`
- `components/layout/NetworkStatus.tsx`

### Topbar

Target topbar:

- Search ARCM
- Arc Testnet status
- Wallet connect

Implementation direction:

- Reuse `components/wallet/ConnectWallet.tsx` or existing `components/ConnectWallet.tsx`.
- Preserve `WalletContext`.
- Add network status from `lib/chain.ts` / wallet state without changing transaction code.
- Search can initially filter local market data and dynamic markets client-side.

### Category Tabs

Tabs:

- Trending
- World Cup
- Crypto
- Arc
- Stablecoins
- AI
- Macro
- RWA
- Privacy

Implementation direction:

- Extend `lib/markets.ts` data types to support new categories for display.
- Do not change contract assumptions yet; onchain deployed markets remain binary.
- Map dynamic onchain markets to categories using stored metadata when available.

### Promo Banners

Banners:

- World Cup realtime markets
- 5-Minute Signals
- Arc Privacy Preview

Implementation direction:

- UI-only component on Markets page.
- Each banner can route to the relevant vertical.
- Privacy banner must clearly say Privacy Preview is mock UX only.

### Filter Row

Filters:

- Featured
- Newest
- Volume
- Trending
- Ending Soon
- Open
- In-Play
- Filters

Implementation direction:

- Start as client-side UI filters over static/dynamic market metadata.
- Do not alter contract state or deployment.
- Onchain status should derive from existing hooks for real markets where available.

## Markets Page Target

### Spotlight Market

Target content:

- large featured market
- YES/NO odds
- volume
- participants
- status
- onchain collateral label

Implementation direction:

- Create a `SpotlightMarket` component that accepts a normalized market view model.
- For real onchain markets, source prices/status from existing hooks or from `MarketCard`-equivalent data.
- Collateral label should be explicit:
  - current sample collateral: ARCT
  - Arc Testnet gas: USDC

### Market Cards

Target card behavior:

- dense Myriad-like prediction market cards
- binary and multi-outcome support
- YES/NO buttons
- volume
- end date
- in-play / new / settled labels
- onchain status
- oracle status

Implementation direction:

- Refactor `components/MarketCard.tsx` carefully rather than replacing all behavior at once.
- Keep its existing real-market behavior:
  - `useMarketCardData`
  - real market route `/market/[address]`
  - disabled/non-clickable demo markets
- Add normalized display metadata:
  - `marketType`
  - `outcomes`
  - `endDate`
  - `statusLabel`
  - `oracleStatus`
  - `participants`
  - `collateralLabel`
- Binary cards can show YES/NO buttons.
- Multi-outcome cards can be display-only at first unless contracts are expanded later.

Important:

- The current contracts are binary YES/NO only.
- Multi-outcome support should begin as UI/category scaffolding only.
- Do not imply multi-outcome markets are currently deployed onchain unless a future contract supports them.

## World Cup Module

Preferred route:

- `/world-cup`

Optional future route:

- `/sports/world-cup`

Target content:

- fixture cards
- live score status
- match markets
- settlement rules
- oracle status
- clear distinction between live score display and onchain settlement

Implementation direction:

- Add `app/world-cup/page.tsx`.
- Start with mock fixtures and existing onchain-compatible binary markets:
  - "Will Team A beat Team B?"
  - "Will the match have over 2.5 goals?"
  - "Will Team A score first?"
- Use fixture cards for realtime visual context.
- Market settlement remains through the oracle/resolver flow.

### World Cup Settlement Design

The UI may use a live score API for real-time display, but payout must not be based directly on the UI feed.

Onchain settlement must go through:

- UMA Optimistic Oracle V2 proposal
- liveness period
- dispute path if needed
- settlement callback
- user redemption/claim flow

Each sports market must include:

- settlement source
- settlement rule
- oracle status
- final outcome source
- dispute window/liveness language

Example settlement rules:

1. `90 minutes plus stoppage time only`
   - Extra time and penalties excluded.
   - Settlement source should be a named official match report or data provider.

2. `Full official result including extra time and penalties`
   - Includes extra time and penalty shootout if applicable.
   - Settlement source should define how draw/no-draw markets resolve.

Live score display:

- can update in real time
- is informational only
- must not say a market is settled until the oracle/resolver flow completes

## Privacy Preview

Privacy Preview must remain clearly mock UX only.

Required positioning:

- Privacy is preview/mock UX only.
- Do not claim ArcaneVM privacy is live.
- Trades and positions are public on Arc Testnet today.
- Future ArcaneVM support can be described as roadmap-compatible.

Safe copy:

- "Privacy Preview"
- "mock privacy UX"
- "future shielded-position interface"
- "roadmap-compatible with future privacy infrastructure"
- "on Arc Testnet today, trades and positions are public"

Unsafe copy:

- "private trades are live"
- "shielded positions are cryptographically private"
- "ArcaneVM privacy is active"
- "production privacy"

Implementation direction:

- Add `app/privacy/page.tsx` or retain a route named `/privacy-preview`.
- Sidebar label should be `Privacy Preview`.
- Add badges to market cards only as preview labels.
- Do not alter contract flow to suggest hidden positions.

## Onchain Preservation

### Components/Hooks That Must Stay

These must remain wired and should only be wrapped or restyled carefully:

Create market:

- `components/CreateMarketDialog.tsx`
- `app/api/create-market/route.ts`
- `app/api/markets/route.ts`
- `data/markets.json`

Trading:

- `components/trading/TradingPanel.tsx`
- `components/trading/BuyTab.tsx`
- `components/trading/SellTab.tsx`
- `components/trading/ResolveTab.tsx`
- `components/trading/OutcomeSelector.tsx`
- `components/trading/TxStatus.tsx`
- `hooks/amm/useAMMTrade.ts`
- `hooks/amm/useAMMApprovals.ts`
- `hooks/amm/useAMMCalc.ts`
- `hooks/amm/useAMMState.ts`

Market lifecycle and claim/redeem:

- `components/actions/MarketActions.tsx`
- `components/actions/ApproveSection.tsx`
- `components/actions/CreateSection.tsx`
- `components/actions/RedeemSection.tsx`
- `components/actions/SettleSection.tsx`
- `hooks/market/useMarketActions.ts`
- `hooks/market/useOracleActions.ts`
- `hooks/market/useOracleState.ts`
- `hooks/market/useMarketState.ts`
- `hooks/market/useTokenBalances.ts`

Wallet/onchain infrastructure:

- `contexts/WalletContext.tsx`
- `contexts/MarketAddressContext.tsx`
- `hooks/useContractWrite.ts`
- `app/providers.tsx`
- `lib/wagmi.ts`
- `lib/chain.ts`
- `lib/circle.ts`
- `lib/contracts/*`

### Safe UI-Only Components to Replace or Wrap

These are safer targets for Myriad-style redesign:

- `components/Navbar.tsx`
- `app/layout.tsx` shell markup, as long as providers remain intact
- `app/page.tsx` layout and market-grid composition
- `components/MarketCard.tsx` presentation layer, while preserving `useMarketCardData`
- `components/MarketInfo.tsx`
- `components/TokenBalances.tsx` presentation
- `components/market/MarketHeader.tsx`
- `components/market/ProbabilityBar.tsx`
- `components/market/MarketStatusSection.tsx` presentation only
- `components/market/PortfolioSection.tsx` presentation only
- `components/ui/*` styling primitives
- `app/globals.css`
- `lib/markets.ts` display metadata

### Risky Files That Should Not Be Touched Initially

Avoid changing these during the first UI migration phases:

- `contracts/EventBasedPredictionMarket.sol`
- `contracts/PredictionMarketAMM.sol`
- `scripts/deploy.ts`
- `hardhat.config.ts`
- `app/api/create-market/route.ts`
- `lib/contracts/abis/*`
- `lib/contracts/addresses.ts`
- `lib/contracts/types.ts`
- `hooks/useContractWrite.ts`
- `contexts/WalletContext.tsx`
- `lib/circle.ts`

Reason:

- These files control deployment, transaction execution, wallet abstraction, oracle lifecycle, and contract ABI assumptions.
- Breaking them would risk the official sample's working onchain flow.

## Route Plan

Initial target routes:

- `/` - Myriad-style Markets home
- `/market/[address]` - onchain market detail, polished
- `/world-cup` - realtime World Cup vertical
- `/5-minute-signals` - short-duration markets
- `/ecosystem` - Arc ecosystem markets
- `/leaderboard` - trader/creator rankings
- `/news` - market intelligence
- `/portfolio` - positions and balances
- `/claims` - settlements/redeems/receipts
- `/privacy` or `/privacy-preview` - Privacy Preview explainer
- `/create` - market creation surface or route wrapping `CreateMarketDialog`

The current app has `/market/[address]`, not `/markets/[slug]`. Preserve that route until a slug/address resolver is introduced.

## Data Model Plan

Add a normalized view-model layer for UI while preserving raw contract hooks.

Possible type:

```ts
type ARCMMarketView = {
  id: string;
  address?: Address;
  ammAddress?: Address;
  title: string;
  category: "World Cup" | "Crypto" | "Arc" | "Stablecoins" | "AI" | "Macro" | "RWA" | "Privacy";
  marketType: "binary" | "multi";
  outcomes: Array<{ label: string; price?: number }>;
  isOnchain: boolean;
  collateralLabel: "ARCT" | "USDC";
  status: "open" | "in-play" | "new" | "settled" | "pending-oracle";
  oracleStatus?: string;
  volume?: string;
  participants?: number;
  endDate?: string;
  settlementRule?: string;
};
```

For existing real markets:

- `address` maps to `EventBasedPredictionMarket`
- `ammAddress` maps to `PredictionMarketAMM`
- prices can come from `useMarketCardData` / AMM hooks
- status can come from market and oracle hooks

For display-only or roadmap verticals:

- `isOnchain: false`
- clear "preview" or "coming soon" labels
- no trade/settle buttons that imply onchain execution

## Migration Phases

### Phase 1: App Shell, Sidebar, Topbar, Dark ARCM Branding

Goal:

- Introduce the Myriad-style app shell without changing contracts or trading logic.

Tasks:

- Add `AppShell`, `Sidebar`, and `Topbar`.
- Move wallet connect into topbar.
- Add Arc Testnet status display.
- Keep `Providers` and `WalletProvider` unchanged.
- Keep `/market/[address]` route working.
- Update metadata and visual language only.

Safest implementation:

- Add new shell components.
- Update `app/layout.tsx` to render the shell around children.
- Preserve provider order.
- Keep `ConnectWallet` implementation unchanged.

### Phase 2: Myriad-Style Markets Page and Market Cards

Goal:

- Transform `/` into the ARCM Markets page.

Tasks:

- Add category tabs.
- Add promo banners.
- Add filter row.
- Add spotlight market.
- Redesign market cards.
- Preserve onchain card data from `useMarketCardData`.
- Make demo/offchain cards visibly non-tradeable.

Safety rules:

- Do not remove `CreateMarketDialog`.
- Do not break dynamic markets from `/api/markets`.
- Do not change `/market/[address]` linking for real markets.

### Phase 3: Market Detail Page Polish While Preserving Trading Flow

Goal:

- Make market detail feel like ARCM while preserving all buy/sell/resolve behavior.

Tasks:

- Restyle `MarketHeader`, `MarketStatusSection`, `ProbabilityBar`, and `PortfolioSection`.
- Wrap or reposition `TradingPanel`.
- Preserve all hooks inside `TradingPanel`.
- Keep resolve tab visible and clear.
- Add collateral labels and oracle status language.

Safety rules:

- Do not change `useAMMTrade`, `useMarketActions`, or oracle hooks.
- Do not change parse/format decimals until collateral migration is explicitly planned.

### Phase 4: World Cup Realtime Module

Goal:

- Add the first real-time vertical.

Tasks:

- Create `/world-cup`.
- Add fixture cards and live score status UI.
- Add match market cards.
- Add settlement rules per market.
- Show oracle status.
- Clearly distinguish live score display from onchain settlement.

Safety rules:

- Do not auto-settle from live score API.
- Do not bypass UMA proposal/dispute/settle lifecycle.
- Treat live data as display context only.

### Phase 5: Portfolio, Claims, and Settlement Receipt Polish

Goal:

- Add user area surfaces around existing balances, positions, and settlement actions.

Tasks:

- Create `/portfolio` using `useTokenBalances`, `useAMMState`, and market context where possible.
- Create `/claims` as a settlement/redeem-oriented page.
- Surface ARCT, YES, and NO balances clearly.
- Include settlement receipts as UI records derived from transaction hashes/events where possible.

Safety rules:

- Claims should map to existing `settle` / `redeem` behavior.
- Do not invent private claims.
- Do not imply funds are claimable unless contract state supports it.

### Phase 6: Privacy Preview UX

Goal:

- Add privacy narrative without making false onchain claims.

Tasks:

- Create `/privacy` or `/privacy-preview`.
- Add badges and explanatory panels.
- Add disclaimers to privacy-labeled cards.
- Add roadmap language for ArcaneVM compatibility.

Required disclaimer:

> Privacy Preview is mock UX only. Trades and positions are public on Arc Testnet today. ArcaneVM privacy is not live.

### Phase 7: Vercel Deployment Readiness

Goal:

- Make the ARCM onchain app deployable without losing dynamic market behavior.

Tasks:

- Audit `.env.local` variables for Vercel.
- Replace local `data/markets.json` persistence with durable storage.
- Decide whether `/api/create-market` should be enabled in production.
- Add deployment docs.
- Ensure server routes do not require unavailable filesystem writes on Vercel.
- Add network/chain guard.

Risk:

- `app/api/create-market/route.ts` currently writes to `data/markets.json`. This is acceptable locally but not durable on Vercel.

## Onchain Flow Preservation Rules

The official sample lifecycle must remain:

1. Deploy UMA infra, ARCT, default market, and AMM via `scripts/deploy.ts`.
2. Create markets through the server API only when deployment credentials exist.
3. Initialize market and request UMA price.
4. Users trade YES/NO through AMM.
5. Users or resolvers propose/dispute/settle through UMA OO V2.
6. Users redeem/settle positions through existing contract functions.

UI can become ARCM, but the transaction path must remain compatible with:

- `EventBasedPredictionMarket`
- `PredictionMarketAMM`
- ARCT collateral
- UMA OO V2
- Arc Testnet
- MetaMask and Circle passkey wallet flows

## Specific File-by-File Strategy

### First UI files to add

- `components/layout/AppShell.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/Topbar.tsx`
- `components/markets/CategoryTabs.tsx`
- `components/markets/FilterRow.tsx`
- `components/markets/PromoBanners.tsx`
- `components/markets/SpotlightMarket.tsx`
- `components/markets/ARCMMarketCard.tsx`
- `lib/ARCM-market-view.ts`

### First existing files to modify

- `app/layout.tsx`
- `app/page.tsx`
- `components/Navbar.tsx` or replace usage with new shell
- `components/MarketCard.tsx` after a view-model adapter exists
- `lib/markets.ts` for display metadata

### Existing files to wrap, not rewrite

- `components/CreateMarketDialog.tsx`
- `components/trading/TradingPanel.tsx`
- `components/actions/MarketActions.tsx`
- `components/wallet/ConnectWallet.tsx`

### Existing files to avoid initially

- `contracts/*`
- `scripts/deploy.ts`
- `app/api/create-market/route.ts`
- `hooks/useContractWrite.ts`
- `contexts/WalletContext.tsx`
- `lib/contracts/*`
- `lib/circle.ts`

## Safest First Implementation Step

Start with Phase 1 only:

1. Add `AppShell`, `Sidebar`, and `Topbar`.
2. Move the existing `ConnectWallet` into `Topbar`.
3. Keep the current homepage content inside the new shell.
4. Do not redesign market cards yet.
5. Do not touch hooks, contracts, or API routes.
6. Run `npm run build`.

Why this is safest:

- It gives ARCM the Myriad-style navigation frame.
- It preserves the official sample's market grid and all onchain interactions.
- It creates space for later route additions without touching contract-critical code.

## Acceptance Criteria for the UI Migration

The migration is successful only if:

- `npm run build` passes after every phase.
- Existing real market detail pages still open at `/market/[address]`.
- Existing buy/sell/resolve flows still use the original hooks.
- Create market still calls `/api/create-market`.
- Wallet connection still supports injected and Circle passkey wallet paths.
- World Cup live scores are display-only until oracle settlement.
- Privacy Preview never claims live privacy.
- ARCM branding does not obscure ARCT collateral and Arc Testnet USDC gas realities.


