"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Minus, Plus, Undo2, Lock, Cloud, CloudOff } from "lucide-react";
import { AppHeader } from "@/components/nav/app-header";
import { AuthGate } from "@/components/auth/auth-gate";
import { useUser } from "@/lib/auth/use-user";
import { useEvent } from "@/lib/queries/events";
import { useRoundScores } from "@/lib/queries/scores";
import {
  deriveScoring,
  holesInPlayNumbers,
  scoreKey,
  type ScoringHole,
  type ScoringPlayer,
  type GrossMap,
} from "@/lib/games/scoring";
import { netScore } from "@/lib/handicap/engine";
import { liveStandings, type LiveGameConfig } from "@/lib/games/live";

function ScoreContent({ eventId }: { eventId: string }) {
  const { data: user } = useUser();
  const { data: round, isLoading } = useEvent(eventId);
  const { scores, setScore, ready, syncing, pendingCount } = useRoundScores(
    round?.groupId ?? null,
    user?.id ?? "",
  );
  const [holeChoice, setHoleChoice] = useState<number | null>(null);
  // Persist the active hole so reopening (screen sleep, reload) returns to it.
  const holeStorageKey = `autocaddie:hole:${eventId}`;
  useEffect(() => {
    let active = true;
    void (async () => {
      if (typeof window === "undefined") return;
      const saved = window.localStorage.getItem(holeStorageKey);
      const n = saved == null ? NaN : Number(saved);
      if (active && Number.isInteger(n)) setHoleChoice(n);
    })();
    return () => {
      active = false;
    };
  }, [holeStorageKey]);
  const goToHole = (n: number) => {
    setHoleChoice(n);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(holeStorageKey, String(n));
    }
  };

  // ── Derived round shapes (hooks must run before any early return) ──────────
  const holeNumbers = useMemo(
    () =>
      round
        ? holesInPlayNumbers(
            round.holesToPlay === 9 ? 9 : 18,
            (round.whichNine as "front" | "back" | null) ?? null,
          )
        : [],
    [round],
  );

  const holesInPlay: ScoringHole[] = useMemo(() => {
    if (!round) return [];
    const byNum = new Map(round.holes.map((h) => [h.number, h]));
    return holeNumbers.map((n) => {
      const h = byNum.get(n);
      return { number: n, par: h?.par ?? 4, strokeIndex: h?.strokeIndex ?? 0 };
    });
  }, [round, holeNumbers]);

  const siComplete = holesInPlay.length > 0 && holesInPlay.every((h) => h.strokeIndex > 0);

  const players: ScoringPlayer[] = useMemo(
    () =>
      (round?.players ?? []).map((p) => ({
        roundPlayerId: p.id,
        playingHandicap: p.playingHandicap ?? 0,
      })),
    [round],
  );

  const grossMap: GrossMap = useMemo(() => {
    const m: GrossMap = {};
    for (const [k, v] of Object.entries(scores)) m[k] = v.strokes;
    return m;
  }, [scores]);

  const derived = useMemo(() => {
    if (!siComplete || players.length === 0) return null;
    try {
      return deriveScoring(players, holesInPlay, grossMap);
    } catch {
      return null;
    }
  }, [siComplete, players, holesInPlay, grossMap]);

  const gameConfigs: LiveGameConfig[] = useMemo(
    () =>
      (round?.games ?? []).map((g) => {
        const cfg = g.config as { sides?: { a?: string; b?: string }; carryover?: boolean };
        return {
          id: g.id,
          type: g.type as "skins" | "nassau" | "match",
          stakesEnabled: g.stakesEnabled,
          stake: g.stake,
          carryover: cfg?.carryover,
          sides: cfg?.sides
            ? { a: String(cfg.sides.a ?? ""), b: String(cfg.sides.b ?? "") }
            : undefined,
        };
      }),
    [round],
  );

  const standings = useMemo(() => {
    if (!derived || !round) return [];
    return liveStandings(
      gameConfigs,
      players.map((p) => p.roundPlayerId),
      derived.completeHoleNets,
      round.holesToPlay === 9 ? 9 : 18,
    );
  }, [derived, round, gameConfigs, players]);

  const nameById = useMemo(
    () => new Map((round?.players ?? []).map((p) => [p.id, p.displayName])),
    [round],
  );

  // Lock: once the round's FIRST hole has any entry, the lineup is fixed.
  const firstHole = holeNumbers[0];
  const roundLocked = useMemo(
    () =>
      firstHole != null &&
      players.some((p) => grossMap[scoreKey(p.roundPlayerId, firstHole)] !== undefined),
    [players, grossMap, firstHole],
  );

  if (isLoading || !ready) {
    return <div className="h-48 animate-pulse rounded-lg bg-field" />;
  }
  if (!round) {
    return (
      <main className="py-10">
        <p className="text-muted">Round not found.</p>
        <Link href="/play" className="mt-3 text-fairway">Start a new round</Link>
      </main>
    );
  }
  if (!siComplete) {
    return (
      <main className="py-10">
        <p className="text-down">
          This tee is missing stroke indexes — finish the stroke-index step in setup
          before scoring.
        </p>
      </main>
    );
  }

  // Fall back to the first hole if the saved/selected hole isn't in play.
  const currentHole =
    holeChoice != null && holeNumbers.includes(holeChoice)
      ? holeChoice
      : holeNumbers[0];
  const holeMeta = holesInPlay.find((h) => h.number === currentHole)!;
  const idx = holeNumbers.indexOf(currentHole);
  const goPrev = () => goToHole(holeNumbers[Math.max(0, idx - 1)]);
  const goNext = () => goToHole(holeNumbers[Math.min(holeNumbers.length - 1, idx + 1)]);

  return (
    <main className="flex flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Hole header + navigation */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={idx === 0}
            aria-label="Previous hole"
            className="flex size-10 items-center justify-center rounded-lg border border-line bg-card disabled:opacity-40"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="text-center">
            <div className="font-display text-2xl font-extrabold uppercase leading-none">
              Hole {currentHole}
            </div>
            <div className="font-label mt-0.5 text-[11px] uppercase tracking-[0.08em] text-muted">
              Par {holeMeta.par} · SI {holeMeta.strokeIndex}
              {derived ? ` · thru ${derived.completeHoles.length}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={idx === holeNumbers.length - 1}
            aria-label="Next hole"
            className="flex size-10 items-center justify-center rounded-lg border border-line bg-card disabled:opacity-40"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-3 text-[10px] text-muted">
          {roundLocked && (
            <span className="font-label flex items-center gap-1 uppercase tracking-[0.08em]">
              <Lock className="size-3" /> Lineup locked
            </span>
          )}
          <span className="flex items-center gap-1">
            {syncing ? (
              <Cloud className="size-3 animate-pulse" />
            ) : pendingCount > 0 ? (
              <CloudOff className="size-3" />
            ) : (
              <Cloud className="size-3" />
            )}
            {pendingCount > 0 ? `${pendingCount} unsynced` : "saved"}
          </span>
        </div>
      </div>

      {/* Players — gross entry for this hole */}
      <div className="mt-4 flex flex-col gap-3">
        {round.players.map((p) => {
          const key = scoreKey(p.id, currentHole);
          const entry = scores[key]?.strokes; // number | null | undefined
          const isPickup = key in scores && entry === null;
          const recv = derived?.strokesByPlayer[p.id]?.get(currentHole) ?? 0;
          const net = entry == null ? null : netScore(entry, recv);

          const dec = () => {
            const cur = typeof entry === "number" ? entry : holeMeta.par;
            setScore(p.id, currentHole, Math.max(1, cur - 1));
          };
          const inc = () => {
            const cur = typeof entry === "number" ? entry : holeMeta.par - 1;
            setScore(p.id, currentHole, cur + 1);
          };

          return (
            <div
              key={p.id}
              className="rounded-xl border border-line bg-card p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">{p.displayName}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {recv > 0 ? (
                      <>
                        {Array.from({ length: recv }).map((_, i) => (
                          <span key={i} className="size-2 rounded-full bg-flare" aria-hidden />
                        ))}
                        <span className="font-label ml-1 text-[10px] uppercase tracking-[0.08em] text-muted">
                          {recv} stroke{recv > 1 ? "s" : ""}
                        </span>
                      </>
                    ) : (
                      <span className="font-label text-[10px] uppercase tracking-[0.08em] text-muted">
                        no stroke
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={dec}
                    aria-label={`Lower ${p.displayName}'s score`}
                    disabled={isPickup}
                    className="flex size-12 items-center justify-center rounded-xl border border-line bg-field text-xl disabled:opacity-40"
                  >
                    <Minus className="size-5" />
                  </button>
                  <div className="min-w-[64px] text-center">
                    <div className="font-display text-5xl font-extrabold leading-none tabular-nums">
                      {isPickup ? "—" : typeof entry === "number" ? entry : "·"}
                    </div>
                    <div className="font-label mt-1 text-[10px] uppercase tracking-[0.08em] text-muted">
                      {isPickup ? "picked up" : net != null ? <>net <b className="text-fairway">{net}</b></> : "tap +"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={inc}
                    aria-label={`Raise ${p.displayName}'s score`}
                    disabled={isPickup}
                    className="flex size-12 items-center justify-center rounded-xl bg-fairway text-white disabled:opacity-40"
                  >
                    <Plus className="size-5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                {isPickup ? (
                  <button
                    type="button"
                    onClick={() => setScore(p.id, currentHole, holeMeta.par)}
                    className="font-label flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-fairway"
                  >
                    <Undo2 className="size-3.5" /> Enter a score
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setScore(p.id, currentHole, null)}
                    className="font-label text-[11px] font-semibold uppercase tracking-[0.06em] text-muted"
                  >
                    Pick up
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live standings strip */}
      {standings.length > 0 && (
        <div className="mt-5">
          <p className="font-label mb-2 text-[10px] uppercase tracking-[0.1em] text-muted">
            Live standings
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {standings.map((s) => {
              if (s.type === "skins") {
                const topNet = Object.entries(s.nets).sort((a, b) => b[1] - a[1])[0];
                const topId = topNet?.[0];
                return (
                  <div key={s.id} className="min-w-[160px] flex-none rounded-xl bg-ink p-3 text-white">
                    <div className="font-label text-[10px] uppercase tracking-[0.12em] opacity-70">
                      Skins · {s.potValue > 0 ? "on this hole" : "social"}
                      {s.carry > 0 ? ` · carry ×${s.carry}` : ""}
                    </div>
                    <div className="font-display text-3xl font-extrabold leading-none">
                      ${s.potValue}
                    </div>
                    {topId && (s.skinsWon[topId] ?? 0) > 0 && (
                      <div className="mt-1 text-[11px] opacity-80">
                        {nameById.get(topId)} leads · {s.skinsWon[topId]} skin
                        {s.skinsWon[topId] > 1 ? "s" : ""}
                        {s.potValue > 0 && topNet![1] > 0 ? ` · +$${topNet![1]}` : ""}
                      </div>
                    )}
                  </div>
                );
              }
              if (s.type === "match") {
                return (
                  <div key={s.id} className="min-w-[160px] flex-none rounded-xl border border-line bg-card p-3 text-center shadow-card">
                    <div className="font-label text-[10px] uppercase tracking-[0.1em] text-muted">
                      {nameById.get(s.sides.a)} v {nameById.get(s.sides.b)}
                    </div>
                    <div className="font-display text-2xl font-extrabold uppercase text-fairway">
                      {s.text}
                    </div>
                    <div className="font-label text-[10px] uppercase tracking-[0.08em] text-muted">
                      thru {s.thru}
                    </div>
                  </div>
                );
              }
              return (
                <div key={s.id} className="min-w-[180px] flex-none rounded-xl border border-line bg-card p-3 shadow-card">
                  <div className="font-label text-[10px] uppercase tracking-[0.1em] text-muted">
                    Nassau · {nameById.get(s.sides.a)} v {nameById.get(s.sides.b)}
                  </div>
                  <div className="mt-1 flex gap-2 text-xs">
                    {s.segments.map((seg) => (
                      <span key={seg.key} className="rounded bg-field px-1.5 py-0.5">
                        <span className="uppercase text-muted">{seg.key[0]}</span>{" "}
                        {seg.leaderId ? `${nameById.get(seg.leaderId)} ${seg.text}` : "AS"}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={idx === 0}
          className="font-label flex-1 rounded-xl border border-line bg-card py-3 text-sm font-semibold uppercase tracking-[0.06em] disabled:opacity-40"
        >
          ← Back
        </button>
        {idx < holeNumbers.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="font-label flex-1 rounded-xl bg-flare py-3 text-sm font-bold uppercase tracking-[0.08em] text-white"
          >
            Next hole →
          </button>
        ) : (
          <Link
            href={`/play/${eventId}`}
            className="font-label flex-1 rounded-xl bg-fairway py-3 text-center text-sm font-bold uppercase tracking-[0.08em] text-white"
          >
            Done
          </Link>
        )}
      </div>
    </main>
  );
}

export default function ScorePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  return (
    <>
      <AppHeader />
      <AuthGate>
        <ScoreContent eventId={eventId} />
      </AuthGate>
    </>
  );
}
