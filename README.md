# ARCM

ARCM is an onchain prediction market app built on **Arc Testnet**.
The current product focuses on FIFA World Cup-style markets where users can trade **YES / NO** outcomes using **testnet USDC**, with settlement handled through an admin + UMA Optimistic Oracle flow.

The app is designed as a real onchain MVP: deployed contracts, wallet trading, market settlement, claimable rewards, portfolio tracking, and Circle CCTP-based USDC deposit flow.


## Live App

Production app:

```txt
https://arcm-coral.vercel.app
```

Repository:

```txt
https://github.com/Thanhdatne/ARCM
```



## Core Idea

ARCM lets users trade binary prediction markets on Arc Testnet.

Example markets:

```txt
Will Netherlands beat Sweden?
Will Germany beat Ivory Coast?
Will Japan beat Sweden?
```

Each market has two outcomes:

```txt
YES
NO
```

Users buy or sell outcome tokens with testnet USDC.
After the match ends, the admin records the final result, resolves the market, and users can claim rewards if they hold the winning side.



## Current Status

This is a testnet MVP.

Working flows:

* Wallet connection on Arc Testnet
* World Cup market catalog
* YES / NO trading
* USDC-based collateral
* AMM liquidity and pricing
* Market detail pages
* Portfolio tracking
* Claim rewards page
* Admin market deployment
* Admin final score input
* Admin resolve / fast-settle flow
* Circle CCTP testnet USDC deposit UI
* Market hiding after kickoff
* Past fixture filtering from public markets

Not production ready yet:

* Mainnet deployment
* Permissionless market creation
* Fully automated live sports data ingestion
* Full audit
* Advanced risk controls



## Tech Stack

Frontend:

* Next.js App Router
* TypeScript
* Tailwind CSS
* RainbowKit
* wagmi
* viem
* TanStack Query

Smart contracts / blockchain:

* Solidity
* Hardhat
* Arc Testnet
* UMA Optimistic Oracle V2
* ERC20 collateral
* AMM-based YES / NO trading

Data / app infrastructure:

* Local JSON market data
* API routes for market creation, portfolio, claims, and admin workflows
* Vercel deployment
* Circle CCTP / BridgeKit for testnet USDC deposit flow



## Chain Configuration

Arc Testnet:

```txt
Chain ID: 5042002
RPC: https://rpc.testnet.arc.network
Explorer: https://testnet.arcscan.app
Native gas display: USDC
```

Testnet USDC:

```txt
USDC: 0x3600000000000000000000000000000000000000
Decimals: 6
```



## Main Deployed Contracts

Current V2 infrastructure:

```txt
Market V2 Factory:
0xDd184B30EDd59004A8Dbd1b584bD5F12191C491E

Collateral Allowlist:
0xA51b6278cD6ce23FE0ec8a23B0d5697B280C696e

UMA Finder:
0xF98bf22A41540ceB573b231C27c766b5631C50F5

UMA Optimistic Oracle V2:
0xE384b500Da57da2C1b1172a18fA616bC321aE58B

Identifier:
YES_OR_NO_QUERY
```

Example deployed market:

```txt
Market:
0x0A5f315a286ed2027336d4725f83A7E48776a7f3

AMM:
0x2375fb6A586bFaD303bDd4d78Cc762accAa1417f
```



## App Pages

### Markets

Public market list.

The page shows only markets that are currently available for trading.
Past fixtures and fixtures that have already kicked off are hidden from the public market list.

### Market Detail

Single market trading page.

Users can:

* View market metadata
* See YES / NO odds
* Buy YES or NO
* Sell positions
* See AMM price movement
* View collateral and settlement information

After kickoff, betting is locked from the UI.

### Portfolio

Wallet-based portfolio page.

Users can see:

* Open positions
* Outcome token balances
* Claimable settled rewards
* Wallet-related market exposure

### Claims

Claim rewards directly from settled markets.

Users can claim winning positions without needing to go back to the market detail page.

### Deposit

USDC deposit page using Circle CCTP / BridgeKit.

Users can bridge testnet USDC from supported testnet networks into Arc Testnet.

### Admin Markets

Admin-only operational page for managing World Cup markets.

Admin can:

* Deploy markets
* View deployed markets
* Input final scores
* Resolve finished fixtures
* Fast-settle markets on testnet
* Keep old fixtures hidden from public pages while preserving claim and portfolio data



## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Compile contracts:

```bash
npm run compile
```

Deploy contracts:

```bash
npm run deploy
```



## Environment Variables

Create a `.env.local` file.

Required variables depend on the workflow being used.

```env
PRIVATE_KEY=

NEXT_PUBLIC_ALCHEMY_RPC_URL=https://rpc.testnet.arc.network

NEXT_PUBLIC_CIRCLE_CLIENT_KEY=
NEXT_PUBLIC_CIRCLE_CLIENT_URL=

NEXT_PUBLIC_MARKET_ADDRESS=
NEXT_PUBLIC_AMM_ADDRESS=

NEXT_PUBLIC_ARCT_ADDRESS=

NEXT_PUBLIC_OO_V2_ADDRESS=
NEXT_PUBLIC_FINDER_ADDRESS=
NEXT_PUBLIC_TIMER_ADDRESS=
NEXT_PUBLIC_MOCK_ORACLE_ADDRESS=
```

Important:

```txt
Never expose PRIVATE_KEY to the browser.
Never use NEXT_PUBLIC_PRIVATE_KEY.
PRIVATE_KEY must only be used in server-side routes or deployment scripts.
```



## Development Workflow

Recommended workflow:

```bash
git checkout main
git pull origin main
npm install
npm run build
npm run dev
```

Before pushing:

```bash
npm run build
git status -sb
git diff --check
```

Commit example:

```bash
git add .
git commit -m "Describe the change"
git push origin main
```



## Market Lifecycle

### 1. Market Deployment

Admin deploys a market with:

* Market question
* Home / away teams
* Outcome type
* Kickoff time
* Testnet USDC collateral
* Initial AMM liquidity

### 2. Trading

Users trade YES / NO before kickoff.

The app hides or locks markets after kickoff to prevent late betting from the UI.

### 3. Result Input

After the match ends, admin enters the final score from the Admin Markets page.

### 4. Resolution

Admin resolves the market through the resolver / UMA settlement flow.

### 5. Claim

Users who hold the winning outcome token can claim rewards from the Claims page.



## Safety Rules

The app follows these rules:

* Do not delete deployed market data if users may have positions.
* Hide past fixtures from public markets instead of deleting them.
* Keep settled markets accessible to Claims and Portfolio.
* Keep admin pages able to access old markets.
* Never expose private keys client-side.
* Do not use fake/mock balances in public user flows.
* Prefer USDC V2 markets for public flows.
* Keep ARCT legacy code isolated from public user experience.



## Project Direction

ARCM is moving toward a cleaner onchain prediction market experience:

* Real market deployment
* Real testnet collateral
* Real wallet trading
* Clean Binance-style dark UI
* Better market lifecycle controls
* Better claim and portfolio UX
* More polished deposit and onboarding flow

Future possible improvements:

* Automated sports data ingestion
* Better market indexing
* Supabase-backed market and wallet cache
* Better notification system
* More market categories
* Mainnet-ready risk controls
* Contract audit and security review



## Disclaimer

ARCM is currently a testnet MVP.

The app is built for experimentation and development on Arc Testnet.
It is not financial advice, not a production trading venue, and not intended for real-money use until contracts, infrastructure, and operational flows are fully audited and production-ready.
