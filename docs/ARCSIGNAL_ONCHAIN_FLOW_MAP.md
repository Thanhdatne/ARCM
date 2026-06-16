# ARCM Onchain Flow Map

This document maps the official `circlefin/arc-prediction-markets` sample app flow that ARCM should preserve while evolving the UI into a production-ready Arc Testnet application.

ARCM integration decision: keep the official sample contracts, deployed-address configuration, wallet providers, and trading hooks intact. ARCM should polish the UI around this flow first; it should not introduce a custom prediction market contract, mock trade bypass, or alternate settlement path yet.

## A. Current Official Sample Architecture

The sample app is a Next.js App Router frontend with Hardhat contracts and viem/wagmi-based contract reads and writes.

Core layers:

- Contracts: `contracts/EventBasedPredictionMarket.sol` and `contracts/PredictionMarketAMM.sol`.
- UMA sample infrastructure: deployed by `scripts/deploy.ts` from `@uma/core` artifacts, including `Finder`, `IdentifierWhitelist`, `AddressWhitelist`, `Store`, `Timer`, `MockOracleAncillary`, and `OptimisticOracleV2`.
- Collateral: a sample `TestnetERC20` named Arc Test Token, symbol `ARCT`, decimals `18`.
- Gas: Arc Testnet uses USDC as the native gas token display. ARCT is sample market collateral, not gas.
- Frontend reads/writes: `wagmi`, `viem`, React Query, Circle Modular Wallet support, and RainbowKit.
- Dynamic market creation: `app/api/create-market/route.ts` deploys market and AMM contracts server-side, then writes metadata to `data/markets.json`.

Arc Testnet configuration:

- Chain id: `5042002`.
- RPC: `https://rpc.testnet.arc.network`.
- Explorer: `https://testnet.arcscan.app`.
- Frontend chain config: `lib/chain.ts`.
- Hardhat network config: `hardhat.config.ts`.
- Wallet/wagmi config: `lib/wagmi.ts` and `app/providers.tsx`.

ABI locations:

- Market ABI: `lib/contracts/abis/market.ts`.
- AMM ABI: `lib/contracts/abis/amm.ts`.
- ERC20 ABI: `lib/contracts/abis/erc20.ts`.
- UMA Optimistic Oracle V2 ABI: `lib/contracts/abis/oracle.ts`.
- Timer ABI: `lib/contracts/abis/timer.ts`.
- ABI barrel export: `lib/contracts/abis/index.ts`.

Deployed address configuration:

- `lib/contracts/addresses.ts` reads `NEXT_PUBLIC_MARKET_ADDRESS`, `NEXT_PUBLIC_AMM_ADDRESS`, `NEXT_PUBLIC_ARCT_ADDRESS`, `NEXT_PUBLIC_OO_V2_ADDRESS`, `NEXT_PUBLIC_FINDER_ADDRESS`, and `NEXT_PUBLIC_TIMER_ADDRESS`.
- Missing address variables fall back to `0x0000000000000000000000000000000000000000`.
- `scripts/deploy.ts` writes real deployed addresses to `.env.local`.
- At audit time, only `.env.example` is present in the repo. No real deployed addresses are committed.

## B. Contract Flow

### Create market

Primary files:

- `scripts/deploy.ts` for the initial sample deployment.
- `app/api/create-market/route.ts` for user-created market deployment from the frontend.
- `contracts/EventBasedPredictionMarket.sol`.
- `contracts/PredictionMarketAMM.sol`.

Initial sample deployment flow:

1. Deploy UMA sample infrastructure contracts.
2. Whitelist the `YES_OR_NO_QUERY` identifier.
3. Deploy `TestnetERC20` collateral as `ARCT`.
4. Whitelist ARCT as collateral.
5. Mint ARCT to the deployer.
6. Deploy `EventBasedPredictionMarket`.
7. Approve ARCT proposer reward to the market.
8. Call `initializeMarket()`, which requests an event-based price from UMA Optimistic Oracle V2.
9. Deploy `PredictionMarketAMM`.
10. Approve ARCT seed liquidity to the AMM.
11. Call `amm.initialize(seedLiquidity)`.
12. Write deployed addresses to `.env.local`.

