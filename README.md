# Sottra — Ciò che sta sotto, lo sai solo tu.

PWA per professionisti immobiliari: fotografa un edificio, ottieni un quadro informativo strutturato con dati ufficiali, elaborazioni e stime indicative.

## Architettura

Due motori indipendenti che girano in parallelo:

- **Motore Scan**: foto + GPS → identificazione → prezzi OMI
- **Motore Forecast**: GPS → rischio zona, trend demografico, infrastrutture, dinamica territoriale, opportunity, timeview, convergenza territoriale
```
Browser → Sottra PWA (React + Vite)
       → Central Core V3 (Edge Function server-side: /sottra/*)
         → Nominatim (geocoding)
         → Fonti dati strutturate (orchestrate)
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui, Vite
- **Backend**: Central Core V3 (Edge Function server-side)
- **Geocoding**: OpenStreetMap Nominatim (fallback Google Maps)
- **PWA**: Service Worker, manifest, installabile

## Struttura
```
src/
  pages/        → Index, Scan, Result, History, NotFound
  services/     → scan.ts, forecast.ts, api.ts, mockData.ts
  hooks/        → useBuildingScan (orchestratore dual-engine)
  contexts/     → ScanHistoryContext (cronologia scansioni)
  types/        → Interfacce TypeScript per tutti i dati
  components/   → UI condivisa + shadcn/ui
```

## Variabili d'ambiente
```env
VITE_USE_MOCK=false              # true per dati dimostrativi in sviluppo
```

> Le chiavi `CORE_API_URL` e `CORE_API_KEY` sono configurate server-side
> nella Edge Function e non devono essere esposte al client.

## Sviluppo
```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # Build produzione
npx vitest run   # Test
npx eslint src/  # Lint
```

## Moduli operativi (9)

| Endpoint | Motore | Descrizione |
|----------|--------|-------------|
| /scan/identify | Scan | GPS → indirizzo + building ID |
| /scan/pricing | Scan | Prezzi al m² (range + media zona) — fonte OMI |
| /forecast/timeview | Forecast | Scenario evolutivo a medio periodo |
| /forecast/opportunity | Forecast | Indice opportunità + quadrante |
| /forecast/infrastrutture | Forecast | Opere, mobilità, connettività, interventi pubblici |
| /forecast/rischio-zona | Forecast | Rischio sismico, idrogeologico, alluvionale |
| /forecast/trend-demografico | Forecast | Popolazione, età, composizione |
| /forecast/sviluppo-area | Forecast | Segnali di sviluppo e dinamica territoriale |
| /forecast/convergenza-territoriale | Forecast | Indice di convergenza multi-sorgente |

## Classificazione dati

Ogni sezione del report indica il tipo di dato:

- **Dato ufficiale** — fonte istituzionale verificata (OMI, ISTAT, ISPRA, INGV)
- **Dato elaborato** — elaborazione strutturata da fonti pubbliche
- **Non disponibile** — copertura assente per l'area analizzata
