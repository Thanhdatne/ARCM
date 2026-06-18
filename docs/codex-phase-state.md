# ARCM Phase State

Completed:
- Phase 1: collateral capability foundation.
- Phase 2: dynamic per-market collateral metadata.
- Phase 3: collateral-aware Market Detail and Trading UI.
- Phase 4A: USDC/EURC V2 architecture decision (Option B target, Option D guarded rollout).
- Phase 4B: Market V2 and AMM V2 implementation specification and test plan.
- Phase 5A-1: EventBasedPredictionMarketV2 core contract and direct tests.
- Phase 5A-2: PredictionMarketAMMV2 core contract and direct tests.
- Phase 5A-3: atomic MarketV2Factory deployment path and direct tests.

Current status:
- Build passes.
- ARCT remains the only active trading collateral.
- USDC/EURC trading remains disabled.
- CCTP/Gateway is not implemented yet.
- Buy/Sell/Approve/Claim/Settle/Create-market semantics are unchanged.
- Non-ARCT markets remain guarded in the trading UI.
- Existing ARCT markets remain on V1; no market migration is planned.

Next phase:
- Phase 5B: plan the separate V2 deployment and version-aware integration path while keeping USDC/EURC trading disabled.
