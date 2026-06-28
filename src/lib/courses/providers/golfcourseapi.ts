// GolfCourseAPI (golfcourseapi.com) — PRIMARY provider.
// Verified live shape (api.golfcourseapi.com):
//   Auth:   Authorization: Key <COURSE_API_KEY>
//   Search: GET /v1/search?search_query=<q>   -> { courses: [...] } (holes trimmed)
//   Course: GET /v1/courses/<id>              -> { course: {...} }  (full tees+holes)
//   Course: { id, club_name, course_name, location:{address,city,state,country,
//             latitude,longitude}, tees:{ male:[Tee], female:[Tee] } }
//   Tee:    { tee_name, course_rating, slope_rating, par_total, total_yards,
//             number_of_holes, holes:[{ par, yardage, handicap? }] }
// IMPORTANT: per-hole `handicap` (stroke index) is FREQUENTLY ABSENT (e.g.
// Graywolf 7028 has none on any tee). We map it to null and rely on the
// confirm-stroke-index / manual-entry step. Search is near-exact (a token like
// "Graywolf" matches; "Gray Wolf" / "Graywolf Golf" do not).

import type {
  CourseDataProvider,
  CourseSearchResult,
  NormalizedCourse,
  NormalizedHole,
  NormalizedTee,
} from "../types";

const BASE = "https://api.golfcourseapi.com";

// ── Raw provider shapes (only the fields we read) ────────────────────────────
interface GcaLocation {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}
interface GcaHole {
  par?: number;
  yardage?: number;
  handicap?: number; // stroke index — often missing
}
interface GcaTee {
  tee_name?: string;
  course_rating?: number;
  slope_rating?: number;
  par_total?: number;
  total_yards?: number;
  number_of_holes?: number;
  holes?: GcaHole[];
}
interface GcaCourse {
  id: number;
  club_name?: string;
  course_name?: string;
  location?: GcaLocation;
  tees?: { male?: GcaTee[]; female?: GcaTee[] };
}

// ── Pure mappers (unit-tested against saved fixtures) ────────────────────────
function mapTee(raw: GcaTee, gender: "male" | "female"): NormalizedTee {
  const holes: NormalizedHole[] = (raw.holes ?? []).map((h, i) => ({
    number: i + 1,
    par: h.par ?? 0,
    strokeIndex: h.handicap ?? null, // missing handicap → null (confirm at setup)
    yardage: h.yardage ?? null,
  }));
  return {
    name: raw.tee_name ?? "Tee",
    gender,
    rating: raw.course_rating ?? null,
    slope: raw.slope_rating ?? null,
    par: raw.par_total ?? null,
    holes,
  };
}

export function mapCourse(raw: GcaCourse): NormalizedCourse {
  const tees: NormalizedTee[] = [
    ...(raw.tees?.male ?? []).map((t) => mapTee(t, "male")),
    ...(raw.tees?.female ?? []).map((t) => mapTee(t, "female")),
  ];
  return {
    provider: "golfcourseapi",
    providerId: String(raw.id),
    name: raw.club_name || raw.course_name || "Unknown course",
    location: raw.location?.address ?? null,
    city: raw.location?.city ?? null,
    state: raw.location?.state ?? null,
    country: raw.location?.country ?? null,
    lat: raw.location?.latitude ?? null,
    lng: raw.location?.longitude ?? null,
    tees,
  };
}

export function mapSearchResult(raw: GcaCourse): CourseSearchResult {
  return {
    provider: "golfcourseapi",
    providerId: String(raw.id),
    name: raw.club_name || raw.course_name || "Unknown course",
    location: raw.location?.address ?? null,
    city: raw.location?.city ?? null,
    state: raw.location?.state ?? null,
    country: raw.location?.country ?? null,
    lat: raw.location?.latitude ?? null,
    lng: raw.location?.longitude ?? null,
  };
}

export class GolfCourseApiProvider implements CourseDataProvider {
  readonly name = "golfcourseapi";
  constructor(private readonly apiKey: string) {}

  private headers() {
    return { Authorization: `Key ${this.apiKey}` };
  }

  async searchCourses(query: string): Promise<CourseSearchResult[]> {
    const url = `${BASE}/v1/search?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(`GolfCourseAPI search failed (${res.status})`);
    }
    const data = (await res.json()) as { courses?: GcaCourse[] };
    return (data.courses ?? []).map(mapSearchResult);
  }

  async getCourse(providerId: string): Promise<NormalizedCourse> {
    const url = `${BASE}/v1/courses/${encodeURIComponent(providerId)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(`GolfCourseAPI getCourse failed (${res.status})`);
    }
    const data = (await res.json()) as { course?: GcaCourse };
    if (!data.course) throw new Error("GolfCourseAPI: course not found");
    return mapCourse(data.course);
  }
}
