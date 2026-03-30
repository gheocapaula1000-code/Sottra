# Commercial Bridge Payload — Sottra ↔ KeyDraft via Central Core V3

## Overview

This document defines the canonical data contract for bidirectional exchange between Sottra and KeyDraft, orchestrated by Central Core V3.

## Architecture Principles

1. **No coupling**: Sottra and KeyDraft are autonomous products. The bridge is optional.
2. **Central Core V3 = broker**: The Core validates, normalizes, traces, and delivers. It is NOT an app.
3. **Traceability**: Every bridge transit carries `trace_id`, `run_id`, `source_app`, `target_app`, timestamps.
4. **Provenance per-field**: The `bridge_origin_map` tracks where each field comes from (direct/contextual/derived/unavailable) and which app produced it.
5. **No invented data**: Fields are null/unavailable when absent. No fabrication.

## Payload Structure

```
CommercialBridgePayload
├── bridge_identity        (trace, listing, source/target, version)
├── bridge_localization    (lat/lng, address, geo/address confidence)
├── bridge_property_signals (facade, specificity, photos — no estimates)
├── bridge_sottra_context  (zone, value, outlook, attention, limits)
├── bridge_keydraft_context (listing text, materials, agency notes)
├── bridge_origin_map      (field → {source, provenance})
└── bridge_state           (received/validated/delivered/failed/duplicate)
```

## Flow 1: KeyDraft → Sottra

1. Agent creates a listing in KeyDraft (photos + data).
2. KeyDraft sends payload to Central Core V3 `/listing-bridge/push`.
3. Core validates, assigns `trace_id`, normalizes.
4. Core delivers to Sottra's `keydraft-import` edge function.
5. Sottra stores as `keydraft_imports` record with status `importata`.
6. Agency reviews and enriches with territorial context from Sottra's scan.

**What KeyDraft sends**: property signals, agent data, generated texts, photos.
**What Sottra adds**: zone context, value, outlook, specificity — as CONTEXT, not building truth.

## Flow 2: Sottra → KeyDraft

1. Agent runs a scan in Sottra (photo + geo).
2. Sottra builds a territorial reading (zone, value, outlook, limits).
3. Agent exports context to KeyDraft via bridge.
4. Core receives, validates, delivers to KeyDraft.
5. KeyDraft receives zone context for listing enrichment.

**What Sottra sends**: zone identity, value range, reliability, outlook, attention area, limits.
**What KeyDraft receives**: territorial context — NOT building truth, NOT absolute predictions.

## Bridge States

| State       | Meaning                                    |
|-------------|---------------------------------------------|
| received    | Payload received by Core                   |
| validated   | Schema and content validated               |
| transformed | Normalized by Core (format alignment)      |
| delivered   | Successfully delivered to target app       |
| imported    | Target app confirmed import                |
| failed      | Delivery or validation failed              |
| duplicate   | Idempotent — record already exists         |
| blocked     | Blocked by policy or missing requirements  |

## Origin Map

Every field in the payload can declare:

- **source**: `sottra` | `keydraft` | `core_normalized`
- **provenance**: `direct` (real data) | `contextual` (zone-level, not building) | `derived` (computed) | `unavailable`

This prevents confusion between:
- Building-specific data
- Zone-level context
- Commercial/generated content
- Inferred/computed values

## Semantic Boundaries

- Zone data from Sottra is **context**, not building certification.
- Property data from KeyDraft is **agent input + photo analysis**, not verified truth.
- Generated texts are **commercial aids**, not factual statements.
- `building_truth_support` remains `false` — the bridge does not change this.

## Idempotency

- Import: keyed by `listing_id`. Duplicate pushes update the existing record.
- Export: keyed by `trace_id`. Re-exports generate new traces.

## Version

Current bridge version: `1.0.0`
