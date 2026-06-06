# Deploying Nova Capital to Render

This is a 5-minute, zero-config deploy using Render's free tier.

## Option A — One-click deploy (recommended)

1. Go to: **<https://render.com/deploy?repo=https://github.com/zenconagency-tech/nova-capital>**
2. Render reads `render.yaml` and pre-fills the service config.
3. Click **Apply**.
4. The build will start automatically (`npm install` + `npm start`).
5. While the build runs, click into the service → **Environment** and add the 3 required values that aren't auto-generated:

   | Key                       | Where to find it                                          |
   |---------------------------|-----------------------------------------------------------|
   | `SUPABASE_URL`            | Supabase → Project Settings → API → Project URL           |
   | `SUPABASE_ANON_KEY`       | Supabase → Project Settings → API → `anon` `public` key   |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key  |

6. **Change `ADMIN_PASSWORD`** from the placeholder `CHANGE_ME_NOW_8chars` to something strong.
7. Render triggers a redeploy when env vars change. Wait for the green "Live" badge.
8. Open the service URL (something like `https://nova-capital.onrender.com`).

That's it — your app is live.

## Option B — Manual setup

1. Sign in to <https://render.com> with your GitHub account.
2. **New +** → **Web Service** → pick `zenconagency-tech/nova-capital`.
3. Render auto-detects the Node environment. Fill in:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free (sleeps after 15 min idle) or Starter ($7/mo, always-on)
4. Skip "Add a database" — we use Supabase, not Render Postgres.
5. **Advanced** → set **Health Check Path** to `/api/health`.
6. Add the env vars from the table above, then **Create Web Service**.

## Required: Supabase

The app will boot without Supabase, but DB-dependent endpoints will return `500`. To go fully live:

1. Sign up at <https://supabase.com> (free).
2. **New project** → pick a region → set a DB password.
3. **SQL Editor** → paste the entire `src/db/schema.sql` → **Run**.
4. **Project Settings → API** → copy the three values into Render env vars.
5. Trigger a manual redeploy in Render (Environment → save any var → "Manual Deploy").

## Optional: SMTP for real emails

Without SMTP configured, new users are auto-verified (so the dev experience still works end-to-end). To send real verification + password-reset emails:

| Key         | Value (Gmail example)        |
|-------------|------------------------------|
| `SMTP_HOST` | `smtp.gmail.com`             |
| `SMTP_PORT` | `465`                        |
| `SMTP_SECURE` | `true`                     |
| `SMTP_USER` | your-email@gmail.com         |
| `SMTP_PASS` | a 16-char **App Password** from <https://myaccount.google.com/apppasswords> (requires 2FA) |
| `SMTP_FROM` | `Nova Capital <no-reply@nova.capital>` |

For other providers (SendGrid, Postmark, Mailgun, AWS SES), see <https://nodemailer.com/smtp/well-known/>.

## Free tier notes

Render's free tier **spins down the service after 15 minutes of inactivity**. The first request after sleep takes 30+ seconds (cold start). The simulated market feed and 5-second maintenance cache are in-memory, so they reset on cold start — harmless for a demo, but if you need continuous availability, upgrade to the **Starter** plan ($7/mo) or set up an external uptime monitor (UptimeRobot etc.) to ping `/api/health` every 5 minutes.

## What Render sets automatically

- `APP_URL` — your service's public URL, used in email templates
- `NODE_ENV=production` — explicit in render.yaml, but Render also sets it
- HTTPS — Render auto-provisions and renews a Let's Encrypt cert
- `trust proxy: 1` is set in `src/app.js` so client IPs behind the LB work for rate limiting
- `secure: true` cookies fire because `config.isProduction === true`
- `helmet()` runs with `upgrade-insecure-requests` so any stray `http://` asset gets upgraded to `https://`

## What the first deploy does

1. `npm install` installs all 13 deps + nodemon (devDep).
2. `node server.js` starts the app.
3. `seedAll()` runs on boot:
   - Creates the default admin (username + password from env, or `admin` / `admin123` as fallback) — **if it doesn't already exist**.
   - Seeds 5 `site_settings` rows (maintenance, hero, categories, pricing, etc.) — **only missing keys are inserted** so re-deploys are idempotent.
4. `MarketService.start()` boots the simulated 29-symbol feed.

The landing page, admin login, and all static UI work immediately. Auth, portfolio, watchlist, withdrawals, and admin features all need Supabase configured.

## Custom domain

In Render dashboard → your service → **Settings** → **Custom Domain** → add `nova-capital.com` and follow the DNS instructions. Render auto-provisions the SSL cert.
