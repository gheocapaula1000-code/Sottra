# Sottra — Roadmap Sorgenti Reali Prioritarie

## Principio

Questa roadmap classifica le famiglie di sorgenti dati reali candidate per integrazione futura,
ordinate per impatto, copertura, qualità e rischio. Nessuna fonte viene integrata senza studio
tecnico preventivo. Nessun dato viene inventato. Nessuna promozione semantica indebita.

---

## Famiglie di Sorgenti Analizzate

### A. STRADARIO / TOPONOMASTICA / CIVICI

| Campo | Valore |
|---|---|
| **source_family** | `address_registry` |
| **Fonti candidate** | ANNCSU (Archivio Nazionale Numeri Civici e Strade Urbane), OpenCivitas, OpenAddresses.io, dataset comunali aperti |
| **source_type** | `official_data` (ANNCSU), `territorial_verified` (OpenAddresses) |
| **officiality_level** | Istituzionale (ANNCSU = ISTAT + Agenzia Entrate), semi-ufficiale (comunali) |
| **likely_quality_label** | `official` per ANNCSU, `elaborated` per altre |
| **geographic_coverage** | Nazionale (ANNCSU), frammentata (comunali) |
| **geographic_levels_supported** | civico, via, sezione censuaria |
| **building_relevance** | 🟢 Alta — consente verifica address → building truth |
| **zone_relevance** | 🟡 Media — migliora geocoding e ancoraggio zona |
| **address_relevance** | 🟢 Altissima — è la fonte primaria per promuovere civic a verified |
| **update_frequency** | Annuale (ANNCSU), variabile (comunali) |
| **freshness_expectation** | 1–2 anni accettabili |
| **structured_access** | CSV/shapefile (ANNCSU), variabile |
| **machine_readability** | 🟢 Buona |
| **licensing_risk** | 🟡 Medio — ANNCSU richiede verifica condizioni ISTAT |
| **dependency_risk** | 🟡 Medio — dipendenza da rilascio ISTAT |
| **stability_risk** | 🟢 Basso — formato stabile |
| **integration_complexity** | 🟡 Media — normalizzazione toponimi necessaria |
| **maintenance_cost** | 🟢 Basso — aggiornamento annuale |
| **anti_hallucination_fit** | 🟢 Eccellente — permette di verificare civic vs inventare |
| **recommended_priority** | **P1 — Alta** |
| **recommended_phase** | Prossima integrazione |
| **recommended_action** | Verificare accesso ANNCSU, preparare pipeline import, integrare nel address resolution engine |

**Motivazione priorità**: ANNCSU è l'unica fonte che può trasformare `civic_supported_as_building_truth: false` in `true`.
Senza di essa, il layer via/civico resta permanentemente non-verificato.

---

### B. DATI EDIFICIO / FABBRICATO

| Campo | Valore |
|---|---|
| **source_family** | `building_registry` |
| **Fonti candidate** | Catasto fabbricati (Agenzia Entrate), DBSN (Database di Sintesi Nazionale IGM), OpenStreetMap buildings |
| **source_type** | `official_data` (Catasto), `territorial_verified` (OSM buildings) |
| **officiality_level** | Istituzionale (Catasto), verificato geospaziale (OSM) |
| **likely_quality_label** | `official` (Catasto), `elaborated` (OSM) |
| **geographic_coverage** | Nazionale (Catasto), variabile (OSM: buona in aree urbane) |
| **geographic_levels_supported** | particella, foglio, sub-comunale |
| **building_relevance** | 🟢 Altissima — è il registr fondante |
| **zone_relevance** | 🟡 Media — volumetrie e densità edilizia |
| **address_relevance** | 🟢 Alta — link edificio-civico |
| **update_frequency** | Continuo (Catasto), variabile (OSM) |
| **freshness_expectation** | Dati sempre aggiornati (Catasto) |
| **structured_access** | 🔴 Difficile — Catasto non ha API aperta, richiede convenzione |
| **machine_readability** | 🟡 Media — formati proprietari Catasto |
| **licensing_risk** | 🔴 Alto — Catasto richiede convenzione con Agenzia Entrate |
| **dependency_risk** | 🔴 Alto — dipendenza da ente pubblico |
| **stability_risk** | 🟢 Basso — registri stabili |
| **integration_complexity** | 🔴 Alta — formati proprietari, normalizzazione pesante |
| **maintenance_cost** | 🟡 Medio |
| **anti_hallucination_fit** | 🟢 Eccellente — dati catastali sono fonte di verità |
| **recommended_priority** | **P3 — Media-bassa** |
| **recommended_phase** | Dopo address registry + dopo verifica accesso Catasto |
| **recommended_action** | Studio di fattibilità accesso, valutare OSM buildings come ponte |

