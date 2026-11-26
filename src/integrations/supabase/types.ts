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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_type: string
          code: string
          created_at: string
          detection_key: string | null
          evidence: Json
          id: string
          monitoring_record_id: string | null
          org_id: string
          owner: string | null
          related_ids: string[]
          risk_level: Database["public"]["Enums"]["risk_level"]
          score: number
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          transaction_id: string | null
        }
        Insert: {
          alert_type: string
          code: string
          created_at?: string
          detection_key?: string | null
          evidence?: Json
          id?: string
          monitoring_record_id?: string | null
          org_id: string
          owner?: string | null
          related_ids?: string[]
          risk_level: Database["public"]["Enums"]["risk_level"]
          score: number
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          transaction_id?: string | null
        }
        Update: {
          alert_type?: string
          code?: string
          created_at?: string
          detection_key?: string | null
          evidence?: Json
          id?: string
          monitoring_record_id?: string | null
          org_id?: string
          owner?: string | null
          related_ids?: string[]
          risk_level?: Database["public"]["Enums"]["risk_level"]
          score?: number
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_monitoring_tenant_fk"
            columns: ["org_id", "monitoring_record_id"]
            isOneToOne: false
            referencedRelation: "monitoring_records"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string
          id: string
          org_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_documents: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string
          filename: string
          id: string
          org_id: string
          record_id: string | null
          storage_path: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string
          filename: string
          id?: string
          org_id: string
          record_id?: string | null
          storage_path: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string
          filename?: string
          id?: string
          org_id?: string
          record_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_documents_org_id_case_id_fkey"
            columns: ["org_id", "case_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "evidence_documents_org_id_record_id_fkey"
            columns: ["org_id", "record_id"]
            isOneToOne: false
            referencedRelation: "monitoring_records"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      investigation_notes: {
        Row: {
          body: string
          case_id: string
          created_at: string
          created_by: string
          id: string
          org_id: string
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string
          created_by?: string
          id?: string
          org_id: string
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          created_by?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_notes_org_id_case_id_fkey"
            columns: ["org_id", "case_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      investigations: {
        Row: {
          alert_id: string
          assigned_to: string | null
          created_at: string
          created_by: string
          evidence_snapshot: Json
          id: string
          org_id: string
          outcome: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          alert_id: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          evidence_snapshot?: Json
          id?: string
          org_id: string
          outcome?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          alert_id?: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          evidence_snapshot?: Json
          id?: string
          org_id?: string
          outcome?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigations_org_id_alert_id_fkey"
            columns: ["org_id", "alert_id"]
            isOneToOne: true
            referencedRelation: "alerts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "investigations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_records: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          id: string
          kind: string
          label: string
          org_id: string
          payload: Json
          record_date: string
          replaces_id: string | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          kind: string
          label: string
          org_id: string
          payload?: Json
          record_date: string
          replaces_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          kind?: string
          label?: string
          org_id?: string
          payload?: Json
          record_date?: string
          replaces_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_records_org_id_replaces_id_fkey"
            columns: ["org_id", "replaces_id"]
            isOneToOne: false
            referencedRelation: "monitoring_records"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "monitoring_records_org_id_transaction_id_fkey"
            columns: ["org_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      org_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          approval_limit: number
          base_currency: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          approval_limit?: number
          base_currency?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          approval_limit?: number
          base_currency?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          counterparty: string
          counterparty_type: string
          created_at: string
          created_by: string
          currency: string
          description: string | null
          direction: string
          employee: string | null
          frequency: string
          id: string
          invoice_ref: string | null
          org_id: string
          payment_method: string | null
          reference: string | null
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          risk_score: number
          source: string
          txn_date: string
        }
        Insert: {
          amount: number
          counterparty: string
          counterparty_type?: string
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          direction?: string
          employee?: string | null
          frequency?: string
          id?: string
          invoice_ref?: string | null
          org_id: string
          payment_method?: string | null
          reference?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          risk_score?: number
          source?: string
          txn_date: string
        }
        Update: {
          amount?: number
          counterparty?: string
          counterparty_type?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          direction?: string
          employee?: string | null
          frequency?: string
          id?: string
          invoice_ref?: string | null
          org_id?: string
          payment_method?: string | null
          reference?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          risk_score?: number
          source?: string
          txn_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_pending_invites: { Args: never; Returns: number }
      create_organization: {
        Args: { _currency?: string; _name: string }
        Returns: string
      }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
    }
    Enums: {
      alert_status:
        | "open"
        | "investigating"
        | "pending_review"
        | "resolved"
        | "dismissed"
      org_role: "admin" | "financial_manager" | "auditor" | "employee"
      risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
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
      alert_status: [
        "open",
        "investigating",
        "pending_review",
        "resolved",
        "dismissed",
      ],
      org_role: ["admin", "financial_manager", "auditor", "employee"],
      risk_level: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    },
  },
} as const
