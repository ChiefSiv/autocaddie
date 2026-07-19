# Autocaddie — CONTEXT

> Living architecture doc. Update this as part of every change, not after.
> Companion docs: [KNOWN_ISSUES.md](KNOWN_ISSUES.md), [PHASE_PROGRESS.md](PHASE_PROGRESS.md).

## Status

**Phases 0 and 1 complete; Phase 2 (gameplay) in progress.** Foundation (PWA,
auth, theming), full schema + durable persistence + RLS (applied to Supabase),
CourseDataProvider + cache, handicap/stroke engine, and the real Home + TanStack
data layer are all built and verified. **Phase 2 started engines-first:** the
Skins / Nassau / Match Play game engines + the settlement engine are built as
pure, tested functions (`src/lib/games/`), GREEN before any UI — see
[claude-code-build-prompt-phase-2.md](claude-code-build-prompt-phase-2.md).
The full Phase 2 path is built: **setup + SI gate** (`/play`), **hole-entry +
live scoring + local-first** (`/score`), **recap** (`/recap`), **two-pane
scorecard** (`/card`), and **settle-up with the durable ledger written on settle**
(`/settle`). The `ledger_unique` migration is applied to remote. Remaining polish:
full round-home hero/strip.

**Open items to carry into Phase 2:**
1. **Manual stroke-index entry is a MANDATORY core path.** Real courses (e.g.
   Graywolf) return empty per-hole stroke indexes from GolfCourseAPI, so
   round-setup must let the scorekeeper confirm/enter SI before scoring;
   `allocateStrokes` throws until SI is complete (gate with
   `holesMissingStrokeIndex` / `CachedCourse.needsStrokeIndex`).
