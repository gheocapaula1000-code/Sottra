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

- **Frontend**: React 18, TypeScript (strict), Tailwind CSS, shadcn/ui, Vite
- **Backend**: Central Core V3 (Edge Function server-side)
- **Geocoding**: OpenStreetMap Nominatim (fallback Google Maps)
- **PWA**: Service Worker, manifest, installabile

## Struttura
```
src/
  pages/        → Index, Scan, Result, History, Dashboard, Admin…
  services/     → scan.ts, forecast.ts, api.ts, keydraftImport.ts
  hooks/        → useBuildingScan (orchestratore dual-engine)
  contexts/     → AuthContext, SubscriptionContext, ScanHistoryContext
  types/        → Interfacce TypeScript per tutti i dati
  components/   → UI condivisa + shadcn/ui
```

## Variabili d'ambiente
```env
VITE_USE_MOCK=false              # true per dati dimostrativi in sviluppo
```

**Lovable Cloud fallback (in source)** — publish has omitted `VITE_*` and shipped a black screen. The client prefers env when present, otherwise uses project `vveunbxfcfhnkkhrqutf` (`https://vveunbxfcfhnkkhrqutf.supabase.co`) plus the publishable anon key. Still set Vite env on publish when possible. Never commit `.env`. CI may use `https://example.supabase.co` for tests (`CI=true`). Explicit production placeholders still fail `vite build` / `verify:package`.

> Le chiavi `CORE_API_URL`, `CORE_API_KEY`, `OWNER_EMAILS` e `STRIPE_SECRET_KEY`
> sono configurate server-side nelle Edge Function e non devono essere esposte al client.

## Scripts
```bash
npm run dev              # Dev server (localhost:8080)
npm run build            # Build produzione
npm run lint             # ESLint
npm run typecheck        # TypeScript strict check
npm run test             # Vitest
npm run test:coverage    # Vitest con coverage
npm run verify:secrets   # Verifica assenza secret nel codice
npm run verify:package   # Build + verifica artifact
npm run audit:release    # Pipeline completa: lint + typecheck + test + secrets + package
```

## CI/CD

GitHub Actions pipeline (`.github/workflows/ci.yml`):
lint → typecheck → test → verify:secrets → build → verify artifacts

Dependabot configurato per aggiornamenti automatici npm e GitHub Actions.

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

## Sicurezza

- Nessuna email owner/admin nel bundle frontend
- Owner/admin centralizzati server-side via `OWNER_EMAILS` env
- CSP meta tag restrittivo
- RLS abilitato su tutte le tabelle
- Stripe opzionale: degrada in modo esplicito se `STRIPE_SECRET_KEY` non è configurato

## Licenza

Proprietaria. Vedere `LICENSE`.
