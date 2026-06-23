# Autocaddie — KNOWN ISSUES & GOTCHAS

> Bugs, traps, and follow-ups. The first two are carried over from the build
> prompt (§12) — design for them now even though their UIs are Phase 2.

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

## ⚠️ Phase 0 setup requirements (builder action needed)

- **Supabase → Auth → Providers:** enable **Anonymous sign-ins** (guest play) and
  the **Email** provider (magic link). Without anonymous sign-ins, "Start
  playing" / "continue as guest" returns an error.
- **`.env.local`** must be populated from `.env.example` before the app can talk
  to Supabase. `NEXT_PUBLIC_SUPABASE_URL` must be a **full** `https://<ref>.supabase.co`
  URL. If it's missing or malformed, the app **degrades gracefully** — the proxy
  and `useUser` no-op (treated as signed out) instead of throwing
  "Invalid supabaseUrl" — but auth stays off until a valid URL + anon key are set.
  (Guarded via `hasSupabaseEnv()` in `src/lib/env.ts`.)
- **Magic-link redirect:** `NEXT_PUBLIC_SITE_URL` must match the origin and be
  added to Supabase Auth → URL Configuration → Redirect URLs.

## 📋 Phase 1 prerequisites / follow-ups

- **Verify GolfCourseAPI coverage** of per-hole **stroke index + slope/rating**
  for real target courses before relying on it; fall back to golfapi.io or manual
  entry where thin. (Make-or-break field.)
- Generate real PNG app icons from the SVG (see Phase 0 note below).
- Wire the real Home (handicap index + trend, regular games, recent round) to
  live data per `golf-games-home.html`.

## 🐞 Active issues / accepted risks

- **Moderate npm audit: PostCSS XSS in CSS stringify** — lives in Next's *own
  bundled* `node_modules/next/node_modules/postcss`, so we can't dedupe it; only
  relevant when processing untrusted CSS (we don't). Clears when Next bumps its
  bundled copy. Forcing a fix would push Next outside its version range. Left as-is.

## ⚙️ Environment / toolchain gotchas

- **npm TLS on this network — use `--use-system-ca`.** The dev machine sits
  behind SSL inspection; npm hit `UNABLE_TO_VERIFY_LEAF_SIGNATURE` and each
  request crawled (~70s, 3 failed retries) before succeeding. Fix: Node 24's
  `NODE_OPTIONS=--use-system-ca` trusts the Windows cert store → installs run at
  full speed with package-integrity verification intact (no `strict-ssl=false`).
  Use it for any `npm install` / `npx` that hits the registry.

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
