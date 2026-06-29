"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";

const USER_KEY = ["auth", "user"] as const;

/** True when the session is an anonymous (guest) user. */
export function isGuest(user: User | null | undefined): boolean {
  return Boolean(user?.is_anonymous);
}

/**
 * Current auth user, kept live via Supabase's onAuthStateChange. Returns null
 * when signed out. Guests (anonymous) and accounts both resolve to a User.
 */
export function useUser() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: USER_KEY,
    queryFn: async (): Promise<User | null> => {
      // Degrade gracefully before Supabase is configured (treated as signed out).
      if (!hasSupabaseEnv()) return null;
      const supabase = createClient();
      // getUser() validates against the server (network). Offline that fails —
      // fall back to the LOCALLY persisted session (getSession reads storage, no
      // network) so an in-progress round reloaded offline stays authenticated and
      // AuthGate doesn't bounce to /signin. Online behavior is unchanged.
      const { data, error } = await supabase.auth.getUser();
      if (data.user) return data.user;
      if (error) {
        const { data: s } = await supabase.auth.getSession();
        if (s.session?.user) return s.session.user;
      }
      return data.user ?? null;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(USER_KEY, session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return query;
}
