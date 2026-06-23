"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, UserRound } from "lucide-react";
import { AppHeader } from "@/components/nav/app-header";
import { AuthGate } from "@/components/auth/auth-gate";
import { SectionHeader } from "@/components/ui/section";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useUser, isGuest } from "@/lib/auth/use-user";

function YouContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const guest = isGuest(user);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    router.replace("/signin");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 py-5">
        <div className="font-display flex size-14 items-center justify-center rounded-lg bg-fairway text-2xl font-extrabold text-white">
          {guest ? <UserRound className="size-7" aria-hidden /> : (user?.email?.[0] ?? "G").toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-2xl font-extrabold uppercase leading-none">
            {guest ? "Guest" : (user?.email?.split("@")[0] ?? "You")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {guest ? "Playing as a guest" : user?.email}
          </p>
        </div>
      </div>

      <section className="mt-4">
        <SectionHeader title="Settings" />
        <div className="flex items-center justify-between rounded-lg border border-line bg-card p-4 shadow-card">
          <div>
            <span className="text-sm">Theme</span>
            <p className="text-xs text-muted">Auto follows your device</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      {guest && (
        <section className="mt-6">
          <SectionHeader title="Account" />
          <div className="rounded-lg border border-line bg-card p-4 text-sm text-muted shadow-card">
            You&rsquo;re a guest. Adding an email later keeps your rounds, stats,
            and friends across devices. (Account upgrade arrives in a later
            phase.)
          </div>
        </section>
      )}

      <section className="mt-6">
        <SectionHeader title="Session" />
        <button
          type="button"
          onClick={signOut}
          className="font-label flex w-full items-center justify-center gap-2 rounded-md border border-line bg-card px-6 py-3.5 text-sm font-bold uppercase tracking-[0.07em] text-down transition active:translate-y-px"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </section>
    </main>
  );
}

export default function YouPage() {
  return (
    <>
      <AppHeader />
      <AuthGate>
        <YouContent />
      </AuthGate>
    </>
  );
}
