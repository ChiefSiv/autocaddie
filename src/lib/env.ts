/**
 * Centralized env access. Public vars are inlined by Next at build time.
 * Server-only secrets (service role, course API keys) must NEVER be imported
 * into client components — keep them behind the `server` helpers below.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

/** Safe to use anywhere (browser + server). */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

/** True if a value parses as an http(s) URL. */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Whether Supabase is validly configured. Used so a missing OR malformed
 * `.env.local` degrades gracefully (auth disabled) instead of throwing
 * "Invalid supabaseUrl" on every request. Supabase clients construct only
 * when this is true.
 */
export function hasSupabaseEnv(): boolean {
  return (
    isHttpUrl(publicEnv.supabaseUrl) && publicEnv.supabaseAnonKey.length > 0
  );
}

/**
 * Server-only secrets. Calling this from a client bundle will throw at build
 * (the vars are undefined client-side) — by design.
 */
export function serverEnv() {
  return {
    supabaseUrl: required(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    ),
    supabaseServiceRoleKey: required(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "SUPABASE_SERVICE_ROLE_KEY",
    ),
    courseApiKey: process.env.COURSE_API_KEY ?? "",
    golfApiKey: process.env.GOLFAPI_KEY ?? "",
    courseDataProvider: process.env.COURSE_DATA_PROVIDER ?? "golfcourseapi",
  };
}
