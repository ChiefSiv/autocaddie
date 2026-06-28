"use client";

import Link from "next/link";
import { Radio, Repeat2, Flag, ChevronRight } from "lucide-react";
import { AuthGate } from "@/components/auth/auth-gate";
import { AppHeader } from "@/components/nav/app-header";
import { SectionHeader } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/lib/auth/use-user";
import { greeting } from "@/lib/time";
import { useProfile } from "@/lib/queries/profiles";
import { useRoundTemplates } from "@/lib/queries/round-templates";
import { useRecentEvents } from "@/lib/queries/events";

function displayName(
  profileName: string | null | undefined,
  email: string | undefined,
): string {
  if (profileName) return profileName;
  if (email) return email.split("@")[0];
  return "Golfer";
}

function statusLabel(status: string): string {
  return { setup: "In setup", active: "In progress", completed: "Final", archived: "Archived" }[status] ?? status;
}

function HomeContent() {
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { data: templates, isLoading: templatesLoading } = useRoundTemplates();
  const { data: recent, isLoading: recentLoading } = useRecentEvents(1);

  const name = displayName(profile?.display_name, user?.email);
  const initial = name.charAt(0).toUpperCase();
  const index = profile?.handicap_index;
  const lastRound = recent?.[0];

  return (
    <main className="flex flex-1 flex-col">
      {/* Greeting + handicap index (tap to edit in You → Settings) */}
      <div className="flex items-center justify-between py-5">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1 className="font-display mt-0.5 text-3xl font-extrabold uppercase leading-none">
            {name}
          </h1>
        </div>
        <Link href="/you" className="flex items-center gap-2.5" aria-label="Your profile and handicap">
          <div className="text-right">
            <div className="font-display text-2xl font-extrabold leading-none">
              {index != null ? index.toFixed(1) : "—"}
            </div>
            <div className="font-label text-[9px] uppercase tracking-[0.12em] text-muted">
              index
            </div>
          </div>
          <div className="font-display flex size-[42px] items-center justify-center rounded-md bg-fairway text-lg font-extrabold text-white">
            {initial}
          </div>
        </Link>
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

      {/* On the course now — live data lands in Phase 3 */}
      <section className="mt-6">
        <SectionHeader title="On the course now" />
        <EmptyState icon={<Radio className="size-6" aria-hidden />}>
          No one&rsquo;s out right now — start a round and your crew can follow
          along.
        </EmptyState>
      </section>

      {/* Regular games — one-tap re-creates a saved setup */}
      <section className="mt-6">
        <SectionHeader title="Your regular games" />
        {templatesLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-field" aria-hidden />
        ) : templates && templates.length > 0 ? (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {templates.map((t) => (
              <Link
                key={t.id}
                href={`/play?template=${t.id}`}
                className="min-w-[170px] flex-none rounded-lg border border-line bg-card p-3.5 shadow-card"
              >
                <div className="font-display text-lg font-extrabold uppercase">
                  {t.name}
                </div>
                <div className="font-label mt-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-flare">
                  ▶ Start this
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Repeat2 className="size-6" aria-hidden />}>
            Play a round and save it as a regular to start it again in one tap.
          </EmptyState>
        )}
      </section>

      {/* Last round */}
      <section className="mt-6">
        <SectionHeader title="Last round" />
        {recentLoading ? (
          <div className="h-20 animate-pulse rounded-lg bg-field" aria-hidden />
        ) : lastRound ? (
          <Link
            href={`/play`}
            className="flex items-center justify-between rounded-lg border border-line bg-card p-4 shadow-card"
          >
            <div>
              <div className="font-display text-lg font-extrabold uppercase">
                {lastRound.courseName ?? "Round"}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {lastRound.date ?? ""} · {lastRound.holesToPlay} holes ·{" "}
                {statusLabel(lastRound.status)}
              </div>
            </div>
            <ChevronRight className="size-5 text-muted" aria-hidden />
          </Link>
        ) : (
          <EmptyState icon={<Flag className="size-6" aria-hidden />}>
            No rounds yet — start your first.
          </EmptyState>
        )}
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
