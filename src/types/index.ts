/** Risultato generico da un servizio scan/forecast */
export interface ServiceResult<T = unknown> {
  error: boolean;
  message: string | null;
  data: T | null;
}

/** Stato di una singola sezione nel risultato */
export type SectionStatus = "idle" | "loading" | "success" | "error";

/** Sezione generica nel risultato scan */
export interface SectionState<T = unknown> {
  status: SectionStatus;
  data: T | null;
  message: string | null;
}

/** Dati identificazione edificio */
export interface IdentifyData {
  address: string;
  buildingName?: string;
  confidence?: number;
  lat?: number;
  lng?: number;
}

/** Errore restituito da coreRequest */
export interface CoreError {
  error: true;
  message: string;
}
