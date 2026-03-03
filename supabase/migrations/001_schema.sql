-- families
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- users (extends auth.users)
create table users (
  id uuid primary key references auth.users on delete cascade,
  family_id uuid references families on delete set null,
  role text check (role in ('admin', 'member')),
  display_name text not null,
  created_at timestamptz default now()
);

-- accounts (wallets)
create table accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  type text not null,
  balance numeric not null default 0,
  created_at timestamptz default now()
);

-- categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  monthly_limit numeric,
  is_child_related boolean not null default false,
  created_at timestamptz default now()
);

-- transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  account_id uuid not null references accounts on delete cascade,
  category_id uuid references categories on delete set null,
  user_id uuid not null references users on delete cascade,
  amount numeric not null,
  type text not null check (type in ('in', 'out', 'transfer')),
  receipt_url text,
  is_reconciled boolean not null default false,
  is_private boolean not null default false,
  date date not null default current_date,
  merchant text,
  notes text,
  created_at timestamptz default now()
);

-- market_rates (global, no family scope)
create table market_rates (
  asset_code text primary key,
  asset_type text not null check (asset_type in ('gold', 'stock', 'mutual_fund')),
  buy_price numeric not null,
  sell_price numeric not null,
  updated_at timestamptz default now()
);

-- investments
create table investments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  asset_code text not null references market_rates on delete cascade,
  qty numeric not null,
  avg_buy_price numeric not null,
  created_at timestamptz default now()
);

-- gamification
create table gamification (
  family_id uuid primary key references families on delete cascade,
  current_points integer not null default 0,
  rewards_catalog jsonb not null default '[]'::jsonb
);

-- invites
create table invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  created_by uuid not null references users on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz default now()
);
