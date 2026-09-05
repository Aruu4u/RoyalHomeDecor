<div align="center">

# Royal Home Decor

### A production e-commerce storefront for a luxury furniture and handicrafts brand

Built end to end — database, API, storefront and admin dashboard.

<br/>

![FastAPI](https://img.shields.io/badge/FastAPI-0.139-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)

<br/>

![Tests](https://img.shields.io/badge/tests-222_passing-2ea44f?style=flat-square)
![Endpoints](https://img.shields.io/badge/API-54_endpoints-009688?style=flat-square)
![Tables](https://img.shields.io/badge/database-15_tables-336791?style=flat-square)
![Lint](https://img.shields.io/badge/ruff-clean-2ea44f?style=flat-square)
![Types](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square)

</div>

---

## What this is

A complete online store for a furniture and handicrafts business: customers browse
collections, filter by material and finish, read and write reviews, add pieces to a
cart, and check out. The owner manages the entire catalogue, stock, offers and orders
from a built-in admin dashboard — no developer needed to run the shop day to day.

Everything here is my own work: the data model, the API, the storefront, the admin
tooling, and the tests.

> **My first freelance project.** It taught me more than any tutorial: that money
> handling has to be exactly right, that a schema change ripples further than you
> expect, and that "it looks fine" is not the same as "it works".

---

## Highlights

<table>
<tr>
<td width="50%" valign="top">

### Money is calculated server-side, always
Every discount is resolved on the server in **integer paise** and the same figure is
charged at checkout. The browser is never trusted with arithmetic that decides a price,
and floating-point rupees never touch a total.

</td>
<td width="50%" valign="top">

### Offers that actually expire
An offer past its end date stops discounting **everywhere at once** — product page,
cart and checkout — rather than merely disappearing from view. An offer that vanishes
from the storefront but still discounts the basket is a silent undercharge.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Real stock, real buttons
Sold-out pieces are marked on the card and the add-to-cart button is genuinely
disabled — removed from the tab order and announced as unavailable, not just greyed
out. Stock is summed across active variants by the server.

</td>
<td width="50%" valign="top">

### Reviews without a signup wall
Customers can review a piece without creating an account. Signing in adds a
one-per-product limit and a **verified-purchase badge the server derives from order
history**, so it cannot be self-awarded.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Best sellers from actual sales
The "best selling" rail is ranked from real order lines with cancelled orders
excluded — not a hand-picked list. Default picks top up a short row so a young
catalogue never looks broken.

</td>
<td width="50%" valign="top">

### An admin dashboard the owner can use
Products, variants, images, stock, collections, offers and orders are all editable in
the browser, with drag-and-drop uploads and plain-English confirmations before
anything destructive.

</td>
</tr>
</table>

---

## Features

<details open>
<summary><b>Storefront</b></summary>

- Collections, product listings and a full product page with variant selection
- Filtering by **collection, top material, base material, finish, colour, style**, plus an
  "on offer only" toggle — all reflected in the URL, so a filtered view survives a
  refresh and can be shared
- Sorting including **best selling**, ranked from real order data
- Product reviews: star ratings, written reviews, photo uploads, an aggregate score and
  a per-star distribution
- Cart and checkout with server-calculated totals
- Favourites, saved addresses, order history and order tracking
- Out-of-stock and low-stock states on every card
- Themed seasonal offer sections (Diwali, Christmas and so on) the owner can create,
  style and hide

</details>

<details>
<summary><b>Admin dashboard</b></summary>

- Create and edit products with nested images, variants and inventory in one form
- Drag-and-drop image uploads straight to storage
- Auto-generated URL slugs, frozen after publication so live links never break
- Stock management with low-stock thresholds
- Offer sections with custom themes, colours and background images
- Per-product discounts with expiry: a number of days, or never expires
- **Conflict detection** — adding a discount to an already-discounted piece names the
  running offer and asks before replacing it
- Offer membership shown on the product edit page, so a 25% setting that displays as
  40% is never a mystery
- Order management with status transitions

</details>

<details>
<summary><b>Engineering</b></summary>

- **222 backend tests**, `ruff` clean, TypeScript strict mode with zero errors
- 9 Alembic migrations; schema changes are additive and preserve data
- Layered backend: routes → services → repositories → models, with no layer skipping
- Pydantic schemas validate every request and response
- Error handling that never leaks internals: a customer sees "Website Under
  Surveillance", the console keeps the detail
- Offline and slow-connection detection with clear messaging
- Image caching via a service worker, lazy-loaded routes, and a request cache that
  deduplicates catalogue calls
- Accessibility: keyboard-operable star ratings, focus management in dialogs, screen
  reader labelling

</details>

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **API** | FastAPI + Pydantic v2 | Request and response validation from the same type hints that document the API |
| **Database** | PostgreSQL (Supabase) | Relational integrity for orders and money; constraints enforced in the database, not just the app |
| **ORM** | SQLAlchemy 2.0 async + asyncpg | Non-blocking database access under a single-process server |
| **Migrations** | Alembic | Every schema change reviewable and reversible |
| **Auth** | Supabase Auth (JWT) | Offloads password storage and email flows to a service built for it |
| **Frontend** | React 19 + TypeScript + Vite 8 | Strict typing across the API boundary; near-instant rebuilds |
| **Routing** | React Router 7 | Route-level code splitting |
| **Payments** | Razorpay | Standard for Indian commerce |
| **Storage** | Supabase Storage | Product and review images on a CDN |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React 19 + TypeScript          storefront  ·  admin panel   │
└───────────────────────────┬──────────────────────────────────┘
                            │  JSON over HTTPS, JWT bearer
┌───────────────────────────▼──────────────────────────────────┐
│  FastAPI                                                     │
│                                                              │
│   routes/        HTTP, status codes, auth guards             │
│      ↓                                                       │
│   services/      business rules, pricing, money              │
│      ↓                                                       │
│   repositories/  queries, no business logic                  │
│      ↓                                                       │
│   models/        SQLAlchemy tables and constraints           │
└───────────────────────────┬──────────────────────────────────┘
                            │  asyncpg
┌───────────────────────────▼──────────────────────────────────┐
│  PostgreSQL (Supabase)   15 tables  ·  Auth  ·  Storage      │
└──────────────────────────────────────────────────────────────┘
```

Each layer talks only to the one below it. Pricing lives in exactly one place
(`services/offer_pricing.py`), so there is a single answer to "what does this cost"
rather than one per screen.

<details>
<summary><b>Repository layout</b></summary>

```
RoyalHomeDecor/
├── luxury-furniture-backend/
│   ├── app/
│   │   ├── api/v1/routes/      36 route modules  (54 operations)
│   │   ├── core/               config, auth, exceptions
│   │   ├── db/                 engine, session, base
│   │   ├── models/             15 SQLAlchemy tables
│   │   ├── repositories/       data access
│   │   ├── schemas/            Pydantic request/response models
│   │   └── services/           business logic and pricing
│   ├── migrations/versions/    9 Alembic migrations
│   ├── scripts/                schema checks and live smoke tests
│   └── tests/                  222 tests
│
├── luxury-furniture-frontend/
│   └── src/
│       ├── components/         layout, product, shop, admin, ui
│       ├── pages/              storefront and admin screens
│       ├── services/           typed API clients
│       ├── hooks/  lib/        data loading, pricing, errors
│       ├── types/              mirrors the backend schemas
│       └── theme/              design tokens
│
├── requirements.txt            Python dependencies (pinned)
└── README.md
```

</details>

---

## Getting started

**Prerequisites** — Python 3.11+, Node 20+, and a Supabase project (Postgres + Auth + Storage).

### 1. Backend

```bash
cd luxury-furniture-backend

python -m venv venv
venv\Scripts\activate            # Windows
source venv/bin/activate         # macOS / Linux

pip install -r ../requirements.txt

cp .env.example .env             # then fill in your own values

alembic upgrade head             # create the schema
uvicorn app.main:app --reload    # http://127.0.0.1:8000/docs
```

### 2. Frontend

```bash
cd luxury-furniture-frontend

npm install
cp .env.example .env             # then fill in your own values

npm run dev                      # http://127.0.0.1:4173
```

> **Port 4173 is not arbitrary.** The backend's CORS allowlist names it explicitly. If
> you change the frontend port, add it to `CORS_ORIGINS` in the backend `.env` or the
> browser will block every request.

### 3. Configuration

Both apps read from a `.env` file. Copy the `.env.example` beside each one and fill in
your own values — the examples contain placeholders only.

| Backend | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (`postgresql+asyncpg://...`) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Auth token verification |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |
| `RAZORPAY_*` | Payment credentials |

| Frontend | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend API base, including `/api/v1` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Sign-in and image uploads |

> **Never commit a `.env` file.** Both are already in `.gitignore`. They hold live
> database and payment credentials, and anything pushed to a public repository should
> be treated as compromised from that moment on.

---

## Testing

```bash
cd luxury-furniture-backend

venv\Scripts\python.exe -m pytest -q      # 222 tests
venv\Scripts\ruff.exe check app tests     # linting
```

```bash
cd luxury-furniture-frontend

npx tsc -b        # type check
npm run build     # production build
```

The `scripts/` folder holds checks that run against a live database and a running
server, covering the things unit tests with fake services cannot reach:

| Script | Verifies |
|---|---|
| `smoke_new_endpoints.py` | ~50 assertions across every public endpoint |
| `check_offer_expiry_live.py` | Expiring an offer changes the price actually charged |
| `check_favourites_http.py` | Full HTTP round trip through the real service and database |
| `verify_reviews_schema.py` | Live schema matches the migrations |

---

## Decisions worth explaining

<details>
<summary><b>Money is stored in integer paise, never floats</b></summary>

`0.1 + 0.2 != 0.3` in binary floating point. On a single item that is invisible; across
a basket, a discount and a tax line it becomes a total that does not match the sum of
its parts. All amounts are integers, and rupees exist only at the moment of display.

</details>

<details>
<summary><b>Discounts change the charged price, not just the label</b></summary>

Showing a reduced price while charging the original is a misleading price under the
Consumer Protection Act 2019, quite apart from being wrong. The same
`apply_discount()` runs for the card, the cart and the order, so the three cannot
disagree.

</details>

<details>
<summary><b>When two offers overlap, the larger wins</b></summary>

A piece can be discounted by its own offer and by a seasonal section at the same time.
Taking the better of the two is the outcome a customer expects — and the alternative,
first-match, produces a price that depends on row ordering. The admin dashboard warns
before creating the overlap in the first place.

</details>

<details>
<summary><b>A null expiry date means "never expires"</b></summary>

Every offer that existed before expiry was added reads as null, so null has to mean
"still running". Any other choice would have silently switched off live promotions the
moment the migration ran.

</details>

<details>
<summary><b>URL slugs are frozen after publication</b></summary>

Slugs are generated from the product name, but renaming a product does not regenerate
one. A changed slug breaks every shared link and search result pointing at that piece,
and there is no redirect handling to catch them.

</details>

<details>
<summary><b>Material is three fields, not one</b></summary>

Furniture is rarely one material — a marble top on a brass base, with a finish over
both. A single "marble and brass" text field made all three unfilterable. Splitting
them into top material, base material and finish was a rename migration, so no
existing data was lost.

</details>

<details>
<summary><b>Customers never see a technical error</b></summary>

An unexpected failure shows "Website Under Surveillance" and a network failure says so
plainly. Status codes, stack traces and internal identifiers stay in the console. A
shopper cannot act on a 500, and showing them one only erodes trust in the shop.

</details>

---

## Deployment

Both halves run as **one Vercel project with two independently built services**, sharing
a single domain but never a build:

```
royalhomedecor.vercel.app
│
├── /api/*   ──►  FastAPI      (Python runtime)
└── /*       ──►  Vite SPA     (static)
```

Because they share an origin, the browser talks to the API same-origin — no CORS
preflight, and no second domain to manage.

**→ [Full deployment guide](DEPLOYMENT.md)**

The one thing worth knowing up front: serverless needs Supabase's **transaction pooler**
on port 6543 and client-side pooling switched off, otherwise concurrent instances
exhaust the database connection limit. The app detects Vercel and reconfigures the
engine itself; local development keeps its normal pool.

`render.yaml` and `Procfile` are still there, so a persistent-server deploy remains an
option.

---

## Roadmap

- [ ] Admin UI for review moderation (the API endpoints already exist)
- [ ] Coupon codes at checkout
- [ ] Order confirmation and dispatch emails
- [ ] Wishlist sharing
- [ ] Analytics on the admin dashboard

---

<div align="center">

**Built by [Aruu4u](https://github.com/Aruu4u)**

First freelance project · Full-stack · Delivered end to end

</div>
