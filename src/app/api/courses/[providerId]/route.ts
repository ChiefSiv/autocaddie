import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCacheCourse } from "@/lib/courses/cache";

// GET /api/courses/<providerId>[?provider=golfcourseapi]
// Fetch-and-cache a full course (tees + holes) on first use; thereafter reads
// from our DB. Returns the cached representation incl. `needsStrokeIndex`.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { providerId } = await params;
  const provider = req.nextUrl.searchParams.get("provider") ?? undefined;

  try {
    // Cache writes go through the authenticated client (RLS allows it).
    const course = await getOrCacheCourse(supabase, providerId, provider);
    return NextResponse.json({ course });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
