// Live-scoring compute layer — bridges raw GROSS entry to net + the game engines.
//
// Tri-state per (player, hole):
//   • a number  → a real gross score (golf scores are ≥ 1; never 0)
//   • null      → PICK-UP / no score (engine-significant: can't win, loses hole)
//   • undefined → NOT ENTERED yet (excluded from standings entirely)
//
// The null-vs-0 distinction is load-bearing: pick-up MUST be null, because 0 is a
// real (absurd) score that would corrupt net math and let a "0" win every skin.
//
// Net is derived here (gross − strokes received), using each player's ALLOCATION
// handicap (round_players.playing_handicap, already allowance-adjusted at setup)
// spread across the played holes by stroke index. Only COMPLETE holes (every
// active player has an entry) feed the engines, so a half-entered hole never
// skews live standings.

import { allocateStrokes, netScore } from "@/lib/handicap/engine";
import type { HoleScores, PlayerId } from "./types";

export interface ScoringPlayer {
  /** the in-round identity the engines key off (round_player id) */
  roundPlayerId: string;
  /** allocation handicap after the round's allowance mode */
  playingHandicap: number;
}

export interface ScoringHole {
  number: number;
  par: number;
  /** non-null by the time scoring runs — the SI gate guarantees it */
  strokeIndex: number;
}

/** `${roundPlayerId}:${holeNumber}` → number | null | undefined (see tri-state). */
export type GrossMap = Record<string, number | null | undefined>;

export function scoreKey(roundPlayerId: string, holeNumber: number): string {
  return `${roundPlayerId}:${holeNumber}`;
}

/** Strokes received per hole for one player across the played holes. */
export function strokesReceived(
  player: ScoringPlayer,
  holes: ScoringHole[],
): Map<number, number> {
  return allocateStrokes(
    player.playingHandicap,
    holes.map((h) => ({ number: h.number, strokeIndex: h.strokeIndex })),
  );
}

export interface DerivedScoring {
  /** roundPlayerId → (hole → strokes received) */
  strokesByPlayer: Record<string, Map<number, number>>;
  /** net HoleScores for COMPLETE holes only (every player entered) */
  completeHoleNets: HoleScores[];
  /** hole numbers that are complete (drives "thru N") */
  completeHoles: number[];
}

/**
 * Derive strokes + net for the field. `gross` is the tri-state map. A hole is
 * COMPLETE when every player has an entry (a number or an explicit pick-up null);
 * incomplete holes are skipped so partial entry never skews standings.
 */
export function deriveScoring(
  players: ScoringPlayer[],
  holesInPlay: ScoringHole[],
  gross: GrossMap,
): DerivedScoring {
  const strokesByPlayer: Record<string, Map<number, number>> = {};
  for (const p of players) {
    strokesByPlayer[p.roundPlayerId] = strokesReceived(p, holesInPlay);
  }

  const completeHoleNets: HoleScores[] = [];
  const completeHoles: number[] = [];
  for (const h of holesInPlay) {
    const entered = players.every(
      (p) => gross[scoreKey(p.roundPlayerId, h.number)] !== undefined,
    );
    if (!entered) continue;
    completeHoles.push(h.number);
    const net: Record<PlayerId, number | null> = {};
    for (const p of players) {
      const g = gross[scoreKey(p.roundPlayerId, h.number)] ?? null; // null = pick-up
      const recv = strokesByPlayer[p.roundPlayerId].get(h.number) ?? 0;
      net[p.roundPlayerId] = netScore(g, recv); // null gross → null net
    }
    completeHoleNets.push({ hole: h.number, net });
  }
  return { strokesByPlayer, completeHoleNets, completeHoles };
}

/** Hole numbers in play for a round (front/back/full). */
export function holesInPlayNumbers(
  holesToPlay: 9 | 18,
  whichNine: "front" | "back" | null,
): number[] {
  if (holesToPlay === 18) return Array.from({ length: 18 }, (_, i) => i + 1);
  return whichNine === "back"
    ? Array.from({ length: 9 }, (_, i) => i + 10)
    : Array.from({ length: 9 }, (_, i) => i + 1);
}
