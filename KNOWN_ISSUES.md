# Autocaddie — KNOWN ISSUES & GOTCHAS

> Bugs, traps, and follow-ups. Details for each item live in the sections below;
> this top ledger is the single "what's owed" view.

## 📒 Deferred ledger — what's owed, by recommended phase (Phase 2 close-out)

Everything intentionally deferred during Phase 2, one place. Nothing here blocks
the playable end-to-end path; these are surfaces/polish/robustness.

**Phase 3 — first, for practical use**
- **No round-history browsing UI.** `/rounds` is still the Phase 0 stub, so a
  settled round can only be reopened by its `event_id` URL. **Data persists
  correctly** (events, hole_scores, ledger, season-to-date all durable) — only the
  browsing surface is missing. Deferred per §3, but it's the **first thing Phase 3
  needs** to be usable across rounds (list recent/settled rounds → open card/settle;
  a per-crew ledger/season view is the natural companion).
- **Round-home is a "first cut."** Not the full §8 single-game hero / 2+ swipe
  strip; today it lists players/games/join-code + nav. Functional, needs polish.
- **Live multi-phone sync + join-by-code UI.** Schema (`join_code`,
  `join_event_by_code` RPC, per-group `scoring_mode`) exists; the join screen and
  realtime broadcast are Phase 3 (single-device solo is the Phase 2 model).

**Phase 2.x — small, high-value follow-ups**
- **Edit-round escape hatch** (confirmation-gated) for genuine setup errors (wrong
  tee/player) after the hole-1 lineup lock.
- **In-round handicap editor** — spec says handicaps stay editable post-lock;
  currently they're snapshotted at setup with no in-round editor (scores ARE
  editable). Build with the escape hatch.
- **Skins gross toggle** — Skins is net-locked in the UI; spec allows gross-optional.
- **`RoundTemplate` prefill** at setup (schema + Home cards exist; setup ignores it).
- **Graywolf duplicate "White" tee** — cache-dedup gap in `courses/cache.ts` or the
  provider mapping; add a unique-on-(course,name[,gender]) guard + de-dup.
- **Mark-paid multi-payment edge** — per-player ledger storage means a *partially*
  paid multi-payment debtor reads unpaid on another device until fully settled
  (fine for ≤4 players / one payment each).

**Later / when unblocked**
- **golfapi.io fallback UNVERIFIED** — coded to v2.3 docs, no key to test; finish
  when a key exists (may also cover stroke index better than GolfCourseAPI).
- **`SUPABASE_SERVICE_ROLE_KEY` is the anon key** in `.env.local` — replace with the
  real secret for any RLS-bypass task (nothing blocked today).
- **9-hole stroke allocation** spreads the full playing handicap across the 9 played
  holes' course SIs (slightly generous vs a proper 9-hole halving) — exact if needed.
- **`settlements` table unused** — settle recomputes from scores + writes
  `ledger_entries`; a combined-JSON snapshot row is optional record-keeping.
- **Real PNG app icons** from the SVG; **self-host fonts** to drop the build-time
  fetch (both minor).

---

## 🔒 Designed-for-now gotchas (build prompt §12)

### 1. Frozen scorecard column — use two side-by-side panes, NOT sticky cells
The scorecard (Phase 2) needs a frozen player-name column while the holes scroll
horizontally. **Do not** rely on `position: sticky` on table cells, and **do not**
use `-webkit-overflow-scrolling: touch` — both break the freeze in iOS webviews
(we hit this).

**Working pattern** (see `golf-games-scorecard-view.html`): two side-by-side
panes inside a flex row —
- a **fixed name panel** (`flex: 0 0 auto`) that never scrolls, and
- a **horizontally scrolling holes panel** (`flex: 1 1 auto; overflow-x: auto`),
- with **height-matched rows** in both panes (identical `tr` heights: header
  40px, par/SI 28px, player rows 52px) so rows line up exactly.

The name pane gets a right-edge shadow to imply the freeze. Out/In/Total columns
live in the scrolling pane.

### 2. Offline-first / sync conflict model
- **Local authority:** each device writes to IndexedDB first (optimistic UI,
  offline-safe). Scaffolded in `src/lib/db/`.
- **Score ownership:** one `HoleScore` row per player per hole. Default owner is
  the player's own score, or the group scorekeeper in solo mode → keeps the
  conflict surface tiny.
