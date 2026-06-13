# ArcSignal Design System

ArcSignal should feel like an institutional dark prediction market exchange: onchain-first, fast, trustworthy, dense, and clean.

## Design Principles

- Lead with real market function: create, trade, resolve, redeem.
- Treat every visual element as interface, not decoration.
- Use dense information hierarchy with readable market questions and compact metadata.
- Keep preview/mock content visibly separated from onchain data.
- Avoid crypto landing-page composition, oversized heroes, decorative gradients, and vague promotional copy.

## Color Roles

- App background: near-black charcoal, used for the page shell.
- Primary surface: layered dark panels around `#0f151f` and `#101722`.
- Secondary surface: darker inset rows around `#0b111a` and `#0d141e`.
- Borders: cool slate borders with enough contrast to define panels.
- Arc cyan: primary accent, focus, active navigation, network status, and system labels.
- Emerald: YES, positive, claimable, successful states.
- Rose: NO, negative, disputed, losing states.
- Amber: warning, resolving, pending setup, preview disclaimers.
- Muted text: cool gray for metadata, labels, and non-primary explanations.

## Typography Rules

- Use compact headings. Reserve large type for true page titles only.
- Market questions are the dominant text in cards and detail views.
- Use small uppercase labels for metadata, but do not overuse badges.
- Use tabular numbers for odds, balances, prices, volumes, and amounts.
- Keep explanatory copy short and literal.

## Component Rules

- AppShell: fixed dark exchange frame, no marketing background art.
- Sidebar: active MVP links first; disabled future routes clearly marked Coming Soon.
- Topbar: search, Arc Testnet status, real RainbowKit wallet connect.
- Panels: use sharp cards with subtle visible borders and restrained shadows.
- Market cards: compact, onchain status clear, YES/NO areas prominent, no fake stats.
- Trading panel: preserve real hooks; style only. Approval, buy/sell, resolve, and redeem actions must remain real.
- Portfolio and Claims: show real wallet state or empty states. Do not invent wallet data.
- Privacy Preview: must always say preview/mock only and current positions are public.

## Motion Rules

- Use subtle hover border changes.
- Card lift should be 1px or less.
- Buttons may use press feedback through `active:translate-y-px`.
- Avoid continuous animation except essential loading/skeleton states.
- Avoid glow-heavy hover effects.

## What To Avoid

- Random gradients, bokeh, glowing blobs, or decorative backgrounds.
- Oversized dashboards with fake totals.
- Mock markets presented as real markets.
- Too many badges competing with the market question.
- Vague claims such as "private trading" when current Arc Testnet positions are public.
- Frontend-only data driving settlement or payout language.
- External-market integrations inside the primary onchain trading flow.

## Keeping Future UI From Looking AI-Generated

- Start each screen from the user's task, not from a hero section.
- Ask whether a card contains an action, state, or decision. Remove it if it does not.
- Prefer one strong information table/list over several decorative panels.
- Use exact labels: `ARCT test collateral`, `Arc Testnet USDC gas`, `UMA Optimistic Oracle V2 / sample flow`.
- Separate preview examples under clear "not onchain" labels.
- Keep color accents functional: cyan for system, emerald for YES, rose for NO, amber for pending/risk.
- Before shipping, scan for fake numbers, duplicated badges, and gradients that do not encode meaning.
