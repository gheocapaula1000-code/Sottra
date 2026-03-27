# Pipeline Demografica Sub-Comunale — Sottra

## Causa tecnica del fallback comunale

La pipeline ISTAT SDMX (`esploradati.istat.it`) fornisce dati solo a livello comunale.
Le API ISTAT non espongono endpoint pubblici per sezioni censuarie o quartieri.
Per ottenere dati sub-comunali servono dataset scaricabili dall'ISTAT o da fonti comunali.

## Architettura attuale

```
Coordinate (lat, lng)
    │
    ├─> identifyMunicipality() → codice catastale + ISTAT
    │
    ├─> querySubMunicipalDemographics()
    │     ├─ Strategy 1: JOIN via zona_omi (se OMI ha trovato la zona)
    │     ├─ Strategy 2: Point-in-polygon su polygon_coords
    │     ├─ Selezione miglior record (selectBestRecord)
    │     └─ Se match → return sub-municipal data (geoLevel: microzona/quartiere)
    │
    └─> queryIstatSdmx() → fallback comunale (geoLevel: comune)
```

### Post-processing

Dopo che OMI e ISTAT terminano in parallelo, se ISTAT è comunale e OMI ha trovato una zona,
si ritenta `querySubMunicipalDemographics` con il `zona_omi` trovato da OMI.

### Selezione miglior record (selectBestRecord)

Quando esistono più record candidati per la stessa zona, priorità deterministica:

1. **Coverage più preciso** (`microzona > sezione_censimento > zona > quartiere > area_subcomunale > comune`)
2. **Anno più recente** (`anno_rilevazione` DESC)
3. **Fonte ufficiale** (`is_official = true` prioritaria)
4. **Qualità dato** (`alto > standard > basso`)
5. **Presenza zona_omi** (record con zona_omi vince su quelli senza)
6. **Più metriche** (record con più campi compilati)

Il `selectionReason` spiega perché un record è stato scelto (es. `migliore_per_copertura_più_precisa`).
Il `matchMethod` e `matchConfidence` sono propagati fino alla UI per totale trasparenza.

## Tabella `demographic_zones`

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| codice_comune_catastale | text | Codice Belfiore |
| zona_key | text | Chiave univoca zona (UNIQUE con codice_comune) |
| zona_label | text | Nome leggibile |
| zona_type | text | microzona_omi, quartiere, sezione_censuaria, circoscrizione, zona_statistica |
| zona_omi | text? | Link a zona OMI |
| polygon_coords | jsonb? | Poligono per point-in-polygon |
| centroid_lat/lng | numeric? | Centroide (auto-calcolato se mancante) |
| popolazione, densita, eta_media, ... | numeric? | Metriche demografiche |
| coverage_level | text | zona, quartiere, comune, microzona, sezione_censimento, area_subcomunale |
| data_quality | text | alto, standard, basso |
| is_official | boolean | Se fonte istituzionale |
| source_label, source_type | text | Metadati fonte |
| import_batch_id | text? | ID batch per rollback |
| source_file | text? | Nome file sorgente |

### Vincolo univoco

`UNIQUE (zona_key, codice_comune_catastale, anno_rilevazione, source_label)` — garantisce idempotenza multi-anno e multi-source.

`anno_rilevazione` è NOT NULL con default `'0000'` per garantire il vincolo composito.

### Chiave di deduplica

La chiave logica per l'idempotenza è `zona_key + codice_comune_catastale + anno_rilevazione + source_label`.

**Perché non basta `zona_key + codice_comune_catastale`:**
- Schiaccia versioni temporali diverse della stessa zona (es. dati 2021 e 2023)
- Impedisce la coesistenza di fonti diverse per la stessa zona (es. ISTAT vs Open Data comunale)
- Rende impossibile il versioning naturale dei dati territoriali

**Con la nuova chiave composita:**
- Un **duplicato** è un record con la stessa combinazione di tutti e 4 i campi.
- Un **update** avviene solo quando arriva un record con la stessa entità logica esatta (stessa zona, stesso anno, stessa fonte).
- Record con anno diverso coesistono naturalmente — il resolver `selectBestRecord` sceglie il più recente.
- Record con fonte diversa coesistono — il resolver preferisce quello ufficiale.