Dynamic market creation flow:

1. `CreateMarketDialog` posts a title to `/api/create-market`.
2. `app/api/create-market/route.ts` validates `PRIVATE_KEY`, `NEXT_PUBLIC_ARCT_ADDRESS`, `NEXT_PUBLIC_FINDER_ADDRESS`, and `NEXT_PUBLIC_TIMER_ADDRESS`.
3. The route creates viem public and wallet clients on Arc Testnet.
4. It loads compiled artifacts from `artifacts/contracts/...`.
5. It ensures the deployer has enough ARCT, minting via `allocateTo` when needed.
6. It deploys `EventBasedPredictionMarket` using the title as ancillary data.
7. It approves proposer reward and calls `initializeMarket()`.
8. It deploys and seeds a new `PredictionMarketAMM`.
9. It stores `{ address, ammAddress, title, category, createdAt }` in `data/markets.json`.

### YES / NO token flow

`EventBasedPredictionMarket` creates two ERC20 position tokens:

- `longToken`: YES exposure.
- `shortToken`: NO exposure.

Before settlement:

- `create(tokensToCreate)` pulls ARCT collateral from the caller and mints equal YES and NO tokens.
- `redeem(tokensToRedeem)` burns equal YES and NO tokens and returns ARCT collateral.

After settlement:

- `settle(longTokensToRedeem, shortTokensToRedeem)` burns position tokens and returns collateral according to `settlementPrice`.
- A YES settlement maps to `1e18`.
- A NO settlement maps to `0`.
- An undetermined settlement maps to `0.5e18`.

### AMM / trading flow

Primary files:

- `contracts/PredictionMarketAMM.sol`.
- `hooks/amm/useAMMTrade.ts`.
- `hooks/amm/useAMMApprovals.ts`.
- `hooks/amm/useAMMCalc.ts`.
- `hooks/amm/useAMMState.ts`.
- `components/trading/BuyTab.tsx`.
- `components/trading/SellTab.tsx`.

AMM initialization:

- `initialize(initialLiquidity)` transfers ARCT collateral from the caller.
- The AMM calls `market.create(initialLiquidity)` to mint paired YES/NO tokens.
- It seeds equal YES and NO reserves.

Buy flow:

- User approves ARCT to the AMM through `useApproveArctForAMM`.
- `buyYes(collateralAmount)` pulls ARCT, creates paired YES/NO tokens, keeps NO in the pool, and swaps from pool reserves to send YES to the buyer.
- `buyNo(collateralAmount)` does the inverse.

Sell flow:

- User approves YES or NO tokens to the AMM through `useApproveTokenForAMM`.
- `sellYes(yesAmount)` pulls YES tokens, swaps against reserves, redeems paired inventory, and returns ARCT.
- `sellNo(noAmount)` does the inverse.

Note: some AMM source names still say `usdcAmount` or `usdcOut`, but the current sample collateral is ARCT.

### UMA Optimistic Oracle V2 integration

Primary files:

- `contracts/EventBasedPredictionMarket.sol`.
- `hooks/market/useOracleState.ts`.
- `hooks/market/useOracleActions.ts`.
- `components/trading/ResolveTab.tsx`.

Market initialization calls `_requestOraclePrice()`, which:

- Resolves the `OptimisticOracleV2` address from UMA `Finder`.
- Requests price for identifier `YES_OR_NO_QUERY`.
- Sets custom liveness.
- Sets proposer bond.
- Marks request as event-based.
- Enables callbacks for dispute and settlement.

Resolution UI actions:

