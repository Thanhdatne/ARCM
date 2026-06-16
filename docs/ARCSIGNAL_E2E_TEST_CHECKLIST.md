# ARCM E2E Test Checklist

This checklist verifies the real ARCM onchain prediction market lifecycle on Arc Testnet. It is written for the current app based on the official `circlefin/arc-prediction-markets` sample flow.

Do not use this checklist to validate mock preview cards, privacy preview UX, or fake payouts. The production-critical path is the wallet, deployed contracts, ARCT collateral, AMM trading, UMA Optimistic Oracle V2 settlement, and market payout redemption.

## Preconditions

- The app is configured for Arc Testnet.
- Contracts are deployed and the required public contract addresses are configured.
- The local app has been restarted after environment changes.
- The test wallet is connected through RainbowKit.
- The wallet is on Arc Testnet.
- The wallet has Arc Testnet USDC for gas.
- The wallet has ARCT test collateral, or can mint/request it through the app faucet flow.
- Never print or commit private key values or `.env.local` contents.

## What Is Real Onchain

- Wallet connection through RainbowKit and wagmi.
- Market creation through the server route at `/api/create-market`.
- Deployment of a market and AMM pair by the official sample flow.
- ARCT approvals for AMM buys.
- YES / NO buys and sells through the AMM hooks.
- UMA Optimistic Oracle V2 proposal, dispute, and settlement calls.
- Market payout redemption through the market `settle(longTokens, shortTokens)` function.
- Arc Testnet transaction links for submitted transactions.

## Preview Or Mock Only

- Privacy Preview is a mock UX layer only.
- Current Arc Testnet trades and positions are public.
- Preview example markets are not onchain and are not tradable.
- The AMM chart is session-only from current browser reads; it is not a historical indexer.
- Portfolio and Claims pages may show empty states or configured-market views only; they must not invent wallet positions or claimable payouts.

## Manual Lifecycle Test

### 1. Open the Markets Board

Route: `/`

Expected result:

- The page loads without crashing.
- The board shows real onchain markets when available.
- If no markets are available, the primary empty state says:
  - `No onchain markets found yet.`
  - `Create your first ARCM market on Arc Testnet.`
- Any preview examples are clearly labeled `Preview Examples - Not Onchain` or equivalent and are visually secondary.

Files involved:

- `app/page.tsx`
- `components/MarketCard.tsx`
- `hooks/market/useMarketCardData.ts`
- `app/api/markets/route.ts`

### 2. Connect Wallet

Action:

- Click the RainbowKit connect button in the topbar.
- Select the test wallet.
- Switch to Arc Testnet if prompted.

Expected result:

- The real RainbowKit `ConnectButton` is visible in the topbar.
- The connected wallet remains accessible on desktop and mobile widths.
- The wallet area does not show fake balances.
- UI labels refer to Arc Testnet USDC gas, not ETH gas.

Files involved:

- `components/layout/Topbar.tsx`
- `app/providers.tsx`
- `lib/contracts/index.ts`

### 3. Create A Market

Route or entry points:

- Sidebar `Create Market`
- Homepage Create Market CTA
- Empty-state Create Market CTA
- Market board Create Market CTA

Action:

- Open the real `CreateMarketDialog`.
- Fill the required fields.
- Submit the form.
- Confirm the wallet transaction if prompted.

Expected result:

- The UI blocks submission when required fields are missing.
- The UI shows pending, confirmed, or failed transaction states honestly.
- The app calls the real `/api/create-market` route.
- The server deploys the market and AMM using the official sample flow.
- On success, the app routes to `/market/{createdMarketAddress}` when possible.
- If routing cannot happen, the user can return to the Markets board and see the created market after refresh.

Files involved:

- `components/CreateMarketDialog.tsx`
- `app/api/create-market/route.ts`
- `data/markets.json`
- `contracts/EventBasedPredictionMarket.sol`
- `contracts/PredictionMarketAMM.sol`

### 4. Confirm Market Appears On The Board

Route: `/`

Expected result:

- The created market appears as a real onchain market.
- The card routes to `/market/{address}`.
- The card does not present preview examples as tradable markets.
- Status, collateral, and oracle labels are readable.

