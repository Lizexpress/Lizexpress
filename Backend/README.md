# LizExpress API v2

Backend for the LizExpress swap marketplace. Pure JavaScript (ESM), layered
architecture, deployed as a single Vercel Function. The web app, the admin
console, and the mobile app all consume this same API.

- **Docs:** https://api.lizexpressltd.com/docs
- **Spec:** `docs/openapi.yaml` → 84 operations
- **Realtime:** see `docs/REALTIME.md`

---

## Architecture

Strict one-way dependency flow. A layer may only import from the layer below it.

```
routes/         HTTP surface — paths, middleware wiring, nothing else
  ↓
controllers/    read request → call one service → shape response
  ↓
services/       all business rules live here
  ↓
repositories/   the ONLY layer that touches Supabase
  ↓
lib/            errors, logging, crypto, clients
```

Why this matters in practice:

- Controllers contain no `if` statements about business state, so rules cannot
  drift between the web and mobile paths.
- Repositories are the only files importing the Supabase client. Swapping the
  datastore, or adding caching, is a contained change.
- `middleware/errorHandler.js` is the **only** place that writes an error
  response, so no endpoint can accidentally leak a stack trace.

```
src/
├── config/         env validation (fail-fast), domain constants
├── lib/            AppError, JSON logger, response envelope, crypto, clients
├── middleware/     auth, validation, rate limits, error handling
├── repositories/   9 data-access modules
├── services/       13 business-logic modules
├── controllers/    9 thin HTTP adapters
├── routes/         8 routers, mounted at /api/v1
├── validators/     every Zod schema, in one file
└── emails/         layout + 16 templates
```

---

## Getting started

```bash
cp .env.example .env      # fill in the values
npm install
npm run dev               # http://localhost:8080 — docs at /docs
```

The app refuses to boot if a required environment variable is missing, so a
misconfigured deploy never serves traffic.

### Required environment variables

| Variable | Notes |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Public values |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Bypasses RLS |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | OTP and transactional email |
| `FLUTTERWAVE_SECRET_KEY` | **Server only.** Never ship to a client |
| `FLUTTERWAVE_WEBHOOK_HASH` | Must match the Flutterwave dashboard |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |
| `CORS_ORIGINS` | Comma-separated allowlist |

---

## Authentication design

Supabase Auth remains the identity store. We did **not** build a parallel user
table with custom JWTs, because that would have orphaned every v1 account and
broken every RLS policy.

What changed in v2 is email delivery only:

1. `POST /auth/register` creates the account with `email_confirm: false` and
   sends a 6-digit code through Resend.
2. `POST /auth/verify-email` validates the code, confirms the email, and mints a
   genuine Supabase session server-side (`generateLink` → `verifyOtp`).
3. The client receives standard access and refresh tokens. Mobile refreshes them
   itself via `POST /auth/refresh`.

OTP codes are stored as salted SHA-256 hashes, single-use, expire in 10 minutes,
allow 5 attempts, and are rate limited to one per 60 seconds per address.
Issuing a new code invalidates any outstanding one.

> **Turn OFF "Confirm email" in Supabase → Authentication → Providers → Email.**
> Otherwise users receive two emails: Supabase's and ours.

---

## Security decisions worth knowing

These address specific holes found in v1:

| v1 problem | v2 fix |
|---|---|
| Flutterwave secret key shipped to browsers via `VITE_` | Secret lives only on the server. Clients receive the public key |
| Payment success set by client code | Verified server-to-server with Flutterwave, plus a signed webhook. `tx_ref`, amount, and currency are all checked |
| Admin credentials published in the README | Role lives on `users.role`, writable only by service-role. No shared password, no separate admin login |
| KYC documents in a public bucket, no reviewer UI | Private bucket. Reviewers get 5-minute signed URLs minted per request |
| Listing fee computed client-side | Computed from the item's stored value. The request cannot influence the amount |
| No record of admin actions | Append-only `admin_actions` audit trail on every privileged mutation |

Rate limits: 120/min globally, 10/15min on auth, 6/10min on OTP, 20/min on uploads.

---

## Deploying to Vercel

The whole Express app runs in one Vercel Function (`api/index.js`). Vercel's
Node runtime calls the default export with a standard `(req, res)` pair, so an
Express app is already a valid handler — no `serverless-http` adapter is needed.

Alternatives considered and rejected: one function per route (duplicated
middleware, N cold starts, no shared router), and the Edge runtime (no Node
APIs, so the Supabase, Resend, and web-push SDKs cannot run there).

```bash
npm i -g vercel
vercel login
vercel link                     # link to the API project
vercel env add SUPABASE_URL     # repeat for each variable, or paste in the dashboard
vercel --prod
```

`vercel.json` sets the build command (which bundles the OpenAPI spec), 1GB
memory, a 30-second timeout, and rewrites every API path into the function.
`includeFiles` ships `docs/**` and `src/emails/**` because both are read at
runtime — the tree-shaker cannot see those reads, so without it Swagger and the
email templates would 404 in production.

`/` is served statically from `public/` and redirects to `/docs`, so a browser
hitting the API root costs no function invocation.

### Environment variables on Vercel

Add every key from `.env.example` under **Settings → Environment Variables**.
Mark `SUPABASE_SERVICE_ROLE_KEY`, `FLUTTERWAVE_SECRET_KEY`,
`FLUTTERWAVE_WEBHOOK_HASH`, `RESEND_API_KEY`, and `VAPID_PRIVATE_KEY` as
**Sensitive** so they cannot be read back from the dashboard.

