# Golf Games Hub — Product Specification (v0.3)

**Name:** Autocaddie (autocaddie.com)
**Status:** Pre-build spec / Claude Code handoff reference
**Author:** Ryan
**Type:** Standalone product (own branding, own infrastructure)
**v0.2 changes:** multi-group "outing" mode pulled into near-term scope; single-scorekeeper
made a first-class path; per-game **betting toggle** added; phases reordered around the
real timeline (weekends now → summer outings → product later).

---

## 1. Overview

A real-time hub for golfers to play games against each other during a round. A host
creates a round (or a multi-group **outing**), players are added, everyone picks the games
and stakes, the app handles handicap-fair stroke allocation, tracks scores live, and
produces a single combined "who owes whom" settlement at the end.

Two equally-supported ways to score:
- **Solo scorekeeper (primary):** one person runs the whole group from their phone. No one
  else needs the app. This is the default, lowest-friction path.
- **Live multiplayer (optional):** other players join from their own phones and the round
  state syncs in real time.

The product is **social scorekeeping with optional stakes** — not a betting app. The
wagering/settlement layer is a toggle, off by default.

### Confirmed product decisions

| Decision | Choice |
|---|---|
| Ambition | Fun first with friends; productize later only if it takes off |
| Monetization | **Free at launch.** Paid tier later, gated on durable value (history, stats, league mode) — never on playing a round |
| Scoring model | **Solo scorekeeper is first-class/default;** live multi-phone is optional |
| Multi-group | **Supported near-term.** An *Outing* contains multiple tee groups (needed for summer outings) |
| Game formats | Skins, Nassau, Match Play (MVP) → Wolf, Stableford, Scramble, Best Ball |
| Stakes | **Per-game toggle:** Social mode (standings only) or Stakes mode (wager + settlement) |
| Money handling | **Ledger only** — track + deep-link to Venmo/PayPal, never process money |
| Handicaps | Manual + saved profiles now; GHIN lookup later |
| Course data | Full DB (par + stroke index) via third-party API, cached; **confirm stroke index at setup** |
| Settlement | Combined per player; offer **both** minimized-payments and per-game views |
| Connectivity | Best-effort, never lose data → local-first / offline-capable |
| Platform | PWA (Next.js + Supabase), mirroring the Sports Codex stack |
| Joining | Both: share code/link **and** friends list / accounts; guests can fully play |
| Dispute handling | Light: per-player or scorekeeper ownership, host override, optional confirm |

---

## 2. Core principles

1. **Solo-first, multiplayer-optional.** The app must be fully usable by one person running
   the whole group. Live multi-phone is an enhancement, never a requirement.
2. **Local-first, never lose a score.** Scoring works fully offline; writes sync on
   reconnect. A dead zone never blocks play.
3. **Fair by construction.** Handicaps and stroke indexes drive automatic net scoring.
4. **Social by default, stakes optional.** Every game can be played for standings/bragging
   rights, with money as an opt-in toggle.
5. **One settlement to rule them all.** Any number of stacked games → one combined balance
   per player, viewable minimized or per-game.
6. **Transparent math.** Every stroke, skin, and dollar is inspectable.
7. **Single game first.** Most rounds are one game, so the default experience is built
   around a single game as the hero. Multi-game stacking, whole-outing scope, the combined
   settlement, and the by-game settle view are progressive disclosure — they appear only
   when someone adds a second game. The interface's complexity scales to the number of
   games, never front-loading the power-user case.

---

## 3. Events, groups & multi-group play

The model is a hierarchy so a casual foursome and a 24-person outing share one code path:

```
Event (the gathering)
  └─ Group (a tee group / foursome)
       └─ Player
```

- A **casual weekend round = an Event with exactly one Group.** Same path, no special case.
- A **summer outing = an Event with several Groups.**
- **Games have a scope:**
  - **Event-scoped:** spans every player across all groups — e.g. your **whole-outing Skins
    pot** (lowest net score on each hole across the entire field wins the skin; carryovers
    roll across the whole field). Net by default, configurable to gross.
  - **Group-scoped:** lives inside one tee group — e.g. each group's own weekly individual
    game.
- This is exactly your format: **one shared Skins game across the whole outing, plus each
  group playing its own game.**
- **Settlement rolls up per player:** their event-scoped results (the shared Skins) + their
  group-scoped results combine into one balance, viewable at the event level and drillable
  per group.

> **Architecture note (important):** build the Event → Group → Player schema and the
> game-scope field from Phase 1, even though the MVP UI only exposes the single-group case.
> Retrofitting multi-group later would be a costly migration. Stub it now, expose it in
> Phase 3.

---

## 4. Platform & tech stack

