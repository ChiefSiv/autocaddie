// Match Play engine (build prompt §6) — two sides, hole-by-hole, NET.
//
// Each hole: lower net wins it, equal halves it, pick-up (null) loses it (both
// picked up → halved). Track running status ("2 up", "All Square") and close the
// match when it is MATHEMATICALLY decided.
//
// Closeout is STRICT: a side closes the match only when its lead is GREATER THAN
// the holes remaining (lead > remaining). The boundary case lead == remaining is
// "dormie" and stays OPEN — e.g. 2 up with 2 to play is not over; it becomes
// "2 & 1" only after the next hole is halved (2 up, 1 to play → 2 > 1), or
// "3 & 1" if won. Getting > vs >= wrong here is the classic off-by-one.
//
// "X & Y" = X up with Y to play (X > Y). A match that reaches the last hole still
// level is "Halved" (All Square); stake = 0 to both. No concede in v1.

import type { HoleScores, PlayerNet, Side, Stakes } from "./types";
import { roundMoney, sideNetOnHole } from "./types";

export type HoleWinner = "A" | "B" | "halve";

/** Decide one hole between two sides. null (pick-up) loses; both null halves. */
export function compareHole(
  hole: HoleScores,
  sideA: Side,
  sideB: Side,
): HoleWinner {
  const a = sideNetOnHole(hole, sideA);
  const b = sideNetOnHole(hole, sideB);
  if (a == null && b == null) return "halve";
  if (a == null) return "B";
  if (b == null) return "A";
  if (a < b) return "A";
  if (b < a) return "B";
  return "halve";
}

export interface MatchRunningStatus {
  hole: number;
  /** side id of the leader, or null when all square */
  leaderId: string | null;
  /** holes up (>= 0) */
  lead: number;
  text: string; // "2 up" | "All Square"
}

export interface MatchResult {
  /** signed per-player net; sums to ~0; all 0 when stakes off */
  nets: PlayerNet[];
  /** winning side id, or null if halved */
  winnerId: string | null;
  result: string; // "3 & 2" | "2 up" | "1 up" | "Halved"
  /** hole number at which the match closed, or null if it went the distance */
  closedAtHole: number | null;
  running: MatchRunningStatus[];
  holesWon: Record<string, number>; // by side id
}

export interface MatchInput {
  sideA: Side;
  sideB: Side;
  holes: HoleScores[]; // the holes to score (final: all scheduled; live: those played)
  stakes: Stakes;
  /** Scheduled hole count for remaining/closeout math. Defaults to holes.length
   *  (final settlement). For LIVE standings pass the round's scheduled total so
   *  "remaining" = scheduled − played and a mid-round lead doesn't read as closed. */
  totalHoles?: number;
}

function statusText(leaderId: string | null, lead: number): string {
  return leaderId == null ? "All Square" : `${lead} up`;
}

/** Split a side's signed net evenly across its players. */
function splitSideNet(side: Side, amount: number): PlayerNet[] {
  const per = roundMoney(amount / side.playerIds.length);
  return side.playerIds.map((playerId) => ({ playerId, amount: per }));
}

export function computeMatch(input: MatchInput): MatchResult {
  const { sideA, sideB, holes } = input;
  const total = input.totalHoles ?? holes.length;
  const stake = input.stakes.enabled ? input.stakes.amount : 0;

  let wonA = 0;
  let wonB = 0;
  const running: MatchRunningStatus[] = [];
  let closedAtHole: number | null = null;

  for (let i = 0; i < holes.length; i++) {
    if (closedAtHole != null) break; // match already decided
    const hole = holes[i];
    const w = compareHole(hole, sideA, sideB);
    if (w === "A") wonA++;
    else if (w === "B") wonB++;

    const lead = Math.abs(wonA - wonB);
    const leaderId = wonA === wonB ? null : wonA > wonB ? sideA.id : sideB.id;
    running.push({
      hole: hole.hole,
      leaderId,
      lead,
      text: statusText(leaderId, lead),
    });

    const remaining = total - (i + 1);
    // STRICT early-close: dormie (lead == remaining) stays open; close only when
    // lead > remaining AND holes still remain. Being ahead on the FINAL hole
    // (remaining == 0) is "X up", not an early "X & 0" closeout.
    if (remaining > 0 && lead > remaining) {
      closedAtHole = hole.hole;
    }
  }

  const lead = Math.abs(wonA - wonB);
  const winnerSide = wonA === wonB ? null : wonA > wonB ? sideA : sideB;

  let result: string;
  if (winnerSide == null) {
    result = "Halved";
  } else if (closedAtHole != null) {
    // remaining holes at the moment of closeout
    const idx = holes.findIndex((h) => h.hole === closedAtHole);
    const remaining = total - (idx + 1);
    result = `${lead} & ${remaining}`;
  } else {
    result = `${lead} up`;
  }

  const nets: PlayerNet[] =
    winnerSide == null || stake === 0
      ? [...sideA.playerIds, ...sideB.playerIds].map((playerId) => ({
          playerId,
          amount: 0,
        }))
      : [
          ...splitSideNet(winnerSide, stake),
          ...splitSideNet(winnerSide.id === sideA.id ? sideB : sideA, -stake),
        ];

  return {
    nets,
    winnerId: winnerSide?.id ?? null,
    result,
    closedAtHole,
    running,
    holesWon: { [sideA.id]: wonA, [sideB.id]: wonB },
  };
}
