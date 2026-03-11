

## Diagnosis: Root Cause Found

**The core-proxy edge function crashes before ever reaching Central Core.**

### The Bug

`supabase/functions/core-proxy/index.ts` line 2 imports:
```
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
```

Line 36 calls:
```ts
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
```

**`getClaims()` was introduced in auth-js v2.69.0 (February 2025). supabase-js@2.49.2 does NOT include it.** The call throws `TypeError: supabase.auth.getClaims is not a function`, caught by the outer try/catch, returning a generic 500 error.

The client receives this 500, maps it to "Servizio temporaneamente non disponibile" via `friendlyMessage()`, and every module shows an error. **No request ever reaches Central Core.**

This explains:
- Zero logs from core-proxy (the crash happens before any `console.error` for Core-related issues)
- All cards showing "servizio non disponibile"
- Secrets being correctly configured but irrelevant (the function never gets to read them)

### Evidence

- `record-scan` and `check-subscription` both use `npm:@supabase/supabase-js@2.57.2` with `getUser()` — they work fine
- `core-proxy` alone uses the old `esm.sh/@supabase/supabase-js@2.49.2` with `getClaims()` — it crashes

### Fix (single-file, 2-line change)

**File: `supabase/functions/core-proxy/index.ts`**

1. Update import to match other edge functions:
```
- import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
+ import { createClient } from "npm:@supabase/supabase-js@2.57.2";
```

2. Replace `getClaims` with `getUser` (proven pattern from record-scan):
```ts
- const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
- if (claimsError || !claimsData?.claims) {
-   console.error("Auth verification failed:", claimsError?.message);
-   return jsonResponse({ error: { message: "Sessione non valida o scaduta" } }, 401);
- }
- const userId = claimsData.claims.sub;
+ const { data: userData, error: userError } = await supabase.auth.getUser(token);
+ if (userError || !userData?.user) {
+   console.error("Auth verification failed:", userError?.message);
+   return jsonResponse({ error: { message: "Sessione non valida o scaduta" } }, 401);
+ }
+ const userId = userData.user.id;
```

No other files need changes. This unblocks the entire live scan pipeline.

