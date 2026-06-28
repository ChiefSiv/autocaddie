"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Search, Trophy } from "lucide-react";
import { SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { StrokeIndexGate } from "./stroke-index-gate";
import {
  useCrews,
  useCrewPlayers,
  useCreateCrew,
  useCreatePlayer,
  useSeasonToDate,
  type Player,
} from "@/lib/queries/crews";
import {
  useCachedCourses,
  useCourseDetail,
  useSearchCourses,
  useCacheCourse,
  type CourseTee,
} from "@/lib/queries/courses";
import { useCreateRound, type SetupGame } from "@/lib/queries/rounds";
import type { AllowanceMode } from "@/lib/handicap/engine";

const AVATAR_BG = ["bg-fairway", "bg-flare", "bg-[#2563EB]", "bg-[#7C3AED]"];

type GameType = "skins" | "nassau" | "match";
interface GameState extends SetupGame {
  type: GameType;
}

function Avatar({ name, i }: { name: string; i: number }) {
  return (
    <div
      className={`font-display flex size-9 flex-none items-center justify-center rounded-md text-base font-extrabold text-white ${AVATAR_BG[i % AVATAR_BG.length]}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/** Two-option segmented control matching the mockup's `.tg` / `.scoreseg`. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; tone?: "fairway" | "flare" }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-line bg-field">
      {options.map((o) => {
        const on = o.value === value;
        const onBg = o.tone === "fairway" ? "bg-fairway" : "bg-flare";
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`font-label px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] ${on ? `${onBg} text-white` : "text-muted"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function RoundSetup() {
  const router = useRouter();

  // ── Crew ────────────────────────────────────────────────────────────────
  const { data: crews } = useCrews();
  // undefined = not yet chosen → default to first crew; null = explicit one-off.
  const [crewChoice, setCrewChoice] = useState<string | null | undefined>(undefined);
  const crewId = crewChoice === undefined ? (crews?.[0]?.id ?? null) : crewChoice;
  const [newCrewName, setNewCrewName] = useState("");
  const createCrew = useCreateCrew();

  // ── Players ─────────────────────────────────────────────────────────────
  const { data: rosterPlayers } = useCrewPlayers(crewId);
  const { data: seasonNet } = useSeasonToDate(crewId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [indexOverrides, setIndexOverrides] = useState<Record<string, string>>({});
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerIndex, setNewPlayerIndex] = useState("");
  const createPlayer = useCreatePlayer();

  // selectedPlayers is derived against the live roster, so stale ids from a crew
  // switch simply resolve to nothing — no effect needed to prune selectedIds.
  const selectedPlayers: Player[] = useMemo(
    () =>
      selectedIds
        .map((id) => rosterPlayers?.find((p) => p.id === id))
        .filter((p): p is Player => !!p),
    [selectedIds, rosterPlayers],
  );
  const availableToAdd = (rosterPlayers ?? []).filter(
    (p) => !selectedIds.includes(p.id),
  );

  const indexFor = (p: Player): number | null => {
    const o = indexOverrides[p.id];
    if (o != null && o !== "") return Number(o);
    if (o === "") return null;
    return p.handicap_index;
  };

  // ── Course / tee ────────────────────────────────────────────────────────
  const { data: cachedCourses } = useCachedCourses();
  const [courseId, setCourseId] = useState<string | null>(null);
  // teeChoice null = use the course's first tee by default.
  const [teeChoice, setTeeChoice] = useState<string | null>(null);
  const { data: courseDetail } = useCourseDetail(courseId);
  const teeSetId = teeChoice ?? courseDetail?.tees[0]?.id ?? null;
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const { data: searchResults, isFetching: searching } = useSearchCourses(searchQ);
  const cacheCourse = useCacheCourse();

  const tee: CourseTee | null = useMemo(
    () => courseDetail?.tees.find((t) => t.id === teeSetId) ?? null,
    [courseDetail, teeSetId],
  );

  const needsStrokeIndex =
    !!tee && (tee.holes.length === 0 || tee.holes.some((h) => h.strokeIndex == null));

  // ── Round options ───────────────────────────────────────────────────────
  const [holesToPlay, setHolesToPlay] = useState<9 | 18>(18);
  const [whichNine, setWhichNine] = useState<"front" | "back">("front");
  const [allowanceMode, setAllowanceMode] = useState<AllowanceMode>("full");

  // ── Games ───────────────────────────────────────────────────────────────
  const [games, setGames] = useState<GameState[]>([]);
  const [showGameMenu, setShowGameMenu] = useState(false);

  const addGame = (type: GameType) => {
    const base: GameState = {
      type,
      stakesEnabled: false,
      stake: type === "skins" ? 5 : type === "nassau" ? 20 : 10,
      grossOrNet: "net",
      ...(type === "skins" ? { carryover: true } : {}),
      ...(type !== "skins" ? { sides: { a: "", b: "" } } : {}),
    };
    setGames((g) => [...g, base]);
    setShowGameMenu(false);
  };
  const updateGame = (i: number, patch: Partial<GameState>) =>
    setGames((g) => g.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeGame = (i: number) =>
    setGames((g) => g.filter((_, idx) => idx !== i));

  // ── Validation ──────────────────────────────────────────────────────────
  const problems = useMemo(() => {
    const out: string[] = [];
    if (!courseId || !teeSetId) out.push("Pick a course and tee.");
    if (selectedPlayers.length < 2) out.push("Add at least 2 players.");
    if (needsStrokeIndex) out.push("Confirm stroke indexes.");
    for (const g of games) {
      if (g.type !== "skins") {
        if (!g.sides?.a || !g.sides?.b)
          out.push(`Choose both sides for ${g.type}.`);
        else if (g.sides.a === g.sides.b)
          out.push(`${g.type} needs two different players.`);
      }
      if (g.stakesEnabled && (!g.stake || g.stake <= 0))
        out.push(`Set a stake for ${g.type}.`);
    }
    return out;
  }, [courseId, teeSetId, selectedPlayers.length, needsStrokeIndex, games]);

  const createRound = useCreateRound();
  const canStart = problems.length === 0 && !createRound.isPending;

  const onStart = async () => {
    if (!canStart || !courseId || !teeSetId || !tee) return;
    const { eventId } = await createRound.mutateAsync({
      crewId,
      courseId,
      teeSetId,
      course: {
        slope: tee.slope ?? 113,
        courseRating: tee.rating ?? tee.par ?? 72,
        par: tee.par ?? 72,
      },
      holesToPlay,
      whichNine: holesToPlay === 9 ? whichNine : null,
      allowanceMode,
      date: new Date().toISOString().slice(0, 10),
      players: selectedPlayers.map((p) => ({
        playerId: p.id,
        handicapIndex: indexFor(p),
      })),
      games,
    });
    router.push(`/play/${eventId}`);
  };

  const fmtMoney = (n: number) =>
    `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(0)}`;

  return (
    <main className="flex flex-1 flex-col pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <div className="py-5">
        <p className="eyebrow">New round</p>
        <h1 className="font-display mt-0.5 text-3xl font-extrabold uppercase leading-none">
          Set up
          <br />
          the round
        </h1>
      </div>

      {/* ── CREW ─────────────────────────────────────────────────────── */}
      <section className="mt-1">
        <SectionHeader title="Crew" />
        <div className="flex flex-wrap gap-2">
          {(crews ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCrewChoice(c.id)}
              className={`font-label rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] ${crewId === c.id ? "border-fairway bg-fairway text-white" : "border-line bg-card text-muted"}`}
            >
              {c.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCrewChoice(null)}
            className={`font-label rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] ${crewId === null ? "border-fairway bg-fairway text-white" : "border-line bg-card text-muted"}`}
          >
            One-off
          </button>
        </div>
        {crewId === null && (
          <p className="mt-2 text-xs text-muted">
            Crewless one-off — results won&rsquo;t accrue to a season ledger.
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <input
            value={newCrewName}
            onChange={(e) => setNewCrewName(e.target.value)}
            placeholder="New crew name"
            className="flex-1 rounded-md border border-line bg-field px-3 py-2 text-sm outline-none focus:border-fairway"
          />
          <Button
            variant="outline"
            disabled={!newCrewName.trim() || createCrew.isPending}
            onClick={async () => {
              const crew = await createCrew.mutateAsync(newCrewName);
              setNewCrewName("");
              setCrewChoice(crew.id);
            }}
            className="h-auto px-3"
          >
            Add crew
          </Button>
        </div>
      </section>

      {/* ── COURSE ───────────────────────────────────────────────────── */}
      <section className="mt-6">
        <SectionHeader
          title="Course"
          action={
            <button
              type="button"
              onClick={() => setShowSearch((s) => !s)}
              className="font-label flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-fairway"
            >
              <Search className="size-3.5" /> Find
            </button>
          }
        />
        {showSearch && (
          <div className="mb-3 rounded-lg border border-line bg-card p-3 shadow-card">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search by exact name (e.g. Graywolf)"
              className="w-full rounded-md border border-line bg-field px-3 py-2 text-sm outline-none focus:border-fairway"
            />
            <p className="mt-1.5 text-[11px] text-muted">
              Search is near-exact — try the precise spelling.
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {searching && <div className="h-8 animate-pulse rounded bg-field" />}
              {(searchResults ?? []).map((r) => (
                <button
                  key={`${r.provider}-${r.providerId}`}
                  type="button"
                  disabled={cacheCourse.isPending}
                  onClick={async () => {
                    const id = await cacheCourse.mutateAsync({
                      providerId: r.providerId,
                      provider: r.provider,
                    });
                    setCourseId(id);
                    setTeeChoice(null);
                    setShowSearch(false);
                  }}
                  className="rounded-md border border-line bg-field px-3 py-2 text-left text-sm"
                >
                  <span className="font-semibold">{r.name}</span>
                  {r.city && <span className="text-muted"> · {r.city}{r.state ? `, ${r.state}` : ""}</span>}
                </button>
              ))}
              {cacheCourse.error && (
                <p className="text-xs text-down">{(cacheCourse.error as Error).message}</p>
              )}
            </div>
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-line bg-card shadow-card">
          {(cachedCourses ?? []).length === 0 && (
            <p className="px-4 py-4 text-sm text-muted">
              No saved courses yet — use Find above.
            </p>
          )}
          {(cachedCourses ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCourseId(c.id);
                setTeeChoice(null);
              }}
              className={`flex w-full items-center justify-between border-b border-line px-4 py-3 text-left last:border-b-0 ${courseId === c.id ? "bg-field" : ""}`}
            >
              <span className="font-display text-lg font-extrabold uppercase">
                {c.name}
              </span>
              {c.city && (
                <span className="text-xs text-muted">
                  {c.city}{c.state ? `, ${c.state}` : ""}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tee selector */}
        {courseDetail && courseDetail.tees.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {courseDetail.tees.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTeeChoice(t.id)}
                className={`font-label rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] ${teeSetId === t.id ? "border-fairway bg-fairway text-white" : "border-line bg-card text-muted"}`}
              >
                {t.name}
                {t.rating && t.slope ? (
                  <span className="ml-1.5 opacity-70">{t.rating}/{t.slope}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {/* MANDATORY stroke-index gate */}
        {tee && needsStrokeIndex && courseId && (
          <div className="mt-3">
            <StrokeIndexGate courseId={courseId} tee={tee} onComplete={() => {}} />
          </div>
        )}
      </section>

      {/* ── HOLES + ALLOWANCE ────────────────────────────────────────── */}
      <section className="mt-6">
        <SectionHeader title="Format" />
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="font-label text-xs uppercase tracking-[0.08em] text-muted">
              Holes
            </span>
            <Segmented
              value={String(holesToPlay)}
              onChange={(v) => setHolesToPlay(v === "9" ? 9 : 18)}
              options={[
                { value: "18", label: "Full 18", tone: "fairway" },
                { value: "9", label: "9 holes", tone: "fairway" },
              ]}
            />
          </div>
          {holesToPlay === 9 && (
            <div className="flex items-center justify-between">
              <span className="font-label text-xs uppercase tracking-[0.08em] text-muted">
                Which nine
              </span>
              <Segmented
                value={whichNine}
                onChange={setWhichNine}
                options={[
                  { value: "front", label: "Front", tone: "fairway" },
                  { value: "back", label: "Back", tone: "fairway" },
                ]}
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-label text-xs uppercase tracking-[0.08em] text-muted">
              Allowance
            </span>
            <Segmented
              value={allowanceMode}
              onChange={(v) => setAllowanceMode(v)}
              options={[
                { value: "full", label: "Full", tone: "fairway" },
                { value: "relative", label: "Low man scratch", tone: "fairway" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── PLAYERS ──────────────────────────────────────────────────── */}
      <section className="mt-6">
        <SectionHeader
          title={`Players · ${selectedPlayers.length}`}
          action={
            <button
              type="button"
              onClick={() => setAddingPlayer((a) => !a)}
              className="font-label flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-fairway"
            >
              <Plus className="size-3.5" /> Add
            </button>
          }
        />
        <div className="overflow-hidden rounded-lg border border-line bg-card shadow-card">
          {selectedPlayers.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted">
              No players yet — add from your crew roster or quick-add one.
            </p>
          )}
          {selectedPlayers.map((p, i) => {
            const season = seasonNet?.[p.id];
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <Avatar name={p.display_name} i={i} />
                <div className="flex-1">
                  <div className="font-bold">{p.display_name}</div>
                  <div className="flex items-center gap-2">
                    {p.linked_user_id ? (
                      <span className="font-label rounded-full border border-line bg-field px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-muted">
                        account
                      </span>
                    ) : (
                      <span className="font-label rounded-full border border-line bg-field px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-muted">
                        managed
                      </span>
                    )}
                    {season != null && season !== 0 && (
                      <span className={`text-[11px] ${season > 0 ? "text-up" : "text-down"}`}>
                        {fmtMoney(season)} season
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="decimal"
                    aria-label={`${p.display_name} handicap index`}
                    value={
                      indexOverrides[p.id] ??
                      (p.handicap_index != null ? String(p.handicap_index) : "")
                    }
                    onChange={(e) =>
                      setIndexOverrides((o) => ({ ...o, [p.id]: e.target.value }))
                    }
                    placeholder="idx"
                    className="font-display w-14 rounded-md border border-line bg-field px-2 py-1 text-center text-lg font-extrabold outline-none focus:border-fairway"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${p.display_name}`}
                    onClick={() =>
                      setSelectedIds((ids) => ids.filter((id) => id !== p.id))
                    }
                    className="text-muted"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {addingPlayer && (
          <div className="mt-2 rounded-lg border border-line bg-card p-3 shadow-card">
            {availableToAdd.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {availableToAdd.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedIds((ids) => [...ids, p.id])}
                    className="font-label rounded-full border border-line bg-field px-3 py-1.5 text-xs font-semibold"
                  >
                    + {p.display_name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Quick-add name"
                className="flex-1 rounded-md border border-line bg-field px-3 py-2 text-sm outline-none focus:border-fairway"
              />
              <input
                value={newPlayerIndex}
                onChange={(e) => setNewPlayerIndex(e.target.value)}
                inputMode="decimal"
                placeholder="Index"
                className="w-24 rounded-md border border-line bg-field px-3 py-2 text-sm outline-none focus:border-fairway"
              />
              <Button
                variant="outline"
                disabled={!newPlayerName.trim() || createPlayer.isPending}
                onClick={async () => {
                  const player = await createPlayer.mutateAsync({
                    crewId,
                    displayName: newPlayerName,
                    handicapIndex: newPlayerIndex === "" ? null : Number(newPlayerIndex),
                  });
                  setSelectedIds((ids) => [...ids, player.id]);
                  setNewPlayerName("");
                  setNewPlayerIndex("");
                }}
                className="h-auto px-3"
              >
                Add
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              Quick-add creates a durable managed player on this crew — reused next
              round, never a throwaway name.
            </p>
          </div>
        )}
      </section>

      {/* ── GAMES ────────────────────────────────────────────────────── */}
      <section className="mt-6">
        <SectionHeader
          title={`Games · ${games.length}`}
          action={
            <button
              type="button"
              onClick={() => setShowGameMenu((s) => !s)}
              className="font-label flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-fairway"
            >
              <Plus className="size-3.5" /> Add a game
            </button>
          }
        />
        {showGameMenu && (
          <div className="mb-2 flex gap-2">
            {(["skins", "nassau", "match"] as GameType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addGame(t)}
                className="font-label flex-1 rounded-md border border-line bg-card px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.05em] shadow-card"
              >
                {t === "match" ? "Match Play" : t}
              </button>
            ))}
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-line bg-card shadow-card">
          {games.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted">
              No games yet — add Skins, Nassau, or Match Play.
            </p>
          )}
          {games.map((g, i) => (
            <div key={i} className="border-b border-line p-4 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-xl font-extrabold uppercase">
                  {g.type === "match" ? "Match Play" : g.type}
                </span>
                <div className="flex items-center gap-2">
                  <Segmented
                    value={g.stakesEnabled ? "stakes" : "social"}
                    onChange={(v) => updateGame(i, { stakesEnabled: v === "stakes" })}
                    options={[
                      { value: "social", label: "Social", tone: "fairway" },
                      { value: "stakes", label: "Stakes", tone: "flare" },
                    ]}
                  />
                  <button
                    type="button"
                    aria-label="Remove game"
                    onClick={() => removeGame(i)}
                    className="text-muted"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="font-label rounded-full border border-line bg-field px-2.5 py-1 text-[10px] uppercase tracking-[0.06em] text-muted">
                  {g.type === "skins" ? "Whole group" : "This group"}
                </span>
                <span className="font-label rounded-full border border-fairway/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.06em] text-fairway">
                  {g.grossOrNet}
                </span>
                {g.type === "skins" && (
                  <span className="font-label rounded-full border border-line bg-field px-2.5 py-1 text-[10px] uppercase tracking-[0.06em] text-muted">
                    Carryovers {g.carryover ? "on" : "off"}
                  </span>
                )}
                {g.type === "nassau" && (
                  <span className="font-label rounded-full border border-line bg-field px-2.5 py-1 text-[10px] uppercase tracking-[0.06em] text-muted">
                    {holesToPlay === 9 ? "Single 9-hole bet" : "Front / Back / 18"}
                  </span>
                )}
              </div>

              {/* Side selection for match-based games */}
              {g.type !== "skins" && (
                <div className="mt-3 flex items-center gap-2">
                  <SidePicker
                    label="Side A"
                    value={g.sides?.a ?? ""}
                    players={selectedPlayers}
                    exclude={g.sides?.b}
                    onChange={(a) => updateGame(i, { sides: { a, b: g.sides?.b ?? "" } })}
                  />
                  <span className="font-label text-xs text-muted">vs</span>
                  <SidePicker
                    label="Side B"
                    value={g.sides?.b ?? ""}
                    players={selectedPlayers}
                    exclude={g.sides?.a}
                    onChange={(b) => updateGame(i, { sides: { a: g.sides?.a ?? "", b } })}
                  />
                </div>
              )}

              {g.type === "skins" && (
                <div className="mt-3">
                  <Segmented
                    value={g.carryover ? "on" : "off"}
                    onChange={(v) => updateGame(i, { carryover: v === "on" })}
                    options={[
                      { value: "on", label: "Carryovers on", tone: "fairway" },
                      { value: "off", label: "Off", tone: "fairway" },
                    ]}
                  />
                </div>
              )}

              {/* Stake */}
              {g.stakesEnabled ? (
                <div className="mt-3 flex items-center justify-between border-t border-dashed border-line pt-3">
                  <span className="font-label text-[11px] uppercase tracking-[0.08em] text-muted">
                    {g.type === "skins" ? "Per hole" : g.type === "nassau" ? "Each side" : "Match"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl font-extrabold">$</span>
                    <input
                      inputMode="decimal"
                      aria-label="Stake amount"
                      value={g.stake ?? ""}
                      onChange={(e) =>
                        updateGame(i, {
                          stake: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="font-display w-20 rounded-md border border-line bg-field px-2 py-1 text-center text-xl font-extrabold outline-none focus:border-fairway"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 border-t border-dashed border-line pt-3 text-xs text-muted">
                  <Trophy className="size-3.5" /> Bragging rights only — no money tracked
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Start CTA ──────────────────────────────────────────────────
         Inline (NOT fixed): a fixed CTA sat at z-20 UNDER the z-30 BottomNav and
         was invisible/unclickable. Inline keeps it in the scroll flow, always
         reachable, and clear of the nav (main's bottom padding below). Disabled
         until setup is valid AND the SI gate is satisfied (`needsStrokeIndex`
         puts "Confirm stroke indexes." into `problems`, so it's already in
         `canStart`; the hint just makes the blocker explicit). */}
      <div className="mt-8">
        {needsStrokeIndex && (
          <p className="mb-2 text-center text-xs text-flare">
            Confirm stroke indexes above before you can start scoring.
          </p>
        )}
        {problems.length > 0 && !needsStrokeIndex && (
          <p className="mb-2 text-center text-xs text-muted">{problems[0]}</p>
        )}
        {createRound.error && (
          <p className="mb-2 text-center text-xs text-down">
            {(createRound.error as Error).message}
          </p>
        )}
        <Button
          onClick={onStart}
          disabled={!canStart}
          className="font-label h-auto w-full rounded-xl bg-flare py-4 text-[15px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-50"
        >
          {createRound.isPending ? "Starting…" : "Start round"}
        </Button>
      </div>
    </main>
  );
}

function SidePicker({
  label,
  value,
  players,
  exclude,
  onChange,
}: {
  label: string;
  value: string;
  players: Player[];
  exclude?: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded-md border border-line bg-field px-2.5 py-2 text-sm outline-none focus:border-fairway"
    >
      <option value="">{label}…</option>
      {players
        .filter((p) => p.id !== exclude)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}
          </option>
        ))}
    </select>
  );
}