- **Conflict resolution:** last-write-wins on `updated_at` + `version`. Diverging
  scores are flagged to the host rather than silently dropped.
- **Sync:** a queued **outbox** (Dexie `outbox` table) flushes to Supabase on
  reconnect; Supabase Realtime broadcasts to other devices.
- **Course data** is fully cached into Supabase at setup so play never needs a
  live API call.
- **Pick-up / no score:** `HoleScore.strokes` is nullable — support a "picked up"
  state (treated as max or excluded), never a forced number. (`LocalHoleScore.
  strokes` is `number | null`.)

## ⏸️ "Failed to fetch" on any auth/data call = PAUSED Supabase project

Free-tier Supabase projects **pause after ~1 week idle**. While paused, every
auth/data request (sign-in, RLS reads, ledger writes) fails with a generic
**"Failed to fetch"** / network error — the client can't reach the project at all.
This is NOT a code, CORS, TLS, or env bug. **Recovery: resume the project from the
Supabase dashboard** (Project → Resume), wait ~1 min, retry. Don't re-diagnose it as
a client bug. (Guest/session code degrades gracefully — `useUser` falls back to the
local session — but no *new* auth or data call can succeed until the project is up.)

## ⚠️ Phase 0 setup requirements (builder action needed)

- **Supabase → Auth → Providers:** enable **Anonymous sign-ins** (guest play) and
  the **Email** provider. The Email provider covers BOTH magic link and
  **email+password** (`/signin` now offers password sign-in + create-account, with
  magic link as an alternative). For password testing convenience, consider turning
  **"Confirm email" OFF** (Auth → Providers → Email) so `signUp` returns a session
  immediately; with it ON, create-account sends a confirmation email first. Without
  anonymous sign-ins, "Start playing" returns an error.
- **`.env.local`** must be populated from `.env.example` before the app can talk
  to Supabase. `NEXT_PUBLIC_SUPABASE_URL` must be a **full** `https://<ref>.supabase.co`
  URL. If it's missing or malformed, the app **degrades gracefully** — the proxy
  and `useUser` no-op (treated as signed out) instead of throwing
  "Invalid supabaseUrl" — but auth stays off until a valid URL + anon key are set.
  (Guarded via `hasSupabaseEnv()` in `src/lib/env.ts`.)
- **Magic-link redirect:** `NEXT_PUBLIC_SITE_URL` must match the origin and be
  added to Supabase Auth → URL Configuration → Redirect URLs.

