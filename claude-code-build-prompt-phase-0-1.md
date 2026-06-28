# Claude Code Build Prompt — Golf Games Hub · Phases 0–1

> Paste this into Claude Code with the reference files listed in §14 attached to the project.
> Build **only Phases 0 and 1**. Do not build game-scoring logic, the live scoring UI, the
> settlement engine, or multi-group UI yet — those are Phase 2+ (see §11, out of scope).

---

## 0. How to work

You're laying the foundation for a golf games PWA. Work like a careful senior engineer:

1. **Read first.** Before writing code, read the two spec docs and six mockups in §14. They
   are the source of truth for product behavior and visual design.
2. **Living documentation.** Create and continuously maintain `CONTEXT.md` (architecture,
   decisions, how things fit together), `KNOWN_ISSUES.md`, and `PHASE_PROGRESS.md` (checklist
   per phase). Update them as you go — they're session-continuity infrastructure.
3. **Phase discipline.** Finish Phase 0 acceptance criteria before starting Phase 1. Don't
   jump ahead into Phase 2 surfaces.
4. **Match the design exactly.** Every screen must use the token system in §4. Set up the
   Tailwind theme and fonts from it before building any UI.
5. **Ask before deviating.** If a locked decision in §2 seems wrong or a major architectural
   fork appears, pause and ask. Otherwise proceed and note assumptions in `CONTEXT.md`.

---

## 0.5 Prerequisites — the builder provides these before Phase 0

Claude Code cannot create these. Set them up and put secrets in `.env.local`:
- **Supabase project** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and a
  server-only `SUPABASE_SERVICE_ROLE_KEY`.
- **Course-data API key.** Primary: **GolfCourseAPI** (golfcourseapi.com) — `COURSE_API_KEY`
  (server-only); free email signup, transparent tiers. On signup, **verify it returns per-hole
  stroke index + slope/rating for your real courses** — the make-or-break field. Fallback/upgrade:
  **golfapi.io** (`GOLFAPI_KEY`) — broader DB + CSV export, but contact-sales pricing. Claude Code
  reads the chosen provider's current docs for endpoints, auth, and limits.
- **OAuth (optional now):** Apple/Google client IDs, secrets, and redirect URLs. **Recommended:**
  ship Phase 0 with **email + guest only** and add Apple/Google once credentials/redirects are
  ready — Apple sign-in needs a paid Apple Developer account and must not block the foundation.
- **App mark:** a placeholder is fine to start — the flag-pin SVG from the mockups works as the
  PWA icon until there's a real logo.

Claude Code must generate a committed **`.env.example`** listing every expected variable (no values).

---

## 1. Product in one paragraph

A real-time, **offline-capable PWA** where golfers play games against each other during a
round. A host creates a round (or a multi-group outing), players join, the app handles
handicap-fair net scoring, tracks scores live, and produces a combined "who owes whom"
settlement. It's **social scorekeeping with optional stakes**, not a betting app. Most rounds
are one game with one group — that's the simple default; outings, stacked games, and stats
are progressive disclosure.

---

## 2. Locked decisions (non-negotiable)

- **Platform:** installable **PWA**, not native. Reuses the stack in §3.
- **Scoring model:** **solo scorekeeper is the default/first-class path** (one person scores
  for the group); live "everyone on their own phone" is an optional per-group mode.
- **Offline-first:** scoring must work with no signal and never lose data. Local-first writes,
  sync on reconnect.
- **Single game first:** the interface scales to the number of games. One game = no multi-game
  chrome. Stacking games, whole-outing scope, combined settlement, and the by-game settle view
  are progressive disclosure.
- **Stakes are a per-game toggle**, **off by default** (Social mode = standings only; Stakes
  mode = wager + settlement).
- **Money is ledger-only.** Track balances and deep-link to Venmo/PayPal. **Never process
  payments.** Keep the framing "social scorekeeping."
- **Handicaps:** manual entry + saved player profiles now. GHIN (official) is deferred.
- **Course data:** par + **stroke index** per hole + slope/rating, from a **pluggable provider —
  GolfCourseAPI primary, golfapi.io fallback** (see §8) — cached into Supabase. Confirm stroke
  index at setup (the field third-party data most often gets wrong).
- **Joining:** share code / link / QR **and** friends list. **Guests can fully play** without
  an account.
