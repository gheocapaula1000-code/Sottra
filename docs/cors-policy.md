# CORS Policy — Sottra Edge Functions

## Stato attuale

Tutte le edge function Supabase utilizzano `Access-Control-Allow-Origin: *` (wildcard).

### Funzioni con CORS aperto

| Funzione | Motivo |
|---|---|
| `core-proxy` | Chiamata dal frontend (preview + produzione) |
| `diagnostics` | Pannello admin, stessi origin |
| `check-subscription` | Chiamata all'avvio app |
| `create-checkout` | Redirect Stripe |
| `customer-portal` | Redirect Stripe |
| `record-scan` | Chiamata post-scan |
| `pro-sources` | Dati fonti professionali |
| `omi-ingest` | Admin ingest |
| `omi-kml-ingest` | Admin ingest |
| `admin-stats` | Pannello admin |

## Quando è accettabile CORS wildcard

- Deploy su Lovable/Supabase con origin variabili (preview, staging, produzione)
- Tutte le funzioni richiedono `Authorization: Bearer <jwt>` — l'autenticazione è la barriera reale, non il CORS
- CORS protegge il browser, non il server

## Quando restringere

- Se l'app ha un singolo dominio stabile di produzione e nessun preview/staging
- Per compliance aziendale che richiede allowlist esplicita

## Esempio di allowlist (quando applicabile)

```typescript
const ALLOWED_ORIGINS = [
  "https://sottra.lovable.app",
  "https://sottra.it",
];

const origin = req.headers.get("Origin") ?? "";
const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

const corsHeaders = {
  "Access-Control-Allow-Origin": corsOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};
```

## Rischi e limiti pratici

1. **Lovable preview**: ogni build genera un URL diverso — un'allowlist rigida bloccherebbe le preview
2. **Supabase hosting**: non offre configurazione CORS a livello di gateway; va gestito nel codice della funzione
3. **Rottura silenziosa**: un'allowlist errata causa errori CORS invisibili nel browser senza log server-side
4. **JWT è la vera protezione**: tutte le funzioni verificano il token in codice — CORS wildcard non espone dati

## Decisione corrente

**Mantenere CORS wildcard** — l'ambiente di deploy è variabile e l'autenticazione JWT in-code è la protezione primaria. Restringere quando l'app avrà un singolo dominio stabile.