2. **`SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is currently the anon key** —
   replace with the real service-role secret for any RLS-bypass task. Course
   caching deliberately uses the authenticated client, so nothing is blocked.

## What this is

A real-time, **offline-capable PWA** where golfers play games against each other
during a round: handicap-fair net scoring, live tracking, and one combined
"who owes whom" settlement. **Social scorekeeping with optional stakes**, not a
betting app. Most rounds are one game with one group — that's the simple
default; outings, stacked games, and stats are progressive disclosure.

Source of truth: `claude-code-build-prompt-phase-0-1.md` (build instructions),
`golf-games-hub-spec.md` (product), `golf-games-screen-spec.md` (screens), and
the six `golf-games-*.html` mockups (visual ground truth). Where mockups and
specs disagree, ask.

## Tech stack (as built)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js **16.2.4** (App Router) + TypeScript | `src/` dir, `@/*` alias |
| UI runtime | React 19.2 | |
| Styling | Tailwind **v4** (CSS-first `@theme`) | tokens in `globals.css` |
| Components | shadcn/ui (base-nova) + lucide-react | added Phase 0 |
| Data layer | TanStack Query | typed entity hooks land Phase 1 |
| Backend | Supabase (Postgres, Auth, Realtime, RLS) | |
| Offline store | Dexie (IndexedDB) + Serwist service worker | |
| Course data | GolfCourseAPI primary / golfapi.io fallback, behind a provider interface, cached in Supabase | Phase 1 |
| Testing | Vitest | |
| Hosting | Vercel | |

## Locked decisions honored (build prompt §2)

- **PWA**, not native. Installable; offline app-shell.
- **Solo scorekeeper is the default** scoring path; live multi-phone is optional
  (per-Group `scoring_mode`).
- **Offline-first**: local writes to IndexedDB, sync on reconnect (scaffolded).
- **Single game first**: UI complexity scales to number of games.
- **Stakes are a per-game toggle, off by default.**
- **Money is ledger-only** — never process payments.
- **Handicaps**: manual entry + saved profiles; GHIN deferred.
- **Multi-group from the schema**: Event → Group → Player modeled from Phase 1;
  `Game.scope` is `event | group`. MVP UI is single-group.
- **Joining**: share code / link / QR + friends list; **guests can fully play.**
- **Auth (Phase 0)**: email (magic link) + **guest = Supabase Anonymous Auth.**
  Apple/Google deferred until OAuth creds/redirects are ready.
- **Name/brand**: Autocaddie; flag-pin mark is the placeholder icon.

## Decisions made during the build (with rationale)

- **Guest auth = Supabase Anonymous sign-ins** (chosen with the builder over a
  custom round-scoped token). Gives each guest a real `auth.uid()` session that
  upgrades to email later, and lets RLS treat guests and accounts uniformly.
  The spec's round-scoped-token model (guests authorized via a join code) is
  still the plan for *cross-device* guest play in Phase 1+ RLS; for Phase 0 a
  single guest device just needs a session. ⚠️ Requires "Anonymous sign-ins"
  enabled in the Supabase dashboard.
- **PWA service worker = Serwist** (`@serwist/next`), chosen over next-pwa for
  App Router support. SW source: `src/app/sw.ts`, compiled to `public/sw.js`.
  **Disabled in dev** so HMR isn't fighting a SW. Serwist's plugin is
  webpack-based and Turbopack isn't supported yet (serwist#54), so **`npm run
  build` = `next build --webpack`**; dev stays Turbopack.
- **shadcn/ui (base-nova) semantic tokens are DERIVED from our palette** in
  `globals.css` (`--primary: var(--fairway)`, `--background: var(--bg)`, …) so
  shadcn components are on-brand and theme-correct without a `.dark` block. The
  one name collision — our `--muted` is a *text* color, shadcn's is a surface —
  is resolved in our favor (documented in KNOWN_ISSUES).
- **npm behind SSL inspection** on the dev machine — installs use
  `NODE_OPTIONS=--use-system-ca` (Node 24) to avoid `UNABLE_TO_VERIFY_LEAF_
  SIGNATURE` crawl. See KNOWN_ISSUES.
- **Theming = CSS variables + `[data-theme]` attribute**, not Tailwind's default
  `dark:` class strategy. A no-flash inline script (`theme-script.ts`) sets the
  attribute before paint. A custom Tailwind `dark:` variant (in `globals.css`)
  is wired to match the same condition (forced dark, or OS-dark when not forced
  light) so `dark:` utilities stay consistent with the token theme.
- **Package manager = npm.** Tailwind v4 CSS-first config (no `tailwind.config.js`).
- **Phase 0 offline scope = app shell only.** Full local-first data sync is
  Phase 1+; the `/offline` route is the document fallback.

## Project structure (Phase 0)

```
src/
  app/
    layout.tsx           # fonts, theme bootstrap, providers, app shell, nav
    page.tsx             # Home (real-ish; real data wired Phase 1)
    globals.css          # §4 design tokens -> Tailwind v4 @theme, dark variant
    manifest.ts          # /manifest.webmanifest (PWA)
    sw.ts                # Serwist service worker source
    offline/page.tsx     # offline app-shell fallback
    signin/page.tsx      # guest-first sign-in (email magic link + anonymous)
    auth/callback/route.ts  # exchanges magic-link/OAuth code for session
    rounds|friends|play/page.tsx  # stubs
    you/page.tsx         # settings: theme, account status, sign out (real)
  components/
    providers/providers.tsx   # QueryClient + ThemeProvider
    theme/                     # theme-script, theme-provider (useTheme), theme-toggle
    nav/                       # bottom-nav, app-header
    auth/auth-gate.tsx         # requires a session (guest or account)
    ui/                        # section, empty-state, stub-page
  lib/
    env.ts               # public vs server-only env access
    supabase/            # client, server, admin (service role), middleware
    auth/use-user.ts     # live auth user via onAuthStateChange
    db/                  # Dexie schema (dexie.ts) + read/write helpers (index.ts)
  proxy.ts               # Next 16 "proxy" convention — refreshes session cookie
scripts/gen-icons.mjs    # rasterizes SVG -> PNG app icons (npm run gen:icons)
```

## Theming model (important)

- `globals.css` defines **light tokens** on `:root`. Dark tokens apply when the
  OS prefers dark **and** the user hasn't forced light, **or** when
  `[data-theme="dark"]` is set. Preference values: `light | dark | system`.
- `@theme inline` maps tokens (`--bg`, `--card`, `--fairway`, `--flare`, …) to
  Tailwind colors so utilities like `bg-card`, `text-muted`, `bg-flare` follow
  the live theme. Radii: `rounded-sm/md/lg/xl` = 9/13/16/20px. Shadow:
  `shadow-card`. Fonts: `font-display` (Saira Condensed), `font-label` (Saira),
  body default is Hanken Grotesk.

## Auth flow

1. Unauthenticated visit → `AuthGate` redirects to `/signin`.
2. `/signin`: **Start playing** = `signInAnonymously()` (guest); **email +
   password** = `signInWithPassword` / `signUp` (default); **magic link** =
   `signInWithOtp` → `/auth/callback` exchanges the code (kept as an alternative).
   OAuth still deferred. Session lives in **cookies** (`createBrowserClient`), so the
   `proxy.ts` refresh keeps it alive across visits/restarts; `useUser` falls back to
   the local session offline.
3. `proxy.ts` (`updateSession`) refreshes the session cookie on each request.
   Nothing gates *playing* — a guest session is enough.

## Data model (Phase 1 — `supabase/migrations/`)

The schema is three ordered migrations: `…_identity_crews`, `…_course_data`,
`…_events_play_ledger`. It implements build-prompt §6 **plus** the durable-
persistence model from Phase 2 build prompt §2.5 (folded into Phase 1, since
Phase 1 is where the schema is created).

**Entities**

- Identity / durable: `profiles` (1:1 with `auth.users`, accounts + anon guests),
  `crews`, `crew_members`, `players` (durable, managed-vs-linked), `friendships`,
  `round_templates`.
- Course cache: `courses`, `tee_sets`, `holes` (par + per-hole stroke index +
  slope/rating; cache-on-first-use).
- Event / play: `events` (a round; `crew_id` nullable), `event_members` (access
  control), `groups` (tee group within an event), `teams`, `round_players`
  (→ durable `player_id`), `games`, `hole_scores` (one row per player/hole;
  `strokes` nullable = pick-up; retained), `game_results`, `settlements`,
  `ledger_entries` (durable, crew-scoped).

### Durable-persistence decisions (cross-phase — §2.5; do not regress)

1. **Durable Player identity, never free text.** `players` is a persistent
   identity that accrues a record. A managed player has `linked_user_id = null`
   (no login; you score for them; can link to a real account later); a linked
   player points at an `auth.users` id. Quick-add **creates or reuses a managed
   `Player`** under the crew — there is **no `guest_name` string** anywhere.
   `round_players` reference `player_id` and snapshot that round's handicaps.
2. **Crew ≠ Group.** `crews` are durable rosters that persist *across* rounds;
   `groups` are tee groups *within* one event. Distinct tables, never conflated.
3. **Round belongs to a Crew.** `events.crew_id` is **nullable**: crew is the
   default at setup but a **crewless one-off** is allowed and simply **does not
   accrue to any ledger**.
4. **Stored ledger.** `ledger_entries` is written on settle/end-early (Phase 2),
   so season-to-date net is a trivial `SUM(amount)` per player per crew.
   `crew_id` is `NOT NULL` → crewless rounds write no entries.
5. **HoleScores retained** durably (not cleared after a round) so any record is
   reconstructable.
6. **Deferred verbs (data now, UI later):** season-standings UI, head-to-head,
   settle-the-season, historical recaps/analytics. Phase 2 surfaces only a single
   read-only season-to-date figure. Do not build the verb UIs early.

### Allowance mode (round-level)

`events.allowance_mode ∈ {full, relative}` — a **round-level** setting (default
`full`; `relative` = "low man plays scratch"). The handicap engine implements
`relative` as a thin adjustment on the same code path (full course/playing
handicap **minus a constant** = the field's lowest), not a separate engine.
`games.allowance` is a separate per-game *format* multiplier (e.g. 0.85 four-ball).

### RLS model

Two scopes, both honoring "never gate play on an account; never world-readable":

- **Event-scoped** (`events` and children: `groups`, `teams`, `round_players`,
  `games`, `hole_scores`, `game_results`, `settlements`): a user has access iff
  they are an **event member** (`event_members`) or a member of the event's crew.
  The host is auto-added on insert (trigger). **Guests join via `join_code`**
  through the `join_event_by_code(code)` SECURITY DEFINER RPC, which inserts the
  caller (account *or* anonymous uid) into `event_members`; normal event-scoped
  RLS then applies. No raw join-code-in-policy.
- **Crew-scoped** (`crews`, `crew_members`, `players`, `ledger_entries`): a crew
  member (and owner) may read/write the crew's roster and ledger across all its
  events (broader than per-event, required for season-to-date).
- Recursion is avoided with SECURITY DEFINER helpers `is_crew_member()`,
  `is_event_member()`, `can_access_group()` (they bypass RLS internally).
- Anonymous-auth guests are role `authenticated`, so all `to authenticated`
  policies apply to them — guest play keeps working.
- `profiles` are self-only; a profile row is auto-created by trigger on every new
  `auth.users` row (accounts + anonymous).

### Course data (Phase 1 Piece 2 — `src/lib/courses/`)

- **Provider interface** (`types.ts`): `searchCourses(query)` + `getCourse(id)`,
  returning normalized shapes. Two implementations behind it:
  `providers/golfcourseapi.ts` (**primary, tested**) and `providers/golfapi.ts`
  (**fallback, UNVERIFIED** — implemented to golfapi.io v2.3 docs but no key to
  test). `provider.ts` selects via `COURSE_DATA_PROVIDER` (server-only; keys
  never reach the client).
- **Cache-on-first-use** (`cache.ts`): `getOrCacheCourse(db, providerId)` fetches
  via the provider and persists into `courses`/`tee_sets`/`holes`, then reads
  from the DB thereafter. **Writes use the request's authenticated client** (the
  course-data RLS allows authenticated writes) — *not* the service role; least
  privilege. `searchNearbyCachedCourses(db, lat, lng)` does "near me" over cached
  coords (provider search is name-only). `createManualCourse(db, …)` is the
  manual add/edit fallback (provider `"manual"`).
- **API routes** (`src/app/api/courses/`): `search?q=`, `[providerId]` (cache),
  `nearby?lat=&lng=` — each requires a session; provider key stays server-side.
- **GolfCourseAPI specifics:** auth `Authorization: Key <COURSE_API_KEY>`;
  `GET /v1/search?search_query=` (holes trimmed to par/yardage — **no SI**),
  `GET /v1/courses/<id>` (full tees, grouped `male`/`female`). **Search is
  near-exact** ("Graywolf" hits; "Gray Wolf"/"Graywolf Golf" do not) → the UI
  must hint + offer manual add.
- **Stroke-index reality (important):** per-hole `handicap` (stroke index) is
  *frequently absent* — verified: Graywolf (7028) has none on any of its 5 tees,
  though slope/rating/par/yardage are all present. We map missing SI → `null` and
  set `CachedCourse.needsStrokeIndex`. The **confirm-stroke-index step + manual
  entry are mandatory**, not optional. golfapi.io may have better SI coverage —
  reason to finish that fallback when a key is available.
- **Fixture course** (`fixture.ts`): "Autocaddie Test Links", par 72 with a full
  1..18 SI permutation — for engine tests + offline.

### Handicap engine (Phase 1 Piece 3 — `src/lib/handicap/engine.ts`)

Pure, tested functions (the math spine; stroke-dot UI comes later):
- `courseHandicap({index, slope, rating, par})` = round(index×slope/113 +
  (rating−par)). `playingHandicap(courseHcp, allowance=1)` applies the per-game
  format allowance.
- `strokesOnHole(handicap, strokeIndex)` / `allocateStrokes(handicap, holes)` —
  SI 1 = hardest; one formula covers N≤18, N>18 (a 2nd stroke on SI≤N−18), and
  **plus handicaps** (strokes given back on the easiest holes). Allocated strokes
  always sum to the handicap. **`allocateStrokes` THROWS if any hole's SI is
  null** (naming the gap) rather than silently mis-/under-allocating — SI is
  course data finalized at setup; gate with `holesMissingStrokeIndex()` first.
- **Order of operations:** per-game format allowance first (`playingHandicap`),
  then round-level relative (`applyAllowanceMode` subtracts the field min).
- `netScore(gross, strokes)` — null gross (pick-up) → null.
- **Allowance mode is round-level** (`events.allowance_mode`): `applyAllowanceMode`
  implements `relative` ("low man plays scratch") as **full handicap minus a
  constant** (the field's lowest playing handicap) — one engine, a thin
  adjustment, not a separate path. `full` is identity. `computeRoundHandicaps`
  ties it together for a field.

### Applying & types

Apply via `supabase db push` (atomic, tracked) after `supabase link`, or paste
the three files into the dashboard SQL editor in order. **Generated types** come
from `supabase gen types typescript` after the migration is applied (regenerate
whenever the schema changes) → `src/lib/supabase/database.types.ts`; the clients
then use `createClient<Database>()`.

### Game engines (Phase 2 — `src/lib/games/`)

Pure, tested functions; **GREEN before any UI** (build prompt §6). Each engine
consumes scores **already netted upstream** (gross − strokes received, via the
handicap engine using the round's allowance mode) — engines see numbers only,
`null` = pick-up. Each returns per-player signed `nets` that **sum to ~0** across
participants (all 0 when stakes off) plus a typed `detail` for UI/recap. Shared
contract + helpers in `types.ts` (`HoleScores`, `Side`, `Stakes`, `roundMoney`,
`sideNetOnHole`). Money math runs in **integer cents** to avoid float drift.

- **Skins** (`skins.ts`) — whole group; one skin/hole; carryovers on by default.
  Lowest net wins outright; tie carries & grows the pot; pick-up can't win. Net
  math: an awarded pot covering *k* holes is fed by exactly `stake × nPlayers × k`
  of ante, so it nets to zero. **Terminal unclaimed pot rule (decided):** if the
  round ends mid-carry, the dead pot is **voided and its antes refunded** (we only
  charge ante for holes belonging to an *awarded* pot) → Σnet = 0 even mid-carry.
  Carryover-off: a tie voids just that hole.
- **Match Play** (`match.ts`) — 1v1 (sides), net, hole-by-hole. Pick-up = hole
  loss; both pick up = halve. **Closeout is STRICT (`lead > remaining`)**: dormie
  (`lead == remaining`, e.g. 2 up / 2 to play) stays **open**; being ahead on the
  *final* hole (remaining 0) reads "X up", not "X & 0". Result strings: "3 & 2",
  "2 up", "Halved". `compareHole` is shared with Nassau.
- **Nassau** (`nassau.ts`) — two sides, net. 18 holes → **three independent bets**
  (front 9 / back 9 / total 18), each the side that won more holes over the
  segment (level = halved, no money). **9-hole round collapses to a single bet**
  (`holesToPlay === 9`, no front/back/18 split). No presses (v1).
- **Sides** can hold multiple players (best-ball: side's hole net = lowest among
  its players; side's net split evenly). v1 UI picks single-player sides; the
  aggregation is there so team formats drop in later without re-architecting.

### Live scoring + hole-entry (Phase 2 — `scoring.ts`, `live.ts`, `/score`)

- **`scoring.ts`** bridges raw GROSS entry to net + the engines. Tri-state per
  (player, hole): **number = score, `null` = pick-up, `undefined` = not entered.**
  The null-vs-0 distinction is load-bearing (0 is a real score; pick-up must be
  null). Net = gross − strokes received, allocated from `round_players.playing_
  handicap` (allowance already applied at setup) across the played holes by SI.
  Only **complete holes** (every player entered) feed the engines, so a
  half-entered hole never skews live standings.
- **`live.ts`** runs the engines over complete holes for the on-screen strip.
  Match uses the new optional **`MatchInput.totalHoles`** (defaults to
  `holes.length`) so mid-round status reads "2 up thru 13" rather than a false
  closeout; final settlement passes all scheduled holes and is unchanged.
- **Hole-entry** (`/play/[eventId]/score`): all players on one hole, gross stepper,
  stroke dots, one-tap pick-up (writes null) + undo, next/back (no auto-advance),
  edit-recompute (derived each render), live standings strip.
- **Local-first** (`src/lib/db/index.ts` `flushOutbox`/`hydrateHoleScores` +
  `useRoundScores`): IndexedDB is the UI's source of truth (optimistic, offline,
  restart-safe); the outbox upserts to Supabase on the natural key
  (`group_id,round_player_id,hole_number`) when online; hydration pulls remote on
  load. Last-write-wins on `updated_at`+`version`; pick-up `null` preserved through
  sync. **Lock-after-hole-1** = the round's first hole has any entry (lineup fixed;
  scores/handicaps stay editable).

### Recap / scorecard / settle + ledger (Phase 2 — `/recap`, `/card`, `/settle`)

- **`round-results.ts`** (pure) runs the engines over complete holes → per-game
  detail (skins won/pot, nassau segments, match result) + combined settlement (sum
  every game's nets → `minimizePayments`). Same call serves a finished 18 and an
  **end-early** partial (it uses whatever holes are complete). `round-compute.ts`
  (client) adapts a `RoundView` + local scores into it.
- **`ledger.ts`** (pure): `buildLedgerRows` emits one row per player (idempotent),
  paid-flag policy = reset iff amount changed else preserve; `seasonToDate` = SUM
  per player. **`useSettleRound`** upserts on `UNIQUE(event_id, player_id)` (migration
  applied) and **writes nothing for a crewless one-off**. Status → `completed`.
- **Settle-up** (`/settle`): minimized who-pays-whom (default), by-game toggle (only
  with 2+ games), **mark-as-paid** (local checklist in `localStorage` per event —
  not synced; "we just track it"), per-player **season-to-date**, end-early banner.
- **Scorecard** (`/card`): two-pane frozen column (split panes + matched row
  heights, NOT sticky cells, NO `-webkit-overflow-scrolling`), gross+net per cell,
  birdie ring / double-box, Out/In/Tot, tap-a-cell → that hole's entry.
- **Recap** (`/recap`): who-won-what per game + birdies+, links to card and settle.
- Season-to-date is now live in the **setup picker** too ("$0 with this crew").

### Settlement engine (Phase 2 — `src/lib/games/settlement.ts`)

Sums each game's per-player nets → one net per player, then **minimizes payments**
(greedy largest-creditor vs largest-debtor; ≤ n−1 transactions; deterministic
sort for stable output). `byGame` is a passthrough that, per player, sums to the
same net as the minimized view (test-guarded). **Pure — it computes, it does not
persist;** the caller writes the ledger. Cents throughout.

**Ledger idempotency (decided; additive migration `…_ledger_unique`).**
`ledger_entries` gets `UNIQUE (event_id, player_id)`; the settle write **upserts
`ON CONFLICT (event_id, player_id) DO UPDATE`** so a re-settle or a
settle-after-end-early **structurally cannot double-write** (no season-to-date
inflation). **Paid-flag policy on re-settle:** reset `paid → false` **iff the
amount changed**, else preserve it (a corrected debt must be re-acknowledged; an
unchanged one keeps its acknowledgement). Fail-loud, matching the handicap
engine's throw-on-missing-SI. The canonical upsert SQL lives in the migration.

### Round setup + play UI (Phase 2 — `src/app/play/`, `src/components/setup/`)

- **`/play`** = round setup (`RoundSetup`). Client data hooks in
  `src/lib/queries/` (`crews.ts`, `courses.ts`, `rounds.ts`, extended
  `events.ts`): crews + durable players (quick-add = managed `Player`, **never
  free text**), cached-course list + near-exact provider search →
  cache-on-first-use, and `useCreateRound` (event → group → round_players with
  engine-computed handicaps → games; sides mapped player_id → round_player id;
  status `active`).
- **Stroke-index gate** (`stroke-index-gate.tsx`) is the enforced realization of
  the mandatory-SI decision: rendered whenever the chosen tee has any null SI,
  it blocks **Start round** until a complete 1..N permutation is saved to
  `holes.stroke_index`. Mirrors `allocateStrokes`' throw-on-missing-SI at the UI.
- **State pattern:** setup avoids `setState`-in-effect (lint rule
  `react-hooks/set-state-in-effect`) by **deriving** defaults — `crewId` from
  `crewChoice ?? crews[0]`, `teeSetId` from `teeChoice ?? tees[0]`, selected
  players filtered against the live roster — rather than syncing via effects.
- **`/play/[eventId]`** = round home (first cut): join code, players w/ course &
  strokes handicaps, games. "Enter scores" stubbed until hole-entry lands.
- **Deferred to later steps:** join code is shown post-create (not during setup —
  multi-phone join is Phase 3); `RoundTemplate` prefill; the season figure is
  wired but reads 0 until the settle step writes the ledger.

## Open assumptions / to revisit

- Course provider: GolfCourseAPI is primary (golfapi.io fallback, unverified).
  Per-hole stroke index is **frequently absent** (verified: Graywolf returns none
  on any tee) → flagged via `CachedCourse.needsStrokeIndex`. The confirm/enter-
  stroke-index step at round setup is **mandatory**, not optional; `allocateStrokes`
  throws until SI is complete.
- **Course-data RLS is permissive** (any authenticated user may insert/update
  `courses`/`tee_sets`/`holes`) since it's a shared cache in a single-tenant
  personal app. Revisit (creator-scoped writes / service-role-only) if this ever
  goes multi-tenant.
- Apple/Google OAuth deferred; `.env.example` lists the vars commented out.
