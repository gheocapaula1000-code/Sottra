export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      census_sections_r03_2021: {
        Row: {
          asc1_code: string | null
          asc2_code: string | null
          asc3_code: string | null
          bbox: Json | null
          buildings_2021: number | null
          centroid_lat: number | null
          centroid_lng: number | null
          comune_catastale_code: string | null
          comune_istat_code: string | null
          comune_name: string
          created_at: string | null
          dwellings_2021: number | null
          families_2021: number | null
          females_2021: number | null
          id: string
          import_batch_id: string | null
          imported_at: string | null
          males_2021: number | null
          metadata_json: Json | null
          occupied_dwellings_2021: number | null
          polygon_coords: Json | null
          population_2021: number | null
          provincia_code: string | null
          provincia_name: string | null
          regione_code: string | null
          regione_name: string | null
          residential_buildings_2021: number | null
          section_code: string
          source_dataset: string
          source_label: string
          source_year: number
          superficie_kmq: number | null
        }
        Insert: {
          asc1_code?: string | null
          asc2_code?: string | null
          asc3_code?: string | null
          bbox?: Json | null
          buildings_2021?: number | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          comune_catastale_code?: string | null
          comune_istat_code?: string | null
          comune_name?: string
          created_at?: string | null
          dwellings_2021?: number | null
          families_2021?: number | null
          females_2021?: number | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          males_2021?: number | null
          metadata_json?: Json | null
          occupied_dwellings_2021?: number | null
          polygon_coords?: Json | null
          population_2021?: number | null
          provincia_code?: string | null
          provincia_name?: string | null
          regione_code?: string | null
          regione_name?: string | null
          residential_buildings_2021?: number | null
          section_code: string
          source_dataset?: string
          source_label?: string
          source_year?: number
          superficie_kmq?: number | null
        }
        Update: {
          asc1_code?: string | null
          asc2_code?: string | null
          asc3_code?: string | null
          bbox?: Json | null
          buildings_2021?: number | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          comune_catastale_code?: string | null
          comune_istat_code?: string | null
          comune_name?: string
          created_at?: string | null
          dwellings_2021?: number | null
          families_2021?: number | null
          females_2021?: number | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          males_2021?: number | null
          metadata_json?: Json | null
          occupied_dwellings_2021?: number | null
          polygon_coords?: Json | null
          population_2021?: number | null
          provincia_code?: string | null
          provincia_name?: string | null
          regione_code?: string | null
          regione_name?: string | null
          residential_buildings_2021?: number | null
          section_code?: string
          source_dataset?: string
          source_label?: string
          source_year?: number
          superficie_kmq?: number | null
        }
        Relationships: []
      }
      data_source_registry: {
        Row: {
          coverage_comuni: number | null
          coverage_regioni: number | null
          created_at: string
          current_coverage_status: string
          dataset_status: string
          geographic_level_supported: string
          geographic_scope: string
          id: string
          ingestion_mode: string
          last_import_job_id: string | null
          last_imported_at: string | null
          last_validated_at: string | null
          metadata_json: Json | null
          notes: string | null
          officiality_level: string
          provider_label: string
          record_count: number | null
          refresh_mode: string
          regions_supported: string[] | null
          report_sections_supported: string[] | null
          source_family: string
          source_key: string
          source_label: string
          source_type: string
          source_version: string | null
          source_year: number | null
          updated_at: string
        }
        Insert: {
          coverage_comuni?: number | null
          coverage_regioni?: number | null
          created_at?: string
          current_coverage_status?: string
          dataset_status?: string
          geographic_level_supported?: string
          geographic_scope?: string
          id?: string
          ingestion_mode?: string
          last_import_job_id?: string | null
          last_imported_at?: string | null
          last_validated_at?: string | null
          metadata_json?: Json | null
          notes?: string | null
          officiality_level?: string
          provider_label?: string
          record_count?: number | null
          refresh_mode?: string
          regions_supported?: string[] | null
          report_sections_supported?: string[] | null
          source_family?: string
          source_key: string
          source_label?: string
          source_type?: string
          source_version?: string | null
          source_year?: number | null
          updated_at?: string
        }
        Update: {
          coverage_comuni?: number | null
          coverage_regioni?: number | null
          created_at?: string
          current_coverage_status?: string
          dataset_status?: string
          geographic_level_supported?: string
          geographic_scope?: string
          id?: string
          ingestion_mode?: string
          last_import_job_id?: string | null
          last_imported_at?: string | null
          last_validated_at?: string | null
          metadata_json?: Json | null
          notes?: string | null
          officiality_level?: string
          provider_label?: string
          record_count?: number | null
          refresh_mode?: string
          regions_supported?: string[] | null
          report_sections_supported?: string[] | null
          source_family?: string
          source_key?: string
          source_label?: string
          source_type?: string
          source_version?: string | null
          source_year?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      demographic_zones: {
        Row: {
          anno_rilevazione: string
          centroid_lat: number | null
          centroid_lng: number | null
          codice_comune_catastale: string
          codice_comune_istat: string | null
          comune_label: string
          coverage_level: string
          created_at: string | null
          data_quality: string
          densita: number | null
          eta_media: number | null
          flusso_residenti_12m: number | null
          id: string
          import_batch_id: string | null
          indice_vecchiaia: number | null
          is_official: boolean
          notes: string | null
          nuclei_familiari: number | null
          percentuale_famiglie: number | null
          percentuale_giovani: number | null
          percentuale_stranieri: number | null
          polygon_coords: Json | null
          popolazione: number | null
          source_file: string | null
          source_label: string
          source_type: string
          updated_at: string | null
          zona_key: string
          zona_label: string
          zona_omi: string | null
          zona_type: string
        }
        Insert: {
          anno_rilevazione?: string
          centroid_lat?: number | null
          centroid_lng?: number | null
          codice_comune_catastale: string
          codice_comune_istat?: string | null
          comune_label?: string
          coverage_level?: string
          created_at?: string | null
          data_quality?: string
          densita?: number | null
          eta_media?: number | null
          flusso_residenti_12m?: number | null
          id?: string
          import_batch_id?: string | null
          indice_vecchiaia?: number | null
          is_official?: boolean
          notes?: string | null
          nuclei_familiari?: number | null
          percentuale_famiglie?: number | null
          percentuale_giovani?: number | null
          percentuale_stranieri?: number | null
          polygon_coords?: Json | null
          popolazione?: number | null
          source_file?: string | null
          source_label?: string
          source_type?: string
          updated_at?: string | null
          zona_key: string
          zona_label?: string
          zona_omi?: string | null
          zona_type?: string
        }
        Update: {
          anno_rilevazione?: string
          centroid_lat?: number | null
          centroid_lng?: number | null
          codice_comune_catastale?: string
          codice_comune_istat?: string | null
          comune_label?: string
          coverage_level?: string
          created_at?: string | null
          data_quality?: string
          densita?: number | null
          eta_media?: number | null
          flusso_residenti_12m?: number | null
          id?: string
          import_batch_id?: string | null
          indice_vecchiaia?: number | null
          is_official?: boolean
          notes?: string | null
          nuclei_familiari?: number | null
          percentuale_famiglie?: number | null
          percentuale_giovani?: number | null
          percentuale_stranieri?: number | null
          polygon_coords?: Json | null
          popolazione?: number | null
          source_file?: string | null
          source_label?: string
          source_type?: string
          updated_at?: string | null
          zona_key?: string
          zona_label?: string
          zona_omi?: string | null
          zona_type?: string
        }
        Relationships: []
      }
      keydraft_imports: {
        Row: {
          bridge_payload: Json
          created_at: string
          id: string
          listing_id: string
          origin_map: Json
          run_id: string | null
          sottra_completions: Json
          source_app: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bridge_payload?: Json
          created_at?: string
          id?: string
          listing_id: string
          origin_map?: Json
          run_id?: string | null
          sottra_completions?: Json
          source_app?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bridge_payload?: Json
          created_at?: string
          id?: string
          listing_id?: string
          origin_map?: Json
          run_id?: string | null
          sottra_completions?: Json
          source_app?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      omi_polygons: {
        Row: {
          anno: number
          codice_comune_catastale: string
          comune_label: string
          created_at: string | null
          id: string
          import_batch_id: string | null
          imported_at: string | null
          polygon_coords: Json
          semestre: number
          source_file: string | null
          source_hash: string | null
          zona_omi: string
        }
        Insert: {
          anno?: number
          codice_comune_catastale: string
          comune_label?: string
          created_at?: string | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          polygon_coords: Json
          semestre?: number
          source_file?: string | null
          source_hash?: string | null
          zona_omi: string
        }
        Update: {
          anno?: number
          codice_comune_catastale?: string
          comune_label?: string
          created_at?: string | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          polygon_coords?: Json
          semestre?: number
          source_file?: string | null
          source_hash?: string | null
          zona_omi?: string
        }
        Relationships: []
      }
      omi_quotazioni: {
        Row: {
          anno: number
          codice_comune_catastale: string
          codice_comune_istat: string | null
          comune_label: string
          created_at: string | null
          id: string
          provincia: string | null
          quotazione_max: number
          quotazione_min: number
          semestre: number
          stato_conservazione: string | null
          superficie_ref: string | null
          tipologia: string
          zona_omi: string
          zona_omi_label: string | null
        }
        Insert: {
          anno: number
          codice_comune_catastale: string
          codice_comune_istat?: string | null
          comune_label: string
          created_at?: string | null
          id?: string
          provincia?: string | null
          quotazione_max: number
          quotazione_min: number
          semestre: number
          stato_conservazione?: string | null
          superficie_ref?: string | null
          tipologia?: string
          zona_omi: string
          zona_omi_label?: string | null
        }
        Update: {
          anno?: number
          codice_comune_catastale?: string
          codice_comune_istat?: string | null
          comune_label?: string
          created_at?: string | null
          id?: string
          provincia?: string | null
          quotazione_max?: number
          quotazione_min?: number
          semestre?: number
          stato_conservazione?: string | null
          superficie_ref?: string | null
          tipologia?: string
          zona_omi?: string
          zona_omi_label?: string | null
        }
        Relationships: []
      }
      omi_zone: {
        Row: {
          anno: number
          codice_comune_catastale: string
          codice_comune_istat: string | null
          comune_label: string
          created_at: string | null
          fascia: string | null
          id: string
          link_zona: string | null
          microzona: number | null
          provincia: string | null
          semestre: number
          tipologia_prevalente: string | null
          zona_descr: string | null
          zona_omi: string
        }
        Insert: {
          anno: number
          codice_comune_catastale: string
          codice_comune_istat?: string | null
          comune_label?: string
          created_at?: string | null
          fascia?: string | null
          id?: string
          link_zona?: string | null
          microzona?: number | null
          provincia?: string | null
          semestre: number
          tipologia_prevalente?: string | null
          zona_descr?: string | null
          zona_omi: string
        }
        Update: {
          anno?: number
          codice_comune_catastale?: string
          codice_comune_istat?: string | null
          comune_label?: string
          created_at?: string | null
          fascia?: string | null
          id?: string
          link_zona?: string | null
          microzona?: number | null
          provincia?: string | null
          semestre?: number
          tipologia_prevalente?: string | null
          zona_descr?: string | null
          zona_omi?: string
        }
        Relationships: []
      }
      owner_access: {
        Row: {
          created_at: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      r03_asc_aggregates_2021: {
        Row: {
          asc_code: string
          asc_level: number
          asc_name: string | null
          buildings_2021: number | null
          comune_istat_code: string
          comune_name: string
          coverage_status: string
          created_at: string | null
          density_pop_per_kmq: number | null
          derivation_notes: string | null
          dwellings_2021: number | null
          families_2021: number | null
          id: string
          import_batch_id: string | null
          occupied_dwellings_2021: number | null
          population_2021: number | null
          residential_buildings_2021: number | null
          sections_count: number
          sections_with_data: number
          source_dataset: string
          source_year: number
          superficie_kmq: number | null
          updated_at: string | null
        }
        Insert: {
          asc_code: string
          asc_level: number
          asc_name?: string | null
          buildings_2021?: number | null
          comune_istat_code: string
          comune_name?: string
          coverage_status?: string
          created_at?: string | null
          density_pop_per_kmq?: number | null
          derivation_notes?: string | null
          dwellings_2021?: number | null
          families_2021?: number | null
          id?: string
          import_batch_id?: string | null
          occupied_dwellings_2021?: number | null
          population_2021?: number | null
          residential_buildings_2021?: number | null
          sections_count?: number
          sections_with_data?: number
          source_dataset?: string
          source_year?: number
          superficie_kmq?: number | null
          updated_at?: string | null
        }
        Update: {
          asc_code?: string
          asc_level?: number
          asc_name?: string | null
          buildings_2021?: number | null
          comune_istat_code?: string
          comune_name?: string
          coverage_status?: string
          created_at?: string | null
          density_pop_per_kmq?: number | null
          derivation_notes?: string | null
          dwellings_2021?: number | null
          families_2021?: number | null
          id?: string
          import_batch_id?: string | null
          occupied_dwellings_2021?: number | null
          population_2021?: number | null
          residential_buildings_2021?: number | null
          sections_count?: number
          sections_with_data?: number
          source_dataset?: string
          source_year?: number
          superficie_kmq?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      safety_zones: {
        Row: {
          anno_rilevazione: string | null
          centroid_lat: number | null
          centroid_lng: number | null
          codice_comune_catastale: string
          codice_comune_istat: string | null
          comune_label: string
          coverage_level: string
          created_at: string | null
          data_quality: string
          furti_abitazione: number | null
          id: string
          import_batch_id: string | null
          indice_sicurezza_percepita: number | null
          is_official: boolean
          notes: string | null
          polygon_coords: Json | null
          rapine: number | null
          reati_per_1000_abitanti: number | null
          reati_totali: number | null
          source_file: string | null
          source_label: string
          source_type: string
          updated_at: string | null
          zona_key: string
          zona_label: string
          zona_omi: string | null
          zona_type: string
        }
        Insert: {
          anno_rilevazione?: string | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          codice_comune_catastale: string
          codice_comune_istat?: string | null
          comune_label?: string
          coverage_level?: string
          created_at?: string | null
          data_quality?: string
          furti_abitazione?: number | null
          id?: string
          import_batch_id?: string | null
          indice_sicurezza_percepita?: number | null
          is_official?: boolean
          notes?: string | null
          polygon_coords?: Json | null
          rapine?: number | null
          reati_per_1000_abitanti?: number | null
          reati_totali?: number | null
          source_file?: string | null
          source_label?: string
          source_type?: string
          updated_at?: string | null
          zona_key: string
          zona_label?: string
          zona_omi?: string | null
          zona_type?: string
        }
        Update: {
          anno_rilevazione?: string | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          codice_comune_catastale?: string
          codice_comune_istat?: string | null
          comune_label?: string
          coverage_level?: string
          created_at?: string | null
          data_quality?: string
          furti_abitazione?: number | null
          id?: string
          import_batch_id?: string | null
          indice_sicurezza_percepita?: number | null
          is_official?: boolean
          notes?: string | null
          polygon_coords?: Json | null
          rapine?: number | null
          reati_per_1000_abitanti?: number | null
          reati_totali?: number | null
          source_file?: string | null
          source_label?: string
          source_type?: string
          updated_at?: string | null
          zona_key?: string
          zona_label?: string
          zona_omi?: string | null
          zona_type?: string
        }
        Relationships: []
      }
      scan_events: {
        Row: {
          created_at: string
          id: string
          scan_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scan_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scan_id?: string
          user_id?: string
        }
        Relationships: []
      }
      sub_municipal_areas_2021: {
        Row: {
          area_code: string
          area_name: string
          area_type: string
          asc_level: number | null
          bbox: Json | null
          centroid_lat: number | null
          centroid_lng: number | null
          comune_catastale_code: string | null
          comune_istat_code: string | null
          comune_name: string
          created_at: string | null
          densita: number | null
          eta_media: number | null
          id: string
          import_batch_id: string | null
          imported_at: string | null
          metadata_json: Json | null
          nuclei_familiari: number | null
          polygon_coords: Json | null
          popolazione: number | null
          provincia_code: string | null
          provincia_name: string | null
          regione_code: string | null
          regione_name: string | null
          source_dataset: string
          source_label: string
          source_year: number
          superficie_kmq: number | null
        }
        Insert: {
          area_code: string
          area_name?: string
          area_type?: string
          asc_level?: number | null
          bbox?: Json | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          comune_catastale_code?: string | null
          comune_istat_code?: string | null
          comune_name?: string
          created_at?: string | null
          densita?: number | null
          eta_media?: number | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          metadata_json?: Json | null
          nuclei_familiari?: number | null
          polygon_coords?: Json | null
          popolazione?: number | null
          provincia_code?: string | null
          provincia_name?: string | null
          regione_code?: string | null
          regione_name?: string | null
          source_dataset: string
          source_label?: string
          source_year?: number
          superficie_kmq?: number | null
        }
        Update: {
          area_code?: string
          area_name?: string
          area_type?: string
          asc_level?: number | null
          bbox?: Json | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          comune_catastale_code?: string | null
          comune_istat_code?: string | null
          comune_name?: string
          created_at?: string | null
          densita?: number | null
          eta_media?: number | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          metadata_json?: Json | null
          nuclei_familiari?: number | null
          polygon_coords?: Json | null
          popolazione?: number | null
          provincia_code?: string | null
          provincia_name?: string | null
          regione_code?: string | null
          regione_name?: string | null
          source_dataset?: string
          source_label?: string
          source_year?: number
          superficie_kmq?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          price_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      territorial_dataset_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          dataset_type: string
          error_log: Json | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          import_batch_id: string | null
          records_errors: number | null
          records_imported: number | null
          records_skipped: number | null
          records_total: number | null
          started_at: string | null
          stats: Json | null
          status: string
          updated_at: string
          validation_result: Json | null
          warnings: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dataset_type: string
          error_log?: Json | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          import_batch_id?: string | null
          records_errors?: number | null
          records_imported?: number | null
          records_skipped?: number | null
          records_total?: number | null
          started_at?: string | null
          stats?: Json | null
          status?: string
          updated_at?: string
          validation_result?: Json | null
          warnings?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dataset_type?: string
          error_log?: Json | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          import_batch_id?: string | null
          records_errors?: number | null
          records_imported?: number | null
          records_skipped?: number | null
          records_total?: number | null
          started_at?: string | null
          stats?: Json | null
          status?: string
          updated_at?: string
          validation_result?: Json | null
          warnings?: Json | null
        }
        Relationships: []
      }
      territorial_registry: {
        Row: {
          asc_code: string
          asc_level: number | null
          asc_name: string | null
          asc_type: string | null
          centroid_lat: number | null
          centroid_lng: number | null
          comune_istat_code: string
          comune_name: string
          coverage_status: string
          created_at: string | null
          dataset_status: string
          geographic_level: string
          id: string
          import_batch_id: string | null
          localita_code: string
          localita_name: string | null
          localita_type: string | null
          metadata_json: Json | null
          provincia_code: string | null
          provincia_name: string | null
          regione_code: string | null
          regione_name: string | null
          source_key: string
          source_label: string
          source_year: number | null
          updated_at: string | null
        }
        Insert: {
          asc_code?: string
          asc_level?: number | null
          asc_name?: string | null
          asc_type?: string | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          comune_istat_code: string
          comune_name?: string
          coverage_status?: string
          created_at?: string | null
          dataset_status?: string
          geographic_level?: string
          id?: string
          import_batch_id?: string | null
          localita_code?: string
          localita_name?: string | null
          localita_type?: string | null
          metadata_json?: Json | null
          provincia_code?: string | null
          provincia_name?: string | null
          regione_code?: string | null
          regione_name?: string | null
          source_key?: string
          source_label?: string
          source_year?: number | null
          updated_at?: string | null
        }
        Update: {
          asc_code?: string
          asc_level?: number | null
          asc_name?: string | null
          asc_type?: string | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          comune_istat_code?: string
          comune_name?: string
          coverage_status?: string
          created_at?: string | null
          dataset_status?: string
          geographic_level?: string
          id?: string
          import_batch_id?: string | null
          localita_code?: string
          localita_name?: string | null
          localita_type?: string | null
          metadata_json?: Json | null
          provincia_code?: string | null
          provincia_name?: string | null
          regione_code?: string | null
          regione_name?: string | null
          source_key?: string
          source_label?: string
          source_year?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_trials: {
        Row: {
          created_at: string
          id: string
          max_scans: number
          scans_used: number
          trial_end: string
          trial_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_scans?: number
          scans_used?: number
          trial_end?: string
          trial_start?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_scans?: number
          scans_used?: number
          trial_end?: string
          trial_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      record_scan: {
        Args: { _scan_id: string; _user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
