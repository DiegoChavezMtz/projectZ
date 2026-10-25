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
      claim_entries: {
        Row: {
          amount_cents: number
          buyer_id: string
          created_at: string
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["entry_kind"]
          resolved_at: string | null
          seq: number
          session_id: string
          status: Database["public"]["Enums"]["entry_status"]
        }
        Insert: {
          amount_cents: number
          buyer_id: string
          created_at?: string
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["entry_kind"]
          resolved_at?: string | null
          seq?: never
          session_id: string
          status: Database["public"]["Enums"]["entry_status"]
        }
        Update: {
          amount_cents?: number
          buyer_id?: string
          created_at?: string
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["entry_kind"]
          resolved_at?: string | null
          seq?: never
          session_id?: string
          status?: Database["public"]["Enums"]["entry_status"]
        }
        Relationships: [
          {
            foreignKeyName: "claim_entries_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_entries_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "claim_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "claim_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_items: {
        Row: {
          attributes: Json
          category: string
          created_at: string
          id: string
          image_path: string | null
          is_featured: boolean
          is_preview: boolean
          leader_at: string | null
          leader_display_name: string | null
          leader_entry_id: string | null
          leader_handle: string | null
          leader_user_id: string | null
          leader_wins_count: number | null
          offer_count: number
          position: number
          price_cents: number
          released_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["item_status"]
          title: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          category?: string
          created_at?: string
          id?: string
          image_path?: string | null
          is_featured?: boolean
          is_preview?: boolean
          leader_at?: string | null
          leader_display_name?: string | null
          leader_entry_id?: string | null
          leader_handle?: string | null
          leader_user_id?: string | null
          leader_wins_count?: number | null
          offer_count?: number
          position: number
          price_cents: number
          released_at?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["item_status"]
          title: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          category?: string
          created_at?: string
          id?: string
          image_path?: string | null
          is_featured?: boolean
          is_preview?: boolean
          leader_at?: string | null
          leader_display_name?: string | null
          leader_entry_id?: string | null
          leader_handle?: string | null
          leader_user_id?: string | null
          leader_wins_count?: number | null
          offer_count?: number
          position?: number
          price_cents?: number
          released_at?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["item_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_items_leader_entry_fkey"
            columns: ["leader_entry_id"]
            isOneToOne: false
            referencedRelation: "claim_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "claim_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_sessions: {
        Row: {
          allow_accumulate: boolean
          auto_confirm: boolean
          category: string
          close_deadline_hours: number
          code: string
          created_at: string
          description: string | null
          ended_at: string | null
          expected_duration_minutes: number | null
          id: string
          is_test: boolean
          payment_deadline_hours: number
          release_mode: Database["public"]["Enums"]["release_mode"]
          rules: string | null
          seller_id: string
          shipping_deadline_hours: number
          started_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at: string
        }
        Insert: {
          allow_accumulate?: boolean
          auto_confirm?: boolean
          category?: string
          close_deadline_hours?: number
          code: string
          created_at?: string
          description?: string | null
          ended_at?: string | null
          expected_duration_minutes?: number | null
          id?: string
          is_test?: boolean
          payment_deadline_hours?: number
          release_mode?: Database["public"]["Enums"]["release_mode"]
          rules?: string | null
          seller_id: string
          shipping_deadline_hours?: number
          started_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at?: string
        }
        Update: {
          allow_accumulate?: boolean
          auto_confirm?: boolean
          category?: string
          close_deadline_hours?: number
          code?: string
          created_at?: string
          description?: string | null
          ended_at?: string | null
          expected_duration_minutes?: number | null
          id?: string
          is_test?: boolean
          payment_deadline_hours?: number
          release_mode?: Database["public"]["Enums"]["release_mode"]
          rules?: string | null
          seller_id?: string
          shipping_deadline_hours?: number
          started_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_sessions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "claim_sessions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      claim_wins: {
        Row: {
          buyer_id: string
          entry_id: string
          id: string
          item_id: string
          price_cents: number
          seller_id: string
          session_id: string
          won_at: string
          won_via: Database["public"]["Enums"]["entry_kind"]
        }
        Insert: {
          buyer_id: string
          entry_id: string
          id?: string
          item_id: string
          price_cents: number
          seller_id: string
          session_id: string
          won_at?: string
          won_via: Database["public"]["Enums"]["entry_kind"]
        }
        Update: {
          buyer_id?: string
          entry_id?: string
          id?: string
          item_id?: string
          price_cents?: number
          seller_id?: string
          session_id?: string
          won_at?: string
          won_via?: Database["public"]["Enums"]["entry_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "claim_wins_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_wins_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_wins_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "claim_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_wins_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "claim_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_wins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "claim_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          ip_hash: string | null
          payload: Json
          purpose: Database["public"]["Enums"]["code_purpose"]
          user_id: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          ip_hash?: string | null
          payload?: Json
          purpose: Database["public"]["Enums"]["code_purpose"]
          user_id?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          payload?: Json
          purpose?: Database["public"]["Enums"]["code_purpose"]
          user_id?: string | null
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          created_at: string
          html_body: string
          id: string
          payload: Json
          subject: string
          template: string
          text_body: string
          to_email: string
        }
        Insert: {
          created_at?: string
          html_body: string
          id?: string
          payload: Json
          subject: string
          template: string
          text_body: string
          to_email: string
        }
        Update: {
          created_at?: string
          html_body?: string
          id?: string
          payload?: Json
          subject?: string
          template?: string
          text_body?: string
          to_email?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepted_terms_at: string | null
          avatar_path: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          handle: string
          id: string
          is_test: boolean
          updated_at: string
        }
        Insert: {
          accepted_terms_at?: string | null
          avatar_path?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          handle: string
          id: string
          is_test?: boolean
          updated_at?: string
        }
        Update: {
          accepted_terms_at?: string | null
          avatar_path?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          handle?: string
          id?: string
          is_test?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      seller_profiles: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          payment_instructions: string | null
          shop_name: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string
          payment_instructions?: string | null
          shop_name: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string
          payment_instructions?: string | null
          shop_name?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_feed: {
        Row: {
          actor_display_name: string | null
          actor_id: string | null
          created_at: string
          id: number
          item_id: string | null
          payload: Json
          session_id: string
          type: Database["public"]["Enums"]["feed_event_type"]
        }
        Insert: {
          actor_display_name?: string | null
          actor_id?: string | null
          created_at?: string
          id?: never
          item_id?: string | null
          payload?: Json
          session_id: string
          type: Database["public"]["Enums"]["feed_event_type"]
        }
        Update: {
          actor_display_name?: string | null
          actor_id?: string | null
          created_at?: string
          id?: never
          item_id?: string | null
          payload?: Json
          session_id?: string
          type?: Database["public"]["Enums"]["feed_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "session_feed_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "claim_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          first_entry_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          first_entry_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          first_entry_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "claim_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          deliveries_late: number
          deliveries_on_time: number
          deliveries_received: number
          orders_closed_late: number
          orders_closed_on_time: number
          orders_paid_late: number
          orders_paid_on_time: number
          orders_unpaid: number
          rating_as_buyer_count: number
          rating_as_buyer_sum: number
          rating_as_seller_count: number
          rating_as_seller_sum: number
          sessions_hosted: number
          sessions_participated: number
          updated_at: string
          user_id: string
          wins_count: number
          wins_sold: number
        }
        Insert: {
          deliveries_late?: number
          deliveries_on_time?: number
          deliveries_received?: number
          orders_closed_late?: number
          orders_closed_on_time?: number
          orders_paid_late?: number
          orders_paid_on_time?: number
          orders_unpaid?: number
          rating_as_buyer_count?: number
          rating_as_buyer_sum?: number
          rating_as_seller_count?: number
          rating_as_seller_sum?: number
          sessions_hosted?: number
          sessions_participated?: number
          updated_at?: string
          user_id: string
          wins_count?: number
          wins_sold?: number
        }
        Update: {
          deliveries_late?: number
          deliveries_on_time?: number
          deliveries_received?: number
          orders_closed_late?: number
          orders_closed_on_time?: number
          orders_paid_late?: number
          orders_paid_on_time?: number
          orders_unpaid?: number
          rating_as_buyer_count?: number
          rating_as_buyer_sum?: number
          rating_as_seller_count?: number
          rating_as_seller_sum?: number
          sessions_hosted?: number
          sessions_participated?: number
          updated_at?: string
          user_id?: string
          wins_count?: number
          wins_sold?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_path: string | null
          created_at: string | null
          display_name: string | null
          handle: string | null
          id: string | null
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
        }
        Update: {
          avatar_path?: string | null
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
        }
        Relationships: []
      }
      public_seller_profiles: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string | null
          shop_name: string | null
          slug: string | null
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string | null
          shop_name?: string | null
          slug?: string | null
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string | null
          shop_name?: string | null
          slug?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cancel_session: { Args: { p_session_id: string }; Returns: Json }
      generate_claim_code: { Args: never; Returns: string }
      is_handle_available: { Args: { p_handle: string }; Returns: boolean }
      is_slug_available: { Args: { p_slug: string }; Returns: boolean }
      is_test_email: { Args: { email: string }; Returns: boolean }
      publish_session: { Args: { p_session_id: string }; Returns: Json }
      reorder_items: {
        Args: { p_ordered_ids: string[]; p_session_id: string }
        Returns: Json
      }
    }
    Enums: {
      code_purpose: "verify_email" | "login" | "reset_password" | "change_email"
      entry_kind: "claim" | "offer"
      entry_status:
        | "queued"
        | "pending"
        | "accepted"
        | "rejected"
        | "withdrawn"
        | "superseded"
      feed_event_type:
        | "session_started"
        | "session_ended"
        | "item_released"
        | "item_claimed"
        | "item_offer"
        | "item_sold"
        | "item_withdrawn"
        | "entry_rejected"
        | "announcement"
        | "item_featured"
      item_status: "hidden" | "available" | "sold" | "withdrawn"
      release_mode: "all_at_start" | "manual"
      session_status: "draft" | "scheduled" | "live" | "ended" | "cancelled"
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
      code_purpose: ["verify_email", "login", "reset_password", "change_email"],
      entry_kind: ["claim", "offer"],
      entry_status: [
        "queued",
        "pending",
        "accepted",
        "rejected",
        "withdrawn",
        "superseded",
      ],
      feed_event_type: [
        "session_started",
        "session_ended",
        "item_released",
        "item_claimed",
        "item_offer",
        "item_sold",
        "item_withdrawn",
        "entry_rejected",
        "announcement",
        "item_featured",
      ],
      item_status: ["hidden", "available", "sold", "withdrawn"],
      release_mode: ["all_at_start", "manual"],
      session_status: ["draft", "scheduled", "live", "ended", "cancelled"],
    },
  },
} as const
