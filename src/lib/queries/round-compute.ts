"use client";

import type { RoundView } from "./events";
import type { LocalHoleScore } from "@/lib/db";
import { computeRoundResults, type RoundResults } from "@/lib/games/round-results";
import {
  holesInPlayNumbers,
  type GrossMap,
  type ScoringHole,
} from "@/lib/games/scoring";

/** Tri-state gross map keyed `${roundPlayerId}:${hole}` from the local store. */
export function buildGrossMap(scores: Record<string, LocalHoleScore>): GrossMap {
  const m: GrossMap = {};
  for (const [k, v] of Object.entries(scores)) m[k] = v.strokes;
  return m;
}

/** The round's holes-in-play with SI, ready for scoring. */
export function holesInPlayFromRound(round: RoundView): ScoringHole[] {
  const nums = holesInPlayNumbers(
    round.holesToPlay === 9 ? 9 : 18,
    (round.whichNine as "front" | "back" | null) ?? null,
  );
  const byNum = new Map(round.holes.map((h) => [h.number, h]));
  return nums.map((n) => {
    const h = byNum.get(n);
    return { number: n, par: h?.par ?? 4, strokeIndex: h?.strokeIndex ?? 0 };
  });
}

/** Full round results from the round + local scores; null if SI is incomplete. */
export function computeFromRound(
  round: RoundView,
  scores: Record<string, LocalHoleScore>,
): RoundResults | null {
  const holesInPlay = holesInPlayFromRound(round);
  if (!holesInPlay.length || holesInPlay.some((h) => h.strokeIndex <= 0)) {
    return null;
  }
  return computeRoundResults({
    players: round.players.map((p) => ({
      roundPlayerId: p.id,
      playerId: p.playerId,
      displayName: p.displayName,
      playingHandicap: p.playingHandicap ?? 0,
    })),
    games: round.games.map((g) => {
      const cfg = g.config as { sides?: { a?: string; b?: string }; carryover?: boolean };
      return {
        id: g.id,
        type: g.type as "skins" | "nassau" | "match",
        stakesEnabled: g.stakesEnabled,
        stake: g.stake,
        carryover: cfg?.carryover,
        sides: cfg?.sides
          ? { a: String(cfg.sides.a ?? ""), b: String(cfg.sides.b ?? "") }
          : undefined,
      };
    }),
    holesInPlay,
    gross: buildGrossMap(scores),
    holesToPlay: round.holesToPlay === 9 ? 9 : 18,
  });
}
