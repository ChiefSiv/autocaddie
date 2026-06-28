import { describe, expect, it } from "vitest";
import { computeMatch } from "./match";
import type { HoleScores, Side } from "./types";

const A: Side = { id: "A", playerIds: ["a"] };
const B: Side = { id: "B", playerIds: ["b"] };

// Compact hole builder: 'A' = A wins, 'B' = B wins, 'H' = halve, '.' = both pick up.
function holes(pattern: string): HoleScores[] {
  return pattern.split("").map((c, i) => {
    const hole = i + 1;
    switch (c) {
      case "A":
        return { hole, net: { a: 4, b: 5 } };
      case "B":
        return { hole, net: { a: 5, b: 4 } };
      case "H":
        return { hole, net: { a: 4, b: 4 } };
      case ".":
        return { hole, net: { a: null, b: null } };
      default:
        throw new Error(`bad pattern char ${c}`);
    }
  });
}

const sumNets = (r: { nets: { amount: number }[] }) =>
  r.nets.reduce((s, n) => s + n.amount, 0);
const netOf = (r: { nets: { playerId: string; amount: number }[] }, id: string) =>
  r.nets.find((n) => n.playerId === id)!.amount;

const stakes = { enabled: true, amount: 20 };

describe("match play — running status", () => {
  it("reads 'X up' and 'All Square'", () => {
    // A wins 1, halve 2, B wins 3 → back to All Square.
    const r = computeMatch({ sideA: A, sideB: B, holes: holes("AHB"), stakes });
    expect(r.running[0].text).toBe("1 up");
    expect(r.running[0].leaderId).toBe("A");
    expect(r.running[1].text).toBe("1 up"); // halve doesn't change it
    expect(r.running[2].text).toBe("All Square");
    expect(r.running[2].leaderId).toBeNull();
  });
});

describe("match play — closeout '3 & 2'", () => {
  it("closes when lead exceeds holes remaining", () => {
    // A wins 1,2,3 then halves; 3 up with 2 to play after hole 16 → 3 > 2 → 3 & 2.
    const r = computeMatch({
      sideA: A,
      sideB: B,
      holes: holes("AAAHHHHHHHHHHHHHHH"), // 18 holes
      stakes,
    });
    expect(r.result).toBe("3 & 2");
    expect(r.closedAtHole).toBe(16);
    expect(r.winnerId).toBe("A");
    expect(netOf(r, "a")).toBe(20);
    expect(netOf(r, "b")).toBe(-20);
    expect(sumNets(r)).toBe(0);
    // running stops at the closeout hole — no holes scored after it.
    expect(r.running.at(-1)!.hole).toBe(16);
  });
});

describe("match play — dormie boundary (> vs >= off-by-one)", () => {
  it("dormie at 16 (18-hole match) → halve 17 closes '2 & 1'", () => {
    const r = computeMatch({
      sideA: A,
      sideB: B,
      holes: holes("AAHHHHHHHHHHHHHHHH"), // 18 holes; A wins 1&2, rest halved
      stakes,
    });
    // After hole 16: lead 2, remaining 2 → NOT closed (dormie).
    const at16 = r.running.find((s) => s.hole === 16)!;
    expect(at16.lead).toBe(2);
    // Hole 17 halved → lead 2, remaining 1 → 2 > 1 → closes "2 & 1".
    expect(r.closedAtHole).toBe(17);
    expect(r.result).toBe("2 & 1");
  });

  it("dormie at 16 → WIN 17 closes '3 & 1'", () => {
    const r = computeMatch({
      sideA: A,
      sideB: B,
      holes: holes("AAHHHHHHHHHHHHHHAH"), // win hole 17
      stakes,
    });
    expect(r.closedAtHole).toBe(17);
    expect(r.result).toBe("3 & 1");
  });

  it("dormie persists to 18 → decided on the last hole reads '1 up'", () => {
    // A wins hole 1, everything else halved → 1 up with 1 to play after 17
    // (1 > 1 is false, stays open), final hole halved → "1 up", not "1 & 0".
    const r = computeMatch({
      sideA: A,
      sideB: B,
      holes: holes("AHHHHHHHHHHHHHHHHH"), // 18 holes
      stakes,
    });
    expect(r.closedAtHole).toBeNull();
    expect(r.result).toBe("1 up");
    expect(r.winnerId).toBe("A");
    expect(sumNets(r)).toBe(0);
  });
});

describe("match play — halved through 18", () => {
  it("All Square at the end → 'Halved', net 0 both", () => {
    const r = computeMatch({
      sideA: A,
      sideB: B,
      holes: holes("ABHHHHHHHHHHHHHHHH"), // A & B trade holes 1,2; rest halved
      stakes,
    });
    expect(r.result).toBe("Halved");
    expect(r.winnerId).toBeNull();
    expect(netOf(r, "a")).toBe(0);
    expect(netOf(r, "b")).toBe(0);
  });
});

describe("match play — pick-up = hole loss", () => {
  it("a picked-up hole is lost to the opponent", () => {
    // Hole 1: a picks up (null), b scores → B wins the hole.
    const h: HoleScores[] = [
      { hole: 1, net: { a: null, b: 5 } },
      ...holes("HHHHHHHH").slice(0, 8).map((x, i) => ({ ...x, hole: i + 2 })),
    ];
    const r = computeMatch({ sideA: A, sideB: B, holes: h, stakes });
    expect(r.running[0].leaderId).toBe("B");
  });
});

describe("match play — stakes off", () => {
  it("computes status but nets are 0", () => {
    const r = computeMatch({
      sideA: A,
      sideB: B,
      holes: holes("AAAH"),
      stakes: { enabled: false, amount: 20 },
    });
    expect(r.winnerId).toBe("A");
    for (const n of r.nets) expect(n.amount).toBe(0);
  });
});
