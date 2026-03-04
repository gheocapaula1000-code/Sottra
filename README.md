# Sottra

> **Ciò che sta sotto, lo sai solo tu.**
> Inquadra qualsiasi edificio. Scopri tutto in 3 secondi.

Sottra è una web-app mobile-first che permette di puntare la fotocamera su un edificio e ottenere istantaneamente dati catastali, stime di prezzo e indicatori di zona.

## Architettura

```
┌─────────────────────────────────────────┐
│               Frontend (React + Vite)   │
│                                         │
│  Camera → useBuildingScan hook          │
│              │                          │
│     ┌────────┴────────┐                 │
│     ▼                 ▼                 │
│  Motore Scan    Motore Forecast         │
│  (scan.ts)      (forecast.ts)           │
│     │                 │                 │
│     └────────┬────────┘                 │
│              ▼                          │
│        coreRequest (api.ts)             │
│        Promise.allSettled               │
│              │                          │
│              ▼                          │
│        Central Core API (esterno)       │
└─────────────────────────────────────────┘
```

### Motori indipendenti

| Motore | File | Endpoint | Output |
|--------|------|----------|--------|
| **Scan** | `src/services/scan.ts` | `/identify`, `/cadastral`, `/pricing` | Dati identificativi, catastali, stime prezzo |
| **Forecast** | `src/services/forecast.ts` | `/zone-stats`, `/mood-score`, `/forecast` | Statistiche zona, sentiment, previsioni |

I due motori vengono lanciati in parallelo con `Promise.allSettled` — se uno fallisce, l'altro restituisce comunque i suoi risultati.

### Layer API (`src/services/api.ts`)

- `coreRequest<T>()` — wrapper non-throwing con timeout e abort
- `isError()` — type guard per distinguere errori da risultati
- Mock mode automatico via `VITE_USE_MOCK=true`

## Tech Stack

- **React 18** + TypeScript
- **Vite** con PWA (vite-plugin-pwa)
- **Tailwind CSS** + shadcn/ui
- **Recharts** per grafiche
- **Vitest** per test

## Struttura progetto

```
src/
├── assets/          # Immagini e logo
├── components/      # ErrorBoundary, NavLink, UI (shadcn)
├── hooks/           # useBuildingScan, use-mobile, use-toast
├── pages/           # Index, Scan, Result, NotFound
├── services/        # api.ts, scan.ts, forecast.ts, mockData.ts
├── test/            # api.test.ts, services.test.ts
└── types/           # ServiceResult, SectionStatus, IdentifyData, CoreError
```

## Setup locale

```sh
git clone <REPO_URL>
cd sottra
npm install
cp .env.example .env    # configura le variabili
npm run dev
```

### Variabili d'ambiente

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| `VITE_USE_MOCK` | Attiva dati mock senza backend | `true` |
| `VITE_CORE_API_URL` | URL del Central Core API | — |
| `VITE_CORE_API_KEY` | API key per autenticazione | — |

## Test

```sh
npm test
```

15 test su 3 file: `api.test.ts` (6), `services.test.ts` (8), `example.test.ts` (1).

## Build & Deploy

```sh
npm run build    # output in dist/
```

La build produce chunk ottimizzati: `vendor-react`, `vendor-radix`, `vendor-charts` + lazy loading su Scan/Result/NotFound.

Deploy: apri [Lovable](https://lovable.dev) → Share → Publish.

## Licenza

© 2026 Sottra. Tutti i diritti riservati.
