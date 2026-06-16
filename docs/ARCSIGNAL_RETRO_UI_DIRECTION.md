# ARCM Retro UI Direction

ARCM now uses a clean retro onchain prediction market terminal style inspired by Windows 95-era financial software and dense exchange terminals.

## Retro Style Used

- Square corners across the app.
- Beveled outset panels for windows, cards, navigation, and buttons.
- Beveled inset panels for inputs, table cells, empty states, and read-only status blocks.
- Navy title bars for terminal sections and important panels.
- Silver/gray surfaces with black text for functional content.
- Compact mono/tabular typography for odds, balances, percentages, and market metadata.
- Table-like market cards with a dense question area and clear YES / NO pricing cells.

## What Was Removed Or Reduced

- Soft shadows.
- Rounded modern cards.
- Glassmorphism and glow effects.
- Large AI-dashboard style hero sections.
- Excessive gradients.
- Decorative badges and cards that did not support onchain actions.
- Fake markets presented as if they were real.

## What Remains Onchain-First

- Real RainbowKit wallet connect in the topbar.
- Real create market flow through the official sample app API.
- Real approval flow for ARCT test collateral.
- Real YES / NO trading through the existing AMM hooks.
- Real UMA Optimistic Oracle V2 / sample resolver flow.
- Real claim / redeem payout path through the existing market settlement flow.
- Real onchain markets are shown before preview examples.

## Preview / Mock Only

- Preview example market cards are explicitly labeled as not onchain.
- Privacy Preview remains mock UX only.
- Current Arc Testnet trades and positions are public.
- Future privacy support may be integrated when available.

## Guardrails

- Do not modify contracts for UI styling.
- Do not modify deployment scripts for UI styling.
- Do not replace trading hooks with mock behavior.
- Do not use external market data or sports data as settlement input.
- Keep ARCT labeled as test collateral.
- Keep Arc Testnet gas labeled as USDC.
- Keep UMA OO V2 / sample flow labels visible wherever settlement is discussed.

