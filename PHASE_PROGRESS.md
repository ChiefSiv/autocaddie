# Autocaddie — PHASE PROGRESS

> Checklist of Phase 0 / Phase 1 deliverables with status. Keep current.
> Legend: ✅ done · 🔶 partial · ⬜ not started · 🚫 out of scope (this phase)

---

## Phase 0 — Foundation

### Deliverables (build prompt §9)
- ✅ Next.js 16 + TypeScript App Router project; Vercel-ready.
- 🔶 Supabase wired: client/server/admin helpers, Auth (email + guest), session
  middleware. RLS policies land with the schema in Phase 1 (no app tables yet).
- ✅ Committed `.env.example`; all secrets read from env, never hard-coded.
- ✅ Tailwind v4 + lucide-react with §4 tokens + 3 Google fonts.
- 🔶 shadcn/ui (base-nova) — initialized; primitives added as needed.
- ✅ Auto light/dark theming (OS-follow + manual override; no-flash bootstrap).
- ✅ PWA: manifest + icons (flag-pin placeholder) + maskable + theme-color;
  Serwist service worker; offline app-shell (`/offline`).
- ✅ IndexedDB (Dexie) scaffolding (schema stub + read/write + outbox helpers).
- ✅ Bottom-tab nav shell, 5 routes (Home + You real; Rounds/Friends/Play stubs).
- ✅ `CONTEXT.md`, `KNOWN_ISSUES.md`, `PHASE_PROGRESS.md` created.

### Verification run (this session)
- ✅ `tsc --noEmit` — clean.
- ✅ `vitest run` — 3/3 passing (greeting util; handicap engine tests land Phase 1).
- ✅ `next build --webpack` — succeeds; Serwist bundles `/sw.js` (40 precache
  entries); all 10 routes compile; Proxy recognized.
- ✅ `eslint` — clean (0 errors, 0 warnings).
- ✅ `next start` smoke test — `/`, `/signin`, `/offline`, `/rounds`, `/you`,
  `/friends`, `/play`, `/manifest.webmanifest`, `/sw.js`, `/icons/icon-512.png`
  all return **200**. Manifest validates (standalone, theme-color, maskable icon).

### Acceptance (build prompt §9 + §15 "verify by hand")
- 🔶 Installs to home screen as a PWA. _(SW + manifest + maskable icon build &
  serve correctly; final install gesture is a device/browser check)_
- 🔶 Opens in airplane mode — app shell loads, no white screen. _(`/offline`
  fallback builds + is precached; verify by toggling offline in a prod build)_
- ✅ Follows OS light/dark; correct tokens in both themes.
- 🔶 Email sign-in + "continue as guest" work. _(code complete; needs Supabase
  providers enabled + `.env.local`)_
- ✅ All five bottom tabs route (verified 200s).

### "Make Claude Code prove" (relevant to Phase 0)
- ✅ Course API keys are server-only (`COURSE_API_KEY`/`GOLFAPI_KEY` never
  `NEXT_PUBLIC_`; read via `serverEnv()`); provider interface lands Phase 1.
- ⬜ Handicap unit tests — Phase 1.
- ⬜ Schema has Event → Group → Player + `Game.scope` — Phase 1.
- ✅ `KNOWN_ISSUES.md` records the two gotchas (frozen column + offline model).

**Status: Phase 0 code-complete and locally verified (typecheck/test/build/lint
green; all routes serve). Remaining to fully close §15 by-hand boxes: enable
Supabase Anonymous + Email providers, populate `.env.local`, then confirm the
PWA install + airplane-mode shell on a device against a production build.**

---

## Phase 1 — Schema + course data + handicap engine  (✅ COMPLETE)

Worked the four pieces in order, verifying between each:
**schema → course data → handicap engine → Home.** Folded in the §2.5 durable-
persistence schema (built here since Phase 1 creates the schema).

**Completion report vs §10 acceptance:**
- Schema with Event→Group→Player + `Game.scope` + durable §2.5 entities, applied
  to Supabase; RLS event-scoped + crew-scoped, **13/13 guest-boundary checks**.
- `CourseDataProvider` (GolfCourseAPI primary, golfapi.io fallback) with
  fetch + cache to Supabase, search + near-me + manual add/edit; **live-verified**
  against Graywolf (real course cached). Finding: stroke index often absent →
  confirm/manual is mandatory (Phase 2).
