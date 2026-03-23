# Sottra — Go-Live Checklist

## Pre-Deploy

- [x] All tests pass (`npm test`)
- [x] Lint passes (`npm run lint`)
- [x] Type-check passes (`npm run typecheck`)
- [x] Build succeeds (`npm run build`)
- [x] `package.json` name is `sottra`, version ≥ 1.0.0
- [x] `BUILD_VERSION` in `src/lib/buildInfo.ts` is updated
- [x] No `.env` file in build output (`dist/`)
- [x] `.env.example` contains only non-secret template keys
- [x] No owner/admin emails in frontend bundle

## Secrets & Configuration

- [x] `CORE_API_URL` set in edge function secrets
- [x] `CORE_API_KEY` set in edge function secrets
- [x] `ADMIN_BOOTSTRAP_EMAILS` set (comma-separated owner emails, server-side only)
- [ ] `STRIPE_SECRET_KEY` set (optional — billing degrades gracefully without it)
- [x] `SUPABASE_SERVICE_ROLE_KEY` set for admin operations
- [x] No secrets exposed in frontend bundle

## Admin & Owner Access

- [x] Owner/admin bootstrap via `ADMIN_BOOTSTRAP_EMAILS` env (server-side only)
- [x] Bootstrap auto-upserts `owner_access` + `user_roles` records (idempotent)
- [x] Owner entitlements: `subscribed: true`, `is_owner: true`, full service bypass
- [x] Admin privileges: `is_admin: true`, derived from `user_roles` RBAC table
- [x] No email-based bypass in client code
- [x] No OWNER_EMAILS env dependency for privilege escalation
- [x] `.env` managed by Lovable — NOT a release blocker

## Edge Functions

- [x] `core-proxy` deployed and responding
- [x] `check-subscription` deployed, returns HTTP 200 envelope
- [x] `diagnostics` deployed, restricted to admin OR owner (server-side)
- [x] `record-scan` deployed, idempotent scan recording works
- [x] `pro-sources` deployed for OMI/POI lookups
- [x] `create-checkout` deployed, degrades gracefully without Stripe
- [x] `customer-portal` deployed, degrades gracefully without Stripe
- [x] All functions have `verify_jwt = false` in config.toml (JWT validated in code)

## PWA

- [x] Manifest has correct `name`, `short_name`, `start_url: /`, `scope: /`
- [x] Icons present (192×192, 512×512 minimum)
- [x] `display: standalone`, `orientation: portrait`
- [x] CSP meta tag in `index.html` restricts `connect-src`
- [x] Service worker registers and caches assets
- [ ] Lighthouse PWA audit ≥ 90

## Boot Resilience

- [x] `main.tsx` catches missing root element with user-friendly fallback
- [x] `main.tsx` catches render exceptions with retry button
- [x] `ErrorBoundary` wraps App with Italian-language error + reload
- [x] `SubscriptionContext` never hangs — resolves even on API failure

## Data Integrity

- [x] No mock data imported at runtime
- [x] Report sections omit themselves when data is unavailable
- [x] Source taxonomy badges match expected values
- [x] OMI data labeled as `official_data` only when polygon-matched

## Mobile

- [x] No horizontal overflow on iPhone SE (320px)
- [x] CTA buttons min-height 48px
- [x] Safe area insets applied (header, footer, banner)
- [x] Input font-size ≥ 16px (no iOS zoom)

## CI/CD

- [x] GitHub Actions pipeline: lint → typecheck → test → verify:secrets → build
- [x] Dependabot configured for npm and GitHub Actions
- [x] `audit:release` script validates full pipeline locally

## Post-Deploy

- [ ] Smoke test: login → scan → report → save flow
- [ ] Verify the two bootstrap accounts have full access
- [ ] Verify PWA installs on Android and iOS
- [ ] Verify Stripe absence causes no errors or blocked flows
