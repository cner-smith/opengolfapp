// Hand-authored to mirror supabase/migrations/0001_initial_schema.sql.
// Replace by running `pnpm --filter @oga/supabase gen-types` once the local
// Supabase stack is reachable. Keep this file in sync with the migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          handicap_index: number | null
          skill_level: 'beginner' | 'casual' | 'developing' | 'competitive' | null
          goal: 'break_100' | 'break_90' | 'break_80' | 'break_70s' | 'scratch' | null
          play_frequency: string | null
          facilities: string[] | null
          play_style: 'casual' | 'mixed' | 'competitive' | null
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          handicap_index?: number | null
          skill_level?: 'beginner' | 'casual' | 'developing' | 'competitive' | null
          goal?: 'break_100' | 'break_90' | 'break_80' | 'break_70s' | 'scratch' | null
          play_frequency?: string | null
          facilities?: string[] | null
          play_style?: 'casual' | 'mixed' | 'competitive' | null
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          handicap_index?: number | null
          skill_level?: 'beginner' | 'casual' | 'developing' | 'competitive' | null
          goal?: 'break_100' | 'break_90' | 'break_80' | 'break_70s' | 'scratch' | null
          play_frequency?: string | null
          facilities?: string[] | null
          play_style?: 'casual' | 'mixed' | 'competitive' | null
          created_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          id: string
          name: string
          location: string | null
          mapbox_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          location?: string | null
          mapbox_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          location?: string | null
          mapbox_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      holes: {
        Row: {
          id: string
          course_id: string
          number: number
          par: number
          yards: number | null
          stroke_index: number | null
          tee_lat: number | null
          tee_lng: number | null
          pin_lat: number | null
          pin_lng: number | null
        }
        Insert: {
          id?: string
          course_id: string
          number: number
          par: number
          yards?: number | null
          stroke_index?: number | null
          tee_lat?: number | null
          tee_lng?: number | null
          pin_lat?: number | null
          pin_lng?: number | null
        }
        Update: {
          id?: string
          course_id?: string
          number?: number
          par?: number
          yards?: number | null
          stroke_index?: number | null
          tee_lat?: number | null
          tee_lng?: number | null
          pin_lat?: number | null
          pin_lng?: number | null
        }
        Relationships: []
      }
      rounds: {
        Row: {
          id: string
          user_id: string
          course_id: string
          played_at: string
          tee_color: string | null
          total_score: number | null
          total_putts: number | null
          fairways_hit: number | null
          fairways_total: number | null
          gir: number | null
          sg_off_tee: number | null
          sg_approach: number | null
          sg_around_green: number | null
          sg_putting: number | null
          sg_total: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          played_at: string
          tee_color?: string | null
          total_score?: number | null
          total_putts?: number | null
          fairways_hit?: number | null
          fairways_total?: number | null
          gir?: number | null
          sg_off_tee?: number | null
          sg_approach?: number | null
          sg_around_green?: number | null
          sg_putting?: number | null
          sg_total?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          played_at?: string
          tee_color?: string | null
          total_score?: number | null
          total_putts?: number | null
          fairways_hit?: number | null
          fairways_total?: number | null
          gir?: number | null
          sg_off_tee?: number | null
          sg_approach?: number | null
          sg_around_green?: number | null
          sg_putting?: number | null
          sg_total?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      hole_scores: {
        Row: {
          id: string
          round_id: string
          hole_id: string
          score: number
          putts: number | null
          fairway_hit: boolean | null
          gir: boolean | null
          sg_off_tee: number | null
          sg_approach: number | null
          sg_around_green: number | null
          sg_putting: number | null
        }
        Insert: {
          id?: string
          round_id: string
          hole_id: string
          score: number
          putts?: number | null
          fairway_hit?: boolean | null
          gir?: boolean | null
          sg_off_tee?: number | null
          sg_approach?: number | null
          sg_around_green?: number | null
          sg_putting?: number | null
        }
        Update: {
          id?: string
          round_id?: string
          hole_id?: string
          score?: number
          putts?: number | null
          fairway_hit?: boolean | null
          gir?: boolean | null
          sg_off_tee?: number | null
          sg_approach?: number | null
          sg_around_green?: number | null
          sg_putting?: number | null
        }
        Relationships: []
      }
      shots: {
        Row: {
          id: string
          hole_score_id: string
          user_id: string
          shot_number: number
          start_lat: number | null
          start_lng: number | null
          end_lat: number | null
          end_lng: number | null
          aim_lat: number | null
          aim_lng: number | null
          distance_to_target: number | null
          club: string | null
          lie_type:
            | 'tee'
            | 'fairway'
            | 'rough'
            | 'sand'
            | 'fringe'
            | 'recovery'
            | 'green'
            | null
          lie_slope:
            | 'level'
            | 'uphill'
            | 'downhill'
            | 'ball_above'
            | 'ball_below'
            | null
          shot_result: string | null
          penalty: boolean
          ob: boolean
          aim_offset_yards: number | null
          break_direction: 'left' | 'right' | 'straight' | null
          putt_result: 'made' | 'short' | 'long' | 'missed_left' | 'missed_right' | null
          putt_distance_ft: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          hole_score_id: string
          user_id: string
          shot_number: number
          start_lat?: number | null
          start_lng?: number | null
          end_lat?: number | null
          end_lng?: number | null
          aim_lat?: number | null
          aim_lng?: number | null
          distance_to_target?: number | null
          club?: string | null
          lie_type?:
            | 'tee'
            | 'fairway'
            | 'rough'
            | 'sand'
            | 'fringe'
            | 'recovery'
            | 'green'
            | null
          lie_slope?:
            | 'level'
            | 'uphill'
            | 'downhill'
            | 'ball_above'
            | 'ball_below'
            | null
          shot_result?: string | null
          penalty?: boolean
          ob?: boolean
          aim_offset_yards?: number | null
          break_direction?: 'left' | 'right' | 'straight' | null
          putt_result?: 'made' | 'short' | 'long' | 'missed_left' | 'missed_right' | null
          putt_distance_ft?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          hole_score_id?: string
          user_id?: string
          shot_number?: number
          start_lat?: number | null
          start_lng?: number | null
          end_lat?: number | null
          end_lng?: number | null
          aim_lat?: number | null
          aim_lng?: number | null
          distance_to_target?: number | null
          club?: string | null
          lie_type?:
            | 'tee'
            | 'fairway'
            | 'rough'
            | 'sand'
            | 'fringe'
            | 'recovery'
            | 'green'
            | null
          lie_slope?:
            | 'level'
            | 'uphill'
            | 'downhill'
            | 'ball_above'
            | 'ball_below'
            | null
          shot_result?: string | null
          penalty?: boolean
          ob?: boolean
          aim_offset_yards?: number | null
          break_direction?: 'left' | 'right' | 'straight' | null
          putt_result?: 'made' | 'short' | 'long' | 'missed_left' | 'missed_right' | null
          putt_distance_ft?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      drills: {
        Row: {
          id: string
          name: string
          description: string | null
          duration_min: number | null
          category: 'off_tee' | 'approach' | 'around_green' | 'putting' | null
          facility: string[] | null
          skill_levels: string[] | null
          instructions: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          duration_min?: number | null
          category?: 'off_tee' | 'approach' | 'around_green' | 'putting' | null
          facility?: string[] | null
          skill_levels?: string[] | null
          instructions?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          duration_min?: number | null
          category?: 'off_tee' | 'approach' | 'around_green' | 'putting' | null
          facility?: string[] | null
          skill_levels?: string[] | null
          instructions?: string | null
          created_at?: string
        }
        Relationships: []
      }
      practice_plans: {
        Row: {
          id: string
          user_id: string
          generated_at: string
          valid_until: string | null
          based_on_rounds: number | null
          focus_areas: Json | null
          drills: Json | null
          ai_insight: string | null
          completed_drill_ids: string[]
        }
        Insert: {
          id?: string
          user_id: string
          generated_at?: string
          valid_until?: string | null
          based_on_rounds?: number | null
          focus_areas?: Json | null
          drills?: Json | null
          ai_insight?: string | null
          completed_drill_ids?: string[]
        }
        Update: {
          id?: string
          user_id?: string
          generated_at?: string
          valid_until?: string | null
          based_on_rounds?: number | null
          focus_areas?: Json | null
          drills?: Json | null
          ai_insight?: string | null
          completed_drill_ids?: string[]
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
