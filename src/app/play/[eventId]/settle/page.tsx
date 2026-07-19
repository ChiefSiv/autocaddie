"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/nav/app-header";
import { AuthGate } from "@/components/auth/auth-gate";
import { RoundSubnav } from "@/components/nav/round-subnav";
import { useUser } from "@/lib/auth/use-user";
import { useEvent } from "@/lib/queries/events";
import { useRoundScores } from "@/lib/queries/scores";
import { useSeasonToDate } from "@/lib/queries/crews";
import { useSettleRound } from "@/lib/queries/settle";
import { computeFromRound } from "@/lib/queries/round-compute";

const fmt = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(n)}`;
const abs = (n: number) => `$${Math.abs(n)}`;

function SettleContent({ eventId }: { eventId: string }) {
  const { data: user } = useUser();
  const { data: round, isLoading } = useEvent(eventId);
  const { scores, ready } = useRoundScores(round?.groupId ?? null, user?.id ?? "");
  const { data: season } = useSeasonToDate(round?.crewId ?? null);
  const settle = useSettleRound();

  const results = useMemo(
    () => (round ? computeFromRound(round, scores) : null),
    [round, scores],
  );
  const nameById = useMemo(
    () => new Map((round?.players ?? []).map((p) => [p.id, p.displayName])),
    [round],
  );

  const [view, setView] = useState<"pay" | "game">("pay");

  // Mark-as-paid is a local checklist (offline-safe; "we just track it"). Persisted
  // per event in localStorage so it survives reload. Loaded after mount to avoid
  // an SSR/hydration mismatch.
  const paidKey = `autocaddie:paid:${eventId}`;
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  useEffect(() => {
    void (async () => {
      if (typeof window === "undefined") return;
      try {
        const raw = window.localStorage.getItem(paidKey);
        if (raw) setPaid(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    })();
  }, [paidKey]);
  const togglePaid = (k: string) => {
    setPaid((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(paidKey, JSON.stringify(next));
      }
      return next;
    });
  };

  if (isLoading || !ready) return <div className="h-48 animate-pulse rounded-lg bg-field" />;
  if (!round) return <main className="py-10 text-muted">Round not found.</main>;
  if (!results) {
    return (
      <main className="py-10 text-down">
        Stroke index incomplete — finish setup before settling.
      </main>
    );
  }

  const total = round.holesToPlay;
  const partial = results.thru < total;
  const multiGame = round.games.length >= 2;

  const field = round.players
    .map((p) => ({ id: p.id, playerId: p.playerId, name: p.displayName, net: results.perPlayerNet[p.id] ?? 0 }))
    .sort((a, b) => b.net - a.net);

  const onSettle = () => {
    settle.mutate({
      eventId,
      crewId: round.crewId,
      nets: field.map((f) => ({ playerId: f.playerId, amount: f.net })),
    });
  };

  return (
    <main className="flex flex-1 flex-col pb-12">
      <RoundSubnav eventId={eventId} active="settle" />
      <div className="py-5">
        <p className="eyebrow">
          {round.courseName ?? "Round"} · {partial ? `${results.thru} of ${total} holes` : `${total} holes`}
        </p>
        <h1 className="font-display mt-0.5 text-3xl font-extrabold uppercase leading-none">
          Settle up
        </h1>
      </div>

      {partial && (
        <p className="mb-3 rounded-lg border border-carry/40 bg-carry/10 px-3 py-2 text-xs text-muted">
          Ending early — settling the {results.thru} hole{results.thru === 1 ? "" : "s"} completed so far.
        </p>
      )}

      {/* Field strip — net per player, leader first */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {field.map((f) => (
          <div key={f.id} className="min-w-[80px] flex-none rounded-xl border border-line bg-card p-2.5 text-center shadow-card">
            <div className="font-label text-[11px] uppercase tracking-[0.05em] text-muted">{f.name}</div>
            <div className={`font-display text-xl font-extrabold leading-none ${f.net > 0 ? "text-up" : f.net < 0 ? "text-down" : "text-muted"}`}>
              {f.net === 0 ? "$0" : fmt(f.net)}
            </div>
            {round.crewId && (
              <div className="mt-1 text-[10px] text-muted">
                {fmt(season?.[f.playerId] ?? 0)} season
              </div>
            )}
          </div>
        ))}
      </div>

      {/* View toggle — only with 2+ games */}
      {multiGame && (
        <div className="mt-5 flex gap-2 rounded-xl border border-line bg-card p-1.5 shadow-card">
          {(["pay", "game"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`font-label flex-1 rounded-lg py-2.5 text-xs font-semibold uppercase tracking-[0.05em] ${view === v ? "bg-ink text-white" : "text-muted"}`}
            >
              {v === "pay" ? "Who pays whom" : "By game"}
            </button>
          ))}
        </div>
      )}

      {(!multiGame || view === "pay") && (
        <div className="mt-3 flex flex-col gap-2.5">
          {results.payments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-card/40 px-4 py-6 text-center text-sm text-muted">
              All square — nobody owes anything.
            </p>
          ) : (
            results.payments.map((p, i) => {
              const k = `${p.from}->${p.to}:${p.amount}`;
              const isPaid = !!paid[k];
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3.5 shadow-card">
                  <div className="flex flex-1 items-center gap-2">
                    <span className="font-semibold">{nameById.get(p.from)}</span>
                    <ArrowRight className="size-4 text-muted" />
                    <span className="font-semibold">{nameById.get(p.to)}</span>
                  </div>
                  <span className="font-display text-2xl font-extrabold tabular-nums">{abs(p.amount)}</span>
                  <button
                    type="button"
                    onClick={() => togglePaid(k)}
                    className={`font-label flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.05em] ${isPaid ? "border-fairway bg-fairway text-white" : "border-line bg-field text-text"}`}
                  >
                    {isPaid ? <><Check className="size-3.5" /> Paid</> : "Mark paid"}
                  </button>
                </div>
              );
            })
          )}
          <p className="mt-1 text-center text-xs text-muted">
            Fewest payments to square up · we just track it, pay however you like.
          </p>
        </div>
      )}

      {multiGame && view === "game" && (
        <div className="mt-3 flex flex-col gap-3">
          {results.games.map((g) => (
            <div key={g.gameId} className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="font-display text-lg font-extrabold uppercase">
                  {g.type === "match" ? "Match Play" : g.type}
                </span>
                <span className="font-label text-[11px] uppercase tracking-[0.05em] text-muted">
                  {g.stakesEnabled ? `$${g.stake}${g.type === "skins" ? "/hole" : g.type === "nassau" ? "/side" : ""}` : "Social"}
                </span>
              </div>
              {g.type === "nassau" && g.segments
                ? g.segments.map((s) => (
                    <div key={s.key} className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-b-0">
                      <span className="text-sm capitalize">{s.key}<span className="ml-2 text-xs text-muted">{s.leaderId ? `${nameById.get(s.leaderId)} ${s.text}` : "halved"}</span></span>
                    </div>
                  ))
                : round.players.map((p) => {
                    const net = g.nets[p.id] ?? 0;
                    const skins = g.skinsWon?.[p.id];
                    return (
                      <div key={p.id} className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-b-0">
                        <span className="text-sm">
                          {p.displayName}
                          {skins != null && <span className="ml-2 text-xs text-muted">{skins} skin{skins === 1 ? "" : "s"}</span>}
                          {g.type === "match" && g.matchResult && <span className="ml-2 text-xs text-muted">{g.matchResult}</span>}
                        </span>
                        <span className={`font-display text-lg font-extrabold tabular-nums ${!g.stakesEnabled ? "text-muted" : net > 0 ? "text-up" : net < 0 ? "text-down" : "text-muted"}`}>
                          {!g.stakesEnabled ? "—" : net === 0 ? "$0" : fmt(net)}
                        </span>
                      </div>
                    );
                  })}
            </div>
          ))}
        </div>
      )}

      {/* Settle & save (writes the ledger) */}
      <div className="mt-6">
        {settle.isSuccess ? (
          <div className="rounded-xl border border-fairway/40 bg-fairway/10 p-4 text-center">
            <div className="font-display text-lg font-extrabold uppercase text-fairway">Saved</div>
            <p className="mt-1 text-xs text-muted">
              {round.crewId
                ? "Ledger written — season-to-date updated above."
                : "Crewless one-off — no season ledger (by design)."}
            </p>
            <Link href="/" className="mt-3 inline-block text-sm text-fairway">Back to home</Link>
          </div>
        ) : (
          <>
            {settle.error && <p className="mb-2 text-center text-xs text-down">{(settle.error as Error).message}</p>}
            <button
              type="button"
              onClick={onSettle}
              disabled={settle.isPending}
              className="font-label w-full rounded-xl bg-flare py-4 text-[15px] font-bold uppercase tracking-[0.08em] text-white"
            >
              {settle.isPending ? "Saving…" : round.crewId ? "Settle & save to ledger" : "Finish round"}
            </button>
            <p className="mt-2 text-center text-xs text-muted">
              Ledger only — we never move money.{round.crewId ? "" : " Crewless one-off won't accrue a season total."}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function SettlePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return (
    <>
      <AppHeader />
      <AuthGate>
        <SettleContent eventId={eventId} />
      </AuthGate>
    </>
  );
}
