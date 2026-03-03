-- Fix infinite recursion in RLS policies
-- All policies that subquery `users` table trigger the users SELECT policy,
-- which itself subqueries `users`, causing infinite recursion.
-- Fix: SECURITY DEFINER functions that bypass RLS.

create or replace function get_my_family_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select family_id from public.users where id = auth.uid()
$$;

create or replace function get_my_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.users where id = auth.uid()
$$;

-- Drop all existing policies that have the recursion issue

drop policy if exists "users can view own family" on families;
drop policy if exists "family members can view each other" on users;
drop policy if exists "family access" on accounts;
drop policy if exists "family access" on categories;
drop policy if exists "family access" on transactions;
drop policy if exists "family access" on investments;
drop policy if exists "family access" on gamification;
drop policy if exists "family members can view invites" on invites;
drop policy if exists "admin can create invites" on invites;

-- Recreate policies using the helper functions

create policy "users can view own family"
  on families for select
  using (id = get_my_family_id());

create policy "family members can view each other"
  on users for select
  using (family_id = get_my_family_id() or id = auth.uid());

create policy "family access"
  on accounts for all
  using (family_id = get_my_family_id());

create policy "family access"
  on categories for all
  using (family_id = get_my_family_id());

create policy "family access"
  on transactions for all
  using (family_id = get_my_family_id());

create policy "family access"
  on investments for all
  using (family_id = get_my_family_id());

create policy "family access"
  on gamification for all
  using (family_id = get_my_family_id());

create policy "family members can view invites"
  on invites for select
  using (family_id = get_my_family_id());

create policy "admin can create invites"
  on invites for insert
  to authenticated
  with check (
    family_id = get_my_family_id()
    and get_my_role() = 'admin'
  );