- **Multi-group from the schema:** model **Event → Group → Player** now (a casual foursome is
  an Event with one Group). Games carry a `scope` of `event` or `group`. UI in the MVP is
  single-group, but the schema must support multi-group so Phase 3 is additive, not a migration.
- **Event-wide Skins:** net by default, configurable to gross.
- **Outing group assignment:** organizer-assigns by default, with a self-select toggle.
- **Standalone product**, free at launch. **Nothing gates playing a round** (monetization is a
  far-future phase).
- **Name:** **Autocaddie** (autocaddie.com). Use it as the app/brand name throughout; keep the
  flag-pin mark as the placeholder icon until a final logo exists.

---

## 3. Tech stack (mirror exactly)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Backend / DB | Supabase (Postgres) — Auth, Realtime, Row Level Security |
| Server/client data | TanStack Query |
| Styling | Tailwind v4 |
| Components | shadcn/ui — **base-nova** preset |
| Offline store | IndexedDB via **Dexie** + service worker (**Serwist** or next-pwa) |
| Course data | GolfCourseAPI (primary) / golfapi.io (fallback), behind a provider interface → cached in Supabase |
| Icons | lucide-react |
| Testing | Vitest |
| Hosting | Vercel |

Auth providers: **email + guest** in Phase 0 (guest = no account). Apple and Google are added
once their OAuth credentials are configured (see Prerequisites) — do not block the foundation on them.

---

## 4. Design system — set this up first

Map these into the Tailwind v4 theme as CSS variables with light/dark. The mockups in §14 are
the visual ground truth; pull exact values from there if anything here is ambiguous.

**Light tokens**
```
--fairway:#0E6B3C;  /* brand / structure            */
--flare:#FF5C24;    /* energy, actions, win moments  */
--flare-soft:#FFE7DC;
--ink:#0B1410;      /* text / dark surfaces          */
--chalk:#F6F7F3;    /* app background                */
--up:#1FA85A;  --down:#E0453C;  --carry:#F2A33C;  /* money + carryover semantics */
--bg:var(--chalk); --card:#FFFFFF; --line:#E2E6DE; --text:var(--ink); --muted:#5A6B61; --field:#EEF1EB;
```
**Dark overrides**
```
--bg:#0A0F0C; --card:#121A15; --line:#23302A; --text:#EAF2EC; --muted:#8AA095; --field:#1A241E;
--fairway:#1FA85A; --flare:#FF6E3D; --flare-soft:#3A1E12;  /* up/down/carry unchanged */
```
**Theme:** auto light/dark (follow OS), with the **light theme tuned for sun readability** (high
contrast). User can override in settings.

**Type roles** (Google Fonts)
- **Saira Condensed** (700/800) — display, scores, match status. The "scoreboard" voice.
- **Saira** (500/600) — eyebrows, labels, data captions; uppercase, tracked.
- **Hanken Grotesk** (400–700) — body and UI text.

**Component vocabulary** (reuse everywhere): scoreboard numerals (tabular), the **stroke-index
dot** (orange pip marking a stroke received), the **gross + net cell** (gross big, net small in
Flare where a stroke applies), big athletic status readouts ("2 UP", "DORMIE"), segmented
toggles, the dark "hero" card, ledger rows, chip tags.

**Feel:** bold and sporty, high contrast, **large tap targets** (one-handed, gloved, on a cart),
fewest taps to act. Respect `prefers-reduced-motion`.

**Icons:** lucide-react, stroke-based, to match the line-icon look in the mockups.

**PWA assets:** an app icon set + a maskable icon (placeholder = the flag-pin mark), a splash,
and manifest `theme-color` (Ink `#0B1410` dark / Chalk `#F6F7F3` light). Install must not look broken.

**UI state patterns (define once, reuse):** skeleton loaders (not spinners) for data; empty
states written as invitations ("No rounds yet — start your first"); inline error states with a
retry; toasts for confirmations. All in the token system.

**Scale:** radii — sm 9 / md 13 / lg 16 / xl 20px; one elevation shadow token (`--shadow`); 4px
spacing base. Use consistently rather than ad hoc.

**Layout:** mobile-first; on tablet/desktop, center content in a max-width column (~560–620px),
don't stretch full width.

