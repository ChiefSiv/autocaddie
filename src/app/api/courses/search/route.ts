import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCourseProvider } from "@/lib/courses/provider";

// GET /api/courses/search?q=<name>
// Provider search runs server-side so COURSE_API_KEY never reaches the client.
// NOTE: GolfCourseAPI is near-exact ("Graywolf" hits; "Gray Wolf" does not) —
// the search UI should hint at this and offer manual add as a fallback.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const results = await getCourseProvider().searchCourses(q);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
