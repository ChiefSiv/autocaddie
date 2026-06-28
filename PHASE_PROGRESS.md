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

## Phase 1 — Schema + course data + handicap engine  (IN PROGRESS)

Working the four pieces in order, pausing to verify between each:
**schema → course data → handicap engine → Home.** Folds in the §2.5 durable-
persistence schema (built here since Phase 1 creates the schema).

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

### Piece 2 — Course data  ⬜
- ⬜ `CourseDataProvider` interface (GolfCourseAPI primary, golfapi.io fallback):
  fetch + cache to Supabase; search by name + near-me; manual add/edit.
- ⬜ Fixture course (hard-coded par + stroke index) for offline testing.

### Piece 3 — Handicap engine  ⬜
- ⬜ Course/playing handicap + stroke allocation as tested pure functions (§7).
- ⬜ Full + relative allowance (relative = full − constant, one engine). Vitest.

### Piece 4 — Home + data layer  ⬜
- ⬜ TanStack Query data layer (typed hooks for entities).
- ⬜ Real Home per `golf-games-home.html`.

---

## Out of scope for Phases 0–1 (build prompt §11)
🚫 Game-scoring engines · live hole-entry & scorecard UIs · realtime score sync ·
settlement engine · multi-group outing UI · stats/records · GHIN · social feed.
Schema/engines that *support* these are in scope; their UIs are Phase 2+.
