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

## Phase 1 — Schema + course data + handicap engine  (NOT STARTED)

- ⬜ Full §6 schema migrated to Supabase with RLS; generated types.
- ⬜ TanStack Query data layer (typed hooks for entities).
- ⬜ `CourseDataProvider` interface (GolfCourseAPI primary, golfapi.io fallback):
  fetch + cache to Supabase; search by name + near-me; manual add/edit.
- ⬜ Handicap/stroke engine (§7) as tested pure functions (Vitest).
- ⬜ Build the real Home per `golf-games-home.html`.
- ⬜ Fixture course (hard-coded par + stroke index) for offline testing.

---

## Out of scope for Phases 0–1 (build prompt §11)
🚫 Game-scoring engines · live hole-entry & scorecard UIs · realtime score sync ·
settlement engine · multi-group outing UI · stats/records · GHIN · social feed.
Schema/engines that *support* these are in scope; their UIs are Phase 2+.
