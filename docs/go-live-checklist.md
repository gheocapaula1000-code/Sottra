# Sottra — Go-Live Checklist

## Pre-Deploy

- [ ] All tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] `package.json` name is `sottra`, version ≥ 1.0.0
- [ ] `BUILD_VERSION` in `src/lib/buildInfo.ts` is updated
- [ ] No `.env` file in build output (`dist/`)
- [ ] `.env.example` contains only non-secret template keys

## Secrets & Configuration

- [ ] `CORE_API_URL` set in edge function secrets (NOT in client code)
- [ ] `AI_CORE_SECRET` or `CORE_API_KEY` set in edge function secrets
- [ ] `STRIPE_SECRET_KEY` set (or billing runs in degraded mode)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set for admin operations
- [ ] No secrets exposed in frontend bundle (check `dist/assets/*.js`)

## Edge Functions

- [ ] `core-proxy` deployed and responding
- [ ] `check-subscription` deployed, returns HTTP 200 envelope
- [ ] `diagnostics` deployed, restricted to admin/owner
- [ ] `record-scan` deployed, idempotent scan recording works
- [ ] `pro-sources` deployed for OMI/POI lookups
- [ ] All functions have `verify_jwt = false` in config.toml (JWT validated in code)

## PWA

- [ ] Manifest has correct `name`, `short_name`, `start_url: /`, `scope: /`
- [ ] Icons present (192×192, 512×512 minimum)
- [ ] `display: standalone`, `orientation: portrait`
- [ ] CSP meta tag in `index.html` restricts `connect-src`
- [ ] Service worker registers and caches assets
- [ ] Lighthouse PWA audit ≥ 90

## Data Integrity

- [ ] No mock data imported at runtime
- [ ] Report sections omit themselves when data is unavailable
- [ ] Source taxonomy badges match: ufficiale, geo_verificato, elaborato, mercato_verificato, mercato_parziale, stima, non_disponibile
- [ ] OMI data labeled as `official_data` only when polygon-matched

## Mobile

- [ ] No horizontal overflow on iPhone SE (320px)
- [ ] CTA buttons min-height 48px
- [ ] Safe area insets applied (header, footer, banner)
- [ ] Input font-size ≥ 16px (no iOS zoom)

## Monitoring

- [ ] Edge function logs accessible via Lovable Cloud
- [ ] Diagnostics page accessible to admin/owner at `/admin/diagnostics`
- [ ] Circuit breaker in `api.ts` protects against cascade failures

## Post-Deploy

- [ ] Smoke test: login → scan → report → save flow
- [ ] Verify offline banner appears when disconnected
- [ ] Verify PWA installs on Android and iOS
- [ ] Check billing CTA behavior with and without Stripe configured
