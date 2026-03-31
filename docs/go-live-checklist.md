# Sottra — Go-Live Checklist

Severity levels:
- **🔴 BLOCKER** — Must be resolved before any production deploy. Blocks release.
- **🟠 CRITICAL** — Must be resolved before go-live. May ship for internal testing only.
- **🟡 IMPORTANT** — Should be resolved before public launch. Degrades experience if missing.
- **⚪ IMPROVEMENT** — Nice-to-have. Can ship without.

---

## 🔴 BLOCKER

- [x] `npm run build` succeeds without errors
- [x] `npm test` — all tests pass
- [x] `npm run typecheck` — zero type errors
- [x] No `.env` file in build output (`dist/`)
- [x] `.env.example` contains only non-secret template keys
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

## 🟠 CRITICAL

- [x] `core-proxy` deployed and responding
- [x] `check-subscription` deployed, returns HTTP 200 envelope with `billing_active` flag
- [x] `diagnostics` deployed, restricted to admin OR owner (server-side)
- [x] `record-scan` deployed, owner bypass uses `isOwnerById()` (was `isOwnerEmail()`)
- [x] `pro-sources` deployed for OMI/POI lookups
- [x] `create-checkout` deployed, blocks duplicate subscriptions (409), degrades without Stripe
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
- [ ] `STRIPE_SECRET_KEY` set (required for billing — UI auto-detects via `billing_active` flag)
- [ ] `STRIPE_WEBHOOK_SECRET` set (required for webhook signature verification)
- [ ] `ALLOWED_ORIGINS` set (comma-separated allowlist for CORS and Stripe return URLs)
- [x] `COMMERCIAL_BYPASS_EMAILS` set (full user access, no admin)

## 🟡 IMPORTANT

- [x] `package.json` name is `sottra`, version ≥ 1.0.0
- [x] `BUILD_VERSION` in `src/lib/buildInfo.ts` is updated
- [x] Manifest has correct `name`, `short_name`, `start_url: /`, `scope: /`
- [x] Icons present (192×192, 512×512 minimum)
- [x] `display: standalone`, `orientation: portrait`
- [x] Service worker registers and caches assets
- [x] No horizontal overflow on iPhone SE (320px)
- [x] CTA buttons min-height 48px
- [x] Safe area insets applied (header, footer, banner)
- [x] Input font-size ≥ 16px (no iOS zoom)
- [x] GitHub Actions pipeline: lint → typecheck → test → verify:secrets → build
- [x] Dependabot configured for npm and GitHub Actions
- [x] `audit:release` script validates full pipeline locally
- [ ] Lighthouse PWA audit ≥ 90

## ⚪ IMPROVEMENT

- [ ] Smoke test: login → scan → report → save flow (on real device)
- [ ] Verify the bootstrap account has full access (on real device)
- [ ] Verify PWA installs on Android and iOS
- [ ] Verify Stripe absence causes no errors or blocked flows
- [ ] Verify `past_due` users see portal CTA, not scan access

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

If any is missing, `billing_active = false` → payment CTAs are hidden/disabled.

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