- Handicap/stroke engine as tested pure functions (course/playing handicap,
  allocation, full + relative allowance); **24 engine cases vs worked examples**.
- Home renders in the design system (light + dark) wired to the TanStack data
  layer. `next build` green; 34 tests; typecheck + lint clean.
- ✅ By-hand check (builder, in browser): guest → set index → Home shows it;
  empty states + light/dark confirmed.

**→ Next handoff: Phase 2 (gameplay) in a fresh chat. Carry-forwards above:
mandatory manual stroke-index entry; fix `SUPABASE_SERVICE_ROLE_KEY`.**

### Piece 1 — Schema + RLS  ✅ (applied & RLS-verified on the live DB)
- ✅ Full Event→Group→Player + `Game.scope`, plus durable §2.5 entities (`crews`,
  durable `players` managed/linked, `events.crew_id`, retained `hole_scores`,
  `ledger_entries`) — `supabase/migrations/` (4 files).
- ✅ Event-scoped + crew-scoped RLS; `join_event_by_code` RPC; guest (anon) play
  preserved. Decisions recorded in CONTEXT.md.
- ✅ **Applied to Supabase** via `supabase db push` (migrations 0001–0004 recorded
  remotely). Fix migration 0004: `events_select` needed an immediate
  `host_user_id` branch (AFTER-INSERT membership trigger isn't visible at
  `RETURNING` time).
- ✅ **RLS guest-boundary check: 13/13 pass** — two anonymous sessions; a guest
  can create crew/player/event, cannot read another guest's crew/player/event,
  can join by code and then read the event (but still not the crew roster).
- ✅ Types: `database.types.ts` hand-authored from the migrations (CLI `gen types`
  needs Docker/management-API, both unavailable here); clients use
  `createClient<Database>()`. Regenerate with `supabase gen types --db-url` once
  Docker is available.

### Piece 2 — Course data  ✅ (provider + cache verified live)
- ✅ `CourseDataProvider` interface (`src/lib/courses/`): GolfCourseAPI primary
  (tested), golfapi.io fallback (conforms to interface; UNVERIFIED — no key).
  Factory selects via `COURSE_DATA_PROVIDER`.
- ✅ Fetch + **cache-on-first-use** into `courses`/`tee_sets`/`holes`
  (`getOrCacheCourse`), via the request's **authenticated** client (RLS allows
  it; no service-role needed). Search by name (`/api/courses/search`), near-me
  from cache (`/api/courses/nearby`), manual add/edit (`createManualCourse`).
- ✅ Fixture course with full par + stroke index (`fixture.ts`).
- ✅ Mapping unit-tested against **real saved Graywolf JSON** (10/10 tests).
- ✅ Live integration verified (7/7): fetch Graywolf → cache → read back →
  dup-rejected → cleanup, as an authenticated guest.
- ⚠️ **Finding:** GolfCourseAPI returns slope/rating/par/yardage but **Graywolf
  has NO per-hole stroke index on any tee** — the make-or-break field is often
  missing. `needsStrokeIndex` flags this; confirm-at-setup + manual entry are
  mandatory (Phase 2 UI). Search is near-exact.

### Piece 3 — Handicap engine  ✅ (pure + tested)
- ✅ `src/lib/handicap/engine.ts`: `courseHandicap`, `playingHandicap`,
  `strokesOnHole`/`allocateStrokes` (SI 1 = hardest; handles N>18 and plus
  handicaps; sums to the handicap), `netScore` (null = pick-up),
  `computeRoundHandicaps` (field, end-to-end).