Set them for Production, Preview, and Development. Point Preview at a separate
Supabase project if you can — preview deploys otherwise write to live data.

### Custom domain

1. Vercel → the API project → **Settings → Domains → Add** `api.lizexpressltd.com`
2. At your DNS provider add a CNAME: `api` → `cname.vercel-dns.com`
3. TLS is provisioned automatically, usually within a few minutes
4. Set `API_BASE_URL=https://api.lizexpressltd.com`
5. Add the web origin to `CORS_ORIGINS`

Point the Flutterwave webhook at
`https://api.lizexpressltd.com/api/v1/payments/webhook` and set the same secret
hash in both the dashboard and `FLUTTERWAVE_WEBHOOK_HASH`.

### Two platform details worth knowing

**Client IP.** Vercel proxies every request, so `req.ip` is the proxy, not the
caller. `src/lib/clientIp.js` prefers `x-vercel-forwarded-for` (set by Vercel's
edge and not forgeable by a client) over `x-forwarded-for` (which a client can
send itself). Rate limiting and audit records both depend on this — without it
one abusive client would exhaust the limit for everybody.

**Webhook body.** Vercel's Node runtime may parse the request body before
Express sees it, so `req.body` can arrive as an object rather than the Buffer
`express.raw()` would produce. `readWebhookPayload` in the payment controller
accepts a Buffer, a string, or an object. This matters because the webhook
answers 200 to stop Flutterwave retrying — a parsing failure would be nearly
silent, and payments would simply never settle.

## Email images

Templates reference absolute URLs under `{APP_URL}/email-assets/`:

```
logo-white.png  social-tiktok.png  social-youtube.png
social-facebook.png  social-instagram.png
```

They live in `frontend/public/email-assets/`, so they deploy with the web app.
Icons are the same official brand glyphs the site footer uses, rendered to PNG
because email clients — Outlook above all — cannot render inline SVG.

**If images look broken, check APP_URL first.** Those URLs are fetched by the
recipient's mail provider over the public internet, not by this server. With
`APP_URL=http://localhost:5173`, Gmail cannot reach them and every image breaks.
The service logs `email.assets.unreachable` on first send when it detects this.

The footer is built to survive images being blocked, which is the default in
most inboxes: the purple disc behind each icon is drawn by the table cell, so
with images off the row degrades to four tidy purple links rather than four
broken-image boxes.

## Admin console

Reached at `/admin`. **There is no admin registration** — accounts exist only
because the migration seeds them, so there is no public path to becoming staff.

### Seeded accounts

| Email | Role | Password |
|---|---|---|
| `admin@lizexpressltd.com` | super_admin | `LizAdmin#2026!Change` |
| `operations@lizexpressltd.com` | admin | `LizOps#2026!Change` |
| `support@lizexpressltd.com` | moderator | `LizSupport#2026!Chg` |

**Change all three immediately after first login.** They are plain text in the
migration file; treat it as a secret until they are rotated, and never commit
real production passwords.

`admin@lizexpressltd.com` most likely already exists from v1. The seed will
**not** overwrite an existing password — re-running the migration can never
reset a live administrator. If nobody knows that password:

```sql
SELECT public.set_staff_password('admin@lizexpressltd.com', 'a-strong-new-password');
```

The seed also repairs accounts created under v1 that have no `auth.identities`
row. Without one, GoTrue refuses password sign-in — the account exists but can
never log in, which is easy to mistake for a wrong password.

### Roles

| Role | Can do |
|---|---|
| `moderator` | Review verifications, moderate listings and feedback |
| `admin` | The above, plus suspend users and view payments |
| `super_admin` | The above, plus assign roles and change platform settings |

### How the route is protected

Three independent layers, because the first two are conveniences and only the
third is a real boundary:

1. `RequireStaff` redirects anonymous visitors to `/admin/login`, and sends a
   signed-in non-staff user to **404** rather than 403 — a 403 would confirm the
   console exists at that URL.
2. The staff sign-in form never reveals whether an address is staff. Correct
   credentials for a non-staff account are signed straight back out with the
   same message as a wrong password, so the form cannot be used to enumerate
   administrator emails.
3. **Every admin endpoint re-checks the role server-side** via `requireAdmin`.
   Editing the guard in devtools grants nothing; the API is the boundary.

Every privileged action is written to the append-only `admin_actions` audit log
with the actor, IP, and before/after state.

## Database

One migration file: `../database/migrations/20260814000000_v2_upgrade.sql`

It is written to run against the **live production database**. It drops nothing,
renames nothing, deletes no rows, and is idempotent — running it twice is a
no-op. Additive columns only, with documented backfills that touch just the new
columns.

Run it from the Supabase SQL editor, or:

```bash
psql "$DATABASE_URL" -f database/migrations/20260814000000_v2_upgrade.sql
```

Read the post-migration checklist at the bottom of the file before going live.

---

## Conventions

**Response envelope** — identical for every endpoint, so clients need one parser:

```json
{ "success": true, "data": {}, "meta": { "page": 1, "total": 137 } }
{ "success": false, "error": { "code": "validation_error", "message": "...", "details": [] } }
```

Error `message` values are written for end users and are safe to display verbatim.

**Adding a feature** — repository → service → controller → route → validator →
`docs/paths/*.yaml`. Keep business rules in the service; if a controller starts
growing conditionals, that logic belongs one layer down.
