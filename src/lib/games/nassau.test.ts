import { describe, expect, it } from "vitest";
import { computeNassau } from "./nassau";
import type { HoleScores, Side } from "./types";

const A: Side = { id: "A", playerIds: ["a"] };
const B: Side = { id: "B", playerIds: ["b"] };

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
      default:
        throw new Error(`bad pattern char ${c}`);
    }
  });
}

const sumNets = (r: { nets: { amount: number }[] }) =>
  r.nets.reduce((s, n) => s + n.amount, 0);
const netOf = (r: { nets: { playerId: string; amount: number }[] }, id: string) =>
  r.nets.find((n) => n.playerId === id)!.amount;
const seg = (r: { segments: { key: string; winnerId: string | null }[] }, key: string) =>
  r.segments.find((s) => s.key === key)!;

const stakes = { enabled: true, amount: 10 };

describe("nassau — 18 holes, three independent bets", () => {
  // Front: A 6 / B 2 → A. Back: B 6 / A 1 → B. Total: A 7 / B 8 → B.
  const pattern = "AAAAAABBHBBBBBBAHH"; // 18 holes
  const r = computeNassau({
    sideA: A,
    sideB: B,
    holes: holes(pattern),
    stakes,
    holesToPlay: 18,
  });

  it("scores front / back / total as separate segments", () => {
    expect(r.collapsed).toBe(false);
    expect(r.segments.map((s) => s.key)).toEqual(["front", "back", "total"]);
    expect(seg(r, "front").winnerId).toBe("A");
    expect(seg(r, "back").winnerId).toBe("B");
    expect(seg(r, "total").winnerId).toBe("B");
  });

  it("nets the three bets (A won 1, lost 2) → A −$10, sums to 0", () => {
    // front +10 to A; back −10 to A; total −10 to A  ⇒  net A = −10
    expect(netOf(r, "a")).toBe(-10);
    expect(netOf(r, "b")).toBe(10);
    expect(sumNets(r)).toBe(0);
  });

  it("a tied segment is halved → no money for it", () => {
    // Front 4-4 (halved), back A wins, total A wins.
    const r2 = computeNassau({
      sideA: A,
      sideB: B,
      holes: holes("AABBHHHHH" + "AAHHHHHHH"), // front 2A/2B = halved
      stakes,
      holesToPlay: 18,
    });
    expect(seg(r2, "front").winnerId).toBeNull();
    // back: A 2 / B 0 → A ; total: A 4 / B 2 → A → A wins 2 segments
    expect(netOf(r2, "a")).toBe(20);
    expect(sumNets(r2)).toBe(0);
  });
});

describe("nassau — 9-hole round collapses to a single bet", () => {
  it("one segment, no front/back/18 split", () => {
    const r = computeNassau({
      sideA: A,
      sideB: B,
      holes: holes("AAAAAHHHH"), // A 5 / B 0 over 9
      stakes,
      holesToPlay: 9,
    });
    expect(r.collapsed).toBe(true);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].key).toBe("match");
    expect(r.segments[0].winnerId).toBe("A");
    expect(netOf(r, "a")).toBe(10); // single stake, not 3×
    expect(netOf(r, "b")).toBe(-10);
    expect(sumNets(r)).toBe(0);
  });
});

describe("nassau — pick-up = hole loss", () => {
  it("a picked-up hole counts against the side", () => {
    const h: HoleScores[] = [
      { hole: 1, net: { a: null, b: 6 } }, // a picks up → B wins hole
      ...holes("HHHHHHHH").map((x, i) => ({ ...x, hole: i + 2 })),
    ];
    const r = computeNassau({
      sideA: A,
      sideB: B,
      holes: h,
      stakes,
      holesToPlay: 9,
    });
    expect(r.segments[0].winnerId).toBe("B");
  });
});

describe("nassau — stakes off", () => {
  it("computes winners but nets are 0", () => {
    const r = computeNassau({
      sideA: A,
      sideB: B,
      holes: holes("AAAAAHHHH"),
      stakes: { enabled: false, amount: 10 },
      holesToPlay: 9,
    });
    expect(r.segments[0].winnerId).toBe("A");
    for (const n of r.nets) expect(n.amount).toBe(0);
  });
});
