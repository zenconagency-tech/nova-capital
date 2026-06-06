-- ============================================================================
-- Nova Capital — Supabase / PostgreSQL schema
-- Stage 2: full auth + admin + withdrawals.
--
-- If you have an earlier version of the schema, drop the old tables first:
--   drop table if exists public.transactions cascade;
--   drop table if exists public.password_reset_tokens cascade;
--   drop table if exists public.email_verification_tokens cascade;
--   drop table if exists public.holdings cascade;
--   drop table if exists public.watchlist cascade;
--   drop table if exists public.portfolios cascade;
--   drop table if exists public.users cascade;
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  full_name       text,
  email           text unique not null,
  password_hash   text not null,
  email_verified  boolean not null default false,
  is_restricted   boolean not null default false,
  account_tier    text not null default 'free' check (account_tier in ('free','pro','elite')),
  balance         numeric(18, 2) not null default 0.00,
  avatar_url      text,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (lower(email));

-- ---------------------------------------------------------------------------
-- withdrawals
-- ---------------------------------------------------------------------------
create table if not exists public.withdrawals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  amount        numeric(18, 2) not null check (amount > 0),
  status        text not null default 'pending'
                check (status in ('pending','approved','on_hold','rejected','restored')),
  notes         text,
  method        text,                 -- e.g. 'bank_transfer', 'crypto', 'paypal'
  destination   text,                 -- wallet addr, account number, etc.
  requested_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists withdrawals_user_idx   on public.withdrawals (user_id);
create index if not exists withdrawals_status_idx on public.withdrawals (status);

-- ---------------------------------------------------------------------------
-- email_tokens  (unified verification + password_reset)
-- ---------------------------------------------------------------------------
create table if not exists public.email_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  token       text not null unique,
  type        text not null check (type in ('verification','password_reset')),
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists email_tokens_user_idx on public.email_tokens (user_id);
create index if not exists email_tokens_token_idx on public.email_tokens (token);

-- ---------------------------------------------------------------------------
-- admin
-- (seeded by the Node server on first boot — see server.js)
-- ---------------------------------------------------------------------------
create table if not exists public.admin (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- site_settings  (key-value store, JSONB for structured values)
--   maintenance_mode  : boolean
--   hero_headline     : string
--   hero_subtext      : string
--   market_categories : jsonb  (array of category keys: crypto, stock, future, forex, commodity)
--   pricing_plans     : jsonb  (array of { id, name, price, period, description, features[], featured })
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Default settings (only inserted if missing)
insert into public.site_settings (key, value) values
  ('maintenance_mode',  'false'::jsonb),
  ('hero_headline',     '"Invest in <span class=\"grad\">everything</span>.<br/>Own your financial future."'::jsonb),
  ('hero_subtext',      '"Trade crypto, stocks, futures, forex and commodities from one premium dashboard. Zero commission. Real-time analytics. AI-powered insights — built for serious investors."'::jsonb),
  ('market_categories', '["crypto","stock","future","forex","commodity"]'::jsonb),
  ('pricing_plans',     '[
    {
      "id": "free",
      "name": "Free",
      "tier": "For curious investors",
      "price": 0,
      "period": "month",
      "description": "Get started with the basics. Trade small, learn fast.",
      "features": ["Basic portfolio tracking", "Market data, 15-min delay", "Up to 5 watchlist symbols", "Community support"],
      "featured": false,
      "cta": "Get started"
    },
    {
      "id": "pro",
      "name": "Pro",
      "tier": "For active traders",
      "price": 29,
      "period": "month",
      "description": "Real-time data, advanced tools, zero commission.",
      "features": ["Real-time market data", "Unlimited watchlist", "AI-powered insights", "Advanced charting (50+ indicators)", "Zero commission trading", "Priority email support"],
      "featured": true,
      "cta": "Start 14-day trial"
    },
    {
      "id": "elite",
      "name": "Elite",
      "tier": "For pros & institutions",
      "price": 99,
      "period": "month",
      "description": "Everything in Pro, plus pro-grade tools and concierge service.",
      "features": ["Everything in Pro", "Margin & futures trading", "Algorithmic order routing", "Dedicated account manager", "API access", "24/7 phone support"],
      "featured": false,
      "cta": "Contact sales"
    }
  ]'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- holdings — user's portfolio positions (no separate "portfolios" table;
--              balance lives on users and is set by admin).
-- ---------------------------------------------------------------------------
create table if not exists public.holdings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  symbol        text not null,
  asset_class   text not null check (asset_class in ('crypto','stock','future','forex','commodity')),
  quantity      numeric(24, 8) not null default 0,
  avg_cost      numeric(24, 8) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists holdings_user_idx on public.holdings (user_id);

-- ---------------------------------------------------------------------------
-- watchlist
-- ---------------------------------------------------------------------------
create table if not exists public.watchlist (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  symbol       text not null,
  asset_class  text not null,
  created_at   timestamptz not null default now(),
  unique (user_id, symbol)
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'users_set_updated_at') then
    create trigger users_set_updated_at before update on public.users
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'withdrawals_set_updated_at') then
    create trigger withdrawals_set_updated_at before update on public.withdrawals
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'holdings_set_updated_at') then
    create trigger holdings_set_updated_at before update on public.holdings
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'site_settings_set_updated_at') then
    create trigger site_settings_set_updated_at before update on public.site_settings
      for each row execute function public.set_updated_at();
  end if;
end$$;
