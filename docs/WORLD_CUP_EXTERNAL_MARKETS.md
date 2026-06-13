# World Cup External Markets

ArcSignal World Cup cards are external display cards by default. They are not
ArcSignal onchain markets, they are not tradable, and their odds or fixture data
must not determine payouts.

## Public Default

Keep public demos safe with:

```env
NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE=false
```

When the flag is false or missing:

- World Cup cards show `Coming soon on Arc`.
- Cards remain labeled `External Signal`, `Not Onchain`, and `Not Tradable`.
- Public users cannot deploy World Cup cards from the UI.
- Public market creation is limited because `/api/create-market` uses a
  server-side `PRIVATE_KEY`.

## Admin / Local Deployment

For local admin testing only:

```env
NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE=true
```

Then each World Cup card can show `Deploy on Arc`.

Admin deployment flow:

1. Open the homepage.
2. Find a World Cup external card.
3. Click `Deploy on Arc`.
4. The existing Create Market dialog opens.
5. The market question is prefilled from the World Cup card title.
6. The dialog displays `World Cup` category context and the settlement rule.
7. Submit the existing `/api/create-market` flow.
8. After deployment, ArcSignal refreshes the market list.
9. If the new market address is returned, that card shows `Trade on Arc`.

## Settlement Safety

External World Cup information is display-only until a market is deployed on
Arc. Even after deployment, payouts must settle through the ArcSignal onchain
resolver / UMA Optimistic Oracle V2 sample flow.

Do not use frontend odds, live scores, or external fixture data to directly
trigger settlement or payout.

## Onchain Status Labels

External card before deployment:

- `External Signal`
- `Not Onchain`
- `Not Tradable`
- `Coming soon on Arc`

Deployed card after admin creation:

- `External Signal`
- `Onchain on Arc`
- `Tradable`
- `Trade on Arc`

## Notes

The World Cup category is stored as market metadata when the admin deploy flow
passes `category: "World Cup"` to `/api/create-market`. The market contract
question remains the title used as UMA ancillary data.
