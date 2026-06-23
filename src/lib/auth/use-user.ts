"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

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
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
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
