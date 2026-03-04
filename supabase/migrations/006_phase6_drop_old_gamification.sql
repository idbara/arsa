-- Phase 6: Drop the old single-row gamification table
-- It will be replaced by the new per-user gamification + supporting tables

drop policy if exists "family access" on gamification;
alter table gamification disable row level security;
drop table if exists gamification;