- ✅ Full + relative allowance: `applyAllowanceMode` — relative = full handicap
  **minus a constant** (the field's lowest playing handicap → low man scratch).
  One engine, a thin adjustment; game-format allowance (0.85/0.95) is separate.
- ✅ **23 Vitest cases**, hand-worked against real Graywolf Gold numbers + the
  fixture stroke indexes (33 tests total across the suite).

### Piece 4 — Home + data layer  ✅
- ✅ TanStack Query data layer (`src/lib/queries/`): typed hooks `useProfile` +
  `useUpdateProfile`, `useRoundTemplates`, `useRecentEvents` (course embed), with
  a shared key factory. Pattern established for the rest of the entities.
- ✅ Real Home (`src/app/page.tsx`) per `golf-games-home.html`: greeting +
  handicap index (tap → You), Start/Join, regular-games one-tap cards (or
  invitation), friends-on-course placeholder, last-round card (or invitation);
  skeletons while loading.
- ✅ You → **Handicap** editor (`useUpdateProfile`) — the onboarding "one useful
  question"; makes the Home index real data.
- ✅ Live-verified (5/5) as a guest: profile auto-created, handicap save/read-back,
  empty templates + events drive the empty states, course-embed shape valid.
- ✅ `next build` green (all routes incl. `/api/courses/*`); 34 tests; lint clean.

---

## Phase 2 — Gameplay  (🔶 IN PROGRESS — engines-first)

Build order: **engines GREEN before any UI**, then setup → play → recap → settle.

### §2.5 durable schema verification (no migration needed)
- ✅ Re-verified Phase 1's schema satisfies all four durable requirements:
  durable `players` identity (managed/linked; `round_players.player_id` FK, **no
  free-text names**), `events.crew_id` nullable (+ `ledger_entries.crew_id NOT
  NULL` ⇒ crewless writes no ledger), crew-scoped `ledger_entries`, retained
  `hole_scores`. **PASS — went straight to gameplay.**

### Ledger idempotency  ✅ (additive migration)
- ✅ `20260628120005_ledger_unique.sql`: `UNIQUE (event_id, player_id)` on
  `ledger_entries`; settle upserts `ON CONFLICT DO UPDATE`. Paid-flag resets only
  when the amount changed. Documented in CONTEXT.md. **Not yet `db push`ed** —
  apply with the settle-write UI step.

### Game engines  ✅ (pure + tested, GREEN)
- ✅ `src/lib/games/`: `types.ts` (shared contract), `skins.ts`, `nassau.ts`,
  `match.ts`, `settlement.ts` — all pure, money in integer cents.
- ✅ **28 Vitest cases** vs hand-checked worked examples (62 total in the suite;
  tsc clean):
  - Skins: carryover+ante nets to 0; tie carries; pick-up can't win; **terminal
    unclaimed pot voided & refunded** (Σ=0 mid-carry); carryover-off; stakes-off.
  - Nassau: front/back/18 as three bets; tied segment halved; **9-hole single-bet
    collapse**; pick-up = loss; stakes-off.
  - Match Play: running status; "3 & 2" closeout; **dormie boundary (`>` not
    `>=`)** → 2&1 / 3&1 / "1 up" to the last hole; **halved-18**; pick-up = loss.
  - Settlement: **minimized < naive pairwise**; by-game sums to minimized;
    3-player routing; fractional ($2.50) cents exact.

### Round setup + stroke-index gate  ✅ (first cut)
- ✅ `/play` round-setup flow (`src/components/setup/`, `src/lib/queries/`):
  crew picker (+ new crew, **crewless one-off**), durable player roster picker +
  **quick-add managed player** (never free-text), course picker (cached list +
  near-exact provider search → cache-on-first-use), tee selector, holes 9/18 (+
  which-nine), allowance toggle (full / low-man-scratch), games (Skins/Nassau/
  Match) with Social↔Stakes, stake, carryover, and **side selection** for
  match-based games. Season-to-date figure shown per player (empty until settle).
- ✅ **MANDATORY stroke-index gate** (`stroke-index-gate.tsx`): when the chosen
  tee has any null SI, a blocking step requires a complete 1..N permutation
  (validated) and **Start round is disabled** until saved. Persists to
  `holes.stroke_index`.
- ✅ Create-round mutation (`rounds.ts`): event → group → round_players (engine-
  computed course/playing handicaps, allowance mode applied) → games (sides
  mapped player_id → round_player id). Status → `active`. Routes to round home.
- ✅ Round home **first cut** (`/play/[eventId]`): join code, players with
  course/strokes handicaps, games — confirms persistence; "Enter scores" stubbed.
- ✅ tsc + eslint clean; `next build` green (14 routes); 63 tests.

### Hole-entry + live scoring + local-first  ✅ (first cut)
- ✅ Scoring compute layer (`src/lib/games/scoring.ts`, `live.ts` — pure, tested):
  tri-state per (player,hole) — **number=score, null=pick-up, undefined=not
  entered**; net derived (gross − strokes received via the handicap engine, using
  `round_players.playing_handicap`); only **complete holes** (all players entered)
  feed the engines; `liveStandings` runs Skins/Nassau/Match for the strip. Match
  engine got an optional `totalHoles` (defaults to `holes.length`) so live status
  reads "2 up thru 13" instead of a false closeout.
- ✅ **Pick-up writes `null`, never 0** — verified in `scoring.test.ts` (null → net
  null, distinct from a real score; flows through engines).
- ✅ Hole-entry screen (`/play/[eventId]/score`): all players on one hole, gross
  stepper, **stroke dots**, one-tap **pick-up** (+ undo), next/back (no
  auto-advance), editing a past hole recomputes (derived each render), live
  standings strip (skins pot/carry, match status, nassau segments).
- ✅ **Local-first** (`src/lib/db/index.ts` + `useRoundScores`): optimistic write
  to Dexie, outbox flush to Supabase when online, hydrate-from-remote on load;
  in-progress round survives offline + restart. Sync badge (saved / N unsynced).
- ✅ **Lock-after-hole-1**: `roundLocked` when the round's first hole has any entry
  (UI badge; lineup not editable from any post-create surface; scores/handicaps
  stay editable). 74 tests; tsc + eslint + build green.

### Recap → settle + scorecard + durable ledger  ✅ (first cut)
- ✅ **Ledger migration APPLIED** to remote: `20260628120005_ledger_unique.sql`
  (`UNIQUE(event_id, player_id)`) pushed via `supabase db push` (docker warning is
  catalog-cache only; ALTER succeeded).
- ✅ Pure ledger logic (`src/lib/ledger/ledger.ts`): `buildLedgerRows` (one row per
  player, idempotent, paid-flag policy = reset iff amount changed) + `seasonToDate`
  (SUM per player). `useSettleRound` upserts on the unique key; **crewless one-off
  writes no ledger** (structural).
- ✅ Round-results compute (`src/lib/games/round-results.ts`): engines over complete
  holes → per-game detail + combined settlement (sum → minimized payments). Same
  call serves a full 18 and an **end-early** partial.
- ✅ Settle-up screen (`/play/[eventId]/settle`): field strip, who-pays-whom
  (minimized), **by-game toggle only with 2+ games**, **mark-as-paid** (local
  checklist, persisted per event), **season-to-date** per player, end-early banner,
  "Settle & save to ledger".
- ✅ Two-pane scorecard (`/play/[eventId]/card`): frozen name pane + scrolling holes
  (split panes, matched row heights — NOT sticky cells), gross+net per cell, birdie
  ring / double-box, Out/In/Tot, tap-a-cell → hole entry.
- ✅ Recap (`/play/[eventId]/recap`): who-won-what per game, birdies+, final-card
  link, settle CTA. Round-home links to card/recap/settle; score "Done" → recap.
- ✅ Season-to-date **live in the setup picker** ("$0 with this crew" zero state).
- ✅ Tests: ledger idempotency + paid policy + two-round season sum; round-results
  multi-game combined settlement (minimized ≠ pairwise, stakes-off = $0). 87 total;
  tsc + eslint + build green.

### Remaining (UI + persistence)  ⬜
- ⬜ Round home full (single-game hero / 2+ swipe strip).
- ⬜ Hole-entry screen (all players, gross, stroke dots, pick-up, live standings).
- ⬜ Two-pane scorecard (split panes, gross+net, tap-to-jump).
- ⬜ Recap → settle-up (minimized + by-game toggle, mark-as-paid, end-early,
  **writes LedgerEntry**, season-to-date figure).
- ⬜ Local-first in-progress round (Dexie outbox); lock-after-hole-1;
  recompute-on-edit.

---

## Out of scope for Phases 0–1 (build prompt §11)
🚫 Game-scoring engines · live hole-entry & scorecard UIs · realtime score sync ·
settlement engine · multi-group outing UI · stats/records · GHIN · social feed.
Schema/engines that *support* these are in scope; their UIs are Phase 2+.
