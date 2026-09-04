# Sottra — Go-Live Checklist

Severity levels:
- **🔴 BLOCKER** — Must be resolved before any production deploy. Blocks release.
- **🟠 CRITICAL** — Must be resolved before go-live. May ship for internal testing only.
- **🟡 IMPORTANT** — Should be resolved before public launch. Degrades experience if missing.
- **⚪ IMPROVEMENT** — Nice-to-have. Can ship without.

---

## Remaining owner ops (not code-fixable)

These stay unchecked until Paula / Pi.Gi Service sets them in the **Supabase Edge Function secrets** (and Stripe Dashboard). The app is built to degrade safely if they are missing: `billing_active = false` hides payment CTAs, trial still works.

- [ ] `STRIPE_SECRET_KEY` set (live key for production billing)
- [ ] `STRIPE_WEBHOOK_SECRET` set (signing secret of the live `stripe-webhook` endpoint)
- [ ] `ALLOWED_ORIGINS` set as comma-separated allowlist. **Must include `https://sottra.app`.** Add Lovable preview origins only when those URLs are in use.
- [ ] Stripe webhook endpoint points at the deployed `stripe-webhook` function; events include `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`
- [ ] Confirm live Stripe products/prices still match `src/lib/plans.ts` (Agente €79 / Agenzia €249 / Rete €690, monthly, no VAT / `automatic_tax` off)
- [ ] After this PR: **rotate** `CORE_API_KEY` (it previously lived in git history as `VITE_CORE_API_KEY`). Optionally rotate the Supabase anon key if the tracked `.env` is treated as a leak. Do not commit replacements.

Exact dashboard steps (no secret values):

1. Supabase → Project → Edge Functions → Secrets: set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ALLOWED_ORIGINS=https://sottra.app` (plus any preview origins).
2. Stripe Dashboard → Developers → Webhooks → add endpoint `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` → copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Stripe → Products: three monthly prices, regime forfettario (do not enable Stripe Tax).
4. Redeploy or restart functions so they pick up secrets.
5. Sign in as a normal test user → `/app` after trial → paywall shows three plans only if `billing_active` is true (self-test “Verifica accesso” → Billing configurato = sì).

---

## 🔴 BLOCKER

- [x] `npm run build` succeeds without errors
- [x] `npm test` — all tests pass
- [x] `npm run typecheck` — zero type errors
- [x] No `.env` file in build output (`dist/`)
- [x] `.env` is gitignored and **not tracked**. Lovable may recreate a local `.env` constantly — that is expected. Only `.env.example` is committed. CI injects Vite placeholders for **tests / CI test packaging** and does not depend on a committed `.env`.
- [x] Production `vite build` / `verify:package` refuse placeholder `VITE_SUPABASE_URL` outside CI. Empty Vite env is allowed because `client.ts` bakes Sottra Cloud publishable fallbacks (`vveunbxfcfhnkkhrqutf`).
- [x] `.env.example` contains only non-secret template keys (server secrets documented as comments)
- [x] No owner/admin emails in frontend bundle (verified by `verify:secrets`)
- [x] No hardcoded API keys (`sk_live_`, `sk_test_`, private key PEM) in source
- [x] `CORE_API_URL` set in edge function secrets
- [x] `CORE_API_KEY` set in edge function secrets
- [x] `ADMIN_BOOTSTRAP_EMAILS` set (sole owner/admin bootstrap)
- [x] `SUPABASE_SERVICE_ROLE_KEY` set for admin operations
- [x] No secrets exposed in frontend bundle
- [x] All edge functions with `verify_jwt = false` validate auth in-code
- [x] All admin/import edge functions require admin or owner role (server-side table check)
- [x] `isOwnerEmail()` deprecated — all owner checks use `isOwnerById()` (table-based)
- [x] `anncsu-import` requires admin/owner auth (was previously unprotected)
- [x] No mock data imported at runtime (zero-mock runtime policy)
- [x] CSP meta tag / `_headers` restricts `connect-src` to Supabase only
- [x] RLS enabled on all user-facing tables
- [x] `building_truth_support` remains `false` — no false precision claims
- [x] `Permissions-Policy` allows `camera=(self)` and `geolocation=(self)` so scan works

## 🟠 CRITICAL

- [x] `core-proxy` deployed and responding
- [x] `check-subscription` deployed, returns HTTP 200 envelope with `billing_active` flag
- [x] `diagnostics` deployed, restricted to admin OR owner (server-side)
- [x] `record-scan` deployed, owner bypass uses `isOwnerById()` (was `isOwnerEmail()`)
- [x] `pro-sources` deployed for OMI/POI lookups
- [x] `create-checkout` deployed, blocks duplicate subscriptions (409), degrades without Stripe, locale `it`, `automatic_tax` off
- [x] `customer-portal` deployed, DB-first customer ID lookup, degrades without Stripe
- [x] `stripe-webhook` deployed, returns 500 on processing failure (enables Stripe retries)
- [x] All functions have `verify_jwt = false` in config.toml (JWT validated in code)
- [x] Owner/admin bootstrap via `ADMIN_BOOTSTRAP_EMAILS` env (server-side only)
- [x] Bootstrap auto-upserts `owner_access` + `user_roles` records (idempotent)
- [x] `main.tsx` catches missing root element with user-friendly fallback
- [x] `main.tsx` catches render exceptions with retry button
- [x] `ErrorBoundary` wraps App with Italian-language error + reload
- [x] `SubscriptionContext` never hangs — resolves even on API failure
- [x] Transient errors preserve last-known state (no paywall on network blip)
- [x] Report sections omit themselves when data is unavailable (honesty-over-noise)
- [x] Source taxonomy badges match expected values (official, elaborated, partial, unavailable)
- [x] OMI data labeled as `official_data` only when polygon-matched
- [x] Primary zone basis ≠ comunale when fine-grained data is available
- [ ] `STRIPE_SECRET_KEY` set (required for billing — UI auto-detects via `billing_active` flag) — **owner ops**
- [ ] `STRIPE_WEBHOOK_SECRET` set (required for webhook signature verification) — **owner ops**
- [ ] `ALLOWED_ORIGINS` set (comma-separated allowlist for CORS and Stripe return URLs; include `https://sottra.app`) — **owner ops**
- [x] `COMMERCIAL_BYPASS_EMAILS` set (full user access, no admin)
- [x] Checkout return (`/app?checkout=success|cancel`) refreshes subscription and shows Italian toasts
- [x] Privacy / Cookie / Termini / Note legali name GPS, photo, Stripe, core-proxy, forfettario, sottra.app

