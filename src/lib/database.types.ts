export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      companies: {
        Row: {
          current_price: number
          event_id: string
          id: string
          last_change_pct: number
          logo_url: string | null
          name: string
          sector: string | null
          sort_order: number
          starting_price: number
          ticker: string
        }
        Insert: {
          current_price: number
          event_id: string
          id?: string
          last_change_pct?: number
          logo_url?: string | null
          name: string
          sector?: string | null
          sort_order?: number
          starting_price: number
          ticker: string
        }
        Update: {
          current_price?: number
          event_id?: string
          id?: string
          last_change_pct?: number
          logo_url?: string | null
          name?: string
          sector?: string | null
          sort_order?: number
          starting_price?: number
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          allow_short: boolean
          auto_apply_prices: boolean
          created_at: string
          created_by: string
          fee_pct: number
          id: string
          max_position_pct: number
          name: string
          round_duration_sec: number
          starting_capital: number
          status: Database["public"]["Enums"]["event_status"]
          total_rounds: number
        }
        Insert: {
          allow_short?: boolean
          auto_apply_prices?: boolean
          created_at?: string
          created_by: string
          fee_pct?: number
          id?: string
          max_position_pct?: number
          name: string
          round_duration_sec?: number
          starting_capital?: number
          status?: Database["public"]["Enums"]["event_status"]
          total_rounds?: number
        }
        Update: {
          allow_short?: boolean
          auto_apply_prices?: boolean
          created_at?: string
          created_by?: string
          fee_pct?: number
          id?: string
          max_position_pct?: number
          name?: string
          round_duration_sec?: number
          starting_capital?: number
          status?: Database["public"]["Enums"]["event_status"]
          total_rounds?: number
        }
        Relationships: []
      }
      holdings: {
        Row: {
          company_id: string
          shares: number
          team_id: string
        }
        Insert: {
          company_id: string
          shares?: number
          team_id: string
        }
        Update: {
          company_id?: string
          shares?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "holdings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          after_shock: boolean | null
          cash_before: number | null
          company_id: string
          created_at: string
          fee: number
          id: number
          portfolio_before: number | null
          position_pct_after: number | null
          price: number
          round_id: string
          seconds_into_window: number | null
          shares: number
          side: Database["public"]["Enums"]["order_side"]
          team_id: string
          value: number
        }
        Insert: {
          after_shock?: boolean | null
          cash_before?: number | null
          company_id: string
          created_at?: string
          fee?: number
          id?: number
          portfolio_before?: number | null
          position_pct_after?: number | null
          price: number
          round_id: string
          seconds_into_window?: number | null
          shares: number
          side: Database["public"]["Enums"]["order_side"]
          team_id: string
          value: number
        }
        Update: {
          after_shock?: boolean | null
          cash_before?: number | null
          company_id?: string
          created_at?: string
          fee?: number
          id?: number
          portfolio_before?: number | null
          position_pct_after?: number | null
          price?: number
          round_id?: string
          seconds_into_window?: number | null
          shares?: number
          side?: Database["public"]["Enums"]["order_side"]
          team_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "orders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          cash: number
          created_at: string
          holdings_value: number
          round_id: string
          team_id: string
          total_value: number
        }
        Insert: {
          cash: number
          created_at?: string
          holdings_value: number
          round_id: string
          team_id: string
          total_value: number
        }
        Update: {
          cash?: number
          created_at?: string
          holdings_value?: number
          round_id?: string
          team_id?: string
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "portfolio_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      price_updates: {
        Row: {
          company_id: string
          created_at: string
          id: number
          new_price: number
          old_price: number
          round_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: number
          new_price: number
          old_price: number
          round_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: number
          new_price?: number
          old_price?: number
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_updates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_updates_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_notes: {
        Row: {
          round_id: string
          shock_detail: string | null
          shock_extend_sec: number
          shock_headline: string | null
          shock_moves: string | null
          suggested_moves: string | null
          updated_at: string
        }
        Insert: {
          round_id: string
          shock_detail?: string | null
          shock_extend_sec?: number
          shock_headline?: string | null
          shock_moves?: string | null
          suggested_moves?: string | null
          updated_at?: string
        }
        Update: {
          round_id?: string
          shock_detail?: string | null
          shock_extend_sec?: number
          shock_headline?: string | null
          shock_moves?: string | null
          suggested_moves?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_notes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          applied_at: string | null
          event_id: string
          headline: string | null
          headline_detail: string | null
          id: string
          round_no: number
          shock_at: string | null
          shock_detail: string | null
          shock_extend_sec: number | null
          shock_headline: string | null
          state: Database["public"]["Enums"]["round_state"]
          window_closes_at: string | null
          window_opens_at: string | null
        }
        Insert: {
          applied_at?: string | null
          event_id: string
          headline?: string | null
          headline_detail?: string | null
          id?: string
          round_no: number
          shock_at?: string | null
          shock_detail?: string | null
          shock_extend_sec?: number | null
          shock_headline?: string | null
          state?: Database["public"]["Enums"]["round_state"]
          window_closes_at?: string | null
          window_opens_at?: string | null
        }
        Update: {
          applied_at?: string | null
          event_id?: string
          headline?: string | null
          headline_detail?: string | null
          id?: string
          round_no?: number
          shock_at?: string | null
          shock_detail?: string | null
          shock_extend_sec?: number | null
          shock_headline?: string | null
          state?: Database["public"]["Enums"]["round_state"]
          window_closes_at?: string | null
          window_opens_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      score_adjustments: {
        Row: {
          delta: number
          event_id: string
          note: string | null
          section: string
          team_id: string
          updated_at: string
        }
        Insert: {
          delta?: number
          event_id: string
          note?: string | null
          section: string
          team_id: string
          updated_at?: string
        }
        Update: {
          delta?: number
          event_id?: string
          note?: string | null
          section?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_adjustments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_adjustments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "score_adjustments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      shock_price_changes: {
        Row: {
          company_id: string
          created_at: string
          id: number
          new_price: number
          old_price: number
          round_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: number
          new_price: number
          old_price: number
          round_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: number
          new_price?: number
          old_price?: number
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shock_price_changes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shock_price_changes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      team_activity: {
        Row: {
          company_id: string | null
          created_at: string
          detail: Json
          event_id: string
          id: number
          kind: string
          round_id: string | null
          team_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          detail?: Json
          event_id: string
          id?: number
          kind: string
          round_id?: string | null
          team_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          detail?: Json
          event_id?: string
          id?: number
          kind?: string
          round_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_activity_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_activity_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_activity_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_activity_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          cash: number
          college: string | null
          created_at: string
          event_id: string
          id: string
          join_code: string
          joined_at: string | null
          member_names: string[]
          name: string | null
          user_id: string | null
        }
        Insert: {
          cash?: number
          college?: string | null
          created_at?: string
          event_id: string
          id?: string
          join_code?: string
          joined_at?: string | null
          member_names?: string[]
          name?: string | null
          user_id?: string | null
        }
        Update: {
          cash?: number
          college?: string | null
          created_at?: string
          event_id?: string
          id?: string
          join_code?: string
          joined_at?: string | null
          member_names?: string[]
          name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      equity_curve_view: {
        Row: {
          event_id: string | null
          round_no: number | null
          team_id: string | null
          total_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "portfolio_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_view: {
        Row: {
          change_this_round: number | null
          change_this_round_pct: number | null
          college: string | null
          event_id: string | null
          joined: boolean | null
          name: string | null
          pnl: number | null
          rank: number | null
          team_id: string | null
          total_value: number | null
          trade_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _admin_round: {
        Args: { p_round_id: string }
        Returns: {
          applied_at: string | null
          event_id: string
          headline: string | null
          headline_detail: string | null
          id: string
          round_no: number
          shock_at: string | null
          shock_detail: string | null
          shock_extend_sec: number | null
          shock_headline: string | null
          state: Database["public"]["Enums"]["round_state"]
          window_closes_at: string | null
          window_opens_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _apply_round_prices_core: {
        Args: { p_prices: Json; p_round_id: string }
        Returns: {
          applied_at: string | null
          event_id: string
          headline: string | null
          headline_detail: string | null
          id: string
          round_no: number
          shock_at: string | null
          shock_detail: string | null
          shock_extend_sec: number | null
          shock_headline: string | null
          state: Database["public"]["Enums"]["round_state"]
          window_closes_at: string | null
          window_opens_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_equity_curve: {
        Args: { p_event_id: string }
        Returns: {
          event_id: string | null
          round_no: number | null
          team_id: string | null
          total_value: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "equity_curve_view"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_leaderboard: {
        Args: { p_event_id: string }
        Returns: {
          change_this_round: number | null
          change_this_round_pct: number | null
          college: string | null
          event_id: string | null
          joined: boolean | null
          name: string | null
          pnl: number | null
          rank: number | null
          team_id: string | null
          total_value: number | null
          trade_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "leaderboard_view"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      apply_round_prices: {
        Args: { p_prices: Json; p_round_id: string }
        Returns: {
          applied_at: string | null
          event_id: string
          headline: string | null
          headline_detail: string | null
          id: string
          round_no: number
          shock_at: string | null
          shock_detail: string | null
          shock_extend_sec: number | null
          shock_headline: string | null
          state: Database["public"]["Enums"]["round_state"]
          window_closes_at: string | null
          window_opens_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auto_finish_round: { Args: { p_round_id: string }; Returns: undefined }
      claim_team: {
        Args: { p_join_code: string; p_team_name?: string }
        Returns: {
          cash: number
          college: string | null
          created_at: string
          event_id: string
          id: string
          join_code: string
          joined_at: string | null
          member_names: string[]
          name: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_expired_windows: { Args: never; Returns: number }
      close_window: {
        Args: { p_round_id: string }
        Returns: {
          applied_at: string | null
          event_id: string
          headline: string | null
          headline_detail: string | null
          id: string
          round_no: number
          shock_at: string | null
          shock_detail: string | null
          shock_extend_sec: number | null
          shock_headline: string | null
          state: Database["public"]["Enums"]["round_state"]
          window_closes_at: string | null
          window_opens_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      execute_order: {
        Args: {
          p_company_id: string
          p_shares: number
          p_side: Database["public"]["Enums"]["order_side"]
        }
        Returns: {
          after_shock: boolean | null
          cash_before: number | null
          company_id: string
          created_at: string
          fee: number
          id: number
          portfolio_before: number | null
          position_pct_after: number | null
          price: number
          round_id: string
          seconds_into_window: number | null
          shares: number
          side: Database["public"]["Enums"]["order_side"]
          team_id: string
          value: number
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fire_act_of_god: {
        Args: {
          p_detail: string
          p_extend_sec: number
          p_headline: string
          p_prices: Json
          p_round_id: string
        }
        Returns: {
          applied_at: string | null
          event_id: string
          headline: string | null
          headline_detail: string | null
          id: string
          round_no: number
          shock_at: string | null
          shock_detail: string | null
          shock_extend_sec: number | null
          shock_headline: string | null
          state: Database["public"]["Enums"]["round_state"]
          window_closes_at: string | null
          window_opens_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_event_admin: { Args: { p_event_id: string }; Returns: boolean }
      log_activity: {
        Args: { p_company_id?: string; p_detail?: Json; p_kind: string }
        Returns: undefined
      }
      market_opened: { Args: { p_event_id: string }; Returns: boolean }
      my_team_id: { Args: never; Returns: string }
      open_window: {
        Args: { p_round_id: string }
        Returns: {
          applied_at: string | null
          event_id: string
          headline: string | null
          headline_detail: string | null
          id: string
          round_no: number
          shock_at: string | null
          shock_detail: string | null
          shock_extend_sec: number | null
          shock_headline: string | null
          state: Database["public"]["Enums"]["round_state"]
          window_closes_at: string | null
          window_opens_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      planned_prices: { Args: { p_round_id: string }; Returns: Json }
      release_headline: {
        Args: { p_round_id: string }
        Returns: {
          applied_at: string | null
          event_id: string
          headline: string | null
          headline_detail: string | null
          id: string
          round_no: number
          shock_at: string | null
          shock_detail: string | null
          shock_extend_sec: number | null
          shock_headline: string | null
          state: Database["public"]["Enums"]["round_state"]
          window_closes_at: string | null
          window_opens_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_team_login: {
        Args: { p_team_id: string }
        Returns: {
          cash: number
          college: string | null
          created_at: string
          event_id: string
          id: string
          join_code: string
          joined_at: string | null
          member_names: string[]
          name: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      server_time: { Args: never; Returns: string }
      team_total_value: { Args: { p_team_id: string }; Returns: number }
      undo_last_price_application: {
        Args: { p_round_id: string }
        Returns: {
          applied_at: string | null
          event_id: string
          headline: string | null
          headline_detail: string | null
          id: string
          round_no: number
          shock_at: string | null
          shock_detail: string | null
          shock_extend_sec: number | null
          shock_headline: string | null
          state: Database["public"]["Enums"]["round_state"]
          window_closes_at: string | null
          window_opens_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      event_status: "draft" | "live" | "finished"
      order_side: "buy" | "sell"
      round_state:
        | "pending"
        | "headline_released"
        | "window_open"
        | "window_closed"
        | "prices_applied"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      event_status: ["draft", "live", "finished"],
      order_side: ["buy", "sell"],
      round_state: [
        "pending",
        "headline_released",
        "window_open",
        "window_closed",
        "prices_applied",
      ],
    },
  },
} as const

