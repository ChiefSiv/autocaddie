// CourseDataProvider — the pluggable interface all course-data access goes
// through (build prompt §8). Providers swap via config with no rewrite; we ship
// GolfCourseAPI (primary) and golfapi.io (fallback). Everything below the
// provider works on these NORMALIZED shapes, not provider-specific JSON.

/** A lightweight search hit (no holes — fetch the full course to cache it). */
export interface CourseSearchResult {
  provider: string;
  /** Provider's course id, stringified. */
  providerId: string;
  name: string;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface NormalizedHole {
  number: number; // 1..18
  par: number;
  /** Stroke index (SI 1 = hardest). Often MISSING from provider data → null;
   *  the setup flow confirms / lets you enter it manually. */
  strokeIndex: number | null;
  yardage: number | null;
}

export interface NormalizedTee {
  name: string;
  gender: "male" | "female" | null;
  rating: number | null; // course rating
  slope: number | null;
  par: number | null;
  holes: NormalizedHole[];
}

export interface NormalizedCourse {
  provider: string;
  providerId: string;
  name: string;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  tees: NormalizedTee[];
}

export interface CourseDataProvider {
  /** Stable id stored on cached rows (e.g. "golfcourseapi"). */
  readonly name: string;
  /** Search by name/club. NOTE: providers vary — GolfCourseAPI is near-exact. */
  searchCourses(query: string): Promise<CourseSearchResult[]>;
  /** Fetch one full course (tees + holes) for caching. */
  getCourse(providerId: string): Promise<NormalizedCourse>;
}

/** True when a tee has a usable stroke index on every hole (drives the
 *  confirm-stroke-index affordance and net scoring readiness). */
export function teeHasFullStrokeIndex(tee: NormalizedTee): boolean {
  return (
    tee.holes.length > 0 && tee.holes.every((h) => h.strokeIndex != null)
  );
}
