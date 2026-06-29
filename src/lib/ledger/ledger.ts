// Durable ledger helpers (build prompt §2.5/§7) — PURE, tested.
//
// On settle (and end-early) we write one LedgerEntry per player: signed net for
// the round, tied to crew + event. Idempotency is structural: UNIQUE(event_id,
// player_id) + an upsert keyed on it, so a re-settle or settle-after-end-early
// replaces rather than doubles. The PAID-flag policy on re-settle (decided): reset
// to false IFF the amount changed, else preserve the acknowledgement.
//
// A crewless one-off (crew_id null) writes NO ledger entry — enforced by the
// caller (buildLedgerRows is only invoked with a real crewId).

export interface LedgerNet {
  /** durable player id (NOT round_player id) */
  playerId: string;
  amount: number;
}

export interface ExistingLedgerEntry {
  player_id: string;
  amount: number;
  paid: boolean;
}

export interface LedgerUpsertRow {
  crew_id: string;
  event_id: string;
  player_id: string;
  amount: number;
  paid: boolean;
}

/**
 * Build the idempotent set of ledger rows for one event's settlement: exactly one
 * row per player net (so re-running yields the same N rows, never 2N), with the
 * paid flag carried per policy. Caller upserts on (event_id, player_id).
 */
export function buildLedgerRows(
  crewId: string,
  eventId: string,
  nets: LedgerNet[],
  existing: ExistingLedgerEntry[],
): LedgerUpsertRow[] {
  const prevByPlayer = new Map(existing.map((e) => [e.player_id, e]));
  return nets.map((n) => {
    const prev = prevByPlayer.get(n.playerId);
    const paid = prev ? (prev.amount !== n.amount ? false : prev.paid) : false;
    return {
      crew_id: crewId,
      event_id: eventId,
      player_id: n.playerId,
      amount: n.amount,
      paid,
    };
  });
}

/** Season-to-date net per player for a crew: SUM(amount) across its events. */
export function seasonToDate(
  entries: { player_id: string; amount: number }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    out[e.player_id] = (out[e.player_id] ?? 0) + Number(e.amount);
  }
  return out;
}
