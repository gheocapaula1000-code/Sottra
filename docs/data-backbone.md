# Sottra — Data Backbone

## Principio

Il Data Backbone è il sistema centrale che governa quali dati esistono, dove sono disponibili,
a quale livello geografico operano, e se una sezione del report può comparire o meno.

## Componenti

### 1. Source Registry (`data_source_registry`)

Tabella centrale che cataloga tutte le fonti dati di Sottra.

| Campo | Descrizione |
|-------|-------------|
| `source_key` | Identificativo unico (es. `omi_quotazioni`, `r03_lombardia_2021`) |
| `source_label` | Nome leggibile |
| `source_type` | Tipo (official, territorial_verified, elaborated, forecast_scenario) |
| `source_family` | Famiglia logica (valori_immobiliari, demografia, servizi, rischio...) |
| `dataset_status` | Stato operativo: `active` / `pilot` / `inactive` / `deprecated` |
| `geographic_level_supported` | Livello geo supportato (zona_omi, comune, quartiere, coordinate) |
| `geographic_scope` | Ambito: `nazionale` / `regionale` / `parziale` |
| `regions_supported` | Array di regioni coperte (per fonti regionali) |
| `report_sections_supported` | Sezioni del report che questa fonte alimenta |
| `current_coverage_status` | `available` / `partial` / `unavailable` |
| `record_count` | Numero record reali nel DB |

### 2. Exposure Policy Engine (`src/lib/dataBackbone.ts`)

Modulo TypeScript che valuta, per ogni sezione del report, se deve comparire.

```typescript
const decision = evaluateSectionExposure("profiloArea", scanResult, registry);
// → { decision: "shown" | "hidden" | "reduced", reason: "...", ... }
```

Regole:
- **hidden**: requisiti minimi non soddisfatti (moduli mancanti)
- **reduced**: dati disponibili solo a livello comunale (label prudenti)
- **shown**: dati reali a livello sub-comunale o zone specifiche

### 3. Sub-Municipal Gate (`evaluateSubMunicipalGate`)

Gating data-driven per l'arricchimento sub-comunale:
- Nessun hardcode "if Lombardia"
- Basato su dati effettivamente presenti nel match ASC + R03
- Se R03 non è importato → nessun blocco statistico
- Se R03 è presente ma coverage parziale → etichettato chiaramente

## Come si aggiorna il registro

### Import manuali (admin)
Dopo ogni import via console admin:
1. L'edge function `territorial-import` aggiorna i conteggi
2. L'admin può cliccare "Sincronizza" nella pagina Data Backbone
3. Il sistema verifica i conteggi reali nelle tabelle e aggiorna il registro

### API live (OMI, ISTAT, POI)
Le fonti live (SDMX, Overpass, Core) sono sempre `active` + `available` per design.
Il registro le cataloga per completezza ma non le gating — sono sempre disponibili.

## Come si aggiungono nuove fonti

1. Inserire un record in `data_source_registry` con `dataset_status = "inactive"`
2. Specificare `regions_supported` e `report_sections_supported`
3. Implementare l'importer e il parsing
4. Dopo il primo import validato, aggiornare `dataset_status` a `pilot` o `active`
5. Il motore di esposizione lo includerà automaticamente dove supportato

## Come si decide se una sezione compare

```
Sezione → SECTION_REQUIREMENTS → moduli ScanResult richiesti
   ↓
evaluateSectionExposure()
   ↓
Controlla requiredModules + anyModules
   ↓
Inferisce geoLevel dalla sorgente primaria
   ↓
Se solo comunale → "reduced" (label prudenti)
Se sub-comunale → "shown"
Se mancante → "hidden"
```

## Cosa resta fuori scope oggi

- Rollout nazionale automatico (richiede dataset reali per ogni regione)
- Aggiornamento automatico del registro da import job (oggi è sync manuale admin)
- Coverage per singolo comune (oggi è a livello di dataset)
- Gating granulare per singolo campo del report (oggi è per sezione)

## Relazione con il report pubblico

Il Data Backbone non cambia il contenuto del report — rafforza la governance.
Le sezioni continuano a usare `reportMapper.ts` per il contenuto effettivo.
Il backbone aggiunge:
- Tracciabilità di perché una sezione compare
- Diagnostica admin su stato reale dei dati
- Base per estensione futura senza riscritture
