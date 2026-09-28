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
      asset_files: {
        Row: {
          asset_id: string
          content_type: string | null
          created_at: string
          file_name: string
          format: string
          id: string
          size_bytes: number
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          asset_id: string
          content_type?: string | null
          created_at?: string
          file_name: string
          format: string
          id?: string
          size_bytes?: number
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          asset_id?: string
          content_type?: string | null
          created_at?: string
          file_name?: string
          format?: string
          id?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_files_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "digital_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_events: {
        Row: {
          actor: string | null
          amount: number | null
          auction_id: string
          created_at: string
          details: Json
          id: string
          kind: string
        }
        Insert: {
          actor?: string | null
          amount?: number | null
          auction_id: string
          created_at?: string
          details?: Json
          id?: string
          kind: string
        }
        Update: {
          actor?: string | null
          amount?: number | null
          auction_id?: string
          created_at?: string
          details?: Json
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_events_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_invites: {
        Row: {
          auction_id: string
          created_at: string
          email: string
          id: string
          invited_by: string
          responded_at: string | null
          status: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          email: string
          id?: string
          invited_by: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_invites_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_at: string
          id: string
          increment: number
          listing_id: string
          order_id: string | null
          owner_user_id: string | null
          pay_by: string | null
          reserve: number
          start_bid: number
          starts_at: string
          status: string
          visibility: string
          winner_user_id: string | null
          winning_amount: number | null
          winning_bid_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_at: string
          id: string
          increment?: number
          listing_id: string
          order_id?: string | null
          owner_user_id?: string | null
          pay_by?: string | null
          reserve: number
          start_bid: number
          starts_at: string
          status?: string
          visibility?: string
          winner_user_id?: string | null
          winning_amount?: number | null
          winning_bid_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          increment?: number
          listing_id?: string
          order_id?: string | null
          owner_user_id?: string | null
          pay_by?: string | null
          reserve?: number
          start_bid?: number
          starts_at?: string
          status?: string
          visibility?: string
          winner_user_id?: string | null
          winning_amount?: number | null
          winning_bid_id?: string | null
        }
        Relationships: []
      }
      bids: {
        Row: {
          amount: number
          auction_id: string
          bidder_name: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          amount: number
          auction_id: string
          bidder_name: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          auction_id?: string
          bidder_name?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          exhibition_id: string
          id: string
          order_id: string | null
          quantity: number
          reference: string
          slot: string
          status: string
          tickets: Json
          total: number
          user_id: string
          visit_date: string
        }
        Insert: {
          created_at?: string
          exhibition_id: string
          id?: string
          order_id?: string | null
          quantity: number
          reference?: string
          slot: string
          status?: string
          tickets?: Json
          total?: number
          user_id: string
          visit_date: string
        }
        Update: {
          created_at?: string
          exhibition_id?: string
          id?: string
          order_id?: string | null
          quantity?: number
          reference?: string
          slot?: string
          status?: string
          tickets?: Json
          total?: number
          user_id?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          item: Json
          key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          item: Json
          key: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          item?: Json
          key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      digital_assets: {
        Row: {
          category: string
          category_ar: string
          code: string
          collection: string
          color: string
          created_at: string
          description: string | null
          description_ar: string | null
          founded: number | null
          id: string
          is_official: boolean
          kind: string
          license: string
          license_ar: string
          name: string
          name_ar: string
          preview_url: string | null
          sort: number
          tags: string[]
        }
        Insert: {
          category?: string
          category_ar?: string
          code: string
          collection?: string
          color?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          founded?: number | null
          id: string
          is_official?: boolean
          kind?: string
          license?: string
          license_ar?: string
          name: string
          name_ar: string
          preview_url?: string | null
          sort?: number
          tags?: string[]
        }
        Update: {
          category?: string
          category_ar?: string
          code?: string
          collection?: string
          color?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          founded?: number | null
          id?: string
          is_official?: boolean
          kind?: string
          license?: string
          license_ar?: string
          name?: string
          name_ar?: string
          preview_url?: string | null
          sort?: number
          tags?: string[]
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          body: string
          body_ar: string
          created_at: string
          id: string
          kind: string
          last_attempt_at: string | null
          last_error: string | null
          link: string | null
          sent_at: string | null
          status: string
          subject: string
          subject_ar: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body?: string
          body_ar?: string
          created_at?: string
          id?: string
          kind: string
          last_attempt_at?: string | null
          last_error?: string | null
          link?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          subject_ar: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          body_ar?: string
          created_at?: string
          id?: string
          kind?: string
          last_attempt_at?: string | null
          last_error?: string | null
          link?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          subject_ar?: string
          user_id?: string
        }
        Relationships: []
      }
      exhibitions: {
        Row: {
          capacity: number
          created_at: string
          id: string
        }
        Insert: {
          capacity: number
          created_at?: string
          id: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          message: string
          replied_at: string | null
          reply: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          message: string
          replied_at?: string | null
          reply?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          message?: string
          replied_at?: string | null
          reply?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_agents: {
        Row: {
          agency: string
          agency_ar: string
          agent_name: string
          agent_name_ar: string
          agent_user_id: string | null
          created_at: string
          id: string
          license_no: string
          listing_id: string
          owner_approved_at: string | null
          revoked_at: string | null
          scope: string[]
          valid_from: string
          valid_until: string
        }
        Insert: {
          agency?: string
          agency_ar?: string
          agent_name: string
          agent_name_ar?: string
          agent_user_id?: string | null
          created_at?: string
          id?: string
          license_no: string
          listing_id: string
          owner_approved_at?: string | null
          revoked_at?: string | null
          scope?: string[]
          valid_from?: string
          valid_until: string
        }
        Update: {
          agency?: string
          agency_ar?: string
          agent_name?: string
          agent_name_ar?: string
          agent_user_id?: string | null
          created_at?: string
          id?: string
          license_no?: string
          listing_id?: string
          owner_approved_at?: string | null
          revoked_at?: string | null
          scope?: string[]
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_agents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_drafts: {
        Row: {
          alt_text: string
          alt_text_ar: string
          created_at: string
          description: string
          description_ar: string
          id: string
          image_path: string | null
          medium: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          tags: string[]
          title: string
          title_ar: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alt_text?: string
          alt_text_ar?: string
          created_at?: string
          description?: string
          description_ar?: string
          id?: string
          image_path?: string | null
          medium?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          tags?: string[]
          title?: string
          title_ar?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          alt_text?: string
          alt_text_ar?: string
          created_at?: string
          description?: string
          description_ar?: string
          id?: string
          image_path?: string | null
          medium?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          tags?: string[]
          title?: string
          title_ar?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          category: string
          created_at: string
          creator_id: string
          id: string
          owner_can_reply: boolean
          owner_user_id: string | null
          price: number
          status: string
          title: string
          title_ar: string
        }
        Insert: {
          category: string
          created_at?: string
          creator_id: string
          id: string
          owner_can_reply?: boolean
          owner_user_id?: string | null
          price?: number
          status?: string
          title: string
          title_ar?: string
        }
        Update: {
          category?: string
          created_at?: string
          creator_id?: string
          id?: string
          owner_can_reply?: boolean
          owner_user_id?: string | null
          price?: number
          status?: string
          title?: string
          title_ar?: string
        }
        Relationships: []
      }
      moderation_audit: {
        Row: {
          action: string
          actor: string
          created_at: string
          details: Json
          id: string
          reason: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          details?: Json
          id?: string
          reason?: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          details?: Json
          id?: string
          reason?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          bids: boolean
          email_orders: boolean
          email_saved_searches: boolean
          email_shipping: boolean
          orders: boolean
          shipping: boolean
          tickets: boolean
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bids?: boolean
          email_orders?: boolean
          email_saved_searches?: boolean
          email_shipping?: boolean
          orders?: boolean
          shipping?: boolean
          tickets?: boolean
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bids?: boolean
          email_orders?: boolean
          email_saved_searches?: boolean
          email_shipping?: boolean
          orders?: boolean
          shipping?: boolean
          tickets?: boolean
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          body_ar: string
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          title_ar: string
          user_id: string
        }
        Insert: {
          body?: string
          body_ar?: string
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          title_ar: string
          user_id: string
        }
        Update: {
          body?: string
          body_ar?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          title_ar?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          amount: number
          created_at: string
          id: string
          listing_id: string
          message: string
          response: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          listing_id: string
          message?: string
          response?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          listing_id?: string
          message?: string
          response?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string
          order_id: string
          to_status: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string
          order_id: string
          to_status: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          contact: Json
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          items: Json
          payment_attempts: number
          payment_error: string | null
          payment_method: string
          reference: string
          shipping: number
          shipping_address: Json | null
          status: string
          subtotal: number
          total: number
          user_id: string
          vat: number
        }
        Insert: {
          contact?: Json
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          items: Json
          payment_attempts?: number
          payment_error?: string | null
          payment_method: string
          reference?: string
          shipping?: number
          shipping_address?: Json | null
          status?: string
          subtotal: number
          total: number
          user_id: string
          vat?: number
        }
        Update: {
          contact?: Json
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          items?: Json
          payment_attempts?: number
          payment_error?: string | null
          payment_method?: string
          reference?: string
          shipping?: number
          shipping_address?: Json | null
          status?: string
          subtotal?: number
          total?: number
          user_id?: string
          vat?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string
          confirmed_by: string | null
          id: string
          method: string
          order_id: string
          provider_ref: string | null
        }
        Insert: {
          amount: number
          confirmed_at?: string
          confirmed_by?: string | null
          id?: string
          method: string
          order_id: string
          provider_ref?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string
          confirmed_by?: string | null
          id?: string
          method?: string
          order_id?: string
          provider_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_admins: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          kind: string
          order_id: string
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          kind: string
          order_id: string
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          kind?: string
          order_id?: string
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      review_appeals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          message: string
          review_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          message: string
          review_id: string
          status?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          message?: string
          review_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_appeals_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          resolved_at: string | null
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          resolved_at?: string | null
          review_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_revisions: {
        Row: {
          action: string
          author: string
          created_at: string
          id: string
          new_body: string | null
          new_rating: number | null
          old_body: string
          old_rating: number
          review_id: string
        }
        Insert: {
          action: string
          author: string
          created_at?: string
          id?: string
          new_body?: string | null
          new_rating?: number | null
          old_body: string
          old_rating: number
          review_id: string
        }
        Update: {
          action?: string
          author?: string
          created_at?: string
          id?: string
          new_body?: string | null
          new_rating?: number | null
          old_body?: string
          old_rating?: number
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_revisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_votes: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          body: string
          created_at: string
          edited_at: string | null
          helpful_count: number
          id: string
          listing_id: string
          owner_reply: string | null
          rating: number
          removed_reason: string | null
          replied_at: string | null
          status: string
          user_id: string
          verified: boolean
        }
        Insert: {
          author_name?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          helpful_count?: number
          id?: string
          listing_id: string
          owner_reply?: string | null
          rating: number
          removed_reason?: string | null
          replied_at?: string | null
          status?: string
          user_id?: string
          verified?: boolean
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          helpful_count?: number
          id?: string
          listing_id?: string
          owner_reply?: string | null
          rating?: number
          removed_reason?: string | null
          replied_at?: string | null
          status?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_search_matches: {
        Row: {
          created_at: string
          emailed_at: string | null
          frequency: string
          id: string
          listing_id: string
          saved_search_id: string
          title: string
          title_ar: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emailed_at?: string | null
          frequency: string
          id?: string
          listing_id: string
          saved_search_id: string
          title: string
          title_ar: string
          user_id: string
        }
        Update: {
          created_at?: string
          emailed_at?: string | null
          frequency?: string
          id?: string
          listing_id?: string
          saved_search_id?: string
          title?: string
          title_ar?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_search_matches_saved_search_id_fkey"
            columns: ["saved_search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          active: boolean
          categories: string[]
          created_at: string
          email_frequency: string
          id: string
          keywords: string
          max_price: number | null
          min_price: number | null
          name: string
          user_id: string
        }
        Insert: {
          active?: boolean
          categories?: string[]
          created_at?: string
          email_frequency?: string
          id?: string
          keywords?: string
          max_price?: number | null
          min_price?: number | null
          name?: string
          user_id?: string
        }
        Update: {
          active?: boolean
          categories?: string[]
          created_at?: string
          email_frequency?: string
          id?: string
          keywords?: string
          max_price?: number | null
          min_price?: number | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_scans: {
        Row: {
          code: string
          created_at: string
          id: string
          result: string
          scanned_by: string
          ticket_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          result: string
          scanned_by: string
          ticket_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          result?: string
          scanned_by?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_scans_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          booking_id: string
          code: string
          created_at: string
          id: string
          scanned_by: string | null
          status: string
          ticket_type: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          booking_id: string
          code?: string
          created_at?: string
          id?: string
          scanned_by?: string | null
          status?: string
          ticket_type: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string
          code?: string
          created_at?: string
          id?: string
          scanned_by?: string | null
          status?: string
          ticket_type?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_until: string | null
          created_at: string
          created_by: string
          id: string
          lifted_at: string | null
          reason: string
          user_id: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          created_by: string
          id?: string
          lifted_at?: string | null
          reason?: string
          user_id: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lifted_at?: string | null
          reason?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_auction_reserves: {
        Args: never
        Returns: {
          id: string
          reserve: number
        }[]
      }
      admin_block_user: {
        Args: { _reason: string; _uid: string; _until: string }
        Returns: string
      }
      admin_cancel_email: { Args: { _id: string }; Returns: undefined }
      admin_confirm_payment: {
        Args: { _order: string; _ref: string }
        Returns: undefined
      }
      admin_decide_appeal: {
        Args: { _appeal: string; _note: string; _overturn: boolean }
        Returns: undefined
      }
      admin_decide_refund: {
        Args: { _approve: boolean; _note: string; _request_id: string }
        Returns: undefined
      }
      admin_lift_block: {
        Args: { _reason: string; _uid: string }
        Returns: undefined
      }
      admin_mark_payment_failed: {
        Args: { _error: string; _order: string }
        Returns: undefined
      }
      admin_moderate_review: {
        Args: { _reason: string; _remove: boolean; _review: string }
        Returns: undefined
      }
      admin_retry_email: { Args: { _id: string }; Returns: undefined }
      admin_review_listing: {
        Args: { _approve: boolean; _id: string; _note: string }
        Returns: undefined
      }
      admin_set_order_status: {
        Args: { _note?: string; _order_id: string; _status: string }
        Returns: undefined
      }
      admin_set_reply_permission: {
        Args: { _allowed: boolean; _listing: string }
        Returns: undefined
      }
      agent_authorization_valid: {
        Args: { _kind: string; _listing: string }
        Returns: string
      }
      auction_reserve_met: { Args: { _auction_id: string }; Returns: boolean }
      award_auction: { Args: { _auction: string }; Returns: undefined }
      can_manage_auction: { Args: { _auction: string }; Returns: boolean }
      can_review: { Args: { _listing: string }; Returns: boolean }
      cancel_auction: {
        Args: { _auction: string; _reason: string }
        Returns: undefined
      }
      check_in_ticket: {
        Args: { _code: string }
        Returns: {
          exhibition_id: string
          result: string
          slot: string
          ticket_type: string
          used_at: string
          visit_date: string
        }[]
      }
      claim_pending_role: { Args: never; Returns: boolean }
      close_auction: { Args: { _auction: string }; Returns: undefined }
      close_expired_blocks: { Args: never; Returns: undefined }
      create_auction: {
        Args: {
          _ends: string
          _increment: number
          _listing: string
          _reserve: number
          _start: number
          _starts: string
          _visibility: string
        }
        Returns: string
      }
      delete_my_review: { Args: { _review: string }; Returns: undefined }
      edit_my_review: {
        Args: { _body: string; _rating: number; _review: string }
        Returns: undefined
      }
      has_purchased: {
        Args: { _listing: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_to_auction: {
        Args: { _auction: string; _email: string }
        Returns: undefined
      }
      is_blocked: { Args: { _uid: string }; Returns: boolean }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      issue_tickets: { Args: { _booking_id: string }; Returns: undefined }
      listing_draft_publish_issues: {
        Args: { d: Database["public"]["Tables"]["listing_drafts"]["Row"] }
        Returns: string[]
      }
      log_auction: {
        Args: {
          _amount: number
          _auction: string
          _details: Json
          _kind: string
        }
        Returns: undefined
      }
      pass_auction_to_next: { Args: { _auction: string }; Returns: undefined }
      process_due_auctions: { Args: never; Returns: number }
      push_notification: {
        Args: {
          _b: string
          _bar: string
          _kind: string
          _link: string
          _t: string
          _tar: string
          _uid: string
        }
        Returns: undefined
      }
      reply_to_review: {
        Args: { _reply: string; _review: string }
        Returns: undefined
      }
      respond_auction_invite: {
        Args: { _accept: boolean; _invite: string }
        Returns: undefined
      }
      retry_payment: { Args: { _order: string }; Returns: undefined }
      revoke_auction_invite: { Args: { _invite: string }; Returns: undefined }
      saved_search_token: { Args: { _uid: string }; Returns: string }
      send_saved_search_digests: {
        Args: { _frequency: string }
        Returns: number
      }
      settle_auction_if_due: { Args: { _auction: string }; Returns: string }
      slot_bookings: {
        Args: { _date: string; _exhibition_id: string }
        Returns: {
          booked: number
          slot: string
        }[]
      }
      unsubscribe_saved_search_emails: {
        Args: { _token: string }
        Returns: boolean
      }
      update_auction: {
        Args: {
          _auction: string
          _ends: string
          _increment: number
          _reserve: number
          _visibility: string
        }
        Returns: undefined
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
