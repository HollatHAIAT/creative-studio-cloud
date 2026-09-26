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
      auctions: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          increment: number
          listing_id: string
          reserve: number
          start_bid: number
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id: string
          increment?: number
          listing_id: string
          reserve: number
          start_bid: number
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          increment?: number
          listing_id?: string
          reserve?: number
          start_bid?: number
          starts_at?: string
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
      digital_assets: {
        Row: {
          code: string
          collection: string
          color: string
          created_at: string
          founded: number | null
          id: string
          is_official: boolean
          license: string
          license_ar: string
          name: string
          name_ar: string
          sort: number
        }
        Insert: {
          code: string
          collection?: string
          color?: string
          created_at?: string
          founded?: number | null
          id: string
          is_official?: boolean
          license?: string
          license_ar?: string
          name: string
          name_ar: string
          sort?: number
        }
        Update: {
          code?: string
          collection?: string
          color?: string
          created_at?: string
          founded?: number | null
          id?: string
          is_official?: boolean
          license?: string
          license_ar?: string
          name?: string
          name_ar?: string
          sort?: number
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
      notification_prefs: {
        Row: {
          bids: boolean
          orders: boolean
          tickets: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bids?: boolean
          orders?: boolean
          tickets?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bids?: boolean
          orders?: boolean
          tickets?: boolean
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
          items: Json
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
          items: Json
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
          items?: Json
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
      admin_decide_refund: {
        Args: { _approve: boolean; _note: string; _request_id: string }
        Returns: undefined
      }
      admin_set_order_status: {
        Args: { _note?: string; _order_id: string; _status: string }
        Returns: undefined
      }
      auction_reserve_met: { Args: { _auction_id: string }; Returns: boolean }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      issue_tickets: { Args: { _booking_id: string }; Returns: undefined }
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
      slot_bookings: {
        Args: { _date: string; _exhibition_id: string }
        Returns: {
          booked: number
          slot: string
        }[]
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
