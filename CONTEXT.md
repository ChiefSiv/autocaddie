# Autocaddie — CONTEXT

> Living architecture doc. Update this as part of every change, not after.
> Companion docs: [KNOWN_ISSUES.md](KNOWN_ISSUES.md), [PHASE_PROGRESS.md](PHASE_PROGRESS.md).

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
2. `/signin`: **Start playing** = `signInAnonymously()` (guest); **email** =
   `signInWithOtp` magic link → `/auth/callback` exchanges the code.
3. `middleware.ts` refreshes the session cookie on each request. Nothing gates
   *playing* — a guest session is enough.

## Data model (planned — built in Phase 1)

Full Event → Group → Player schema with RLS, per build prompt §6. Not yet
migrated. **Access/RLS rule:** scope every policy to the Event — accounts via
`auth.uid()`, guests via the Event's `join_code` / round-scoped token. Never
gate play on an account; never leave round data world-readable. Exact policies
will be documented here when written.

## Open assumptions / to revisit

- Course provider verification (per-hole stroke index + slope/rating coverage)
  is a Phase 1 prerequisite — flag from the builder pending.
- Apple/Google OAuth deferred; `.env.example` lists the vars commented out.