- `useProposePriceWithTimer` proposes YES, NO, or undetermined to OO V2.
- `useDisputePrice` disputes an active proposal.
- `useSettleOracleRequest` or `useSettleOracleWithTimer` settles the oracle request after liveness.
- The market receives the final callback in `priceSettled`.

### Resolve / settle flow

1. A market is initialized and the oracle request is active.
2. A resolver proposes a price:
   - YES: `1000000000000000000`.
   - NO: `0`.
   - Undetermined: `500000000000000000`.
3. During the liveness window, a participant can dispute.
4. Once the request expires or resolves, anyone can call OO V2 `settle`.
5. OO V2 calls `priceSettled` on `EventBasedPredictionMarket`.
6. The market records `settlementPrice` and `receivedSettlementPrice`.
7. Users can settle winning position tokens for ARCT collateral.

### Claim / redeem flow

The sample uses market `settle(longTokensToRedeem, shortTokensToRedeem)` as the payout claim path after oracle settlement.

Related frontend flow:

- `ResolveTab` displays oracle phases and settlement state.
- `useSettlePosition` calls market `settle`.
- `useTokenBalances` reads YES and NO balances.
- `PortfolioSection` and the trading panel display wallet balances and settlement eligibility.

There is also a pre-settlement paired-token redemption path:

- `useRedeemPosition` calls `redeem(tokensToRedeem)`.
- It requires equal YES and NO tokens and returns ARCT before settlement.

## C. Frontend Flow

Wallet connection:

- `app/providers.tsx`: wraps the app with `WagmiProvider`, `QueryClientProvider`, `RainbowKitProvider`, and `WalletProvider`.
- `lib/chain.ts`: defines Arc Testnet as chain id `5042002`, native currency display `USDC`, RPC, explorer, and fee hints.
- `lib/wagmi.ts`: creates the wagmi config for Arc Testnet.
- `contexts/WalletContext.tsx`: supports injected wallet connections and Circle Modular Wallet passkey connections.
- `components/layout/Topbar.tsx`: renders the RainbowKit `ConnectButton`.
- `components/wallet/ConnectWallet.tsx`: legacy/custom wallet status, ARCT balance, faucet, and disconnect UI used by the original sample components.

Reading markets:

- `lib/markets.ts`: defines the primary configured market plus preview/static market cards.
- `app/api/markets/route.ts`: reads dynamic market metadata from `data/markets.json`.
- `app/page.tsx`: fetches dynamic markets, combines them with `MARKETS`, and renders `MarketCard`.
- `hooks/market/useMarketCardData.ts`: reads onchain status, settlement outcome, supply-derived volume, and AMM YES price for real markets.

Creating markets:

- `components/CreateMarketDialog.tsx`: calls `/api/create-market`.
- `app/api/create-market/route.ts`: deploys a new market and AMM using server-side viem and the deployer private key.
- `data/markets.json`: stores dynamic frontend metadata.

Clicking into market detail:

- `components/MarketCard.tsx`: links real markets to `/market/[address]`.
- `app/market/[address]/page.tsx`: resolves the route address against static and dynamic market data, then provides `MarketAddressProvider`.
- `contexts/MarketAddressContext.tsx`: supplies the active market and AMM addresses to hooks.

Trading YES / NO:

- `components/trading/TradingPanel.tsx`: orchestrates buy, sell, and resolve tabs.
- `components/trading/BuyTab.tsx`: approves ARCT if needed and calls `buyYes` or `buyNo`.
- `components/trading/SellTab.tsx`: approves position tokens if needed and calls `sellYes` or `sellNo`.
- `hooks/amm/useAMMTrade.ts`: writes AMM buy/sell transactions.
- `hooks/amm/useAMMApprovals.ts`: writes ARCT and position token approvals.
- `hooks/amm/useAMMCalc.ts`: previews buy/sell output.
- `hooks/amm/useAMMState.ts`: reads AMM prices, reserves, fee, and initialized state.

Approving collateral:

