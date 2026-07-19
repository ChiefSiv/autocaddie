import { describe, expect, it } from "vitest";
import { computeRoundHandicaps } from "@/lib/handicap/engine";
import { computeRoundResults, type RRGame, type RRPlayer } from "./round-results";
import { scoreKey, type GrossMap, type ScoringHole } from "./scoring";
import { buildLedgerRows } from "@/lib/ledger/ledger";

// Course where courseHandicap == index (slope 113, rating == par) so the math is
// hand-checkable. 3 holes par 4, SI 1/2/3.
const COURSE = { slope: 113, courseRating: 72, par: 72 };
const holes: ScoringHole[] = [
  { number: 1, par: 4, strokeIndex: 1 },
  { number: 2, par: 4, strokeIndex: 2 },
  { number: 3, par: 4, strokeIndex: 3 },
];

// Build the RR field the SAME way the app does: index → computeRoundHandicaps
// (whole field, allowance mode applied) → playing_handicap (strokesGiven).
function field(
  indexes: Record<string, number>,
  mode: "full" | "relative" = "full",
): RRPlayer[] {
  const computed = computeRoundHandicaps(
    Object.entries(indexes).map(([id, handicapIndex]) => ({ id, handicapIndex })),
    COURSE,
    mode,
  );
  return computed.map((c) => ({
    roundPlayerId: c.id,
    playerId: `p${c.id}`,
    displayName: c.id,
    playingHandicap: c.strokesGiven,
  }));
}

const games: RRGame[] = [
  { id: "m", type: "match", stakesEnabled: true, stake: 20, sides: { a: "A", b: "B" } },
];
// A: 4/5/4 ; B: 4/4/5  → at scratch this is halved (each wins one, one halve).
const gross: GrossMap = {
  [scoreKey("A", 1)]: 4, [scoreKey("B", 1)]: 4,
  [scoreKey("A", 2)]: 5, [scoreKey("B", 2)]: 4,
  [scoreKey("A", 3)]: 4, [scoreKey("B", 3)]: 5,
};

describe("handicap edit — recompute path changes net → settlement", () => {
  it("scratch field halves the match (net $0)", () => {
    const r = computeRoundResults({
      players: field({ A: 0, B: 0 }),
      games,
      holesInPlay: holes,
      gross,
      holesToPlay: 18,
    });
    expect(r.games[0].matchWinnerId).toBeNull();
    expect(r.perPlayerNet.A).toBe(0);
    expect(r.perPlayerNet.B).toBe(0);
  });

  it("raising A's index to 3 gives A a stroke on each hole → A wins +$20", () => {
    // A now nets 3/4/3 vs B 4/4/5 → A wins holes 1 & 3, halve 2 → A wins the match.
    const r = computeRoundResults({
      players: field({ A: 3, B: 0 }),
      games,
      holesInPlay: holes,
      gross,
      holesToPlay: 18,
    });
    expect(r.games[0].matchWinnerId).toBe("A");
    expect(r.perPlayerNet.A).toBe(20);
    expect(r.perPlayerNet.B).toBe(-20);
  });
});

describe("handicap edit — relative allowance recomputes the WHOLE field", () => {
  it("editing one player shifts everyone's allocation (low-man-scratch)", () => {
    // A 5 / B 0 relative → B is low (scratch), A plays 5.
    const before = field({ A: 5, B: 0 }, "relative");
    expect(before.find((p) => p.roundPlayerId === "A")!.playingHandicap).toBe(5);
    expect(before.find((p) => p.roundPlayerId === "B")!.playingHandicap).toBe(0);
    // Raise B to 8 → now A (5) is low → A scratch, B plays 3. A's number CHANGED
    // even though only B was edited — proves the whole field must be recomputed.
    const after = field({ A: 5, B: 8 }, "relative");
    expect(after.find((p) => p.roundPlayerId === "A")!.playingHandicap).toBe(0);
    expect(after.find((p) => p.roundPlayerId === "B")!.playingHandicap).toBe(3);
  });
});

describe("re-settle after a handicap change — idempotent, paid resets on change", () => {
  it("upsert stays one row per player; paid resets only where the amount changed", () => {
    // Round settled once: A +20 / B −20, A already marked paid.
    const firstNets = [
      { playerId: "pA", amount: 20 },
      { playerId: "pB", amount: -20 },
    ];
    const first = buildLedgerRows("crew1", "ev1", firstNets, []);
    expect(first).toHaveLength(2);

    // Handicap edited → nets recompute to A +10 / B −10. Simulate existing rows
    // (A had been marked paid), re-settle.
    const existing = [
      { player_id: "pA", amount: 20, paid: true },
      { player_id: "pB", amount: -20, paid: false },
    ];
    const changedNets = [
      { playerId: "pA", amount: 10 },
      { playerId: "pB", amount: -10 },
    ];
    const resettled = buildLedgerRows("crew1", "ev1", changedNets, existing);

    expect(resettled).toHaveLength(2); // NOT 4 — one row per (event, player)
    const byId = Object.fromEntries(resettled.map((r) => [r.player_id, r]));
    expect(byId.pA.amount).toBe(10);
    expect(byId.pA.paid).toBe(false); // amount changed → re-acknowledge
    expect(byId.pB.amount).toBe(-10);
    expect(byId.pB.paid).toBe(false);
  });

  it("re-settle with UNCHANGED amounts preserves paid", () => {
    const existing = [{ player_id: "pA", amount: 10, paid: true }];
    const rows = buildLedgerRows("crew1", "ev1", [{ playerId: "pA", amount: 10 }], existing);
    expect(rows[0].paid).toBe(true);
  });
});
