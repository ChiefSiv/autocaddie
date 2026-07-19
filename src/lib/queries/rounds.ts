"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "./keys";
import { computeRoundHandicaps } from "@/lib/handicap/engine";
import type { AllowanceMode } from "@/lib/handicap/engine";
import type { Json } from "@/lib/supabase/database.types";

export interface SetupPlayer {
  playerId: string;
  handicapIndex: number | null;
}

export interface SetupGame {
  type: "skins" | "nassau" | "match";
  stakesEnabled: boolean;
  stake: number | null;
  grossOrNet: "gross" | "net";
  /** skins only */
  carryover?: boolean;
  /** match / nassau: the two sides, by player_id (1v1 in v1) */
  sides?: { a: string; b: string };
}

export interface CreateRoundInput {
  crewId: string | null;
  courseId: string;
  teeSetId: string;
  /** chosen tee's rating/slope/par — drives handicap computation */
  course: { slope: number; courseRating: number; par: number };
  holesToPlay: 9 | 18;
  whichNine: "front" | "back" | null;
  allowanceMode: AllowanceMode;
  date: string | null;
  players: SetupPlayer[];
  games: SetupGame[];
}

export interface CreatedRound {
  eventId: string;
  joinCode: string | null;
}

/**
 * Create a round: event → group → round_players (with engine-computed handicaps)
 * → games. Players reference durable Player ids (never names); game sides are
 * mapped from player_id to the created round_player id so the engines key off the
 * in-round identity. Sets status to 'active' (SETUP → PLAY).
 */
export interface FieldHandicap {
  roundPlayerId: string;
  handicapIndex: number | null;
}

/**
 * Edit handicaps for an in-progress (or settled) round. Because the round-level
 * "relative" allowance derives from the FIELD's lowest, editing one player can
 * shift everyone's allocation — so we recompute the WHOLE field and rewrite every
 * round_player's course/playing handicap. Downstream net/standings/settle recompute
 * automatically (they read round_players.playing_handicap via useEvent). Lineup
 * stays locked; only handicap values change. A settled round must be RE-settled
 * afterwards (the ledger upsert updates in place and resets paid on changed amounts).
 */
export function useUpdateRoundHandicaps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      eventId: string;
      field: FieldHandicap[];
      course: { slope: number; courseRating: number; par: number };
      allowanceMode: AllowanceMode;
    }): Promise<void> => {
      const supabase = createClient();
      const computed = computeRoundHandicaps(
        input.field.map((p) => ({
          id: p.roundPlayerId,
          handicapIndex: p.handicapIndex ?? 0,
        })),
        input.course,
        input.allowanceMode,
      );
      const byId = new Map(computed.map((c) => [c.id, c]));
      for (const p of input.field) {
        const c = byId.get(p.roundPlayerId)!;
        const { error } = await supabase
          .from("round_players")
          .update({
            handicap_index: p.handicapIndex,
            course_handicap: c.courseHandicap,
            playing_handicap: c.strokesGiven,
          })
          .eq("id", p.roundPlayerId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: (_r, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.event(input.eventId) });
    },
  });
}

export function useCreateRound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRoundInput): Promise<CreatedRound> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // 1. Event
      const { data: event, error: eventErr } = await supabase
        .from("events")
        .insert({
          host_user_id: user.id,
          crew_id: input.crewId,
          course_id: input.courseId,
          tee_set_id: input.teeSetId,
          date: input.date,
          status: "active",
          holes_to_play: input.holesToPlay,
          which_nine: input.whichNine,
          allowance_mode: input.allowanceMode,
        })
        .select("id, join_code")
        .single();
      if (eventErr || !event) {
        throw new Error(`Could not create round: ${eventErr?.message}`);
      }

      // 2. Group (single, solo scorekeeper)
      const { data: group, error: groupErr } = await supabase
        .from("groups")
        .insert({
          event_id: event.id,
          scoring_mode: "solo",
          scorekeeper_user_id: user.id,
        })
        .select("id")
        .single();
      if (groupErr || !group) {
        throw new Error(`Could not create group: ${groupErr?.message}`);
      }

      // 3. Compute handicaps for the field (round-level allowance mode applied).
      const computed = computeRoundHandicaps(
        input.players.map((p) => ({
          id: p.playerId,
          handicapIndex: p.handicapIndex ?? 0,
        })),
        input.course,
        input.allowanceMode,
      );
      const byId = new Map(computed.map((c) => [c.id, c]));

      // 4. round_players (snapshot index + computed handicaps).
      const rpRows = input.players.map((p) => {
        const c = byId.get(p.playerId)!;
        return {
          group_id: group.id,
          player_id: p.playerId,
          handicap_index: p.handicapIndex,
          course_handicap: c.courseHandicap,
          // playing_handicap holds the ALLOCATION handicap (after allowance mode)
          // — the number that drives stroke allocation for net scoring.
          playing_handicap: c.strokesGiven,
        };
      });
      const { data: roundPlayers, error: rpErr } = await supabase
        .from("round_players")
        .insert(rpRows)
        .select("id, player_id");
      if (rpErr || !roundPlayers) {
        throw new Error(`Could not add players: ${rpErr?.message}`);
      }
      const rpByPlayer = new Map(
        roundPlayers.map((rp) => [rp.player_id, rp.id]),
      );

      // 5. Games — map sides (player_id → round_player id) into config.
      const gameRows = input.games.map((g) => {
        const config: Record<string, Json> = {};
        if (g.type === "skins") config.carryover = g.carryover ?? true;
        if (g.sides) {
          config.sides = {
            a: rpByPlayer.get(g.sides.a) ?? null,
            b: rpByPlayer.get(g.sides.b) ?? null,
          };
        }
        return {
          event_id: event.id,
          group_id: group.id,
          scope: "group",
          type: g.type,
          config: config as Json,
          stakes_enabled: g.stakesEnabled,
          stake: g.stakesEnabled ? g.stake : null,
          gross_or_net: g.grossOrNet,
        };
      });
      if (gameRows.length) {
        const { error: gamesErr } = await supabase.from("games").insert(gameRows);
        if (gamesErr) throw new Error(`Could not add games: ${gamesErr.message}`);
      }

      return { eventId: event.id, joinCode: event.join_code };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recentEvents });
    },
  });
}
