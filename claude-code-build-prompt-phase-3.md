# Claude Code Build Prompt — Autocaddie · Phase 3 (House Rules + Wolf / Vegas / Nine Point)

> Paste into a Claude Code session running in the `autocaddie` project. Build **only Phase 3**.
> This turns Autocaddie from "the three games we shipped" into "the games your crew actually
> plays, with your crew's rules."

---

## 0. How to work

1. **Read first.** Re-read `CONTEXT.md`, `PHASE_PROGRESS.md`, `KNOWN_ISSUES.md`, the house-rules
   spec already in the repo, `golf-games-hub-spec.md`, `golf-games-screen-spec.md`, and the
   mockups. They remain the source of truth. **The existing house-rules spec governs** — where
   this prompt and that spec disagree, the spec wins; flag the conflict rather than guessing.
2. **Living docs.** Keep `CONTEXT.md`, `KNOWN_ISSUES.md`, `PHASE_PROGRESS.md` current as you go.
3. **Phase discipline.** Build only §2; respect the out-of-scope list in §3.
4. **Match the design exactly** — reuse the Phase 0–2 token system and components.
5. **Commit at the end of every verified turn** (the per-turn rule established in Phase 2), so
   each turn has a real diff boundary.
6. **Ask before deviating** from a locked decision; otherwise proceed and note assumptions.

---

## 0.5 Prerequisites — Phases 0–2 are complete and hand-verified

Phase 3 builds directly on a verified foundation. Do not re-architect these; use them.

- **Game engines are pure, tested functions** (`src/lib/games/`): `skins.ts`, `nassau.ts`,
  `match.ts`, `settlement.ts`, plus `scoring.ts` / `live.ts` for the compute + live-standings
  layer. New games follow this exact pattern.
- **`Side` already supports multiple players** (best-ball aggregation, even split) even though
  v1 only picks single-player sides. **Team formats drop in without re-architecting** — this was
  built deliberately for this phase.
- **Tri-state scores**: `number` = score, `null` = pick-up, `undefined` = not entered. Only
  complete holes feed the engines. **Never write 0 for a pick-up.**
- **Handicap engine** with round-level allowance modes (`full` / `relative`), per-game format
  allowance, and `allocateStrokes` that throws on missing stroke index.
- **Durable ledger**: `ledger_entries` with `UNIQUE(event_id, player_id)` + upsert. Settle,
  re-settle, settle-after-end-early, and handicap-edit-then-re-settle all update in place —
  **hand-verified against the live database.** Any new settlement path must route through the
  same upsert. Do not introduce a second write path to the ledger.
- **Live standings strip hierarchy** (locked): net $ is the headline, game-specific counts are
  supporting detail, this-hole/carry info is the quiet footer.

---

## 1. Phase 3 in one paragraph

Make Autocaddie play the games your crew actually plays, the way your crew plays them. Add
**Wolf**, **Vegas**, and **Nine Point** as three new tested engines alongside Skins, Nassau, and
Match Play, and add **house rules**: per-game configurable options with **crew-level presets** so
a crew's conventions carry from round to round, an **audit log** of rule changes, and
**immutable per-round config snapshots** so a settled round can always be recomputed under the
rules it was actually played by. Everything still settles into the same durable ledger.

---

## 2. Locked scope

### 2.1 House rules
- **Per-game configurable options** — each game exposes its own rule set (carryovers, scoring
  basis, point values, partner selection timing, etc. per the house-rules spec).
- **`crew_rule_presets`** — a crew's saved rule configuration per game, defaulted into new rounds
  so conventions persist without re-entry each time.
- **Audit log** — rule changes are recorded (who/what/when), so "why did we settle it that way"
  is answerable.
- **`round_game_configs` snapshot immutability** — when a round starts, the effective rules are
  **snapshotted onto the round**. Later edits to a crew preset **must not** retroactively change
  a played or settled round. Recompute always reads the round's snapshot, never the live preset.
