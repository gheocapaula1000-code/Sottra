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
