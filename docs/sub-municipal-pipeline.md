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
    │     └─ Se match → return sub-municipal data (geoLevel: microzona/quartiere)
    │
    └─> queryIstatSdmx() → fallback comunale (geoLevel: comune)
```

### Post-processing

Dopo che OMI e ISTAT terminano in parallelo, se ISTAT è comunale e OMI ha trovato una zona,
si ritenta `querySubMunicipalDemographics` con il `zona_omi` trovato da OMI.

## Tabella `demographic_zones`

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| codice_comune_catastale | text | Codice Belfiore |
| zona_key | text | Chiave univoca zona |
| zona_label | text | Nome leggibile |
| zona_type | text | microzona_omi, quartiere, sezione_censuaria, circoscrizione |
| zona_omi | text? | Link a zona OMI |
| polygon_coords | jsonb? | Poligono per point-in-polygon |
| centroid_lat/lng | numeric? | Centroide per lookup rapido |
| popolazione, densita, eta_media, ... | numeric? | Metriche demografiche |
| coverage_level | text | zona, quartiere, comune |
| data_quality | text | standard, alto, basso |
| is_official | boolean | Se fonte istituzionale |
| source_label, source_type | text | Metadati fonte |

## Priorità di scelta del dato

1. **Sub-comunale diretto** (zona_omi match) → `geoLevel: microzona`
2. **Sub-comunale spaziale** (point-in-polygon) → `geoLevel: quartiere`
3. **Comunale ISTAT** (SDMX API) → `geoLevel: comune` (fallback trasparente)
4. **Non disponibile** → `sourceType: unavailable`

## Import dei dati reali

### Fonti utilizzabili
- ISTAT Censimento Permanente (sezioni censuarie con geometrie)
- Dataset comunali aperti (es. Padova Open Data)
- Dati Agenzia delle Entrate georeferenziati

### Formato supportato
- **GeoJSON** con proprietà demografiche
- **CSV** con codice zona + metriche (richiede geometrie separate)

### Cosa serve per attivare
1. Scaricare shapefile/GeoJSON sezioni censuarie ISTAT
2. Convertire in GeoJSON se necessario
3. Effettuare join con metriche demografiche
4. Caricare nella tabella `demographic_zones` via admin

## Indice di Vicinato

Composito da 5 sotto-dimensioni:
- **Servizi** (peso 25%): POI Overpass, diversità categorie
- **Commerciale** (peso 15%): attività commerciali, varietà
- **Demografico** (peso 25%): densità, età, composizione
- **Qualità territoriale** (peso 20%): rischio invertito
- **Mercato** (peso 15%): quotazioni OMI, stabilità

Copertura minima: 3 dimensioni su 5 per calcolare il punteggio.

## Sicurezza / Criminalità

Tabella `safety_zones` predisposta ma **non esposta in UI** finché non viene
importata una fonte reale georeferenziata. Fonti possibili:
- Dati SDI (Ministero dell'Interno) per provincia/comune
- Open data comunali su reati per quartiere
- Dati percezione sicurezza da indagini ISTAT

Per attivare: popolare la tabella e aggiungere query in `pro-sources`.
