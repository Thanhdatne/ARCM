# Market V2 and AMM V2 Implementation Specification

Status: Phase 4B specification complete; implementation is deferred to Phase 5A.

## 1. V2 goals

EventBasedPredictionMarketV2 and PredictionMarketAMMV2 will provide a decimal-safe contract path for ARCT, USDC, and EURC while preserving the deployed V1 system.

- Support explicitly approved ARCT, USDC, and EURC collateral safely.
- Support both 18-decimal and 6-decimal collateral without scaling token amounts to 18 decimals.
- Preserve every existing V1 ARCT market, address, balance, position, and liquidity pool unchanged.
- Keep UMA oracle prices and the market `settlementPrice` in the existing 1e18 fixed-point price domain.
- Keep raw collateral amounts, outcome-token amounts, and AMM reserves in the collateral token's native decimal domain.
- Default USDC/EURC trading to disabled until V2 contracts, integrations, and end-to-end tests are approved.

### Numeric domains and invariants

V2 must keep two numeric domains separate:

1. **Raw token domain:** collateral amounts, YES/NO amounts, liquidity, reserves, fees, quotes, inputs, outputs, and payouts use the collateral token's native raw units. One raw collateral unit creates one raw YES unit and one raw NO unit.
2. **Price domain:** UMA prices, `settlementPrice`, and displayed AMM probabilities use 1e18 fixed point. No collateral decimal conversion is applied to an UMA price.

For each market:

- `outcomeDecimals == collateralDecimals` at all times.
- Before settlement, each outstanding complete YES/NO pair is backed by exactly the same raw amount of collateral, excluding collateral separately committed to UMA rewards/bonds.
- `settlementPrice` is always one of `0`, `5e17`, or `1e18` under the current binary resolution policy.
- At settlement, `floor(yesAmount * settlementPrice / 1e18) + floor(noAmount * (1e18 - settlementPrice) / 1e18)` is paid in raw collateral units.
- Integer division rounds down. Any residual dust remains contract collateral and must be measurable; Phase 5A must not add an unreviewed sweep path.

## 2. EventBasedPredictionMarketV2 requirements

### 2.1 Construction and immutable metadata

The V2 market constructor must accept the V1 market inputs plus the V2 allowlist dependency/configuration required below. Construction must:

- Set an immutable or constant `contractVersion` with an unambiguous value such as `2`.
- Read `collateralDecimals` from `IERC20Metadata(collateral).decimals()` once and store it as `uint8`.
- Deploy the YES and NO outcome tokens with `outcomeDecimals = collateralDecimals`.
- Store `outcomeDecimals` and require `outcomeDecimals == collateralDecimals` before construction completes.
- Reject the zero collateral address and contracts that do not expose a valid ERC-20 `decimals()` result.
- Preserve V1 pair/question, Finder, identifier, timer, proposer reward, liveness, proposer bond, and request timestamp semantics.
- Preserve distinct YES/NO token addresses controlled by the market as minter and burner.

No constructor argument may permit outcome decimals to diverge from collateral decimals.

### 2.2 Explicit collateral allowlist

V2 requires two successful checks at deployment:

- The collateral must be approved by an explicit ARCM V2 allowlist controlled by the deployment authority/factory.
- The collateral must be accepted by UMA's collateral whitelist resolved through Finder.

The ARCM V2 allowlist must be address-based, default-deny, server/deployment configured, and independently disable-able per network. Token symbol is never an authorization mechanism. Phase 5A should prefer an allowlist registry or factory-owned mapping over a constructor-supplied boolean. Allowlist administration, ownership transfer, and events must be tested. Removal blocks new deployments but must not break already deployed markets.

### 2.3 Public metadata and interface

At minimum, the public ABI must expose:

- `contractVersion() -> uint256`
- `collateralToken() -> address`
- `collateralDecimals() -> uint8`
- `outcomeDecimals() -> uint8`
- `longToken() -> address`
- `shortToken() -> address`
- `pairName() -> string`
- `customAncillaryData() -> bytes`
- `priceIdentifier() -> bytes32`
- `requestTimestamp() -> uint256`
- `priceRequested() -> bool`
- `receivedSettlementPrice() -> bool`
- `settlementPrice() -> uint256`
- `proposerReward() -> uint256`
- `optimisticOracleLivenessTime() -> uint256`
- `optimisticOracleProposerBond() -> uint256`
- an allowlist/registry address or other getter that lets operators prove which V2 policy authorized the collateral

