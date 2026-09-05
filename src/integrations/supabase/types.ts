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
      ai_job_state: {
        Row: {
          consecutive_failures: number
          items_on_date: string | null
          items_today: number
          job_name: string
          last_error: string | null
          last_run_at: string | null
          lease_until: string | null
          paused_at: string | null
          paused_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          items_on_date?: string | null
          items_today?: number
          job_name: string
          last_error?: string | null
          last_run_at?: string | null
          lease_until?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          items_on_date?: string | null
          items_today?: number
          job_name?: string
          last_error?: string | null
          last_run_at?: string | null
          lease_until?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_insights: {
        Row: {
          created_at: string
          id: string
          input_fingerprint: string
          model: string | null
          payload: Json
          range_days: number
          shop_id: string
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_fingerprint: string
          model?: string | null
          payload: Json
          range_days: number
          shop_id: string
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          created_at?: string
          id?: string
          input_fingerprint?: string
          model?: string | null
          payload?: Json
          range_days?: number
          shop_id?: string
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_insights_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      app_runtime_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          account_email: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          last_synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      booking_calendar_outbox: {
        Row: {
          action: string
          attempt_count: number
          attempts: number
          booking_id: string
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          processed_at: string | null
          provider_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          attempt_count?: number
          attempts?: number
          booking_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          processed_at?: string | null
          provider_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          attempt_count?: number
          attempts?: number
          booking_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          processed_at?: string | null
          provider_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_calendar_outbox_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_calendar_outbox_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_due_cents: number | null
          amount_paid_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_id: string
          customer_name: string | null
          customer_phone: string | null
          ends_at: string
          google_event_id: string | null
          hold_expires_at: string | null
          id: string
          notes: string | null
          payment_environment: string | null
          payment_status: string
          price_cents: number
          provider_id: string | null
          refunded_cents: number
          service_id: string
          shop_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_due_cents?: number | null
          amount_paid_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          customer_name?: string | null
          customer_phone?: string | null
          ends_at: string
          google_event_id?: string | null
          hold_expires_at?: string | null
          id?: string
          notes?: string | null
          payment_environment?: string | null
          payment_status?: string
          price_cents: number
          provider_id?: string | null
          refunded_cents?: number
          service_id: string
          shop_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_due_cents?: number | null
          amount_paid_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string | null
          customer_phone?: string | null
          ends_at?: string
          google_event_id?: string | null
          hold_expires_at?: string | null
          id?: string
          notes?: string | null
          payment_environment?: string | null
          payment_status?: string
          price_cents?: number
          provider_id?: string | null
          refunded_cents?: number
          service_id?: string
          shop_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number
          note: string | null
          redeemed_count: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number
          note?: string | null
          redeemed_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number
          note?: string | null
          redeemed_count?: number
        }
        Relationships: []
      }
      comp_grants: {
        Row: {
          code_id: string | null
          created_at: string
          id: string
          redeemed_at: string
          redeemed_by: string | null
          shop_id: string
        }
        Insert: {
          code_id?: string | null
          created_at?: string
          id?: string
          redeemed_at?: string
          redeemed_by?: string | null
          shop_id: string
        }
        Update: {
          code_id?: string | null
          created_at?: string
          id?: string
          redeemed_at?: string
          redeemed_by?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comp_grants_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "comp_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comp_grants_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_feedback: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          emotion: string | null
          enriched_at: string | null
          enrichment_attempts: number
          enrichment_error: string | null
          enrichment_last_attempt_at: string | null
          enrichment_model: string | null
          enrichment_next_attempt_at: string | null
          enrichment_raw: Json | null
          enrichment_status: string
          explanation: string | null
          id: string
          key_phrases: string[]
          message: string | null
          rating: number | null
          recommended_response: string | null
          sentiment_label: string | null
          sentiment_score: number | null
          shop_id: string
          source: string | null
          status: string
          summary: string | null
          updated_at: string
          urgency: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          emotion?: string | null
          enriched_at?: string | null
          enrichment_attempts?: number
          enrichment_error?: string | null
          enrichment_last_attempt_at?: string | null
          enrichment_model?: string | null
          enrichment_next_attempt_at?: string | null
          enrichment_raw?: Json | null
          enrichment_status?: string
          explanation?: string | null
          id?: string
          key_phrases?: string[]
          message?: string | null
          rating?: number | null
          recommended_response?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          shop_id: string
          source?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          emotion?: string | null
          enriched_at?: string | null
          enrichment_attempts?: number
          enrichment_error?: string | null
          enrichment_last_attempt_at?: string | null
          enrichment_model?: string | null
          enrichment_next_attempt_at?: string | null
          enrichment_raw?: Json | null
          enrichment_status?: string
          explanation?: string | null
          id?: string
          key_phrases?: string[]
          message?: string | null
          rating?: number | null
          recommended_response?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          shop_id?: string
          source?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_feedback_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_reports: {
        Row: {
          complaint_themes: Json
          created_at: string
          feedback_count: number
          id: string
          model: string | null
          overall_sentiment: number | null
          praise_themes: Json
          shop_id: string
          suggestions: Json
          summary: string | null
          window_end: string
          window_start: string
        }
        Insert: {
          complaint_themes?: Json
          created_at?: string
          feedback_count?: number
          id?: string
          model?: string | null
          overall_sentiment?: number | null
          praise_themes?: Json
          shop_id: string
          suggestions?: Json
          summary?: string | null
          window_end: string
          window_start: string
        }
        Update: {
          complaint_themes?: Json
          created_at?: string
          feedback_count?: number
          id?: string
          model?: string | null
          overall_sentiment?: number | null
          praise_themes?: Json
          shop_id?: string
          suggestions?: Json
          summary?: string | null
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_reports_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_signups: {
        Row: {
          created_at: string
          first_touch_at: string | null
          heard_about: string | null
          heard_about_detail: string | null
          id: string
          landing_referrer: string | null
          last_synced_at: string | null
          owner_email: string | null
          owner_id: string
          owner_name: string | null
          plan_state: string
          shop_id: string
          shop_name: string
          shop_slug: string
          signed_up_at: string
          signup_trial_ends_at: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          trial_expires_notified_at: string | null
          trial_source: string
          trial_started_at: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          first_touch_at?: string | null
          heard_about?: string | null
          heard_about_detail?: string | null
          id?: string
          landing_referrer?: string | null
          last_synced_at?: string | null
          owner_email?: string | null
          owner_id: string
          owner_name?: string | null
          plan_state?: string
          shop_id: string
          shop_name: string
          shop_slug: string
          signed_up_at?: string
          signup_trial_ends_at?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_expires_notified_at?: string | null
          trial_source?: string
          trial_started_at?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          first_touch_at?: string | null
          heard_about?: string | null
          heard_about_detail?: string | null
          id?: string
          landing_referrer?: string | null
          last_synced_at?: string | null
          owner_email?: string | null
          owner_id?: string
          owner_name?: string | null
          plan_state?: string
          shop_id?: string
          shop_name?: string
          shop_slug?: string
          signed_up_at?: string
          signup_trial_ends_at?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_expires_notified_at?: string | null
          trial_source?: string
          trial_started_at?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_signups_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_trial_events: {
        Row: {
          created_at: string
          event: string
          id: string
          occurred_at: string
          owner_id: string | null
          plan_state: string | null
          shop_id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          occurred_at?: string
          owner_id?: string | null
          plan_state?: string | null
          shop_id: string
          source?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          occurred_at?: string
          owner_id?: string | null
          plan_state?: string | null
          shop_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_trial_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          attempts: number
          created_at: string
          environment: string
          event_id: string
          event_type: string
          id: string
          last_error: string | null
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          environment: string
          event_id: string
          event_type: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          environment?: string
          event_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          shop_id: string
          specialties: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          shop_id: string
          specialties?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          shop_id?: string
          specialties?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "providers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_hours: {
        Row: {
          close_time: string
          created_at: string
          id: string
          is_closed: boolean
          open_time: string
          shop_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          close_time?: string
          created_at?: string
          id?: string
          is_closed?: boolean
          open_time?: string
          shop_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          close_time?: string
          created_at?: string
          id?: string
          is_closed?: boolean
          open_time?: string
          shop_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_hours_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_payout_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          environment: string
          id: string
          payouts_enabled: boolean
          shop_id: string
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          environment?: string
          id?: string
          payouts_enabled?: boolean
          shop_id: string
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          environment?: string
          id?: string
          payouts_enabled?: boolean
          shop_id?: string
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_payout_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          cancel_free_hours: number
          categories: Database["public"]["Enums"]["service_category"][]
          contact_phone: string | null
          cover_image_url: string | null
          created_at: string
          deposit_percent: number
          description: string | null
          facebook_url: string | null
          google_review_url: string | null
          id: string
          instagram_url: string | null
          late_cancel_fee_percent: number
          logo_url: string | null
          name: string
          owner_id: string
          prepay_mode: string
          reschedule_allowed: boolean
          reschedule_min_hours: number
          slug: string
          social_links: Json
          tiktok_url: string | null
          updated_at: string
          website_url: string | null
          whatsapp: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          cancel_free_hours?: number
          categories?: Database["public"]["Enums"]["service_category"][]
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          deposit_percent?: number
          description?: string | null
          facebook_url?: string | null
          google_review_url?: string | null
          id?: string
          instagram_url?: string | null
          late_cancel_fee_percent?: number
          logo_url?: string | null
          name: string
          owner_id: string
          prepay_mode?: string
          reschedule_allowed?: boolean
          reschedule_min_hours?: number
          slug: string
          social_links?: Json
          tiktok_url?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          cancel_free_hours?: number
          categories?: Database["public"]["Enums"]["service_category"][]
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          deposit_percent?: number
          description?: string | null
          facebook_url?: string | null
          google_review_url?: string | null
          id?: string
          instagram_url?: string | null
          late_cancel_fee_percent?: number
          logo_url?: string | null
          name?: string
          owner_id?: string
          prepay_mode?: string
          reschedule_allowed?: boolean
          reschedule_min_hours?: number
          slug?: string
          social_links?: Json
          tiktok_url?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          attempts: number
          created_at: string
          environment: string
          event_type: string
          last_error: string | null
          processed_at: string | null
          status: string
          stripe_created_at: string
          stripe_event_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          environment: string
          event_type: string
          last_error?: string | null
          processed_at?: string | null
          status: string
          stripe_created_at: string
          stripe_event_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          environment?: string
          event_type?: string
          last_error?: string | null
          processed_at?: string | null
          status?: string
          stripe_created_at?: string
          stripe_event_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          environment: string
          id: string
          last_stripe_event_at: string | null
          plan: string
          price_id: string | null
          shop_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          environment?: string
          id?: string
          last_stripe_event_at?: string | null
          plan?: string
          price_id?: string | null
          shop_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          environment?: string
          id?: string
          last_stripe_event_at?: string | null
          plan?: string
          price_id?: string | null
          shop_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_invites: {
        Row: {
          booking_id: string | null
          created_at: string
          customer_email: string
          customer_id: string | null
          customer_name: string | null
          delivery_terminal: boolean
          email_attempts: number
          email_error: string | null
          email_idempotency_key: string | null
          email_last_attempt_at: string | null
          email_next_attempt_at: string | null
          email_status: string
          emailed_at: string | null
          expires_at: string
          feedback_id: string | null
          id: string
          last_attempt_at: string | null
          next_attempt_at: string | null
          provider_id: string | null
          rating_hint: number | null
          responded_at: string | null
          sent_at: string
          shop_id: string
          token: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          customer_email: string
          customer_id?: string | null
          customer_name?: string | null
          delivery_terminal?: boolean
          email_attempts?: number
          email_error?: string | null
          email_idempotency_key?: string | null
          email_last_attempt_at?: string | null
          email_next_attempt_at?: string | null
          email_status?: string
          emailed_at?: string | null
          expires_at?: string
          feedback_id?: string | null
          id?: string
          last_attempt_at?: string | null
          next_attempt_at?: string | null
          provider_id?: string | null
          rating_hint?: number | null
          responded_at?: string | null
          sent_at?: string
          shop_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string | null
          delivery_terminal?: boolean
          email_attempts?: number
          email_error?: string | null
          email_idempotency_key?: string | null
          email_last_attempt_at?: string | null
          email_next_attempt_at?: string | null
          email_status?: string
          emailed_at?: string | null
          expires_at?: string
          feedback_id?: string | null
          id?: string
          last_attempt_at?: string | null
          next_attempt_at?: string | null
          provider_id?: string | null
          rating_hint?: number | null
          responded_at?: string | null
          sent_at?: string
          shop_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_invites_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_invites_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "customer_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_invites_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_invites_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      survey_invite_delivery_problems: {
        Row: {
          booking_id: string | null
          customer_email: string | null
          email_attempts: number | null
          email_error: string | null
          email_last_attempt_at: string | null
          email_next_attempt_at: string | null
          email_status: string | null
          expires_at: string | null
          id: string | null
          sent_at: string | null
          shop_id: string | null
        }
        Insert: {
          booking_id?: string | null
          customer_email?: string | null
          email_attempts?: number | null
          email_error?: string | null
          email_last_attempt_at?: string | null
          email_next_attempt_at?: string | null
          email_status?: string | null
          expires_at?: string | null
          id?: string | null
          sent_at?: string | null
          shop_id?: string | null
        }
        Update: {
          booking_id?: string | null
          customer_email?: string | null
          email_attempts?: number | null
          email_error?: string | null
          email_last_attempt_at?: string | null
          email_next_attempt_at?: string | null
          email_status?: string | null
          expires_at?: string | null
          id?: string | null
          sent_at?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_invites_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_invites_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      expire_stale_booking_holds: { Args: never; Returns: number }
      get_survey_invite_by_token: {
        Args: { _token: string }
        Returns: {
          customer_name: string
          provider_name: string
          rating_hint: number
          shop_name: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_feedback_job: { Args: { job_slug: string }; Returns: number }
      pending_survey_retries: {
        Args: never
        Returns: {
          attempts: number
          customer_email: string
          customer_name: string
          invite_id: string
          provider_name: string
          service_name: string
          shop_address: string
          shop_name: string
          token: string
        }[]
      }
      pending_survey_targets: {
        Args: never
        Returns: {
          booking_id: string
          customer_email: string
          customer_id: string
          customer_name: string
          ends_at: string
          google_review_url: string
          provider_id: string
          provider_name: string
          service_name: string
          shop_address: string
          shop_id: string
          shop_name: string
        }[]
      }
      provision_job_scheduler: {
        Args: { _app_url: string; _secret: string }
        Returns: string
      }
      redeem_comp_code: {
        Args: { _code: string; _shop_id: string; _user_id: string }
        Returns: string
      }
      shop_has_active_analytics: {
        Args: { _env?: string; _shop_id: string }
        Returns: boolean
      }
      submit_survey_feedback: {
        Args: { _message: string; _rating: number; _token: string }
        Returns: {
          created_at: string
          feedback_id: string
          google_review_url: string
          prompt_google: boolean
          rating: number
        }[]
      }
    }
    Enums: {
      app_role: "customer" | "provider" | "owner" | "admin"
      booking_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      service_category:
        | "hair_barber"
        | "nails"
        | "waxing"
        | "makeup"
        | "massage"
        | "skincare_facials"
        | "brows_lashes"
        | "spa_wellness"
        | "esthetician"
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
      app_role: ["customer", "provider", "owner", "admin"],
      booking_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      service_category: [
        "hair_barber",
        "nails",
        "waxing",
        "makeup",
        "massage",
        "skincare_facials",
        "brows_lashes",
        "spa_wellness",
        "esthetician",
      ],
    },
  },
} as const
