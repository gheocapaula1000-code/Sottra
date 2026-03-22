# CORS Policy — Sottra Edge Functions

## Stato attuale

Tutte le edge function utilizzano l'helper condiviso `supabase/functions/_shared/cors.ts` con logica **deny-by-default**.

### Comportamento

| Condizione | `Access-Control-Allow-Origin` |
|---|---|
| `ALLOWED_ORIGINS` impostato, origin nella lista | Origin riflesso |
| `ALLOWED_ORIGINS` impostato, origin non nella lista | Primo dominio della lista |
| `ALLOWED_ORIGINS` **non** impostato | `"null"` (deny) |

La wildcard `*` non è mai utilizzata.

### Header standard

Ogni risposta include `Vary: Origin` per garantire correttezza nelle cache condivise.

## Configurazione

Impostare il secret `ALLOWED_ORIGINS` come lista comma-separated di origini autorizzate:

```
https://sottra.it,https://sottra.lovable.app,https://id-preview--xxxxx.lovable.app
```

## Rischi e mitigazioni

1. **Preview Lovable**: ogni build genera un URL diverso. Aggiungere il pattern preview alla lista quando necessario.
2. **JWT è la protezione primaria**: tutte le funzioni verificano il token in-code.
3. **Deny-by-default**: se `ALLOWED_ORIGINS` non è configurato, le richieste cross-origin vengono rifiutate.