Frontend and API consumers must be able to discover all decimal and version metadata onchain without symbol-based inference.

### 2.4 Create and redeem accounting

`create(uint256 amount)` must:

- Require initialization and `amount > 0`.
- Treat `amount` as raw collateral units.
- Measure the market's collateral balance before and after `safeTransferFrom` and require the increase to equal exactly `amount`.
- Mint exactly `amount` raw YES units and `amount` raw NO units to the caller only after the balance-delta check passes.
- Emit raw input and minted amounts.

`redeem(uint256 amount)` must:

- Require `amount > 0`.
- Burn exactly `amount` raw YES units and `amount` raw NO units from the caller.
- Transfer exactly `amount` raw collateral units to the caller.
- Check the recipient and/or sender balance delta where needed to reject fee-on-transfer or otherwise non-exact collateral behavior.
- Revert atomically if any transfer, burn, or exact-delta invariant fails.

The same exact inbound balance-delta rule applies to proposer reward funding. V2 explicitly does not support fee-on-transfer, rebasing, callback-mutating, or otherwise non-standard balance-changing collateral.

### 2.5 UMA Optimistic Oracle V2 flow

V2 must preserve the current OO V2 lifecycle and callbacks:

- Resolve Optimistic Oracle V2, identifier whitelist, and collateral whitelist through Finder.
- Require `YES_OR_NO_QUERY` support.
- Request the price using the market collateral, proposer reward, custom liveness, proposer bond, event-based mode, and dispute/settlement callbacks.
- Accept `priceSettled` and `priceDisputed` only from the Finder-resolved OO V2 and only for the correct identifier, ancillary data, and active timestamp.
- On a valid dispute, use the existing fresh-timestamp re-request behavior and preserve reward refund validation.
- Keep the oracle result and `settlementPrice` in 1e18 price units regardless of collateral decimals.
- Clamp/classify the current outcomes exactly as V1: prices at least `1e18` resolve YES, exactly `5e17` resolves split, and all other values resolve NO, unless a later architecture decision deliberately changes this policy.

Approval to the oracle must use a safe force-approve/reset-to-zero pattern compatible with tokens that reject nonzero-to-nonzero approvals. No unlimited approval is required when the exact proposer reward is known.

### 2.6 Settlement and payout

`settle(uint256 yesAmount, uint256 noAmount)` must:

- Require a received settlement price and reject a zero/zero claim.
- Burn the caller's requested raw outcome amounts.
- Calculate each side independently with 1e18 price math and round down.
- Transfer the summed raw collateral payout exactly.
- Emit raw YES, raw NO, settlement price, and raw collateral payout data sufficient for indexing.

The implementation must document and test dust behavior. A complete equal pair must always settle to its raw collateral principal at `0`, `5e17`, and `1e18`; asymmetric odd raw amounts at `5e17` may leave at most the mathematically expected rounding dust.

### 2.7 Security and failure behavior

- Use `SafeERC20` for all token transfers and approvals.
- Apply checks-effects-interactions and reentrancy protection to state-changing token flows.
- Reject zero amounts where no useful operation exists.
- Preserve atomicity: a failed delta check, mint, burn, oracle request, or transfer reverts the entire operation.
- Emit versioned/deployment metadata and lifecycle events without removing event data relied on by V1 indexers; V2 may define new event signatures and must receive separate ABIs.
- Do not add privileged withdrawal of user backing collateral in Phase 5A.

## 3. PredictionMarketAMMV2 requirements

### 3.1 Construction, validation, and initialization

AMM V2 must bind permanently to one V2 market and validate at construction that:

- The market reports `contractVersion == 2`.
- Its collateral, YES token, NO token, `collateralDecimals`, and `outcomeDecimals` are readable and consistent.
- `outcomeDecimals == collateralDecimals`.
- `feeBps < 10_000`.

Initialization must not be claimable by an arbitrary first caller. The preferred design is an atomic V2 factory transaction that deploys the market, deploys the AMM with immutable market/config values, transfers seed collateral from the authorized creator, initializes liquidity, and records both addresses. If a separate `initialize` entry point remains, it must authorize only an immutable initializer/factory, accept the intended liquidity provider explicitly, be callable once, and become unusable after initialization.

Initialization must check exact collateral balance deltas, mint equal raw YES/NO reserves, set approvals safely, reject zero liquidity, and emit initializer, provider, and raw liquidity amounts.

### 3.2 Raw-unit reserve and quote model

