# ArcSignal MVP Status

ArcSignal is now scoped as an onchain-first Arc Testnet MVP around the official `circlefin/arc-prediction-markets` sample flow.

## Real Onchain Today

- RainbowKit wallet connection in the topbar.
- Arc Testnet wagmi/viem configuration.
- Real market creation through `/api/create-market`.
- Real deployed market and AMM contract reads when addresses are configured.
- ARCT test collateral approval.
- YES / NO buying and selling through `PredictionMarketAMM`.
- UMA Optimistic Oracle V2 / sample resolver flow.
- Market settlement and payout redemption through the existing market contract.

## Preview Or Mock Only

- Privacy Preview is mock UX only.
- Current Arc Testnet trades and positions are public.
- Preview example market cards on the homepage are static examples and are clearly labeled as not onchain.
- Portfolio and Claims pages do not fabricate wallet data. They show empty states unless real configured-market wallet balances or claimable positions are detected.

## Active Routes

- `/` - onchain-first market board and real create market CTA.
- `/market/[address]` - real market detail, trading, resolving, and payout settlement flow.
- `/portfolio` - wallet-aware onchain position overview for the configured sample market.
- `/claims` - wallet-aware claimable payout view for the configured sample market.
- `/privacy` - accurate Privacy Preview explanation.
- `/api/create-market` - server-side dynamic market deployment.
- `/api/markets` - dynamic market metadata read.

## Coming Soon Routes

These are disabled in the sidebar and are not active MVP product routes:

- World Cup
- 5-Minute Signals
- Arc Ecosystem
- Leaderboard
- News

## Preserved Contract Flow

The MVP keeps the official sample contract flow intact:

1. Deploy UMA sample infrastructure, ARCT collateral, `EventBasedPredictionMarket`, and `PredictionMarketAMM`.
2. Create or load a configured market.
3. Approve ARCT collateral for the AMM.
4. Buy YES or NO through the AMM.
5. Sell YES or NO through the AMM when desired.
6. Resolve through UMA Optimistic Oracle V2 / sample flow.
7. Settle the oracle request.
8. Redeem winning YES/NO tokens through the market settlement function.

Do not replace these hooks or contracts with mock trading behavior.

## Env And Deploy Steps Still Needed

Create `.env.local` from `.env.example`, then configure:

- `PRIVATE_KEY` for deployment and server-side dynamic market creation.
- `NEXT_PUBLIC_ALCHEMY_RPC_URL=https://rpc.testnet.arc.network`.
- `NEXT_PUBLIC_CIRCLE_CLIENT_KEY` and `NEXT_PUBLIC_CIRCLE_CLIENT_URL` if Circle passkey wallet support is needed.

Run the official deployment flow to populate:

- `NEXT_PUBLIC_MARKET_ADDRESS`
- `NEXT_PUBLIC_AMM_ADDRESS`
- `NEXT_PUBLIC_ARCT_ADDRESS`
- `NEXT_PUBLIC_OO_V2_ADDRESS`
- `NEXT_PUBLIC_FINDER_ADDRESS`
- `NEXT_PUBLIC_TIMER_ADDRESS`
- `NEXT_PUBLIC_MOCK_ORACLE_ADDRESS`

Arc Testnet reference:

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Gas display: USDC
- Current collateral: ARCT test collateral

## How To Test Create / Trade / Resolve / Claim

1. Run `npm run compile` if contract artifacts are missing.
2. Run `npm run deploy` with a funded Arc Testnet deployer.
3. Start the app and connect a wallet through RainbowKit.
4. Create a market from the homepage CTA.
5. Open the created market card.
6. Approve ARCT for the AMM.
7. Buy YES and/or NO.
8. Sell a position if needed.
9. Use the Resolve tab to approve ARCT for the oracle bond if required.
10. Propose YES, NO, or Undetermined.
11. Wait for liveness or use the sample timer flow where available.
12. Settle the oracle request.
13. Redeem winning tokens through the Resolve tab.

## Guardrails

- Do not modify contracts casually.
- Do not modify deployment scripts casually.
- Do not replace `hooks/market`, `hooks/amm`, or `hooks/useContractWrite` with mock logic.
- Do not use frontend-only data for settlement.
- Do not claim production privacy is live.
- Do not present preview examples as onchain markets.
