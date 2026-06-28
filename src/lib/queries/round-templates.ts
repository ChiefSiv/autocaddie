"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";
import { queryKeys } from "./keys";
import type { Tables } from "@/lib/supabase/database.types";

export type RoundTemplate = Tables<"round_templates">;

/** Saved "regular games" for one-tap round creation (Home). */
export function useRoundTemplates() {
  return useQuery({
    queryKey: queryKeys.roundTemplates,
    queryFn: async (): Promise<RoundTemplate[]> => {
      if (!hasSupabaseEnv()) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("round_templates")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    staleTime: 60_000,
  });
}
