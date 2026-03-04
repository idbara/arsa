-- Phase 6: RLS policies for gamification tables

-- Enable RLS
alter table point_rules enable row level security;
alter table point_events enable row level security;
alter table rewards enable row level security;
alter table reward_redemptions enable row level security;
alter table gamification enable row level security;

-- point_rules: family members can read, admin can write
create policy "family can view point_rules"
  on point_rules for select
  using (family_id = (select family_id from users where id = auth.uid()));

create policy "admin can manage point_rules"
  on point_rules for insert
  to authenticated
  with check (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

create policy "admin can update point_rules"
  on point_rules for update
  using (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

create policy "admin can delete point_rules"
  on point_rules for delete
  using (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

-- point_events: family can read (Worker writes via SERVICE_ROLE_KEY)
create policy "family can view point_events"
  on point_events for select
  using (family_id = (select family_id from users where id = auth.uid()));

-- rewards: family can read, anyone can propose, admin can update status
create policy "family can view rewards"
  on rewards for select
  using (family_id = (select family_id from users where id = auth.uid()));

create policy "family members can propose rewards"
  on rewards for insert
  to authenticated
  with check (
    family_id = (select family_id from users where id = auth.uid())
    and proposed_by = auth.uid()
  );

create policy "admin can update rewards"
  on rewards for update
  using (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

-- reward_redemptions: family can read, members can insert own redemptions
create policy "family can view redemptions"
  on reward_redemptions for select
  using (family_id = (select family_id from users where id = auth.uid()));

create policy "members can redeem rewards"
  on reward_redemptions for insert
  to authenticated
  with check (
    family_id = (select family_id from users where id = auth.uid())
    and redeemed_by = auth.uid()
  );

create policy "admin can update redemptions"
  on reward_redemptions for update
  using (
    family_id = (select family_id from users where id = auth.uid())
    and (select role from users where id = auth.uid()) = 'admin'
  );

-- gamification: family can read (Worker writes via SERVICE_ROLE_KEY)
create policy "family can view gamification"
  on gamification for select
  using (family_id = (select family_id from users where id = auth.uid()));