**Motivazione**: il Catasto è la fonte ideale ma l'accesso è complesso e costoso.
OSM buildings è un buon ponte per volumetrie base ma non è `official`.
Da non affrettare.

---

### C. DATI TERRITORIALI PUBBLICI AGGIUNTIVI

| Campo | Valore |
|---|---|
| **source_family** | `territorial_public` |
| **Fonti candidate** | Basi territoriali ISTAT (sezioni censuarie aggiornate, confini comunali, confini provinciali), Urbanistica PRG/PGT comunali, vincoli paesaggistici/idrogeologici |
| **source_type** | `official_data` (ISTAT), `territorial_verified` (vincoli) |
| **officiality_level** | Istituzionale |
| **likely_quality_label** | `official` |
| **geographic_coverage** | Nazionale (ISTAT), regionale/comunale (PRG/vincoli) |
| **geographic_levels_supported** | sezione censuaria, comune, provincia |
| **building_relevance** | 🟡 Media — contesto urbanistico |
| **zone_relevance** | 🟢 Alta — migliora profilo zona con dati strutturali |
| **address_relevance** | 🟡 Bassa |
| **update_frequency** | Decennale (censimento), variabile (PRG) |
| **freshness_expectation** | 5–10 anni accettabili per struttura territoriale |
| **structured_access** | 🟢 Buona — ISTAT pubblica shapefile e CSV |
| **machine_readability** | 🟢 Buona |
| **licensing_risk** | 🟢 Basso — dati pubblici ISTAT |
| **dependency_risk** | 🟢 Basso |
| **stability_risk** | 🟢 Basso |
| **integration_complexity** | 🟢 Bassa — formati noti, compatibili con backbone esistente |
| **maintenance_cost** | 🟢 Basso |
| **anti_hallucination_fit** | 🟢 Eccellente — dati istituzionali stabili |
| **recommended_priority** | **P2 — Alta** |
| **recommended_phase** | Dopo address registry o in parallelo |
| **recommended_action** | Integrare basi territoriali ISTAT aggiornate (confini, sezioni), valutare vincoli idrogeologici |

**Motivazione**: complemento naturale del backbone già costruito. Costo basso, impatto reale sulla zona.

---

### D. DATI MERCATO / CONTESTO ECONOMICO

