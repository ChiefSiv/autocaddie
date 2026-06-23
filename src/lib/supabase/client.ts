import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/**
 * Browser-side Supabase client. Uses the anon key only — RLS (scoped to each
 * Event, per §6) is what actually protects data. Safe to ship to the client.
 */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
