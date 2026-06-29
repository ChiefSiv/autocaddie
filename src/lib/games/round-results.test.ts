import { describe, expect, it } from "vitest";
import { computeRoundResults, type RRGame, type RRPlayer } from "./round-results";
import { scoreKey, type GrossMap, type ScoringHole } from "./scoring";

// 4 players, scratch (playingHandicap 0) so net == gross — keeps the worked
// example hand-checkable. 3 holes, par 4, SI 1/2/3.
const players: RRPlayer[] = [
  { roundPlayerId: "A", playerId: "pA", displayName: "A", playingHandicap: 0 },
  { roundPlayerId: "B", playerId: "pB", displayName: "B", playingHandicap: 0 },
  { roundPlayerId: "C", playerId: "pC", displayName: "C", playingHandicap: 0 },
  { roundPlayerId: "D", playerId: "pD", displayName: "D", playingHandicap: 0 },
];
const holes: ScoringHole[] = [
  { number: 1, par: 4, strokeIndex: 1 },
  { number: 2, par: 4, strokeIndex: 2 },
  { number: 3, par: 4, strokeIndex: 3 },
];

// Skins $5 (group) + Match A v B $20. Scores:
//  h1 A 3 (outright low) ; h2 B 3 ; h3 A 3 (A & B tie? no — make A low)
const gross: GrossMap = {
  [scoreKey("A", 1)]: 3, [scoreKey("B", 1)]: 4, [scoreKey("C", 1)]: 5, [scoreKey("D", 1)]: 6,
  [scoreKey("A", 2)]: 5, [scoreKey("B", 2)]: 3, [scoreKey("C", 2)]: 5, [scoreKey("D", 2)]: 6,
  [scoreKey("A", 3)]: 3, [scoreKey("B", 3)]: 4, [scoreKey("C", 3)]: 5, [scoreKey("D", 3)]: 6,
};

const games: RRGame[] = [
  { id: "sk", type: "skins", stakesEnabled: true, stake: 5, carryover: true },
  { id: "m", type: "match", stakesEnabled: true, stake: 20, sides: { a: "A", b: "B" } },
];

describe("computeRoundResults — combined multi-game settlement", () => {
  const r = computeRoundResults({ players, games, holesInPlay: holes, gross, holesToPlay: 18 });

  it("skins: A wins holes 1&3, B wins hole 2 (4 players, $5 → $20/hole)", () => {
    const sk = r.games.find((g) => g.gameId === "sk")!;
    expect(sk.skinsWon).toMatchObject({ A: 2, B: 1, C: 0, D: 0 });
    // A: won $40, ante $15 → +25 ; B: won $20, ante $15 → +5 ; C,D: −15 each
    expect(sk.nets).toMatchObject({ A: 25, B: 5, C: -15, D: -15 });
    expect(Object.values(sk.nets).reduce((s, n) => s + n, 0)).toBe(0);
  });

  it("match A v B: A wins (2 holes to 1) → A +20 / B −20", () => {
    const m = r.games.find((g) => g.gameId === "m")!;
    expect(m.matchWinnerId).toBe("A");
    expect(m.nets.A).toBe(20);
    expect(m.nets.B).toBe(-20);
  });

  it("combined per-player net sums skins + match and totals zero", () => {
    // A: +25 +20 = +45 ; B: +5 −20 = −15 ; C: −15 ; D: −15
    expect(r.perPlayerNet).toMatchObject({ A: 45, B: -15, C: -15, D: -15 });
    expect(Object.values(r.perPlayerNet).reduce((s, n) => s + n, 0)).toBe(0);
  });

  it("minimized payments reconcile to each player's net and beat pairwise", () => {
    const realized: Record<string, number> = {};
    for (const p of r.payments) {
      realized[p.to] = (realized[p.to] ?? 0) + p.amount;
      realized[p.from] = (realized[p.from] ?? 0) - p.amount;
    }
    for (const [id, net] of Object.entries(r.perPlayerNet)) {
      expect(realized[id] ?? 0).toBeCloseTo(net, 6);
    }
    // 3 debtors/creditors → at most 3 transactions, fewer than settling 2 games pairwise
    expect(r.payments.length).toBeLessThanOrEqual(3);
  });

  it("stakes-off game contributes 0 to the settlement", () => {
    const social: RRGame[] = [
      { id: "sk2", type: "skins", stakesEnabled: false, stake: null, carryover: true },
    ];
    const r2 = computeRoundResults({ players, games: social, holesInPlay: holes, gross, holesToPlay: 18 });
    expect(Object.values(r2.perPlayerNet).every((n) => n === 0)).toBe(true);
    // standings still computed
    expect(r2.games[0].skinsWon).toMatchObject({ A: 2, B: 1 });
  });
});
