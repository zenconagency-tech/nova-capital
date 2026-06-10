# Nova Capital — Deploy Progress

**Last updated:** $(date -u +'%Y-%m-%d %H:%M UTC')
**Status:** ✅ Investment feature complete — ready to deploy

---

## ✅ Done

| Step | Detail |
|---|---|
| Code on GitHub | `https://github.com/zenconagency-tech/nova-capital` |
| Latest commit | `a8d455d — Restructure repo: move project to root for Render blueprint detection` |
| Repo structure | All Nova files at repo root (Render can read `render.yaml`) |
| `render.yaml` | At repo root, blueprint format with `env: node`, `startCommand: node index.js` |
| Supabase project | Created, **schema.sql pasted into SQL Editor** ✓ |
| Default admin | `admin` / (set in Render env `ADMIN_PASSWORD` on first deploy) |
| Admin password change | Built into admin panel → Account → Change Password (persists in DB) |

## 📋 To finish the deploy (next session)

### 1. Get the 3 Supabase values

In your Supabase dashboard:
- **Project Settings → API**
- Copy:
  - **Project URL** → `SUPABASE_URL`
  - **`anon` `public`** key → `SUPABASE_ANON_KEY`
  - **`service_role`** key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Click the Render deploy link

**https://render.com/deploy?repo=https://github.com/zenconagency-tech/nova-capital**

If it still doesn't auto-detect the blueprint:
- Sign in to Render with GitHub
- **New +** → **Blueprint** → connect `zenconagency-tech/nova-capital` → **Apply**

### 3. Fill in env vars in the Render form

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` |
| `ADMIN_PASSWORD` | **strong password you'll remember** (NOT `CHANGE_ME_NOW_8chars`) |
| `SMTP_HOST` *(optional)* | `smtp.gmail.com` (or leave blank) |
| `SMTP_USER` *(optional)* | your email |
| `SMTP_PASS` *(optional)* | app password (Gmail) or API key |

Skip SMTP for now — new users will be auto-verified. Add later from Environment tab.

### 4. Click Apply → wait for build (~3 min)

### 5. Smoke test on the live URL Render gives you

1. Landing page loads
2. Footer arrow → `/admin/login`
3. Login with `admin` / your-password
4. Admin panel loads (Users/Withdrawals/Settings/Account)
5. Register a new user → check Supabase Table Editor → `users` table has a row
6. Log in as that user → dashboard works

### 6. (Optional) Tighten security

- **Rotate the leaked GitHub PAT** at https://github.com/settings/tokens
  - Old token was shared in this chat — revoke it (it's the one with `repo` scope on `zenconagency-tech`)
  - Generate a new PAT with `repo` scope
  - Configure `git config --global credential.helper cache` so tokens aren't embedded in URLs
- **Upgrade Render** to Starter ($7/mo) to disable the 15-min sleep on free tier
- **Custom domain**: Render dashboard → your service → Settings → Custom Domain

---

## 🗂️ Reference

### Repo
- URL: https://github.com/zenconagency-tech/nova-capital
- Default branch: `main`
- Commits: 3 Nova Capital commits on top of 2 old Nexus commits (force-pushed clean)

### Supabase
- Project name: `nova-capital` (whatever you named it)
- Region: (whatever you chose)
- DB password: (saved locally — do not commit to repo)

### Render
- Service name: `nova-capital`
- Plan: Free (with sleep) → upgrade later
- Region: Oregon
- Branch: `main`
- Health check: `/api/health`

### Local dev
- Server runs on `localhost:3000`
- Start: `node server.js` (from repo root)
- Watch: `npx nodemon server.js`
- Without Supabase env vars: landing page + market feed work, all auth endpoints 500

### Key files
- `server.js` — entry point
- `index.js` — shim forwarding to server.js (for `node index.js` convention in render.yaml)
- `src/app.js` — Express middleware/routes/static/spa-fallback
- `src/config/` — env config + Supabase client
- `src/controllers/` — 8 controllers (auth, user, portfolio, watchlist, withdrawal, market, admin, settings)
- `src/routes/` — 8 route files
- `src/middleware/` — auth + maintenance
- `src/models/index.js` — data-access layer (498 lines, single file)
- `src/services/market.js` — simulated 29-symbol market feed
- `src/utils/` — http, tokens, password, email
- `src/db/schema.sql` — **already pasted in Supabase** ✓
- `scripts/seed-admin.js` — seeds default admin + site_settings on first boot
- `views/` — HTML pages
- `public/` — static assets (CSS/JS)
- `render.yaml` — Render blueprint config
- `Dockerfile` + `.dockerignore` — for Fly.io/Railway/Docker deploys
- `RENDER.md` — step-by-step Render deploy guide
- `README.md` — full project docs

### Admin password change
- UI: `/admin/login` → click **Account** in sidebar → fill form
- Persists in `admin.password_hash` in Supabase
- Survives redeploys
- The `ADMIN_PASSWORD` env var is read only on first boot

---

## 🔧 Investment Feature — Complete (June 2026)

### Changes made

| Layer | Change |
|-------|--------|
| **Schema** | Added `last_roi_at` + `roi_earned_so_far` columns to `user_investments` |
| **Model** | Added `findById`, `update`, `setStatus`, `cancel`, `listAll`, `listByUserWithPlan` to `UserInvestments` |
| **Controller** | `create` now validates planId (exists/active/min/max), deducts balance; added `cancel` method (refunds balance) |
| **Routes** | Added `POST /api/investments/:id/cancel` |
| **Admin** | Added `GET /api/admin/investments`, `GET /api/admin/users/:id/investments` |
| **Processor** | New `src/services/investmentProcessor.js` — runs every 60s, credits daily ROI, auto-completes after duration |
| **Frontend (user)** | "Investments" tab in dashboard — shows all investments with ROI earned, cancel button; invest modal now passes `planId` |
| **Frontend (admin)** | "User Investments" sidebar section — list all investments by status; user detail modal shows investment history + ROI earned |
| **API client** | Added `cancelInvestment`, `adminListInvestments`, `adminGetUserInvestments` |

### What each feature does now

1. **Investing** — user picks a plan, enters amount + duration, balance is deducted, plan min/max is enforced
2. **View investments** — user sees all their investments in the Investments tab with ROI earned so far
3. **Cancel** — user can cancel active investments; amount is refunded to balance
4. **Daily ROI** — background processor credits daily ROI to user balance every 24h per investment
5. **Auto-completion** — investments auto-complete after `duration_days` elapses
6. **Admin oversight** — full list with filters, per-user investment history in view modal

### Migration note (existing Supabase DB)
Run this in Supabase SQL Editor to add the new columns:
```sql
alter table public.user_investments
  add column if not exists last_roi_at timestamptz,
  add column if not exists roi_earned_so_far numeric(18, 2) not null default 0.00;
```
