"use client";

import Link from "next/link";
import { Radio, Repeat2, Flag } from "lucide-react";
import { AuthGate } from "@/components/auth/auth-gate";
import { AppHeader } from "@/components/nav/app-header";
import { SectionHeader } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser, isGuest } from "@/lib/auth/use-user";
import { greeting } from "@/lib/time";

function displayName(email: string | undefined, guest: boolean): string {
  if (guest) return "Golfer";
  if (email) return email.split("@")[0];
  return "Golfer";
}

function HomeContent() {
  const { data: user } = useUser();
  const guest = isGuest(user);
  const name = displayName(user?.email, guest);
  const initial = name.charAt(0).toUpperCase();

  return (
    <main className="flex flex-1 flex-col">
      {/* Greeting + handicap (Phase 1 wires the real index/trend) */}
      <div className="flex items-center justify-between py-5">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1 className="font-display mt-0.5 text-3xl font-extrabold uppercase leading-none">
            {name}
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <div className="font-display text-2xl font-extrabold leading-none text-muted">
              —
            </div>
            <div className="font-label text-[9px] uppercase tracking-[0.12em] text-muted">
              index
            </div>
          </div>
          <div className="font-display flex size-[42px] items-center justify-center rounded-md bg-fairway text-lg font-extrabold text-white">
            {initial}
          </div>
        </div>
      </div>

      {/* Primary actions */}
      <div className="flex gap-2.5">
        <Link
          href="/play"
          className="relative flex-1 overflow-hidden rounded-xl bg-flare p-5 text-white"
        >
          <span className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.35),transparent_70%)]" />
          <span className="font-label relative block text-[10px] uppercase tracking-[0.14em] opacity-85">
            New
          </span>
          <span className="font-display relative mt-1 block text-2xl font-extrabold uppercase leading-none">
            Start a
            <br />
            round
          </span>
        </Link>
        <Link
          href="/play?join=1"
          className="flex flex-[0_0_110px] flex-col rounded-xl border border-line bg-card p-5 shadow-card"
        >
          <span className="font-label text-[10px] uppercase tracking-[0.14em] text-muted">
            Have a code?
          </span>
          <span className="font-display mt-1 text-2xl font-extrabold uppercase leading-none">
            Join
          </span>
        </Link>
      </div>

      {/* On the course now — empty-stated until live data lands (Phase 3) */}
      <section className="mt-6">
        <SectionHeader title="On the course now" />
        <EmptyState icon={<Radio className="size-6" aria-hidden />}>
          No one&rsquo;s out right now — start a round and your crew can follow
          along.
        </EmptyState>
      </section>

      {/* Regular games — one-tap re-creates a saved setup (Phase 1+) */}
      <section className="mt-6">
        <SectionHeader title="Your regular games" />
        <EmptyState icon={<Repeat2 className="size-6" aria-hidden />}>
          Play a round and save it as a regular to start it again in one tap.
        </EmptyState>
      </section>

      {/* Last round */}
      <section className="mt-6">
        <SectionHeader title="Last round" />
        <EmptyState icon={<Flag className="size-6" aria-hidden />}>
          No rounds yet — start your first.
        </EmptyState>
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <>
      <AppHeader />
      <AuthGate>
        <HomeContent />
      </AuthGate>
    </>
  );
}