## 🔑 Config: `SUPABASE_SERVICE_ROLE_KEY` is wrong in `.env.local`
The value currently in `SUPABASE_SERVICE_ROLE_KEY` is actually the **anon key**
(decoded role `anon`, identical to `NEXT_PUBLIC_SUPABASE_ANON_KEY`). The
service-role admin client therefore does **not** bypass RLS. Course caching was
refactored to use the authenticated client (so it doesn't need it), but **fix
this** for any future RLS-bypass task: paste the real service-role secret from
Supabase → Project Settings → API. Until then `createAdminClient()` behaves like
an anon client.

## ⛳ GolfCourseAPI: stroke index is often missing; search is near-exact
- **Per-hole stroke index (`handicap`) is frequently absent.** Verified: Graywolf
  (id 7028) returns slope/rating/par/yardage on all 5 tees but **no stroke index
  on any hole**. We map missing SI → `null` and flag `needsStrokeIndex`. The
  **confirm-stroke-index step and manual entry are mandatory** (Phase 2 setup),
  not nice-to-haves. golfapi.io (fallback) may cover SI better — finish that
  provider when a key is available.
- **Search is near-exact / single-token:** "Graywolf" matches; "Gray Wolf" (space)
  and even "Graywolf Golf" return 0. The search UI must hint at exact spelling and
  offer **manual add** as a fallback.
- **golfapi.io provider is UNVERIFIED** — coded to its v2.3 docs but untested (no
  key). Primary path (GolfCourseAPI) is the tested one.
- Search responses **trim holes** to `{par, yardage}` (no SI) — always call
  `getCourse(id)` (cache-on-first-use) for the full tee/hole data.

## ➡️ Phase 2 carry-forward (decided)

- **Manual stroke-index entry is a MANDATORY core path, not optional.** Real
  courses (e.g. Graywolf) come back with empty stroke indexes from GolfCourseAPI,
  so Phase 2 round-setup must let the scorekeeper enter/confirm per-hole SI before
  net scoring — treat it as a first-class step, gated on `needsStrokeIndex`. The
  `createManualCourse` helper + the `holes.stroke_index` column already support it.
- Graywolf (provider `golfcourseapi`, external_id `7028`) is **left cached** in
  the DB as a convenience test course (5 tees; SI null → exercises the manual path).

## 📋 Phase 1 prerequisites / follow-ups

- ✅ **GolfCourseAPI coverage verified** for a real course (Graywolf): slope /
  rating / par / yardage present; **stroke index absent** → manual entry path
  (above). Fall back to golfapi.io or manual where thin.
- Generate real PNG app icons from the SVG (see Phase 0 note below).
- Wire the real Home (handicap index + trend, regular games, recent round) to
  live data per `golf-games-home.html`.

## 🐞 Active issues / accepted risks

- **Moderate npm audit: PostCSS XSS in CSS stringify** — lives in Next's *own
  bundled* `node_modules/next/node_modules/postcss`, so we can't dedupe it; only
  relevant when processing untrusted CSS (we don't). Clears when Next bumps its
  bundled copy. Forcing a fix would push Next outside its version range. Left as-is.

## ⚙️ Environment / toolchain gotchas

- **TLS on this network — use `--use-system-ca` for anything that fetches.** The
  dev machine sits behind SSL inspection; Node hit `UNABLE_TO_VERIFY_LEAF_
  SIGNATURE`. Node 24's `NODE_OPTIONS=--use-system-ca` trusts the OS cert store →
  works at full speed with integrity verification intact (no `strict-ssl=false`).
  Two places this bites:
  - **npm installs:** prefix `NODE_OPTIONS=--use-system-ca npm install …` (or
    `npx …`). Each registry request otherwise crawls ~70s on 3 failed retries.
  - **`next build` / `next dev`:** `next/font/google` fetches the three fonts at
    build time and failed the same way.
  - **`next start` (runtime):** the server makes outbound Supabase **Auth** calls
    — the proxy's `getUser()` on each request and `/auth/callback`'s
    `exchangeCodeForSession`. Server-side Node uses its *bundled* Mozilla CAs (not
    the OS store), so these rejected the inspected cert with
    `UNABLE_TO_VERIFY_LEAF_SIGNATURE` / `fetch failed` once a session existed —
    **fatal** (500) before hardening. The browser's own calls succeed because the
    browser trusts the OS store.

    So **all three scripts bake in the flag** via `cross-env`, e.g.
    `cross-env NODE_OPTIONS=--use-system-ca next start`. Plain `npm run dev`,
    `npm run build`, and `npm start` now work with no manual prefix. (Harmless on
    Vercel's Linux, whose system store includes the public CAs.) The proxy also
    wraps `getUser()` in try/catch so any future transient outbound failure is
    non-fatal (best-effort session refresh) rather than a 500.
  - **Zero-network alternative (not done):** self-host the fonts via
    `next/font/local` (commit the woff2 files) to drop the build-time fetch
    entirely. Revisit if CI/offline builds need it.

## ⚒️ Next.js 16 specifics (resolved during Phase 0)

- **Serwist needs the webpack builder; dev stays on Turbopack.** `@serwist/next`
  injects a webpack config (even when disabled) and doesn't support Turbopack yet
  (serwist#54). Two-part setup so both run cleanly:
  - **Build:** `npm run build` = `next build --webpack` (Serwist compiles `/sw.js`).
  - **Dev:** `npm run dev` = `next dev --turbopack`, **plus an empty `turbopack: {}`
    in `next.config.ts`** — Next 16 dev defaults to Turbopack and otherwise errors
    with *"using Turbopack, with a webpack config and no turbopack config"*; the
    empty turbopack config is Next's sanctioned silencer. The SW is disabled in
    dev, so Serwist's webpack config is inert there.

    Revisit `@serwist/turbopack` when it stabilizes to unify the builders.
- **`middleware.ts` → `proxy.ts`.** Next 16 renamed the convention; we use
  `src/proxy.ts` exporting `proxy()`. (`src/lib/supabase/middleware.ts` keeps its
  name — it's just the `updateSession` helper, not the convention file.)

## 🔭 Phase 2 follow-ups (queued, not yet fixed)

- **Graywolf caches a DUPLICATE "White" tee.** Observed in the setup tee picker —
  two "White" tees appear for the cached Graywolf course. Investigate the provider
  response vs. the cache write: likely a dedup gap in the cache layer (the
  `getOrCacheCourse`/`insertCourse` path in `src/lib/courses/cache.ts`) or the
  GolfCourseAPI mapping emitting the tee twice (male/female grouping?). Fix with a
  unique-on-(course_id, name[, gender]) guard or upsert, and de-dupe existing rows.
- ✅ **Season-to-date zero state — done.** Now shows "$0 with this crew" in the
  setup picker and per-player on settle-up (live `SUM(ledger_entries.amount)`).
- ✅ **Mark-as-paid writes the durable ledger** (`ledger_entries.paid`). The ledger
  is the source of truth; a per-payment `localStorage` checklist gives immediate,
  per-payment feedback within a session. Reconciliation: a **player is settled once
  every minimized payment touching them is paid** → that player's `paid` flag is
  written. Reads seed from the ledger (a settled endpoint ⇒ the transaction shows
  paid), so it survives across devices / data clears. Pre-settle marks are carried
  into the ledger when you settle. `buildLedgerRows`' policy is now live (re-settle
  preserves `paid` when the amount is unchanged, resets it when it changes).
  Known simplification: with only per-player storage, a *partially*-paid
  multi-payment debtor reads unpaid on another device until fully settled.
- **`settlements` table is unused so far.** Settle-up recomputes from scores each
  time and writes `ledger_entries` (the durable payoff). Persisting a `settlements`
  row (combined JSON snapshot) is optional record-keeping for later.
- **Skins gross option not exposed.** Spec says Skins is "net default, gross
  optional." Today the setup UI hard-codes every game to `gross_or_net: "net"` with
  no toggle, so Skins is **net-locked** (Nassau/Match are correctly net-only). The
  engines already take pre-netted scores, so "gross" just means feeding gross in;
  add a Net/Gross toggle to the Skins card only. Accidental lock → deferred, not a
  v1 decision.
- **Side dropdowns — verified OK.** Nassau/Match side `<select>`s map over the
  round's live `selectedPlayers`, so they show real chosen players, not stale
  names. (Confirmed during the course/tee restructure; logged so it's not re-checked.)

- **Active hole now persists.** Hole-entry stores the current hole in
  `localStorage` (`autocaddie:hole:<eventId>`) and rehydrates to it on load, so a
  screen-sleep / reload returns to your place instead of hole 1.
- **Edit-round escape hatch (Phase 2.x).** Lineup-lock after hole 1 is working as
  designed, but there's **no way to fix an honest setup error** (wrong tee, wrong
  player) mid-round. Add a deliberate, confirmation-gated "edit round" affordance
  for genuine errors. Not built yet.
- **In-round handicap editing — spec gap (Phase 2.x).** Spec says scores AND
  handicaps stay editable after the lineup locks. **Verified current behavior:**
  scores ARE editable (navigate to any hole and change it → recompute). Handicaps
  are NOT editable in-round — they're captured at setup (`round_players` snapshot)
  and there's no in-round handicap editor on any post-create surface. So handicaps
  are effectively frozen post-create today (independent of the hole-1 lock). Build
  the in-round handicap editor alongside the edit-round escape hatch.

- **Skins live strip redesign (DECIDED; build next turn with the owner's exact
  hierarchy spec).** Headline per player = **NET (`nets`)** — what actually settles
  — shown as e.g. "Ryan +$30", with **skins count as supporting detail** ("· 5
  skins"). Net legitimately moves BOTH directions (in zero-sum skins your net drops
  by your ante when an opponent wins a hole — this is correct, not a bug; clear
  labels make it read right). The headline and settle-up MUST agree on the number
  that changes hands, so do NOT feature gross. `live.ts` also exposes a monotonic
  **`won`** (gross pots collected) — **reserved** for a possible separate "pots
  collected" stat, NOT shown in the main strip for now. Owner will spec the visual
  hierarchy (net headline first/biggest, hole+carry detail secondary) at build time.
  Both metrics covered by live.test.ts (net settlement preserved; `won` monotonic).

### Phase 3 backlog (do NOT build in Phase 2)
- **User-settable default home course** in Settings (one place; the round-setup
  course flow stays "unselected each round" per the corrected model).
- **Persist entered stroke index to the cached course.** When a user enters SI for
  a no-SI course (e.g. Graywolf), the `StrokeIndexGate` already writes it to
  `holes.stroke_index` for that tee — but confirm/ensure it sticks per cached
  course so it isn't re-entered every round. This is what makes a no-SI course
  viable as a saved home course; design alongside the Settings default.

## 🧟 Stale prod service worker poisons `npm run dev` (looks like a code bug)

**Symptom:** a runtime error from code that is correct on disk — we hit
`queryKeys.crewPlayers is not a function` even though `keys.ts` clearly defines it
(proven: `keys.test.ts` asserts it's callable; `tsc`/`build` green). Tell-tale: the
error's stack line **doesn't match the committed source** (it pointed at
`crews.ts:24`, a `}`, not the `crewPlayers` call at line 36). That mismatch means
**the browser is executing bytes that aren't your current source.**

**Cause:** the prod build emits a Serwist SW (`public/sw.js`). Once it registers on
an origin (any `npm start` / prod visit on `localhost`), it **keeps controlling
that origin and serving precached old chunks** — *surviving* `rm -rf .next` and a
fresh `npm run dev`, because the SW sits in the browser, in front of the dev
server. `next.config.ts` only **disables registering a new** SW in dev; it does
**not unregister an already-active one**.

**Immediate recovery (one-time):** DevTools → Application → Service Workers →
**Unregister** (and "Clear site data"), then hard-reload. The stale SW serves an
old app shell, so it must be removed manually once.

**Recurrence guard (in code):** `SW_DEV_CLEANUP_SCRIPT` (injected by
`layout.tsx` **only when `NODE_ENV !== 'production'`**) unregisters any active SW +
clears caches and reloads once (sessionStorage-guarded). After the one-time manual
clear, this keeps a leftover prod SW from poisoning dev again. Not emitted in prod.

## 📴 Offline reload of a dynamic route dropped to /offline (SW caching, fragile)

**Symptom:** enter scores online, go offline, **reload** `/play/[eventId]/score` →
the `/offline` fallback appeared instead of the in-progress round. (Data was safe —
IndexedDB + outbox synced fine once back online; the *route* just wasn't reachable
offline.)

**Cause (two layers):**
1. **SW:** dynamic app routes are reached by client-side navigation, so their HTML
   document is never fetched — nothing for Serwist's NetworkFirst page cache to
   store. An offline reload is a real document navigation that misses cache →
   Serwist serves the `/offline` fallback (matcher = any `document`).
2. **Auth:** even with the doc served, `useUser` called `supabase.auth.getUser()`
   (network), which fails offline → AuthGate would bounce to `/signin`.

**Fix:**
- `useWarmRouteCache()` (`src/lib/offline/warm-route.ts`), called on the round
  home + score routes: while online it re-fetches `location.href` so the SW
  runtime-caches the document. Offline reload then hits that cache (NetworkFirst
  → cache) and the client rehydrates from IndexedDB; `/offline` only fires for
  routes with nothing cached. No-op without a SW (dev) or offline.
- `useUser` now falls back to `supabase.auth.getSession()` (local storage, no
  network) when `getUser()` fails, so an offline reload stays authenticated.

**Confirm by hand (prod build only — SW is off in dev):** `npm run build && npm
start`, enter scores, DevTools → Network Offline, reload `/play/[eventId]/score`
→ the round + all entered scores load and are fully usable offline.

SW caching remains a **fragile area** (also caused the stale-chunk ghost earlier) —
change deliberately and re-confirm offline behavior by hand after any SW edit.

## 📝 Notes

- **Service worker is disabled in development** (`next.config.ts`). Test PWA
  install / offline against a production build (`npm run build && npm start`).
- App icons: SVG (`/icons/icon.svg`, maskable variant) is authored by hand; the
  192/512/maskable **PNGs are generated from the SVG** via `npm run gen:icons`
  (needs the `sharp` devDependency). If a platform shows a broken icon, regenerate.
- **shadcn `--muted` collision.** Our `--muted` token is the muted *text* color
  (per the mockups); shadcn treats `muted` as a surface. We keep our meaning, so
  shadcn's rarely-used `bg-muted` renders as that subtle tone. shadcn semantic
  tokens are otherwise *derived* from our palette (see `globals.css`).
