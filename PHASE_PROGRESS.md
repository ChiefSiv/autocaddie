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

## Out of scope for Phases 0–1 (build prompt §11)
🚫 Game-scoring engines · live hole-entry & scorecard UIs · realtime score sync ·
settlement engine · multi-group outing UI · stats/records · GHIN · social feed.
Schema/engines that *support* these are in scope; their UIs are Phase 2+.
