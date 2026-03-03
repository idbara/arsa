-- Enable RLS on all family-scoped tables
alter table families enable row level security;
alter table users enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table investments enable row level security;
alter table gamification enable row level security;
alter table invites enable row level security;

-- families: members can read their own family
create policy "users can view own family"
  on families for select
  using (id = (select family_id from users where id = auth.uid()));

-- families: any authenticated user can insert (creating a new family)
create policy "authenticated users can create family"
  on families for insert
  to authenticated
  with check (true);

-- users: can read other members in same family
create policy "family members can view each other"
  on users for select
  using (
    family_id = (select family_id from users where id = auth.uid())
    or id = auth.uid()
  );

-- users: can insert own row (registration)
create policy "users can insert own row"
  on users for insert
  to authenticated
  with check (id = auth.uid());

-- users: can update own row (joining family)
create policy "users can update own row"
  on users for update
  to authenticated
  using (id = auth.uid());

-- accounts: family access
create policy "family access"
  on accounts for all
  using (family_id = (select family_id from users where id = auth.uid()));

-- categories: family access
create policy "family access"
  on categories for all
  using (family_id = (select family_id from users where id = auth.uid()));

-- transactions: family access
create policy "family access"
  on transactions for all
  using (family_id = (select family_id from users where id = auth.uid()));

-- investments: family access
create policy "family access"
  on investments for all
  using (family_id = (select family_id from users where id = auth.uid()));

-- gamification: family access
create policy "family access"
  on gamification for all
  using (family_id = (select family_id from users where id = auth.uid()));

-- invites: family members can view invites for their family
create policy "family members can view invites"
  on invites for select
  using (family_id = (select family_id from users where id = auth.uid()));

-- invites: admin can create invites
create policy "admin can create invites"
  on invites for insert
  to authenticated
  with check (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

-- invites: allow reading by token for join flow (anyone authenticated)
create policy "anyone can read invite by token"
  on invites for select
  to authenticated
  using (true);

-- market_rates: public read for all authenticated users
alter table market_rates enable row level security;
create policy "authenticated users can read market rates"
  on market_rates for select
  to authenticated
  using (true);
