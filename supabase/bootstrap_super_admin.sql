-- Run only AFTER signing in to AppHub via Google with rishikarott@gmail.com.
-- Do not execute against a different Supabase project.
insert into public.apphub_members(user_id,email,display_name,enabled,role)
select id,email,'Super Admin',true,'super_admin'
from auth.users where lower(email)='rishikarott@gmail.com'
on conflict(user_id) do update set email=excluded.email,enabled=true,role='super_admin',display_name='Super Admin';
insert into public.admin_users(user_id,email)
select id,email from auth.users where lower(email)='rishikarott@gmail.com'
on conflict(user_id) do update set email=excluded.email;
select email,role,enabled from public.apphub_members where lower(email)='rishikarott@gmail.com';
