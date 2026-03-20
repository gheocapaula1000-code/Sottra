# Sottra — Privacy & Data Flow

## Architecture

```
User Device → Supabase Edge Functions → Central Core V3
                    ↓
              Supabase DB (user_trials, scan_events, user_roles)
```

## Data Collected

### From User
- **Email**: For authentication (Supabase Auth)
- **GPS coordinates**: Device location at scan time (not stored server-side beyond scan session)
- **Building photo**: Sent as Base64 to Central Core for identification (not persisted in Sottra backend)

### From Central Core
- Building identification (address, type, facade analysis)
- OMI zone data (official real estate valuations)
- POI enrichment (nearby services from OpenStreetMap)
- Pricing estimates (market data)
- Demographic/territorial forecasts

### Stored in Database
- `user_trials`: Trial status, scans used, trial expiry
- `scan_events`: Scan ID + user ID (for idempotent credit tracking)
- `user_roles`: Admin/moderator/user role assignments
- `omi_*` tables: Cached OMI geographic and valuation data

## Data NOT Stored
- Building photos (processed in-memory, not persisted)
- GPS coordinates (used transiently for OMI lookup)
- Stripe customer data (queried live from Stripe API)
- Report content (rendered client-side from API responses)

## Security Measures

1. **Zero client secrets**: No API keys in frontend code. All Core API calls go through `core-proxy` edge function.
2. **JWT validation**: All edge functions validate user tokens server-side via `getClaims()`.
3. **RLS policies**: Database tables protected by Row-Level Security.
4. **CSP meta tag**: Restricts `connect-src` to Supabase domains only.
5. **CORS**: Edge functions allow `*` origin (standard for Supabase functions).

## Third-Party Processors
- **Supabase**: Authentication, database, edge functions (EU hosting available)
- **Stripe**: Payment processing (PCI DSS compliant)
- **Central Core V3**: Building analysis engine (hosted on Supabase infrastructure)

## Cookie Policy
- Functional cookies only (Supabase auth session)
- Cookie consent banner implemented (`CookieBanner.tsx`)
- Full cookie policy at `/cookie-policy`
