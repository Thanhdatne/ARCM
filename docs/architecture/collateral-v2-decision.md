# Collateral V2 Architecture Decision

## 1. Decision summary

ARCM will use **Option B** as its production target: deploy Market V2 and AMM V2 for real USDC/EURC collateral. Rollout will follow **Option D**: leave V1 ARCT markets unchanged, keep USDC/EURC trading disabled, implement real CCTP/Gateway deposits independently, and enable USDC/EURC markets only after V2 and end-to-end tests pass. **Option A—enabling 6-decimal collateral on V1—must not be used in production.**

## 2. Why current V1 is ARCT-only

V1 was deployed and validated around ARCT's existing decimal and accounting assumptions. Its market, outcome-token, AMM, UI, and API behavior form a working ARCT-specific system; they are not a general guarantee of safe behavior for collateral with different decimals. ARCT therefore remains the only active V1 trading collateral.

## 3. Why 6-decimal USDC/EURC cannot be safely enabled on V1

USDC and EURC use 6-decimal units. V1 contains assumptions that can conflate collateral units, outcome-token units, and 18-decimal UMA price units. Enabling 6-decimal collateral without an explicit contract-level decimal model risks incorrect minting, redemption, quotes, slippage bounds, balances, and settlement accounting. UI-only conversion cannot repair contract semantics, so USDC/EURC must remain disabled on V1.

## 4. Required V2 contract behavior

Market V2 and AMM V2 must:

- Read collateral decimals from the configured collateral token.
- Enforce `outcomeDecimals == collateralDecimals`.
- Preserve raw-unit 1:1 create and redeem behavior.
- Keep UMA `settlementPrice` expressed at 1e18 precision.
- Expose `contractVersion`.
- Expose `collateralDecimals`.
- Expose `outcomeDecimals`.
- Reject fee-on-transfer behavior using pre/post balance-delta checks.
- Enforce an explicit collateral allowlist.
- Provide AMM slippage protection using `minOut` and `deadline`.
- Prevent unauthorized AMM initialization.

The V2 specification and tests must define the exact invariants, access control, failure modes, and event/interface compatibility before implementation is accepted.

## 5. Existing V1 migration rule

- Do not migrate existing markets.
- Existing ARCT markets remain on V1 and retain their current behavior.
- New USDC/EURC markets may be created only on V2 after enablement approval.

## 6. Frontend and API requirements

- Carry `collateralDecimals` and `outcomeDecimals` as separate values everywhere.
- Add a V1/V2 compatibility layer based on explicit contract version and metadata.
- Do not use a global `COLLATERAL_DECIMALS` assumption for new markets.
- Keep unsupported collateral trading guarded until V2 and end-to-end validation are complete.

## 7. Supabase and data requirements

Market records must include:

- `contract_version`
- `collateral_address`
- `collateral_symbol`
- `collateral_decimals`
- `outcome_decimals`

All raw token amounts must be stored as strings to avoid precision loss. Supabase remains a cache/index; onchain contracts remain the source of truth.

## 8. CCTP/Gateway policy

CCTP/Gateway deposit support must be implemented and validated independently as a real onchain flow. It must never emit fake success states. A successful deposit only establishes that funds reached the intended destination; it does not imply that USDC/EURC market trading is enabled.

## 9. Final enablement checklist

USDC/EURC trading may be enabled only when all of the following are complete:

- [ ] Market V2 and AMM V2 specifications are approved.
- [ ] V2 contracts implement every required behavior above.
- [ ] Unit, invariant, integration, and adversarial tests pass.
- [ ] 6-decimal create, trade, settle, and redeem paths pass end-to-end tests.
- [ ] Fee-on-transfer tokens and non-allowlisted collateral are rejected.
- [ ] AMM initialization authorization, `minOut`, and `deadline` protections are verified.
- [ ] V1 ARCT regression tests pass unchanged.
- [ ] Frontend/API V1/V2 compatibility and separate decimal handling are verified.
- [ ] Required Supabase metadata and string-based raw amount storage are deployed and verified.
- [ ] Real CCTP/Gateway deposit behavior is independently verified, with truthful failure and success states.
- [ ] Production addresses, configuration, monitoring, and rollback/disable controls are reviewed.
- [ ] An explicit release decision enables each supported V2 collateral; default remains disabled.
