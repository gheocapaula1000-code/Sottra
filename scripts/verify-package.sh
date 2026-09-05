#!/usr/bin/env bash
# verify-package.sh — Verify dist/ is clean and PWA-complete for delivery
set -euo pipefail

EXIT=0
REPORT=""

log() { echo "$1"; REPORT="$REPORT\n$1"; }

log "╔══════════════════════════════════════╗"
log "║   Sottra — Package Verification      ║"
log "╚══════════════════════════════════════╝"

# ── dist/ exists
log "── Checking dist/ exists..."
if [ ! -d dist ]; then
  log "❌ dist/ missing — run build first"
  exit 1
fi
log "✅ dist/ present"

# ── Production bundle must contain the Sottra Cloud project host.
#    Lovable publish has omitted VITE_*; source fallbacks bake this ref into JS.
#    CI *test packaging* may also contain https://example.supabase.co from workflow env.
log "── Checking dist JS for Sottra / Supabase hosts..."
CI_TEST_PACKAGING=0
if [ "${CI:-}" = "true" ] && [ "${VERIFY_PRODUCTION_SUPABASE:-}" != "1" ]; then
  CI_TEST_PACKAGING=1
fi

if ! grep -R -E --include='*.js' -q 'vveunbxfcfhnkkhrqutf' dist 2>/dev/null; then
  log "❌ BLOCKED: dist JS missing Sottra Cloud project ref vveunbxfcfhnkkhrqutf (source fallback absent)."
  EXIT=1
else
  log "✅ dist JS contains Sottra Cloud project ref vveunbxfcfhnkkhrqutf"
fi

if ! grep -R -E --include='*.js' -q 'https://[a-z0-9-]+\.supabase\.co' dist 2>/dev/null; then
  log "❌ BLOCKED: no supabase.co https host in dist JS."
  EXIT=1
else
  log "✅ dist JS contains a supabase.co https host"
fi

if grep -R -E --include='*.js' -q 'https://(example|your-project)\.supabase\.co' dist 2>/dev/null; then
  if [ "$CI_TEST_PACKAGING" -eq 1 ]; then
    log "ℹ️  CI test packaging: placeholder https://example.supabase.co allowed (not a production publish)"
  else
    log "❌ BLOCKED: production package contains CI placeholder VITE_SUPABASE_URL (example.supabase.co / your-project.supabase.co)."
    log "   Set the real project URL before packaging. CI tests may keep placeholders."
    EXIT=1
  fi
else
  log "✅ dist JS does not contain CI placeholder Supabase hosts"
fi

# ── No .env leaks
log "── Checking dist/ for .env leaks..."
if find dist -name '.env*' 2>/dev/null | grep -q .; then
  log "❌ .env file found in dist/"
  EXIT=1
else
  log "✅ No .env in dist/"
fi

# ── No secret patterns
log "── Checking dist/ for leaked secrets..."
if grep -rl 'sk_live_\|sk_test_\|STRIPE_SECRET\|-----BEGIN.*PRIVATE KEY' dist/ 2>/dev/null; then
  log "❌ Secret pattern found in dist/"
  EXIT=1
else
  log "✅ No secrets in dist/"
fi

# ── No localhost references in built JS
log "── Checking dist/ for localhost references..."
if grep -rl 'localhost:\|127\.0\.0\.1:' dist/ --include='*.js' --include='*.html' 2>/dev/null | head -3; then
  log "⚠️  WARNING: localhost reference found in dist/ (review manually)"
else
  log "✅ No localhost references in dist/"
fi

