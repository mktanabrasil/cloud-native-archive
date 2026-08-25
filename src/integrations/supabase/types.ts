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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          email: string
          id: string
          name: string
          requested_at: string
          requested_permission_level: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          requested_unit: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          email: string
          id?: string
          name: string
          requested_at?: string
          requested_permission_level?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          requested_unit?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          email?: string
          id?: string
          name?: string
          requested_at?: string
          requested_permission_level?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          requested_unit?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          unit: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          unit?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          unit?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          attachments: Json | null
          banner_display_time: number | null
          banner_image_desktop: string | null
          banner_image_mobile: string | null
          banner_url_desktop: string | null
          banner_url_mobile: string | null
          collaborating_units: Json | null
          created_at: string
          created_by: string | null
          custom_color: string | null
          deleted_at: string | null
          description: string | null
          end_datetime: string
          equipment_needed: string | null
          event_logo_url: string | null
          event_type: string
          external_collaborators: Json | null
          external_id: string | null
          food_logistics: string | null
          full_height_title: boolean | null
          has_conflict: boolean | null
          has_unit_collaboration: boolean | null
          id: string
          location: string | null
          marketing_info: string | null
          marketing_items: Json | null
          marketing_request: boolean | null
          notes: string | null
          partner_involved: boolean | null
          partner_name: string | null
          partner_type: string | null
          partners: Json | null
          printed_materials: string | null
          show_banner_fade: boolean | null
          show_banner_overlay: boolean | null
          show_in_banner: boolean | null
          slug: string | null
          start_datetime: string
          status: string
          support_team: string | null
          target_audience: string | null
          title: string
          transport_needed: boolean | null
          transport_passengers: number | null
          transport_vehicle: string | null
          unit: string
          updated_at: string
          updated_by: string | null
          use_logo_as_title: boolean | null
          visibility: string | null
        }
        Insert: {
          attachments?: Json | null
          banner_display_time?: number | null
          banner_image_desktop?: string | null
          banner_image_mobile?: string | null
          banner_url_desktop?: string | null
          banner_url_mobile?: string | null
          collaborating_units?: Json | null
          created_at?: string
          created_by?: string | null
          custom_color?: string | null
          deleted_at?: string | null
          description?: string | null
          end_datetime: string
          equipment_needed?: string | null
          event_logo_url?: string | null
          event_type: string
          external_collaborators?: Json | null
          external_id?: string | null
          food_logistics?: string | null
          full_height_title?: boolean | null
          has_conflict?: boolean | null
          has_unit_collaboration?: boolean | null
          id?: string
          location?: string | null
          marketing_info?: string | null
          marketing_items?: Json | null
          marketing_request?: boolean | null
          notes?: string | null
          partner_involved?: boolean | null
          partner_name?: string | null
          partner_type?: string | null
          partners?: Json | null
          printed_materials?: string | null
          show_banner_fade?: boolean | null
          show_banner_overlay?: boolean | null
          show_in_banner?: boolean | null
          slug?: string | null
          start_datetime: string
          status?: string
          support_team?: string | null
          target_audience?: string | null
          title: string
          transport_needed?: boolean | null
          transport_passengers?: number | null
          transport_vehicle?: string | null
          unit: string
          updated_at?: string
          updated_by?: string | null
          use_logo_as_title?: boolean | null
          visibility?: string | null
        }
        Update: {
          attachments?: Json | null
          banner_display_time?: number | null
          banner_image_desktop?: string | null
          banner_image_mobile?: string | null
          banner_url_desktop?: string | null
          banner_url_mobile?: string | null
          collaborating_units?: Json | null
          created_at?: string
          created_by?: string | null
          custom_color?: string | null
          deleted_at?: string | null
          description?: string | null
          end_datetime?: string
          equipment_needed?: string | null
          event_logo_url?: string | null
          event_type?: string
          external_collaborators?: Json | null
          external_id?: string | null
          food_logistics?: string | null
          full_height_title?: boolean | null
          has_conflict?: boolean | null
          has_unit_collaboration?: boolean | null
          id?: string
          location?: string | null
          marketing_info?: string | null
          marketing_items?: Json | null
          marketing_request?: boolean | null
          notes?: string | null
          partner_involved?: boolean | null
          partner_name?: string | null
          partner_type?: string | null
          partners?: Json | null
          printed_materials?: string | null
          show_banner_fade?: boolean | null
          show_banner_overlay?: boolean | null
          show_in_banner?: boolean | null
          slug?: string | null
          start_datetime?: string
          status?: string
          support_team?: string | null
          target_audience?: string | null
          title?: string
          transport_needed?: boolean | null
          transport_passengers?: number | null
          transport_vehicle?: string | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
          use_logo_as_title?: boolean | null
          visibility?: string | null
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          created_at: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      journals: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          pages: Json
          paper: string | null
          profile_unit: string | null
          reference_month: string | null
          status: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          pages?: Json
          paper?: string | null
          profile_unit?: string | null
          reference_month?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          pages?: Json
          paper?: string | null
          profile_unit?: string | null
          reference_month?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      news_bulletins: {
        Row: {
          blocks: Json
          category: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          header_data: Json
          id: string
          profile_unit: string
          status: string
          title: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          header_data?: Json
          id?: string
          profile_unit: string
          status?: string
          title?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          header_data?: Json
          id?: string
          profile_unit?: string
          status?: string
          title?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bond_type: string | null
          created_at: string
          delegated_units: string[] | null
          email: string | null
          id: string
          is_active: boolean | null
          is_beta_tester: boolean | null
          modules: string[] | null
          name: string | null
          partner_category: string | null
          permission_level: string | null
          status: string | null
          unit: string | null
          updated_at: string
          user_id: string
          view_restrictions: Json | null
        }
        Insert: {
          bond_type?: string | null
          created_at?: string
          delegated_units?: string[] | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_beta_tester?: boolean | null
          modules?: string[] | null
          name?: string | null
          partner_category?: string | null
          permission_level?: string | null
          status?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
          view_restrictions?: Json | null
        }
        Update: {
          bond_type?: string | null
          created_at?: string
          delegated_units?: string[] | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_beta_tester?: boolean | null
          modules?: string[] | null
          name?: string | null
          partner_category?: string | null
          permission_level?: string | null
          status?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
          view_restrictions?: Json | null
        }
        Relationships: []
      }
      sheet_mappings: {
        Row: {
          created_at: string
          display_order: number
          id: string
          separator: string | null
          sheet_field: string
          system_field: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          separator?: string | null
          sheet_field: string
          system_field: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          separator?: string | null
          sheet_field?: string
          system_field?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_configs: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      transparency_configs: {
        Row: {
          created_at: string | null
          folder_id: string
          id: string
          label: string
          original_folder_name: string | null
          show_original_name: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          folder_id: string
          id?: string
          label: string
          original_folder_name?: string | null
          show_original_name?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          folder_id?: string
          id?: string
          label?: string
          original_folder_name?: string | null
          show_original_name?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ui_versions: {
        Row: {
          commit_sha: string | null
          config_json: Json | null
          created_at: string
          created_by: string | null
          deployed_at: string | null
          deployed_by: string | null
          description: string | null
          environment: string | null
          id: string
          is_active_beta: boolean | null
          is_active_production: boolean | null
          name: string
        }
        Insert: {
          commit_sha?: string | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          deployed_at?: string | null
          deployed_by?: string | null
          description?: string | null
          environment?: string | null
          id?: string
          is_active_beta?: boolean | null
          is_active_production?: boolean | null
          name: string
        }
        Update: {
          commit_sha?: string | null
          config_json?: Json | null
          created_at?: string
          created_by?: string | null
          deployed_at?: string | null
          deployed_by?: string | null
          description?: string | null
          environment?: string | null
          id?: string
          is_active_beta?: boolean | null
          is_active_production?: boolean | null
          name?: string
        }
        Relationships: []
      }
      user_google_tokens: {
        Row: {
          created_at: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      view_configs: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      widget_templates: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          type?: string
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
      can_manage_unit: { Args: { target_unit: string }; Returns: boolean }
      check_audit_log_access: { Args: { log_unit: string }; Returns: boolean }
      check_is_admin: { Args: { _uid: string }; Returns: boolean }
      check_is_manager: { Args: { _uid: string }; Returns: boolean }
      check_profile_unit_access: {
        Args: { profile_id: string }
        Returns: boolean
      }
      get_user_delegated_units: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      get_user_unit: { Args: { _user_id: string }; Returns: string }
      get_user_unit_v2: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_unit_access: { Args: { target_unit: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_manager_of_unit: {
        Args: { _unit: string; _user_id: string }
        Returns: boolean
      }
      is_marketing_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer" | "usuario_padrao" | "criador"
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
      app_role: ["admin", "editor", "viewer", "usuario_padrao", "criador"],
    },
  },
} as const
