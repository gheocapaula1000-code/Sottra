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
