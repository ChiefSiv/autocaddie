import { describe, expect, it } from "vitest";
import { buildLedgerRows, seasonToDate } from "./ledger";

const nets = [
  { playerId: "A", amount: 30 },
  { playerId: "B", amount: -10 },
  { playerId: "C", amount: -20 },
];

describe("buildLedgerRows — idempotent, one row per player", () => {
  it("first settle: one row per player, all unpaid", () => {
    const rows = buildLedgerRows("crew1", "ev1", nets, []);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.paid === false)).toBe(true);
    expect(rows.map((r) => r.amount)).toEqual([30, -10, -20]);
    expect(rows.every((r) => r.crew_id === "crew1" && r.event_id === "ev1")).toBe(true);
  });

  it("double-settle does NOT double-write (still one row per player)", () => {
    const first = buildLedgerRows("crew1", "ev1", nets, []);
    // Simulate the rows now existing, then settle again with identical nets.
    const existing = first.map((r) => ({
      player_id: r.player_id,
      amount: r.amount,
      paid: r.paid,
    }));
    const second = buildLedgerRows("crew1", "ev1", nets, existing);
    expect(second).toHaveLength(3); // not 6
    // Upsert key (event_id, player_id) is unique per player → no duplication.
    expect(new Set(second.map((r) => r.player_id)).size).toBe(3);
  });

  it("paid policy: preserves paid when amount unchanged, resets when it changes", () => {
    const existing = [
      { player_id: "A", amount: 30, paid: true }, // unchanged → keep paid
      { player_id: "B", amount: -10, paid: true }, // amount will change → reset
      { player_id: "C", amount: -20, paid: false },
    ];
    const changed = [
      { playerId: "A", amount: 30 },
      { playerId: "B", amount: -15 }, // changed
      { playerId: "C", amount: -15 }, // changed
    ];
    const rows = buildLedgerRows("crew1", "ev1", changed, existing);
    const byId = Object.fromEntries(rows.map((r) => [r.player_id, r]));
    expect(byId.A.paid).toBe(true); // unchanged amount → acknowledgement kept
    expect(byId.B.paid).toBe(false); // amount changed → re-acknowledge
    expect(byId.C.paid).toBe(false);
  });
});

describe("seasonToDate — sums two rounds with the same crew", () => {
  it("SUM(amount) per player across events", () => {
    // Round 1 ledger + Round 2 ledger, same crew.
    const entries = [
      { player_id: "A", amount: 30 },
      { player_id: "B", amount: -10 },
      { player_id: "C", amount: -20 },
      { player_id: "A", amount: -5 },
      { player_id: "B", amount: 15 },
      { player_id: "C", amount: -10 },
    ];
    const season = seasonToDate(entries);
    expect(season.A).toBe(25); // +30 −5
    expect(season.B).toBe(5); // −10 +15
    expect(season.C).toBe(-30); // −20 −10
    // each round sums to ~0 → season also sums to ~0
    expect(season.A + season.B + season.C).toBe(0);
  });
});
