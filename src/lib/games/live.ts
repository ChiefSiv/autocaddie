// Live standings — runs the hand-verified engines over the COMPLETE holes so far
// and produces a compact, render-ready summary per game for the hole-entry strip.
// Pure: takes derived net holes + game configs, returns display data.

import type { HoleScores, PlayerId, Side } from "./types";
import { computeSkins } from "./skins";
import { computeMatch } from "./match";
import { computeNassau } from "./nassau";

export interface LiveGameConfig {
  id: string;
  type: "skins" | "nassau" | "match";
  stakesEnabled: boolean;
  stake: number | null;
  carryover?: boolean;
  /** round_player ids for the two sides (match/nassau) */
  sides?: { a: string; b: string };
}

export type LiveStanding =
  | {
      id: string;
      type: "skins";
      /** money on the line for the NEXT hole = ante × (carry + 1); non-zero
       *  whenever stakes are on, grows on ties. 0 only when stakes off. */
      potValue: number;
      /** trailing carryover length (holes riding) */
      carry: number;
      /** roundPlayerId → skins (holes) won so far */
      skinsWon: Record<string, number>;
      /** roundPlayerId → signed money won/owed so far (the accrual) */
      nets: Record<string, number>;
    }
  | {
      id: string;
      type: "match";
      text: string; // "2 up" | "All Square" | "3 & 2" | "Halved"
      leaderId: string | null;
      thru: number;
      sides: { a: string; b: string };
    }
  | {
      id: string;
      type: "nassau";
      /** segment key → leader roundPlayerId | null (halved/AS) */
      segments: { key: string; leaderId: string | null; text: string }[];
      sides: { a: string; b: string };
    };

const side = (id: string): Side => ({ id, playerIds: [id] });

export function liveStandings(
  games: LiveGameConfig[],
  allPlayerIds: PlayerId[],
  completeHoleNets: HoleScores[],
  holesToPlay: 9 | 18,
): LiveStanding[] {
  const thru = completeHoleNets.length;
  return games.map((g): LiveStanding => {
    const stakes = { enabled: g.stakesEnabled, amount: g.stake ?? 0 };

    if (g.type === "skins") {
      const r = computeSkins({
        players: allPlayerIds,
        holes: completeHoleNets,
        stakes,
        carryover: g.carryover ?? true,
      });
      // Pot ON THE LINE for the next hole = one hole's ante plus any carried
      // holes. (r.unclaimed.pot alone is 0 whenever the last hole was won
      // outright — that's the $0-with-stakes-on bug.) `nets` carries the actual
      // money won so far so the strip shows accrual, not just who's ahead.
      const ante = stakes.enabled ? stakes.amount * allPlayerIds.length : 0;
      const carry = r.unclaimed.holes.length;
      return {
        id: g.id,
        type: "skins",
        potValue: ante * (carry + 1),
        carry,
        skinsWon: r.skinsWon,
        nets: Object.fromEntries(r.nets.map((n) => [n.playerId, n.amount])),
      };
    }

    if (g.type === "match") {
      const a = g.sides?.a ?? "";
      const b = g.sides?.b ?? "";
      const r = computeMatch({
        sideA: side(a),
        sideB: side(b),
        holes: completeHoleNets,
        stakes,
        totalHoles: holesToPlay, // remaining = scheduled − played (live)
      });
      return {
        id: g.id,
        type: "match",
        text: r.closedAtHole != null || thru >= holesToPlay ? r.result : r.running.at(-1)?.text ?? "All Square",
        leaderId: r.winnerId ?? r.running.at(-1)?.leaderId ?? null,
        thru,
        sides: { a, b },
      };
    }

    // nassau
    const a = g.sides?.a ?? "";
    const b = g.sides?.b ?? "";
    const r = computeNassau({
      sideA: side(a),
      sideB: side(b),
      holes: completeHoleNets,
      stakes,
      holesToPlay,
    });
    return {
      id: g.id,
      type: "nassau",
      sides: { a, b },
      segments: r.segments.map((s) => {
        const wonA = s.holesWon[a] ?? 0;
        const wonB = s.holesWon[b] ?? 0;
        const lead = Math.abs(wonA - wonB);
        const text = s.winnerId == null ? "AS" : `${lead} up`;
        return { key: s.key, leaderId: s.winnerId, text };
      }),
    };
  });
}