- Rules are **locked at hole 1** alongside players and games (existing lock rule extends to
  rule config). Scores and handicaps stay editable.

### 2.2 New games (three engines)
- **Wolf** — rotating wolf order, partner selection or lone wolf, per the spec's configured
  variant.
- **Vegas** — two-player teams, paired scores form a two-digit number, difference settles.
- **Nine Point** — points distributed per hole among three players.

All three are **net by default** (gross configurable), handle **pick-up (`null`)** correctly, and
output **per-player standings + a signed net that sums to ~0** — identical contract to the
existing engines.

### 2.3 Everything else
- Wire the new games into **round setup** (game picker, rules, stakes, side/partner selection),
  **live standings**, **recap**, **scorecard**, and **settle-up** (by-game breakdown).
- Settlement combines all stakes-on games into one net per player and writes **one
  `LedgerEntry`** per player, exactly as today.

---

## 3. Explicitly OUT of scope

- **Multi-group outings** and **live multi-phone sync** — deferred to Phase 4. Single-device,
  solo-scorekeeper remains the model. Do not introduce multi-writer assumptions.
- Season standings UI, head-to-head views, settle-the-season, analytics dashboards (the §3
  deferred-verbs list still holds — data now, surfaces later).
- Round-home hero / swipeable multi-game strip polish (deferred; still a "first cut").
- Everything currently parked in the KNOWN_ISSUES deferred ledger that isn't named in §2.
- Billing/subscriptions, GHIN, payment deep-links.

---

## 4. Data model

**Propose the schema, then confirm before migrating.** The house-rules spec already defines the
shape — implement it, and flag any place it conflicts with the as-built Phase 1–2 schema.

Required properties, whatever the final column names:

1. **`crew_rule_presets`** — crew-scoped, per game type. Crew-scoped RLS, consistent with
   `crews` / `players` / `ledger_entries`.
2. **`round_game_configs`** — the **immutable snapshot** of effective rules for a specific
   round's game. Written at round start. Never mutated by preset edits.
3. **Audit log** — rule-change history. Append-only.
4. **Existing tables unchanged** where possible. `games` already carries `type`, `config` jsonb,
   `stakes_enabled`, `stake`, per-game `allowance`, `gross_or_net` — prefer extending the
   existing model over parallel structures.

**Migration discipline:** additive migrations only; apply with `supabase db push`; regenerate
types. State explicitly which existing tables you are and are not touching before you migrate.

---

## 5. Game rules — confirm defaults before building

These games have **many regional variants**, which is precisely why house rules exist. The
repo's house-rules spec is authoritative for defaults. Where it is silent, **ask rather than
assume** — a wrong default silently produces wrong money.

For each of Wolf, Vegas, and Nine Point, state before implementing:
- the scoring rule per hole,
- how ties resolve,
- how **pick-up (`null`)** is treated,
- how stakes convert to money and why the field sums to zero,
- which options are **configurable** (house rules) versus fixed,
- what the **default** configuration is,
- and the player-count constraints (e.g. Nine Point is a three-player game; Wolf and Vegas have
  their own valid counts) — including what the UI does when the round's player count doesn't fit.

---

## 6. Build order — ENGINES FIRST, and prove them by hand

This order is not negotiable; it is what made Phase 2 correct.

1. **Schema** (§4) — propose, confirm, migrate, regenerate types.
2. **Engines as pure functions + Vitest**, GREEN before any UI wiring: `wolf.ts`, `vegas.ts`,
   `ninepoint.ts`. Cover at minimum, for each game:
   - a full worked example that nets to ~0 across the field,
   - tie resolution,
   - **pick-up (`null`)** on each side, without NaN/throw and still summing to ~0,
   - each configurable rule option changing the outcome as expected (config actually applied),
   - stakes-off → standings computed, all nets 0.
