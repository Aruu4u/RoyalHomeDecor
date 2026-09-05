# Deploying to Vercel

One Vercel project, two independently built services, one domain.

```
royalhomedecor.vercel.app
│
├── /api/*   ──►  api service         luxury-furniture-backend    (FastAPI, Python)
├── /docs                             interactive API docs
└── /*       ──►  storefront service  luxury-furniture-frontend   (Vite, static)
```

The two never share a build. Vercel compiles each with its own framework,
dependencies and build step, then routes requests between them using the rewrites
in `vercel.json`. They only meet at the domain.

Because they share an origin, the browser makes **same-origin** requests to the API —
no CORS preflight, and `VITE_API_BASE_URL` can simply be `/api/v1`.

---

## Before you start

You need a Supabase project (you already have one) and the repository connected to
Vercel.

> **Vercel Services is in Beta.** If you hit a wall, the fallback is two separate
> Vercel projects — one per folder — with the frontend pointing at the backend's URL.
> That path is well-trodden but reintroduces CORS and a second domain.

---

## Step 1 — Get the pooled database URL

This is the step people skip, and it's the one that breaks under real traffic.

Each serverless instance is a separate process. If every instance opens its own
connection pool, ten instances at five connections each is fifty, against a Supabase
limit of roughly sixty on the smaller plans. You get intermittent
`too many clients` errors that never show up while you're testing alone.

In the Supabase dashboard: **Project Settings → Database → Connection string →
Transaction pooler**. It looks like this:

```
postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

Two changes before you use it:

1. Swap the scheme to `postgresql+asyncpg://`
2. Confirm the port is **6543** (transaction pooler), not 5432 (direct)

The app handles the rest. `DB_SERVERLESS` defaults to true on Vercel, which switches
the engine to `NullPool` and disables prepared statements — a transaction pooler hands
out a different backend connection per transaction, so a statement prepared on one is
missing on the next.

---

## Step 2 — Set the project framework to Services

**In Vercel: Project → Settings → Build and Deployment → Framework → `Services`.**

Nothing else in this guide works without it. If the framework is left on auto-detect,
Vercel ignores the `services` block entirely and tries to build the repository as a
single app.

---

## Step 3 — Environment variables

Add these in **Project → Settings → Environment Variables**. Apply them to Production,
Preview and Development unless noted.

### Backend

| Variable | Value |
|---|---|
| `DATABASE_URL` | The pooler URL from step 1, with `postgresql+asyncpg://` |
| `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `SUPABASE_ANON_KEY` | Your publishable / anon key |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `CORS_ORIGINS` | `https://YOUR-APP.vercel.app` |
| `RAZORPAY_KEY_ID` | Your key |
| `RAZORPAY_KEY_SECRET` | Your secret |
| `RAZORPAY_WEBHOOK_SECRET` | Your webhook secret |

`CORS_ORIGINS` is not strictly needed at same origin, but set it so nothing else is
accidentally allowed.

> `APP_ENV=production` disables `/docs`, `/redoc` and `/openapi.json`. That is
> deliberate — it stops the public enumerating your whole API surface. Set it to
> `staging` if you want the docs reachable while you test.

### Frontend

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `/api/v1` |
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your publishable key |

> **`VITE_*` variables are baked in at build time**, not read at runtime. Changing one
> means redeploying. And anything with a `VITE_` prefix ships to the browser and is
> readable by anyone — only ever put publishable keys there. The Supabase **service
> role** key must never appear in a `VITE_` variable.

---

## Step 4 — Run the migrations

Vercel has no start command, so `alembic upgrade head` cannot run on deploy the way it
does in `render.yaml`. Run it yourself, pointed at the production database:

```bash
cd luxury-furniture-backend

# Use the DIRECT connection (port 5432) for migrations, not the pooler.
# DDL in transaction-pooled mode is unreliable.
set DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres

venv\Scripts\python.exe -m alembic upgrade head
```

Then confirm the schema landed:

```bash
venv\Scripts\python.exe scripts\verify_reviews_schema.py
```

**Do this before the first deploy, and after any migration you add.** Forgetting it
means the API starts fine and then fails on the first query touching a new column.

---

## Step 5 — Deploy

Push to `main`, or run `vercel --prod`. Vercel builds both services and serves them
from one URL.

---

## Step 6 — Verify

```bash
# API is alive
curl https://YOUR-APP.vercel.app/api/v1/health/live

# Real data through the pooled connection
curl "https://YOUR-APP.vercel.app/api/v1/products?limit=3"

# Offers, reviews
curl https://YOUR-APP.vercel.app/api/v1/offers/sections
```

In a browser, check all four:

- [ ] Home page loads with products and images
- [ ] **Open `/shop` directly, then refresh it.** This is the classic SPA failure — if
      it 404s, see the first troubleshooting entry below
- [ ] Sign in, then add something to the cart
- [ ] Admin dashboard loads at `/admin`

---

## Troubleshooting

<details>
<summary><b>Deep links 404 — <code>/shop</code> works from the home page but not on refresh</b></summary>

