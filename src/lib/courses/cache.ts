import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getCourseProvider } from "./provider";
import type { NormalizedCourse, NormalizedTee } from "./types";

// Cache-on-first-use: the first time a course is needed, fetch it via the
// provider and PERSIST into Supabase (courses / tee_sets / holes). All play
// then reads from our DB (offline + API-cost control). Writes go through the
// caller's AUTHENTICATED client — the `courses`/`tee_sets`/`holes` RLS allows
// authenticated writes, so no service-role/RLS-bypass is needed (least
// privilege). Stroke index may be null when the provider lacks it — confirmed
// or entered later at setup.

type Db = SupabaseClient<Database>;

export interface CachedHole {
  number: number;
  par: number;
  strokeIndex: number | null;
  yardage: number | null;
}
export interface CachedTee {
  id: string;
  name: string;
  gender: string | null;
  rating: number | null;
  slope: number | null;
  par: number | null;
  holes: CachedHole[];
}
export interface CachedCourse {
  id: string;
  provider: string;
  externalId: string | null;
  name: string;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  tees: CachedTee[];
  /** True if any tee is missing a complete stroke index (needs confirm/manual). */
  needsStrokeIndex: boolean;
}

function teesNeedStrokeIndex(tees: { holes: CachedHole[] }[]): boolean {
  return tees.some(
    (t) => t.holes.length === 0 || t.holes.some((h) => h.strokeIndex == null),
  );
}

/** Assemble the cached representation of a course row from the DB. */
async function readCachedCourse(
  db: Db,
  courseId: string,
): Promise<CachedCourse | null> {
  const { data: course } = await db
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();
  if (!course) return null;

  const { data: teeRows } = await db
    .from("tee_sets")
    .select("*")
    .eq("course_id", courseId);

  const tees: CachedTee[] = [];
  for (const tee of teeRows ?? []) {
    const { data: holeRows } = await db
      .from("holes")
      .select("number, par, stroke_index, yardage")
      .eq("tee_set_id", tee.id)
      .order("number");
    tees.push({
      id: tee.id,
      name: tee.name,
      gender: tee.gender,
      rating: tee.rating,
      slope: tee.slope,
      par: tee.par,
      holes: (holeRows ?? []).map((h) => ({
        number: h.number,
        par: h.par,
        strokeIndex: h.stroke_index,
        yardage: h.yardage,
      })),
    });
  }

  return {
    id: course.id,
    provider: course.provider,
    externalId: course.external_id,
    name: course.name,
    location: course.location,
    city: course.city,
    state: course.state,
    country: course.country,
    lat: course.lat,
    lng: course.lng,
    tees,
    needsStrokeIndex: teesNeedStrokeIndex(tees),
  };
}

/** Persist a normalized course (course + tees + holes) and return the cached form. */
async function insertCourse(
  db: Db,
  norm: NormalizedCourse,
): Promise<CachedCourse> {
  const { data: course, error } = await db
    .from("courses")
    .insert({
      provider: norm.provider,
      external_id: norm.providerId,
      name: norm.name,
      location: norm.location ?? null,
      city: norm.city ?? null,
      state: norm.state ?? null,
      country: norm.country ?? null,
      lat: norm.lat ?? null,
      lng: norm.lng ?? null,
    })
    .select()
    .single();
  if (error || !course) {
    throw new Error(`Failed to cache course: ${error?.message}`);
  }

  for (const tee of norm.tees) {
    const { data: teeRow, error: teeErr } = await db
      .from("tee_sets")
      .insert({
        course_id: course.id,
        name: tee.name,
        gender: tee.gender,
        rating: tee.rating,
        slope: tee.slope,
        par: tee.par,
      })
      .select()
      .single();
    if (teeErr || !teeRow) {
      throw new Error(`Failed to cache tee set: ${teeErr?.message}`);
    }
    if (tee.holes.length) {
      const { error: holeErr } = await db.from("holes").insert(
        tee.holes.map((h) => ({
          tee_set_id: teeRow.id,
          number: h.number,
          par: h.par,
          stroke_index: h.strokeIndex,
          yardage: h.yardage,
        })),
      );
      if (holeErr) throw new Error(`Failed to cache holes: ${holeErr.message}`);
    }
  }

  const cached = await readCachedCourse(db, course.id);
  if (!cached) throw new Error("Failed to read back cached course");
  return cached;
}

/**
 * Return a course from cache, fetching+persisting via the provider on first use.
 * `providerId` is the provider's external id; `provider` defaults to the active one.
 */
export async function getOrCacheCourse(
  db: Db,
  providerId: string,
  provider?: string,
): Promise<CachedCourse> {
  const providerName = provider ?? getCourseProvider().name;

  const { data: existing } = await db
    .from("courses")
    .select("id")
    .eq("provider", providerName)
    .eq("external_id", providerId)
    .maybeSingle();

  if (existing) {
    const cached = await readCachedCourse(db, existing.id);
    if (cached) return cached;
  }

  const norm = await getCourseProvider().getCourse(providerId);
  return insertCourse(db, norm);
}

function haversineMiles(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * "Near me" reads from the cache: cached courses with coordinates, sorted by
 * distance. (GolfCourseAPI search is name-only, so geo is a cache concern.)
 */
export async function searchNearbyCachedCourses(
  db: Db,
  lat: number,
  lng: number,
  limit = 10,
): Promise<Array<{ id: string; name: string; city: string | null; state: string | null; distanceMiles: number }>> {
  const { data } = await db
    .from("courses")
    .select("id, name, city, state, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null);
  return (data ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      state: c.state,
      distanceMiles: haversineMiles(lat, lng, c.lat as number, c.lng as number),
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit);
}

/**
 * Manual add/edit fallback for missing/wrong data, saved to our DB
 * (provider = "manual"). Lets a user create a course + one tee + holes by hand.
 */
export async function createManualCourse(
  db: Db,
  input: {
    name: string;
    location?: string;
    city?: string;
    state?: string;
    createdBy?: string;
    tee: {
      name: string;
      rating?: number | null;
      slope?: number | null;
      par?: number | null;
      holes: CachedHole[];
    };
  },
): Promise<CachedCourse> {
  const norm: NormalizedCourse = {
    provider: "manual",
    providerId: `manual-${input.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: input.name,
    location: input.location ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    country: null,
    lat: null,
    lng: null,
    tees: [
      {
        name: input.tee.name,
        gender: null,
        rating: input.tee.rating ?? null,
        slope: input.tee.slope ?? null,
        par: input.tee.par ?? null,
        holes: input.tee.holes,
      } satisfies NormalizedTee,
    ],
  };
  return insertCourse(db, norm);
}
