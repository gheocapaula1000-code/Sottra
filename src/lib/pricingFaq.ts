/**
 * FAQ pubblica di /prezzi.
 * Solo affermazioni già oneste sulla landing: nessuna capacità inventata,
 * nessun numero OMI/civico/APE/visura/successione inventato.
 * L'unico esempio numerico OMI ammesso è la demo homepage (Padova Est, OMI D8).
 */
import { PLANS, VAT_NOTICE } from "@/lib/plans";

export interface FaqItem {
  question: string;
  answer: string;
}

export const PRICING_FAQ: readonly FaqItem[] = [
  {
    question: "Come funziona la prova gratuita?",
    answer:
      "3 giorni, 5 scansioni, accesso completo. Zero carta di credito, nessuna disdetta da fare e nessun addebito automatico: al termine del trial serve un abbonamento attivo scelto da te.",
  },
  {
    question: "Quanto costa Sottra?",
    answer:
      `Agente ${PLANS.agente.price} €/mese · ${PLANS.agente.scans} scansioni · 1 telefono. ` +
      `Agenzia ${PLANS.agenzia.price} €/mese · ${PLANS.agenzia.scans} scansioni · telefoni illimitati. ` +
      `Rete ${PLANS.rete.price} €/mese · ${PLANS.rete.scans} scansioni · telefoni illimitati. ` +
      "Listino flat: il tetto scansioni è incluso, nessun extra a consumo.",
  },
  {
    question: "L'IVA è inclusa nei prezzi?",
    answer: `${VAT_NOTICE}. I prezzi indicati sono quelli finali.`,
  },
  {
    question: "Che cos'è la quotazione OMI che mostrate?",
    answer:
      "È la quotazione ufficiale della microzona OMI quando il GPS cade dentro il poligono della microzona. Non è il valore di quell'interno, non è una visura, non è un APE, non è una successione e non è il prezzo di vendita di quel civico. Se una fonte manca, il report lo dichiara: non la inventiamo.",
  },
  {
    question: "Un esempio di quotazione?",
    answer:
      "L'esempio pubblico in homepage: Padova Est (OMI D8), 1.400–1.850 €/m², abitazioni civili stato NORMALE, 1° semestre 2025. È la microzona, non questo interno.",
  },
  {
    question: "Come mando il report all'agenzia?",
    answer:
      "L'agente salva una volta il numero WhatsApp dell'agenzia e invia il report in un tap.",
  },
  {
    question: "Dove funziona?",
    answer:
      "In tutta Italia, con quotazione OMI ufficiale quando il GPS cade dentro il poligono della microzona. Solo su Padova le sette aree sono nominate una per una.",
  },
] as const;

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PRICING_FAQ.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}
