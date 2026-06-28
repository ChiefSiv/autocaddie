# Claude Code Build Prompt — Autocaddie · Phase 2 (Gameplay)

> Paste into a Claude Code session running in the `autocaddie` project, with the same
> reference files attached. Build **only Phase 2**. This turns the foundation into the first
> genuinely playable version — the tight, on-course-ready path.

---

## 0. How to work

1. **Read first.** Re-read `CONTEXT.md`, `PHASE_PROGRESS.md`, `KNOWN_ISSUES.md`, the build
   prompt's specs (`golf-games-hub-spec.md`, `golf-games-screen-spec.md`), and the mockups in
   §15. They remain the source of truth.
2. **Living docs.** Keep `CONTEXT.md`, `KNOWN_ISSUES.md`, `PHASE_PROGRESS.md` current.
3. **Phase discipline.** Build only what's in §2; respect the out-of-scope list in §3.
4. **Match the design exactly** — reuse the Phase 0–1 token system and components.
5. **Ask before deviating** from a locked decision; otherwise proceed and note assumptions.

---

## 0.5 Prerequisites — Phase 1 must be complete & verified

Phase 2 builds directly on Phase 1. Confirm these exist before starting; if any are missing,
finish Phase 1 first:
- **Schema:** Event → Group → Player, plus `Game`, `HoleScore`, `GameResult`, `Settlement`,
  `RoundTemplate`, Course/TeeSet/Hole — with RLS scoped to the Event (guests via Supabase
  anonymous auth).
- **Handicap/stroke engine** (tested pure functions), including **both allowance modes**:
  full handicap (default) and relative "low man plays scratch."
- **`CourseDataProvider`** (GolfCourseAPI primary) with course search + caching to Supabase.
- **Home screen** and course search working.

> **Sequencing note for the durable-persistence schema (§2.5).** The durable nouns in §2.5
> (`Crew`, durable `Player`, `LedgerEntry`) are schema-level. **If Phase 1's schema is not yet
> built, fold §2.5 into Phase 1** and let Phase 2 simply use it. **If Phase 1 is already built,
> §2.5 is the first migration of Phase 2**, before any gameplay work. Either way, do it before
> hole-entry, because identity and the ledger are what scoring writes into. Confirm with me which
> path applies before migrating.

---

## 1. Phase 2 in one paragraph

Make Autocaddie playable for a single group on one device. The **solo scorekeeper** creates a
round **for a durable crew**, picks a course/tee, adds players **from a persistent roster** with
handicaps, chooses games and stakes, then enters **gross scores hole by hole for the whole
group**; the app computes net live, runs the game engines, shows running standings the instant a
hole is saved, and ends with a **combined settle-up written to a stored ledger** plus a light
**recap**. No multiplayer, no outings — just the tightest path to playing a real money game with
your crew this summer, **with a record that accrues across rounds**.

---

## 2. Locked scope (the tight version)

- **Single device, solo scorekeeper.** One person enters everyone's scores. No live
  multi-phone sync.
- **Single group** (an Event with one Group). No multi-group/outing UI.
- **Three games:** **Skins**, **Nassau**, **Match Play (1v1)**.
- **Stakes + settlement** in scope, with **"mark as paid"** (no payment deep-links yet).
- **Holes:** choose **front 9 / back 9 / full 18** at setup.
- **Allowance:** round-level setting — **full handicap (default)** or **relative / low-man-scratch**.
- **Stakes per game:** Social (standings only) or Stakes (money), **default Social/off**.
- **Scoring flow:** one screen per hole showing **all players**; **gross entry only** (app
  derives net everywhere); **tap "next"** to advance (no auto-advance; backtracking to fix is
  common); **one-tap "pick up"** records a blank score.
- **Live standings** (skins pot, match status) visible and updating **on the hole-entry
  screen**, not just the card.
- **Lock rule:** players and games **lock once hole 1 is entered**; handicaps and scores stay
  editable anytime.
- **End round early** settles whatever's complete.
- **Light recap** before settle-up (birdies, who won what, the card).
- **Self-play testing:** because it's solo-device, the scorekeeper can enter all players with
  fake names — this is the intended way to test the engines at a kitchen table before the course.

---

## 2.5 Durable persistence — persist the nouns now, defer the verbs

**Principle: persist the nouns now, defer the verbs.** The app is for personal use with
recurring crews, so a record must **accrue across rounds** ("you're +$40 with this crew since
May"). Durable identity and a stored ledger are cheap now and painful to retrofit (backfilling
identity and de-duplicating names across a summer of rounds is the migration that hurts), and
auth is being set up now — the natural moment, since identity attaches to auth. **You own this
schema — propose it.** Below is the required shape; refine names/columns as needed but preserve
the four durable requirements.

