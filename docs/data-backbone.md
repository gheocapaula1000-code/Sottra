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
| `geographic_scope` | Ambito: `nazionale` / `regionale` / `macrozonale` / `parziale` |
| `regions_supported` | Array di regioni coperte (per fonti regionali) |
| `report_sections_supported` | Sezioni del report che questa fonte alimenta |
| `current_coverage_status` | `available` / `partial` / `unavailable` |
| `record_count` | Numero record reali nel DB |

### 2. Macrozone Nazionali (`src/lib/macrozoneRegistry.ts`)

Registro centrale delle 5 macrozone italiane con mapping canonico regioni→macrozona.

| Macrozona | Regioni |
|-----------|---------|
| **Nord-Ovest** | Piemonte, Valle d'Aosta, Lombardia, Liguria |
| **Nord-Est** | Trentino-Alto Adige, Veneto, Friuli-Venezia Giulia, Emilia-Romagna |
| **Centro** | Toscana, Umbria, Marche, Lazio |
| **Sud** | Abruzzo, Molise, Campania, Puglia, Basilicata, Calabria |
| **Isole** | Sicilia, Sardegna |

Il mapping è centralizzato e non duplicato — tutti i moduli importano da `macrozoneRegistry.ts`.

### 3. Gerarchia Geografica

Il sistema distingue 7 livelli ordinati dal più preciso al più grossolano:

```
sub_comunale > comunale > provinciale > regionale > macrozonale > nazionale > non_determinato
```

Il report usa sempre il livello migliore disponibile. La macrozona è un **fallback**, non il pilastro principale.

### 4. Exposure Policy Engine (`src/lib/dataBackbone.ts`)

Modulo TypeScript che valuta, per ogni sezione del report, se deve comparire.

```typescript
const decision = evaluateSectionExposure("profiloArea", scanResult, registry);
// → { decision: "shown" | "hidden" | "reduced", reason: "...", ... }
```

Regole:
- **hidden**: requisiti minimi non soddisfatti (moduli mancanti)
- **reduced**: dati disponibili solo a livello comunale o macrozonale (label prudenti)
- **shown**: dati reali a livello sub-comunale o zone specifiche

Ogni sezione dichiara `allowsMacrozoneFallback` — solo le sezioni abilitate possono usare dati macrozonali.

### 5. Sub-Municipal Gate (`evaluateSubMunicipalGate`)

Gating data-driven per l'arricchimento sub-comunale:
- Nessun hardcode "if Lombardia"
- Basato su dati effettivamente presenti nel match ASC + R03
- Se R03 non è importato → nessun blocco statistico
- Se R03 è presente ma coverage parziale → etichettato chiaramente
- Ora risolve anche la macrozona di appartenenza per contesto

## Come funzionano le macrozone

### Quando il report usa la macrozona

La macrozona viene usata **solo** quando:
1. Non esiste un livello più fine per quel blocco/dato
2. La sezione del report consente il fallback macrozonale (`allowsMacrozoneFallback = true`)
3. La fonte è reale e supportata nel backbone
4. Il dato è chiaramente etichettato come "macrozonale"

### Quando NON si usa la macrozona

- Se esiste un dato sub-comunale → usa quello
- Se esiste un dato comunale → usa quello
- Se la sezione non lo consente (es. profiloRapido, immobileFacciata) → mai
- Se il dato macrozonale non è disponibile → unavailable, niente fallback finto

### Distinzione critica: regionale vs macrozonale

Una fonte con `geographic_scope = "regionale"` copre **solo** le regioni esplicitamente dichiarate in `regions_supported`.
Non viene mai promossa automaticamente a coprire l'intera macrozona di appartenenza.

Esempio: una fonte che dichiara `regions_supported: ["Veneto"]` con scope `regionale`:
- ✅ copre Veneto (codice 05)
- ❌ NON copre Emilia-Romagna (codice 08), anche se entrambe sono nel Nord-Est

Una fonte con `geographic_scope = "macrozonale"` copre tutte le regioni della macrozona
a cui appartengono le regioni dichiarate.

Questo impedisce di sovrastimare la copertura reale e di mostrare dati fuori perimetro.

### Come viene assegnato un comune alla macrozona

Via `getMacrozoneByRegionCode(codiceRegione)` — mapping deterministico ISTAT.
Il codice regione è un campo standard nei dataset territoriali italiani.

### Perché la macrozona non sostituisce i livelli più fini

La gerarchia è rigida: `isGeoLevelAtLeast("macrozonale", "comunale")` → `false`.
Un dato macrozonale non può mai "vincere" su un dato comunale nel resolver.

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
3. Specificare `geographic_scope` (nazionale, regionale, macrozonale)
4. Implementare l'importer e il parsing
5. Dopo il primo import validato, aggiornare `dataset_status` a `pilot` o `active`
6. Il motore di esposizione lo includerà automaticamente dove supportato

### Aggiungere fonti macrozonali future

Il sistema è pronto per:
- Fonte disponibile solo per una macrozona → `geographic_scope = "macrozonale"`, `regions_supported = ["Lombardia", ...]`
- Fonte nazionale con breakdown macrozonale → `geographic_scope = "nazionale"`, livello `macrozonale`
- Futura estensione da macrozona → regione → comune quando i dati arrivano
- Nessuna riscrittura architetturale necessaria

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
Se sub-comunale → "shown"
Se comunale → "reduced" (label prudenti)
Se macrozonale → "reduced" (label macrozona)
Se mancante → "hidden"
```

## Console Admin "Stato Vero dei Dati"

La pagina `/admin/data-backbone` mostra:
- Tutte le fonti registrate con stato, copertura, livello geografico
- Copertura per macrozona (quante fonti attive per ciascuna delle 5 aree)
- Relazione fonte → sezioni report
- Timestamp ultimo import e validazione
- Possibilità di sincronizzare conteggi reali

## Cosa resta fuori scope oggi

- Rollout nazionale automatico (richiede dataset reali per ogni regione)
- Fonti macrozonali reali (il modello è pronto, le fonti vanno ancora reperite)
- Aggiornamento automatico del registro da import job (oggi è sync manuale admin)
- Coverage per singolo comune (oggi è a livello di dataset)
- Gating granulare per singolo campo del report (oggi è per sezione)

## Relazione con il report pubblico

Il Data Backbone non cambia il contenuto del report — rafforza la governance.
Le sezioni continuano a usare `reportMapper.ts` per il contenuto effettivo.
Il backbone aggiunge:
- Tracciabilità di perché una sezione compare
- Diagnostica admin su stato reale dei dati
- Gerarchia geografica rigida che evita overclaim
- Supporto macrozone per estensione nazionale futura
- Base per estensione futura senza riscritture