## Priorità di scelta del dato

1. **Sub-comunale diretto** (zona_omi match) → `geoLevel: microzona`
2. **Sub-comunale spaziale** (point-in-polygon) → `geoLevel: quartiere`
3. **Comunale ISTAT** (SDMX API) → `geoLevel: comune` (fallback trasparente)
4. **Non disponibile** → `sourceType: unavailable`

## Deduplica e idempotenza

- Chiave unica: `(zona_key, codice_comune_catastale, anno_rilevazione, source_label)`
- Upsert con `onConflict` su questa chiave: se lo stesso record arriva di nuovo, viene aggiornato
- Anni diversi della stessa zona coesistono come record separati
- Fonti diverse della stessa zona coesistono come record separati
- `import_batch_id` consente rollback per batch
- Duplicati intra-batch: il sistema tiene l'ultima occorrenza

## Primo import reale ISTAT

### Prerequisiti

1. Scaricare shapefile/GeoJSON sezioni censuarie ISTAT 2021
2. Convertire in GeoJSON se necessario (con `ogr2ogr` o tool QGIS)
3. Associare metriche demografiche (join per codice sezione)
4. Verificare che ogni feature abbia: `codice_comune_catastale`, `zona_key`, `zona_label`

### Flusso operativo

1. Accedere a `/admin/demographic-import` come admin
2. Caricare il file GeoJSON o CSV
3. **Mapping campi**: il sistema mostra le colonne sorgente e consente di mapparle ai campi target
4. **Valori predefiniti**: impostare coverage_level, data_quality, source_label, anno_rilevazione, is_official
5. **Validazione**: il backend verifica schema, calcola centroidi mancanti, conta validi/invalidi
6. **Preview**: riepilogo con conteggi, comuni distinti, coverage levels, errori per riga
7. **Commit**: import idempotente in chunk da 500 con batch_id
8. **Rollback**: eliminazione per batch_id se necessario

### Formati supportati

- **GeoJSON** FeatureCollection con proprietà demografiche nelle properties
- **CSV** con colonne mappabili ai campi target

### Mapping campi

Il sistema supporta mapping configurabile tra colonne sorgente e campi target:
- Le colonne con nome identico al campo target sono auto-mappate
- L'admin può associare manualmente ogni colonna sorgente
- I valori predefiniti (defaults) vengono applicati ai campi non presenti nel file

### Stats post-import

L'action `stats` restituisce:
- Record totali
- Comuni distinti coperti
- Breakdown per coverage_level, anno, fonte, ufficialità
- Percentuale record con geometria e centroide validi
- Record matchabili via zona_omi vs point-in-polygon

## Import dei dati reali

### Flusso admin

Pagina admin `/admin/demographic-import` con:
- Upload GeoJSON o CSV
- Mapping campi configurabile
- Valori predefiniti per batch
- Validazione server-side (campi, tipi, geometrie)
- Anteprima record validi/scartati con metadati
- Import batch con ID univoco
- Rollback per batch recenti
- Stats con breakdown dettagliati
- Auto-calcolo centroide se mancante

### Edge Function `demographic-import`

Actions disponibili:
- `validate` — validazione con field mapping e defaults, senza scrittura
- `import` — upsert idempotente in chunk da 500 con dedup intra-batch
- `rollback` — elimina un batch per import_batch_id
- `list-batches` — lista batch importati con metadati
- `stats` — conteggio con breakdown per coverage, anno, fonte, ufficialità, geometrie

### Fonti utilizzabili
- ISTAT Censimento Permanente (sezioni censuarie con geometrie)
- Dataset comunali aperti (es. Padova Open Data)
- Dati Agenzia delle Entrate georeferenziati
- Dataset IDISE (come layer aggiuntivo, non sostitutivo)

