"use client";

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/nav/app-header";
import { AuthGate } from "@/components/auth/auth-gate";
import { useUser } from "@/lib/auth/use-user";
import { useEvent } from "@/lib/queries/events";
import { useRoundScores } from "@/lib/queries/scores";
import { holesInPlayFromRound, buildGrossMap } from "@/lib/queries/round-compute";
import { deriveScoring, scoreKey } from "@/lib/games/scoring";
import { netScore } from "@/lib/handicap/engine";

// Scorecard (build prompt §8). FROZEN COLUMN = two side-by-side panes (fixed name
// pane + horizontally scrolling holes), NOT position:sticky cells and NO
// -webkit-overflow-scrolling (see KNOWN_ISSUES). Row heights are identical in both
// panes so rows line up: header 40 / par 28 / SI 28 / player 52.

function Cell({ gross, net, par }: { gross: number | null | undefined; net: number | null; par: number }) {
  if (gross === undefined) return <span className="text-muted/40">·</span>;
  if (gross === null) return <span className="text-muted">—</span>; // pick-up
  const birdie = gross < par;
  const doublePlus = gross >= par + 2;
  return (
    <span className="inline-flex items-start justify-center gap-px">
      <span
        className={`font-display text-[19px] font-bold leading-none ${
          birdie
            ? "flex size-[26px] items-center justify-center rounded-full border-2 border-flare text-flare"
            : doublePlus
              ? "flex size-[26px] items-center justify-center rounded-md border-[1.5px] border-down text-down"
              : "text-text"
        }`}
      >
        {gross}
      </span>
      {net != null && net !== gross && (
        <span className="font-display text-[11px] font-bold leading-none text-flare">{net}</span>
      )}
    </span>
  );
}

function TotCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="min-w-[46px] bg-field px-0.5 text-center shadow-[inset_2px_0_0_var(--line)]">
      {children}
    </td>
  );
}

