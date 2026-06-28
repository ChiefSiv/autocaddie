import { describe, expect, it } from "vitest";
import {
  minimizePayments,
  settle,
  sumPlayerNets,
  type GameNets,
  type Payment,
} from "./settlement";
import type { PlayerNet } from "./types";

const sum = (ns: PlayerNet[]) => ns.reduce((s, n) => s + n.amount, 0);

/** Net each player actually realizes from a payment list (received − paid). */
function netFromPayments(payments: Payment[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const p of payments) {
    m[p.to] = (m[p.to] ?? 0) + p.amount;
    m[p.from] = (m[p.from] ?? 0) - p.amount;
  }
  return m;
}

describe("settlement — minimized payments ≠ naive pairwise", () => {
  // 4 players across 3 games:
  //   match A>C: A+10 C−10 ; match A>D: A+10 D−10 ; skins: A+10 B+10 C−10 D−10
  // Totals: A +30, B +10, C −20, D −20  (Σ = 0)
  const games: GameNets[] = [
    { gameId: "m1", type: "match", nets: [n("A", 10), n("C", -10)] },
    { gameId: "m2", type: "match", nets: [n("A", 10), n("D", -10)] },
    {
      gameId: "sk",
      type: "skins",
      nets: [n("A", 10), n("B", 10), n("C", -10), n("D", -10)],
    },
  ];

  it("sums to the right per-player net", () => {
    const totals = sumPlayerNets(games);
    expect(get(totals, "A")).toBe(30);
    expect(get(totals, "B")).toBe(10);
    expect(get(totals, "C")).toBe(-20);
    expect(get(totals, "D")).toBe(-20);
    expect(sum(totals)).toBe(0);
  });

  it("minimized uses fewer transactions than settling each game pairwise", () => {
    const r = settle(games);
    const naivePairwiseCount = games.reduce(
      (acc, g) => acc + minimizePayments(g.nets).length,
      0,
    );
    expect(r.payments.length).toBeLessThan(naivePairwiseCount);
    expect(r.payments.length).toBe(3); // C→A, D→A, D→B
  });

  it("minimized payments reconcile exactly to each player's net", () => {
    const r = settle(games);
    const realized = netFromPayments(r.payments);
    for (const p of r.perPlayerNet) {
      expect(realized[p.playerId] ?? 0).toBeCloseTo(p.amount, 6);
    }
  });
});

describe("settlement — by-game breakdown sums to the minimized view", () => {
  it("each player's per-game nets sum to their overall net", () => {
    const games: GameNets[] = [
      { gameId: "m1", type: "match", nets: [n("A", 10), n("C", -10)] },
      { gameId: "m2", type: "match", nets: [n("A", 10), n("D", -10)] },
      {
        gameId: "sk",
        type: "skins",
        nets: [n("A", 10), n("B", 10), n("C", -10), n("D", -10)],
      },
    ];
    const r = settle(games);
    for (const p of r.perPlayerNet) {
      const fromGames = r.byGame.reduce(
        (acc, g) => acc + (g.nets.find((x) => x.playerId === p.playerId)?.amount ?? 0),
        0,
      );
      expect(fromGames).toBeCloseTo(p.amount, 6);
    }
  });
});

describe("settlement — 3-player routing", () => {
  it("routes B's wash through to a single C→A payment", () => {
    // A beats B 10 ; B beats C 10 → A +10, B 0, C −10 → ONE payment C→A.
    const games: GameNets[] = [
      { gameId: "m1", type: "match", nets: [n("A", 10), n("B", -10)] },
      { gameId: "m2", type: "match", nets: [n("B", 10), n("C", -10)] },
    ];
    const r = settle(games);
    expect(r.payments).toEqual([{ from: "C", to: "A", amount: 10 }]);
  });
});

describe("settlement — fractional stakes stay exact (cents)", () => {
  it("handles $2.50 splits without float drift", () => {
    const games: GameNets[] = [
      { gameId: "sk", type: "skins", nets: [n("A", 2.5), n("B", -2.5)] },
    ];
    const r = settle(games);
    expect(r.payments).toEqual([{ from: "B", to: "A", amount: 2.5 }]);
    expect(sum(r.perPlayerNet)).toBe(0);
  });
});

function n(playerId: string, amount: number): PlayerNet {
  return { playerId, amount };
}
function get(ns: PlayerNet[], id: string) {
  return ns.find((x) => x.playerId === id)!.amount;
}
