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
  id                      uuid primary key default gen_random_uuid(),
  first_name              text,
  last_name               text,
  full_name               text,
  email                   text unique not null,
  password_hash           text not null,
  phone                   text,
  date_of_birth           date,
  street                  text,
  city                    text,
  state                   text,
  zip                     text,
  ssn_last4               text,
  employment_status       text check (employment_status in ('employed','self_employed','unemployed','student','retired')),
  annual_income           text check (annual_income in ('under_25k','25k_50k','50k_100k','100k_250k','250k_plus')),
  email_verified          boolean not null default false,
  is_restricted           boolean not null default false,
  account_tier            text not null default 'free' check (account_tier in ('free','pro','elite')),
  balance                 numeric(18, 2) not null default 0.00,
  avatar_url              text,
  last_login_at           timestamptz,
  application_status      text not null default 'approved' check (application_status in ('pending','approved','rejected')),
  application_submitted_at timestamptz,
  application_reviewed_at  timestamptz,
  application_reviewed_by  uuid references public.admin(id),
  rejection_reason         text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (lower(email));
create index if not exists users_application_status_idx on public.users (application_status);

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
  ]'::jsonb),
  ('deposit_wallets',   '{
    "bitcoin": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "ethereum": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "usdt": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "paypal_email": "payments@novacapital.com",
    "payoneer_email": "payments@novacapital.com"
  }'::jsonb),
  ('investment_roi',    '{"30": 5, "60": 12, "90": 22, "180": 40, "365": 60}'::jsonb)
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
-- deposits
-- ---------------------------------------------------------------------------
create table if not exists public.deposits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  amount        numeric(18, 2) not null check (amount > 0),
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  method        text not null,
  method_meta   jsonb,
  notes         text,
  requested_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists deposits_user_idx on public.deposits (user_id);
create index if not exists deposits_status_idx on public.deposits (status);

-- ---------------------------------------------------------------------------
-- investment_plans  (admin-managed tier definitions)
-- ---------------------------------------------------------------------------
create table if not exists public.investment_plans (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  min_amount    numeric(18, 2) not null default 100,
  max_amount    numeric(18, 2),
  daily_roi     numeric(5, 2) not null,
  duration_days integer not null,
  features      jsonb not null default '[]'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Seed default investment plans
insert into public.investment_plans (name, min_amount, max_amount, daily_roi, duration_days, features) values
  ('Starter', 500, 1999, 1.2, 30, '["Basic support", "Weekly reports"]'),
  ('Silver', 2000, 4999, 1.8, 60, '["Priority support", "Daily reports", "Auto-compounding"]'),
  ('Gold', 5000, 9999, 2.5, 90, '["Dedicated manager", "Daily reports", "Auto-compounding", "Referral bonus"]'),
  ('Platinum', 10000, 20000, 3.5, 180, '["VIP manager", "Real-time reports", "Auto-compounding", "Priority withdrawals", "Referral bonus"]')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- user_investments  (user investment records)
-- ---------------------------------------------------------------------------
create table if not exists public.user_investments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  plan_id         uuid references public.investment_plans(id),
  asset_label     text not null,
  amount          numeric(18, 2) not null check (amount > 0),
  duration_days   integer not null,
  expected_return numeric(18, 2) not null default 0,
  status          text not null default 'active'
                  check (status in ('active','completed','cancelled')),
  last_roi_at     timestamptz,
  roi_earned_so_far numeric(18, 2) not null default 0.00,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists user_investments_user_idx on public.user_investments (user_id);

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
  if not exists (select 1 from pg_trigger where tgname = 'deposits_set_updated_at') then
    create trigger deposits_set_updated_at before update on public.deposits
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'investment_plans_set_updated_at') then
    create trigger investment_plans_set_updated_at before update on public.investment_plans
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'user_investments_set_updated_at') then
    create trigger user_investments_set_updated_at before update on public.user_investments
      for each row execute function public.set_updated_at();
  end if;
end$$;
