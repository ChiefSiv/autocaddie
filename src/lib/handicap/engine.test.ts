import { describe, expect, it } from "vitest";
import {
  allocateStrokes,
  applyAllowanceMode,
  computeRoundHandicaps,
  courseHandicap,
  holesMissingStrokeIndex,
  netScore,
  playingHandicap,
  roundHalfAwayFromZero,
  strokesOnHole,
} from "./engine";
import { FIXTURE_HOLES } from "@/lib/courses/fixture";

describe("roundHalfAwayFromZero", () => {
  it("rounds .5 away from zero", () => {
    expect(roundHalfAwayFromZero(11.5)).toBe(12);
    expect(roundHalfAwayFromZero(11.4)).toBe(11);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
  });
});

describe("courseHandicap = round(index × slope/113 + (rating − par))", () => {
  it("Graywolf Gold (73.8 / 135 / 72), index 8.2 → 12", () => {
    // 8.2 × 135/113 = 9.796… ; + (73.8 − 72)=1.8 ; = 11.596… → 12
    expect(
      courseHandicap({ handicapIndex: 8.2, slope: 135, courseRating: 73.8, par: 72 }),
    ).toBe(12);
  });
  it("scratch (index 0) on Graywolf Gold → 2 (rating − par = 1.8 → 2)", () => {
    expect(
      courseHandicap({ handicapIndex: 0, slope: 135, courseRating: 73.8, par: 72 }),
    ).toBe(2);
  });
  it("neutral slope/rating (113 / par): course = index", () => {
    expect(
      courseHandicap({ handicapIndex: 14, slope: 113, courseRating: 72, par: 72 }),
    ).toBe(14);
  });
});

describe("playingHandicap = round(courseHandicap × allowance)", () => {
  it("singles 100% is identity", () => {
    expect(playingHandicap(12)).toBe(12);
  });
  it("four-ball 85%: 12 → 10.2 → 10", () => {
    expect(playingHandicap(12, 0.85)).toBe(10);
  });
  it("Stableford 95%: 14 → 13.3 → 13", () => {
    expect(playingHandicap(14, 0.95)).toBe(13);
  });
});

describe("applyAllowanceMode (round-level)", () => {
  it("full leaves handicaps unchanged", () => {
    expect(applyAllowanceMode([12, 8, 20, 5], "full")).toEqual([12, 8, 20, 5]);
  });
  it("relative: low man plays scratch, others get the difference", () => {
    // min is 5 → subtract 5
    expect(applyAllowanceMode([12, 8, 20, 5], "relative")).toEqual([7, 3, 15, 0]);
  });
  it("relative with a plus player shifts everyone up", () => {
    // min is −2 → subtract −2 (i.e. +2)
    expect(applyAllowanceMode([10, 0, -2], "relative")).toEqual([12, 2, 0]);
  });
});

describe("strokesOnHole (SI 1 = hardest)", () => {
  it("N=8: one stroke on SI ≤ 8, none above", () => {
    expect(strokesOnHole(8, 1)).toBe(1);
    expect(strokesOnHole(8, 8)).toBe(1);
    expect(strokesOnHole(8, 9)).toBe(0);
  });
  it("N=18: exactly one stroke on every hole", () => {
    for (let si = 1; si <= 18; si++) expect(strokesOnHole(18, si)).toBe(1);
  });
  it("N=20 (>18): everyone 1, plus a 2nd on SI ≤ 2", () => {
    expect(strokesOnHole(20, 1)).toBe(2);
    expect(strokesOnHole(20, 2)).toBe(2);
    expect(strokesOnHole(20, 3)).toBe(1);
  });
  it("N=36: two strokes on every hole", () => {
    expect(strokesOnHole(36, 1)).toBe(2);
    expect(strokesOnHole(36, 18)).toBe(2);
  });
  it("plus handicap N=−2: gives back on the two easiest holes (SI 17,18)", () => {
    expect(strokesOnHole(-2, 18)).toBe(-1);
    expect(strokesOnHole(-2, 17)).toBe(-1);
    expect(strokesOnHole(-2, 16)).toBe(0);
  });
  it("N=0: no strokes", () => {
    expect(strokesOnHole(0, 1)).toBe(0);
  });
  it("total strokes allocated over 18 holes equals the handicap", () => {
    for (const N of [5, 8, 18, 20, 27, 36]) {
      let sum = 0;
      for (let si = 1; si <= 18; si++) sum += strokesOnHole(N, si);
      expect(sum).toBe(N);
    }
  });
});

