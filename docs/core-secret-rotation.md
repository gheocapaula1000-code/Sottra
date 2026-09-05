# Core secret rotation (Sottra)

`CORE_API_KEY` (and the preferred aliases `AI_CORE_SECRET_SOTTRA` / `AI_CORE_SECRET`) must exist **only** as a Supabase Edge Function secret. The PWA never reads it. `core-proxy` and `diagnostics` send it server-side as `x-internal-secret` / `Authorization` to Central Core V3 `/sottra/*`.

A historical client env name `VITE_CORE_API_KEY` once lived in **old git history** (and in a previously tracked `.env`). That value is **not** in current tracked source. Do **not** rewrite git history on this Lovable-connected repo.

## Current source contract

Resolution order in `core-proxy` / `diagnostics` (do not change without a Core contract review):

1. `AI_CORE_SECRET_SOTTRA`
2. `AI_CORE_SECRET`
3. `CORE_API_KEY` (legacy alias)

`keydraft-import` still compares `x-internal-secret` to `CORE_API_KEY` only. After rotation, set **all three names** to the same new value (or confirm Core no longer needs the legacy alias).

## Rotate (owner ops — no secret values in git)

1. Generate a new Core secret **on the Central Core / Core ops side**. Do not invent a placeholder in this repo.
2. Supabase → Project → Edge Functions → Secrets:
   - Set `AI_CORE_SECRET_SOTTRA` to the new value (preferred).
   - Set `AI_CORE_SECRET` and `CORE_API_KEY` to the same new value so fallbacks and `keydraft-import` stay in sync.
   - Leave `CORE_API_URL` pointing at the Sottra Core project root / `/functions/v1` / `/functions/v1/sottra` (existing URL shapes).
3. Redeploy or restart Edge Functions so they pick up secrets (`core-proxy`, `diagnostics`, `keydraft-import` at minimum).
4. Owner smoke: sign in → `/admin/diagnostics` → Core health / `key_configured` is true (the UI must never show the secret).
5. One real scan via `/sottra/*` (photo → report). A 503 from `core-proxy` with “Servizio non ancora disponibile” means the secret or URL is missing after rotate.
6. Revoke the **old** Core secret only after the smoke scan succeeds.

## What not to do

- Do not put the new value in `.env`, `.env.example`, Vite `VITE_*`, or any committed file.
- Do not `git rebase` / force-push / `git filter-repo` to erase the old leak. Rotation is the fix.
- Do not change `/sottra/*` path construction, `x-source-app: sottra`, or owner bootstrap (`ADMIN_BOOTSTRAP_EMAILS`).
- Do not touch Civiko.

CI (`npm run verify:secrets`) fails if a client-bundled `VITE_CORE_API_KEY=` assignment or a hardcoded Core secret literal reappears in tracked source.
