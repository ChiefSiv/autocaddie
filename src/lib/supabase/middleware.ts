import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, hasSupabaseEnv } from "@/lib/env";

/**
 * Refreshes the Supabase auth session on every request and writes the rotated
 * cookies back onto the response. Phase 0 does not gate any route — guests and
 * accounts can both reach everything — so this only keeps the session alive.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // If Supabase isn't configured (or the URL is malformed), skip silently so a
  // missing/incomplete .env.local doesn't 500 every request. Auth turns on once
  // a valid NEXT_PUBLIC_SUPABASE_URL + anon key are present.
  if (!hasSupabaseEnv()) {
    return response;
  }

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the user to trigger a token refresh when needed. Best-effort: a
  // transient outbound failure (e.g. network/TLS) must not 500 the page — the
  // request proceeds with the existing cookies. (Runtime trusts the OS CA via
  // `--use-system-ca` in the start script; see KNOWN_ISSUES.)
  try {
    await supabase.auth.getUser();
  } catch {
    /* keep serving — session just isn't refreshed this request */
  }

  return response;
}