- `reserveYes`, `reserveNo`, collateral inputs, outcome inputs, outputs, liquidity, and fee calculations all use raw token units.
- Constant-product calculations must make no assumption that a token has 18 decimals.
- `feeBps` remains basis-point math with denominator `10_000`.
- Only `getYesPrice()` and `getNoPrice()` return 1e18 fixed-point probabilities.
- Quote functions must use exactly the same formulas and rounding direction as their state-changing counterparts.
- Quotes and trades must handle 6-decimal minimum units predictably and return/revert on outputs that round to zero.
- Reserve accounting must match actual outcome-token balances after every successful initialization and trade, with any explicitly retained fee inventory documented.

### 3.3 Trading interface and slippage protection

State-changing trades must use deadline and minimum-output parameters:

- `buyYes(uint256 collateralIn, uint256 minOut, uint256 deadline) -> uint256 yesOut`
- `buyNo(uint256 collateralIn, uint256 minOut, uint256 deadline) -> uint256 noOut`
- `sellYes(uint256 yesIn, uint256 minOut, uint256 deadline) -> uint256 collateralOut`
- `sellNo(uint256 noIn, uint256 minOut, uint256 deadline) -> uint256 collateralOut`

Every trade must:

- Require `block.timestamp <= deadline`.
- Require nonzero input.
- Compute output in raw units and require output is nonzero.
- Require actual output `>= minOut` before completing.
- Use exact inbound balance-delta checks to reject fee-on-transfer behavior.
- Update reserves atomically and transfer the exact calculated output.
- Be non-reentrant and unavailable before initialization or after market resolution.
- Emit raw input/output, `minOut`, fee, and recipient/trader data needed for reconciliation.

The transaction functions and quote functions must have explicit V2 names/signatures in the V2 ABI; V1 callers must never accidentally bind to them.

### 3.4 Approval and transfer safety

- Use `SafeERC20.safeTransfer` and `safeTransferFrom` for collateral and both outcome tokens.
- Use `forceApprove`, or reset allowance to zero before setting it, for market approvals.
- Prefer exact approvals where practical. If a maximum allowance is used for the immutable market, document the trust boundary and test tokens that require zero-reset approval.
- Never approve an address supplied by a trade caller.
- Verify exact received amounts for all inbound assets; unsupported fee-on-transfer behavior must revert.

### 3.5 AMM arithmetic acceptance criteria

- The implementation must use multiplication/division ordering that avoids needless precision loss and Solidity overflow.
- A successful quote followed by a trade against unchanged reserves must produce the quoted output.
- `minOut == quote` succeeds against unchanged reserves; `minOut == quote + 1` reverts.
- Buy/sell symmetry is not expected to be lossless because of fees and rounding, but losses must be bounded by the documented formula.
- Probability getters remain within `[0, 1e18]`; for nonempty reserves their sum should equal `1e18` within at most one rounding unit.
- No trade may make a tracked reserve negative, exceed the AMM's actual balance, or decrease the constant-product invariant contrary to the documented fee model.

## 4. Compatibility plan

- Existing EventBasedPredictionMarket and PredictionMarketAMM contracts remain deployed and untouched. Existing V1 ARCT markets retain their addresses, ABIs, positions, settlement, and liquidity.
- Existing liquidity is not migrated, wrapped, copied, or reseeded into V2.
- New USDC/EURC markets must use EventBasedPredictionMarketV2 and PredictionMarketAMMV2 only.
- New ARCT markets may use V2 for parity testing and later rollout, but existing ARCT markets remain V1.
- Frontend/API code must route using explicit `contractVersion`, selecting the correct ABI and transaction signatures. Missing version metadata is treated as V1 only for known/validated legacy addresses, not for arbitrary contracts.
- Supabase records must store both V1 and V2 metadata: `contract_version`, `collateral_address`, `collateral_symbol`, `collateral_decimals`, and `outcome_decimals`.
- Raw amounts are serialized as decimal strings. JavaScript numbers must not carry onchain raw values.
- USDC/EURC feature flags remain off until contract, API, frontend, database, and end-to-end acceptance gates all pass.

## 5. Deployment plan

1. Add new V2 contracts alongside V1; do not rename or modify deployed V1 sources.
2. Add a separate V2 deploy/factory path and separate V2 ABIs. Do not overload the current V1 deployment path.
3. Configure a server-side, network-specific collateral allowlist using verified addresses. Cross-check it against UMA's whitelist before deployment.
4. Deploy and test V2 first with local mocks, then ARCT on the target testnet, then separately approved USDC and EURC.
5. Keep all USDC/EURC create/trade feature flags off until automated tests and a manual release review pass.
6. Record market version and decimal metadata when V2 market/AMM addresses are persisted.
7. Add monitoring and an operational disable path for creation/UI exposure; deployed contracts must remain independently truthful and solvent.