- AMM buys use `useApproveArctForAMM`.
- Oracle proposals use `useApproveArct(OO_V2_ADDRESS)`.
- Direct market create/redeem helpers are in `hooks/market/useMarketActions.ts`.

Resolving markets:

- `components/trading/ResolveTab.tsx`: drives proposal, dispute, oracle settlement, and final position settlement UI.
- `hooks/market/useOracleState.ts`: reads OO V2 state and request details.
- `hooks/market/useOracleActions.ts`: proposes, disputes, and settles OO V2 requests.
- `hooks/market/useTokenBalances.ts`: reads user YES/NO/ARCT balances and allowances.

Claiming / redeeming payouts:

- `ResolveTab` calls `useSettlePosition` after `receivedSettlementPrice` is true.
- `useSettlePosition` calls market `settle`.
- `useRedeemPosition` exists for paired-token redemption before settlement, but the current polished detail flow emphasizes settlement after oracle resolution.

Files and behavior that must not be broken:

- Real transaction writes in `hooks/useContractWrite.ts`.
- Active market/AMM address resolution in `contexts/MarketAddressContext.tsx`.
- Market and AMM hooks under `hooks/market` and `hooks/amm`.
- `/api/create-market` server-side deployment flow.
- `lib/contracts/addresses.ts` env-driven address reads.
- `lib/chain.ts` and `lib/wagmi.ts` Arc Testnet configuration.
- `components/trading/TradingPanel.tsx`, `BuyTab.tsx`, `SellTab.tsx`, and `ResolveTab.tsx`.

## D. Collateral Model

Current sample collateral:

- Token: ARCT, deployed as UMA `TestnetERC20`.
- Decimals: 18.
- Address env: `NEXT_PUBLIC_ARCT_ADDRESS`.
- Frontend decimal constant: `COLLATERAL_DECIMALS = 18` in `lib/contracts/addresses.ts`.
- Mint/faucet flow: `allocateTo` on the test ERC20, surfaced through `useMintArct`.

Arc Testnet gas:

- Native currency display in `lib/chain.ts` is USDC.
- Arc Testnet users need gas on Arc, displayed as USDC.
- This is separate from ARCT sample market collateral.

Production note:

- ARCT is not production collateral.
- The current app should clearly call it `ARCT test collateral`.
- Any future production collateral decision should be explicit and should not be inferred from AMM variable names.

## E. ARCM Integration Decision

ARCM should:

- Keep `EventBasedPredictionMarket` and `PredictionMarketAMM` for the current onchain milestone.
- Keep UMA OO V2 integration and resolver flow unchanged.
- Keep the existing hooks and write paths for approve, buy, sell, propose, dispute, settle oracle, and settle position.
- Polish the UI around the real flow instead of replacing it with mock trading.
- Keep Privacy Preview clearly labeled as UI-only. Current Arc Testnet trades and positions are public.
- Defer any new ARCM-specific contracts until the sample flow is verified end-to-end.

ARCM should not yet:

- Add a new custom market factory contract.
- Replace AMM trades with mock buttons.
- Route settlement through frontend-only data.
- Claim production privacy.
- Treat external data sources as settlement sources.

## F. Risk List

Do not touch casually:

- `contracts/EventBasedPredictionMarket.sol`.
- `contracts/PredictionMarketAMM.sol`.
- `scripts/deploy.ts`.
- `hardhat.config.ts`.
- `app/api/create-market/route.ts`.
- `lib/contracts/addresses.ts`.
- `lib/contracts/abis/*`.
- `lib/chain.ts`.
- `lib/wagmi.ts`.
- `contexts/WalletContext.tsx`.
- `contexts/MarketAddressContext.tsx`.
- `hooks/useContractWrite.ts`.
- `hooks/market/*`.
- `hooks/amm/*`.
- `components/trading/*`.
- `components/CreateMarketDialog.tsx`.
- `app/market/[address]/page.tsx`.

Hook behavior to preserve:

- `useContractWrite` must continue to support both injected wallets and Circle Modular Wallet user operations.
- `useAMMTrade` must call the real AMM contract functions.
- `useAMMApprovals` must approve the active AMM address from context.
- `useMarketState` must read the active market address from context.
- `useOracleActions` must preserve OO V2 requester arguments: market address, identifier, timestamp, ancillary data.
- `useSettlePosition` must call market `settle`, not a mock claim path.

Config files controlling deployed addresses:

- `.env.local`: generated locally by deploy script and not committed.
- `.env.example`: safe placeholder template only.
- `lib/contracts/addresses.ts`: runtime reads and zero-address fallback.
- `scripts/deploy.ts`: writes initial sample addresses.
- `app/api/create-market/route.ts`: requires deployed UMA/ARCT infrastructure addresses for dynamic markets.

Build/runtime risks:

- If `.env.local` is missing, the app can build but the configured onchain market address defaults to zero.
- If `artifacts/` are missing, `/api/create-market` cannot deploy dynamic markets until contracts are compiled.
- If `PRIVATE_KEY` is missing, dynamic market creation fails server-side.
- If ARCT, Finder, or Timer addresses are missing, dynamic market creation fails server-side.
- If Circle env vars are placeholders, Circle passkey wallet connection is disabled, but injected wallet and RainbowKit can still render.

## G. Environment Variables

Required for deployment and dynamic market creation:

- `PRIVATE_KEY`: deployer/server wallet private key. Never commit a real value.
- `NEXT_PUBLIC_ALCHEMY_RPC_URL`: legacy variable name used as the Arc RPC URL by Hardhat and frontend. Recommended value for Arc Testnet is `https://rpc.testnet.arc.network`.

Required frontend contract addresses after deployment:

- `NEXT_PUBLIC_MARKET_ADDRESS`: initial sample `EventBasedPredictionMarket`.
- `NEXT_PUBLIC_AMM_ADDRESS`: initial sample `PredictionMarketAMM`.
- `NEXT_PUBLIC_ARCT_ADDRESS`: sample ARCT collateral token.
- `NEXT_PUBLIC_OO_V2_ADDRESS`: UMA Optimistic Oracle V2 sample deployment.
- `NEXT_PUBLIC_FINDER_ADDRESS`: UMA Finder sample deployment.
- `NEXT_PUBLIC_TIMER_ADDRESS`: UMA Timer sample deployment.
- `NEXT_PUBLIC_MOCK_ORACLE_ADDRESS`: mock oracle used by the sample infra and deployment output.

Required for Circle passkey wallets:

- `NEXT_PUBLIC_CIRCLE_CLIENT_KEY`.
- `NEXT_PUBLIC_CIRCLE_CLIENT_URL`.

Reference Arc Testnet values:

- Chain id: `5042002`.
- RPC: `https://rpc.testnet.arc.network`.
- Explorer: `https://testnet.arcscan.app`.
- Native gas token display: USDC.
- Sample collateral: ARCT.

## H. Next Implementation Step

Recommended next step before deeper UI or product integrations:

1. Create a local `.env.local` from `.env.example`.
2. Set a funded Arc Testnet deployer `PRIVATE_KEY`.
3. Set `NEXT_PUBLIC_ALCHEMY_RPC_URL=https://rpc.testnet.arc.network`.
4. Run contract compile if artifacts are missing.
5. Run the official deployment script to populate `.env.local` addresses.
6. Verify the app reads non-zero market, AMM, ARCT, OO V2, Finder, and Timer addresses.
7. Run a manual end-to-end flow on Arc Testnet:
   - connect wallet
   - mint/get ARCT test collateral
   - create a dynamic market
   - buy YES
   - buy NO
   - sell one side
   - propose oracle result
   - dispute if needed
   - settle oracle request
   - settle winning position tokens
8. Only after the flow is verified, continue ARCM UI/product work around the preserved hooks and contracts.