**Accessibility:** visible `:focus-visible` rings; aria-labels on icon-only controls (nav, the
score stepper); respect large-font / Dynamic Type settings.

---

## 5. Navigation / information architecture

Bottom tab bar, core action in the center:

```
 Home        Rounds      [ + PLAY ]      Friends      You
 dashboard   history      start/join     crews         profile
```

Build the nav shell and routes in Phase 0 (screens can be stubs except Home). **+ Play** is the
Flare primary action that opens start-or-join.

---

## 6. Data model — build the full schema now

Create all of this in Phase 1 (Event→Group→Player included), with RLS policies. Fields are a
starting point; refine types as needed and document in `CONTEXT.md`.

```
User            id, name, email, handicap_index?, ghin_number?, avatar
PlayerProfile   id, owner_user_id, display_name, handicap_index        -- saved "regulars"
Friendship      user_id, friend_user_id, status
RoundTemplate   id, owner_user_id, name, default_group(jsonb), default_games(jsonb)  -- Home "regular games" one-tap

Course          id, external_id, name, location, lat, lng
TeeSet          id, course_id, name, rating, slope, par
Hole            id, tee_set_id, number, par, stroke_index, yardage

Event           id, host_user_id, course_id, tee_set_id, date, join_code, status,
                holes_to_play (9|18), which_nine (front|back)?, starting_hole?   -- 9-hole + shotgun starts
Group           id, event_id, name, scoring_mode (solo|live), scorekeeper_user_id?
RoundPlayer     id, group_id, user_id?|profile_id?|guest_name,
                handicap_index, course_handicap, playing_handicap, team_id?
Team            id, group_id, name

Game            id, event_id, scope (event|group), group_id?, type,
                config(jsonb), stakes_enabled (bool, default false),
                stake, allowance, gross_or_net
HoleScore       id, group_id, round_player_id, hole_number, strokes,
                entered_by, updated_at, version          -- one row per player per hole
GameResult      id, game_id, per-player standings + net amount (0 if stakes_enabled=false)
Settlement      id, event_id, combined net-per-player + minimized txns + per-game breakdown
```

Notes to honor:
- **`scoring_mode` is per Group.** In one outing, one group can use a solo scorekeeper while
  another has everyone on phones.
- **`stakes_enabled=false`** → game still tracks standings/winner, no money.
- **One `HoleScore` row per player per hole** keeps the offline-sync conflict surface small;
  default ownership is the player's own score (or the group scorekeeper in solo mode).
- A **casual round = an Event with one Group**; do not special-case it.
- **Access & RLS model.** Members of an Event read/write within it: accounts via `auth.uid()`,
  **guests via the Event's `join_code` / a round-scoped token**, not user identity. Never gate
  play on having an account, and never leave round data world-readable — scope every policy to
  the Event. Document the exact policies in `CONTEXT.md`.
- **Pick-up / no score.** `HoleScore.strokes` is nullable; support a "picked up / no score"
  state the engine can handle (treated as max or excluded), not a forced number.

---

## 7. Handicap & scoring math (Phase 1 engine — pure, tested functions)

Implement as well-tested pure functions; surface stroke dots in the UI later.

- **Course Handicap** = `round( index × (slope / 113) + (courseRating − par) )`
- **Playing Handicap** = `round( courseHandicap × allowance )`. Two allowance **modes**, set
  as a **round-level setting**:
  - **Full handicap (default):** each player plays their own course handicap. Percentage
    allowances apply per format where relevant (singles match 100%, four-ball 85% stroke /
    90% match, Stableford/individual 95%).
  - **Relative / "low man plays scratch" (toggle):** subtract the lowest player's course
    handicap from everyone, so the low player is scratch and the rest get the difference.
    Mathematically it's full handicap minus a constant — implement as a thin adjustment on
    the same engine, not a separate path. Common in casual money games.
  Default to full handicap so newcomers get the sensible standard; groups pick "relative"
  once and it persists via saved round templates.
- **Stroke allocation by stroke index** (SI 1 = hardest): a player on playing handicap `N`
  gets 1 stroke on each hole with `SI ≤ N`; if `N > 18`, every hole gets 1 plus a 2nd on
  `SI ≤ (N − 18)`. **Net hole score = gross − strokes received that hole.**