| Campo | Valore |
|---|---|
| **source_family** | `market_data` |
| **Fonti candidate** | Osservatorio Immobiliare (già OMI — congelato), annunci immobiliari aggregati, indici CONSOB/Banca d'Italia |
| **source_type** | `commercial_verified` o `commercial_partial` |
| **officiality_level** | Commerciale (annunci), semi-ufficiale (indici macro) |
| **likely_quality_label** | `elaborated` (annunci), `official` (indici macro) |
| **geographic_coverage** | Nazionale (indici macro), variabile (annunci) |
| **geographic_levels_supported** | comune, provincia (indici macro); zona/microzona (annunci, se aggregati) |
| **building_relevance** | 🟡 Media — pricing contesto, non stabile singolo |
| **zone_relevance** | 🟢 Alta — benchmark mercato zona |
| **address_relevance** | 🔴 Bassa — mai su singolo civico |
| **update_frequency** | Trimestrale/semestrale |
| **freshness_expectation** | 6–12 mesi |
| **structured_access** | 🟡 Variabile — API commerciali o scraping |
| **machine_readability** | 🟡 Variabile |
| **licensing_risk** | 🔴 Alto — fonti commerciali richiedono licenze |
| **dependency_risk** | 🟡 Medio — rischio discontinuità provider |
| **stability_risk** | 🟡 Medio — formati cambiano spesso |
| **integration_complexity** | 🟡 Media — normalizzazione prezzi e tipologie |
| **maintenance_cost** | 🟡 Medio — aggiornamento frequente necessario |
| **anti_hallucination_fit** | 🟡 Medio — rischio di presentare aggregati come puntuali |
| **recommended_priority** | **P4 — Bassa (rinviare)** |
| **recommended_phase** | Dopo solidificazione address + building |
| **recommended_action** | Valutare solo indici macro pubblici; annunci rimandare |

**Motivazione**: OMI è già integrato e copre il posizionamento ufficiale. Altre fonti mercato
portano rischio semantico (commercial_partial spacciato per verified) e costi di licenza.
Da rimandare.

---

### E. DATI MOBILITÀ / SERVIZI / AMBIENTE

| Campo | Valore |
|---|---|
| **source_family** | `contextual_services` |
| **Fonti candidate** | GTFS (trasporto pubblico), ISPRA (qualità ambientale), rumore/inquinamento comunali, ISTAT accessibilità servizi |
| **source_type** | `territorial_verified` (GTFS), `official_data` (ISPRA) |
| **officiality_level** | Istituzionale (ISPRA), semi-ufficiale (GTFS) |
| **likely_quality_label** | `elaborated` (GTFS), `official` (ISPRA) |
| **geographic_coverage** | Nazionale (ISPRA), regionale/comunale (GTFS) |
| **geographic_levels_supported** | comune, fermata, area (ISPRA) |
| **building_relevance** | 🔴 Bassa |
| **zone_relevance** | 🟡 Media — arricchisce contesto vivibilità |
| **address_relevance** | 🔴 Bassa |
| **update_frequency** | Variabile |
| **freshness_expectation** | 1–3 anni |
| **structured_access** | 🟢 Buona (GTFS standard), 🟡 variabile (ISPRA) |
| **machine_readability** | 🟢 Buona |
| **licensing_risk** | 🟢 Basso — dati pubblici |
| **dependency_risk** | 🟡 Medio — frammentazione GTFS per azienda |
| **stability_risk** | 🟡 Medio |
| **integration_complexity** | 🟡 Media |
| **maintenance_cost** | 🟡 Medio |
| **anti_hallucination_fit** | 🟢 Buono — dati contestuali, non puntuali |
| **recommended_priority** | **P5 — Fuori scope per ora** |
| **recommended_phase** | Fase futura, dopo P1–P3 |
| **recommended_action** | Solo studio preliminare; non integrare ora |

**Motivazione**: arricchimento "nice to have" ma non critico per il valore core.
Frammentazione GTFS alta. ISPRA interessante ma secondario.

---

## Matrice Priorità / Impatto / Rischio

