# CORS Policy — Sottra Edge Functions

## Stato attuale

Tutte le edge function utilizzano l'helper condiviso `supabase/functions/_shared/cors.ts` con logica **deny-by-default**.

### Comportamento

| Condizione | `Access-Control-Allow-Origin` |
|---|---|
| `ALLOWED_ORIGINS` impostato, origin nella lista | Origin riflesso |
| `ALLOWED_ORIGINS` impostato, origin **non** nella lista | `"null"` (deny) |
| `ALLOWED_ORIGINS` **non** impostato | `"null"` (deny) |

La wildcard `*` non è mai utilizzata. Nessun fallback al primo dominio della lista — se l'origin non è nella allowlist, la risposta è sempre `"null"`.

### Header standard

Ogni risposta include `Vary: Origin` per garantire correttezza nelle cache condivise.

### Differenza con `originResolver.ts`

L'helper `_shared/originResolver.ts` (usato solo per generare URL di ritorno Stripe) ha un comportamento diverso:
- Se l'origin della request è nella allowlist → lo usa
- Altrimenti → fallback al primo dominio della allowlist (necessario per generare un URL valido)
- Se nessun dominio è configurato → lancia un errore

Questo non rappresenta un rischio CORS: l'origin resolver non controlla accesso cross-origin, genera solo URL di redirect.

## Configurazione

Impostare il secret `ALLOWED_ORIGINS` come lista comma-separated di origini autorizzate:

```
https://sottra.it,https://sottra.lovable.app,https://id-preview--xxxxx.lovable.app
```

## Variabili richieste per il billing

| Secret | Descrizione |
|---|---|
| `STRIPE_SECRET_KEY` | Chiave segreta Stripe (live o test) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret del webhook endpoint |
| `ALLOWED_ORIGINS` | Origini consentite per CORS e redirect URL |

## Rischi e mitigazioni

1. **Preview Lovable**: ogni build genera un URL diverso. Aggiungere il pattern preview alla lista quando necessario.
2. **JWT è la protezione primaria**: tutte le funzioni verificano il token in-code.
3. **Deny-by-default**: se `ALLOWED_ORIGINS` non è configurato, le richieste cross-origin vengono rifiutate.
