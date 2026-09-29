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
      audit_filter_presets: {
        Row: {
          actor: string
          created_at: string
          field: string
          from_date: string
          id: string
          name: string
          owner_email: string | null
          owner_id: string
          position: number
          shared: boolean
          to_date: string
          updated_at: string
        }
        Insert: {
          actor?: string
          created_at?: string
          field?: string
          from_date?: string
          id?: string
          name: string
          owner_email?: string | null
          owner_id?: string
          position?: number
          shared?: boolean
          to_date?: string
          updated_at?: string
        }
        Update: {
          actor?: string
          created_at?: string
          field?: string
          from_date?: string
          id?: string
          name?: string
          owner_email?: string | null
          owner_id?: string
          position?: number
          shared?: boolean
          to_date?: string
          updated_at?: string
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
      cms_entries: {
        Row: {
          created_at: string
          data: Json
          key: string
          kind: string
          published: boolean
          sort: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          key: string
          kind: string
          published?: boolean
          sort?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          key?: string
          kind?: string
          published?: boolean
          sort?: number
          updated_at?: string
          updated_by?: string | null
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
          ref_id: string | null
          sent_at: string | null
          status: string
          subject: string
          subject_ar: string
          to_email: string | null
          user_id: string | null
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
          ref_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          subject_ar: string
          to_email?: string | null
          user_id?: string | null
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
          ref_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          subject_ar?: string
          to_email?: string | null
          user_id?: string | null
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
      inventory_adjustments: {
        Row: {
          actor: string | null
          created_at: string
          from_stock: number | null
          id: string
          listing_id: string
          order_id: string | null
          reason: string
          source: string
          to_stock: number | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          from_stock?: number | null
          id?: string
          listing_id: string
          order_id?: string | null
          reason?: string
          source: string
          to_stock?: number | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          from_stock?: number | null
          id?: string
          listing_id?: string
          order_id?: string | null
          reason?: string
          source?: string
          to_stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_listing_id_fkey"
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
      listing_check_results: {
        Row: {
          author: string
          check_text: string
          created_at: string
          draft_id: string
          field: string
          id: string
          note: string
          result: string
        }
        Insert: {
          author?: string
          check_text: string
          created_at?: string
          draft_id: string
          field?: string
          id?: string
          note?: string
          result: string
        }
        Update: {
          author?: string
          check_text?: string
          created_at?: string
          draft_id?: string
          field?: string
          id?: string
          note?: string
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_check_results_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "listing_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_draft_versions: {
        Row: {
          alt_text: string
          alt_text_ar: string
          created_at: string
          description: string
          description_ar: string
          draft_id: string
          id: string
          image_path: string | null
          medium: string
          previous_review_note: string | null
          tags: string[]
          title: string
          title_ar: string
          user_id: string
          version: number
        }
        Insert: {
          alt_text: string
          alt_text_ar: string
          created_at?: string
          description: string
          description_ar: string
          draft_id: string
          id?: string
          image_path?: string | null
          medium?: string
          previous_review_note?: string | null
          tags?: string[]
          title: string
          title_ar: string
          user_id: string
          version: number
        }
        Update: {
          alt_text?: string
          alt_text_ar?: string
          created_at?: string
          description?: string
          description_ar?: string
          draft_id?: string
          id?: string
          image_path?: string | null
          medium?: string
          previous_review_note?: string | null
          tags?: string[]
          title?: string
          title_ar?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_draft_versions_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "listing_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_drafts: {
        Row: {
          alt_text: string
          alt_text_ar: string
          category: string | null
          co_owners: Json
          condition_grade: string | null
          condition_report: string
          consignment_terms: string
          created_at: string
          description: string
          description_ar: string
          era: string
          export_permit_ref: string
          gallery: Json
          heritage_type: string | null
          id: string
          image_path: string | null
          is_heritage: boolean
          medium: string
          org_id: string | null
          origin_region: string
          owner_approved_at: string | null
          owner_declared: boolean
          owner_email: string | null
          owner_name: string
          price: number | null
          provenance: Json
          published_at: string | null
          published_by: string | null
          published_listing_id: string | null
          review_mode: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seller_role: string
          status: string
          submitted_at: string | null
          tags: string[]
          title: string
          title_ar: string
          updated_at: string
          user_id: string
          workflow_id: string | null
          workflow_step: number
        }
        Insert: {
          alt_text?: string
          alt_text_ar?: string
          category?: string | null
          co_owners?: Json
          condition_grade?: string | null
          condition_report?: string
          consignment_terms?: string
          created_at?: string
          description?: string
          description_ar?: string
          era?: string
          export_permit_ref?: string
          gallery?: Json
          heritage_type?: string | null
          id?: string
          image_path?: string | null
          is_heritage?: boolean
          medium?: string
          org_id?: string | null
          origin_region?: string
          owner_approved_at?: string | null
          owner_declared?: boolean
          owner_email?: string | null
          owner_name?: string
          price?: number | null
          provenance?: Json
          published_at?: string | null
          published_by?: string | null
          published_listing_id?: string | null
          review_mode?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_role?: string
          status?: string
          submitted_at?: string | null
          tags?: string[]
          title?: string
          title_ar?: string
          updated_at?: string
          user_id?: string
          workflow_id?: string | null
          workflow_step?: number
        }
        Update: {
          alt_text?: string
          alt_text_ar?: string
          category?: string | null
          co_owners?: Json
          condition_grade?: string | null
          condition_report?: string
          consignment_terms?: string
          created_at?: string
          description?: string
          description_ar?: string
          era?: string
          export_permit_ref?: string
          gallery?: Json
          heritage_type?: string | null
          id?: string
          image_path?: string | null
          is_heritage?: boolean
          medium?: string
          org_id?: string | null
          origin_region?: string
          owner_approved_at?: string | null
          owner_declared?: boolean
          owner_email?: string | null
          owner_name?: string
          price?: number | null
          provenance?: Json
          published_at?: string | null
          published_by?: string | null
          published_listing_id?: string | null
          review_mode?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_role?: string
          status?: string
          submitted_at?: string | null
          tags?: string[]
          title?: string
          title_ar?: string
          updated_at?: string
          user_id?: string
          workflow_id?: string | null
          workflow_step?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_drafts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_drafts_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "org_review_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_review_comments: {
        Row: {
          author: string
          body: string
          created_at: string
          draft_id: string
          id: string
          recommendation: string | null
          score: number | null
          visibility: string
        }
        Insert: {
          author?: string
          body: string
          created_at?: string
          draft_id: string
          id?: string
          recommendation?: string | null
          score?: number | null
          visibility?: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          draft_id?: string
          id?: string
          recommendation?: string | null
          score?: number | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_review_comments_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "listing_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reviewers: {
        Row: {
          allow_download: boolean
          created_at: string
          draft_id: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          permission: string
          responded_at: string | null
          role: string
          starts_at: string
          status: string
          watermark: boolean
        }
        Insert: {
          allow_download?: boolean
          created_at?: string
          draft_id: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          permission?: string
          responded_at?: string | null
          role?: string
          starts_at?: string
          status?: string
          watermark?: boolean
        }
        Update: {
          allow_download?: boolean
          created_at?: string
          draft_id?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          permission?: string
          responded_at?: string | null
          role?: string
          starts_at?: string
          status?: string
          watermark?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "listing_reviewers_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "listing_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_version_comments: {
        Row: {
          author: string
          body: string
          created_at: string
          draft_id: string
          field: string
          id: string
          version: number
        }
        Insert: {
          author?: string
          body: string
          created_at?: string
          draft_id: string
          field: string
          id?: string
          version: number
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          draft_id?: string
          field?: string
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_version_comments_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "listing_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          category: string
          created_at: string
          creator_id: string
          id: string
          low_stock_at: number
          owner_can_reply: boolean
          owner_user_id: string | null
          price: number
          status: string
          stock: number | null
          title: string
          title_ar: string
        }
        Insert: {
          category: string
          created_at?: string
          creator_id: string
          id: string
          low_stock_at?: number
          owner_can_reply?: boolean
          owner_user_id?: string | null
          price?: number
          status?: string
          stock?: number | null
          title: string
          title_ar?: string
        }
        Update: {
          category?: string
          created_at?: string
          creator_id?: string
          id?: string
          low_stock_at?: number
          owner_can_reply?: boolean
          owner_user_id?: string | null
          price?: number
          status?: string
          stock?: number | null
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
      org_review_workflows: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_review_workflows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_workflow_decisions: {
        Row: {
          actor: string
          created_at: string
          decision: string
          draft_id: string
          id: string
          note: string
          step: number
          workflow_id: string
        }
        Insert: {
          actor?: string
          created_at?: string
          decision: string
          draft_id: string
          id?: string
          note?: string
          step: number
          workflow_id: string
        }
        Update: {
          actor?: string
          created_at?: string
          decision?: string
          draft_id?: string
          id?: string
          note?: string
          step?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_workflow_decisions_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "listing_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_workflow_decisions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "org_review_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          org_id: string
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city: string
          created_at: string
          created_by: string
          id: string
          kind: string
          name: string
          name_ar: string
          updated_at: string
        }
        Insert: {
          city?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          name: string
          name_ar?: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          name?: string
          name_ar?: string
          updated_at?: string
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
      platform_settings: {
        Row: {
          commercial_multiplier: number
          commercial_print_limit: number
          extended_multiplier: number
          id: number
          print_ship_max_days: number
          print_ship_min_days: number
          return_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commercial_multiplier?: number
          commercial_print_limit?: number
          extended_multiplier?: number
          id?: number
          print_ship_max_days?: number
          print_ship_min_days?: number
          return_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commercial_multiplier?: number
          commercial_print_limit?: number
          extended_multiplier?: number
          id?: number
          print_ship_max_days?: number
          print_ship_min_days?: number
          return_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_settings_audit: {
        Row: {
          actor: string | null
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string
          bio: string
          bio_ar: string
          city: string
          created_at: string
          display_name: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string
          bio?: string
          bio_ar?: string
          city?: string
          created_at?: string
          display_name?: string
          phone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string
          bio?: string
          bio_ar?: string
          city?: string
          created_at?: string
          display_name?: string
          phone?: string
          updated_at?: string
          user_id?: string
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
      review_policies: {
        Row: {
          allow_direct_publish: boolean
          id: number
          platform_review_categories: string[]
          platform_review_price_over: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_direct_publish?: boolean
          id?: number
          platform_review_categories?: string[]
          platform_review_price_over?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_direct_publish?: boolean
          id?: number
          platform_review_categories?: string[]
          platform_review_price_over?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      revision_checklist_items: {
        Row: {
          action: string
          action_ar: string
          author: string
          created_at: string
          done_at: string | null
          done_by: string | null
          draft_id: string
          field: string
          id: string
          priority: string
          seller_note: string | null
          why: string
          why_ar: string
        }
        Insert: {
          action: string
          action_ar?: string
          author?: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          draft_id: string
          field?: string
          id?: string
          priority?: string
          seller_note?: string | null
          why?: string
          why_ar?: string
        }
        Update: {
          action?: string
          action_ar?: string
          author?: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          draft_id?: string
          field?: string
          id?: string
          priority?: string
          seller_note?: string | null
          why?: string
          why_ar?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_checklist_items_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "listing_drafts"
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
      seller_payout_accounts: {
        Row: {
          account_holder: string
          bank_name: string
          created_at: string
          iban: string
          swift: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_holder: string
          bank_name: string
          created_at?: string
          iban: string
          swift?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_holder?: string
          bank_name?: string
          created_at?: string
          iban?: string
          swift?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shipping_addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          label: string
          line1: string
          line2: string
          phone: string
          postal_code: string
          region: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          label?: string
          line1: string
          line2?: string
          phone?: string
          postal_code?: string
          region?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string
          line1?: string
          line2?: string
          phone?: string
          postal_code?: string
          region?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          message: string
          order_ref: string | null
          reference: string
          replied_at: string | null
          replied_by: string | null
          reply: string | null
          status: string
          subject: string
          topic: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          message: string
          order_ref?: string | null
          reference?: string
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: string
          subject: string
          topic: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          message?: string
          order_ref?: string | null
          reference?: string
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: string
          subject?: string
          topic?: string
          updated_at?: string
          user_id?: string | null
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
      accept_org_invite: { Args: { _invite: string }; Returns: undefined }
      active_reviewer: {
        Args: { _draft: string; _uid: string }
        Returns: string
      }
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
      admin_publish_listing: {
        Args: { _category: string; _id: string; _price: number }
        Returns: string
      }
      admin_resend_reviewer_invite: {
        Args: { _invite: string }
        Returns: string
      }
      admin_retry_email: { Args: { _id: string }; Returns: undefined }
      admin_retry_reminder_email: { Args: { _id: string }; Returns: undefined }
      admin_review_listing: {
        Args: { _approve: boolean; _id: string; _note: string }
        Returns: undefined
      }
      admin_set_listing_guidance: {
        Args: { _actor: string; _id: string; _note: string }
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
      admin_set_role: {
        Args: {
          _grant: boolean
          _reason?: string
          _role: Database["public"]["Enums"]["app_role"]
          _uid: string
        }
        Returns: undefined
      }
      admin_settings_audit: {
        Args: { _limit?: number }
        Returns: {
          actor_email: string
          created_at: string
          field: string
          id: string
          new_value: string
          old_value: string
        }[]
      }
      admin_settings_audit_actors: {
        Args: never
        Returns: {
          actor_email: string
        }[]
      }
      admin_settings_audit_search: {
        Args: {
          _actor: string
          _field: string
          _from: string
          _limit: number
          _offset: number
          _to: string
        }
        Returns: {
          actor_email: string
          created_at: string
          field: string
          id: string
          new_value: string
          old_value: string
          total: number
        }[]
      }
      admin_unpublish_listing: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      agent_authorization_valid: {
        Args: { _kind: string; _listing: string }
        Returns: string
      }
      approve_listing_as_owner: { Args: { _draft: string }; Returns: undefined }
      auction_reserve_met: { Args: { _auction_id: string }; Returns: boolean }
      award_auction: { Args: { _auction: string }; Returns: undefined }
      caller_is_staff: { Args: never; Returns: boolean }
      can_manage_auction: { Args: { _auction: string }; Returns: boolean }
      can_review: { Args: { _listing: string }; Returns: boolean }
      can_view_private_comments: { Args: { _uid: string }; Returns: boolean }
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
      decide_workflow_step: {
        Args: { _approve: boolean; _draft: string; _note: string }
        Returns: number
      }
      delete_my_review: { Args: { _review: string }; Returns: undefined }
      draft_owner: { Args: { _draft: string }; Returns: string }
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
      my_org_role: { Args: { _org: string }; Returns: string }
      org_rank: { Args: { _role: string }; Returns: number }
      ownership_heritage_issues: {
        Args: { d: Database["public"]["Tables"]["listing_drafts"]["Row"] }
        Returns: string[]
      }
      pass_auction_to_next: { Args: { _auction: string }; Returns: undefined }
      platform_validation_issues: { Args: { _id: string }; Returns: string[] }
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
      queue_reviewer_invite_email: {
        Args: { _invite: string }
        Returns: string
      }
      reply_to_review: {
        Args: { _reply: string; _review: string }
        Returns: undefined
      }
      respond_auction_invite: {
        Args: { _accept: boolean; _invite: string }
        Returns: undefined
      }
      respond_review_invite: {
        Args: { _accept: boolean; _id: string }
        Returns: string
      }
      retry_payment: { Args: { _order: string }; Returns: undefined }
      revoke_auction_invite: { Args: { _invite: string }; Returns: undefined }
      saved_search_token: { Args: { _uid: string }; Returns: string }
      seller_publish_direct: { Args: { _id: string }; Returns: string }
      seller_sales: {
        Args: { _from: string; _to: string }
        Returns: {
          day: string
          listing_id: string
          revenue: number
          units: number
        }[]
      }
      send_reviewer_deadline_reminders: { Args: never; Returns: number }
      send_saved_search_digests: {
        Args: { _frequency: string }
        Returns: number
      }
      set_checklist_item_done: {
        Args: { _done: boolean; _item: string; _note?: string }
        Returns: undefined
      }
      set_listing_stock: {
        Args: {
          _listing: string
          _low?: number
          _reason?: string
          _stock: number
        }
        Returns: undefined
      }
      settle_auction_if_due: { Args: { _auction: string }; Returns: string }
      share_draft_with_org: {
        Args: { _draft: string; _org: string; _workflow: string }
        Returns: undefined
      }
      slot_bookings: {
        Args: { _date: string; _exhibition_id: string }
        Returns: {
          booked: number
          slot: string
        }[]
      }
      staff_reply_support: {
        Args: { _close: boolean; _reply: string; _ticket: string }
        Returns: undefined
      }
      submit_support_request: {
        Args: {
          _email: string
          _message: string
          _name: string
          _order_ref: string
          _subject: string
          _topic: string
        }
        Returns: string
      }
      track_support_request: {
        Args: { _email: string; _reference: string }
        Returns: {
          created_at: string
          reference: string
          replied_at: string
          reply: string
          status: string
          subject: string
          topic: string
          updated_at: string
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
