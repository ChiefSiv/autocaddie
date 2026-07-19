import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the magic-link / OAuth / recovery `code` for a session, then
 * redirects. Password-recovery links carry `type=recovery` (and we also set
 * `next=/auth/reset-password` when sending them) → route to the set-password
 * page, NOT home, so the user can choose a new password on the recovery session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next =
    type === "recovery"
      ? "/auth/reset-password"
      : (searchParams.get("next") ?? "/");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=auth`);
}
