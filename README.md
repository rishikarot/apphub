# AppHub 1.3 — Compact UI refresh for existing deployment

**Target:** `https://github.com/rishikarot/apphub` → `https://rishikarot.github.io/apphub/`

This is a **frontend update**. It uses your already-deployed Supabase project `bfmsoerewmiqianxmcck` with existing tables `applications`, `apphub_members`, `admin_users`, `access_events` and functions `manage-users`, `track-event`. **No SQL migrations, role changes, or function redeployments are needed.**

## Included

- Single-card email/password login (no Google sign-in button, no signup)
- Compact top navigation; role-based Apps, Activity, Users pages
- Light/Dark/System appearance, five accent colors, 12–18px font controls, density and grid/list view; saved in the browser
- SVG category icons across app cards and category chooser
- URL-based application field suggestions; known-domain catalog and hostname heuristics; blank fields filled, existing fields offered as suggestions
- Existing Super Admin user management (create, roles, disable/enable, password reset), activity tracking, CSV export

**Important:** URL detection in v1.3 is **local inference**, not live website metadata scraping. Browser-side cross-origin restrictions mean arbitrary remote titles/descriptions cannot be fetched reliably. No server-side URL fetcher has been added. The UI labels estimates accurately. The `icon` column stores a category slug for future use, but category SVG rendering uses `category`; legacy emoji rows remain readable via category icons.

## Replace your existing GitHub files

1. Download/unzip the package. Upload its **contents** (not the enclosing `apphub-release` folder) to the root of your existing repository `rishikarot/apphub`.
2. Commit changes to `main`. Keep `.github/workflows/deploy-apphub.yml` as the **only active Pages deploy workflow** to avoid deployment competition. Do not delete unrelated repo data without checking it.
3. GitHub repository Settings → Secrets and variables → Actions: ensure existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` secrets are set. The URL is `https://bfmsoerewmiqianxmcck.supabase.co`. Use your project's **public** publishable key; never a service-role key.
4. Repository Settings → Pages → Source = **GitHub Actions**.
5. Actions → `Publish AppHub` → Run workflow (or push to `main`); verify success. The build publishes `/dist`, with Vite base `/apphub/`.
6. Open `https://rishikarot.github.io/apphub/`, hard-refresh (`Cmd+Shift+R` on Mac), and sign in with your existing Supabase email/password. Super Admin remains `rishikarott@gmail.com`.

## Local tests

```sh
cp .env.example .env
# Add your public Supabase key to .env
npm install
npm run dev
npm run build
```

Local `vite dev` should be opened on the base path Vite reports (usually `http://localhost:5173/apphub/`). Existing Edge Functions have CORS restrictions allowing the production GitHub Pages origin, so activity/user-management functions may not work from localhost without an explicitly permitted local origin. Test those against the deployed site.

## Smoke test after deployment

- Login works with current email/password; no Google login visible.
- Super Admin sees three tabs. Admin sees Apps + Activity. Viewer sees Apps.
- App CRUD with existing Supabase tables; category/icon and visibility persist; URL field editable.
- URL suggestions fill blank name/category only and never replace existing values automatically.
- Activity loads and CSV exports; a launch triggers the existing tracking function.
- User creation/role change/disable/reset uses the existing `manage-users` function.
- Appearance/font/grid/list adapt to desktop/mobile; browser-local prefs persist through refresh.

## Known limits

- Approximate location is returned by the existing backend and may be unavailable.
- Login and launch audit is best-effort (network/browser failures may cause missing events).
- After opening an external app, no destination-level behavior is measured.
- Password recovery remains Admin-assisted; no public self-service reset.
- No secret credentials are bundled. Deploy before validating live Supabase actions.