| Famiglia | Impatto prodotto | Copertura geo | Qualità attesa | Complessità | Rischio semantico | Rischio manutenzione | Rischio falsa precisione | **Priorità** |
|---|---|---|---|---|---|---|---|---|
| **A. Stradario/Civici** | 🟢 Alto | 🟢 Nazionale | 🟢 Official | 🟡 Media | 🟢 Basso | 🟢 Basso | 🟢 Basso | **P1** |
| **C. Territoriali pubblici** | 🟢 Alto | 🟢 Nazionale | 🟢 Official | 🟢 Bassa | 🟢 Basso | 🟢 Basso | 🟢 Basso | **P2** |
| **B. Edificio/Fabbricato** | 🟢 Alto | 🟡 Dipende | 🟢 Official | 🔴 Alta | 🟢 Basso | 🟡 Medio | 🟡 Medio | **P3** |
| **D. Mercato/Economico** | 🟡 Medio | 🟡 Variabile | 🟡 Elaborated | 🟡 Media | 🔴 Alto | 🟡 Medio | 🔴 Alto | **P4 — rinviare** |
| **E. Mobilità/Servizi** | 🟡 Basso | 🟡 Frammentata | 🟡 Elaborated | 🟡 Media | 🟢 Basso | 🟡 Medio | 🟢 Basso | **P5 — fuori scope** |

---

## Ordine Consigliato delle Prossime Integrazioni

### Priorità 1 — ANNCSU / Stradario Ufficiale
- **Perché prima**: è l'unica fonte che può rendere il layer address/civic *realmente verificato*
- **Layer rafforzato**: address (primario), building (secondario)
- **Qualità**: `official` — ISTAT + Agenzia Entrate
- **Rischio**: medio (accesso da verificare)
- **Impatto su report**: `civic_supported_as_building_truth` può diventare `true`

### Priorità 2 — Basi Territoriali ISTAT Aggiornate
- **Perché**: complemento naturale del backbone; costo bassissimo, valore alto
- **Layer rafforzato**: zona (primario)
- **Qualità**: `official`
- **Rischio**: basso
- **Impatto su report**: sezioni area/territorio più complete, confini aggiornati

### Priorità 3 — Registro Edifici (studio fattibilità)
- **Perché**: necessario per building profile serio, ma accesso complesso
- **Layer rafforzato**: building (primario)
- **Qualità**: `official` (Catasto) o `elaborated` (OSM)
- **Rischio**: alto (accesso, formati proprietari)
- **Impatto su report**: unsupported_claims edificio ridotti significativamente

### Priorità 4 — Dati Mercato Aggiuntivi → RINVIARE
- **Perché rinviare**: OMI già copre il posizionamento; fonti commerciali portano rischio semantico
- **Rischio**: classificazione commercial → official indebita

### Fuori scope per ora — Mobilità/Servizi/Ambiente
- **Perché**: valore marginale rispetto al costo; frammentazione alta
- **Da rivalutare**: quando P1–P3 sono completate

---

## Anti-Hallucination Check per Famiglia

| Famiglia | Compatibile zero-hallucination | Note |
|---|---|---|
| A. Stradario | ✅ Sì | Permette verifica reale, non simulazione |
| B. Edificio | ✅ Sì (con cautela) | Catasto è verità; OSM è `elaborated`, non `official` |
| C. Territoriali | ✅ Sì | Dati istituzionali stabili |
| D. Mercato | ⚠️ Attenzione | Rischio promozione commercial → official |
| E. Mobilità | ✅ Sì | Dati contestuali, nessun claim puntuale |

---

## Allineamento con Backbone Esistente

| Famiglia | Livello geo aggancio | Rafforza zona | Rafforza edificio | Rafforza address | Tassonomia riusabile | Nuove limitations richieste |
|---|---|---|---|---|---|---|
| A. Stradario | civico, via, sezione | 🟡 | 🟢 | 🟢🟢 | ✅ Sì | No — rimuove limitations |
| B. Edificio | particella, sub-comunale | 🟡 | 🟢🟢 | 🟢 | ✅ Sì | Sì — catastali se assenti |
| C. Territoriali | sezione, comune | 🟢🟢 | 🟡 | 🟡 | ✅ Sì | No |
| D. Mercato | comune, zona | 🟢 | 🟡 | 🔴 | ⚠️ Nuovi stati | Sì — commercial_partial |
| E. Mobilità | fermata, comune | 🟡 | 🔴 | 🔴 | ✅ Sì | No |
