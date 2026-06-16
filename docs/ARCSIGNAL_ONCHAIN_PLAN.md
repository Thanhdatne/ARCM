# ARCM Onchain Plan

## Setup Status

The official Circle Arc prediction markets sample was cloned into `C:\project\ARCM-onchain` from:

`https://github.com/circlefin/arc-prediction-markets`

Setup commands completed:

```bash
npm install
npm run build
npm run compile
```

The Next.js app also runs locally on port `3001`:

```bash
npm run dev -- --port 3001
```

Local smoke check: `http://127.0.0.1:3001` returned `200` and rendered the sample Markets page.

Notes:

- `npm install` completed successfully.
- The sample currently reports npm audit warnings from its dependency tree. These were not changed during setup.
- No rebrand has been applied yet.
- No ARCM-specific contracts have been added yet.

## How the Sample App Works

The app is a Next.js App Router prediction market application for Arc Testnet. It combines:

- A market grid at `/`
- Market detail pages at `/market/[address]`
- API routes for user-created markets:
  - `POST /api/create-market`
  - `GET /api/markets`
- wagmi + viem wallet interactions
- Injected wallet support
- Circle modular passkey wallet support
- Hardhat deployment for contracts
- UMA Optimistic Oracle V2 for market resolution

The sample ships with one default onchain Bitcoin market and static/demo market cards. Users can create new onchain binary markets from the UI. The server-side API deploys a fresh market contract and AMM, initializes the UMA price request, seeds liquidity, and stores the new market in `data/markets.json`.

## Contracts Used

### `EventBasedPredictionMarket.sol`

Core binary YES/NO prediction market.

Responsibilities:

- Stores the market question as UMA ancillary data
- Requests a YES/NO price from UMA Optimistic Oracle V2
- Mints Long/YES and Short/NO ERC20 position tokens
- Lets users create paired positions by depositing collateral
- Lets users redeem paired positions before settlement
- Receives UMA settlement callbacks
- Lets users settle long/short tokens after resolution

Settlement values:

- `1e18` = YES
- `0` = NO
- `5e17` = Undetermined

### `PredictionMarketAMM.sol`

Constant-product AMM for trading YES/NO positions.

Responsibilities:

- Holds YES and NO reserves
- Supports buying YES and NO with collateral
- Supports selling YES and NO back to collateral
- Uses a fee in basis points
- Provides price and preview functions:
  - `getYesPrice`
  - `getNoPrice`
  - `calcBuyYes`
  - `calcBuyNo`
  - `calcSellYes`
  - `calcSellNo`

The AMM is initialized with paired YES/NO liquidity created from collateral.

## UMA Optimistic Oracle V2 Integration

Arc Testnet does not have UMA infrastructure natively deployed in this sample, so `scripts/deploy.ts` deploys a local UMA stack to Arc Testnet:

- `Timer`
- `Finder`
- `IdentifierWhitelist`
- `AddressWhitelist`
- `Store`
- `TestnetERC20`
- `MockOracleAncillary`
- `OptimisticOracleV2`

The deploy script then:

1. Registers UMA contract addresses in `Finder`
2. Whitelists the `YES_OR_NO_QUERY` identifier
3. Whitelists the ARCT collateral token
4. Deploys `EventBasedPredictionMarket`
5. Calls `initializeMarket()`, which requests a price from the Optimistic Oracle
6. Deploys `PredictionMarketAMM`
7. Seeds the AMM with ARCT liquidity
8. Writes deployed contract addresses to `.env.local`

Market resolution flow:

1. A market requests a price from UMA OO V2.
2. Anyone can propose YES, NO, or Undetermined.
3. The proposal remains open for the configured liveness period.
4. If undisputed, OO settles and calls `priceSettled`.
5. If disputed, OO calls `priceDisputed`, and the market re-requests resolution with a fresh timestamp.
6. Users redeem settled YES/NO tokens for collateral.

## Collateral Token

The current sample uses ARCT as market collateral.

ARCT details:

- Deployed by the sample deployment script as UMA `TestnetERC20`
- Symbol: `ARCT`
- Decimals: `18`
- Freely mintable in the UI / via `allocateTo`
- Used for:
  - Market collateral
  - Proposer rewards
  - Proposer bonds
  - AMM liquidity
  - Buy/sell settlement inside the sample

This is distinct from Arc Testnet native USDC.

## Arc Testnet USDC Usage

Arc Testnet details:

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Gas token: USDC

In the current sample:

- Arc Testnet USDC is used for gas fees.
- ARCT is used as prediction market collateral.
- The README instructs users to obtain Arc Testnet USDC from the Circle faucet.
- The app also exposes an ARCT faucet for the sample collateral token.

For ARCM Onchain, this is a major product decision point:

- Short term: keep ARCT collateral while rebranding and validating UX.
- Later: replace ARCT collateral with the Arc Testnet USDC ERC20 collateral path if desired.
- Keep messaging clear that Arc native USDC pays gas and ARCT is sample collateral until changed.

## Environment Variables