function ScorecardContent({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { data: user } = useUser();
  const { data: round, isLoading } = useEvent(eventId);
  const { scores, ready } = useRoundScores(round?.groupId ?? null, user?.id ?? "");

  const holesInPlay = useMemo(() => (round ? holesInPlayFromRound(round) : []), [round]);
  const siOk = holesInPlay.length > 0 && holesInPlay.every((h) => h.strokeIndex > 0);
  const derived = useMemo(() => {
    if (!round || !siOk) return null;
    return deriveScoring(
      round.players.map((p) => ({ roundPlayerId: p.id, playingHandicap: p.playingHandicap ?? 0 })),
      holesInPlay,
      buildGrossMap(scores),
    );
  }, [round, siOk, holesInPlay, scores]);

  if (isLoading || !ready) return <div className="h-48 animate-pulse rounded-lg bg-field" />;
  if (!round) return <main className="py-10 text-muted">Round not found.</main>;
  if (!siOk) return <main className="py-10 text-down">Stroke index incomplete — finish setup.</main>;

  const nums = holesInPlay.map((h) => h.number);
  const front = nums.filter((n) => n <= 9);
  const back = nums.filter((n) => n >= 10);

  const jump = (hole: number) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`autocaddie:hole:${eventId}`, String(hole));
    }
    router.push(`/play/${eventId}/score`);
  };

  const rowH = { head: "h-10", par: "h-7", si: "h-7", pl: "h-[52px]" };

  // gross/net/totals per player
  const grid = round.players.map((p) => {
    const cells = holesInPlay.map((h) => {
      const g = scores[scoreKey(p.id, h.number)]?.strokes;
      const recv = derived?.strokesByPlayer[p.id]?.get(h.number) ?? 0;
      return { hole: h.number, par: h.par, gross: g, net: g == null ? null : netScore(g, recv) };
    });
    const sum = (hs: number[]) =>
      cells.filter((c) => hs.includes(c.hole) && typeof c.gross === "number").reduce((s, c) => s + (c.gross as number), 0);
    return { p, cells, out: sum(front), inn: sum(back), tot: sum(nums) };
  });

  const parOf = (n: number) => holesInPlay.find((h) => h.number === n)?.par ?? 0;
  const siOf = (n: number) => holesInPlay.find((h) => h.number === n)?.strokeIndex ?? 0;
  const parSum = (hs: number[]) => hs.reduce((s, n) => s + parOf(n), 0);

  return (
    <main className="flex flex-1 flex-col pb-10">
      <div className="py-5">
        <p className="eyebrow">{round.courseName ?? "Round"} · {round.teeName ?? ""}</p>
        <h1 className="font-display mt-0.5 text-3xl font-extrabold uppercase leading-none">The card</h1>
      </div>

      <div className="flex overflow-hidden rounded-xl border border-line bg-card shadow-card">
        {/* FROZEN NAME PANE */}
        <div className="z-[2] flex-none bg-card shadow-[6px_0_8px_-6px_rgba(11,20,16,0.18)]">
          <table className="border-separate border-spacing-0">
            <tbody>
              <tr className={rowH.head}><th className="bg-ink px-3 text-left font-display text-sm font-bold text-white min-w-[112px]">Hole</th></tr>
              <tr className={rowH.par}><td className="bg-field px-3 text-left font-label text-[11px] uppercase text-muted"><b className="text-text">Par</b></td></tr>
              <tr className={rowH.si}><td className="border-b border-line bg-field px-3 text-left font-label text-[11px] uppercase text-muted">S.I.</td></tr>
              {grid.map(({ p }) => (
                <tr key={p.id} className={rowH.pl}>
                  <td className="border-b border-line px-3 text-left font-bold last:border-b-0">
                    {p.displayName}
                    <span className="block font-label text-[10px] uppercase tracking-[0.06em] text-muted">
                      HCP {p.playingHandicap ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SCROLLING HOLES PANE */}
        <div className="flex-1 overflow-x-auto">
          <table className="border-separate border-spacing-0">
            <tbody>
              <tr className={rowH.head}>
                {front.map((n) => <th key={n} className="min-w-[46px] bg-ink px-0.5 font-display text-sm font-bold text-white">{n}</th>)}
                {front.length > 0 && <th className="min-w-[46px] bg-ink px-0.5 font-display text-sm font-bold text-white">Out</th>}
                {back.map((n) => <th key={n} className="min-w-[46px] bg-ink px-0.5 font-display text-sm font-bold text-white">{n}</th>)}
                {back.length > 0 && <th className="min-w-[46px] bg-ink px-0.5 font-display text-sm font-bold text-white">In</th>}
                <th className="min-w-[46px] bg-ink px-0.5 font-display text-sm font-bold text-white">Tot</th>
              </tr>
              <tr className={rowH.par}>
                {front.map((n) => <td key={n} className="bg-field text-center font-label text-[11px] text-muted">{parOf(n)}</td>)}
                {front.length > 0 && <TotCell><span className="font-label text-[11px] text-muted">{parSum(front)}</span></TotCell>}
                {back.map((n) => <td key={n} className="bg-field text-center font-label text-[11px] text-muted">{parOf(n)}</td>)}
                {back.length > 0 && <TotCell><span className="font-label text-[11px] text-muted">{parSum(back)}</span></TotCell>}
                <TotCell><span className="font-label text-[11px] text-muted">{parSum(nums)}</span></TotCell>
              </tr>
              <tr className={rowH.si}>
                {front.map((n) => <td key={n} className="border-b border-line bg-field text-center font-label text-[11px] text-muted">{siOf(n)}</td>)}
                {front.length > 0 && <TotCell><span /></TotCell>}
                {back.map((n) => <td key={n} className="border-b border-line bg-field text-center font-label text-[11px] text-muted">{siOf(n)}</td>)}
                {back.length > 0 && <TotCell><span /></TotCell>}
                <TotCell><span /></TotCell>
              </tr>
              {grid.map((row) => {
                const cellFor = (n: number) => row.cells.find((c) => c.hole === n)!;
                return (
                  <tr key={row.p.id} className={rowH.pl}>
                    {front.map((n) => {
                      const c = cellFor(n);
                      return (
                        <td key={n} onClick={() => jump(n)} className="cursor-pointer border-b border-line text-center last:border-b-0">
                          <Cell gross={c.gross} net={c.net} par={c.par} />
                        </td>
                      );
                    })}
                    {front.length > 0 && <TotCell><span className="font-display text-[18px] font-bold">{row.out || ""}</span></TotCell>}
                    {back.map((n) => {
                      const c = cellFor(n);
                      return (
                        <td key={n} onClick={() => jump(n)} className="cursor-pointer border-b border-line text-center last:border-b-0">
                          <Cell gross={c.gross} net={c.net} par={c.par} />
                        </td>
                      );
                    })}
                    {back.length > 0 && <TotCell><span className="font-display text-[18px] font-bold">{row.inn || ""}</span></TotCell>}
                    <TotCell><span className="font-display text-[18px] font-bold">{row.tot || ""}</span></TotCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 px-0.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="font-display">5</span><span className="font-display text-[10px] text-flare">4</span> gross + net</span>
        <span className="inline-flex items-center gap-1.5"><span className="flex size-[18px] items-center justify-center rounded-full border-2 border-flare font-display text-[11px] text-flare">3</span> birdie+</span>
        <span className="inline-flex items-center gap-1.5"><span className="flex size-[18px] items-center justify-center rounded border-[1.5px] border-down font-display text-[11px] text-down">7</span> double+</span>
        <span>Tap a cell to enter</span>
      </div>
    </main>
  );
}

export default function ScorecardPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return (
    <>
      <AppHeader />
      <AuthGate>
        <ScorecardContent eventId={eventId} />
      </AuthGate>
    </>
  );
}