3. **Hand-verifiable traces.** Before wiring UI, print a **plain-text hole-by-hole trace** for
   each new game (scores → per-hole result → running pot/points → final per-player net) so the
   owner can check the arithmetic by hand. Green tests only prove the engine matches the numbers
   the engine wrote; the trace is what proves the rules are right. **Wait for confirmation of the
   traces before building UI.**
4. **House-rules UI** — per-game rule config at setup, crew presets defaulted in, snapshot
   written at round start, audit entries recorded.
5. **Wire into existing surfaces** — live standings strip (net-headline hierarchy), recap,
   scorecard, settle-up by-game breakdown.
6. **Settlement + ledger** — combined net per player through the **existing** upsert path.

---

## 7. Deliverables & acceptance

**Deliverables:** three new tested engines; house-rules config with crew presets, audit log, and
immutable per-round snapshots; the new games wired end to end through setup → play → recap →
scorecard → settle; combined settlement writing one `LedgerEntry` per player.

**Acceptance:**
- Each new engine is **correct against a hand-checked worked example**, and its per-player nets
  sum to zero.
- A crew preset defaults into a new round; changing the preset afterward **does not** alter a
  previously played or settled round (snapshot immutability proven).
- Rule changes appear in the audit log.
- Rules lock at hole 1 with players and games; scores and handicaps stay editable.
- A round mixing an old game and a new game settles to one correct net per player, with the
  by-game breakdown reconciling to the minimized-payments view.
- Settle writes **one row per player**; re-settle updates in place (no duplicates) — the existing
  ledger guarantee still holds with the new games.
- Pick-up behaves correctly in all three new games.

---

## 8. Implementation gotchas

- **Pick-up = `null`, never 0.** A 0 is the best possible gross score and would win holes.
- **Snapshot vs. preset.** Every recompute path (live standings, recap, settle, re-settle) must
  read the **round's snapshot**, not the crew preset. This is the single easiest way to silently
  corrupt a settled round.
- **One ledger write path.** Route all settlement through the existing upsert with
  `UNIQUE(event_id, player_id)`. Do not add a second path.
- **Whole-field recompute.** Relative allowance derives from the field's lowest, so anything that
  changes one player's handicap must recompute the field (established in Phase 2.x).
- **Player-count validity.** Nine Point (and partner-based games) constrain player counts —
  handle invalid combinations in the UI at setup, not by throwing mid-round.
- **Multi-player sides.** Use the existing `Side` multi-player support for partner formats rather
  than inventing a parallel concept.

---

## 9. Definition of Done (Phase 3)

- [ ] **Self-play a full 18 at the kitchen table with 4 fake players**, mixing an existing game
      and a new game, start to finish. *(4-player runtime paths are under-exercised — most Phase 2
      testing was 2-player. This is a required gate, not a nice-to-have.)*
- [ ] Wolf, Vegas, and Nine Point each verified **against a hand count**, nets summing to zero.
- [ ] Pick-up behaves correctly in each new game; editing a past hole recomputes everything.
- [ ] A crew preset defaults into a new round; editing that preset afterward leaves the earlier
      round's results **unchanged** (snapshot immutability confirmed on a settled round).
- [ ] Audit log records rule changes.
- [ ] Combined settle-up nets correctly across mixed old/new games; both views; mark-as-paid.
- [ ] **Ledger still holds**: settle → one row per player; re-settle → updates in place, no
      duplicates; `paid` resets on changed amounts. **Verified in the Supabase table, not the UI.**
- [ ] Looks like the design system in light and dark; strip hierarchy preserved (net headline).
- [ ] `PHASE_PROGRESS.md` marked complete with a short report; `CONTEXT.md` and `KNOWN_ISSUES.md`
      updated.

---

## 10. Verification note

Green tests prove the compute layer only. Every gate that involves the database, the service
worker, or the browser must be confirmed **by hand on a prod build** (`npm run build`, then
`npm start`) — this is what caught a fail-open stroke-index gate, a stale service worker, and a
silent write failure in earlier phases. Report what you built plus the test inventory, and state
plainly which items you could **not** verify yourself so they can be checked by hand.
