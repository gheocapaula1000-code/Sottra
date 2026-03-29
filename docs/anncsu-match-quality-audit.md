# ANNCSU Match Quality Audit — Documentazione Decisionale

## Scopo

Questo documento descrive il framework di audit per la qualità dei match ANNCSU nel resolver address di Sottra, e le condizioni necessarie per una eventuale futura policy di promozione.

## Metriche di Audit

Il modulo `anncsuMatchAudit.ts` produce metriche aggregate su batch di risultati address resolution:

| Metrica | Significato |
|---|---|
| `exact_official_street_match_count` | Strada trovata esattamente in ANNCSU |
| `normalized_official_street_match_count` | Strada trovata con normalizzazione |
| `official_civic_support_count` | Civico trovato in ANNCSU |
| `official_civic_ambiguous_count` | Civico ambiguo (più esponenti) |
| `precise_location_support_count` | Match ufficiale + coordinate |
| `no_official_match_count` | Nessun match ufficiale |
| `building_truth_promoted_count` | Deve essere SEMPRE 0 |

## Classificazione dei Casi

| Classe | Descrizione |
|---|---|
| `strong_official_street` | Strada con match ANNCSU esatto |
| `strong_official_street_and_civic` | Strada + civico ufficiale |
| `official_but_ambiguous` | Match ufficiale ma civico ambiguo |
| `official_partial_only` | Match ufficiale parziale |
| `textual_match_only` | Solo parsing testuale |
| `unresolved` | Indirizzo non risolvibile |
| `risky_false_specificity` | Rischio di falsa specificità alto |

## Criteri di Promotion Readiness

**NESSUNA PROMOZIONE È ATTIVA OGGI.**

La valutazione di readiness è puramente diagnostica. Un caso viene classificato come:

- **never_eligible**: indirizzo non risolvibile
- **not_ready**: manca supporto ufficiale strada
- **blocked_by_ambiguity**: civico ambiguo in ANNCSU
- **needs_more_signals**: servono più segnali
- **blocked_by_missing_building_evidence**: ANNCSU da solo non è verità edificio
- **potentially_eligible_future**: teoricamente qualificabile in futuro

### Cosa impedisce la promozione oggi

1. **ANNCSU da solo NON è building truth** — è uno stradario, non un registro edilizio
2. **Il civico ufficiale NON equivale a identificazione dello stabile** — uno stesso civico può avere più unità
3. **Serve catasto/registro edilizio** per qualsiasi promozione a building truth
4. **Serve collegamento cadastrale** per precise building identification

### Cosa servirebbe in futuro

Per ipotizzare `civic_supported_as_building_truth = true`:

- Match ANNCSU esatto per strada E civico
- Coordinate geo-coerenti
- Nessuna ambiguità (esponenti, duplicati)
- Collegamento catastale verificato (NON ancora disponibile)
- Evidenza da registro edilizio (NON ancora disponibile)

## Valutazione Sistema

Il modulo produce una valutazione complessiva:

| Livello | Significato |
|---|---|
| `not_ready` | Copertura o qualità insufficiente |
| `partially_ready_rare_cases` | Casi isolati ok, non generalizzabile |
| `ready_but_blocked_by_policy` | Tecnicamente ok, ma ANNCSU ≠ building truth |
| `ready_for_evaluation` | Da rivalutare con dati catastali |

## Raccomandazione Attuale

**Il sistema è parzialmente pronto per match ufficiale strada/civico, ma NON pronto per promozione a building truth.**

ANNCSU migliora significativamente la qualità del matching indirizzo, ma la verità sullo stabile richiede sorgenti che Sottra non ha ancora integrato (catasto, registro edilizio).

La policy attuale (`building_truth_support: false`) è corretta e deve restare.
