# Sottra — Boot Recovery & Cache Strategy

## Chunk Load Errors

After a new deploy, old cached HTML may reference hashed JS/CSS chunks that no longer exist on the server. This causes `import()` to throw a network error, leading to a white screen.

### Recovery Flow

1. `isChunkLoadError()` detects the error pattern
2. `recoverFromChunkError()` attempts recovery:
   - Unregisters all service workers
   - Clears all Cache Storage entries
   - Hard-reloads the page
3. A **reload guard** (`sessionStorage`) limits retries to 2 within 30 seconds to prevent infinite reload loops
4. If recovery is exhausted, a static Italian error UI is shown with a manual "Ricarica" button

### Integration Points

- **`main.tsx`**: Catches synchronous render errors and triggers recovery; empty-root `error` / `unhandledrejection` guards show the Italian fallback instead of a black page
- **`App.tsx`**: `lazyWithRecovery()` wraps all `lazy()` imports to catch async chunk failures before they bubble to `ErrorBoundary`; `SupabaseConfigGate` throws during render if publishable Supabase env is missing so ErrorBoundary can display it
- **`ErrorBoundary.tsx`**: Last-resort catch with chunk error detection; shows spinner during recovery attempt
- **`src/integrations/supabase/client.ts`**: Lazy client — never calls `createClient` with an empty URL at module top-level

### `markBootSuccess()`

Called in `main.tsx` after successful render. Clears the reload guard so future deploys get fresh recovery attempts.

## Service Worker Strategy

- **Register type**: `autoUpdate` — new SW activates immediately with `skipWaiting` + `clientsClaim`
- **Single register path**: `injectRegister: false` — only `PwaUpdateBanner` / `useRegisterSW` registers the worker (avoids a double inject + duplicate `<link rel="manifest">`)
- **Poll interval**: 30s via `PwaUpdateBanner`
- **Error budget**: Polling stops after 3 consecutive update check errors to prevent loops
- **Cache cleanup**: `cleanupOutdatedCaches: true` removes old workbox caches
- **OAuth exclusion**: `/~oauth` is in `navigateFallbackDenylist` to always hit network

## Cache-Control Headers (`public/_headers`)

| Path | Policy | Rationale |
|------|--------|-----------|
| `/sw.js` | `no-cache, no-store, must-revalidate` | SW must always be fresh to detect updates |
| `/manifest.webmanifest` | `no-cache, must-revalidate` | Manifest changes (icons, theme) must propagate |
| `/assets/*` | `public, max-age=31536000, immutable` | Hashed filenames — safe to cache forever |
| `/*` (default) | No explicit Cache-Control | Hosting platform default (typically short cache) |

## CSP Strategy

CSP is enforced via `public/_headers` (server-side), NOT via `<meta>` tag. This avoids duplication and allows directives like `frame-ancestors` that `<meta>` doesn't support.

Key directives:
- `default-src 'self'` — restrictive baseline
- `script-src 'self'` — no `unsafe-eval`, no `unsafe-inline` (Vite injects no inline scripts in production)
- `connect-src 'self' https://*.supabase.co wss://*.supabase.co` — API and realtime
- `frame-src 'none'` + `object-src 'none'` — blocks embedding
- `form-action 'self'` — prevents form hijacking
- `upgrade-insecure-requests` — forces HTTPS for subresources

## Offline UX

- `OfflineBanner` uses `useSyncExternalStore` with `navigator.onLine` for instant feedback
- No spinner-only states — offline banner is dismissible and non-blocking
- Boot failure (first check-subscription error) shows retry UI, not paywall
