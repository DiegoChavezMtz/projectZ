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
          accumulate_days: number
          allow_accumulate: boolean
          auto_confirm: boolean
          category: string
          close_deadline_hours: number
          closes_at: string | null
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
          accumulate_days?: number
          allow_accumulate?: boolean
          auto_confirm?: boolean
          category?: string
          close_deadline_hours?: number
          closes_at?: string | null
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
          accumulate_days?: number
          allow_accumulate?: boolean
          auto_confirm?: boolean
          category?: string
          close_deadline_hours?: number
          closes_at?: string | null
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
          order_id: string | null
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
          order_id?: string | null
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
          order_id?: string | null
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
            foreignKeyName: "claim_wins_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      deliveries: {
        Row: {
          address_snapshot: Json | null
          buyer_id: string
          created_at: string
          delivered_at: string | null
          fee_paid_at: string | null
          id: string
          method: Database["public"]["Enums"]["delivery_method"]
          pay_due_at: string | null
          pickup_note: string | null
          quote_due_at: string
          quoted_at: string | null
          reminded_at: string | null
          requested_at: string
          seller_id: string
          ship_due_at: string | null
          shipped_at: string | null
          shipping_cents: number
          status: Database["public"]["Enums"]["delivery_status"]
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          address_snapshot?: Json | null
          buyer_id: string
          created_at?: string
          delivered_at?: string | null
          fee_paid_at?: string | null
          id?: string
          method: Database["public"]["Enums"]["delivery_method"]
          pay_due_at?: string | null
          pickup_note?: string | null
          quote_due_at: string
          quoted_at?: string | null
          reminded_at?: string | null
          requested_at: string
          seller_id: string
          ship_due_at?: string | null
          shipped_at?: string | null
          shipping_cents?: number
          status: Database["public"]["Enums"]["delivery_status"]
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          address_snapshot?: Json | null
          buyer_id?: string
          created_at?: string
          delivered_at?: string | null
          fee_paid_at?: string | null
          id?: string
          method?: Database["public"]["Enums"]["delivery_method"]
          pay_due_at?: string | null
          pickup_note?: string | null
          quote_due_at?: string
          quoted_at?: string | null
          reminded_at?: string | null
          requested_at?: string
          seller_id?: string
          ship_due_at?: string | null
          shipped_at?: string | null
          shipping_cents?: number
          status?: Database["public"]["Enums"]["delivery_status"]
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deliveries_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["user_id"]
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
      notification_queue: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          payload: Json
          sent_at: string | null
          template: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          template: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          template?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_disputes: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          note: string
          order_id: string
          resolution_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["dispute_status"]
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          note: string
          order_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          note?: string
          order_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accumulate: boolean
          accumulate_grace_until: string | null
          accumulate_notice_at: string | null
          accumulate_reminded_at: string | null
          accumulate_until: string | null
          address_snapshot: Json | null
          buyer_id: string
          close_delivery_method:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          close_due_at: string
          close_shipping_cents: number
          closed_at: string | null
          completed_at: string | null
          created_at: string
          delivery_id: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"] | null
          id: string
          items_total_cents: number
          paid_at: string | null
          pay_due_at: string | null
          pickup_note: string | null
          proof_submitted_at: string | null
          released_at: string | null
          reminded_at: string | null
          seller_id: string
          session_id: string
          shipping_cents: number
          shipping_deferred: boolean
          status: Database["public"]["Enums"]["order_status"]
          total_cents: number | null
          unpaid_at: string | null
          updated_at: string
        }
        Insert: {
          accumulate?: boolean
          accumulate_grace_until?: string | null
          accumulate_notice_at?: string | null
          accumulate_reminded_at?: string | null
          accumulate_until?: string | null
          address_snapshot?: Json | null
          buyer_id: string
          close_delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          close_due_at: string
          close_shipping_cents?: number
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_id?: string | null
          delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          id?: string
          items_total_cents: number
          paid_at?: string | null
          pay_due_at?: string | null
          pickup_note?: string | null
          proof_submitted_at?: string | null
          released_at?: string | null
          reminded_at?: string | null
          seller_id: string
          session_id: string
          shipping_cents?: number
          shipping_deferred?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number | null
          unpaid_at?: string | null
          updated_at?: string
        }
        Update: {
          accumulate?: boolean
          accumulate_grace_until?: string | null
          accumulate_notice_at?: string | null
          accumulate_reminded_at?: string | null
          accumulate_until?: string | null
          address_snapshot?: Json | null
          buyer_id?: string
          close_delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          close_due_at?: string
          close_shipping_cents?: number
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_id?: string | null
          delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          id?: string
          items_total_cents?: number
          paid_at?: string | null
          pay_due_at?: string | null
          pickup_note?: string | null
          proof_submitted_at?: string | null
          released_at?: string | null
          reminded_at?: string | null
          seller_id?: string
          session_id?: string
          shipping_cents?: number
          shipping_deferred?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number | null
          unpaid_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_seller_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "claim_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          created_at: string
          delivery_id: string | null
          file_path: string
          id: string
          order_id: string | null
          reject_reason: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["proof_status"]
          target: Database["public"]["Enums"]["proof_target"]
          uploader_id: string
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          file_path: string
          id?: string
          order_id?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["proof_status"]
          target: Database["public"]["Enums"]["proof_target"]
          uploader_id: string
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          file_path?: string
          id?: string
          order_id?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["proof_status"]
          target?: Database["public"]["Enums"]["proof_target"]
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      reputation_events: {
        Row: {
          counterparty_id: string | null
          delivery_id: string | null
          id: string
          kind: Database["public"]["Enums"]["rep_kind"]
          occurred_at: string
          order_id: string | null
          payload: Json
          role: string
          session_id: string | null
          status: Database["public"]["Enums"]["rep_status"]
          user_id: string
        }
        Insert: {
          counterparty_id?: string | null
          delivery_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["rep_kind"]
          occurred_at?: string
          order_id?: string | null
          payload?: Json
          role: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["rep_status"]
          user_id: string
        }
        Update: {
          counterparty_id?: string | null
          delivery_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["rep_kind"]
          occurred_at?: string
          order_id?: string | null
          payload?: Json
          role?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["rep_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reputation_events_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_events_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "claim_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
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
          orders_released: number
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
          orders_released?: number
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
          orders_released?: number
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
      public_disputes: {
        Row: {
          buyer_id: string | null
          created_at: string | null
          note: string | null
          order_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["dispute_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "claim_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
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
      accept_offer: { Args: { p_entry_id: string }; Returns: Json }
      admin_resolve_dispute: {
        Args: {
          p_note?: string
          p_order_id: string
          p_resolution: Database["public"]["Enums"]["dispute_status"]
        }
        Returns: Json
      }
      audit_session: {
        Args: { p_session_id: string }
        Returns: {
          detail: string
          item_id: string
          violation: string
        }[]
      }
      audit_user_stats: {
        Args: { p_user_id: string }
        Returns: {
          actual: number
          metric: string
          stored: number
        }[]
      }
      award_item: { Args: { p_entry_id: string }; Returns: string }
      bump_stat: {
        Args: { p_column: string; p_delta: number; p_user_id: string }
        Returns: undefined
      }
      cancel_session: { Args: { p_session_id: string }; Returns: Json }
      claim_item: { Args: { p_item_id: string }; Returns: Json }
      close_expired_sessions: { Args: never; Returns: Json }
      close_order: {
        Args: {
          p_delivery_method: Database["public"]["Enums"]["delivery_method"]
          p_order_id: string
          p_shipping_cents: number
        }
        Returns: Json
      }
      confirm_delivery: { Args: { p_delivery_id: string }; Returns: Json }
      confirm_entry: { Args: { p_entry_id: string }; Returns: Json }
      create_session_orders: { Args: { p_session_id: string }; Returns: number }
      delivery_deadline_hours: {
        Args: { p_delivery_id: string; p_kind: string }
        Returns: number
      }
      end_session: { Args: { p_session_id: string }; Returns: Json }
      enqueue_notification: {
        Args: {
          p_dedupe_key: string
          p_payload?: Json
          p_template: string
          p_user_id: string
        }
        Returns: undefined
      }
      feature_item: {
        Args: { p_featured?: boolean; p_item_id: string }
        Returns: Json
      }
      generate_claim_code: { Args: never; Returns: string }
      get_payment_instructions: { Args: { p_order_id: string }; Returns: Json }
      internal_end_session: {
        Args: { p_actor: string; p_scheduled?: boolean; p_session_id: string }
        Returns: Json
      }
      is_handle_available: { Args: { p_handle: string }; Returns: boolean }
      is_session_owner: {
        Args: { p_session_id: string; p_uid: string }
        Returns: boolean
      }
      is_slug_available: { Args: { p_slug: string }; Returns: boolean }
      is_test_email: { Args: { email: string }; Returns: boolean }
      is_valid_address: { Args: { p_address: Json }; Returns: boolean }
      lock_seller_entry: {
        Args: {
          p_entry_id: string
          p_kind: Database["public"]["Enums"]["entry_kind"]
          p_uid: string
        }
        Returns: Json
      }
      log_reputation_event: {
        Args: {
          p_at?: string
          p_counterparty_id?: string
          p_delivery_id?: string
          p_kind: Database["public"]["Enums"]["rep_kind"]
          p_order_id?: string
          p_payload?: Json
          p_role: string
          p_session_id?: string
          p_user_id: string
        }
        Returns: string
      }
      log_session_feed: {
        Args: {
          p_actor_id?: string
          p_item_id: string
          p_payload?: Json
          p_session_id: string
          p_type: Database["public"]["Enums"]["feed_event_type"]
        }
        Returns: number
      }
      make_offer: {
        Args: { p_amount_cents: number; p_item_id: string }
        Returns: Json
      }
      mark_shipped: {
        Args: { p_delivery_id: string; p_tracking_code?: string }
        Returns: Json
      }
      object_unpaid: {
        Args: { p_note: string; p_order_id: string }
        Returns: Json
      }
      pd_accumulate: {
        Args: { p_now: string; p_test_only?: boolean }
        Returns: number
      }
      pd_auto_confirm: {
        Args: { p_now: string; p_test_only?: boolean }
        Returns: number
      }
      pd_fee: {
        Args: { p_now: string; p_test_only?: boolean }
        Returns: number
      }
      pd_reminders: {
        Args: { p_now: string; p_test_only?: boolean }
        Returns: number
      }
      pd_unpaid: {
        Args: { p_now: string; p_test_only?: boolean }
        Returns: number
      }
      post_announcement: {
        Args: { p_session_id: string; p_text: string }
        Returns: Json
      }
      process_deadlines: { Args: { p_now?: string }; Returns: Json }
      publish_session: { Args: { p_session_id: string }; Returns: Json }
      quote_delivery: {
        Args: { p_delivery_id: string; p_shipping_cents: number }
        Returns: Json
      }
      recompute_item_state: { Args: { p_item_id: string }; Returns: undefined }
      reject_entry: { Args: { p_entry_id: string }; Returns: Json }
      reject_offer: { Args: { p_entry_id: string }; Returns: Json }
      release_accumulated_order: { Args: { p_order_id: string }; Returns: Json }
      release_all_items: { Args: { p_session_id: string }; Returns: Json }
      release_item: { Args: { p_item_id: string }; Returns: Json }
      release_order: {
        Args: { p_now: string; p_order_id: string; p_reason: string }
        Returns: undefined
      }
      reorder_items: {
        Args: { p_ordered_ids: string[]; p_session_id: string }
        Returns: Json
      }
      request_delivery: {
        Args: {
          p_address?: Json
          p_method: Database["public"]["Enums"]["delivery_method"]
          p_order_ids: string[]
          p_pickup_note?: string
        }
        Returns: Json
      }
      review_payment_proof: {
        Args: { p_accept: boolean; p_proof_id: string; p_reason?: string }
        Returns: Json
      }
      rpc_error: { Args: { p_code: string; p_message: string }; Returns: Json }
      server_now: { Args: never; Returns: string }
      set_order_accumulate: {
        Args: { p_order_id: string; p_value: boolean }
        Returns: Json
      }
      set_session_close: {
        Args: { p_closes_at: string; p_session_id: string }
        Returns: Json
      }
      start_session: { Args: { p_session_id: string }; Returns: Json }
      submit_payment_proof: {
        Args: {
          p_address?: Json
          p_file_path: string
          p_pickup_note?: string
          p_target: Database["public"]["Enums"]["proof_target"]
          p_target_id: string
        }
        Returns: Json
      }
      withdraw_entry: { Args: { p_entry_id: string }; Returns: Json }
      withdraw_item: { Args: { p_item_id: string }; Returns: Json }
    }
    Enums: {
      code_purpose: "verify_email" | "login" | "reset_password" | "change_email"
      delivery_method: "shipping" | "pickup"
      delivery_status:
        | "requested"
        | "awaiting_payment"
        | "payment_review"
        | "preparing"
        | "shipped"
        | "delivered"
        | "cancelled"
      dispute_status: "open" | "upheld" | "revoked"
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
        | "session_extended"
      item_status: "hidden" | "available" | "sold" | "withdrawn"
      order_status:
        | "pending_close"
        | "awaiting_payment"
        | "payment_review"
        | "paid"
        | "unpaid"
        | "released"
        | "cancelled"
      proof_status: "submitted" | "accepted" | "rejected"
      proof_target: "order" | "delivery"
      release_mode: "all_at_start" | "manual"
      rep_kind:
        | "paid_on_time"
        | "paid_late"
        | "unpaid"
        | "order_closed_on_time"
        | "order_closed_late"
        | "delivered_on_time"
        | "delivered_late"
        | "received"
        | "rated"
        | "accumulate_released"
      rep_status: "active" | "disputed" | "revoked"
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
      delivery_method: ["shipping", "pickup"],
      delivery_status: [
        "requested",
        "awaiting_payment",
        "payment_review",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      dispute_status: ["open", "upheld", "revoked"],
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
        "session_extended",
      ],
      item_status: ["hidden", "available", "sold", "withdrawn"],
      order_status: [
        "pending_close",
        "awaiting_payment",
        "payment_review",
        "paid",
        "unpaid",
        "released",
        "cancelled",
      ],
      proof_status: ["submitted", "accepted", "rejected"],
      proof_target: ["order", "delivery"],
      release_mode: ["all_at_start", "manual"],
      rep_kind: [
        "paid_on_time",
        "paid_late",
        "unpaid",
        "order_closed_on_time",
        "order_closed_late",
        "delivered_on_time",
        "delivered_late",
        "received",
        "rated",
        "accumulate_released",
      ],
      rep_status: ["active", "disputed", "revoked"],
      session_status: ["draft", "scheduled", "live", "ended", "cancelled"],
    },
  },
} as const
