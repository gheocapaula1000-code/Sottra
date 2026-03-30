# Commercial Bundle Positioning — Sottra + KeyDraft

## Product Overview

### Sottra — Standalone

**What it sells**: Territorial intelligence for real estate.

- Zone reading (real zone, geo level, boundaries when available)
- Value per sqm with reliability rating
- Renovation cost estimation
- 2/5/10 year outlook
- Building specificity analysis (photo + geo + address)
- Attention area scoring
- Full report with limits and provenance

**Target**: Agents, agencies, and groups who need zone context before pricing or listing.

### KeyDraft — Standalone

**What it sells**: Property listing creation from photos.

- Photo analysis (rooms, materials, features, condition)
- Listing text generation (long, short, social variants, WhatsApp)
- Agent data management
- Commercial output ready for portals

**Target**: Agents and agencies who need fast, professional listing creation.

### Bundle — Sottra + KeyDraft

**What it sells**: The complete property intelligence and listing package.

- Start from photos → get property analysis (KeyDraft)
- Get territorial context → zone, value, outlook (Sottra)
- Combine both → listing with territory-backed positioning
- Bridge keeps provenance clear: what's from photos, what's from zone data
- No duplication, no confusion between building data and zone context

**Additional value of the bundle**:
1. Agent photographs → KeyDraft analyzes → Sottra contextualizes the zone
2. Or: agent scans with Sottra → zone reading → KeyDraft receives context for listing
3. Both flows produce a richer, more credible commercial output
4. Origin tracking ensures transparency on what's real vs. contextual

## Target Segments

| Segment        | Sottra alone | KeyDraft alone | Bundle              |
|----------------|-------------|----------------|---------------------|
| Single agent   | ✓ Zone check | ✓ Quick listing | ✓✓ Full workflow    |
| Agency (5-20)  | ✓ Pre-pricing | ✓ Content team  | ✓✓✓ Best value     |
| Group/Network  | ✓ Territory  | ✓ Scale content | ✓✓✓ Strategic edge |

## Key Use Cases

### Use Case 1: New Listing
Agent photos property → KeyDraft creates listing → Sottra adds zone context → listing says "zona con outlook favorevole a 5 anni" backed by real data.

### Use Case 2: Pricing Decision
Agent needs to price → Sottra gives value range + reliability → if good, KeyDraft creates listing with price justification.

### Use Case 3: Client Presentation
Agency prepares material → Sottra report shows zone strength → KeyDraft listing shows property → combined package convinces seller.

## What the Bundle Does NOT Do

- Does NOT merge the two apps into one
- Does NOT create building truth from zone data
- Does NOT invent data to fill gaps
- Does NOT hide limits or fallback indicators
- Does NOT make KeyDraft dependent on Sottra or vice versa

## Technical Architecture

- **Central Core V3** = external broker/orchestrator
- **Bridge** = typed payload with provenance
- **Each app** = fully functional standalone
- **Bundle** = optional enhancement, never a dependency
