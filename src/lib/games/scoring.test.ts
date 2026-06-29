import { describe, expect, it } from "vitest";
import {
  deriveScoring,
  holesInPlayNumbers,
  scoreKey,
  type GrossMap,
  type ScoringHole,
  type ScoringPlayer,
} from "./scoring";

const holes: ScoringHole[] = [
  { number: 1, par: 4, strokeIndex: 1 },
  { number: 2, par: 4, strokeIndex: 2 },
  { number: 3, par: 4, strokeIndex: 3 },
];
// A gets 1 stroke (on SI 1); B is scratch.
const A: ScoringPlayer = { roundPlayerId: "A", playingHandicap: 1 };
const B: ScoringPlayer = { roundPlayerId: "B", playingHandicap: 0 };

describe("deriveScoring — net derivation", () => {
  it("derives net = gross − strokes received, A's stroke only on SI 1", () => {
    const gross: GrossMap = {
      [scoreKey("A", 1)]: 5,
      [scoreKey("B", 1)]: 4,
      [scoreKey("A", 2)]: 4,
      [scoreKey("B", 2)]: 4,
    };
    const d = deriveScoring([A, B], holes, gross);
    expect(d.completeHoles).toEqual([1, 2]); // hole 3 not entered
    expect(d.completeHoleNets[0].net).toEqual({ A: 4, B: 4 }); // A 5−1, B 4−0
    expect(d.completeHoleNets[1].net).toEqual({ A: 4, B: 4 }); // no stroke on SI 2
    expect(d.strokesByPlayer.A.get(1)).toBe(1);
    expect(d.strokesByPlayer.A.get(2)).toBe(0);
  });

  it("excludes a half-entered hole from standings", () => {
    const gross: GrossMap = {
      [scoreKey("A", 1)]: 5,
      // B has not entered hole 1
    };
    const d = deriveScoring([A, B], holes, gross);
    expect(d.completeHoles).toEqual([]);
    expect(d.completeHoleNets).toEqual([]);
  });
});

describe("deriveScoring — pick-up is null, NOT 0", () => {
  it("a pick-up yields net null; a real score yields a number", () => {
    const gross: GrossMap = {
      [scoreKey("A", 1)]: null, // pick-up
      [scoreKey("B", 1)]: 5,
    };
    const d = deriveScoring([A, B], holes, gross);
    expect(d.completeHoles).toEqual([1]); // both ENTERED (null counts as entered)
    expect(d.completeHoleNets[0].net.A).toBeNull(); // pick-up → null
    expect(d.completeHoleNets[0].net.B).toBe(5); // 5 − 0
    // critically, pick-up is not coerced to 0
    expect(d.completeHoleNets[0].net.A).not.toBe(0);
  });
});

describe("holesInPlayNumbers", () => {
  it("covers full 18, front 9, back 9", () => {
    expect(holesInPlayNumbers(18, null)).toHaveLength(18);
    expect(holesInPlayNumbers(9, "front")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(holesInPlayNumbers(9, "back")).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });
});
