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
if grep -rEoh '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' dist/assets/*.js 2>/dev/null | grep -ivE 'example\.com|test\.com' | head -1 | grep -q '@'; then
  log "⚠️  WARNING: Email address found in JS bundle (review manually)"
else
  log "✅ No hardcoded emails in JS bundles"
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
  for field in name short_name start_url display icons; do
    if grep -q "\"$field\"" "$MANIFEST"; then
      log "  ✅ manifest.$field present"
    else
      log "  ❌ manifest.$field MISSING"
      EXIT=1
    fi
  done

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
if ls dist/sw.js dist/sw.*.js 2>/dev/null | head -1 | grep -q .; then
  log "✅ Service worker present"
else
  log "⚠️  WARNING: no service worker found in dist/"
fi

# ── Icon files
log "── Checking icon files..."
for icon in icons/icon-192.png icons/icon-512.png; do
  if [ -f "dist/$icon" ] || [ -f "public/$icon" ]; then
    log "  ✅ $icon present"
  else
    log "  ❌ $icon MISSING"
    EXIT=1
  fi
done

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
else
  log "⚠️  WARNING: _headers not found in dist/ (security headers not enforced)"
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
