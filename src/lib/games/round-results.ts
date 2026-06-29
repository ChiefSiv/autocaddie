// Final round results (build prompt §7) — runs the hand-verified engines over the
// round's COMPLETE holes, produces per-game detail + the combined settlement
// (one net per player, minimized payments). PURE; the same call serves a finished
// 18 and an end-early partial (it just uses whatever holes are complete).

import type { Side } from "./types";
import { deriveScoring, type GrossMap, type ScoringHole, type ScoringPlayer } from "./scoring";
import { computeSkins } from "./skins";
import { computeMatch } from "./match";
import { computeNassau } from "./nassau";
import {
  minimizePayments,
  sumPlayerNets,
  type GameNets,
  type Payment,
} from "./settlement";

export interface RRPlayer {
  roundPlayerId: string;
  /** durable player id (for the ledger) */
  playerId: string;
  displayName: string;
  playingHandicap: number;
}

export interface RRGame {
  id: string;
  type: "skins" | "nassau" | "match";
  stakesEnabled: boolean;
  stake: number | null;
  carryover?: boolean;
  /** round_player ids for the two sides (match/nassau) */
  sides?: { a: string; b: string };
}

export interface RoundResultsInput {
  players: RRPlayer[];
  games: RRGame[];
  holesInPlay: ScoringHole[];
  gross: GrossMap;
  holesToPlay: 9 | 18;
}

export interface GameDetail {
  gameId: string;
  type: "skins" | "nassau" | "match";
  stakesEnabled: boolean;
  stake: number | null;
  /** roundPlayerId → net for THIS game (0 when stakes off) */
  nets: Record<string, number>;
  // display extras
  skinsWon?: Record<string, number>;
  potTotal?: number;
  segments?: { key: string; leaderId: string | null; text: string }[];
  matchResult?: string;
  matchWinnerId?: string | null;
  sides?: { a: string; b: string };
}

export interface RoundResults {
  /** roundPlayerId → combined net across all games */
  perPlayerNet: Record<string, number>;
  /** minimized who-pays-whom (roundPlayerId) */
  payments: Payment[];
  games: GameDetail[];
  completeHoles: number[];
  thru: number;
}

const side = (id: string): Side => ({ id, playerIds: [id] });

export function computeRoundResults(input: RoundResultsInput): RoundResults {
  const players: ScoringPlayer[] = input.players.map((p) => ({
    roundPlayerId: p.roundPlayerId,
    playingHandicap: p.playingHandicap,
  }));
  const { completeHoleNets, completeHoles } = deriveScoring(
    players,
    input.holesInPlay,
    input.gross,
  );
  const allIds = input.players.map((p) => p.roundPlayerId);

  const details: GameDetail[] = input.games.map((g) => {
    const stakes = { enabled: g.stakesEnabled, amount: g.stake ?? 0 };
    if (g.type === "skins") {
      const r = computeSkins({
        players: allIds,
        holes: completeHoleNets,
        stakes,
        carryover: g.carryover ?? true,
      });
      const potTotal = r.holes.reduce(
        (s, h) => (h.result === "won" ? s + h.potAmount : s),
        0,
      );
      return {
        gameId: g.id,
        type: "skins",
        stakesEnabled: g.stakesEnabled,
        stake: g.stake,
        nets: Object.fromEntries(r.nets.map((n) => [n.playerId, n.amount])),
        skinsWon: r.skinsWon,
        potTotal,
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
        totalHoles: input.holesToPlay,
      });
      return {
        gameId: g.id,
        type: "match",
        stakesEnabled: g.stakesEnabled,
        stake: g.stake,
        nets: Object.fromEntries(r.nets.map((n) => [n.playerId, n.amount])),
        matchResult: r.result,
        matchWinnerId: r.winnerId,
        sides: { a, b },
      };
    }
    const a = g.sides?.a ?? "";
    const b = g.sides?.b ?? "";
    const r = computeNassau({
      sideA: side(a),
      sideB: side(b),
      holes: completeHoleNets,
      stakes,
      holesToPlay: input.holesToPlay,
    });
    return {
      gameId: g.id,
      type: "nassau",
      stakesEnabled: g.stakesEnabled,
      stake: g.stake,
      nets: Object.fromEntries(r.nets.map((n) => [n.playerId, n.amount])),
      segments: r.segments.map((s) => {
        const wonA = s.holesWon[a] ?? 0;
        const wonB = s.holesWon[b] ?? 0;
        const lead = Math.abs(wonA - wonB);
        return {
          key: s.key,
          leaderId: s.winnerId,
          text: s.winnerId == null ? "AS" : `${lead} up`,
        };
      }),
      sides: { a, b },
    };
  });

  // Combined settlement: sum every game's nets → one per player → minimize.
  const gameNets: GameNets[] = details.map((d) => ({
    gameId: d.gameId,
    type: d.type,
    nets: allIds.map((id) => ({ playerId: id, amount: d.nets[id] ?? 0 })),
  }));
  const perPlayerNetArr = sumPlayerNets(gameNets);
  const perPlayerNet = Object.fromEntries(
    perPlayerNetArr.map((n) => [n.playerId, n.amount]),
  );
  const payments = minimizePayments(perPlayerNetArr);

  return {
    perPlayerNet,
    payments,
    games: details,
    completeHoles,
    thru: completeHoles.length,
  };
}
