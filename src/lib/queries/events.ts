"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";
import { queryKeys } from "./keys";

export interface RoundPlayerView {
  id: string;
  playerId: string;
  displayName: string;
  handicapIndex: number | null;
  courseHandicap: number | null;
  playingHandicap: number | null;
}
export interface RoundGameView {
  id: string;
  type: string;
  stakesEnabled: boolean;
  stake: number | null;
  grossOrNet: string;
  config: Record<string, unknown>;
}
export interface RoundView {
  id: string;
  status: string;
  date: string | null;
  joinCode: string | null;
  holesToPlay: number;
  whichNine: string | null;
  allowanceMode: string;
  crewId: string | null;
  courseName: string | null;
  teeName: string | null;
  groupId: string | null;
  players: RoundPlayerView[];
  games: RoundGameView[];
}

/** Full round detail for the round-home / play surfaces. */
export function useEvent(eventId: string) {
  return useQuery({
    queryKey: queryKeys.event(eventId),
    enabled: !!eventId && hasSupabaseEnv(),
    queryFn: async (): Promise<RoundView | null> => {
      const supabase = createClient();
      const { data: e } = await supabase
        .from("events")
        .select(
          "id, status, date, join_code, holes_to_play, which_nine, allowance_mode, crew_id, course:courses(name), tee:tee_sets(name)",
        )
        .eq("id", eventId)
        .maybeSingle();
      if (!e) return null;

      const { data: group } = await supabase
        .from("groups")
        .select("id")
        .eq("event_id", eventId)
        .order("created_at")
        .limit(1)
        .maybeSingle();

      const players: RoundPlayerView[] = [];
      if (group) {
        const { data: rp } = await supabase
          .from("round_players")
          .select(
            "id, player_id, handicap_index, course_handicap, playing_handicap, player:players(display_name)",
          )
          .eq("group_id", group.id)
          .order("created_at");
        for (const r of rp ?? []) {
          players.push({
            id: r.id,
            playerId: r.player_id,
            displayName: r.player?.display_name ?? "Player",
            handicapIndex: r.handicap_index,
            courseHandicap: r.course_handicap,
            playingHandicap: r.playing_handicap,
          });
        }
      }

      const { data: gameRows } = await supabase
        .from("games")
        .select("id, type, stakes_enabled, stake, gross_or_net, config")
        .eq("event_id", eventId)
        .order("created_at");

      return {
        id: e.id,
        status: e.status,
        date: e.date,
        joinCode: e.join_code,
        holesToPlay: e.holes_to_play,
        whichNine: e.which_nine,
        allowanceMode: e.allowance_mode,
        crewId: e.crew_id,
        courseName: e.course?.name ?? null,
        teeName: e.tee?.name ?? null,
        groupId: group?.id ?? null,
        players,
        games: (gameRows ?? []).map((g) => ({
          id: g.id,
          type: g.type,
          stakesEnabled: g.stakes_enabled,
          stake: g.stake,
          grossOrNet: g.gross_or_net,
          config: (g.config ?? {}) as Record<string, unknown>,
        })),
      };
    },
    staleTime: 15_000,
  });
}

export interface RecentEvent {
  id: string;
  date: string | null;
  status: string;
  holesToPlay: number;
  courseName: string | null;
}

/** The user's most recent rounds (RLS already scopes to accessible events). */
export function useRecentEvents(limit = 5) {
  return useQuery({
    queryKey: [...queryKeys.recentEvents, limit],
    queryFn: async (): Promise<RecentEvent[]> => {
      if (!hasSupabaseEnv()) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("events")
        .select("id, date, status, holes_to_play, course:courses(name)")
        .order("date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []).map((e) => ({
        id: e.id,
        date: e.date,
        status: e.status,
        holesToPlay: e.holes_to_play,
        courseName: e.course?.name ?? null,
      }));
    },
    staleTime: 30_000,
  });
}