### Cosa serve per attivare
1. Scaricare shapefile/GeoJSON sezioni censuarie ISTAT
2. Convertire in GeoJSON se necessario
3. Effettuare join con metriche demografiche
4. Caricare nella tabella `demographic_zones` via pagina admin

## Indice di Vicinato

Composito da 5 sotto-dimensioni:
- **Servizi** (peso 25%): POI Overpass, diversità categorie
- **Commerciale** (peso 15%): attività commerciali, varietà
- **Demografico** (peso 25%): densità, età, composizione
- **Qualità territoriale** (peso 20%): rischio invertito
- **Mercato** (peso 15%): quotazioni OMI, stabilità

Copertura minima: 3 dimensioni su 5 per calcolare il punteggio.
Quando i dati demografici sono comunali, la nota lo dichiara esplicitamente.

## Sicurezza / Criminalità

Tabella `safety_zones` predisposta ma **non esposta in UI** finché non viene
importata una fonte reale georeferenziata. Fonti possibili:
- Dati SDI (Ministero dell'Interno) per provincia/comune
- Open data comunali su reati per quartiere
- Dati percezione sicurezza da indagini ISTAT

Per attivare: popolare la tabella e aggiungere query in `pro-sources`.

## Residui chiusi prima del primo dataset reale

### Vincolo UNIQUE legacy neutralizzato

Il vecchio vincolo `demographic_zones_zona_key_comune_unique` su `(zona_key, codice_comune_catastale)`
è stato rimosso tramite migration correttiva. Questo vincolo impediva la coesistenza di record
multi-anno e multi-source per la stessa zona, schiacciando versioni temporali diverse.

L'unico vincolo UNIQUE attivo ora è `demographic_zones_dedup_key` su
`(zona_key, codice_comune_catastale, anno_rilevazione, source_label)`.

La migration è idempotente: elimina dinamicamente qualsiasi constraint UNIQUE legacy
che non sia `demographic_zones_dedup_key`, inclusi nomi imprevisti da migrazioni precedenti.

### Parser CSV pronto per dataset ISTAT reali

Il parser CSV dell'admin è stato riscritto per supportare:
- Campi quotati con virgole o punti e virgola interni
- Separatore `,` o `;` (auto-rilevato dalla prima riga)
- BOM UTF-8 (rimosso automaticamente)
- Righe vuote (ignorate)
- Quote escaped con raddoppio (`""`)
- Line endings CRLF e LF

### Unico blocker residuo

A questo punto l'unico blocker reale per avere dati sub-comunali è il **reperimento e caricamento
del primo dataset ISTAT con geometrie censuarie/sub-comunali** (shapefile o GeoJSON delle sezioni
di censimento 2021 con attributi demografici associati).

---

## Fase 0 preparatoria — Integrazione ASC/Sezioni censuarie 2021

### Dataset attesi

| Dataset | Contenuto | Copertura |
|---------|-----------|-----------|
| `ASC_21` | Aree Sub Comunali ISTAT 2021 — 3 livelli (Liv1, Liv2, Liv3) | Nazionale |
| `R03_21` | Sezioni censuarie Lombardia 2021 con tabelle demografiche | Regionale (Lombardia) |

### Campi attesi nei dataset ASC_21 (da documentazione ISTAT)

- `PRO_COM_T` — codice ISTAT comune (testo, 6 cifre)
- `COD_REG` — codice regione
- `COD_PRO` — codice provincia
- `DEN_PROV` — denominazione provincia
- `DEN_REG` — denominazione regione
- `DEN_COM` — denominazione comune
- `COD_ASC` — codice area sub-comunale
- `DEN_ASC` — denominazione area sub-comunale
- `POP_RES` — popolazione residente
- Geometria poligonale nel shapefile

### Campi attesi nei dataset R03_21 (da documentazione ISTAT)

Tabelle CSV associate:
- `SEZ_R03_21.csv` — attributi sezioni censuarie
- `ASC1_R03_21.csv` — aggregati livello ASC 1
- `ASC2_R03_21.csv` — aggregati livello ASC 2
- `LOC_R03_21.csv` — dati per località

Chiavi di join: `SEZ2011`, `PRO_COM`, `COD_REG`

### Nuova tabella `sub_municipal_areas_2021`

Tabella dedicata, separata da `demographic_zones`, per i dati ASC/sezioni ISTAT 2021.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | uuid | PK |
| source_dataset | text | 'ASC_21' o 'R03_21' |
| source_year | integer | 2021 |
| source_label | text | Es. 'ISTAT Censimento 2021' |
| asc_level | integer | 1, 2, 3 (livello ASC) o NULL per sezioni |
| area_code | text | Codice ISTAT area |
| area_name | text | Denominazione |
| area_type | text | area_sub_comunale, sezione_censuaria, localita |
| comune_istat_code | text | Codice ISTAT comune |
| comune_catastale_code | text | Codice Belfiore |
| comune_name | text | Denominazione comune |
| provincia_code | text | Codice provincia |
| provincia_name | text | Denominazione provincia |
| regione_code | text | Codice regione |
| regione_name | text | Denominazione regione |
| popolazione | integer | Popolazione residente |
| nuclei_familiari | integer | Nuclei familiari |
| densita | numeric | Densità abitativa |
| eta_media | numeric | Età media |
| superficie_kmq | numeric | Superficie in km² |
| centroid_lat/lng | numeric | Centroide (auto-calcolato) |
| bbox | jsonb | Bounding box |
| polygon_coords | jsonb | Geometria GeoJSON |
| metadata_json | jsonb | Attributi extra dal dataset |
| import_batch_id | text | ID batch per rollback |

**Chiave univoca:** `UNIQUE (source_dataset, asc_level, area_code)`

**Indici:** centroid, comune_catastale_code+asc_level, regione_code+asc_level

**RLS:** admin full access, authenticated read-only

### Moduli preparati (non attivi nel motore pubblico)

| Modulo | File | Stato |
|--------|------|-------|
| Importer astratto | `src/lib/subMunicipalImporter.ts` | Pronto, non eseguito |
| Point-in-polygon | `src/lib/pointInPolygon.ts` | Pronto, non collegato al report |
| Admin view tecnica | `src/pages/AdminSubMunicipal.tsx` | Pronta, route `/admin/sub-municipal` |
| Test | `src/test/subMunicipal.test.ts` | Copertura validazione + PIP |

### Cosa NON è ancora attivo

- Nessun dato demografico sub-comunale mostrato nel report pubblico da questa tabella
- Nessun import automatico eseguito
- Il motore pubblico di Sottra continua a usare `demographic_zones` + ISTAT SDMX per la demografia

### Prossimi step per attivazione

1. Rendere disponibili i file `ASC_21` e `R03_21` nell'ambiente (upload o storage bucket)
2. Convertire shapefile in GeoJSON (`ogr2ogr` o equivalente)
3. Eseguire l'import nella nuova tabella via importer
4. Validare copertura e qualità geometrica
5. Attivare nel motore pubblico la parte demografica solo dopo validazione completa

---

## Fase 1 leggera — ASC come layer territoriale interno

### Cosa è stato attivato

Il layer `sub_municipal_areas_2021` è ora **collegato** al resolver territoriale `pro-sources` in modo non invasivo:

1. **pro-sources**: dopo OMI e ISTAT, esegue un lookup ASC con pre-filtro centroide (±0.5°) e point-in-polygon
2. **Output**: restituisce un campo `subMunicipalMatch` nella risposta, con shape tipizzata:
   - `available`: dataset presente nell'area
   - `matched`: punto ricade in un poligono ASC
   - `coverage_status`: "available" | "partial" | "unavailable"
   - `level`, `code`, `name`, `type`, `comune_code`, `comune_name`
   - `match_method`: "polygon"
   - `note`: descrizione tecnica del risultato
3. **Report pubblico (ProfiloRapido)**: mostra una micro-info "Area sub-comunale ISTAT" **solo quando** il match è affidabile (matched=true, coverage_status=available)
4. **Nessuna nuova sezione pesante** nel report utente
5. **Nessuna demografia sub-comunale** mostrata da questa tabella (resta da `demographic_zones`)

### Comportamento safe-by-default

| Stato tabella ASC | Comportamento pro-sources | Report pubblico |
|---|---|---|
| Vuota / no data | `subMunicipalMatch: {available: false, ...}` | Invariato |
| Dati presenti, no polygon match | `{available: true, matched: false, coverage_status: "partial"}` | Invariato |
| Dati presenti, polygon match | `{available: true, matched: true, coverage_status: "available", ...}` | Micro-info ASC in ProfiloRapido |

### Diagnostica admin

La pagina `/admin/sub-municipal` mostra:
- **Stato wiring**: se il layer è collegato e attivo
- **Badge stato**: pro-sources collegato/bypass, point-in-polygon attivo/pronto, report micro-info/invariato
- **Statistiche**: record totali, copertura geometrica, distribuzione per dataset/livello/regione
- **Test point-in-polygon**: inserisci lat/lng e verifica match ASC in tempo reale

### Perché questa fase è volutamente prudente

- Il layer ASC è un **arricchimento parallelo**, non una sostituzione di OMI o ISTAT
- Se la tabella è vuota → zero impatto sul comportamento esistente
- Se il match non è affidabile → nulla viene mostrato all'utente
- La micro-info è etichettata come "Dato ISTAT 2021 — match poligonale" per totale trasparenza
- Nessuna dipendenza hard che faccia fallire il resolver se ASC manca

### Prossimo step: pilota Lombardia con R03

→ Vedi sezione "Fase 2 pilota Lombardia R03" di seguito.

---

## Fase 2 pilota Lombardia R03 — Validazione ASC ↔ Sezioni censuarie

### Obiettivo

Usare il dataset ISTAT R03_21 (sezioni censuarie Lombardia 2021) come banco prova tecnico per:
- Validare la coerenza tra codici sezione e codici ASC
- Verificare se le sezioni si aggregano correttamente verso ASC1 / ASC2
- Preparare il terreno per arricchimento statistico sub-comunale prudente

### Cosa NON fa questa fase

- Non attiva dati demografici sub-comunali nel report pubblico
- Non estende il pilota a livello nazionale
- Non mostra popolazione/famiglie/abitazioni agli utenti
- Non introduce dati mock o derivati

### Nuova tabella `census_sections_r03_2021`

Tabella dedicata, separata da `sub_municipal_areas_2021` e `demographic_zones`.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | uuid | PK |
| source_dataset | text | 'R03_21' |
| source_year | integer | 2021 |
| section_code | text | Codice sezione ISTAT (UNIQUE con source_dataset) |
| comune_istat_code | text | PRO_COM_T |
| comune_catastale_code | text | Codice Belfiore (se disponibile) |
| comune_name | text | Denominazione comune |
| provincia_code | text | COD_PRO |
| asc1_code | text | Codice ASC livello 1 (da ASC1_R03_21.csv) |
| asc2_code | text | Codice ASC livello 2 (da ASC2_R03_21.csv) |
| asc3_code | text | Codice ASC livello 3 (se presente) |
| population_2021 | integer | P1 — popolazione residente |
| males_2021 | integer | P2 — maschi |
| females_2021 | integer | P3 — femmine |
| families_2021 | integer | P14/ST1 — nuclei familiari |
| dwellings_2021 | integer | A1 — abitazioni totali |
| occupied_dwellings_2021 | integer | A2 — abitazioni occupate |
| buildings_2021 | integer | E3 — edifici totali |
| residential_buildings_2021 | integer | E1 — edifici residenziali |
| superficie_kmq | numeric | Superficie |
| centroid_lat/lng | numeric | Centroide |
| polygon_coords | jsonb | Geometria GeoJSON |
| metadata_json | jsonb | Attributi extra |
| import_batch_id | text | ID batch per rollback |

**Chiave univoca:** `UNIQUE (source_dataset, section_code)`

### File CSV attesi dal pacchetto R03_21

| File | Contenuto | Colonne chiave |
|------|-----------|----------------|
| `SEZ_R03_21.csv` | Sezioni con variabili demografiche | SEZ2021, PRO_COM_T, COD_PRO, P1, P2, P14, A2, E3 |
| `ASC1_R03_21.csv` | Mapping sezioni → ASC livello 1 | SEZ2021, COD_ASC, PRO_COM_T |
| `ASC2_R03_21.csv` | Mapping sezioni → ASC livello 2 | SEZ2021, COD_ASC, PRO_COM_T |
| Shapefile (.shp) | Geometrie sezioni | Geometria poligonale |

### Importer R03

File: `src/lib/r03Importer.ts`

Funzionalità:
- `parseCsvToRecords()` — parser CSV robusto (`;`/`,`, BOM, quoted fields)
- `mapSezCsvRow()` — mappa colonne ISTAT reali ai campi del record
- `buildAscMappings()` — costruisce mapping sezioni → codici ASC da ASC1/ASC2 CSV
- `validateR03Record()` — validazione con bounds Lombardia
- `importR03Sections()` — upsert idempotente in chunk da 500
- `fetchR03Stats()` — statistiche import
- `validateAscSectionCoherence()` — confronto codici ASC tra sezioni e layer ASC

### Validazione ASC ↔ Sezioni (level-aware, scoped)

Il modulo `validateAscSectionCoherence()` confronta in modo **level-aware** e **scoped**:

- **Level-aware**: i codici `asc1_code` delle sezioni vengono confrontati solo con record ASC di `asc_level=1` nel layer, `asc2_code` solo con `asc_level=2`, ecc. Nessun falso match tra livelli diversi con codici uguali.
- **Scoped a R03**: il layer ASC nazionale viene filtrato ai soli comuni presenti in `census_sections_r03_2021`. Le metriche non sono distorte da ASC di regioni non coperte dal pilota.

Metriche esposte per livello (`AscLevelMatchDetail`):
- `codesInSections` / `codesInLayer` — codici distinti per livello
- `matched` / `unmatchedInSections` / `unmatchedInLayer` — matching bidirezionale
- `coveragePct` — % di codici sezione che trovano corrispondenza nel layer (scoped)

Metriche aggregate:
- `sectionsWithAsc1Pct` / `sectionsWithAsc2Pct` — % sezioni con codice ASC
- `sectionsWithoutAscPct` — % sezioni senza alcun codice ASC
- `r03ComuniCovered` — numero comuni nel perimetro R03

### Diagnostica admin

La pagina `/admin/sub-municipal` include:
- Badge stato R03: caricato / non disponibile
- Statistiche R03: sezioni, comuni, popolazione, geometrie, codici ASC
- Pulsante "Esegui validazione" ASC ↔ sezioni
- Risultati validazione con mismatch dettagliati
- Test point-in-polygon ASC

### Stato attuale

L'importer e il validatore sono **pronti ma non eseguiti** (ready but not executed).
Il dataset R03_21 reale non è ancora stato importato.

---

## Fase 3 operativa — upload admin, import reale e pilota Lombardia usabile

### Cosa è stato implementato

1. **Storage bucket** `territorial-datasets` — bucket privato per upload admin di file CSV ISTAT
2. **Tabella `territorial_dataset_jobs`** — tracking import con stati: uploaded → validating → importing → imported/failed
3. **Edge function `territorial-import`** — processa CSV caricati, supporta:
   - `ASC_2021` — aree sub-comunali nazionali → `sub_municipal_areas_2021`
   - `R03_CSV_SEZ` — sezioni censuarie Lombardia → `census_sections_r03_2021`
   - `R03_CSV_ASC1` / `R03_CSV_ASC2` — mapping sezioni→ASC (registrati per uso durante import SEZ)
4. **Console admin `/admin/sub-municipal`** — interfaccia completa con:
   - Upload file per tipo dataset
   - Lista job con stato e azioni
   - Stats ASC e R03 in tempo reale
   - Validazione ASC↔sezioni
   - Test point-in-polygon
5. **Arricchimento report pubblico** — in `buildProfiloArea`, se ASC match affidabile con dati popolazione:
   - Mostra "Contesto sub-comunale ISTAT" con popolazione
   - Mostra "Densità area sub-comunale" se disponibile
   - Solo dati reali, solo match poligonale, solo se coverage=available
6. **Validazione automatica post-import** — eseguita dopo ogni import, risultati salvati nel job

### Formati supportati

| Tipo | File atteso | Colonne chiave |
|------|-------------|----------------|
| ASC_2021 | CSV aree sub-comunali | COD_ASC, DEN_ASC, PRO_COM_T, POP_RES, COD_REG |
| R03_CSV_ASC1 | ASC1_R03_21.csv | SEZ2021, COD_ASC |
| R03_CSV_ASC2 | ASC2_R03_21.csv | SEZ2021, COD_ASC |
| R03_CSV_SEZ | SEZ_R03_21.csv | SEZ2021, PRO_COM_T, P1, P14, A2, E3 |

### Ordine di import R03

1. Caricare e importare ASC1 + ASC2 (registra i mapping)
2. Caricare e importare SEZ (usa automaticamente i mapping ASC)
3. Validare ASC↔sezioni dalla console

### Feature gating

- Arricchimento sub-comunale attivo solo se `subMunicipalMatch.matched=true`, `coverage_status=available`, e `popolazione > 0`
- Se dataset assente → nessun impatto, comportamento OMI/ISTAT invariato
- Nessun crash se pipeline incompleta

### Cosa NON è ancora attivo

- Nessuna estensione nazionale automatica
- Nessun dato criminalità/safety_zones esposto
- Nessuna demografia sub-comunale fuori pilota Lombardia
- Nessun claim territoriale forte nel report

### Prossimi step

1. Caricare dataset reali ASC_21 + R03_21 via console admin
2. Verificare coerenza su comuni pilota (Milano, Brescia)
3. Estendere ad altre regioni se validazione positiva

## Fase 4 — Pilota Lombardia chiuso lato report pubblico

### Obiettivo

Completare il pilota Lombardia trasformando R03 in un arricchimento pubblico reale e verificabile nel report utente. La logica è: sezioni censuarie R03 vengono aggregate per area sub-comunale (ASC), e il report mostra i dati aggregati solo quando tutte le condizioni di gating sono soddisfatte.

### Aggregazione R03 → ASC

Una nuova tabella `r03_asc_aggregates_2021` contiene gli aggregati per area ASC:
- Popolazione, famiglie, abitazioni, edifici (sommati dalle sezioni)
- Densità abitativa (calcolata solo se superficie disponibile dal layer ASC)
- Coverage status: `available` (≥80% sezioni con dato), `partial`, `unavailable`
- Derivation notes che documentano sezioni mancanti o mismatch

L'aggregazione è lanciabile da admin (`/admin/sub-municipal`) e produce un batch idempotente con upsert su `(source_dataset, asc_level, asc_code)`.

### Arricchimento nel report pubblico

Il report mostra dati R03 in ProfiloArea **solo** quando:
1. `subMunicipalMatch.matched = true` (match poligonale)
2. `r03_enriched = true` (aggregato R03 trovato)
3. `r03_coverage = "available"` o `"partial"`
4. `r03_population > 0`

Indicatori mostrati (se disponibili):
- Residenti area sub-comunale
- Densità ab/km²
- Nuclei familiari
- Abitazioni
- Nota pilota Lombardia con indicazione copertura

### Gating territoriale

- Fuori Lombardia: comportamento invariato (solo micro-info ASC se presente)
- Lombardia senza aggregato: nessun blocco statistico R03
- Lombardia con aggregato partial: dati etichettati come parziali
- Lombardia con aggregato available: blocco prudente completo

### Cosa NON viene mostrato

- Dati sub-comunali fuori Lombardia
- Statistiche nazionali inventate
- Indicatori senza base numerica reale
- Claim di copertura oltre il perimetro del pilota

### Prossimi step

1. Caricare dataset reali e lanciare aggregazione
2. Verificare report su comuni pilota
3. Valutare estensione ad altre regioni con lo stesso modello
