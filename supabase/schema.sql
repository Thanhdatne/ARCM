-- ARCM Supabase schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.world_cup_deployments (
  world_cup_market_id text primary key,
  fixture_id text not null,
  "group" text not null,
  question text not null,
  outcome_type text not null check (outcome_type in ('home_win', 'draw', 'away_win')),
  market_address text not null unique,
  amm_address text not null,
  created_at timestamptz,
  tx_hash text,
  transaction_hash text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_world_cup_deployments_fixture
  on public.world_cup_deployments (fixture_id);

create index if not exists idx_world_cup_deployments_outcome
  on public.world_cup_deployments (outcome_type);

create table if not exists public.world_cup_results (
  fixture_id text primary key,
  home_team text not null,
  away_team text not null,
  home_score integer,
  away_score integer,
  status text not null check (status in ('pending', 'final', 'postponed', 'cancelled')),
  result text check (result in ('home_win', 'draw', 'away_win')),
  source text,
  result_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_world_cup_results_status
  on public.world_cup_results (status);

create table if not exists public.world_cup_market_status (
  market_address text primary key,
  world_cup_market_id text,
  fixture_id text not null,
  outcome_type text not null,
  oracle_status text not null default 'unknown',
  winning_side text,
  proposed_tx_hash text,
  settled_tx_hash text,
  proposed_at timestamptz,
  settled_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_world_cup_market_status_fixture
  on public.world_cup_market_status (fixture_id);

create index if not exists idx_world_cup_market_status_oracle
  on public.world_cup_market_status (oracle_status);

create table if not exists public.claimable_cache (
  wallet_address text not null,
  market_address text not null,
  amm_address text not null,
  world_cup_market_id text,
  fixture_id text,
  "group" text,
  title text not null,
  winning_side text not null,
  claim_long_amount numeric(78,0) not null default 0,
  claim_short_amount numeric(78,0) not null default 0,
  payout_amount numeric(78,0) not null default 0,
  yes_balance numeric(78,0) not null default 0,
  no_balance numeric(78,0) not null default 0,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (wallet_address, market_address)
);

create index if not exists idx_claimable_cache_wallet
  on public.claimable_cache (wallet_address);

create index if not exists idx_claimable_cache_updated
  on public.claimable_cache (updated_at desc);

create table if not exists public.resolver_runs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  fixture_id text,
  proposed_count integer not null default 0,
  settled_count integer not null default 0,
  failed_count integer not null default 0,
  details jsonb,
  created_at timestamptz not null default now()
);

-- This setup is server-only. Keep SUPABASE_SERVICE_ROLE_KEY on the server.
-- Do not expose service_role to the browser.
alter table public.world_cup_deployments enable row level security;
alter table public.world_cup_results enable row level security;
alter table public.world_cup_market_status enable row level security;
alter table public.claimable_cache enable row level security;
alter table public.resolver_runs enable row level security;
