# ANNCSU Ingest Plan — Sottra P1

## Source Overview

**ANNCSU** (Archivio Nazionale dei Numeri Civici e delle Strade Urbane) is the official Italian registry of streets and civic numbers, managed by ISTAT in collaboration with Agenzia delle Entrate and municipalities.

- **Officiality**: Institutional (ISTAT)
- **Coverage**: National
- **Format**: CSV export, typically semicolon-separated
- **Update frequency**: Annual / semi-annual
- **Geographic anchor**: comune_istat_code (6-digit)

## Data Contract

See `src/lib/anncsuSchema.ts` for the full typed contract.

### Raw → Normalized pipeline

```
Raw CSV record
  → parseCSVRows() (existing robust parser)
  → normalizeAnncsuRecord()
  → AnncsuNormalizedRecord
  → quality gates evaluation
  → batch summary
```

## Ingest Strategy

### Phase P1 (current): Readiness only
- Contract defined, normalizer implemented, quality gates active
- No database persistence yet
- Admin dry-run inspection available at `/admin/anncsu-readiness`

### Phase P1.1 (next): Controlled ingest
1. **Pre-validation**: Parse CSV, normalize all records, produce batch summary
2. **Quality check**: Reject batches with >50% blocked records
3. **Chunk strategy**: 5,000 records per batch, same pattern as R03 import
4. **Deduplication**: UNIQUE on (comune_istat_code, cod_strada, civic_normalized)
5. **Resume**: Offset-based checkpointing (same as territorial import)
6. **Idempotency**: Upsert with last-wins within batch

### Database table (future)
```sql
-- NOT YET CREATED — planned for P1.1
CREATE TABLE public.anncsu_streets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comune_istat_code TEXT NOT NULL,
  regione_code TEXT,
  provincia_code TEXT,
  cod_strada TEXT,
  street_type TEXT,
  street_name TEXT NOT NULL,
  street_full_name TEXT,
  civic_normalized TEXT,
  esponente TEXT,
  barrato TEXT,
  civic_full_label TEXT,
  localita_code TEXT,
  sezione_censuaria TEXT,
  street_status TEXT NOT NULL DEFAULT 'complete',
  civic_status TEXT NOT NULL DEFAULT 'present',
  source_version TEXT,
  source_date TEXT,
  import_batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comune_istat_code, cod_strada, civic_normalized, esponente)
);
```

### Error buckets
- `blocked`: Missing geo anchor or critical fields
- `review_needed`: High ambiguity (>3 flags)
- `ready_with_warnings`: Minor issues, ingestible
- `ready`: Clean records

### Duplicate handling
- Within batch: last-wins (same as R03)
- Cross-batch: upsert on unique constraint
- Street name collisions within comune: flagged, not auto-resolved

## Quality Gates

| Gate | Condition | Result |
|------|-----------|--------|
| Geo anchor | comune_istat_code missing | `blocked` |
| Completeness | <30% fields filled | `blocked` |
| Normalization | Street and civic both missing | `partial_only` |
| Ambiguity | >3 ambiguity flags | `review_needed` |
| Warnings | Any warnings present | `ready_with_warnings` |
| Clean | All clear | `ready` |

## Promotion Policy (LOCKED)

In P1, **no record** qualifies for:
- `civic_supported_as_precise_location = true`
- `civic_supported_as_building_truth = true`

### Future promotion conditions (not yet active)
A record MAY qualify for `precise_location` in a future phase ONLY if ALL of:
1. Exact geo-consistent official ANNCSU record exists
2. Street match is unambiguous within comune
3. Civic match is exact (no esponente ambiguity)
4. Coherence with resolved comune confirmed
5. Zero ambiguity flags
6. Cross-validation with building registry confirms physical existence

A record can NEVER qualify for `building_truth` from ANNCSU alone because:
- ANNCSU is a street/civic registry, not a building registry
- Street address ≠ building identity
- Multiple buildings can share the same civic number
- Building truth requires cadastral or physical confirmation

## Backbone Alignment

| Backbone level | ANNCSU alignment |
|---------------|-----------------|
| Regione | COD_REG → regione_code |
| Provincia | COD_PROV → provincia_code |
| Comune | COD_COM/PROCOM → comune_istat_code |
| Località | COD_LOC → localita_code |
| Sezione censuaria | SEZ_CENSUARIA → sezione_censuaria |
| Street | COD_STRADA + SPECIE + DENOM_STRADA |
| Civic | CIVICO + ESPONENTE + BARRATO |

## Anti-Hallucination Safeguards

1. No civic interpolation (missing civics stay null)
2. No street name guessing (unresolved stays unresolved)
3. No geographic inference (missing codes stay missing)
4. No automatic promotion to building truth
5. All transformations logged in `normalization_trace`
6. Batch-level quality reporting before any persistence

## Risks

- **Volume**: National dataset can be 20M+ records
- **Quality variance**: Municipal data quality varies significantly
- **Street name ambiguity**: Same street name in multiple località
- **Civic gaps**: Not all municipalities report all civics
- **Staleness**: Some municipal data may be years old