React Router handles routes in the browser, so a direct request for `/shop` asks Vercel
for a file that doesn't exist. The Vite framework preset usually adds the fallback. If
it doesn't, give the storefront service its own rewrite by adding this inside the
`storefront` block in `vercel.json`:

```json
"routes": [
  { "handle": "filesystem" },
  { "src": "/(.*)", "dest": "/index.html" }
]
```

`handle: filesystem` matters — without it the rule would also swallow requests for
`/assets/*` and the page would load with no CSS or JavaScript.

</details>

<details>
<summary><b><code>too many clients already</code> or connections exhausted</b></summary>

The pooler is not being used, or pooling is not disabled. Check both:

1. `DATABASE_URL` ends in `:6543`, not `:5432`
2. The API log shows `NullPool`. If not, set `DB_SERVERLESS=true` explicitly — the
   automatic default relies on Vercel's `VERCEL` environment variable

</details>

<details>
<summary><b><code>prepared statement "__asyncpg_stmt_x__" does not exist</code></b></summary>

Prepared statements are reaching a transaction-mode pooler. `DB_SERVERLESS` is not
taking effect — set it to `true` explicitly and redeploy.

</details>

<details>
<summary><b><code>No interpreter found for Python 3.11.9</code> (hit on the first deploy, now fixed)</b></summary>

Vercel's Python builder detects a `[project]` table in `pyproject.toml` and installs
with **uv**, not pip:

```
Using python version: 3.12
Installing required dependencies from pyproject.toml
Error: uv sync --active --no-dev --locked --no-editable
error: No interpreter found for Python 3.11.9
```

uv reads `.python-version` itself. That file said `3.11.9`, a full patch version Vercel
does not ship, so resolution failed even though 3.12 was available and satisfied
`requires-python`.

Three changes fixed it, and all three matter:

1. `.python-version` now says `3.12`, matching what Vercel provisions.
2. `requires-python` is `>=3.11` rather than `>=3.11.9`. A full patch pin fails on any
   host shipping a different patch.
3. `uv.lock` is committed, because the builder passes `--locked`, which refuses to
   resolve without an up-to-date lockfile.

**Because uv reads `pyproject.toml`, `[project].dependencies` is the list that governs
the deployment — not `requirements.txt`.** Keep the two in step. Regenerate the lock
after any change:

```bash
uv lock
```

</details>

<details>
<summary><b>API returns 500 on every request, log shows an ImportError</b></summary>

Something the code imports is missing from `[project].dependencies`. This is easy to
cause, because `requirements.txt` looking correct is no help — Vercel does not read it.

It bit this project once already: `email-validator` sat only in the dev extras, but
`app/schemas/review.py` declares an `EmailStr` field, and pydantic raises while
*building* that model. The result is a total boot failure, not a broken endpoint. The
same applied to `httpx`, which `app/services/razorpay.py` needs at runtime.

To check the deployed set matches what the app imports:

```bash
cd luxury-furniture-backend
uv export --no-dev --locked --no-hashes
```

</details>

<details>
<summary><b>The services block seems ignored</b></summary>

The project framework is not set to `Services` (step 2). Vercel needs both that setting
and the `services` key in `vercel.json`; with only one it silently falls back to
auto-detection.

</details>

<details>
<summary><b>First request after a quiet period is slow</b></summary>

A cold start: Vercel is booting a Python instance and importing FastAPI, SQLAlchemy and
Pydantic. Expect one to three seconds. Fluid compute keeps instances warm under
traffic, so it mostly affects the first visitor after an idle spell.

</details>

---

## What changed for serverless

| File | Change |
|---|---|
| `vercel.json` | Two services and the routing between them |
| `app/db/session.py` | `NullPool` and no prepared statements when `DB_SERVERLESS` is on; pooled otherwise |
| `app/core/config.py` | Added `DB_SERVERLESS`, defaulting from Vercel's own env var |
| `app/main.py` | CORS reads `CORS_ORIGINS` again — it had been hardcoded to `localhost:4173` |
| `luxury-furniture-backend/requirements.txt` | Re-saved as UTF-8 (was UTF-16, which pip cannot read) and pinned |
| `luxury-furniture-backend/pyproject.toml` | Now the accurate runtime dependency list, since Vercel installs from it via uv. Added the missing `email-validator` and `httpx`, pinned the versions, and loosened `requires-python` to `>=3.11` |
| `luxury-furniture-backend/.python-version` | `3.11.9` to `3.12`; uv could not resolve the patch-pinned version |
| `luxury-furniture-backend/uv.lock` | New. The builder runs `uv sync --locked`, which requires it |

Local development is untouched. Without `VERCEL` set, `DB_SERVERLESS` is false and the
engine keeps its normal connection pool.

---

## Still works elsewhere

`render.yaml` and `Procfile` are unchanged, so a persistent-server deploy remains
available. On those hosts leave `DB_SERVERLESS` unset, use the direct connection on
port 5432, and migrations run automatically on deploy.
