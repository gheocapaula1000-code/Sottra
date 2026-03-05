# Sottra — Ciò che sta sotto, lo sai solo tu.

PWA per scanner edifici: fotografa qualsiasi edificio, ottieni dati catastali, prezzi di mercato, classe energetica, annunci nella zona, e previsioni di investimento in 3 secondi.

## Architettura

Due motori indipendenti che girano in parallelo:

- **Motore Scan**: foto + GPS → identify → catasto, prezzi, annunci, energia
- **Motore Forecast**: GPS → MoodScore zona, previsione futura, indice opportunità
```
Browser → Sottra PWA (React + Vite)
       → Central Core V3 (Supabase Edge Function: /sottra/*)
         → Nominatim (geocoding gratuito)
         → Provider analisi dati (orchestrati)
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui, Vite
- **Backend**: Central Core V3 (Edge Function condivisa)
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
VITE_USE_MOCK=false              # true per dati finti
VITE_CORE_API_URL=               # URL Edge Function Sottra
VITE_CORE_API_KEY=               # AI_CORE_SECRET di Central Core V3
```

## Sviluppo
```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # Build produzione
npx vitest run   # Test (15 test)
npx eslint src/  # Lint (0 errori)
```

## Endpoint Backend (8 rotte)

| Endpoint | Motore | Descrizione |
|----------|--------|-------------|
| /scan/identify | Scan | GPS → indirizzo + building ID |
| /scan/cadastral | Scan | Dati catastali stimati |
| /scan/pricing | Scan | Prezzi al m² (range + media zona) |
| /scan/listings | Scan | Annunci vendita/affitto in zona |
| /scan/energy | Scan | Classe energetica stimata |
| /forecast/moodscore | Forecast | Score qualità quartiere 0-100 |
| /forecast/timeview | Forecast | Previsione valore 5/10/20 anni |
| /forecast/opportunity | Forecast | Indice opportunità + quadrante |