**PWA**, mirroring the Sports Codex stack so the Claude Code workflow transfers directly.

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Same as Sports Codex |
| Backend / DB | Supabase (Postgres) | Auth, Realtime, Row Level Security |
| Live sync | Supabase Realtime | Drives shared state in live multiplayer mode |
| Server state | TanStack Query | Same |
| Styling | Tailwind v4 | Same |
| Components | shadcn/ui (base-nova) | Same |
| Offline store | IndexedDB (Dexie) + service worker (Serwist/next-pwa) | Local-first + sync queue |
| Course data | GolfCourseAPI (primary) / golfapi.io (fallback), via provider interface → cached in Supabase | Verify stroke-index coverage; cache-on-first-use |
| Handicap (later) | USGA GHIN API | Gated; partner approval required |
| Hosting | Vercel | Standard for Next.js |

---

## 5. Data model (core entities)

```
User            id, name, email, handicap_index?, ghin_number?, avatar
PlayerProfile   id, owner_user_id, display_name, handicap_index   # saved "regulars"
Friendship      user_id, friend_user_id, status
RoundTemplate   id, owner_user_id, name, default_group(jsonb), default_games(jsonb)  # Home "regular games" one-tap
Course          id, external_id, name, location, lat/lng
TeeSet          id, course_id, name, rating, slope, par
Hole            id, tee_set_id, number, par, stroke_index, yardage

Event           id, host_user_id, course_id, tee_set_id, date, join_code, status,
                holes_to_play (9|18), which_nine (front|back)?, starting_hole?   # 9-hole + shotgun
Group           id, event_id, name, scoring_mode (solo|live), scorekeeper_user_id?
RoundPlayer     id, group_id, user_id?/profile_id?/guest_name,
                handicap_index, course_handicap, playing_handicap, team_id?
Team            id, group_id, name

Game            id, event_id, scope (event|group), group_id?, type,
                config(jsonb), stakes_enabled (bool), stake, allowance, gross_or_net
HoleScore       id, group_id, round_player_id, hole_number, strokes,
                entered_by, updated_at, version          # one row per player per hole
GameResult      id, game_id, per-player standings + net amount (0 if stakes_enabled=false)
Settlement      id, event_id, combined net-per-player + minimized transactions + per-game view
```

Notes:
- **`scoring_mode` is per Group** — in one outing, one group can use a solo scorekeeper while
  another has everyone on their phones.
- **`stakes_enabled`** off = the game still tracks standings/winner, just no money or
  settlement.
- One `HoleScore` row per player per hole keeps the offline-sync conflict surface small.
- **Access/RLS:** scope every policy to the Event — accounts via `auth.uid()`, guests via the
  Event's `join_code` / a round-scoped token. Never gate play on an account; never leave round
  data world-readable.
- **Pick-up / no score:** `HoleScore.strokes` is nullable; support a "picked up" state (max or
  excluded) rather than forcing a number.

---

## 6. Handicaps & stroke allocation

**Course Handicap** (WHS): `Index × (Slope ÷ 113) + (Course Rating − Par)`, rounded.

**Playing Handicap** = Course Handicap × format **allowance** (configurable):
- Singles match play 100% · Four-Ball 85/90% · Stableford/individual 95%
- Casual default option: **relative** — low player off scratch, others get the difference.

**Stroke allocation** (by stroke index, SI 1 = hardest): a player on playing handicap N gets
1 stroke on every hole with SI ≤ N; if N > 18, all holes get 1 plus a 2nd on SI ≤ (N − 18).
Net hole score = gross − strokes received. Show stroke dots on the card so fairness is
visible.

**Setup safeguard:** show the pulled stroke-index row for confirmation before play, since
that's the field third-party data most often gets wrong.

---

## 7. Game formats

Each game ingests hole scores per its config and outputs per-player standings, plus a net
amount **only if `stakes_enabled`**. Stakes default off (social mode).

- **Skins** — each hole worth a skin; lowest score wins; ties carry over and grow the pot;
  net or gross. (Event-scoped version = whole-outing pot, see §3.)
- **Nassau** — three bets: front 9, back 9, total 18; usually match play; presses later.
- **Match Play** — hole-by-hole win/lose/halve; running status ("2 up", "3 & 2").
- **Stroke / Stableford** — total strokes, or Stableford points vs target (95% allowance).
- **Wolf** (4 players) — rotating Wolf picks a partner or goes Lone Wolf for higher stakes;
  Blind Wolf optional.
- **Team formats** — Scramble (one team score) and Best Ball/Four-Ball (best net per hole,
  85/90%).

**MVP games:** Skins + Nassau + Match Play. The rest reuse the same scoring spine.

---

## 8. Event lifecycle

```
CREATE → ADD GROUPS/PLAYERS → SETUP GAMES → PLAY → SETTLE → ARCHIVE
```

