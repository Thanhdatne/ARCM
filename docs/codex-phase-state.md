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
- Phase B1: V2 integration audit completed.
- Phase B2: V2 trading hooks/components patched for collateral-address-aware and decimal-aware buy/sell behavior; committed as `528cb28`.
- Phase B3: smoke verification completed.

Current status:
- `npm run build` passes.
- `git diff --check` passes with only LF/CRLF warnings.
- Grep/Select-String verification confirms the V2 buy/sell path no longer uses fixed `COLLATERAL_DECIMALS`.
- Remaining ARCT/fixed-decimal references are limited to `ResolveTab`, `useMarketActions`, `useMarketCardData`, and legacy alias/oracle/faucet areas; these are intentionally deferred.
- CCTP/Gateway is not implemented yet.
- Claims/settlement decimal-aware cleanup remains deferred until after the V2 buy/sell live smoke test.

Next phase:
- Do not start CCTP/Gateway in Phase C yet.
- Next: Phase B4 deploy/readiness audit for the V2 factory, environment configuration, and first V2 test market.
- Keep claims/settlement decimal-aware cleanup deferred until after the V2 buy/sell live smoke test.
