"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";
import { queryKeys } from "./keys";
import type { Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;

/** The current user's profile row (handicap index, display name, …). */
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async (): Promise<Profile | null> => {
      if (!hasSupabaseEnv()) return null;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });
}

/** Update the current user's profile (e.g. set handicap index — the onboarding
 *  "one useful question" whose payoff is the strokes you'll get). */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: Partial<Pick<Profile, "display_name" | "handicap_index">>,
    ): Promise<Profile> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile, profile);
    },
  });
}
