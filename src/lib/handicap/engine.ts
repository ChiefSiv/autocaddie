// Handicap & stroke-allocation engine (build prompt §7) — PURE, tested functions.
// The UI surfaces stroke dots later; this is the math spine for net scoring.
//
// Allowance modes are a ROUND-LEVEL setting (events.allowance_mode):
//   - "full"     → use the (game-allowance-adjusted) playing handicap as-is.
//   - "relative" → "low man plays scratch": subtract the FIELD'S LOWEST playing
//                  handicap from everyone. This is a thin adjustment on the same
//                  engine (full handicap minus a constant), NOT a separate path.
// Game "allowance" (e.g. 0.85 four-ball) is a separate per-game multiplier.

export type AllowanceMode = "full" | "relative";

/** Round half away from zero (WHS-style), so 11.5 → 12 and −2.5 → −3. */
export function roundHalfAwayFromZero(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x) + Number.EPSILON);
}

export interface CourseHandicapInput {
  handicapIndex: number;
  slope: number;
  courseRating: number;
  par: number;
}

/** Course Handicap = round( index × (slope / 113) + (courseRating − par) ). */
export function courseHandicap({
  handicapIndex,
  slope,
  courseRating,
  par,
}: CourseHandicapInput): number {
  return roundHalfAwayFromZero(
    handicapIndex * (slope / 113) + (courseRating - par),
  );
}

/** Playing Handicap = round( courseHandicap × allowance ). Allowance defaults
 *  to 1.0 (singles); pass e.g. 0.85 four-ball, 0.95 Stableford per game. */
export function playingHandicap(courseHcp: number, allowance = 1): number {
  return roundHalfAwayFromZero(courseHcp * allowance);
}

/**
 * Apply the round-level allowance mode to a field's playing handicaps.
 * "relative" subtracts the lowest (low man → 0; others get the difference).
 * "full" returns them unchanged. Returns a new array, order preserved.
 */
export function applyAllowanceMode(
  playingHandicaps: number[],
  mode: AllowanceMode,
): number[] {
  if (mode !== "relative" || playingHandicaps.length === 0) {
    return [...playingHandicaps];
  }
  const low = Math.min(...playingHandicaps);
  return playingHandicaps.map((h) => h - low);
}

/**
 * Strokes received on a single hole, given the player's allocation handicap and
 * the hole's stroke index (SI 1 = hardest). Handles all cases with one formula:
 *   - 0 ≤ N ≤ 18:  1 stroke where SI ≤ N
 *   - N > 18:      1 on every hole, plus a 2nd where SI ≤ (N − 18), etc.
 *   - N < 0 (plus): strokes GIVEN BACK on the easiest holes (highest SI), negative.
 * `holesInAllocation` is the SI span (18 for a full course).
 */
export function strokesOnHole(
  handicap: number,
  strokeIndex: number,
  holesInAllocation = 18,
): number {
  if (handicap === 0 || !Number.isFinite(strokeIndex)) return 0;
  const positive = handicap > 0;
  const H = Math.abs(handicap);
  const base = Math.floor(H / holesInAllocation);
  const remainder = H % holesInAllocation;
  const extra = positive
    ? strokeIndex <= remainder
      ? 1
      : 0
    : strokeIndex > holesInAllocation - remainder
      ? 1
      : 0;
  const strokes = base + extra;
  if (strokes === 0) return 0; // avoid -0 for plus handicaps with no stroke
  return positive ? strokes : -strokes;
}

export interface HoleStrokeIndex {
  number: number;
  strokeIndex: number | null;
}

/** Hole numbers whose stroke index is unknown (null). Use this to gate
 *  allocation and drive the confirm-stroke-index / manual-entry step. */
export function holesMissingStrokeIndex(holes: HoleStrokeIndex[]): number[] {
  return holes.filter((h) => h.strokeIndex == null).map((h) => h.number);
}

/**
 * Allocate strokes across holes → Map(holeNumber → strokes). Stroke indexes are
 * course data finalized at setup, so allocation requires them ALL: if any hole's
 * SI is null this THROWS (naming the gap) rather than silently mis-/under-
 * allocating. Call `holesMissingStrokeIndex()` first to gate the UI.
 */
export function allocateStrokes(
  handicap: number,
  holes: HoleStrokeIndex[],
  holesInAllocation = 18,
): Map<number, number> {
  const missing = holesMissingStrokeIndex(holes);
  if (missing.length > 0) {
    throw new Error(
      `Cannot allocate strokes: stroke index missing for hole(s) ${missing.join(
        ", ",
      )}. Confirm or enter stroke indexes before scoring.`,
    );
  }
  const out = new Map<number, number>();
  for (const h of holes) {
    out.set(
      h.number,
      strokesOnHole(handicap, h.strokeIndex as number, holesInAllocation),
    );
  }
  return out;
}

/** Net hole score = gross − strokes received. Null gross (pick-up) → null. */
export function netScore(
  gross: number | null,
  strokesReceived: number,
): number | null {
  if (gross == null) return null;
  return gross - strokesReceived;
}

// ── Field-level convenience ───────────────────────────────────────────────────
export interface PlayerHandicapInput {
  id: string;
  handicapIndex: number;
  /** per-game format allowance (default 1.0). */
  allowance?: number;
}
export interface RoundCourseInput {
  slope: number;
  courseRating: number;
  par: number;
}
export interface PlayerHandicapResult {
  id: string;
  courseHandicap: number;
  playingHandicap: number;
  /** Allocation handicap after the round's allowance mode (what drives strokes). */
  strokesGiven: number;
}

/**
 * Compute course + playing + allocation handicaps for a whole field, applying
 * the round-level allowance mode. `strokesGiven` is what `allocateStrokes` uses.
 */
export function computeRoundHandicaps(
  players: PlayerHandicapInput[],
  course: RoundCourseInput,
  mode: AllowanceMode,
): PlayerHandicapResult[] {
  const playing = players.map((p) =>
    playingHandicap(
      courseHandicap({
        handicapIndex: p.handicapIndex,
        slope: course.slope,
        courseRating: course.courseRating,
        par: course.par,
      }),
      p.allowance ?? 1,
    ),
  );
  const given = applyAllowanceMode(playing, mode);
  return players.map((p, i) => ({
    id: p.id,
    courseHandicap: courseHandicap({
      handicapIndex: p.handicapIndex,
      slope: course.slope,
      courseRating: course.courseRating,
      par: course.par,
    }),
    playingHandicap: playing[i],
    strokesGiven: given[i],
  }));
}