**Durable entities (build these now):**
1. **`Crew`** — a durable roster that persists across rounds (`id`, `name`, `created_by`,
   timestamps). **New entity. Do NOT reuse `Group`** — in our schema `Group` already means a
   *tee group within one Event*. A `Crew` is cross-round; a `Group` is intra-round. Keep them
   distinct.
2. **`Player`** — a **persistent** participant identity that accrues a record, **never free text
   per round**. Owned by a crew/creator (`id`, `crew_id` or `owner_user_id`, `display_name`,
   `handicap_index`, `linked_user_id` nullable). `linked_user_id = null` ⇒ a **managed player**
   (no login, you score for them; durable; can **link to a real account later**). This replaces
   the per-round `guest_name` string: quick-add still exists but **creates or reuses a managed
   `Player`** under the crew. (If Phase 1 shipped a `PlayerProfile`, promote it to this `Player`.)
3. **`Event` (round) belongs to a `Crew`** — add `Event.crew_id` (nullable; see crewless one-off
   below). `RoundPlayer` references a durable `Player` (`player_id`), carrying that round's
   handicap/course-handicap — **never a name string**.
4. **`HoleScore` retained** — raw hole-by-hole scores persist durably (not cleared after a
   round), so any record is reconstructable. (Already in schema — just confirm retention.)
5. **`LedgerEntry`** — the settle-up result **written to a stored ledger**, not only computed and
   displayed (`id`, `crew_id`, `event_id`, `player_id`, `amount` signed net, `created_at`,
   optional `paid` flag). Finalized on round settle (and on end-early). This makes a per-player
   season-to-date net a trivial `SUM(amount)`.

**RLS / auth implications (decide & implement):** `Crew`, `Player`, and `LedgerEntry` are
**crew-scoped**, and ledger / season-to-date reads span **multiple events within a crew** —
broader than v1's per-event scoping. A crew member (and the crew owner) may read the crew's
roster and ledger across its events. Managed players have no `auth.uid`; their data is owned via
the crew/creator. Keep guest play (anonymous auth) working.

**Crewless one-off (decision, default chosen):** a round may be created **without** a crew
(`crew_id = null`) for a random one-off; it simply **does not accrue to any ledger**. Crew is
**defaulted but not forced** at setup. (Flag for owner to confirm/override.)

**Season-to-date net (the one judgment call — included as minimal display):** because
`LedgerEntry` makes it nearly free, surface a **single read-only figure per player** — e.g.
"+$40 with this crew since May" — on the **settle-up screen** and the **crew/player picker at
setup**. **One number, nothing more.** No standings table, no head-to-head, no dashboard, no
charts. (Owner may downgrade this to data-only.)

**Record these as explicit, cross-phase decisions in `CONTEXT.md`:** the four durable
requirements (Player identity, round-belongs-to-Crew, stored ledger, retained HoleScores), the
managed-vs-linked player model, the crew-scoped RLS, and the deferred-verbs list in §3 — so they
survive across phases and nobody re-introduces free-text players later.

---

## 3. Explicitly OUT of scope for Phase 2

**Deferred VERBS (durable data exists per §2.5, but DO NOT build the UI/features now — these are
future):** season standings UI, head-to-head views, settle-the-season, saved/historical recaps
and analytics dashboards, additional game formats beyond v1, billing/subscriptions. The data
foundation is laid now; the surfaces come later.

**Also out (Phase 3–4):** Wolf, team formats (scramble/best ball), Stableford, multi-group
outings, stats/history browsing, friends-on-course, **live multi-phone sync**, Nassau
**presses**, **concede**, honors/tee order, Venmo/PayPal deep-links, GHIN.

---

## 4. Round lifecycle

```
SETUP → PLAY (hole by hole) → RECAP → SETTLE → ARCHIVE
```
1. **Setup** (build on the `golf-games-round-setup.html` mockup): **pick/create a `Crew`**
   (defaulted; crewless one-off allowed), course + tee (from cache), **add players by selecting
   durable `Player`s from the crew roster** (quick-add creates/reuses a managed `Player` — never
   a free-text name), handicap index, choose holes (9/18), allowance mode, then add games with
   their stakes toggle. **Match-based games (Match Play, Nassau) require choosing the two
   sides** at setup; **Skins is the whole group.** A saved `RoundTemplate` can prefill this.
   Show each player's **season-to-date net with this crew** (single figure) in the picker.
