@"
# ARCM Phase State

Completed:
- Phase 1: collateral capability foundation.
- Phase 2: dynamic per-market collateral metadata.
- Phase 3: collateral-aware Market Detail and Trading UI.

Current status:
- Build passes.
- ARCT remains the only active trading collateral.
- USDC/EURC trading remains disabled.
- CCTP/Gateway not implemented yet.
- Buy/Sell/Approve/Claim/Settle/Create-market semantics unchanged.
- Non-ARCT markets are guarded in trading UI.

Next phase:
- Phase 4: contract compatibility decision for USDC/EURC 6-decimal collateral.
"@ | Set-Content .\docs\codex-phase-state.md