-- Apply after 20261019010000_managed_users.sql.
-- Bootstrap super admin only AFTER the Google identity has logged in once.
alter table public.apphub_members add column if not exists role text not null default 'viewer';
alter table public.apphub_members drop constraint if exists apphub_members_role_check;
alter table public.apphub_members add constraint apphub_members_role_check check (role in ('super_admin','admin','viewer'));
update public.apphub_members set role='admin' where user_id in (select user_id from public.admin_users) and role='viewer';
-- No browser-writable membership changes; administrator operations go through manage-users Edge Function.
-- BOOTSTRAP (run manually once in SQL Editor AFTER rishikarott@gmail.com authenticates):
-- insert into public.apphub_members(user_id,email,display_name,enabled,role)
-- select id,email,'Super Admin',true,'super_admin' from auth.users
-- where lower(email)='rishikarott@gmail.com'
-- on conflict(user_id) do update set enabled=true,role='super_admin',email=excluded.email;
-- insert into public.admin_users(user_id,email)
-- select id,email from auth.users where lower(email)='rishikarott@gmail.com'
-- on conflict(user_id) do update set email=excluded.email;