2. **Play:** the hole-entry screen (see §8) — gross for each player, live standings, next/back.
3. **Recap:** light end-of-round summary.
4. **Settle:** combined settlement (§7).
5. **Archive:** round saved (history UI itself is later, but persist the data now).

---

## 5. Scoring rules

- **Gross in, net derived.** Net per hole = gross − strokes received (from the Phase 1 engine,
  using the round's allowance mode). Show stroke dots.
- **Pick-up / no score:** one tap sets `HoleScore.strokes = null`. Effects: **Skins** — can't
  win that hole; **Match Play / Nassau** — loses that hole; net math simply skips it.
- **Editing:** any past hole's scores remain editable; recompute standings on edit.
- **Lock:** after hole 1 is saved, the player list and game list are fixed for the round
  (scores/handicaps stay editable).
- **9-hole rounds:** games scope to the holes played (see Nassau in §6).

---

## 6. Game engines (build as tested pure functions, then wire to UI)

Each game reads hole scores and outputs per-player standings + a net amount (0 when stakes
off). Unit-test each with worked examples (Vitest).

### Skins (whole group)
- Each hole worth one skin (value = per-hole stake when stakes on). **Net by default** (gross
  optional). **Carryovers on by default.**
- Lowest score wins the skin outright; a tie **carries** the skin to the next hole, growing the
  pot. The carried pot is won by the next outright winner.
- Pick-up/blank can't win.
- Settlement: players ante the per-hole stake into each hole's pot; winner takes it (or it
  carries). Net per player = skins value won − total ante. Sums to ~0.

### Nassau (two chosen sides)
- Three match-play bets — **front 9, back 9, total 18** — each worth the stake, scored **net**.
- Hole-by-hole win/lose/halve; the side that's "up" after a segment wins that segment's stake.
- **9-hole round:** collapses to a **single 9-hole match** (one bet, no front/back/18 split).
- **No presses in v1.**
- Settlement: loser pays the stake per segment won (up to 3× on 18).

### Match Play (two chosen sides, 1v1)
- Net, hole-by-hole; track running status ("2 up", "All Square") and close when mathematically
  decided ("3 & 2"). Stake to the winner. **No concede in v1.**

---

## 7. Settlement engine

- Each stakes-enabled game outputs a per-player net; sum across all games → one net per player.
- **Minimized payments** (fewest transactions) as the default view; **by-game breakdown** as a
  toggle — **the toggle only appears when 2+ games** (single game needs no toggle).
- **"Mark as paid"** per payment (no deep-links yet). Ledger only — never process money.
- **Write the result to the durable ledger.** On settle (and on end-early), persist each
  player's net as a **`LedgerEntry`** (per §2.5) tied to the crew + event — not only computed and
  displayed. This is what lets records accrue across rounds.
- **Season-to-date (minimal):** show each player's running net **with this crew** as a single
  read-only figure on the settle-up screen (`SUM` of their `LedgerEntry`s for the crew). One
  number — no standings/history UI.
- **End round early:** settle whatever holes/games are complete (and write the ledger for it).
- Drill-down: player → game → hole. Stakes-off games show standings only, no money (and write a
  zero/again no `LedgerEntry`).
- Build on the `golf-games-settle-up.html` mockup.

---

## 8. Screens to build

- **Round setup** — `golf-games-round-setup.html`. Add: holes (9/18) selector, allowance mode
  toggle, side-selection for match-based games.
- **Round home / single-game hero** — `golf-games-round-home.html`. One game = hero; **2+ games
  = the swipeable strip**. "+ Add a game" only available before hole 1 lock.
- **Hole entry** — the oversized stepper from `golf-games-visual-direction.html`, but for **all
  players on one screen**, gross entry, stroke dots, **one-tap pick-up**, next/back, and the
  **live standings strip** (skins pot, match status) updating on save.
- **Scorecard** — `golf-games-scorecard-view.html`. **Use the two-pane frozen-column technique
  (fixed name panel + scrolling holes), NOT `position: sticky` on cells, and NO
  `-webkit-overflow-scrolling: touch`** (see KNOWN_ISSUES). Gross + net per cell. Tap a cell to
  jump to that hole's entry.
- **Recap** — light end-of-round summary (birdies, skins won, match results, final card).
- **Settle-up** — §7, from the mockup.

---

## 9. Offline / local-first

Single-device means a single writer, so conflicts are minimal. Still: write scores
**local-first to IndexedDB** (optimistic), persist to Supabase via the outbox/sync queue when
online, and ensure a round in progress survives going offline and app restarts. Course data is
already cached from Phase 1.

