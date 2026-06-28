// Nassau engine (build prompt §6) — two sides, NET match play, three bets.
//
// 18-hole round: THREE independent bets — front 9, back 9, total 18 — each worth
// the stake. Each segment is its own match: the side that has won more holes over
// that segment wins its stake; level = halved (no money). Loser can pay up to 3×
// the stake (lose all three). No presses in v1.
//
// 9-hole round: COLLAPSES to a single 9-hole match — one bet, no front/back/18
// split. (Detected via holesToPlay === 9.)
//
// Pick-up (null) loses the hole (handled by compareHole). Net sums to ~0.

import type { HoleScores, PlayerNet, Side, Stakes } from "./types";
import { roundMoney } from "./types";
import { compareHole } from "./match";

export type NassauSegmentKey = "front" | "back" | "total" | "match";

export interface NassauSegment {
  key: NassauSegmentKey;
  holeNumbers: number[];
  holesWon: Record<string, number>; // by side id
  winnerId: string | null; // side id, or null if halved
}

export interface NassauResult {
  /** signed per-player net summed across segments; ~0; all 0 when stakes off */
  nets: PlayerNet[];
  segments: NassauSegment[];
  /** true for the 9-hole single-bet case */
  collapsed: boolean;
}

export interface NassauInput {
  sideA: Side;
  sideB: Side;
  holes: HoleScores[];
  stakes: Stakes;
  holesToPlay: 9 | 18;
}

/** Evaluate one segment (a subset of holes) as a match: more holes won wins. */
function evalSegment(
  key: NassauSegmentKey,
  segHoles: HoleScores[],
  sideA: Side,
  sideB: Side,
): NassauSegment {
  let wonA = 0;
  let wonB = 0;
  for (const h of segHoles) {
    const w = compareHole(h, sideA, sideB);
    if (w === "A") wonA++;
    else if (w === "B") wonB++;
  }
  const winnerId = wonA === wonB ? null : wonA > wonB ? sideA.id : sideB.id;
  return {
    key,
    holeNumbers: segHoles.map((h) => h.hole),
    holesWon: { [sideA.id]: wonA, [sideB.id]: wonB },
    winnerId,
  };
}

export function computeNassau(input: NassauInput): NassauResult {
  const { sideA, sideB, holes, holesToPlay } = input;
  const stake = input.stakes.enabled ? input.stakes.amount : 0;
  const collapsed = holesToPlay === 9;

  const segments: NassauSegment[] = collapsed
    ? [evalSegment("match", holes, sideA, sideB)]
    : [
        evalSegment(
          "front",
          holes.filter((h) => h.hole <= 9),
          sideA,
          sideB,
        ),
        evalSegment(
          "back",
          holes.filter((h) => h.hole >= 10),
          sideA,
          sideB,
        ),
        evalSegment("total", holes, sideA, sideB),
      ];

  // Accumulate per-player net across segments.
  const net: Record<string, number> = {};
  for (const pid of [...sideA.playerIds, ...sideB.playerIds]) net[pid] = 0;

  if (stake > 0) {
    for (const seg of segments) {
      if (seg.winnerId == null) continue;
      const winner = seg.winnerId === sideA.id ? sideA : sideB;
      const loser = seg.winnerId === sideA.id ? sideB : sideA;
      const perWin = stake / winner.playerIds.length;
      const perLose = stake / loser.playerIds.length;
      for (const pid of winner.playerIds) net[pid] += perWin;
      for (const pid of loser.playerIds) net[pid] -= perLose;
    }
  }

  const nets: PlayerNet[] = Object.entries(net).map(([playerId, amount]) => ({
    playerId,
    amount: roundMoney(amount),
  }));

  return { nets, segments, collapsed };
}
