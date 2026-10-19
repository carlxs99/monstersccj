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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      battles: {
        Row: {
          battle: Json
          created_at: string
          guest_id: number | null
          guest_team: Json
          host_id: number
          host_team: Json
          id: string
          status: string
          turn_at: string
          updated_at: string
          wager: number
          winner_id: number | null
        }
        Insert: {
          battle?: Json
          created_at?: string
          guest_id?: number | null
          guest_team?: Json
          host_id: number
          host_team?: Json
          id?: string
          status?: string
          turn_at?: string
          updated_at?: string
          wager?: number
          winner_id?: number | null
        }
        Update: {
          battle?: Json
          created_at?: string
          guest_id?: number | null
          guest_team?: Json
          host_id?: number
          host_team?: Json
          id?: string
          status?: string
          turn_at?: string
          updated_at?: string
          wager?: number
          winner_id?: number | null
        }
        Relationships: []
      }
      broadcast_runs: {
        Row: {
          created_at: string
          day: string
          done: boolean
          lock_until: string | null
          sent_count: number
        }
        Insert: {
          created_at?: string
          day: string
          done?: boolean
          lock_until?: string | null
          sent_count?: number
        }
        Update: {
          created_at?: string
          day?: string
          done?: boolean
          lock_until?: string | null
          sent_count?: number
        }
        Relationships: []
      }
      broadcast_sends: {
        Row: {
          day: string
          sent_at: string
          telegram_id: number
        }
        Insert: {
          day: string
          sent_at?: string
          telegram_id: number
        }
        Update: {
          day?: string
          sent_at?: string
          telegram_id?: number
        }
        Relationships: []
      }
      channel_post_runs: {
        Row: {
          created_at: string
          message_id: number | null
          post_index: number
          sent_at: string
          week_key: string
        }
        Insert: {
          created_at?: string
          message_id?: number | null
          post_index: number
          sent_at?: string
          week_key: string
        }
        Update: {
          created_at?: string
          message_id?: number | null
          post_index?: number
          sent_at?: string
          week_key?: string
        }
        Relationships: []
      }
      custom_task_progress: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          started_at: string | null
          task_id: string
          telegram_id: number
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          started_at?: string | null
          task_id: string
          telegram_id: number
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          started_at?: string | null
          task_id?: string
          telegram_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_task_progress_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "custom_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_tasks: {
        Row: {
          active: boolean
          chat_ref: string | null
          created_at: string
          description: string
          id: string
          kind: string
          reward: number
          sort_order: number
          title: string
          updated_at: string
          url: string
          wait_seconds: number
        }
        Insert: {
          active?: boolean
          chat_ref?: string | null
          created_at?: string
          description?: string
          id?: string
          kind: string
          reward?: number
          sort_order?: number
          title: string
          updated_at?: string
          url: string
          wait_seconds?: number
        }
        Update: {
          active?: boolean
          chat_ref?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: string
          reward?: number
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string
          wait_seconds?: number
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          buyer_id: number | null
          card_id: string
          created_at: string
          fee: number
          id: string
          price: number
          seller_id: number
          seller_name: string | null
          sold_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id?: number | null
          card_id: string
          created_at?: string
          fee?: number
          id?: string
          price: number
          seller_id: number
          seller_name?: string | null
          sold_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: number | null
          card_id?: string
          created_at?: string
          fee?: number
          id?: string
          price?: number
          seller_id?: number
          seller_name?: string | null
          sold_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_trades: {
        Row: {
          created_at: string
          done_at: string | null
          id: string
          offer_card_id: string
          owner_id: number
          owner_name: string | null
          status: string
          taker_card_id: string | null
          taker_id: number | null
          updated_at: string
          want_card_id: string | null
          want_rarity: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          id?: string
          offer_card_id: string
          owner_id: number
          owner_name?: string | null
          status?: string
          taker_card_id?: string | null
          taker_id?: number | null
          updated_at?: string
          want_card_id?: string | null
          want_rarity: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          id?: string
          offer_card_id?: string
          owner_id?: number
          owner_name?: string | null
          status?: string
          taker_card_id?: string | null
          taker_id?: number | null
          updated_at?: string
          want_card_id?: string | null
          want_rarity?: string
        }
        Relationships: []
      }
      player_ips: {
        Row: {
          first_seen: string
          hits: number
          ip: string
          last_seen: string
          telegram_id: number
        }
        Insert: {
          first_seen?: string
          hits?: number
          ip: string
          last_seen?: string
          telegram_id: number
        }
        Update: {
          first_seen?: string
          hits?: number
          ip?: string
          last_seen?: string
          telegram_id?: number
        }
        Relationships: []
      }
      players: {
        Row: {
          ban_reason: string | null
          banned: boolean
          created_at: string
          first_name: string | null
          memo_tag: string | null
          photo_file_id: string | null
          photo_url: string | null
          referral_code: string
          referred_by: number | null
          state: Json
          telegram_id: number
          ton_address: string | null
          trusted: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          ban_reason?: string | null
          banned?: boolean
          created_at?: string
          first_name?: string | null
          memo_tag?: string | null
          photo_file_id?: string | null
          photo_url?: string | null
          referral_code: string
          referred_by?: number | null
          state?: Json
          telegram_id: number
          ton_address?: string | null
          trusted?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          ban_reason?: string | null
          banned?: boolean
          created_at?: string
          first_name?: string | null
          memo_tag?: string | null
          photo_file_id?: string | null
          photo_url?: string | null
          referral_code?: string
          referred_by?: number | null
          state?: Json
          telegram_id?: number
          ton_address?: string | null
          trusted?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      ton_deposits: {
        Row: {
          amount: number
          created_at: string
          from_address: string | null
          id: string
          lt: number | null
          memo: string | null
          telegram_id: number
          tx_hash: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_address?: string | null
          id?: string
          lt?: number | null
          memo?: string | null
          telegram_id: number
          tx_hash: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_address?: string | null
          id?: string
          lt?: number | null
          memo?: string | null
          telegram_id?: number
          tx_hash?: string
        }
        Relationships: []
      }
      ton_scan_state: {
        Row: {
          id: string
          last_lt: number
          updated_at: string
        }
        Insert: {
          id: string
          last_lt?: number
          updated_at?: string
        }
        Update: {
          id?: string
          last_lt?: number
          updated_at?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          error: string | null
          fee: number
          id: string
          net: number
          status: string
          telegram_id: number
          to_address: string
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          error?: string | null
          fee: number
          id?: string
          net: number
          status?: string
          telegram_id: number
          to_address: string
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          error?: string | null
          fee?: number
          id?: string
          net?: number
          status?: string
          telegram_id?: number
          to_address?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_player_progress: {
        Args: {
          p_expect?: Json
          p_gram_delta: number
          p_state: Json
          p_telegram_id: number
        }
        Returns: Json
      }
      schedule_daily_broadcast: {
        Args: { p_secret: string; p_url: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
