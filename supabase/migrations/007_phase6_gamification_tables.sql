-- Phase 6: Gamification tables

-- point_rules: defines how points are earned
create table point_rules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  rule_type text not null check (rule_type in ('budget_discipline', 'daily_logging', 'savings_milestone', 'custom_challenge')),
  name text not null,
  description text,
  points_value integer not null default 10,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid not null references users on delete cascade,
  created_at timestamptz default now()
);

-- point_events: audit log of every point change
create table point_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  user_id uuid not null references users on delete cascade,
  rule_id uuid references point_rules on delete set null,
  points integer not null,
  description text not null,
  month date not null,
  created_at timestamptz default now()
);

-- rewards: catalog with approval workflow
create table rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  description text,
  point_cost integer not null,
  proposed_by uuid not null references users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references users on delete set null,
  created_at timestamptz default now()
);

-- reward_redemptions: tracks who redeemed what
create table reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  reward_id uuid not null references rewards on delete cascade,
  redeemed_by uuid not null references users on delete cascade,
  points_spent integer not null,
  redeemed_at timestamptz default now(),
  fulfilled boolean not null default false
);

-- gamification: per-user running totals and streaks
create table gamification (
  family_id uuid not null references families on delete cascade,
  user_id uuid not null references users on delete cascade,
  current_points integer not null default 0,
  streak_days integer not null default 0,
  last_log_date date,
  primary key (family_id, user_id)
);

-- indexes for common queries
create index idx_point_events_family_month on point_events (family_id, month);
create index idx_point_events_user_month on point_events (user_id, month);
create index idx_point_rules_family on point_rules (family_id);
create index idx_rewards_family_status on rewards (family_id, status);
create index idx_reward_redemptions_family on reward_redemptions (family_id);

-- unique constraint: prevent duplicate point awards for same rule+user+month
create unique index idx_point_events_dedup on point_events (rule_id, user_id, month) where rule_id is not null;
