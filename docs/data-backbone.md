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
| `geographic_level_supported` | Livello geo supportato (zona_omi, localita, comune, quartiere, coordinate) |
| `geographic_scope` | Ambito: `nazionale` / `regionale` / `macrozonale` / `parziale` |
| `regions_supported` | Array di regioni coperte (per fonti regionali) |
| `report_sections_supported` | Sezioni del report che questa fonte alimenta |
| `current_coverage_status` | `available` / `partial` / `unavailable` |
| `record_count` | Numero record reali nel DB |

### 2. Backbone Territoriale Nazionale

Il backbone territoriale è costruito su una gerarchia ufficiale a 7 livelli:

1. **Microzona OMI** — match poligonale con perimetri Agenzia delle Entrate
2. **Zona specifica** — ASC/R03 con arricchimento statistico (es. Lombardia)
3. **Quartiere** — ASC senza R03, o demographic_zones sub-comunali
4. **Località** — località ufficiali ISTAT collegate al comune
5. **Comune** — livello base nazionale sempre disponibile
6. **Macrozona** — fallback a 5 aree (Nord-Ovest, Nord-Est, Centro, Sud, Isole)
7. **Nazionale** — ultimo fallback

### 3. Risoluzione Territoriale (TerritorialResolution)

Il sistema distingue sempre tra:
- **Livello identificato** (`identified_geo_level`): dove si trova il punto
- **Livello del dato** (`data_coverage_level`): a quale granularità il dato è disponibile

Esempio: posizione identificata in una località, ma dato disponibile solo a livello comunale.
In questo caso il report mostra il dato con avviso esplicito.

Questo impedisce overclaim: il report non finge mai precisione sub-comunale se il dato è comunale.

### 4. Priorità tra fonti

Ordine di priorità per identificazione: OMI polygon > ASC polygon > Località > Comune
Ordine per dati: R03/ASC enriched > OMI quotazioni > ISTAT comunale

Regole:
- OMI resta prioritario per dati immobiliari/economici
- Lombardia conserva la maggiore ricchezza sub-comunale
- Una fonte regionale copre SOLO le regioni dichiarate (nessuna promozione a macrozona)
- Una fonte macrozonale copre tutte le regioni della macrozona dichiarata

| Livello | Descrizione | Stato |
|---------|-------------|-------|
| **Sub-comunale (ASC)** | Aree Sub Comunali ISTAT 2021 | Pilota Lombardia, predisposto nazionale |
| **Località** | Località ufficiali ISTAT | Predisposto, non ancora importato |
| **Comune** | Anagrafe comuni ISTAT | Predisposto, OMI già attivo a livello comunale |
| **Macrozona** | 5 aree (Nord-Ovest, Nord-Est, Centro, Sud, Isole) | Attivo come fallback |

#### Differenza tra Comune, Località, ASC e Pilota Statistico

- **Comune**: unità amministrativa base. Sempre disponibile come fallback.
- **Località**: suddivisione ufficiale ISTAT del comune (frazioni, borgate, nuclei). Più precisa del comune ma meno dell'ASC. Non ancora attiva come fonte dati.
- **ASC (Area Sub-Comunale)**: layer poligonale ISTAT per la suddivisione censuaria. Disponibile come layer territoriale.
- **Pilota statistico**: ASC + sezioni censuarie (R03) con dati demografici aggregati. Attivo solo in Lombardia.

#### Cosa viene mostrato nel report e con quale priorità

```
Sub-comunale R03 (se pilota attivo)
  → ASC layer (se match poligonale)
    → Località ISTAT (se disponibile)
      → Comune (fallback)
        → Macrozona (solo per sezioni abilitate)
```

#### Cosa NON è ancora supportato

- **Vie/civici**: il livello stradale/civico (ANNSCU, SNC) non è attivo. Il modello è predisposto
  per accoglierlo in futuro, ma non viene né dichiarato né esposto nel report attuale.

