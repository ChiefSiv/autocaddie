// Game-engine shared contract (build prompt §6) — PURE functions, no I/O.
//
// Engines consume scores that are ALREADY NETTED upstream (gross − strokes
// received, via src/lib/handicap/engine.ts, using the round's allowance mode).
// This keeps the engines decoupled from handicapping: they see numbers only.
// `null` = pick-up / no score for that player on that hole.
//
// Skins is "net by default, gross optional"; Nassau and Match are net. The
// gross-vs-net choice is made by the caller (the per-game `gross_or_net` flag)
// when it decides which scores to feed in — the engine just compares numbers.
//
// Every engine returns per-player signed `nets` that sum to ~0 across the game's
// participants (0 for everyone when stakes are off), plus a typed `detail` the
// UI and recap render. Players not in a game simply don't appear in its nets.

export type PlayerId = string;

/** Net scores for one hole, keyed by player. null = pick-up / no score. */
export interface HoleScores {
  hole: number;
  net: Record<PlayerId, number | null>;
}

/**
 * A side in a match-based game (Nassau, Match Play). v1 sides are typically a
 * single player. When a side has multiple players its per-hole score is the
 * BEST (lowest) net among them (better-ball), and the side's net is split evenly
 * across its players so the game still sums to ~0.
 */
export interface Side {
  id: string;
  playerIds: PlayerId[];
}

/** Stakes for a game. amount is per-hole (Skins) or per-segment/match
 *  (Nassau/Match). When `enabled` is false every net is 0. */
export interface Stakes {
  enabled: boolean;
  amount: number;
}

/** Signed net for one player. + won / − owed. Sums to ~0 across participants. */
export interface PlayerNet {
  playerId: PlayerId;
  amount: number;
}

/** Round of money to two decimals — guards float drift before it reaches money. */
export function roundMoney(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** The best (lowest) non-null net among a side's players on one hole, or null
 *  if every player on the side picked up / has no score. */
export function sideNetOnHole(
  hole: HoleScores,
  side: Side,
): number | null {
  let best: number | null = null;
  for (const pid of side.playerIds) {
    const v = hole.net[pid];
    if (v == null) continue;
    if (best == null || v < best) best = v;
  }
  return best;
}