`scripts/deploy.ts` remains unchanged. It must not be used for World Cup market deployment unless explicitly requested. The later V2 path should be a new script or factory integration, not an implicit change to the current script.

## 6. Test plan

Phase 5A contract tests should use deterministic local fixtures for Finder, UMA OO V2, identifier/collateral whitelists, 18-decimal collateral, 6-decimal USDC/EURC mocks, and an adversarial fee-on-transfer token. Tests must assert balances, supply, reserves, events, reverts, and invariants in raw units.

### 6.1 V1 regression tests

- Compile the unchanged V1 contracts and reproduce the current ARCT initialize, create, redeem, buy, sell, propose, settle, and claim paths.
- Assert V1 addresses/interfaces are not replaced by V2 artifacts and V1 outcome decimals remain unchanged.
- Confirm no V2 deployment or metadata behavior mutates V1 state or liquidity.

### 6.2 V2 ARCT 18-decimal tests

- Deploy V2 with 18-decimal ARCT and assert version `2`, collateral decimals `18`, and both outcome decimals `18`.
- Exercise minimum raw unit, one whole token, large amounts, reward/bond, initialization, trades, and settlement.
- Assert raw 1:1 mint/redeem and 1e18 price behavior.

### 6.3 V2 USDC 6-decimal tests

- Deploy with an allowlisted 6-decimal USDC mock and assert both outcome tokens use 6 decimals.
- Test `1`, `1_000_000`, and large raw-unit amounts through create, trade, settle, and redeem.
- Assert there is no `1e12` scaling in balances, reserves, inputs, outputs, or payouts.
- Reject deployment when USDC is absent from either required allowlist.

### 6.4 V2 EURC 6-decimal tests

- Repeat the USDC matrix with a distinct allowlisted EURC mock/address.
- Prove authorization is address-based rather than symbol-based by rejecting an unallowlisted token named EURC.
- Verify independent enable/disable configuration for USDC and EURC.

### 6.5 Create/redeem tests

- Create mints exactly equal raw YES and NO amounts and increases backing by exactly the raw collateral input.
- Redeem burns equal pairs and returns exactly the same raw collateral amount.
- Test zero input, missing approval, insufficient balance, uninitialized market, repeated calls, and minimum raw units.
- Assert total supply/backing invariants after multiple users and interleaved create/redeem operations.

### 6.6 AMM buy/sell tests

- Initialize equal reserves only through the authorized path and reject repeat or unauthorized initialization.
- Test buy YES, buy NO, sell YES, and sell NO using quote-equal expectations for 18- and 6-decimal collateral.
- Assert events, actual token balances, tracked reserves, fees, constant product, and market backing after every trade.
- Test zero input, zero rounded output, missing approvals, insufficient balances, pre-init trades, and post-resolution trades.

### 6.7 Slippage tests

- For each trade direction, assert `minOut == quote` succeeds when reserves are unchanged.
- Assert `minOut == quote + 1` reverts atomically.
- Quote, execute an intervening price-moving trade, then prove the stale protected transaction reverts without balance/reserve changes.
- Test `minOut = 0` as permitted only when calculated output is nonzero.

### 6.8 Deadline tests

- Assert a deadline equal to the current block timestamp succeeds.
- Assert a deadline below the current block timestamp reverts in every trade direction.
- Advance time and prove a formerly valid signed transaction expires without changing balances or reserves.

### 6.9 Fee-on-transfer rejection tests

- Use adversarial collateral that transfers less than requested and assert market initialization reward funding, create, redeem/settle payout where detectable, AMM initialization, and buys revert.
- Use an adversarial outcome token/test double where feasible and assert AMM sells reject short receipt.
- Assert all failures are atomic: no mint, burn, reserve update, or retained partial balance.

### 6.10 UMA propose/settle tests

- Verify request parameters, reward, bond, liveness, event-based mode, and callback flags for both decimal classes.
- Reject unauthorized callback caller, wrong identifier, wrong ancillary data, wrong timestamp, and wrong refund.
- Test valid proposal/liveness/settlement and valid dispute/fresh timestamp/re-request behavior.
- Confirm oracle reward and bond amounts remain raw collateral units while proposed prices remain 1e18-scaled.

