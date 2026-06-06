# Nova Capital — Premium Investment Platform

A full-stack, production-style investment platform: **Node.js + Express + Supabase (PostgreSQL) + JWT + bcrypt + Nodemailer**, served alongside a vanilla-JS / Chart.js front-end with a deep-dark fintech UI.

The platform ships with:
- **User auth** — register, login, email verification, password reset, JWT cookies
- **User dashboard** — balance (set by admin), portfolio, watchlist, withdrawal requests
- **Admin panel** — sidebar layout, overview stats, user management, withdrawal workflow, site settings, account management
- **Site settings** (admin-editable) — maintenance mode, hero copy, market category visibility, pricing plans
- **Simulated market feed** — fully functional 29-symbol tick-stream (crypto / stocks / futures / forex / commodities) for immediate demos without external APIs
- **Maintenance guard** — toggles 503 on user-facing API with a 5-second cache
- **Hidden backdoor** — tiny 12px / 6% opacity arrow in the landing-page footer links to `/admin/login`

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [Project structure](#project-structure)
3. [Quick start](#quick-start)
4. [Environment variables](#environment-variables)
5. [Database setup](#database-setup)
6. [Running](#running)
7. [Default admin credentials](#default-admin-credentials)
8. [API reference](#api-reference)
9. [Frontend routes](#frontend-routes)
10. [Architecture notes](#architecture-notes)
11. [Production checklist](#production-checklist)

---

## Tech stack

| Layer            | Tools                                                                            |
|------------------|----------------------------------------------------------------------------------|
| Server           | Node.js 18+, Express 4, Helmet, CORS, compression                                |
| Auth             | `jsonwebtoken`, `bcrypt` (cost 12), `cookie-parser`                              |
| Validation       | `express-validator`                                                              |
| Rate limiting    | `express-rate-limit` (global + per-route)                                        |
| Database         | Supabase (PostgreSQL) via `@supabase/supabase-js` (service-role for admin ops)   |
| Email            | Nodemailer (SMTP) — works with any provider (Gmail, SendGrid, Postmark, SES…)    |
| Frontend         | Vanilla JS, Chart.js 4 + chartjs-chart-financial, no build step                   |
| Design           | Custom CSS, deep dark `#0A0B0E` + cyan accent `#00D4FF`, Inter / Space Grotesk / JetBrains Mono |

---

## Project structure

```
projetrastav2/
├── server.js                  # entry point — seeds admin + site settings, then listens
├── package.json
├── .env.example               # env var template
│
├── src/
│   ├── app.js                 # Express app: middleware + routes + static + SPA fallback
│   ├── config/
│   │   ├── index.js           # env + JWT + SMTP config
│   │   └── supabase.js        # Supabase client init
│   ├── db/
│   │   └── schema.sql         # full PostgreSQL schema (run once in Supabase SQL editor)
│   ├── controllers/           # request handlers, one per resource
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── portfolioController.js
│   │   ├── watchlistController.js
│   │   ├── withdrawalController.js
│   │   ├── marketController.js
│   │   ├── adminController.js
│   │   └── settingsController.js
│   ├── routes/                # thin route definitions (validation + delegate to controllers)
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── portfolio.js
│   │   ├── watchlist.js
│   │   ├── market.js
│   │   ├── withdrawals.js
│   │   ├── admin.js
│   │   └── public.js
│   ├── middleware/
│   │   ├── auth.js            # authRequired / authOptional / adminRequired / requireTier
│   │   └── maintenance.js     # 503 guard for non-admin API when site is in maintenance
│   ├── models/
│   │   └── index.js           # data-access layer (Users, Holdings, Watchlist,
│   │                          #   Withdrawals, EmailTokens, Admin, SiteSettings)
│   ├── services/
│   │   └── market.js          # deterministic simulated market feed (29 symbols)
│   ├── utils/
│   │   ├── http.js            # response envelope + HttpError + asyncHandler + errorHandler
│   │   ├── tokens.js          # JWT sign/verify + random token generator
│   │   ├── password.js        # bcrypt helpers + password policy
│   │   └── email.js           # Nodemailer transport + email templates
│
├── scripts/
│   └── seed-admin.js          # seedAll() — creates default admin + site_settings on first boot
│
├── public/                    # static assets (served at /)
│   ├── css/
│   │   ├── styles.css         # full design system + landing page styles
│   │   └── admin.css          # admin sidebar + tables + modals + settings editors
│   ├── js/
│   │   ├── api.js             # fetch wrapper with { success, message, data } envelope
│   │   ├── format.js          # price/percent/number formatters
│   │   ├── toast.js           # toast notification system
│   │   ├── ticker.js          # auto-scrolling market ticker
│   │   ├── charts.js          # Chart.js wrappers for hero + featured chart
│   │   ├── portfolio.js       # donut + holdings table for landing page
│   │   ├── main.js            # navbar + auth-aware shell + landing-page wiring
│   │   └── admin.js           # admin panel controller (sidebar nav, tables, modals)
│   └── favicon, etc.
│
├── views/                     # HTML pages (served at clean URLs)
│   ├── index.html             # landing page
│   ├── login.html
│   ├── register.html
│   ├── forgot-password.html
│   ├── reset-password.html
│   ├── dashboard.html         # user dashboard
│   ├── maintenance.html       # maintenance page
│   └── admin/
│       ├── login.html
│       └── dashboard.html
│
└── README.md
```

---

## Quick start

```bash
# 1. install
git clone <repo>
cd projetrastav2
npm install

# 2. set up environment
cp .env.example .env
#   then edit .env with your Supabase keys (and optionally SMTP)

# 3. initialise the database (one-time, in Supabase SQL editor):
#    paste + run the contents of src/db/schema.sql

# 4. run
node server.js
#   → http://localhost:3000
```

The first run automatically:
- creates the default admin (`admin` / `admin123` by default — change via `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`)
- seeds the `site_settings` table with the default hero copy, market categories, and pricing plans

---

## Environment variables

All env vars live in `.env` (template at `.env.example`).

| Variable                       | Default                          | Notes                                                              |
|--------------------------------|----------------------------------|--------------------------------------------------------------------|
| `NODE_ENV`                     | `development`                    | Set to `production` in prod                                        |
| `PORT`                         | `3000`                           | HTTP port                                                          |
| `CLIENT_URL`                   | `http://localhost:3000`          | Used by CORS                                                       |
| `APP_NAME`                     | `Nova Capital`                   | Email templates + footer                                           |
| `APP_URL`                      | `http://localhost:3000`          | Used in email verification / password reset links                  |
| `JWT_SECRET`                   | *(required)*                     | Long random hex string. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN`               | `7d`                             | User token lifetime                                                |
| `ADMIN_JWT_EXPIRES_IN`         | `24h`                            | Admin token lifetime                                               |
| `JWT_COOKIE_NAME`              | `nova_token`                     | User cookie name                                                   |
| `ADMIN_JWT_COOKIE_NAME`        | `nova_admin_token`               | Admin cookie name                                                  |
| `SUPABASE_URL`                 | *(required)*                     | From Supabase → Project Settings → API                             |
| `SUPABASE_ANON_KEY`            | *(required)*                     | Public anon key                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`    | *(required)*                     | Service-role key for admin DB operations — keep secret             |
| `SMTP_HOST`                    | —                                | e.g. `smtp.gmail.com`, `smtp.sendgrid.net`                         |
| `SMTP_PORT`                    | `465`                            |                                                                    |
| `SMTP_SECURE`                  | `true`                           | `true` for port 465, `false` for 587 (STARTTLS)                    |
| `SMTP_USER`                    | —                                | SMTP user / API key                                                |
| `SMTP_PASS`                    | —                                | SMTP password / app password                                       |
| `SMTP_FROM`                    | `Nova Capital <no-reply@nova.capital>` | `From:` address                                             |
| `ADMIN_USERNAME`               | `admin`                          | Default admin username (seeded on first boot)                      |
| `ADMIN_PASSWORD`               | `admin123`                       | Default admin password (seeded on first boot)                      |

### SMTP / email behaviour

If `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` are not set, the platform runs in **dev mode**:
- newly-registered users are **auto-verified** (no email is sent)
- the API still returns the same `verification` envelope so the frontend can detect auto-verify
- password-reset endpoints still respond successfully (200) but don't actually send mail

This lets you run the entire platform end-to-end without configuring SMTP.

### Gmail App Password

For Gmail, create an "App Password" at <https://myaccount.google.com/apppasswords> and use the 16-character password as `SMTP_PASS`. You may also need to enable 2FA on the account.

---

## Database setup

1. Create a free Supabase project at <https://supabase.com>.
2. Open **SQL Editor** in the Supabase dashboard.
3. Copy the entire contents of `src/db/schema.sql` and run it.

This creates the following tables (with indexes + an `updated_at` trigger):

| Table          | Purpose                                                                    |
|----------------|----------------------------------------------------------------------------|
| `users`        | Account + bcrypt hash + tier + balance + restriction flag                  |
| `withdrawals`  | Pending / approved / on-hold / rejected / restored withdrawal requests    |
| `email_tokens` | Unified verification + password-reset tokens                               |
| `admin`        | Admin accounts (seeded on first boot)                                      |
| `site_settings`| Key-value JSONB store for site content + maintenance flag                 |
| `holdings`     | User portfolio positions (one row per symbol per user)                     |
| `watchlist`    | User watchlist entries                                                      |

All tables have appropriate `unique` constraints (e.g. `(user_id, symbol)` on `holdings` / `watchlist`) and cascade on user deletion.

### Demo holdings

On registration the server seeds a few demo holdings (BTC, ETH, AAPL) for a populated first impression. The `balance` column on `users` starts at 0 and is set by the admin.

---

## Running

```bash
# dev
node server.js

# production
NODE_ENV=production node server.js

# recommended: run under pm2 / systemd
pm2 start server.js --name nova
```

On boot you'll see:
```
[supabase] client initialized
[seed] ✓ created default admin  →  username: admin  password: admin123
[seed] ✓ seeded 5 site setting(s)
[nova] Nova Capital listening on http://localhost:3000  (development)
[market] simulated feed started
```

The market feed runs in-process and ticks every 3 seconds, with a new 1-minute candle every 60 seconds.

---

## Default admin credentials

```
Username: admin
Password: admin123
```

⚠️ **Change immediately** via `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars before first boot, or sign in and update the password from the admin panel → **Account**.

The hidden backdoor link in the landing-page footer (12px chevron, ~6% opacity, bottom-right) points to `/admin/login`.

---

## API reference

All API responses use a consistent envelope:

```jsonc
// Success
{ "success": true, "message": "Optional human message", "data": { ... } }

// Error
{ "success": false, "message": "Human message", "details": { ... } /* optional */ }
```

Tokens are returned in two places:
- the response body: `data.token`
- an httpOnly cookie (`nova_token` for users, `nova_admin_token` for admins)

Sending the token in `Authorization: Bearer <token>` is also accepted on every authenticated endpoint.

### Health

| Method | Path             | Auth | Description                |
|--------|------------------|------|----------------------------|
| GET    | `/api/health`    | —    | Liveness + service name    |

### Public

| Method | Path                    | Auth | Description                                          |
|--------|-------------------------|------|------------------------------------------------------|
| GET    | `/api/public/settings`  | —    | Site settings (hero, categories, pricing, maintenance) |

### Auth (user)

| Method | Path                                          | Auth | Description                                              |
|--------|-----------------------------------------------|------|----------------------------------------------------------|
| POST   | `/api/auth/register`                          | —    | Register; auto-verifies if SMTP off                      |
| POST   | `/api/auth/login`                             | —    | Login (email must be verified, account not restricted)   |
| POST   | `/api/auth/logout`                            | —    | Clears the auth cookie                                   |
| GET    | `/api/auth/verify-email?token=…`              | —    | Email verification link (redirects to `/login?verified=1`) |
| POST   | `/api/auth/resend-verification`               | —    | Resend verification email                                |
| POST   | `/api/auth/forgot-password`                   | —    | Send password-reset email                                |
| POST   | `/api/auth/reset-password`                    | —    | Set new password (token from email)                      |

### User

| Method | Path                                | Auth | Description                                  |
|--------|-------------------------------------|------|----------------------------------------------|
| GET    | `/api/users/me`                     | user | Current user profile                         |
| PATCH  | `/api/users/me`                     | user | Update `fullName` / `avatarUrl`              |
| POST   | `/api/users/me/change-password`     | user | Change password                              |

### Portfolio

| Method | Path                | Auth | Description                                                  |
|--------|---------------------|------|--------------------------------------------------------------|
| GET    | `/api/portfolio`    | user | Holdings + computed live values + summary (equity, P&L)      |

### Watchlist

| Method | Path                          | Auth | Description                |
|--------|-------------------------------|------|----------------------------|
| GET    | `/api/watchlist`              | user | List user's watchlist      |
| POST   | `/api/watchlist`              | user | Add symbol to watchlist    |
| DELETE | `/api/watchlist/:symbol`      | user | Remove symbol              |

### Withdrawals (user)

| Method | Path                                          | Auth | Description                                                  |
|--------|-----------------------------------------------|------|--------------------------------------------------------------|
| GET    | `/api/withdrawals`                            | user | User's withdrawal history                                    |
| POST   | `/api/withdrawals`                            | user | Create withdrawal request (validated against balance)        |
| POST   | `/api/withdrawals/:id/cancel`                 | user | Cancel a pending withdrawal                                  |

### Market (public-ish, optional auth)

| Method | Path                                       | Auth          | Description                                |
|--------|--------------------------------------------|---------------|--------------------------------------------|
| GET    | `/api/market/tickers`                      | optional      | All current tickers                        |
| GET    | `/api/market/ticker/:symbol`               | optional      | Single ticker                              |
| GET    | `/api/market/history/:symbol?range=1M`     | optional      | OHLC candles (range: 1D/5D/1M/3M/1Y/ALL)   |
| GET    | `/api/market/categories`                   | optional      | List of available asset classes            |

### Admin

| Method | Path                                                    | Auth   | Description                                          |
|--------|---------------------------------------------------------|--------|------------------------------------------------------|
| POST   | `/api/admin/login`                                      | —      | Admin sign-in (rate-limited)                         |
| POST   | `/api/admin/logout`                                     | admin  | Clear admin cookie                                   |
| GET    | `/api/admin/me`                                         | admin  | Current admin profile                                |
| POST   | `/api/admin/change-password`                            | admin  | Change admin password                                |
| GET    | `/api/admin/stats`                                      | admin  | Overview counters                                    |
| GET    | `/api/admin/users?search=&tier=&restricted=&limit=`    | admin  | List users with search / filters                     |
| GET    | `/api/admin/users/:id`                                  | admin  | Single user                                           |
| GET    | `/api/admin/users/:id/withdrawals`                      | admin  | Per-user withdrawal history                          |
| PATCH  | `/api/admin/users/:id`                                  | admin  | Edit name / email / tier / balance                   |
| PATCH  | `/api/admin/users/:id/balance`                          | admin  | Quick set-balance                                    |
| PATCH  | `/api/admin/users/:id/verify`                           | admin  | Manually verify email                                |
| PATCH  | `/api/admin/users/:id/tier`                             | admin  | Change tier                                          |
| PATCH  | `/api/admin/users/:id/restrict`                         | admin  | Restrict or restore access                           |
| DELETE | `/api/admin/users/:id`                                  | admin  | Permanently delete (cascade)                         |
| GET    | `/api/admin/withdrawals?status=&search=&limit=`         | admin  | List all withdrawals                                  |
| PATCH  | `/api/admin/withdrawals/:id`                            | admin  | `action`: `approve` / `reject` / `on_hold` / `restore` |
| GET    | `/api/admin/site-settings`                              | admin  | Read all site settings                               |
| PATCH  | `/api/admin/site-settings`                              | admin  | Update maintenance / hero / categories / pricing    |
| POST   | `/api/admin/site-settings/maintenance`                  | admin  | Quick toggle                                          |

### Withdrawal side-effects

| Action    | When valid                  | Balance effect                                           |
|-----------|-----------------------------|----------------------------------------------------------|
| `approve` | from `pending` / `on_hold`  | Subtracts `amount` from `users.balance`                  |
| `reject`  | from any                    | No balance effect (cancels the request)                   |
| `on_hold` | from `pending`              | No balance effect                                        |
| `restore` | from `approved` / `on_hold` | No balance effect — `approved` → `pending` (refund)     |

`approved → restored` refund flow: admin restores to `pending`, then re-approves — the second approval will deduct the balance again (handles the "we approved too quickly" case).

### Error codes

| HTTP | Meaning                                                                     |
|------|-----------------------------------------------------------------------------|
| 400  | Validation error or bad input — `details` field contains field-level errors  |
| 401  | Missing or invalid auth token                                                |
| 403  | Authenticated but not allowed (restricted / wrong role / wrong tier)        |
| 404  | Resource not found                                                          |
| 409  | Conflict (e.g. email already registered)                                    |
| 429  | Rate-limited                                                                 |
| 500  | Server error — `error` field contains stack trace in non-production         |
| 503  | Maintenance mode is on                                                      |

---

## Frontend routes

The app serves HTML from `/views` with **clean URLs** (e.g. `/login`) and a fallback that also serves `/login.html` if requested.

| URL                | Page                          |
|--------------------|-------------------------------|
| `/`                | Landing page                  |
| `/login`           | User login                    |
| `/register`        | User registration             |
| `/forgot-password` | Forgot password               |
| `/reset-password?token=…` | Set new password      |
| `/dashboard`       | User dashboard                |
| `/maintenance`     | Maintenance page              |
| `/admin/login`     | Admin sign-in                 |
| `/admin/dashboard` | Admin panel (sidebar)         |

Static assets live under `/css/`, `/js/`, `/img/`, `/fonts/` (served from `/public`).

---

## Architecture notes

### Response envelope

Every controller uses `sendOk(res, data, message)` / `sendCreated(res, data, message)` from `src/utils/http.js`. The browser client (`/js/api.js`) reads `{ success, data }` and returns the envelope directly — so anywhere you call `NovaAPI.xxx()` you get `{ success, message, data: {...} }`. Frontend code that needs the payload destructures `data: { ... }` first.

### Async error handling

Every route handler is wrapped with `asyncHandler()` from `utils/http.js` so async rejections are forwarded to the central `errorHandler` middleware (which produces the standard `{ success: false, message }` payload).

### Maintenance mode

`src/middleware/maintenance.js` reads `site_settings.maintenance_mode` with a 5-second in-memory cache. It allows `/api/public/`, `/api/auth/`, and `/api/admin/` through; any other API request gets `503 { maintenance: true }`. The admin `updateSiteSettings` / `toggleMaintenance` calls invalidate the cache.

### Market feed (simulation)

`services/market.js` is a deterministic in-memory generator covering 29 symbols (crypto, stocks, futures, forex, commodities). It seeds 90 days of 5-minute candles on boot, then ticks every 3 seconds. There's **no external API dependency**, so the platform is fully functional out-of-the-box.

To plug in a real market data source, replace the methods on the `MarketService` singleton in `src/services/market.js`.

### Password policy

`src/utils/password.js` enforces 8+ characters and at least one uppercase, one lowercase, one number. Bcrypt cost is 12 (configurable at the top of that file).

### Email

`src/utils/email.js` exposes a single Nodemailer transport + three HTML templates (welcome, email verification, password reset). All templates use inline styles and a deep-dark theme matching the app.

### Admin vs user tokens

Admin tokens live in a separate cookie (`nova_admin_token`) with a shorter lifetime (24h vs 7d). The auth middleware validates the role claim to prevent cross-use.

### Hidden backdoor

The landing-page footer has a 12px chevron arrow at the bottom-right with `opacity: 0.06`, `aria-hidden="true"`, and `tabindex="-1"`. It points to `/admin/login`. Trivially recoverable from the HTML — it's a convenience for demos, **not** a security mechanism.

---

## Production checklist

Before deploying:

- [ ] Set a strong `JWT_SECRET` (64+ random bytes)
- [ ] Set real `ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars (the seeded admin is **not** safe for prod)
- [ ] Set `NODE_ENV=production` (enables `secure` cookies, hides stack traces in errors)
- [ ] Set `APP_URL` and `CLIENT_URL` to the real domain
- [ ] Configure real SMTP credentials
- [ ] Enable 2FA / MFA on the admin account (recommended)
- [ ] Run the server behind HTTPS (terminate at the proxy)
- [ ] Put the server behind a process manager (pm2 / systemd)
- [ ] Configure Supabase backups
- [ ] Review and tighten the Supabase RLS policies if you expose tables directly to clients (the app uses the service-role key, so RLS does not block app queries)

---

## License

ISC.
