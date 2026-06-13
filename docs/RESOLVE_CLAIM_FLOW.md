# Resolve, Settle, And Claim Flow

Last updated: 2026-06-12

ArcSignal uses the official `circlefin/arc-prediction-markets` sample settlement flow. Do not replace it with frontend-only resolution, fake payouts, or mocked claim state.

## User Steps To Resolve

1. Open a real market detail page.
2. Connect a wallet on Arc Testnet.
3. Open the `Resolve` tab in the trade ticket.
4. Confirm the market is initialized:
   - `priceRequested` must be true.
   - If the market is not initialized, no resolution action should be available.
5. If the oracle request is awaiting proposal, approve ARCT for the oracle if prompted.
6. Propose the outcome through UMA Optimistic Oracle V2 sample flow:
   - `YES` proposes `1e18`.
   - `NO` proposes `0`.
   - `Undetermined` proposes `5e17`.
7. Wait for the liveness window.
8. During liveness, a user may dispute the proposal if it is wrong.
9. After liveness expires, settle the oracle request.
10. Wait for the market contract to receive the settlement callback and expose `receivedSettlementPrice`.

## User Steps To Claim

1. Open the settled market detail page.
2. Open the `Resolve` tab.
3. Confirm a real settlement price has been received by the market contract.
4. The UI calculates claimable balances from real YES / NO token balances and the settlement price:
   - YES wins: long tokens are claimable.
   - NO wins: short tokens are claimable.
   - Undetermined: both sides may have partial payout.
5. Enter the token amount to settle.
6. Click `Claim ARCT Payout`.
7. The UI calls the real market `settle(longTokensToRedeem, shortTokensToRedeem)` function.

No claim button should be shown as actionable unless real token balances and real settlement state allow it.

## Waiting And Liveness Requirements

- The sample market sets a custom UMA liveness period during `initializeMarket()`.
- The deployed sample uses a short testnet liveness period.
- Users must wait until the proposed price is past the liveness window before settling the oracle request.
- If a proposal is disputed, UMA dispute/arbitration flow applies and the market may need another proposal cycle.

## Timer Usage

The sample deploys a UMA `Timer` contract and stores `NEXT_PUBLIC_TIMER_ADDRESS`.

The frontend resolve hooks use timer-aware helper paths:

- `useProposePriceWithTimer`
- `useSettleOracleWithTimer`

When `TIMER_ADDRESS` is configured, these hooks set the timer current time before proposing or settling. This keeps the sample's time-dependent oracle flow usable on Arc Testnet. If the timer address is zero, the hooks skip timer calls.

## Files Controlling Resolve And Claim UI

- `app/market/[address]/page.tsx`
  - Wraps market detail in `MarketAddressProvider`.
  - Renders `MarketDetail` and `TradingPanel`.
- `components/trading/TradingPanel.tsx`
  - Reads market, AMM, balance, allowance, and oracle state.
  - Instantiates real resolve/claim hooks.
  - Passes them into `ResolveTab`.
- `components/trading/ResolveTab.tsx`
  - Displays propose, dispute, settle-oracle, and claim-payout actions.
  - Shows lifecycle states and claim availability.
- `hooks/market/useOracleActions.ts`
  - `useProposePriceWithTimer`
  - `useDisputePrice`
  - `useSettleOracleRequest`
  - `useSettleOracleWithTimer`
- `hooks/market/useOracleState.ts`
  - Reads UMA oracle state, proposer, proposed price, expiration, and bond.
- `hooks/market/useMarketState.ts`
  - Reads market initialization, settlement status, settlement price, request timestamp, identifier, and ancillary data.
- `hooks/market/useTokenBalances.ts`
  - Reads ARCT, YES, and NO token balances.
- `hooks/market/useMarketActions.ts`
  - `useApproveArct`
  - `useSettlePosition`
  - `useRedeemPosition` for pre-settlement paired redemption.
- `lib/contracts/abis/oracle.ts`
  - UMA Optimistic Oracle V2 ABI.
- `lib/contracts/abis/market.ts`
  - Market `settle`, `redeem`, state reads, and token reads.

## Contract Flow

1. `initializeMarket()` requests a UMA OO V2 price and sets `priceRequested`.
2. A user proposes a price on UMA OO V2.
3. A user may dispute during liveness.
4. After liveness, a user settles the OO request.
5. UMA callback `priceSettled(...)` updates the market's `settlementPrice` and `receivedSettlementPrice`.
6. A user claims payout by calling market `settle(longTokensToRedeem, shortTokensToRedeem)`.

## What Should Not Be Touched Casually

- `contracts/**`
- `scripts/deploy.ts`
- `hardhat.config.ts`
- `hooks/useContractWrite.ts`
- `hooks/market/useOracleActions.ts`
- `hooks/market/useOracleState.ts`
- `hooks/market/useMarketActions.ts`
- `hooks/market/useMarketState.ts`
- `hooks/market/useTokenBalances.ts`
- `lib/contracts/abis/**`

UI text, layout, and state labels can be improved, but transaction hooks and contract calls must remain intact while Buy/Sell trading is working.

## Labels To Keep Clear

- Settlement: UMA Optimistic Oracle V2 / sample flow.
- Collateral: ARCT test collateral.
- Gas: Arc Testnet USDC.
- Privacy: positions and trades are public on Arc Testnet today.