### 6.11 Settlement price 0 / 0.5e18 / 1e18 tests

- At `0`, YES pays zero and NO pays one raw collateral unit per raw token unit.
- At `5e17`, each side pays `floor(rawAmount / 2)` independently.
- At `1e18`, YES pays one raw collateral unit per raw token unit and NO pays zero.
- Run the full matrix for 18-decimal ARCT, 6-decimal USDC, and 6-decimal EURC, including `1`, odd, even, whole-token, and large raw amounts.
- Verify the current clamping/classification policy for values below zero, between canonical outcomes, and above `1e18` exactly matches the specified V1-compatible behavior.

### 6.12 Claim/redeem payout tests

- Settle YES-only, NO-only, balanced, and asymmetric holdings for multiple users.
- Verify each user's raw payout, burned balances, remaining supply, contract backing, and emitted event.
- Assert repeat claims fail through insufficient burned-token balance and cannot double-spend collateral.
- Verify pre-settlement pair redemption remains exact and post-settlement claim behavior remains solvent.

### 6.13 Rounding/dust tests

- Exhaustively test small raw amounts around fee and division boundaries, especially 1-10 units for 6-decimal tokens.
- Test odd split-settlement amounts, repeated micro-trades, skewed reserves, and near-empty reserves.
- Calculate expected floor rounding independently in tests and account for all residual dust.
- Assert dust is bounded, cannot be extracted through cycling, and never causes total payouts to exceed backing.

### 6.14 Frontend metadata compatibility tests

These are integration tests for the later compatibility phase, not Phase 5A transaction changes:

- Known V1 records select the V1 ABI and legacy metadata fallback; V2 records select V2 ABIs and signatures.
- V2 metadata is read from `contractVersion`, `collateralDecimals`, and `outcomeDecimals`; a mismatch blocks trading.
- ARCT formats with 18 decimals and USDC/EURC with 6 while raw transaction values remain unchanged.
- Unsupported or missing version/collateral metadata fails closed, and USDC/EURC flags remain disabled.

### 6.15 Supabase serialization tests

These are deferred integration tests for the later database phase:

- Persist and read both V1 and V2 version/decimal/address metadata without conflation.
- Serialize every raw amount as a decimal string and round-trip values above JavaScript's safe integer limit exactly.
- Reject invalid decimal values, mismatched V2 outcome/collateral decimals, unsupported versions, and malformed addresses.
- Confirm Supabase cache data never overrides contradictory onchain version or decimal truth.

### 6.16 Additional access-control and invariant tests

- Reject V2 market creation for a collateral missing from the ARCM or UMA allowlist.
- Verify only authorized administration can change the deployment allowlist and that changes emit events.
- Verify AMM construction rejects V1 markets, decimal mismatch, invalid token addresses, and excessive fees.
- Add fuzz/property tests for backing, supply, reserve/balance consistency, payout solvency, price bounds, and slippage atomicity across both decimal classes.

## 7. Implementation file plan

Exact planned files for the next and later phases:

### Phase 5A: contracts and contract tests only

- `contracts/EventBasedPredictionMarketV2.sol` — new decimal-safe market; V1 remains unchanged.
- `contracts/PredictionMarketAMMV2.sol` — new protected raw-unit AMM; V1 remains unchanged.
- `contracts/interfaces/IEventBasedPredictionMarketV2.sol` — shared typed V2 market interface for the AMM and integrations.
- `contracts/CollateralAllowlist.sol` — explicit default-deny deployment allowlist, if the factory does not own this mapping.
- `contracts/MarketV2Factory.sol` — recommended atomic market/AMM deploy-and-initialize flow.
- `contracts/test/MockERC20Decimals.sol` — configurable 18/6-decimal test collateral.
- `contracts/test/MockFeeOnTransferERC20.sol` — adversarial exact-transfer test token.
- `test/EventBasedPredictionMarketV1.regression.test.ts` — unchanged-behavior regression coverage.
- `test/EventBasedPredictionMarketV2.test.ts` — market metadata, allowlist, accounting, UMA, settlement, payout, and dust matrix.
- `test/PredictionMarketAMMV2.test.ts` — initialization, raw-unit trades, quotes, slippage, deadline, rounding, and invariant coverage.
- `test/MarketV2Factory.test.ts` — atomic initialization and access-control coverage if the factory design is adopted.