Unit-test these against worked examples before wiring to UI. Use **Vitest** for the tests.

---

## 8. Course data integration (Phase 1)

- **Provider abstraction (required):** put all course-data access behind a thin
  `CourseDataProvider` interface (`searchCourses`, `getCourse`) so providers swap via config with
  no rewrite. Ship two implementations: **GolfCourseAPI (primary)** and **golfapi.io
  (fallback/upgrade)**.
- On first use of a course, fetch via the provider and **persist** into Supabase (`Course`,
  `TeeSet`, `Hole`) so all play reads from your DB (offline + API-cost control). Because of this
  cache-on-first-use, call volume is low — the free/cheap tier is fine to start.
- **Verify stroke-index + slope/rating coverage** for real target courses before relying on a
  provider; fall back to golfapi.io or manual entry where the primary is thin.
- **Course search:** by name and **"near me"** (location), recent courses pinned; reads from cache.
- **Manual add/edit fallback** for missing/wrong data, saved back to the DB.
- **Confirm-stroke-index** step surfaced at round setup (Phase 2 will use it; expose the data + a
  confirm affordance now).
- **Read the chosen provider's current docs** for endpoints, auth, and rate limits before integrating.
- Ship a **fixture course** (hard-coded par + stroke index) so the engine and Phase 1 UI are
  testable without live API calls.
- Store the API key server-side; never ship it to the client. GHIN integration is deferred.

---

## 9. Phase 0 — Foundation · deliverables & acceptance

**Deliverables**
- Next.js 16 + TypeScript App Router project; Vercel-ready.
- Supabase wired: client/server helpers, Auth (**email + guest** now; Apple/Google when
  configured), RLS enabled with the §6 access model.
- Committed `.env.example`; all secrets read from env, never hard-coded.
- Tailwind v4 + shadcn/ui (base-nova) + lucide-react configured with the §4 tokens and fonts.
- Auto light/dark theming infrastructure (OS-follow + manual override hook).
- PWA: manifest with app icons (placeholder mark ok), maskable icon, and `theme-color`;
  installable; service worker registered; offline app-shell loads.
- IndexedDB (Dexie) scaffolding for the local-first store (schema stub + read/write helpers).
- Bottom-tab nav shell with all five routes; Home route real, others stubbed.
- `CONTEXT.md`, `KNOWN_ISSUES.md`, `PHASE_PROGRESS.md` created.

**Acceptance:** app installs as a PWA, loads offline (app shell), light/dark switches with the
correct tokens, a user can sign in (email) or continue as guest, and the tab nav routes
work. Living docs reflect what was built.

---

## 10. Phase 1 — Schema + course data + handicap engine · deliverables & acceptance

**Deliverables**
- Full §6 schema migrated into Supabase with RLS policies; types generated for the app.
- TanStack Query data layer over Supabase (typed hooks for the entities above).
- Course-data integration behind the `CourseDataProvider` interface (GolfCourseAPI primary,
  golfapi.io fallback): fetch + cache to Supabase; course search (name + near-me) from cache;
  manual course add/edit fallback.
- Handicap/stroke engine (§7) as tested pure functions.
- Build the Home screen for real per `golf-games-home.html` (greeting + handicap, Start/Join,
  regular-games one-tap shells, friends-on-course placeholder, last-round card).

**Acceptance:** can create an Event (single group) with a real cached course + tee, add players
with indexes, and the engine returns correct course/playing handicaps and per-hole strokes for
worked examples. Home renders in the design system, light and dark.

---

## 11. Explicitly OUT of scope for Phases 0–1

Do **not** build yet: game-scoring engines (Skins/Nassau/Match/Wolf/etc.), the live hole-entry
and scorecard UIs, the realtime sync/broadcast of scores, the settlement engine, multi-group
outing UI, stats/records, GHIN, social feed. Schema and engines that *support* these are in
scope; their UIs and logic are Phase 2+.

---

## 12. Implementation notes & gotchas (record in CONTEXT.md / KNOWN_ISSUES.md)

- **Frozen scorecard column (Phase 2, but design for it now):** implement the scorecard's frozen
  player-name column as **two side-by-side panes** — a fixed name panel that never scrolls and a
  horizontally scrolling holes panel, with **height-matched rows**. Do **not** rely on
  `position: sticky` on table cells, and do **not** use `-webkit-overflow-scrolling: touch` —
  both break the freeze in iOS webviews. (We hit this; see the working pattern in
  `golf-games-scorecard-view.html`.)