Files involved:

- `app/page.tsx`
- `components/MarketCard.tsx`
- `hooks/market/useMarketCardData.ts`

### 5. Open Market Detail

Route: `/market/{address}`

Expected result:

- The market detail page loads for the real market address.
- The question, current outcome odds, collateral label, oracle status, and settlement state are visible.
- The trading panel is present and uses the real hooks.
- The UI clearly labels:
  - `ARCT test collateral`
  - `Arc Testnet USDC gas`
  - `UMA Optimistic Oracle V2 / sample flow`

Files involved:

- `app/market/[address]/page.tsx`
- `components/market/MarketDetail.tsx`
- `components/market/MarketHeader.tsx`
- `components/market/ProbabilityBar.tsx`
- `components/trading/TradingPanel.tsx`

### 6. Approve ARCT For AMM

Action:

- In the Trade Ticket, enter a buy amount.
- If allowance is missing, click the ARCT approval button.
- Confirm the wallet transaction.

Expected result:

- Approval uses the real AMM allowance hook.
- Success and transaction link states are readable.
- After confirmation, buy actions become available without changing wallet logic.

Files involved:

- `components/trading/TradingPanel.tsx`
- `components/trading/BuyTab.tsx`
- `components/trading/TxStatus.tsx`
- `hooks/amm/useAMMActions.ts`

### 7. Buy YES Or NO

Action:

- Select YES or NO.
- Enter an ARCT amount.
- Confirm the buy transaction.

Expected result:

- The transaction calls the real AMM buy function.
- On success, balances, AMM reads, and current odds refresh.
- The AMM chart adds a session point when the live reads change.
- No fake market data is inserted.

Files involved:

- `components/trading/BuyTab.tsx`
- `components/trading/OutcomeSelector.tsx`
- `components/trading/TradingPanel.tsx`
- `hooks/amm/useAMMActions.ts`
- `hooks/amm/useAMMState.ts`

### 8. Sell YES Or NO

Action:

- Switch to the Sell tab.
- Select YES or NO.
- Approve the relevant outcome token if required.
- Enter a token amount and submit the sell.

Expected result:

- Token approval uses the real outcome-token allowance hook.
- Sell uses the real AMM sell function.
- Balances and AMM reads refresh after confirmation.
- The Buy/Sell logic remains unchanged.

Files involved:

- `components/trading/SellTab.tsx`
- `components/trading/TradingPanel.tsx`
- `hooks/amm/useAMMActions.ts`

### 9. Review Resolve State

Action:

- Open the Resolve tab in the Trade Ticket.

Expected result:

- The state panel shows the real lifecycle state:
  - market not initialized
  - awaiting proposal
  - proposal active
  - ready to settle
  - settled
  - claimable payout
  - no claimable payout
- If the market has not requested a price, the UI says market initialization is required.
- No fake claimable payout appears.

Files involved:

- `components/trading/ResolveTab.tsx`
- `hooks/market/useMarketState.ts`
- `hooks/market/useOracleState.ts`
- `hooks/market/helpers.ts`

### 10. Propose Outcome

Action:

- If required, approve ARCT for the UMA Optimistic Oracle bond.
- Propose one of:
  - YES
  - NO
  - Undetermined

Expected result:

- Approval uses the real ARCT allowance against the Optimistic Oracle address.
- Proposal uses the real UMA proposal hook.
- The UI shows the proposed outcome, proposer, and dispute window.
- The request enters proposal/liveness state.

Files involved:

- `components/trading/ResolveTab.tsx`
- `hooks/market/useOracleActions.ts`
- `hooks/market/useOracleState.ts`

### 11. Optional Dispute

Action:

- During the liveness window, click Dispute if testing the dispute path.

Expected result:

- Dispute uses the real UMA dispute hook.
- The UI shows dispute/arbitration state.
- The app does not pretend a payout is claimable while the dispute is unresolved.

Files involved:

- `components/trading/ResolveTab.tsx`
- `hooks/market/useOracleActions.ts`

### 12. Wait For Liveness Or Advance Timer

Action:

- Wait until the proposal liveness expires.
- If the sample Timer is configured and the app hook can advance it, use the timer-aware settle flow.

Expected result:

- The Resolve tab changes from proposal active to ready to settle.
- The UI offers `Settle Oracle Request` only when the real oracle state allows it.

Notes:

- The sample uses a Timer in local/test flows.
- The timer-aware frontend hooks may set current time before proposing or settling when a Timer address is configured.

Files involved:

- `hooks/market/useOracleActions.ts`
- `components/trading/ResolveTab.tsx`

### 13. Settle Oracle Request

Action:

- Click `Settle Oracle Request`.
- Confirm the wallet transaction.

Expected result:

- The app calls the real UMA Optimistic Oracle settlement function.
- The market receives the settlement callback.
- `receivedSettlementPrice` becomes true after state refresh.
- The UI shows the final settlement price and moves to settled state.

Files involved:

- `components/trading/ResolveTab.tsx`
- `hooks/market/useOracleActions.ts`
- `hooks/market/useMarketState.ts`
- `contracts/EventBasedPredictionMarket.sol`

### 14. Claim Or Redeem Payout

Action:

- After settlement, check the Resolve tab.
- If the connected wallet holds winning tokens, enter the amount and click `Claim ARCT Payout`.
- Confirm the wallet transaction.

Expected result:

- Claim uses the real market `settle(longTokens, shortTokens)` function.
- Winning outcome tokens are burned.
- ARCT payout is returned according to the resolved outcome.
- If the wallet has no winning tokens, the UI says there is no claimable payout.
- No fake payout button or fake claimable amount is shown.

Files involved:

- `components/trading/ResolveTab.tsx`
- `hooks/market/useMarketActions.ts`
- `contracts/EventBasedPredictionMarket.sol`

### 15. Claims Page Check

Route: `/claims`

Expected result:

- The page does not invent wallet data.
- If the configured sample market has a real claimable payout, the page points the user to the settlement panel.
- Otherwise it shows an honest empty state.

Known limitation:

- The Claims page currently focuses on configured market state rather than a full wallet-wide indexed claim history.

Files involved:

- `app/claims/page.tsx`
- `hooks/market/useMarketState.ts`
- `hooks/market/useTokenBalances.ts`

## Known Limitations

- There is no full historical market indexer yet.
- The AMM chart is browser-session-only and should not be presented as historical market data.
- The app does not yet provide a complete wallet-wide position index across every created market.
- Dynamic market metadata is tracked by the app data layer; verify deployment persistence before relying on it in hosted environments.
- Privacy Preview is mock UX only; current Arc Testnet positions and trades are public.
- ARCT is test collateral, not production collateral.
- Arc Testnet USDC is used for gas display.
- Dispute and liveness testing depends on the sample oracle and Timer configuration.

## Flow Files That Must Not Be Touched Casually

- `contracts/EventBasedPredictionMarket.sol`
- `contracts/PredictionMarketAMM.sol`
- `scripts/deploy.ts`
- `app/api/create-market/route.ts`
- `components/CreateMarketDialog.tsx`
- `app/market/[address]/page.tsx`
- `components/trading/TradingPanel.tsx`
- `components/trading/BuyTab.tsx`
- `components/trading/SellTab.tsx`
- `components/trading/ResolveTab.tsx`
- `hooks/amm/useAMMActions.ts`
- `hooks/amm/useAMMState.ts`
- `hooks/market/useMarketActions.ts`
- `hooks/market/useOracleActions.ts`
- `hooks/market/useMarketState.ts`
- `hooks/market/useOracleState.ts`
- `lib/contracts/index.ts`

## Pass Criteria

The lifecycle is considered verified when:

- Wallet connect works through RainbowKit.
- A market can be created through the real server flow.
- The created market appears on the board.
- The market detail page opens by address.
- ARCT approval works.
- YES and NO buys work.
- YES and NO sells work when balances exist.
- A resolution can be proposed through UMA OO V2.
- The oracle request can be settled after liveness.
- Winning tokens can be redeemed through `Claim ARCT Payout`.
- Losing or absent positions show `No claimable payout`.
- Build passes with `npm run build`.