The repository currently has no top-level `test/` directory; Phase 5A will create it. Test helpers should remain inside the named test files unless repetition justifies a focused `test/helpers/marketV2Fixture.ts`.

### ABI generation after contract acceptance

- `artifacts/contracts/EventBasedPredictionMarketV2.sol/EventBasedPredictionMarketV2.json` — generated by Hardhat, not hand-edited.
- `artifacts/contracts/PredictionMarketAMMV2.sol/PredictionMarketAMMV2.json` — generated by Hardhat, not hand-edited.
- `artifacts/contracts/MarketV2Factory.sol/MarketV2Factory.json` — generated if the factory is adopted.
- The project's client ABI export location must be identified before integration; export only the reviewed V2 ABIs and keep V1 ABI selection available.

### Later deploy/create-market integration

- `scripts/deploy-v2.ts` — separate infrastructure/test deployment entry point if operationally required; do not repurpose `scripts/deploy.ts`.
- `app/api/create-market/route.ts` — later version-aware deployment routing, allowlist enforcement, and metadata persistence; no Phase 4B/5A edit.
- A new server-only V2 deployment module should encapsulate verified addresses and factory calls; its exact directory must be confirmed from the route's existing imports before creation.

### Later frontend compatibility layer

- A new version-aware contract adapter should select V1 versus V2 ABI/signatures and expose separate collateral/outcome decimals; its exact path must be chosen after inspecting the existing frontend contract modules.
- Existing Market Detail, Buy/Sell, Claim, and metadata consumers will later migrate to that adapter without changing V1 transaction semantics.
- Supabase migrations/types will later add `contract_version`, collateral metadata, and outcome decimals; no schema change belongs to Phase 5A.

## 8. Risks and open questions

### UMA collateral whitelist

Official UMA OO V2 support for each Arc collateral address must be verified on the target network. ARCM allowlisting is necessary but cannot substitute for UMA whitelist support. Clarify who controls the Finder/whitelist in production and the operational response if a token is removed.

### Official Arc USDC/EURC addresses

Official Arc Testnet and eventual production addresses must be verified from authoritative Circle/Arc configuration immediately before deployment. Addresses must be environment/network configured, not inferred from symbols or copied into production from test documentation. EURC availability must be verified independently from USDC.

### Decimals mismatch and mutable metadata

V2 assumes a collateral's `decimals()` is readable and stable. Decide whether to restrict supported decimals to exactly 6 or 18. A proxy token that changes decimals would break display assumptions even though stored market math remains raw-unit based; allowlisting must review proxy/admin risk.

### AMM rounding and economics

The V1 formula needs adversarial review for tiny trades, reserve accounting, fee retention, sell redemption, invariant behavior, and near-empty liquidity before it is adopted in V2. Decide whether V2 should preserve the formula exactly or introduce a separately reviewed arithmetic library. Specify protocol fee ownership and whether liquidity removal is in scope; neither should be invented during Phase 5A.

### Initialization and factory ownership

Choose the final factory/initializer trust model, allowlist administrator, upgrade policy, and ownership-transfer procedure. Atomic deployment is preferred because a public one-time initializer is unsafe. Contracts should be non-upgradeable unless a separate reviewed decision authorizes proxies.

### Vercel and environment security

Server-side collateral allowlists, factory addresses, RPC credentials, deployment keys, Supabase service keys, and release flags must remain server-only. No private or administrative value may use `NEXT_PUBLIC_`. Vercel preview/production environments need separate, least-privilege configuration and auditable release controls.

### CCTP/Gateway is separate

CCTP/Gateway deposit work is not part of Market V2 or AMM V2 and must have its own implementation and validation phase. A successful bridge/deposit must never imply that a collateral or V2 trading feature is enabled. No fake deposit success path is permitted.

### Open decisions required before Phase 5A completion

- Confirm registry versus factory-owned allowlist and its administrator.
- Confirm atomic factory deployment as the accepted AMM initialization model.
- Confirm whether supported collateral decimals are limited to 6 and 18.
- Approve the V2 AMM arithmetic/fee specification after invariant review.
- Confirm whether liquidity add/remove functions are explicitly out of scope or require a separate design.
- Verify official collateral and UMA infrastructure addresses for each target network; do not block local mock-based implementation on production address selection.

## Phase boundary

Phase 4B changes documentation only. It does not modify Solidity, deployment scripts, frontend transactions, create-market behavior, Supabase schema, collateral enablement, or CCTP/Gateway. Phase 5A is limited to implementing the V2 contracts and contract tests described above; later integration remains separately gated.
