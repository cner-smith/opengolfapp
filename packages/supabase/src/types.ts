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
      course_tees: {
        Row: {
          course_id: string
          course_rating: number | null
          created_at: string
          id: string
          par: number | null
          slope_rating: number | null
          tee_color: string
          tee_name: string | null
          total_yards: number | null
        }
        Insert: {
          course_id: string
          course_rating?: number | null
          created_at?: string
          id?: string
          par?: number | null
          slope_rating?: number | null
          tee_color: string
          tee_name?: string | null
          total_yards?: number | null
        }
        Update: {
          course_id?: string
          course_rating?: number | null
          created_at?: string
          id?: string
          par?: number | null
          slope_rating?: number | null
          tee_color?: string
          tee_name?: string | null
          total_yards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_tees_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          external_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          state: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          state?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_state: {
        Row: {
          error_message: string | null
          id: string
          items_processed: number
          last_crawled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          error_message?: string | null
          id: string
          items_processed?: number
          last_crawled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          error_message?: string | null
          id?: string
          items_processed?: number
          last_crawled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      drills: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration_min: number | null
          facility: string[] | null
          id: string
          instructions: string | null
          name: string
          skill_levels: string[] | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number | null
          facility?: string[] | null
          id?: string
          instructions?: string | null
          name: string
          skill_levels?: string[] | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number | null
          facility?: string[] | null
          id?: string
          instructions?: string | null
          name?: string
          skill_levels?: string[] | null
        }
        Relationships: []
      }
      hole_scores: {
        Row: {
          fairway_hit: boolean | null
          gir: boolean | null
          hole_id: string
          id: string
          pin_lat: number | null
          pin_lng: number | null
          putts: number | null
          round_id: string
          score: number
          sg_approach: number | null
          sg_around_green: number | null
          sg_off_tee: number | null
          sg_putting: number | null
        }
        Insert: {
          fairway_hit?: boolean | null
          gir?: boolean | null
          hole_id: string
          id?: string
          pin_lat?: number | null
          pin_lng?: number | null
          putts?: number | null
          round_id: string
          score: number
          sg_approach?: number | null
          sg_around_green?: number | null
          sg_off_tee?: number | null
          sg_putting?: number | null
        }
        Update: {
          fairway_hit?: boolean | null
          gir?: boolean | null
          hole_id?: string
          id?: string
          pin_lat?: number | null
          pin_lng?: number | null
          putts?: number | null
          round_id?: string
          score?: number
          sg_approach?: number | null
          sg_around_green?: number | null
          sg_off_tee?: number | null
          sg_putting?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hole_scores_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: false
            referencedRelation: "holes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hole_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      holes: {
        Row: {
          course_id: string
          id: string
          number: number
          par: number
          pin_lat: number | null
          pin_lng: number | null
          stroke_index: number | null
          tee_lat: number | null
          tee_lng: number | null
          yards: number | null
        }
        Insert: {
          course_id: string
          id?: string
          number: number
          par: number
          pin_lat?: number | null
          pin_lng?: number | null
          stroke_index?: number | null
          tee_lat?: number | null
          tee_lng?: number | null
          yards?: number | null
        }
        Update: {
          course_id?: string
          id?: string
          number?: number
          par?: number
          pin_lat?: number | null
          pin_lng?: number | null
          stroke_index?: number | null
          tee_lat?: number | null
          tee_lng?: number | null
          yards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "holes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_plans: {
        Row: {
          ai_insight: string | null
          based_on_rounds: number | null
          completed_drill_ids: string[]
          drills: Json | null
          focus_areas: Json | null
          generated_at: string
          id: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          ai_insight?: string | null
          based_on_rounds?: number | null
          completed_drill_ids?: string[]
          drills?: Json | null
          focus_areas?: Json | null
          generated_at?: string
          id?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          ai_insight?: string | null
          based_on_rounds?: number | null
          completed_drill_ids?: string[]
          drills?: Json | null
          focus_areas?: Json | null
          generated_at?: string
          id?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          distance_unit: string
          email_round_summaries_enabled: boolean
          facilities: string[] | null
          goal: string | null
          handicap_index: number | null
          id: string
          onboarding_completed: boolean
          play_frequency: string | null
          play_style: string | null
          skill_level: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          distance_unit?: string
          email_round_summaries_enabled?: boolean
          facilities?: string[] | null
          goal?: string | null
          handicap_index?: number | null
          id: string
          onboarding_completed?: boolean
          play_frequency?: string | null
          play_style?: string | null
          skill_level?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          distance_unit?: string
          email_round_summaries_enabled?: boolean
          facilities?: string[] | null
          goal?: string | null
          handicap_index?: number | null
          id?: string
          onboarding_completed?: boolean
          play_frequency?: string | null
          play_style?: string | null
          skill_level?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      rounds: {
        Row: {
          completed_at: string | null
          course_id: string
          course_tee_id: string | null
          created_at: string
          fairways_hit: number | null
          fairways_total: number | null
          gir: number | null
          id: string
          notes: string | null
          played_at: string
          score_differential: number | null
          sg_approach: number | null
          sg_around_green: number | null
          sg_off_tee: number | null
          sg_putting: number | null
          sg_total: number | null
          summary_email_sent_at: string | null
          tee_color: string | null
          total_putts: number | null
          total_score: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          course_tee_id?: string | null
          created_at?: string
          fairways_hit?: number | null
          fairways_total?: number | null
          gir?: number | null
          id?: string
          notes?: string | null
          played_at: string
          score_differential?: number | null
          sg_approach?: number | null
          sg_around_green?: number | null
          sg_off_tee?: number | null
          sg_putting?: number | null
          sg_total?: number | null
          summary_email_sent_at?: string | null
          tee_color?: string | null
          total_putts?: number | null
          total_score?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          course_tee_id?: string | null
          created_at?: string
          fairways_hit?: number | null
          fairways_total?: number | null
          gir?: number | null
          id?: string
          notes?: string | null
          played_at?: string
          score_differential?: number | null
          sg_approach?: number | null
          sg_around_green?: number | null
          sg_off_tee?: number | null
          sg_putting?: number | null
          sg_total?: number | null
          summary_email_sent_at?: string | null
          tee_color?: string | null
          total_putts?: number | null
          total_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_course_tee_id_fkey"
            columns: ["course_tee_id"]
            isOneToOne: false
            referencedRelation: "course_tees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shots: {
        Row: {
          aim_lat: number | null
          aim_lng: number | null
          aim_offset_yards: number | null
          break_direction: string | null
          break_direction_horizontal: string | null
          break_direction_vertical: string | null
          club: string | null
          created_at: string
          distance_to_target: number | null
          end_lat: number | null
          end_lng: number | null
          green_speed: string | null
          hole_score_id: string
          id: string
          lie_slope: string | null
          lie_slope_forward: string | null
          lie_slope_side: string | null
          lie_type: string | null
          notes: string | null
          ob: boolean
          penalty: boolean
          putt_direction_result: string | null
          putt_distance_ft: number | null
          putt_distance_result: string | null
          putt_result: string | null
          putt_slope_pct: number | null
          shot_number: number
          shot_result: string | null
          start_lat: number | null
          start_lng: number | null
          user_id: string
        }
        Insert: {
          aim_lat?: number | null
          aim_lng?: number | null
          aim_offset_yards?: number | null
          break_direction?: string | null
          break_direction_horizontal?: string | null
          break_direction_vertical?: string | null
          club?: string | null
          created_at?: string
          distance_to_target?: number | null
          end_lat?: number | null
          end_lng?: number | null
          green_speed?: string | null
          hole_score_id: string
          id?: string
          lie_slope?: string | null
          lie_slope_forward?: string | null
          lie_slope_side?: string | null
          lie_type?: string | null
          notes?: string | null
          ob?: boolean
          penalty?: boolean
          putt_direction_result?: string | null
          putt_distance_ft?: number | null
          putt_distance_result?: string | null
          putt_result?: string | null
          putt_slope_pct?: number | null
          shot_number: number
          shot_result?: string | null
          start_lat?: number | null
          start_lng?: number | null
          user_id: string
        }
        Update: {
          aim_lat?: number | null
          aim_lng?: number | null
          aim_offset_yards?: number | null
          break_direction?: string | null
          break_direction_horizontal?: string | null
          break_direction_vertical?: string | null
          club?: string | null
          created_at?: string
          distance_to_target?: number | null
          end_lat?: number | null
          end_lng?: number | null
          green_speed?: string | null
          hole_score_id?: string
          id?: string
          lie_slope?: string | null
          lie_slope_forward?: string | null
          lie_slope_side?: string | null
          lie_type?: string | null
          notes?: string | null
          ob?: boolean
          penalty?: boolean
          putt_direction_result?: string | null
          putt_distance_ft?: number | null
          putt_distance_result?: string | null
          putt_result?: string | null
          putt_slope_pct?: number | null
          shot_number?: number
          shot_result?: string | null
          start_lat?: number | null
          start_lng?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shots_hole_score_id_fkey"
            columns: ["hole_score_id"]
            isOneToOne: false
            referencedRelation: "hole_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_clubs: {
        Row: {
          club_type: string
          created_at: string
          id: string
          in_bag: boolean
          loft: number | null
          name: string
          sort_order: number
          typical_distance_yards: number | null
          user_id: string
        }
        Insert: {
          club_type: string
          created_at?: string
          id?: string
          in_bag?: boolean
          loft?: number | null
          name: string
          sort_order?: number
          typical_distance_yards?: number | null
          user_id: string
        }
        Update: {
          club_type?: string
          created_at?: string
          id?: string
          in_bag?: boolean
          loft?: number | null
          name?: string
          sort_order?: number
          typical_distance_yards?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_courses: {
        Args: { result_limit?: number; search_query: string }
        Returns: {
          city: string | null
          created_at: string
          created_by: string | null
          external_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          state: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "courses"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_club_order: {
        Args: { p_club_ids: string[]; p_orders: number[]; p_user_id: string }
        Returns: undefined
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
    Enums: {},
  },
} as const
