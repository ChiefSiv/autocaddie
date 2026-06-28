"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";
import { queryKeys } from "./keys";
import type { Tables } from "@/lib/supabase/database.types";

export type Crew = Tables<"crews">;
export type Player = Tables<"players">;

/** Crews the current user belongs to (RLS scopes to membership). */
export function useCrews() {
  return useQuery({
    queryKey: queryKeys.crews,
    queryFn: async (): Promise<Crew[]> => {
      if (!hasSupabaseEnv()) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("crews")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/**
 * Durable players for a crew, or the owner's crewless players when crewId is
 * null (the crewless one-off case). Never free-text — these are persistent
 * identities that accrue a record.
 */
export function useCrewPlayers(crewId: string | null) {
  return useQuery({
    queryKey: queryKeys.crewPlayers(crewId),
    queryFn: async (): Promise<Player[]> => {
      if (!hasSupabaseEnv()) return [];
      const supabase = createClient();
      let q = supabase.from("players").select("*");
      if (crewId) {
        q = q.eq("crew_id", crewId);
      } else {
        // crewless one-off: the owner's players not attached to any crew
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return [];
        q = q.is("crew_id", null).eq("owner_user_id", user.id);
      }
      const { data } = await q.order("created_at", { ascending: true });
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

/**
 * Season-to-date net per player for a crew — the single read-only figure §2.5
 * surfaces at setup and settle-up. `SUM(ledger_entries.amount)` grouped by
 * player (one number per player; no standings/history). Empty until rounds
 * settle (Phase 2 settle step writes the ledger).
 */
export function useSeasonToDate(crewId: string | null) {
  return useQuery({
    queryKey: queryKeys.seasonToDate(crewId),
    enabled: !!crewId && hasSupabaseEnv(),
    queryFn: async (): Promise<Record<string, number>> => {
      if (!crewId) return {};
      const supabase = createClient();
      const { data } = await supabase
        .from("ledger_entries")
        .select("player_id, amount")
        .eq("crew_id", crewId);
      const out: Record<string, number> = {};
      for (const row of data ?? []) {
        out[row.player_id] = (out[row.player_id] ?? 0) + Number(row.amount);
      }
      return out;
    },
    staleTime: 30_000,
  });
}

export function useCreateCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Crew> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("crews")
        .insert({ name: name.trim(), created_by: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crews });
    },
  });
}

/**
 * Quick-add a MANAGED player (no login; you score for them; can link to a real
 * account later) under a crew — or owner-scoped when crewId is null. This is the
 * replacement for per-round free-text guest names.
 */
export function useCreatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      crewId: string | null;
      displayName: string;
      handicapIndex: number | null;
    }): Promise<Player> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("players")
        .insert({
          crew_id: input.crewId,
          owner_user_id: user.id,
          display_name: input.displayName.trim(),
          handicap_index: input.handicapIndex,
          linked_user_id: null, // managed
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (player) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.crewPlayers(player.crew_id),
      });
    },
  });
}
