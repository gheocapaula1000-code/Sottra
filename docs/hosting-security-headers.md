# Hosting Security Headers — Sottra

## Premessa

Gli header di sicurezza HTTP **non possono essere impostati dal codice applicativo React**. Devono essere configurati a livello di hosting, CDN o reverse proxy.

Su Lovable/Supabase hosting, questi header dipendono dalla piattaforma. Questo documento serve come riferimento per deploy su infrastruttura propria o CDN configurabile.

## Header consigliati

### Strict-Transport-Security (HSTS)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

Forza HTTPS per 2 anni. Attivare solo dopo aver verificato che HTTPS funziona correttamente.

### X-Frame-Options

```
X-Frame-Options: DENY
```

Impedisce l'embedding in iframe. Usare `SAMEORIGIN` se serve embedding interno.

### X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

Impedisce al browser di indovinare il MIME type. Sempre attivo.

### Referrer-Policy

```
Referrer-Policy: strict-origin-when-cross-origin
```

Invia il referrer completo solo per same-origin; solo l'origin per cross-origin.

### Permissions-Policy

```
Permissions-Policy: camera=(self), microphone=(), geolocation=(self), payment=()
```

Disabilita microfono e Payment Request. `geolocation=(self)` e `camera=(self)` sono obbligatori: la scansione Android usa getUserMedia, iOS usa la fotocamera di sistema, il GPS serve alla microzona OMI.

## Esempio di configurazione

### Nginx

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(self), payment=()" always;
```

### Cloudflare (Transform Rules)

Configurabile via Dashboard → Rules → Transform Rules → Modify Response Header.

### Vercel (vercel.json)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(), geolocation=(self), payment=()" }
      ]
    }
  ]
}
```

## Checklist post-deploy

- [ ] Header presenti (verificare con `curl -I https://sottra.app`)
- [ ] HSTS attivo solo dopo conferma HTTPS stabile
- [ ] Nessuna rottura iframe/UI (se `X-Frame-Options: DENY`, verificare che non serva embedding)
- [ ] Nessun blocco imprevisto su geolocation o altre API browser usate
- [ ] CSP meta tag in `index.html` coerente con header server-side (non duplicare direttive in conflitto)

## Note piattaforma Lovable

Lovable hosting gestisce HTTPS automaticamente. Gli header di sicurezza aggiuntivi non sono attualmente configurabili dalla piattaforma — saranno rilevanti solo in caso di deploy su infrastruttura propria.
