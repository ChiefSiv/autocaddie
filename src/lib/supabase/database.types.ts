// Database types for Autocaddie's Supabase schema.
//
// NOTE: Hand-authored from supabase/migrations/* because the Supabase CLI's
// `gen types` paths are unavailable in this environment (the management API is
// blocked by network SSL inspection; --local/--db-url require Docker, which
// isn't installed). Keep this in sync with the migrations by hand, or regenerate
// with `supabase gen types typescript --db-url <url>` once Docker is available.
// Mapping: uuid/text/date/timestamptz -> string, numeric/int/double -> number,
// jsonb -> Json, boolean -> boolean.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          email: string | null;
          handicap_index: number | null;
          ghin_number: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          email?: string | null;
          handicap_index?: number | null;
          ghin_number?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          email?: string | null;
          handicap_index?: number | null;
          ghin_number?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      crews: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      crew_members: {
        Row: {
          crew_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          crew_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          crew_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey";
            columns: ["crew_id"];
            referencedRelation: "crews";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      players: {
        Row: {
          id: string;
          crew_id: string | null;
          owner_user_id: string;
          display_name: string;
          handicap_index: number | null;
          linked_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          crew_id?: string | null;
          owner_user_id: string;
          display_name: string;
          handicap_index?: number | null;
          linked_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          crew_id?: string | null;
          owner_user_id?: string;
          display_name?: string;
          handicap_index?: number | null;
          linked_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_crew_id_fkey";
            columns: ["crew_id"];
            referencedRelation: "crews";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      round_templates: {
        Row: {
          id: string;
          owner_user_id: string;
          crew_id: string | null;
          name: string;
          default_group: Json | null;
          default_games: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          crew_id?: string | null;
          name: string;
          default_group?: Json | null;
          default_games?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          crew_id?: string | null;
          name?: string;
          default_group?: Json | null;
          default_games?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "round_templates_crew_id_fkey";
            columns: ["crew_id"];
            referencedRelation: "crews";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      courses: {
        Row: {
          id: string;
          provider: string;
          external_id: string | null;
          name: string;
          location: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          lat: number | null;
          lng: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider?: string;
          external_id?: string | null;
          name: string;
          location?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          external_id?: string | null;
          name?: string;
          location?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tee_sets: {
        Row: {
          id: string;
          course_id: string;
          name: string;
          gender: string | null;
          rating: number | null;
          slope: number | null;
          par: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          name: string;
          gender?: string | null;
          rating?: number | null;
          slope?: number | null;
          par?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          name?: string;
          gender?: string | null;
          rating?: number | null;
          slope?: number | null;
          par?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tee_sets_course_id_fkey";
            columns: ["course_id"];
            referencedRelation: "courses";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      holes: {
        Row: {
          id: string;
          tee_set_id: string;
          number: number;
          par: number;
          stroke_index: number | null;
          yardage: number | null;
        };
        Insert: {
          id?: string;
          tee_set_id: string;
          number: number;
          par: number;
          stroke_index?: number | null;
          yardage?: number | null;
        };
        Update: {
          id?: string;
          tee_set_id?: string;
          number?: number;
          par?: number;
          stroke_index?: number | null;
          yardage?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "holes_tee_set_id_fkey";
            columns: ["tee_set_id"];
            referencedRelation: "tee_sets";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      events: {
        Row: {
          id: string;
          host_user_id: string;
          crew_id: string | null;
          course_id: string | null;
          tee_set_id: string | null;
          date: string | null;
          join_code: string | null;
          status: string;
          holes_to_play: number;
          which_nine: string | null;
          starting_hole: number | null;
          allowance_mode: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_user_id: string;
          crew_id?: string | null;
          course_id?: string | null;
          tee_set_id?: string | null;
          date?: string | null;
          join_code?: string | null;
          status?: string;
          holes_to_play?: number;
          which_nine?: string | null;
          starting_hole?: number | null;
          allowance_mode?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_user_id?: string;
          crew_id?: string | null;
          course_id?: string | null;
          tee_set_id?: string | null;
          date?: string | null;
          join_code?: string | null;
          status?: string;
          holes_to_play?: number;
          which_nine?: string | null;
          starting_hole?: number | null;
          allowance_mode?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_crew_id_fkey";
            columns: ["crew_id"];
            referencedRelation: "crews";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "events_course_id_fkey";
            columns: ["course_id"];
            referencedRelation: "courses";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "events_tee_set_id_fkey";
            columns: ["tee_set_id"];
            referencedRelation: "tee_sets";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      event_members: {
        Row: {
          event_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey";
            columns: ["event_id"];
            referencedRelation: "events";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      groups: {
        Row: {
          id: string;
          event_id: string;
          name: string | null;
          scoring_mode: string;
          scorekeeper_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name?: string | null;
          scoring_mode?: string;
          scorekeeper_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string | null;
          scoring_mode?: string;
          scorekeeper_user_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_event_id_fkey";
            columns: ["event_id"];
            referencedRelation: "events";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      teams: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "groups";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      round_players: {
        Row: {
          id: string;
          group_id: string;
          player_id: string;
          handicap_index: number | null;
          course_handicap: number | null;
          playing_handicap: number | null;
          team_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          player_id: string;
          handicap_index?: number | null;
          course_handicap?: number | null;
          playing_handicap?: number | null;
          team_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          player_id?: string;
          handicap_index?: number | null;
          course_handicap?: number | null;
          playing_handicap?: number | null;
          team_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "round_players_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "groups";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "round_players_player_id_fkey";
            columns: ["player_id"];
            referencedRelation: "players";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "round_players_team_id_fkey";
            columns: ["team_id"];
            referencedRelation: "teams";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      games: {
        Row: {
          id: string;
          event_id: string;
          scope: string;
          group_id: string | null;
          type: string;
          config: Json;
          stakes_enabled: boolean;
          stake: number | null;
          allowance: number;
          gross_or_net: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          scope?: string;
          group_id?: string | null;
          type: string;
          config?: Json;
          stakes_enabled?: boolean;
          stake?: number | null;
          allowance?: number;
          gross_or_net?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          scope?: string;
          group_id?: string | null;
          type?: string;
          config?: Json;
          stakes_enabled?: boolean;
          stake?: number | null;
          allowance?: number;
          gross_or_net?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_event_id_fkey";
            columns: ["event_id"];
            referencedRelation: "events";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "games_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "groups";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      hole_scores: {
        Row: {
          id: string;
          group_id: string;
          round_player_id: string;
          hole_number: number;
          strokes: number | null;
          entered_by: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          round_player_id: string;
          hole_number: number;
          strokes?: number | null;
          entered_by?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          round_player_id?: string;
          hole_number?: number;
          strokes?: number | null;
          entered_by?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hole_scores_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "groups";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "hole_scores_round_player_id_fkey";
            columns: ["round_player_id"];
            referencedRelation: "round_players";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      game_results: {
        Row: {
          id: string;
          game_id: string;
          round_player_id: string | null;
          net_amount: number;
          detail: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          round_player_id?: string | null;
          net_amount?: number;
          detail?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          round_player_id?: string | null;
          net_amount?: number;
          detail?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_results_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "games";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "game_results_round_player_id_fkey";
            columns: ["round_player_id"];
            referencedRelation: "round_players";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      settlements: {
        Row: {
          id: string;
          event_id: string;
          combined: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          combined?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          combined?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_event_id_fkey";
            columns: ["event_id"];
            referencedRelation: "events";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
      ledger_entries: {
        Row: {
          id: string;
          crew_id: string;
          event_id: string | null;
          player_id: string;
          amount: number;
          paid: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          crew_id: string;
          event_id?: string | null;
          player_id: string;
          amount: number;
          paid?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          crew_id?: string;
          event_id?: string | null;
          player_id?: string;
          amount?: number;
          paid?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_crew_id_fkey";
            columns: ["crew_id"];
            referencedRelation: "crews";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "ledger_entries_player_id_fkey";
            columns: ["player_id"];
            referencedRelation: "players";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_crew_member: { Args: { p_crew_id: string }; Returns: boolean };
      is_event_member: { Args: { p_event_id: string }; Returns: boolean };
      can_access_group: { Args: { p_group_id: string }; Returns: boolean };
      join_event_by_code: { Args: { p_code: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// ── Convenience helpers (subset of what `supabase gen types` emits) ───────────
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
