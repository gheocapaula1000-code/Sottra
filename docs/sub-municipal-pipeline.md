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

`UNIQUE (zona_key, codice_comune_catastale)` — garantisce idempotenza degli import.

## Priorità di scelta del dato

1. **Sub-comunale diretto** (zona_omi match) → `geoLevel: microzona`
2. **Sub-comunale spaziale** (point-in-polygon) → `geoLevel: quartiere`
3. **Comunale ISTAT** (SDMX API) → `geoLevel: comune` (fallback trasparente)
4. **Non disponibile** → `sourceType: unavailable`

## Deduplica e idempotenza

- Chiave unica: `(zona_key, codice_comune_catastale)`
- Upsert con `onConflict` su questa chiave: se lo stesso record arriva di nuovo, viene aggiornato
- Nessun duplicato logico possibile per la stessa zona nello stesso comune
- `import_batch_id` consente rollback per batch

## Import dei dati reali

### Flusso admin

Pagina admin `/admin/demographic-import` con:
- Upload GeoJSON o CSV
- Validazione server-side (campi, tipi, geometrie)
- Anteprima record validi/scartati
- Import batch con ID univoco
- Rollback per batch recenti
- Auto-calcolo centroide se mancante
- Statistiche: comuni coperti, record totali

### Edge Function `demographic-import`

Actions disponibili:
- `validate` — validazione senza scrittura
- `import` — upsert idempotente in chunk da 500
- `rollback` — elimina un batch per import_batch_id
- `list-batches` — lista batch importati
- `stats` — conteggio record con filtri + comuni distinti

### Formati supportati
- **GeoJSON** FeatureCollection con proprietà demografiche
- **CSV** con codice zona + metriche (campi obbligatori in header)

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