# ── No hardcoded email in JS bundles
log "── Checking dist/ for hardcoded emails in JS..."
if grep -rEoh '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' dist/assets/*.js 2>/dev/null \
   | grep -ivE 'example\.com|test\.com|esempio\.it|sottra\.app|pec\.it' \
   | head -1 | grep -q '@'; then
  log "⚠️  WARNING: Email address found in JS bundle (review manually)"
else
  log "✅ No unexpected emails in JS bundles"
fi

# ── Core build artifacts
log "── Verifying build artifacts..."
test -f dist/index.html || { log "❌ index.html missing"; EXIT=1; }
log "✅ index.html present"

# ── PWA manifest
log "── Checking PWA manifest..."
MANIFEST=""
if [ -f dist/manifest.webmanifest ]; then
  MANIFEST="dist/manifest.webmanifest"
elif [ -f dist/manifest.json ]; then
  MANIFEST="dist/manifest.json"
fi

if [ -z "$MANIFEST" ]; then
  log "❌ PWA manifest missing (manifest.webmanifest or manifest.json)"
  EXIT=1
else
  log "✅ PWA manifest found: $MANIFEST"

  # Validate manifest fields
  for field in name short_name start_url display icons lang id scope; do
    if grep -q "\"$field\"" "$MANIFEST"; then
      log "  ✅ manifest.$field present"
    else
      log "  ❌ manifest.$field MISSING"
      EXIT=1
    fi
  done

  if grep -q '"standalone"' "$MANIFEST"; then
    log "  ✅ manifest.display standalone"
  else
    log "  ❌ manifest.display is not standalone"
    EXIT=1
  fi

  if grep -q '"lang": "it"' "$MANIFEST" || grep -q '"lang":"it"' "$MANIFEST"; then
    log "  ✅ manifest.lang = it"
  else
    log "  ❌ manifest.lang is not it"
    EXIT=1
  fi

  # Combined "any maskable" on one icon fails Lighthouse maskable-icon
  if grep -q '"any maskable"' "$MANIFEST"; then
    log "  ❌ combined purpose \"any maskable\" — use separate any + maskable icons"
    EXIT=1
  else
    log "  ✅ icons do not use combined any+maskable purpose"
  fi

  # Validate icon sizes
  for size in 192x192 512x512; do
    if grep -q "$size" "$MANIFEST"; then
      log "  ✅ icon $size declared"
    else
      log "  ❌ icon $size MISSING in manifest"
      EXIT=1
    fi
  done

  # Validate maskable icon
  if grep -q '"maskable"' "$MANIFEST"; then
    log "  ✅ maskable icon declared"
  else
    log "  ⚠️  WARNING: no maskable icon in manifest"
  fi
fi

# ── Service worker
log "── Checking service worker..."
if [ -f dist/sw.js ] || compgen -G "dist/sw.*.js" > /dev/null; then
  log "✅ Service worker present"
else
  log "❌ Service worker missing in dist/"
  EXIT=1
fi

# ── Icon files
log "── Checking icon files..."
for icon in icons/icon-192.png icons/icon-512.png icons/icon-maskable-192.png icons/icon-maskable-512.png icons/apple-touch-icon.png; do
  if [ -f "dist/$icon" ] || [ -f "public/$icon" ]; then
    log "  ✅ $icon present"
  else
    log "  ❌ $icon MISSING"
    EXIT=1
  fi
done

if grep -q 'apple-touch-icon' dist/index.html; then
  log "✅ apple-touch-icon in dist/index.html"
else
  log "❌ apple-touch-icon missing in dist/index.html"
  EXIT=1
fi

MANIFEST_LINKS=$(grep -c 'rel="manifest"' dist/index.html || true)
if [ "$MANIFEST_LINKS" -eq 1 ]; then
  log "✅ exactly one rel=manifest link in dist/index.html"
else
  log "❌ expected exactly one rel=manifest link in dist/index.html (found ${MANIFEST_LINKS})"
  EXIT=1
fi

if grep -q 'rel="apple-touch-icon"' dist/index.html && [ "$(grep -c 'rel="apple-touch-icon"' dist/index.html || true)" -eq 1 ]; then
  log "✅ exactly one apple-touch-icon link"
else
  log "❌ expected exactly one apple-touch-icon link in dist/index.html"
  EXIT=1
fi

# ── Headers artifact
log "── Checking security headers artifact..."
if [ -f dist/_headers ]; then
  log "✅ _headers present in dist/"
  for hdr in "X-Frame-Options" "X-Content-Type-Options" "Referrer-Policy" "Permissions-Policy"; do
    if grep -q "$hdr" dist/_headers; then
      log "  ✅ $hdr declared"
    else
      log "  ❌ $hdr MISSING in _headers"
      EXIT=1
    fi
  done
  if grep -q "camera=(self)" dist/_headers; then
    log "  ✅ Permissions-Policy allows camera=(self) for scans"
  else
    log "  ❌ Permissions-Policy must allow camera=(self) — Android scan uses getUserMedia"
    EXIT=1
  fi
else
  log "❌ _headers not found in dist/ (security headers not enforced)"
  EXIT=1
fi

# ── index.html sanity
log "── Checking index.html sanity..."
if grep -q 'modulepreload.*\/src\/assets' dist/index.html 2>/dev/null; then
  log "❌ Broken modulepreload referencing /src/assets in dist/index.html"
  EXIT=1
else
  log "✅ No broken modulepreload in index.html"
fi

# ── Summary
echo ""
if [ $EXIT -eq 0 ]; then
  log "═══════════════════════════════════════"
  log "✅ PACKAGE VERIFICATION PASSED"
  log "═══════════════════════════════════════"
else
  log "═══════════════════════════════════════"
  log "❌ PACKAGE VERIFICATION FAILED"
  log "═══════════════════════════════════════"
fi
exit $EXIT
