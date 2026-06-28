import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchNearbyCachedCourses } from "@/lib/courses/cache";

// GET /api/courses/nearby?lat=<>&lng=<>
// "Near me" reads from the cache (courses with coordinates, sorted by distance).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 },
    );
  }

  const results = await searchNearbyCachedCourses(supabase, lat, lng);
  return NextResponse.json({ results });
}
