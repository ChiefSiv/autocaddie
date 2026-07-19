"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { Bird, Trophy, Table2 } from "lucide-react";
import { AppHeader } from "@/components/nav/app-header";
import { AuthGate } from "@/components/auth/auth-gate";
import { RoundSubnav } from "@/components/nav/round-subnav";
import { useUser } from "@/lib/auth/use-user";
import { useEvent } from "@/lib/queries/events";
import { useRoundScores } from "@/lib/queries/scores";
import { computeFromRound, holesInPlayFromRound, buildGrossMap } from "@/lib/queries/round-compute";
import { scoreKey } from "@/lib/games/scoring";

// Light end-of-round recap (build prompt §8): birdies, who won what, and a link to
// the final card — before settling.

function RecapContent({ eventId }: { eventId: string }) {
  const { data: user } = useUser();
  const { data: round, isLoading } = useEvent(eventId);
  const { scores, ready } = useRoundScores(round?.groupId ?? null, user?.id ?? "");

  const results = useMemo(() => (round ? computeFromRound(round, scores) : null), [round, scores]);
  const nameById = useMemo(
    () => new Map((round?.players ?? []).map((p) => [p.id, p.displayName])),
    [round],
  );

  // Gross birdies-or-better per player (gross < par on a complete hole).
  const birdies = useMemo(() => {
    if (!round) return [] as { id: string; name: string; count: number }[];
    const holes = holesInPlayFromRound(round);
    const gross = buildGrossMap(scores);
    return round.players
      .map((p) => {
        let count = 0;
        for (const h of holes) {
          const g = gross[scoreKey(p.id, h.number)];
          if (typeof g === "number" && g < h.par) count++;
        }
        return { id: p.id, name: p.displayName, count };
      })
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [round, scores]);

  if (isLoading || !ready) return <div className="h-48 animate-pulse rounded-lg bg-field" />;
  if (!round) return <main className="py-10 text-muted">Round not found.</main>;

  return (
    <main className="flex flex-1 flex-col pb-10">
      <RoundSubnav eventId={eventId} active="recap" />
      <div className="py-5">
        <p className="eyebrow">{round.courseName ?? "Round"} · thru {results?.thru ?? 0}</p>
        <h1 className="font-display mt-0.5 text-3xl font-extrabold uppercase leading-none">Recap</h1>
      </div>

      {/* Who won what */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="size-4 text-flare" />
          <h2 className="font-display text-base font-bold uppercase">Who won what</h2>
        </div>
        <div className="flex flex-col gap-2">
          {(results?.games ?? []).map((g) => {
            let line = "";
            if (g.type === "skins") {
              const top = Object.entries(g.skinsWon ?? {}).sort((a, b) => b[1] - a[1])[0];
              line = top && top[1] > 0 ? `${nameById.get(top[0])} leads — ${top[1]} skin${top[1] === 1 ? "" : "s"}` : "no skins won yet";
            } else if (g.type === "match") {
              line = g.matchWinnerId ? `${nameById.get(g.matchWinnerId)} — ${g.matchResult}` : `All square (${g.matchResult})`;
            } else {
              line = (g.segments ?? [])
                .map((s) => `${s.key}: ${s.leaderId ? `${nameById.get(s.leaderId)} ${s.text}` : "AS"}`)
                .join(" · ");
            }
            return (
              <div key={g.gameId} className="rounded-xl border border-line bg-card p-3.5 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-extrabold uppercase">
                    {g.type === "match" ? "Match Play" : g.type}
                  </span>
                  <span className="font-label text-[10px] uppercase tracking-[0.06em] text-muted">
                    {g.stakesEnabled ? `$${g.stake}` : "Social"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{line}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Birdies */}
      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <Bird className="size-4 text-fairway" />
          <h2 className="font-display text-base font-bold uppercase">Birdies+</h2>
        </div>
        {birdies.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-card/40 px-4 py-5 text-center text-sm text-muted">
            None yet — there&rsquo;s still time.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {birdies.map((b) => (
              <span key={b.id} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm shadow-card">
                <b>{b.name}</b> · {b.count}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-col gap-2.5">
        <Link href={`/play/${eventId}/card`} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card py-3.5 font-label text-sm font-semibold uppercase tracking-[0.06em] shadow-card">
          <Table2 className="size-4" /> Final card
        </Link>
        <Link href={`/play/${eventId}/settle`} className="rounded-xl bg-flare py-4 text-center font-label text-[15px] font-bold uppercase tracking-[0.08em] text-white">
          Settle up
        </Link>
      </div>
    </main>
  );
}

export default function RecapPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return (
    <>
      <AppHeader />
      <AuthGate>
        <RecapContent eventId={eventId} />
      </AuthGate>
    </>
  );
}