- **Offline-first model:** local-first writes to IndexedDB (optimistic UI), a sync queue that
  flushes to Supabase on reconnect, Supabase Realtime to broadcast to other devices, and
  **per-player (or scorekeeper) score ownership** plus last-write-wins on `updated_at` + `version`
  to keep conflicts rare. Course data is fully cached at setup so play never needs a live API call.
- **Scorecard shows gross + net** in every cell (gross big, net small/Flare where a stroke
  applies), with Out/In/Total carrying both.
- **Build Event→Group→Player from the start** even though MVP UI is single-group.
- **Stakes off by default;** keep all betting/wagering language out of the default surface.

---

## 13. Living documentation to create & maintain

- `CONTEXT.md` — architecture, schema overview, key decisions, how pieces connect, assumptions.
- `KNOWN_ISSUES.md` — bugs, gotchas (start with the two in §12), follow-ups.
- `PHASE_PROGRESS.md` — checklist of Phase 0 / Phase 1 deliverables with status.

Keep them current as part of each change, not as an afterthought.

---

## 14. Reference assets (attached to this project)

**Specs**
- `golf-games-hub-spec.md` — product spec v0.3 (principles, decisions, phases, data model).
- `golf-games-screen-spec.md` — page-by-page screen & feature spec (IA, every screen,
  simple-default vs power-underneath).

**Design mockups (the visual ground truth; pull tokens/components from these)**
- `golf-games-visual-direction.html` — palette, type, core components (incl. hole-entry card).
- `golf-games-home.html` — Home / dashboard + bottom nav.
- `golf-games-round-home.html` — single-game hero round view.
- `golf-games-round-setup.html` — round setup (join code, course, players, games + stakes toggle, scoring mode).
- `golf-games-scorecard-view.html` — frozen-column scorecard with gross + net (and the working freeze pattern).
- `golf-games-settle-up.html` — settle-up (who-pays-whom + by-game toggle, ledger-only).

Treat the mockups as the design target and the spec docs as the behavior target. Where they
disagree, ask.

---

## 15. Definition of Done (Phase 0–1)

Note: this foundation will not *feel* finished — there's no gameplay yet, so the app looks
nearly empty. That's expected. "Done" means the base is **proven and correct** so Phase 2
builds on it without rework. Phase 0–1 is complete only when every box below is checked.

**Verify by hand (the builder can test these directly):**
- [ ] Installs to the home screen as an app (PWA).
- [ ] Opens with airplane mode on — the app shell loads, no white screen.
- [ ] Follows OS light/dark; colors are correct in both themes.
- [ ] Sign in (email — plus Apple/Google if configured) works, **and** "continue as guest" works.
- [ ] All five bottom tabs route (Home is real; others may be stubs).
- [ ] Start a round → search a real course by name **and** "near me" → pick a tee → real par
      and stroke-index data load.
- [ ] Add players with handicap indexes; the strokes given look correct — sanity-check against
      a known index at a known course (the math must be right before anything else).
- [ ] Loaded course data stays available with no signal.
- [ ] Home screen matches `golf-games-home.html` in light and dark.

**Make Claude Code prove (guards against Phase 2 rework):**
- [ ] Handicap / stroke-allocation unit tests pass against worked examples — show them green.
- [ ] Schema actually has **Event → Group → Player** and the `Game.scope` field — not a
      flattened single-group version.
- [ ] `KNOWN_ISSUES.md` records the two gotchas: the two-pane frozen column and the
      offline conflict model.
- [ ] The course-data API key(s) are server-side only and never shipped to the client; all
      access goes through the `CourseDataProvider` interface.

**Green light to Phase 2:**
- [ ] All boxes above checked.
- [ ] `PHASE_PROGRESS.md` marked complete for 0–1, with a short completion report written
      against the §9 and §10 acceptance criteria.
- [ ] `CONTEXT.md` skimmed — the locked decisions in §2 were honored.
- [ ] Handicap math verified correct and the schema confirmed multi-group-ready.

When all three groups are green, the foundation is solid and Phase 2 (game engines, live
scoring, settlement) can begin.
