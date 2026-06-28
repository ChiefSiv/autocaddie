// Settlement engine (build prompt §7).
//
// Each stakes-enabled game outputs a per-player net; we sum across all games to
// one net per player, then compute the MINIMIZED set of payments (fewest
// transactions) as the default view. The by-game breakdown is a passthrough that
// MUST sum, per player, to the same net as the minimized view (asserted in tests).
//
// Money only — never processed. The caller writes each per-player net to the
// durable ledger (one LedgerEntry per crew+event+player; see §2.5 + the
// ledger_unique migration). This module is pure: it computes, it does not persist.
//
// All arithmetic runs in integer CENTS so float drift never reaches a payment.

import type { PlayerId, PlayerNet } from "./types";

export interface GameNets {
  gameId: string;
  type: string;
  /** per-player nets for this game; 0s for stakes-off games */
  nets: PlayerNet[];
}

export interface Payment {
  from: PlayerId;
  to: PlayerId;
  amount: number;
}

export interface SettlementResult {
  /** net per player summed across all games (signed); sums to ~0 */
  perPlayerNet: PlayerNet[];
  /** minimized who-pays-whom (fewest transactions) */
  payments: Payment[];
  /** by-game breakdown (passthrough) — only meaningful with 2+ games in the UI */
  byGame: GameNets[];
}

const toCents = (x: number) => Math.round(x * 100);
const fromCents = (c: number) => c / 100;

/** Sum game nets into one signed net per player (union of all participants). */
export function sumPlayerNets(games: GameNets[]): PlayerNet[] {
  const cents = new Map<PlayerId, number>();
  for (const g of games) {
    for (const n of g.nets) {
      cents.set(n.playerId, (cents.get(n.playerId) ?? 0) + toCents(n.amount));
    }
  }
  return [...cents.entries()].map(([playerId, c]) => ({
    playerId,
    amount: fromCents(c),
  }));
}

/**
 * Minimize payments: greedily settle the largest creditor against the largest
 * debtor until everyone is square. Produces at most (n − 1) transactions for n
 * non-zero balances — fewer than per-pair settling whenever debts can be routed
 * through a common counterparty. Deterministic: re-sorts each step (amount desc,
 * then id) so output is stable for tests.
 */
export function minimizePayments(nets: PlayerNet[]): Payment[] {
  const creditors = nets
    .map((n) => ({ id: n.playerId, c: toCents(n.amount) }))
    .filter((x) => x.c > 0);
  const debtors = nets
    .map((n) => ({ id: n.playerId, c: -toCents(n.amount) }))
    .filter((x) => x.c > 0); // store owed as a positive number

  const payments: Payment[] = [];
  const byAmountThenId = <T extends { c: number; id: string }>(a: T, b: T) =>
    b.c - a.c || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  while (creditors.length && debtors.length) {
    creditors.sort(byAmountThenId);
    debtors.sort(byAmountThenId);
    const cr = creditors[0];
    const dr = debtors[0];
    const x = Math.min(cr.c, dr.c);
    payments.push({ from: dr.id, to: cr.id, amount: fromCents(x) });
    cr.c -= x;
    dr.c -= x;
    if (cr.c === 0) creditors.shift();
    if (dr.c === 0) debtors.shift();
  }
  return payments;
}

export function settle(games: GameNets[]): SettlementResult {
  const perPlayerNet = sumPlayerNets(games);
  return {
    perPlayerNet,
    payments: minimizePayments(perPlayerNet),
    byGame: games,
  };
}
