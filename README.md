# AppHub v1.2 — private app launcher with managed users

A lightweight React application hosted on your personal GitHub Pages; your **existing Supabase project** provides PostgreSQL, Google OAuth, email/password authentication, and Edge Functions. AppHub tracks login/visit/launch attempts, timestamp, browser, OS, and approximate IP-derived location. Activity *inside* launched applications is **not tracked**.

> **Live Supabase setup (19 October 2026):** Project `bfmsoerewmiqianxmcck` (Shared Apps) has already received the AppHub tables, RLS policies, and `track-event` and `manage-users` Edge Functions. **DO NOT re-run the SQL migrations against this project.** Existing TablePing tables and RPC functions were not changed. The Edge Functions are already live and accept origin `https://rishikarot.github.io`. Google OAuth and Auth URL configuration require your manual dashboard setup. Super Admin bootstrap can run only after `rishikarott@gmail.com` first signs in using Google.

**GitHub Pages deployment settings:**
- `VITE_SUPABASE_URL` = `https://bfmsoerewmiqianxmcck.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_v8jc47i36pfQIkQ2gXC0MA_V0hWBld9`
- Supabase Auth **Site URL** = `https://rishikarot.github.io/apphub/`
- Supabase Auth **Redirect URLs** include `https://rishikarot.github.io/apphub/**`
- Google Cloud authorized redirect URI = `https://bfmsoerewmiqianxmcck.supabase.co/auth/v1/callback`
- GitHub repository: `rishikarot/apphub`; Settings → Pages → Source: GitHub Actions.

**Warning:** Disabling public signups in the shared Supabase project changes the behavior of other apps using this project's Auth. Check for existing integrations before changing global Auth settings. AppHub still denies access to anyone not present as an active AppHub member.

## Permissions

| Role | What they can do |
| --- | --- |
| **Super Admin** (`rishikarott@gmail.com`) | Full control: applications, activity logs, create users, change roles, enable/disable accounts, and password resets |
| Admin | Add/edit/delete applications, see all activity |
| Viewer | Sign in and launch published applications |

**No public account registration screen.** Auth users created by Google OAuth are not admitted until an active member record is created. AppHub has two login buttons: Google, or email + password. A newly created user gets a temporary password assigned by the Super Admin. Reset sets another temporary password; distribute passwords privately. Never commit passwords or service-role credentials to GitHub.

## 1. Database migrations (Supabase SQL Editor)

Run these SQL files **in order** from the project folder:

1. `supabase/migrations/20261019000000_apphub.sql`
2. `supabase/migrations/20261019010000_managed_users.sql`
3. `supabase/migrations/20261019020000_superadmin_roles.sql`

If AppHub v1 has already been configured, run **only migrations not yet applied**, in order. All exposed tables use row-level security. Only authenticated, active members can read apps; only Admins/Super Admins can change apps or read activity. Only the privileged Edge Function can manage users. Do not attempt to create Auth users directly from the browser.

## 2. Configure Supabase authentication

1. Supabase Dashboard → Authentication → Providers → **Google**. Configure Google OAuth Client ID and Secret in your Google Cloud Console. Set the Google OAuth authorized redirect URI to `https://PROJECT_REF.supabase.co/auth/v1/callback` (use exact value displayed in your Supabase dashboard).
2. Supabase Dashboard → Authentication → Providers → **Email**: enable email/password authentication. For invite-only behavior, **disable public email signups** in Authentication settings. Do **not** disable Email as a provider; managed credentials need it.
3. Authentication → URL Configuration: Site URL `https://YOUR_GITHUB_USERNAME.github.io/apphub/`; redirect allowlist `https://YOUR_GITHUB_USERNAME.github.io/apphub/**` and development `http://localhost:5173/**`.
4. For a Google OAuth consent screen in testing mode, include your authorized Google account among its test users.

**Note:** Google sign-in may provision an entry in `auth.users` even before authorization. AppHub strictly checks active membership before permitting access to application data. For tighter production controls, use an Auth Before User Created Hook or enforce provider allowlists where supported; the current MVP relies on AppHub-side membership checks.

## 3. Create the first Super Admin (one-time bootstrap)

Sign into AppHub once using Google with **`rishikarott@gmail.com`**. You may initially see **“Access not enabled”** — this is expected. Now go to Supabase Dashboard → SQL Editor and run:

```sql
insert into public.apphub_members(user_id,email,display_name,enabled,role)
select id,email,'Super Admin',true,'super_admin'
from auth.users where lower(email)='rishikarott@gmail.com'
on conflict(user_id) do update
set email=excluded.email,enabled=true,role='super_admin',display_name='Super Admin';

insert into public.admin_users(user_id,email)
select id,email from auth.users where lower(email)='rishikarott@gmail.com'
on conflict(user_id) do update set email=excluded.email;
```

Verify it was applied:

```sql
select m.email,m.role,m.enabled from public.apphub_members m
where lower(m.email)='rishikarott@gmail.com';
```

**Expected:** 1 row with `super_admin` and `true`. If zero, check that the Google sign-in created the Auth user with precisely that email. Return to AppHub and click **Check access again**. No default Super Admin password exists: Google login bootstraps the account. To use email/password with the same Super Admin account, set its password **once via Supabase Dashboard → Authentication → Users** using a strong, unique password; do not invent a default or store it in the repository.