Environment variables live in `.env.local`. The repo provides `.env.example`.

Required for deployment:

```bash
PRIVATE_KEY=...
NEXT_PUBLIC_ALCHEMY_RPC_URL=https://rpc.testnet.arc.network
```

Optional / wallet integration:

```bash
NEXT_PUBLIC_CIRCLE_CLIENT_KEY=...
NEXT_PUBLIC_CIRCLE_CLIENT_URL=...
```

Auto-written by `npm run deploy`:

```bash
NEXT_PUBLIC_MARKET_ADDRESS=...
NEXT_PUBLIC_AMM_ADDRESS=...
NEXT_PUBLIC_ARCT_ADDRESS=...
NEXT_PUBLIC_OO_V2_ADDRESS=...
NEXT_PUBLIC_FINDER_ADDRESS=...
NEXT_PUBLIC_TIMER_ADDRESS=...
NEXT_PUBLIC_MOCK_ORACLE_ADDRESS=...
```

Important deployment note:

- `PRIVATE_KEY` must be from a non-custodial wallet.
- Circle passkey wallets do not expose private keys and cannot deploy the contracts.
- The deployer must hold Arc Testnet USDC for gas.

## Deploying to Arc Testnet

1. Create `.env.local`:

```bash
cp .env.example .env.local
```

2. Configure:

```bash
PRIVATE_KEY=<deployer_private_key>
NEXT_PUBLIC_ALCHEMY_RPC_URL=https://rpc.testnet.arc.network
```

3. Fund the deployer with Arc Testnet USDC for gas.

4. Compile contracts:

```bash
npm run compile
```

5. Deploy:

```bash
npm run deploy
```

This runs:

```bash
hardhat run scripts/deploy.ts --network arcTestnet
```

6. Start the frontend:

```bash
npm run dev
```

After deployment, `.env.local` should contain the UMA infra, market, AMM, and ARCT addresses needed by the frontend.

## Frontend Structure

Important frontend files:

- `app/page.tsx` - market grid and category filters
- `app/market/[address]/page.tsx` - market detail route
- `app/api/create-market/route.ts` - deploys custom markets from the server
- `app/api/markets/route.ts` - serves user-created market metadata
- `components/CreateMarketDialog.tsx` - create-market UI
- `components/MarketCard.tsx` - market grid card
- `components/market/*` - market detail display
- `components/trading/*` - buy/sell/resolve panel
- `components/actions/*` - approve/create/redeem/settle actions
- `contexts/WalletContext.tsx` - injected wallet and Circle passkey wallet state
- `hooks/market/*` - market/oracle/position hooks
- `hooks/amm/*` - AMM state and trade hooks
- `lib/chain.ts` - Arc Testnet chain config
- `lib/wagmi.ts` - wagmi config
- `lib/contracts/*` - contract addresses, ABIs, and types

## What Needs to Change for ARCM

Recommended sequence:

1. Preserve the official sample as the working baseline.
2. Rebrand UI copy from UMA Prediction Market / Bitcoin market to ARCM.
3. Replace the category model with ARCM markets:
   - Arc ecosystem signals
   - 5-minute signals
   - sector markets
   - privacy-aware finance narratives
4. Add ARCM design system:
   - dark premium trading shell
   - Arc cyan accents
   - YES emerald / NO rose
   - polished market cards
5. Add explicit network/collateral messaging:
   - Arc Testnet gas uses USDC
   - current sample collateral is ARCT
   - future ARCM collateral migration path can be USDC
6. Decide collateral migration:
   - keep ARCT temporarily for sample compatibility, or
   - replace collateral with Arc Testnet USDC ERC20 and update decimals/approval/formatting
7. Replace default BTC market with ARCM seed markets.
8. Update create-market flow:
   - safer server-side deployment controls
   - market validation
   - rate limits
   - admin/deployer separation
9. Add Vercel deployment configuration:
   - production env vars
   - server route constraints
   - persistent storage replacement for `data/markets.json`
10. Add Privacy Preview copy only:
   - do not claim privacy is live
   - do not claim ArcaneVM-backed privacy until ArcaneVM is live
   - label shielded/private UI as preview states

## Privacy Positioning

ARCM privacy features must remain Privacy Preview only for now.

Do not claim:

- production privacy is live
- shielded positions are cryptographically private
- ArcaneVM privacy is active

Safe copy:

- "Privacy Preview"
- "mock privacy UX"
- "future shielded position flow"
- "auditable settlement preview"
- "ArcaneVM-ready design direction, not live privacy"

## Current Verification Results

Completed successfully:

```bash
npm install
npm run build
npm run compile
```

Build result:

- Next.js production build succeeds.
- Routes generated:
  - `/`
  - `/market/[address]`
  - `/api/create-market`
  - `/api/markets`

Compile result:

- Hardhat compiled 23 Solidity files successfully.
- TypeChain generated typings.

Runtime smoke result:

- Dev server started on `http://127.0.0.1:3001`.
- Homepage returned HTTP `200`.
- Markets page content was present.


