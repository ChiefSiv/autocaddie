// golfapi.io (golfapi.io) — FALLBACK / upgrade provider.
//
// ⚠️ UNVERIFIED: implemented to golfapi.io's documented v2.3 shape but NOT yet
// tested against a live key (their access is contact-sales; we don't have one).
// It conforms to CourseDataProvider so it can be swapped in via
// COURSE_DATA_PROVIDER=golfapi once a key exists. The primary GolfCourseAPI
// path is the tested one. golfapi.io gives per-hole par + stroke index as
// parallel arrays (parsMen[]/indexesMen[]) plus tee boxes for rating/slope —
// a different structure than GolfCourseAPI, normalized here.

import type {
  CourseDataProvider,
  CourseSearchResult,
  NormalizedCourse,
  NormalizedHole,
  NormalizedTee,
} from "../types";

const BASE = "https://www.golfapi.io/api/v2.3";

interface GaiCourseListItem {
  courseID?: string | number;
  clubName?: string;
  courseName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}
interface GaiTeeBox {
  teeColor?: string;
  teeName?: string;
  courseRating?: number;
  slopeRating?: number;
  // some payloads gender-split: courseRatingMen / slopeMen, etc.
  courseRatingMen?: number;
  slopeMen?: number;
  courseRatingWomen?: number;
  slopeWomen?: number;
  parTotal?: number;
  lengths?: number[]; // per-hole yardage, if present
}
interface GaiCourse extends GaiCourseListItem {
  numHoles?: number;
  parsMen?: number[];
  indexesMen?: number[];
  parsWomen?: number[];
  indexesWomen?: number[];
  teeBoxes?: GaiTeeBox[];
}

export function mapGolfApiCourse(raw: GaiCourse): NormalizedCourse {
  const n = raw.numHoles ?? raw.parsMen?.length ?? 18;
  const pars = raw.parsMen ?? raw.parsWomen ?? [];
  const indexes = raw.indexesMen ?? raw.indexesWomen ?? [];

  const tees: NormalizedTee[] = (raw.teeBoxes ?? []).map((tb) => {
    const holes: NormalizedHole[] = Array.from({ length: n }, (_, i) => ({
      number: i + 1,
      par: pars[i] ?? 0,
      strokeIndex: indexes[i] ?? null,
      yardage: tb.lengths?.[i] ?? null,
    }));
    return {
      name: tb.teeName || tb.teeColor || "Tee",
      gender: null,
      rating: tb.courseRating ?? tb.courseRatingMen ?? null,
      slope: tb.slopeRating ?? tb.slopeMen ?? null,
      par:
        tb.parTotal ??
        (pars.length ? pars.reduce((a, b) => a + (b ?? 0), 0) : null),
      holes,
    };
  });

  return {
    provider: "golfapi",
    providerId: String(raw.courseID ?? ""),
    name: raw.clubName || raw.courseName || "Unknown course",
    location: raw.address ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    country: raw.country ?? null,
    lat: raw.latitude ?? null,
    lng: raw.longitude ?? null,
    tees,
  };
}

export class GolfApiIoProvider implements CourseDataProvider {
  readonly name = "golfapi";
  constructor(private readonly apiKey: string) {}

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  async searchCourses(query: string): Promise<CourseSearchResult[]> {
    const url = `${BASE}/courses?name=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`golfapi.io search failed (${res.status})`);
    const data = (await res.json()) as { courses?: GaiCourseListItem[] };
    return (data.courses ?? []).map((c) => ({
      provider: "golfapi",
      providerId: String(c.courseID ?? ""),
      name: c.clubName || c.courseName || "Unknown course",
      location: c.address ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      country: c.country ?? null,
      lat: c.latitude ?? null,
      lng: c.longitude ?? null,
    }));
  }

  async getCourse(providerId: string): Promise<NormalizedCourse> {
    const url = `${BASE}/courses/${encodeURIComponent(providerId)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`golfapi.io getCourse failed (${res.status})`);
    const data = (await res.json()) as GaiCourse | { course?: GaiCourse };
    const course = "course" in data && data.course ? data.course : (data as GaiCourse);
    return mapGolfApiCourse(course);
  }
}
