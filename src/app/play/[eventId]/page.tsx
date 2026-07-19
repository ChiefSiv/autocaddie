"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/nav/app-header";
import { AuthGate } from "@/components/auth/auth-gate";
import { SectionHeader } from "@/components/ui/section";
import { useEvent } from "@/lib/queries/events";
import { useUpdateRoundHandicaps } from "@/lib/queries/rounds";
import { useWarmRouteCache } from "@/lib/offline/warm-route";

// Round home — FIRST CUT (build prompt §8). Confirms the round persisted (players
// with computed handicaps, games, join code) and is the entry to hole-by-hole
// scoring. The single-game hero / multi-game swipe strip and live standings are
// the next Phase 2 steps; "Enter scores" is wired when hole-entry lands.

function RoundHome({ eventId }: { eventId: string }) {
  useWarmRouteCache(); // keep the round reachable on an offline reload
  const { data: round, isLoading } = useEvent(eventId);
  const updateHc = useUpdateRoundHandicaps();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

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

  const course = {
    slope: round.teeSlope ?? 113,
    courseRating: round.teeRating ?? round.teePar ?? 72,
    par: round.teePar ?? 72,
  };
  const allowanceMode = round.allowanceMode === "relative" ? "relative" : "full";
  const startEdit = () => {
    setDraft(
      Object.fromEntries(
        round.players.map((p) => [p.id, p.handicapIndex != null ? String(p.handicapIndex) : ""]),
      ),
    );
    setEditing(true);
  };
  const saveEdit = async () => {
    await updateHc.mutateAsync({
      eventId,
      allowanceMode,
      course,
      field: round.players.map((p) => ({
        roundPlayerId: p.id,
        handicapIndex: draft[p.id] == null || draft[p.id] === "" ? null : Number(draft[p.id]),
      })),
    });
    setEditing(false);
  };

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
        <SectionHeader
          title={`Players · ${round.players.length}`}
          action={
            editing ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="font-label text-xs font-semibold uppercase tracking-[0.06em] text-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={updateHc.isPending}
                  className="font-label text-xs font-semibold uppercase tracking-[0.06em] text-fairway disabled:opacity-60"
                >
                  {updateHc.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="font-label text-xs font-semibold uppercase tracking-[0.06em] text-fairway"
              >
                Edit handicaps
              </button>
            )
          }
        />
        <div className="overflow-hidden rounded-lg border border-line bg-card shadow-card">
          {round.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0"
            >
              <div className="font-bold">{p.displayName}</div>
              {editing ? (
                <label className="flex items-center gap-2">
                  <span className="font-label text-[9px] uppercase tracking-[0.1em] text-muted">
                    index
                  </span>
                  <input
                    inputMode="decimal"
                    aria-label={`${p.displayName} handicap index`}
                    value={draft[p.id] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                    className="font-display w-16 rounded-md border border-line bg-field px-2 py-1 text-center text-lg font-extrabold outline-none focus:border-fairway"
                  />
                </label>
              ) : (
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
              )}
            </div>
          ))}
        </div>
        {editing && (
          <p className="mt-2 text-xs text-muted">
            Handicaps stay editable after the lineup locks. This recomputes strokes,
            net scores and live standings.
            {round.status === "completed"
              ? " This round is settled — re-settle to update the ledger."
              : ""}
          </p>
        )}
        {!editing && round.status === "completed" && (
          <p className="mt-2 text-xs text-muted">
            Settled. Editing a handicap or score requires re-settling to update the
            ledger.
          </p>
        )}
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
        <Link
          href={`/play/${eventId}/score`}
          className="font-label block w-full rounded-xl bg-flare py-4 text-center text-[15px] font-bold uppercase tracking-[0.08em] text-white"
        >
          Enter scores
        </Link>
        <p className="mt-2 text-center text-xs text-muted">
          Players &amp; games lock once hole {round.whichNine === "back" ? 10 : 1}{" "}
          is entered; scores and handicaps stay editable.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link
            href={`/play/${eventId}/card`}
            className="rounded-xl border border-line bg-card py-3 text-center font-label text-xs font-semibold uppercase tracking-[0.05em] shadow-card"
          >
            Scorecard
          </Link>
          <Link
            href={`/play/${eventId}/recap`}
            className="rounded-xl border border-line bg-card py-3 text-center font-label text-xs font-semibold uppercase tracking-[0.05em] shadow-card"
          >
            Recap
          </Link>
          <Link
            href={`/play/${eventId}/settle`}
            className="rounded-xl border border-line bg-card py-3 text-center font-label text-xs font-semibold uppercase tracking-[0.05em] shadow-card"
          >
            Settle / end
          </Link>
        </div>
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
