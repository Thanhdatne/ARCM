
# ARCM Supabase migration pack

## 1. Install package

```powershell
cd C:\project\arcsignal-onchain
npm install @supabase/supabase-js
```

## 2. Create Supabase project

In Supabase Dashboard, create a project, then open SQL Editor and run:

```txt
supabase/schema.sql
```

## 3. Add local env

Add these to `.env.local`:

```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Do not use `NEXT_PUBLIC_` for the service role key. Do not commit it.

## 4. Seed current JSON data into Supabase

```powershell
node .\scripts\seed-supabase.mjs
```

## 5. Replace files

Copy:

```txt
lib/supabaseAdmin.ts
app/api/world-cup/claimable/route.ts
app/claims/page.tsx
```

## 6. Build

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
npm run dev
```

## What changes

- Claims uses Supabase cache first.
- Manual Refresh does a fresh onchain scan and rewrites Supabase cache.
- The UI hides debug scanned/settled numbers.
- The first load is faster after the cache exists.