There is no self-service UI to change, demote or disable the protected Super Admin account. A Supabase project owner with SQL/Service Role access necessarily remains able to administer the data outside AppHub.

## 4. Edge Functions

Install the Supabase CLI and run:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set APPHUB_ORIGIN=https://YOUR_GITHUB_USERNAME.github.io
supabase functions deploy track-event
supabase functions deploy manage-users
```

For both functions, **keep JWT verification enabled** (see `supabase/config.toml`). Hosted Supabase Edge Functions make project URL, legacy anon and service-role secret available server-side; never use the service key in the frontend or GitHub Secrets. `APPHUB_ORIGIN` must be just the origin (no trailing slash or `/apphub/`). Custom domains must update this environment variable.

`manage-users` validates the signed-in Supabase user against the *database role* `super_admin` and applies server-side Auth Admin API changes. Admins cannot call it. The Super Admin account cannot be disabled or reset using the AppHub user management interface itself.

**IP geolocation:** `track-event` uses the request's forwarding IP and sends it to third-party `ipwho.is` for approximate city/region/country. IP is not stored in AppHub. Location can be blank or inaccurate (VPNs, mobile carriers, proxies). Tell visitors this in a privacy notice and review whether the lookup service and data processing meet your requirements.

## 5. Local setup

Requirements: Node.js 20 or newer.

```bash
cp .env.example .env
# Edit .env with Supabase Project URL and publishable/legacy anon key only
npm install
npm run dev
```

Open the Vite URL. **Do not commit `.env`.** The public Supabase publishable key is safe in the frontend when tables are protected by RLS, but the service-role key must never be exposed.

## 6. Publish to your personal GitHub Pages

1. Create a personal GitHub repository called `apphub`.
2. Push this project to its `main` branch.
3. Under repository → Settings → Secrets and variables → Actions, set:
   - `VITE_SUPABASE_URL`: `https://PROJECT_REF.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: your **publishable** or legacy **anon** key (never service-role)
4. In Settings → Pages, set Source to **GitHub Actions**.
5. Push a commit or trigger the `Publish AppHub` workflow in Actions.
6. Visit `https://YOUR_GITHUB_USERNAME.github.io/apphub/`, and configure matching Supabase redirect URLs and `APPHUB_ORIGIN`.

The workflow uses the GitHub repository name as the Vite base path. If your repository has a different name, the resulting path changes accordingly. For a root custom domain, change the build `BASE_PATH` to `/`.

## 7. How to manage users

Sign in as `rishikarott@gmail.com` → **User management** → **Add user**. Provide name, email, role (Viewer or Admin) and temporary password (minimum 12 characters). Generate a random password when possible. You can later change role, enable/disable, and reset a password. Send their email/password over a **separate, secure channel**. The create function confirms email automatically because only the Super Admin may create accounts; avoid using unverified/typo email addresses.

* Disabling an account adds a Supabase Auth ban and updates membership; ongoing AppHub database requests are denied by RLS. Because distributed tokens may remain valid briefly in unrelated services, this is not a universal identity revocation mechanism.
* Role changes use both AppHub membership and the existing `admin_users` permissions. App data is secured server-side rather than by hidden buttons alone.
* For password resets the Super Admin sets a new temporary password; the application does not show existing passwords, and there is no email delivery integration. For a later phase, prefer emailed set-password/invite links and forced password updates.
* Avoid sending passwords in plaintext email/chat when possible, and ask users to change temporary passwords via a secure admin-assisted reset until a self-service change-password screen is built.

## 8. Verification checklist

1. Apply migrations; bootstrap the verified Super Admin account; refresh AppHub.
2. Admin user management screen appears only to the Super Admin. Existing Super Admin is protected.
3. Add a Viewer; sign in using email/password. Viewer sees published apps but cannot see user management, activity, or edit apps.
4. Add an Admin; verify that they can manage applications and read logs, but not manage accounts.
5. Disable one test user; verify that their session can no longer read application data. Re-enable and sign in again.
6. Set a temporary password, log out as the test account, and verify that the new password works.
7. Test Google OAuth login, application launch event, browser/OS, UTC timestamp and approximate geography.
8. Confirm you cannot insert audit events directly or update roles through the browser using an anon/publishable key.
9. Test Pages `/apphub/` build and Google OAuth callback on phone and desktop.

## Data protection and pilot limits

GitHub Pages serves the SPA publicly; **actual application data requires an authenticated and authorized Supabase request**. The activity log records who signed in, visits and launch attempts, browser/OS/device, server UTC time and approximate geolocation. It does not measure the destination's internal usage. Failures and interrupted network requests can cause audit gaps. The Admin dashboard shows the most recent 1,000 events. Add a privacy notice and define audit retention (90 days is a sensible initial policy), then set up a scheduled purge as usage grows.

This package is prepared for deployment but **not connected to your live GitHub or Supabase**. A full Vite build could not be completed in this environment because dependency installation timed out. Run `npm install && npm run build` locally or in GitHub Actions before accepting production use.
