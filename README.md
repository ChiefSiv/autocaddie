# Autocaddie

Golf social & scoring app — a real-time, offline-capable **PWA** for playing
golf games with your group: handicap-fair net scoring, live tracking, and one
combined "who owes whom" settle-up. Social scorekeeping with optional stakes,
not a betting app.

> **Status:** Phase 0 (Foundation) complete. See [PHASE_PROGRESS.md](PHASE_PROGRESS.md).

## Stack

Next.js 16 (App Router, TS) · Tailwind v4 · shadcn/ui (base-nova) · Supabase
(Auth/Postgres/Realtime/RLS) · TanStack Query · Dexie (IndexedDB) + Serwist
(PWA) · Vitest · Vercel.

## Getting started

1. **Install**
   ```bash
   npm install
   ```
2. **Configure env** — copy `.env.example` to `.env.local` and fill in your
   Supabase + course-API values.
   ```bash
   cp .env.example .env.local
   ```
3. **Enable Supabase auth providers** (one-time, in the Supabase dashboard →
   Auth → Providers): **Anonymous sign-ins** (guest play) and **Email** (magic
   link). Add `${NEXT_PUBLIC_SITE_URL}/auth/callback` to Auth → URL
   Configuration → Redirect URLs.
4. **Generate app icons** (one-time, after install):
   ```bash
   npm i -D sharp
   npm run gen:icons
   ```
5. **Run**
   ```bash
   npm run dev      # http://localhost:3000  (service worker disabled in dev)
   npm test         # Vitest
   npm run build && npm start   # test PWA install / offline behavior
   ```

## Docs

- [CONTEXT.md](CONTEXT.md) — architecture, decisions, how it fits together.
- [KNOWN_ISSUES.md](KNOWN_ISSUES.md) — gotchas (frozen scorecard, offline model).
- [PHASE_PROGRESS.md](PHASE_PROGRESS.md) — phase checklist.
- Specs/mockups: `golf-games-*.md` / `golf-games-*.html`.