---

## 10. Design system reminders

- **Single game first:** the hole-entry and round-home surfaces stay clean for one game; the
  multi-game strip, and the settle-up by-game toggle, appear only with 2+ games.
- Reuse tokens/components exactly (Fairway/Flare, Saira/Hanken, scoreboard numerals, stroke-index
  dots, gross+net cell, status readouts, ledger rows). Large tap targets, sun-readable, one-handed.

---

## 11. Phase 2 deliverables & acceptance

**Deliverables:** round setup → play → recap → settle flow for a single group; Skins + Nassau +
Match Play engines (tested); hole-entry screen with live standings + pick-up; two-pane scorecard
with gross/net; combined settlement (minimized + by-game, mark-as-paid, end-early); light recap;
local-first persistence of an in-progress round.

**Acceptance:**
- **Durable nouns exist (§2.5):** a `Crew` with durable `Player`s (managed + at least one
  linkable), `Event.crew_id`, retained `HoleScore`s, and a `LedgerEntry` written on settle.
  RoundPlayers reference `Player`s — no free-text names anywhere.
- Create a round, pick/create a crew, add 4 durable players + handicaps, choose holes and
  allowance, add Skins (group) + Nassau + a Match (sides chosen), set stakes.
- Enter 18 holes of gross scores; net, stroke dots, and **live standings update on save**;
  pick-up works; editing a past hole recomputes correctly.
- Each game's result is **correct against a hand-checked example**; settle-up nets to the right
  who-pays-whom, both views, mark-as-paid works; end-early settles partial play.
- **Settle writes a `LedgerEntry` per player; the season-to-date figure reflects two rounds with
  the same crew summing correctly.**
- Scorecard freeze holds on mobile; everything matches the design system in light and dark.

---

## 12. Implementation gotchas

- **Two-pane scorecard** (see §8) — the freeze must use split panes, not sticky cells.
- **Pick-up = null strokes** — engines must handle nulls (skins: no win; match: loss) without
  breaking net math.
- **Lock-after-hole-1** — enforce in UI and data.
- **Allowance modes** — relative is full-handicap-minus-a-constant; one engine, a thin adjustment.
- **Recompute on edit** — any score edit re-runs the affected game engines and settlement.

---

## 13. Definition of Done (Phase 2)

- [ ] **Self-play a full 18 at the kitchen table** (4 fake players) start to finish.
- [ ] **Players are durable** — the 4 show up as a reusable crew roster; a second round with the
      same crew reuses them (no duplicate identities, no free-text names).
- [ ] **Settle writes a `LedgerEntry`**; play a *second* round with the same crew and confirm the
      **season-to-date figure sums both rounds** correctly.
- [ ] Skins pot, carryovers, and winners are correct vs a hand count.
- [ ] Nassau front/back/18 (and the 9-hole single-bet case) settle correctly.
- [ ] Match play status reads right and closes ("3 & 2") correctly.
- [ ] Pick-up behaves right in each game; editing a past hole recomputes everything.
- [ ] Combined settle-up nets correctly; both views; mark-as-paid; end-early works.
- [ ] Scorecard freeze holds while scrolling on your phone; gross+net shown.
- [ ] Round in progress survives going offline and reopening the app.
- [ ] Looks like the mockups in light and dark.
- [ ] `PHASE_PROGRESS.md` marked complete with a short report; `CONTEXT.md` updated.

When these pass, you're ready to play a real round with your group — and Phase 3 (multi-group
outings + live multi-phone sync) is the next handoff.

---

## 14. Living docs to update

`CONTEXT.md` — **record the §2.5 durable-persistence decisions as explicit, cross-phase
decisions** (durable Player identity, round-belongs-to-Crew, stored `LedgerEntry`, retained
`HoleScore`s, managed-vs-linked players, crew-scoped RLS, and the deferred-verbs list), plus the
game-engine + settlement architecture. `KNOWN_ISSUES.md` (any new gotchas), `PHASE_PROGRESS.md`
(Phase 2 checklist).

---

## 15. Reference assets (already in the project)

Specs: `golf-games-hub-spec.md`, `golf-games-screen-spec.md`.
Mockups: `golf-games-round-setup.html`, `golf-games-round-home.html`,
`golf-games-scorecard-view.html`, `golf-games-settle-up.html`,
`golf-games-visual-direction.html` (hole-entry card + components), `golf-games-home.html`.
Treat mockups as the design target and specs as the behavior target; where they disagree, ask.