1. **Create.** Host picks course + tee set (cached DB), date. Gets join code + link + QR.
2. **Add groups/players.** Single group for a weekend; multiple for an outing. Players are
   added by the scorekeeper, invited from friends, or self-join via code. In a multi-group
   outing the **organizer assigns players to groups by default**, with an optional
   **self-select-your-group** toggle. Each group picks its `scoring_mode` (solo or live).
3. **Setup games.** Add event-scoped and/or group-scoped games; set stakes toggle,
   stake/allowance/gross-or-net; assign teams (manual or auto-balance). App computes
   handicaps + stroke dots; **confirm stroke index**.
4. **Play.** Score entry hole-by-hole. Solo mode = scorekeeper enters for the group; live
   mode = each player enters their own. All active games update live; works offline.
5. **Settle.** Per-game results → combined balance per player (event + group games),
   rendered both minimized and per-game. Stakes-off games show standings only. Optional
   Venmo/PayPal deep-links.
6. **Archive.** Saved to history (Phase 4+).

---

## 9. Settlement engine

1. Each stakes-enabled game outputs a net per player (sums ~0 within the game).
2. Sum across all of a player's games (event-scoped + their group's) → one net balance.
3. **Two views, always:** minimized payments (fewest transactions) and a per-game breakdown
   (settle each game on its own). Default minimized; toggle to per-game.
4. Drill-down by player → by game → by hole. Stakes-off games appear as standings, no money.

---

## 10. Offline / local-first & sync

- **Local authority:** each device holds state in IndexedDB; entries write locally first
  (instant, offline-safe).
- **Solo mode** = effectively one writer per group → minimal conflict.
- **Live mode** = per-player score ownership; conflicts resolved last-write-wins by
  `updated_at` + `version`, flagged to host if scores diverge.
- **Sync:** queued writes flush to Supabase on reconnect; Realtime broadcasts to other
  devices; course data is fully cached at setup so play never needs a live API call.

---

## 11. Team auto-balancing

For team games: **auto-balance** by minimizing total-course-handicap difference (4 players →
pair high with low; larger → snake draft + local swaps), **manual draft**, or **manual
assignment**. Auto-balance is the one-tap default.

---

## 12. Course data integration

Course data comes through a **pluggable provider interface** — **GolfCourseAPI primary**
(transparent pricing, verify per-hole stroke index/slope coverage on signup), **golfapi.io
fallback** (broader DB + CSV export, contact-sales pricing). On first use, fetch and **persist
into Supabase** (Course/TeeSet/Hole) so play reads from your DB, not the API (offline + cost
control); cache-on-first-use keeps call volume low. Manual entry/edit fallback for missing or
wrong data, saved back to your DB. GHIN (official index) deferred to the product phase.

---

## 13. Phased build plan (reordered to your timeline)

**Phase 0 — Foundation.** Next.js 16 + Supabase + Tailwind v4 + shadcn scaffold; auth
(accounts + guest); PWA install + service worker; IndexedDB; living docs.

**Phase 1 — Core schema + course data + handicap engine.** Build the **Event → Group →
Player** schema and game-scope field now (even though UI is single-group). Course
fetch/cache, tee/hole selection, course-handicap + stroke-allocation with visible dots +
confirm-stroke-index.

**Phase 2 — MVP: single-group weekend rounds.** Solo scorekeeper (default) + optional live
join; Skins + Nassau + Match Play; stakes toggle; combined settlement (both views).
→ *Usable for your weekend games.*

**Phase 3 — Multi-group outings.** Multiple groups under one Event; **event-wide Skins** +
per-group games; group join/assignment; rolled-up + per-group settlement.
→ *Usable for your summer outings.*

**Phase 4 — Full games + teams + history.** Wolf, Stableford, Scramble, Best Ball; team
auto-balance; presses; round history + basic stats; Venmo/PayPal deep-links.

**Phase 5 — Product / scale.** GHIN integration, social/sharing, monetization + paid tier
(history, stats, league mode behind it).

---

## 14. Open questions (remaining)

1. **Name.** Resolved — **Autocaddie** (autocaddie.com secured). Pending: app-store name +
   trademark availability check, and a final logo (flag-pin mark is the placeholder).
2. **Monetization specifics.** Deferred to Phase 5 — what exactly sits behind the paywall.

*Resolved:* event-wide Skins defaults to **net**, configurable to gross. Multi-group
assignment defaults to **organizer-assigns**, with a self-select toggle. All other product
decisions are settled.

---

## 15. Risks (and mitigations)

- **Stroke-index data errors** skew net games → confirm-at-setup step (built into Phase 1).
- **Real-money / app-store framing** → ledger-only + stakes-off-by-default + "social
  scorekeeping" positioning in name, store listing, and marketing.
- **Adoption friction of all-phones** → solved by making solo scorekeeper the default path.
- **Multi-group complexity** → contained by the Event/Group schema being built from Phase 1.
- **GHIN access gating** → never a launch dependency; product-phase only.