### 3. Macrozone Nazionali (`src/lib/macrozoneRegistry.ts`)

Registro centrale delle 5 macrozone italiane con mapping canonico regioni→macrozona.

| Macrozona | Regioni |
|-----------|---------|
| **Nord-Ovest** | Piemonte, Valle d'Aosta, Lombardia, Liguria |
| **Nord-Est** | Trentino-Alto Adige, Veneto, Friuli-Venezia Giulia, Emilia-Romagna |
| **Centro** | Toscana, Umbria, Marche, Lazio |
| **Sud** | Abruzzo, Molise, Campania, Puglia, Basilicata, Calabria |
| **Isole** | Sicilia, Sardegna |

### 4. Gerarchia Geografica

Il sistema distingue 8 livelli ordinati dal più preciso al più grossolano:

```
sub_comunale > zona_specifica > quartiere > localita > comunale > macrozonale > nazionale > non_determinato
```

Il report usa sempre il livello migliore disponibile.

### 5. Exposure Policy Engine (`src/lib/dataBackbone.ts`)

Modulo TypeScript che valuta, per ogni sezione del report, se deve comparire.

```typescript
const decision = evaluateSectionExposure("profiloArea", scanResult, registry);
// → { decision: "shown" | "hidden" | "reduced", reason: "...", ... }
```

Regole:
- **hidden**: requisiti minimi non soddisfatti (moduli mancanti)
- **reduced**: dati disponibili solo a livello comunale o macrozonale (label prudenti)
- **shown**: dati reali a livello sub-comunale, località o zone specifiche

### 6. Sub-Municipal Gate (`evaluateSubMunicipalGate`)

Gating data-driven per l'arricchimento sub-comunale:
- Basato su dati effettivamente presenti nel match ASC + R03
- Se R03 non è importato → nessun blocco statistico
- Supporta anche località come livello intermedio

## Distinzione critica: regionale vs macrozonale

Una fonte con `geographic_scope = "regionale"` copre **solo** le regioni esplicitamente dichiarate.
Non viene mai promossa a coprire l'intera macrozona di appartenenza.

Una fonte con `geographic_scope = "macrozonale"` copre tutte le regioni della macrozona
a cui appartengono le regioni dichiarate.

## Come si aggiungono nuove fonti

1. Inserire un record in `data_source_registry` con `dataset_status = "inactive"`
2. Specificare `geographic_level_supported` (localita, comune, sub_comunale, etc.)
3. Specificare `geographic_scope` e `regions_supported`
4. Implementare l'importer
5. Dopo il primo import validato, aggiornare `dataset_status` a `pilot` o `active`

## Come estendere il sistema senza rifare l'architettura

- **Nuova regione ASC**: importare shapefile + aggiornare registry → il resolver lo troverà automaticamente
- **Località ISTAT**: importare dataset località → il report le userà come livello intermedio
- **Vie/civici (futuro)**: aggiungere livello `via_civico` nella gerarchia → il resolver lo preferirà sugli altri
- **Nuova fonte macrozonale**: registrare con `geographic_scope = "macrozonale"` → il backbone la gestirà

## Console Admin "Stato Vero dei Dati"

La pagina `/admin/data-backbone` mostra:
- **Backbone Territoriale**: panoramica dei 4 livelli (comuni, località, ASC, piloti) con conteggi
- **Copertura Macrozone**: fonti attive per ciascuna delle 5 aree
- **Registro Fonti**: dettaglio completo di ogni fonte con stato e sezioni alimentate

## Cosa resta fuori scope oggi

- Dataset località ISTAT (il binario è pronto, il dataset va ancora importato)
- Anagrafe completa comuni (usa OMI/ISTAT come fonti indirette)
- Livello vie/civici (predisposto nei tipi, non attivo)
- Rollout nazionale R03/ASC statistico (solo Lombardia pilota)
