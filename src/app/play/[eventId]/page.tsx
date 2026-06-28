"use client";

import { use } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/nav/app-header";
import { AuthGate } from "@/components/auth/auth-gate";
import { SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { useEvent } from "@/lib/queries/events";

// Round home — FIRST CUT (build prompt §8). Confirms the round persisted (players
// with computed handicaps, games, join code) and is the entry to hole-by-hole
// scoring. The single-game hero / multi-game swipe strip and live standings are
// the next Phase 2 steps; "Enter scores" is wired when hole-entry lands.

function RoundHome({ eventId }: { eventId: string }) {
  const { data: round, isLoading } = useEvent(eventId);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-field" />;
  }
  if (!round) {
    return (
      <main className="flex flex-1 flex-col py-10">
        <p className="text-muted">Round not found.</p>
        <Link href="/play" className="mt-3 text-fairway">
          Start a new round
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col pb-10">
      <div className="py-5">
        <p className="eyebrow">{round.date ?? "Today"} · {round.holesToPlay} holes</p>
        <h1 className="font-display mt-0.5 text-3xl font-extrabold uppercase leading-none">
          {round.courseName ?? "Round"}
        </h1>
        {round.teeName && (
          <p className="mt-1 text-sm text-muted">
            {round.teeName} tees · {round.allowanceMode === "relative" ? "Low man scratch" : "Full handicap"}
          </p>
        )}
      </div>

      {round.joinCode && (
        <div className="relative mb-5 flex items-center justify-between overflow-hidden rounded-lg bg-ink p-4 text-white">
          <div>
            <div className="font-label text-[10px] uppercase tracking-[0.16em] opacity-70">
              Join code
            </div>
            <div className="font-display text-3xl font-extrabold tracking-[0.12em]">
              {round.joinCode}
            </div>
          </div>
        </div>
      )}

      <section>
        <SectionHeader title={`Players · ${round.players.length}`} />
        <div className="overflow-hidden rounded-lg border border-line bg-card shadow-card">
          {round.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0"
            >
              <div className="font-bold">{p.displayName}</div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="font-display text-lg font-extrabold leading-none">
                    {p.courseHandicap ?? "—"}
                  </div>
                  <div className="font-label text-[9px] uppercase tracking-[0.1em] text-muted">
                    course
                  </div>
                </div>
                <div>
                  <div className="font-display text-lg font-extrabold leading-none text-fairway">
                    {p.playingHandicap ?? "—"}
                  </div>
                  <div className="font-label text-[9px] uppercase tracking-[0.1em] text-muted">
                    strokes
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <SectionHeader title={`Games · ${round.games.length}`} />
        <div className="overflow-hidden rounded-lg border border-line bg-card shadow-card">
          {round.games.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0"
            >
              <span className="font-display text-lg font-extrabold uppercase">
                {g.type === "match" ? "Match Play" : g.type}
              </span>
              <span className="font-label text-xs uppercase tracking-[0.06em] text-muted">
                {g.stakesEnabled ? `$${g.stake} · ${g.grossOrNet}` : "Social"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8">
        <Button
          disabled
          className="font-label h-auto w-full rounded-xl bg-flare py-4 text-[15px] font-bold uppercase tracking-[0.08em] text-white"
        >
          Enter scores (next)
        </Button>
        <p className="mt-2 text-center text-xs text-muted">
          Hole-by-hole entry lands in the next Phase 2 step.
        </p>
      </div>
    </main>
  );
}

export default function RoundHomePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  return (
    <>
      <AppHeader />
      <AuthGate>
        <RoundHome eventId={eventId} />
      </AuthGate>
    </>
  );
}
