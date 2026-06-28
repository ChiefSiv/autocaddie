import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Browser-side Supabase client. Uses the anon key only — RLS (event-scoped and
 * crew-scoped, per CONTEXT.md) is what actually protects data. Safe to ship.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
  );
}
