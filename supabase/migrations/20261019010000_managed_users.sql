-- AppHub v1.1: invitation-only members and password access.
-- Run after 20261019000000_apphub.sql. Existing admin accounts get membership automatically.
create table if not exists public.apphub_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 display_name text not null default '',
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists apphub_members_email_lower_idx on public.apphub_members (lower(email));
insert into public.apphub_members(user_id,email,display_name)
select user_id,email,split_part(email,'@',1) from public.admin_users
on conflict (user_id) do nothing;
alter table public.apphub_members enable row level security;
revoke all on public.apphub_members from anon,authenticated;
grant select on public.apphub_members to authenticated;
create policy "members read own membership" on public.apphub_members for select to authenticated
 using(user_id=(select auth.uid()));

-- A valid Supabase Auth session alone no longer grants application access.
drop policy if exists "read published apps or admin apps" on public.applications;
drop policy if exists "admin inserts applications" on public.applications;
drop policy if exists "admin updates applications" on public.applications;
drop policy if exists "admin deletes applications" on public.applications;
drop policy if exists "admin reads access events" on public.access_events;
create policy "active members read available apps" on public.applications for select to authenticated
 using(exists(select 1 from public.apphub_members m where m.user_id=(select auth.uid()) and m.enabled)
 and (visibility='published' or exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()))));
create policy "active admins insert apps" on public.applications for insert to authenticated
 with check(created_by=(select auth.uid()) and exists(select 1 from public.admin_users a join public.apphub_members m on m.user_id=a.user_id where a.user_id=(select auth.uid()) and m.enabled));
create policy "active admins update apps" on public.applications for update to authenticated
 using(exists(select 1 from public.admin_users a join public.apphub_members m on m.user_id=a.user_id where a.user_id=(select auth.uid()) and m.enabled))
 with check(exists(select 1 from public.admin_users a join public.apphub_members m on m.user_id=a.user_id where a.user_id=(select auth.uid()) and m.enabled));
create policy "active admins delete apps" on public.applications for delete to authenticated
 using(exists(select 1 from public.admin_users a join public.apphub_members m on m.user_id=a.user_id where a.user_id=(select auth.uid()) and m.enabled));
create policy "active admins read events" on public.access_events for select to authenticated
 using(exists(select 1 from public.admin_users a join public.apphub_members m on m.user_id=a.user_id where a.user_id=(select auth.uid()) and m.enabled));