describe("allocateStrokes over the fixture course", () => {
  it("N=4 puts one stroke on the four hardest holes (SI 1–4) only", () => {
    const map = allocateStrokes(4, FIXTURE_HOLES);
    const withStroke = FIXTURE_HOLES.filter((h) => map.get(h.number) === 1);
    expect(withStroke.map((h) => h.strokeIndex).sort((a, b) => a! - b!)).toEqual([
      1, 2, 3, 4,
    ]);
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });
  it("THROWS on a missing stroke index rather than silently mis-allocating", () => {
    const holes = [
      { number: 1, strokeIndex: null },
      { number: 2, strokeIndex: 1 },
    ];
    expect(holesMissingStrokeIndex(holes)).toEqual([1]);
    expect(() => allocateStrokes(10, holes)).toThrow(/stroke index missing/i);
  });
});

describe("netScore", () => {
  it("net = gross − strokes received", () => {
    expect(netScore(5, 1)).toBe(4);
    expect(netScore(4, 0)).toBe(4);
  });
  it("pick-up (null gross) stays null", () => {
    expect(netScore(null, 1)).toBeNull();
  });
});

describe("computeRoundHandicaps (field, end-to-end)", () => {
  const course = { slope: 135, courseRating: 73.8, par: 72 }; // Graywolf Gold
  const players = [
    { id: "ryan", handicapIndex: 8.2 },
    { id: "mac", handicapIndex: 0 },
    { id: "tj", handicapIndex: 20 },
  ];

  it("full mode keeps each player's own playing handicap", () => {
    const res = computeRoundHandicaps(players, course, "full");
    const byId = Object.fromEntries(res.map((r) => [r.id, r]));
    expect(byId.ryan.courseHandicap).toBe(12);
    expect(byId.ryan.strokesGiven).toBe(12);
    expect(byId.mac.courseHandicap).toBe(2);
    expect(byId.mac.strokesGiven).toBe(2);
    // index 20 → 20×135/113 + 1.8 = 23.89… + … → 26
    expect(byId.tj.courseHandicap).toBe(26);
    expect(byId.tj.strokesGiven).toBe(26);
  });

  it("relative mode sends the low man (Mac) to scratch", () => {
    const res = computeRoundHandicaps(players, course, "relative");
    const byId = Object.fromEntries(res.map((r) => [r.id, r]));
    // playing = [12, 2, 26]; min 2 → strokesGiven [10, 0, 24]
    expect(byId.mac.strokesGiven).toBe(0);
    expect(byId.ryan.strokesGiven).toBe(10);
    expect(byId.tj.strokesGiven).toBe(24);
    // playingHandicap itself is unchanged; only strokesGiven shifts
    expect(byId.ryan.playingHandicap).toBe(12);
  });

  it("order of ops: per-game allowance FIRST, then relative", () => {
    // 0.85 four-ball allowance, then relative.
    // course [12, 2, 26] → ×0.85 round → playing [10, 2, 22] → relative −2 → [8, 0, 20]
    const withAllowance = players.map((p) => ({ ...p, allowance: 0.85 }));
    const res = computeRoundHandicaps(withAllowance, course, "relative");
    const byId = Object.fromEntries(res.map((r) => [r.id, r]));
    expect(byId.ryan.playingHandicap).toBe(10);
    expect(byId.tj.playingHandicap).toBe(22);
    expect(byId.mac.strokesGiven).toBe(0);
    expect(byId.ryan.strokesGiven).toBe(8);
    expect(byId.tj.strokesGiven).toBe(20);
  });
});
