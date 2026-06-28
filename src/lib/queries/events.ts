"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";
import { queryKeys } from "./keys";

export interface RecentEvent {
  id: string;
  date: string | null;
  status: string;
  holesToPlay: number;
  courseName: string | null;
}

/** The user's most recent rounds (RLS already scopes to accessible events). */
export function useRecentEvents(limit = 5) {
  return useQuery({
    queryKey: [...queryKeys.recentEvents, limit],
    queryFn: async (): Promise<RecentEvent[]> => {
      if (!hasSupabaseEnv()) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("events")
        .select("id, date, status, holes_to_play, course:courses(name)")
        .order("date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []).map((e) => ({
        id: e.id,
        date: e.date,
        status: e.status,
        holesToPlay: e.holes_to_play,
        courseName: e.course?.name ?? null,
      }));
    },
    staleTime: 30_000,
  });
}
