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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          title: string
          unit_code: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          title?: string
          unit_code?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          title?: string
          unit_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          owner_id: string
          role: string
          sources: Json
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          owner_id: string
          role: string
          sources?: Json
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          role?: string
          sources?: Json
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["doc_category"]
          created_at: string
          file_path: string
          id: string
          is_published: boolean
          issued_date: string | null
          title: string
          unit_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["doc_category"]
          created_at?: string
          file_path: string
          id?: string
          is_published?: boolean
          issued_date?: string | null
          title: string
          unit_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["doc_category"]
          created_at?: string
          file_path?: string
          id?: string
          is_published?: boolean
          issued_date?: string | null
          title?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          button_label: string
          footer: string
          heading: string
          lang: string
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          button_label?: string
          footer?: string
          heading?: string
          lang: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          button_label?: string
          footer?: string
          heading?: string
          lang?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          from_admin: boolean
          id: string
          owner_id: string
          read_at: string | null
          sender_id: string
          unit_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          from_admin?: boolean
          id?: string
          owner_id: string
          read_at?: string | null
          sender_id: string
          unit_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          from_admin?: boolean
          id?: string
          owner_id?: string
          read_at?: string | null
          sender_id?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          kind: string
          owner_id: string
          period_label: string | null
          read_at: string | null
          report_id: string | null
          unit_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          kind: string
          owner_id: string
          period_label?: string | null
          read_at?: string | null
          report_id?: string | null
          unit_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          kind?: string
          owner_id?: string
          period_label?: string | null
          read_at?: string | null
          report_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ownerships: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          owner_id: string
          start_date: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          owner_id: string
          start_date?: string
          unit_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          owner_id?: string
          start_date?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownerships_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ownerships_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_documents: {
        Row: {
          created_at: string
          file_path: string
          from_admin: boolean
          id: string
          owner_id: string
          title: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          from_admin?: boolean
          id?: string
          owner_id: string
          title?: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          from_admin?: boolean
          id?: string
          owner_id?: string
          title?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payment_plan_items: {
        Row: {
          created_at: string
          id: string
          paid_at: string | null
          paid_by: string | null
          plan_id: string
          priority: number
          report_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          plan_id: string
          priority: number
          report_id: string
        }
        Update: {
          created_at?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          plan_id?: string
          priority?: number
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          plan_date: string
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["payment_plan_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          plan_date?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["payment_plan_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          plan_date?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["payment_plan_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          phone: string | null
          preferred_language: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          phone?: string | null
          preferred_language?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          phone?: string | null
          preferred_language?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          accent: string | null
          code: string
          created_at: string
          id: string
          logo_url: string | null
          managed_by: string
          mark_url: string | null
          name: string
          short_name: string
          sort_order: number
        }
        Insert: {
          accent?: string | null
          code: string
          created_at?: string
          id?: string
          logo_url?: string | null
          managed_by?: string
          mark_url?: string | null
          name: string
          short_name?: string
          sort_order?: number
        }
        Update: {
          accent?: string | null
          code?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          managed_by?: string
          mark_url?: string | null
          name?: string
          short_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          currency: string
          due_date: string | null
          file_path: string
          id: string
          is_paid: boolean
          is_published: boolean
          net_payout: number | null
          no_roi_payment: boolean
          paid_at: string | null
          payout_note: string | null
          period_end: string | null
          period_label: string
          period_start: string | null
          receipt_path: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          unit_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          due_date?: string | null
          file_path: string
          id?: string
          is_paid?: boolean
          is_published?: boolean
          net_payout?: number | null
          no_roi_payment?: boolean
          paid_at?: string | null
          payout_note?: string | null
          period_end?: string | null
          period_label: string
          period_start?: string | null
          receipt_path?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          unit_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          due_date?: string | null
          file_path?: string
          id?: string
          is_paid?: boolean
          is_published?: boolean
          net_payout?: number | null
          no_roi_payment?: boolean
          paid_at?: string | null
          payout_note?: string | null
          period_end?: string | null
          period_label?: string
          period_start?: string | null
          receipt_path?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_project_access: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_project_access_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          building: string | null
          building_area: number | null
          code: string
          coefficient: number | null
          created_at: string
          floor: number | null
          id: string
          is_investment_contract: boolean
          land_area: number | null
          ma_end: string | null
          ma_number: string | null
          ma_start: string | null
          project_id: string | null
          purchase_currency: string
          purchase_date: string | null
          purchase_price: number | null
          rental_pool_start: string | null
          unit_type: string | null
          vat_rate: number
        }
        Insert: {
          building?: string | null
          building_area?: number | null
          code: string
          coefficient?: number | null
          created_at?: string
          floor?: number | null
          id?: string
          is_investment_contract?: boolean
          land_area?: number | null
          ma_end?: string | null
          ma_number?: string | null
          ma_start?: string | null
          project_id?: string | null
          purchase_currency?: string
          purchase_date?: string | null
          purchase_price?: number | null
          rental_pool_start?: string | null
          unit_type?: string | null
          vat_rate?: number
        }
        Update: {
          building?: string | null
          building_area?: number | null
          code?: string
          coefficient?: number | null
          created_at?: string
          floor?: number | null
          id?: string
          is_investment_contract?: boolean
          land_area?: number | null
          ma_end?: string | null
          ma_number?: string | null
          ma_start?: string | null
          project_id?: string | null
          purchase_currency?: string
          purchase_date?: string | null
          purchase_price?: number | null
          rental_pool_start?: string | null
          unit_type?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "units_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_payment_plan_item:
        | { Args: { _item_id: string; _paid_by: string }; Returns: undefined }
        | {
            Args: { _item_id: string; _paid_at?: string; _paid_by: string }
            Returns: undefined
          }
      has_unit_access: {
        Args: { _unit_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin"
      doc_category:
        | "mou"
        | "lease_agreement"
        | "addendum"
        | "bast"
        | "booking_form"
        | "management_agreement"
        | "other"
        | "payment_details"
        | "resale_agreement"
        | "bank_details"
      payment_plan_status: "draft" | "published" | "completed" | "cancelled"
      report_status: "draft" | "published"
      report_type: "roi" | "ipl" | "other"
      staff_role: "admin" | "finance" | "luxso"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["owner", "admin"],
      doc_category: [
        "mou",
        "lease_agreement",
        "addendum",
        "bast",
        "booking_form",
        "management_agreement",
        "other",
        "payment_details",
        "resale_agreement",
        "bank_details",
      ],
      payment_plan_status: ["draft", "published", "completed", "cancelled"],
      report_status: ["draft", "published"],
      report_type: ["roi", "ipl", "other"],
      staff_role: ["admin", "finance", "luxso"],
    },
  },
} as const
