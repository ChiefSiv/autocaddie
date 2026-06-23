"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/auth/use-user";

/**
 * Ensures there's a session (guest or account) before rendering app content.
 * Nothing gates *playing* — a guest tap creates an anonymous session on the
 * sign-in screen — so this just routes unauthenticated visitors there.
 * Shows skeleton placeholders (not spinners) while resolving.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/signin");
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex flex-1 flex-col gap-4 py-8" aria-hidden>
        <div className="h-12 w-2/3 animate-pulse rounded-md bg-field" />
        <div className="h-28 animate-pulse rounded-xl bg-field" />
        <div className="h-20 animate-pulse rounded-lg bg-field" />
        <div className="h-20 animate-pulse rounded-lg bg-field" />
      </div>
    );
  }

  return <>{children}</>;
}