## 🟡 IMPORTANT

- [x] `package.json` name is `sottra`, version ≥ 1.0.0
- [x] `BUILD_VERSION` in `src/lib/buildInfo.ts` is updated
- [x] Manifest has correct `name`, `short_name`, `start_url: /`, `scope: /`, `lang: it`, `id`
- [x] Icons present (192×192, 512×512, maskable, apple-touch 180)
- [x] `display: standalone`, `orientation: portrait`
- [x] Service worker registers and caches assets
- [x] No horizontal overflow on iPhone SE (320px)
- [x] CTA buttons min-height 48px
- [x] Safe area insets applied (header, footer, banner)
- [x] Input font-size ≥ 16px (no iOS zoom)
- [x] GitHub Actions pipeline: lint → typecheck → test → verify:secrets → build → verify:package
- [x] Dependabot configured for npm and GitHub Actions
- [x] `audit:release` script validates full pipeline locally
- [x] Automated PWA installability checks in `verify:package` (manifest, SW, icons, maskable, apple-touch, camera policy)
- [ ] Lighthouse PWA audit ≥ 90 on **https://sottra.app** (production HTTPS + real device/Chrome) — structural CI checks pass; numeric Lighthouse score still needs a live URL

## ⚪ IMPROVEMENT / device smoke

Automated coverage added for signup copy, pricing alignment, billing degrade, checkout return, legal pages, PWA artifacts, and `.env` hygiene. The following still need a **real phone**:

- [ ] Smoke test: login → scan → report → save flow (on real device)
- [ ] Verify the bootstrap account has full access (on real device)
- [ ] Verify PWA installs on Android and iOS
- [ ] Verify Stripe absence causes no errors or blocked flows (trial still scans) — code-level degrade is covered; confirm on production secrets off/on
- [ ] Verify `past_due` users see portal CTA, not scan access (with live Stripe)

## Access Matrix

| Account | Owner | Admin | Subscribed | Trial Bypass | Admin Panel |
|---------|-------|-------|------------|--------------|-------------|
| gheocapaula1000@gmail.com | ✅ | ✅ | ✅ | ✅ | ✅ |
| matteo.ippolito@gmail.com | ❌ | ❌ | ✅ | ✅ | ❌ |
| massimilianogalli75@gmail.com | ❌ | ❌ | ❌ | ❌ | ❌ |

## Billing Activation (`billing_active`)

`billing_active` is returned by `check-subscription` and requires **all three** secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ALLOWED_ORIGINS`

If any is missing, `billing_active = false` → payment CTAs are hidden/disabled. Trial, owner bootstrap, and commercial bypass still work.

## Edge Function Auth Model (uniform)

| Function | Auth Method | Access Level | Notes |
|----------|------------|--------------|-------|
| `check-subscription` | Bearer JWT → getClaims | Any authenticated user | Bootstrap + bypass logic |
| `record-scan` | Bearer JWT → getUser | Any authenticated user | Owner/admin bypass (isOwnerById) |
| `core-proxy` | Bearer JWT → getUser | Any authenticated user | Forwards to Central Core |
| `pro-sources` | Bearer JWT → getUser | Any authenticated user | Public data lookup |
| `diagnostics` | Bearer JWT → getUser | Admin OR owner only | Core health diagnostics |
| `admin-stats` | Bearer JWT → getUser | Admin OR owner only | User/trial statistics |
| `create-checkout` | Bearer JWT → getUser | Any authenticated user | Billing gated by isBillingActive() |
| `customer-portal` | Bearer JWT → getUser | Any authenticated user | Owner short-circuits |
| `stripe-webhook` | Stripe signature | External (Stripe) | No JWT — signature verified |
| `demographic-import` | Bearer JWT → getUser | Admin OR owner only | Data import pipeline |
| `territorial-import` | Bearer JWT → getUser | Admin OR owner only | Data import pipeline |
| `anncsu-import` | Bearer JWT → getUser | Admin OR owner only | Data import pipeline |
| `omi-ingest` | Bearer JWT → getUser | Admin only | OMI data ingest |
| `omi-kml-ingest` | Bearer JWT → getUser | Admin only | KML polygon ingest |
| `keydraft-import` | Bearer JWT OR x-internal-secret | User OR Central Core | Bridge import |
