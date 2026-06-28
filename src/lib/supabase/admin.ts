import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role Supabase client — BYPASSES RLS. Server-only (the `server-only`
 * import makes bundling into the client a build error). Reserved for trusted
 * server tasks like caching fetched course data into the DB (Phase 1).
 * Never expose to the browser; never use for user-scoped reads/writes.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createSupabaseClient<Database>(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
