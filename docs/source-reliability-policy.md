# Sottra — Source Reliability Policy

## Principle

Sottra displays only verified, real data. No mock, placeholder, or fabricated information is ever presented to the user as real.

## Source Taxonomy

Every data point in the report carries a `sourceType` classification:

| sourceType | Badge | Description |
|---|---|---|
| `official_data` | Dato ufficiale (green) | Institutional source (OMI, ISTAT, catasto) |
| `territorial_verified` | Dato geo verificato (cyan) | Verified geospatial data (OSM/Overpass POI, geocoding) |
| `market_data` | Mercato verificato (teal) | Market data from verified commercial sources |
| `image_detected` | Dato elaborato (blue) | Detected from building photo analysis |
| `visual_estimate` | Dato elaborato (blue) | Estimated from visual analysis |
| `forecast_scenario` | Dato elaborato (blue) | Projected scenario, clearly labeled |
| `unavailable` | Non disponibile (grey) | Data not available — section is omitted |

## Rules

1. **No silent fallback**: If a source fails, the section is omitted entirely rather than showing partial or estimated data without clear labeling.

2. **Geographic honesty**: Municipal-level data is never presented as zone-level. The `sourceCoverageLevel` field tracks granularity, and the source resolver rejects candidates whose geographic resolution is lower than required.

3. **OMI data integrity**: OMI quotations are labeled `official_data` only when matched via polygon (point-in-polygon). Catastale fallback matches are labeled `partial`.

4. **Confidence gating**: Reports require identification confidence > 0.4. Below that, the user is prompted to retry the scan.

5. **No marketing inflation**: Descriptions like "eccellente" or "premium location" are never auto-generated. The system uses factual, neutral language.

6. **Forecast disclaimers**: All temporal projections include "non costituisce consulenza" disclaimer.

## Implementation

- `src/lib/reportMapper.ts` — transforms raw data with correct sourceType
- `src/lib/sourceResolver.ts` — resolves best source respecting geographic hierarchy
- `src/components/DataBadge.tsx` — visual badge for each tier
- `src/pages/Result.tsx` — `isSectionPublishable()` gates section visibility
