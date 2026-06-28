import { describe, expect, it } from "vitest";
import { computeSkins, type SkinsInput } from "./skins";
import type { HoleScores } from "./types";

// Helper: build holes from a compact table { A: net|null, ... } per hole.
function holes(rows: Array<Record<string, number | null>>): HoleScores[] {
  return rows.map((net, i) => ({ hole: i + 1, net }));
}

const sumNets = (r: { nets: { amount: number }[] }) =>
  r.nets.reduce((s, n) => s + n.amount, 0);
const netOf = (r: { nets: { playerId: string; amount: number }[] }, id: string) =>
  r.nets.find((n) => n.playerId === id)!.amount;

describe("skins — carryover + ante math", () => {
  // Hole 1 ties (A & B both 4) → carries. Hole 2 A wins outright.
  // 4 players, $5/hole. Awarded pot covers 2 holes = 4 × $5 × 2 = $40 to A.
  // Antes for those 2 holes = $10 each. A: +40 − 10 = +30; others −10.
  const base: SkinsInput = {
    players: ["A", "B", "C", "D"],
    stakes: { enabled: true, amount: 5 },
    holes: holes([
      { A: 4, B: 4, C: 5, D: 6 }, // tie → carry
      { A: 3, B: 5, C: 5, D: 6 }, // A outright → wins the 2-hole pot
    ]),
  };

  it("carried pot is won outright and nets to ~0", () => {
    const r = computeSkins(base);
    expect(netOf(r, "A")).toBe(30);
    expect(netOf(r, "B")).toBe(-10);
    expect(netOf(r, "C")).toBe(-10);
    expect(netOf(r, "D")).toBe(-10);
    expect(sumNets(r)).toBe(0);
  });

  it("reports the win with the grown pot size", () => {
    const r = computeSkins(base);
    expect(r.holes[0]).toEqual({ hole: 1, result: "carry" });
    expect(r.holes[1]).toMatchObject({
      hole: 2,
      result: "won",
      winnerId: "A",
      potHoles: 2,
      potAmount: 40,
    });
    expect(r.skinsWon.A).toBe(2);
  });
});

describe("skins — pick-up (null) cannot win", () => {
  it("a player who picked up is excluded from 'lowest'", () => {
    // A has the lowest NUMBER but picked up (null); B is the real low → B wins.
    const r = computeSkins({
      players: ["A", "B", "C"],
      stakes: { enabled: true, amount: 2 },
      holes: holes([{ A: null, B: 4, C: 5 }]),
    });
    expect(r.holes[0]).toMatchObject({ result: "won", winnerId: "B" });
    // B: +6 − 2 = +4; A,C: −2 each
    expect(netOf(r, "B")).toBe(4);
    expect(netOf(r, "A")).toBe(-2);
    expect(netOf(r, "C")).toBe(-2);
    expect(sumNets(r)).toBe(0);
  });

  it("on an AWARDED hole, a picked-up player still antes (forfeit, not refund)", () => {
    // 4 players, $5. C picks up; B wins outright. Pot stays $20 (C's stake is in
    // it). Winner +15; the other three (INCLUDING C) −5 each. Σ = 0.
    const r = computeSkins({
      players: ["A", "B", "C", "D"],
      stakes: { enabled: true, amount: 5 },
      holes: holes([{ A: 5, B: 4, C: null, D: 6 }]),
    });
    expect(r.holes[0]).toMatchObject({
      result: "won",
      winnerId: "B",
      potAmount: 20, // 4 × $5 — C's forfeited stake is included
    });
    expect(netOf(r, "B")).toBe(15);
    expect(netOf(r, "A")).toBe(-5);
    expect(netOf(r, "C")).toBe(-5); // picked up, still charged
    expect(netOf(r, "D")).toBe(-5);
    expect(sumNets(r)).toBe(0);
  });

  it("all picked up → carries (nobody wins)", () => {
    const r = computeSkins({
      players: ["A", "B"],
      stakes: { enabled: true, amount: 5 },
      holes: holes([{ A: null, B: null }, { A: 3, B: 4 }]),
    });
    expect(r.holes[0]).toEqual({ hole: 1, result: "carry" });
    expect(r.holes[1]).toMatchObject({ result: "won", winnerId: "A", potHoles: 2 });
    expect(sumNets(r)).toBe(0);
  });
});

describe("skins — terminal unclaimed pot (round ends mid-carry)", () => {
  it("voids & refunds the carried pot so Σnet = 0", () => {
    // Both holes tie → pot carries off the end of the round, never won.
    const r = computeSkins({
      players: ["A", "B", "C"],
      stakes: { enabled: true, amount: 10 },
      holes: holes([
        { A: 4, B: 4, C: 5 }, // tie → carry
        { A: 3, B: 3, C: 6 }, // tie → carry off the end
      ]),
    });
    expect(r.holes.every((h) => h.result === "carry")).toBe(true);
    expect(r.unclaimed.holes).toEqual([1, 2]);
    expect(r.unclaimed.pot).toBe(60); // 3 players × $10 × 2 holes (informational)
    // Nobody won and antes were refunded → everyone nets 0.
    for (const n of r.nets) expect(n.amount).toBe(0);
    expect(sumNets(r)).toBe(0);
  });

  it("awards earlier pots but voids only the trailing carry", () => {
    const r = computeSkins({
      players: ["A", "B"],
      stakes: { enabled: true, amount: 5 },
      holes: holes([
        { A: 3, B: 4 }, // A wins hole 1 ($10 pot)
        { A: 4, B: 4 }, // tie → carry off the end → voided
      ]),
    });
    // A: +10 − 5(ante hole1) = +5 ; B: −5. Hole 2 refunded.
    expect(netOf(r, "A")).toBe(5);
    expect(netOf(r, "B")).toBe(-5);
    expect(r.unclaimed.holes).toEqual([2]);
    expect(sumNets(r)).toBe(0);
  });
});

describe("skins — carryover off", () => {
  it("a tie voids just that hole (no growing pot)", () => {
    const r = computeSkins({
      players: ["A", "B", "C"],
      stakes: { enabled: true, amount: 5 },
      carryover: false,
      holes: holes([
        { A: 4, B: 4, C: 5 }, // tie → void
        { A: 3, B: 5, C: 5 }, // A wins single-hole pot ($15)
      ]),
    });
    expect(r.holes[0]).toEqual({ hole: 1, result: "void" });
    // A: +15 − 5 = +10 ; B,C: −5
    expect(netOf(r, "A")).toBe(10);
    expect(sumNets(r)).toBe(0);
  });
});

describe("skins — stakes off", () => {
  it("counts skins for standings but all nets are 0", () => {
    const r = computeSkins({
      players: ["A", "B"],
      stakes: { enabled: false, amount: 5 },
      holes: holes([{ A: 3, B: 4 }]),
    });
    expect(r.skinsWon.A).toBe(1);
    for (const n of r.nets) expect(n.amount).toBe(0);
  });
});
