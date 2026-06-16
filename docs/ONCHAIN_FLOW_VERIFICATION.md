# ARCM Onchain Flow Verification

Last verified: 2026-06-12

ARCM is currently an onchain-first Arc Testnet app built on the official
`circlefin/arc-prediction-markets` sample flow. UI preview content must stay
secondary and clearly labeled. The real path is wallet connect, ARCT collateral,
market creation, AMM trading, UMA / resolver settlement, and payout redemption.

## Current Verification Status

- Wallet connect: the topbar renders the real RainbowKit `ConnectButton` from
  `@rainbow-me/rainbowkit`.
- Chain config: Arc Testnet is configured with chain ID `5042002`, RPC
  `https://rpc.testnet.arc.network`, explorer `https://testnet.arcscan.app`,
  and native currency display `USDC`.
- Market board: `/` reads dynamic markets from `/api/markets` and the configured
  deployment addresses from `lib/markets.ts`. Zero-address placeholders are
  filtered out, so missing deployments show a clean empty state.
- Create market: the Create Market CTA reaches `components/CreateMarketDialog.tsx`,
  which posts to the real `/api/create-market` deployment route.
- Market detail: real market cards link to `/market/[address]`, where
  `MarketAddressProvider`, `MarketDetail`, and `TradingPanel` load the selected
  contracts.
- Trading panel: buy, sell, approve, oracle, dispute, settle, and redeem controls
  still use the existing official hooks. They have not been replaced with mock
  buttons.
- ARCT faucet: connected users can mint ARCT test collateral from the trade
  ticket through the existing `useMintArct` / `allocateTo` flow.
- Deployed address status in this workspace: `.env.local` is not present and
  `data/markets.json` is empty. A deployment or dynamic market creation is still
  needed before real markets appear.

## Required Environment Variables

Copy `.env.example` to `.env.local` and fill in local values.

```bash
PRIVATE_KEY=...
NEXT_PUBLIC_ALCHEMY_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_CIRCLE_CLIENT_KEY=...
NEXT_PUBLIC_CIRCLE_CLIENT_URL=...
NEXT_PUBLIC_MARKET_ADDRESS=0x...
NEXT_PUBLIC_AMM_ADDRESS=0x...
NEXT_PUBLIC_ARCT_ADDRESS=0x...
NEXT_PUBLIC_OO_V2_ADDRESS=0x...
NEXT_PUBLIC_FINDER_ADDRESS=0x...
NEXT_PUBLIC_TIMER_ADDRESS=0x...
NEXT_PUBLIC_MOCK_ORACLE_ADDRESS=0x...
```

Notes:

- `PRIVATE_KEY` is server-side only and must never be committed.
- `NEXT_PUBLIC_ALCHEMY_RPC_URL` is the inherited sample variable name; it points
  to the Arc Testnet RPC.
- Arc Testnet gas is USDC.
- ARCT is the sample app's test collateral token with 18 decimals. It is not
  production collateral.
- The Circle variables are required only for the passkey wallet path.

## Deploy If Needed

1. Fund the deployer with Arc Testnet USDC for gas from the Circle faucet.
2. Set `PRIVATE_KEY` and `NEXT_PUBLIC_ALCHEMY_RPC_URL` in `.env.local`.
3. Compile local prediction market contracts if artifacts are missing:

```bash
npm run compile
```

4. Deploy UMA sample infrastructure, ARCT, the sample market, and AMM:

```bash
npm run deploy
```

5. Confirm that `scripts/deploy.ts` wrote the deployed addresses back to
   `.env.local`.
6. Restart the Next.js dev server so the frontend picks up the new public env
   values.

The dynamic Create Market route can also deploy additional markets after the
base UMA infrastructure addresses are configured.

## How To Test The Real Flow

1. Start the app and open `/`.
2. Connect a wallet through the RainbowKit button in the topbar.
3. If no markets are listed, use the Create Market CTA. This calls
   `/api/create-market` and deploys a real sample market and AMM.
4. Open a real market card. Preview cards are explicitly not onchain and should
   not route to trading.
5. In the trade ticket, mint ARCT test collateral if needed.
6. Buy flow:
   - Enter an ARCT amount.
   - Approve ARCT for the AMM if prompted.
   - Buy YES or NO through the existing AMM hook.
7. Sell flow:
   - Select YES or NO.
   - Approve the selected position token for the AMM if prompted.
   - Sell through the existing AMM hook.
8. Resolve flow:
   - Propose YES / NO / undetermined through UMA Optimistic Oracle V2 sample
     flow.
   - Dispute if needed.
   - Wait for liveness.
   - Settle the oracle request.
9. Claim / redeem:
   - After settlement, redeem winning position tokens through the existing
     settle / redeem action in the Resolve tab.

## Files Controlling The Onchain Flow

- `app/providers.tsx`: Wagmi, QueryClient, RainbowKit, and wallet providers.
- `lib/chain.ts`: Arc Testnet chain definition.
- `lib/wagmi.ts`: wagmi transports and connector configuration.
- `contexts/WalletContext.tsx`: MetaMask and Circle wallet state.
- `hooks/useContractWrite.ts`: shared contract write path for wagmi and Circle
  user operations.
- `lib/contracts/addresses.ts`: deployed address configuration and collateral
  decimals.
- `lib/contracts/abis/*`: ABI definitions used by frontend hooks.
- `app/api/create-market/route.ts`: server-side dynamic market deployment flow.
- `app/api/markets/route.ts`: dynamic market metadata read/write surface.
- `data/markets.json`: dynamic market metadata store.
- `lib/markets.ts`: configured market and preview market separation.
- `components/CreateMarketDialog.tsx`: real create market UI entrypoint.
- `components/MarketCard.tsx`: real market card routing; preview cards are
  passive.
- `app/market/[address]/page.tsx`: market detail route and selected-address
  provider.
- `components/market/MarketDetail.tsx`: market reads and detail display.
- `components/trading/TradingPanel.tsx`: real buy, sell, resolve, and redeem
  panel.
- `components/trading/BuyTab.tsx`: ARCT approval and AMM buy actions.
- `components/trading/SellTab.tsx`: position-token approval and AMM sell actions.
- `components/trading/ResolveTab.tsx`: UMA proposal, dispute, settle, and
  position settlement actions.
- `hooks/amm/*`: AMM state, calculations, approvals, and buy/sell writes.
- `hooks/market/*`: market state, token balances, ARCT faucet, oracle, and
  settlement writes.

## Files To Avoid Touching Casually

- `contracts/**`
- `scripts/deploy.ts`
- `hardhat.config.ts`
- `hooks/useContractWrite.ts`
- `hooks/amm/**`
- `hooks/market/**`
- `contexts/WalletContext.tsx`
- `lib/contracts/addresses.ts`
- `app/api/create-market/route.ts`
- `app/api/markets/route.ts`

Small UI wrappers around these files are acceptable. Replacing the hooks, API
routes, deployment scripts, or contract calls with mock behavior is not.

## Flow Integrity Notes

- Preview examples are allowed only as labeled UI examples and are not treated
  as onchain markets.
- If the market board is empty, the correct state is "No onchain markets found
  yet" plus a Create Market CTA.
- Privacy Preview is mock UX only. Current Arc Testnet trades, positions, and
  settlement are public.
- Settlement must follow the official UMA Optimistic Oracle V2 / resolver sample
  flow. Frontend data must not directly determine payout.

