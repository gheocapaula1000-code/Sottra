# Sottra — Go-Live Checklist

## Pre-Deploy

- [x] All tests pass (`npm test`) — 332 tests
- [x] Lint passes (`npm run lint`)
- [x] Type-check passes (`npm run typecheck`)
- [x] Build succeeds (`npm run build`)
- [x] `package.json` name is `sottra`, version ≥ 1.0.0
- [x] `BUILD_VERSION` in `src/lib/buildInfo.ts` is updated
- [x] No `.env` file in build output (`dist/`)
- [x] `.env.example` contains only non-secret template keys
- [x] No owner/admin emails in frontend bundle

## Secrets & Configuration

- [x] `CORE_API_URL` set in edge function secrets (NOT in client code)
- [x] `CORE_API_KEY` set in edge function secrets
- [x] `OWNER_EMAILS` set in edge function secrets (comma-separated)
- [ ] `STRIPE_SECRET_KEY` set (or billing degrades gracefully with 503)
- [x] `SUPABASE_SERVICE_ROLE_KEY` set for admin operations
- [x] No secrets exposed in frontend bundle (check `dist/assets/*.js`)

## Edge Functions

- [x] `core-proxy` deployed and responding
- [x] `check-subscription` deployed, returns HTTP 200 envelope
- [x] `diagnostics` deployed, restricted to admin/owner
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

## Data Integrity

- [x] No mock data imported at runtime
- [x] Report sections omit themselves when data is unavailable
- [x] Source taxonomy badges match: ufficiale, geo_verificato, elaborato, mercato_verificato, mercato_parziale, stima, non_disponibile
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

## Monitoring

- [x] Edge function logs accessible via Lovable Cloud
- [x] Diagnostics page accessible to admin/owner at `/admin/diagnostics`
- [x] Circuit breaker in `api.ts` protects against cascade failures

## Post-Deploy

- [ ] Smoke test: login → scan → report → save flow
- [ ] Verify offline banner appears when disconnected
- [ ] Verify PWA installs on Android and iOS
- [ ] Check billing CTA behavior with and without Stripe configured
