// Skins engine (build prompt §6) — whole group, one skin per hole.
//
// Each hole every player antes the per-hole stake into the pot. Lowest net wins
// the hole's pot OUTRIGHT; a tie CARRIES the pot to the next hole (growing it),
// and the carried pot is won by the next outright winner. Pick-up (null) can't
// win. Carryovers are on by default.
//
// Net math (sums to ~0): for each AWARDED pot covering k holes, total ante is
// stake × nPlayers × k and the winner collects exactly that — so the awarded
// pot nets to zero across the field. The KEY rule for the terminal case:
//
//   Terminal unclaimed pot (round ends mid-carry — the last hole(s) tied and the
//   carried pot is never won): the pot is VOIDED and its antes REFUNDED. We do
//   this by only charging antes for holes that belong to an AWARDED pot; holes
//   feeding a never-won pot cost nobody anything. Result: Σ net = 0 even when the
//   round ends mid-carry. (Voiding-without-refund would leave the field down the
//   dead pot; refunding is the only choice that keeps the game zero-sum.)
//
// With carryover OFF, a tie voids just that single hole (its ante refunded);
// there is no growing pot.

import type { HoleScores, PlayerId, PlayerNet, Stakes } from "./types";
import { roundMoney } from "./types";

export type SkinHoleOutcome =
  | {
      hole: number;
      result: "won";
      winnerId: PlayerId;
      /** number of holes this awarded pot covered (1 + any carried) */
      potHoles: number;
      /** money in the awarded pot (0 when stakes off) */
      potAmount: number;
    }
  | { hole: number; result: "carry" }
  | { hole: number; result: "void" }; // carryover off: tie voids the hole

export interface SkinsResult {
  /** signed per-player net; sums to ~0; all 0 when stakes off */
  nets: PlayerNet[];
  /** per-hole outcome, in hole order */
  holes: SkinHoleOutcome[];
  /** holes-worth of skins each player won (a 2-hole carried pot counts as 2) */
  skinsWon: Record<PlayerId, number>;
  /** terminal carried pot that was never won → voided & refunded */
  unclaimed: { holes: number[]; pot: number };
}

export interface SkinsInput {
  players: PlayerId[];
  holes: HoleScores[];
  stakes: Stakes;
  /** carry a tied pot to the next hole (default true) */
  carryover?: boolean;
}

/** Players with the single lowest non-null net on a hole. Empty if all null. */
function holeWinners(hole: HoleScores, players: PlayerId[]): PlayerId[] {
  let low: number | null = null;
  for (const p of players) {
    const v = hole.net[p];
    if (v == null) continue;
    if (low == null || v < low) low = v;
  }
  if (low == null) return [];
  return players.filter((p) => hole.net[p] === low);
}

export function computeSkins(input: SkinsInput): SkinsResult {
  const { players, holes } = input;
  const carryover = input.carryover ?? true;
  const stake = input.stakes.enabled ? input.stakes.amount : 0;
  const anteSize = stake * players.length; // pot fed per hole

  const amountWon: Record<PlayerId, number> = {};
  const anteCharged: Record<PlayerId, number> = {};
  const skinsWon: Record<PlayerId, number> = {};
  for (const p of players) {
    amountWon[p] = 0;
    anteCharged[p] = 0;
    skinsWon[p] = 0;
  }

  const outcomes: SkinHoleOutcome[] = [];
  let pending: number[] = []; // hole numbers feeding the current (carried) pot

  for (const hole of holes) {
    pending.push(hole.hole);
    const winners = holeWinners(hole, players);

    if (winners.length === 1) {
      const winner = winners[0];
      const potHoles = pending.length;
      const potAmount = roundMoney(anteSize * potHoles);
      amountWon[winner] += potAmount;
      skinsWon[winner] += potHoles;
      for (const p of players) anteCharged[p] += stake * potHoles;
      outcomes.push({
        hole: hole.hole,
        result: "won",
        winnerId: winner,
        potHoles,
        potAmount,
      });
      pending = [];
    } else if (carryover) {
      // tie (or all picked up) → carry the pot forward
      outcomes.push({ hole: hole.hole, result: "carry" });
    } else {
      // no carryover → this hole's pot is voided (antes refunded ⇒ net 0)
      outcomes.push({ hole: hole.hole, result: "void" });
      pending = [];
    }
  }

  // Terminal carried pot that was never won → void & refund (charge no ante).
  const unclaimed = {
    holes: pending,
    pot: roundMoney(anteSize * pending.length),
  };

  const nets: PlayerNet[] = players.map((p) => ({
    playerId: p,
    amount: roundMoney(amountWon[p] - anteCharged[p]),
  }));

  return { nets, holes: outcomes, skinsWon, unclaimed };
}
