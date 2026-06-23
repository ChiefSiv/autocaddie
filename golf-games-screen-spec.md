# Golf Games Hub — Screen & Feature Spec (v0.1)

**Companion to:** the product spec (v0.3) and the five design mockups (visual direction,
round home, hole entry, scorecard, round setup, settle-up).
**Purpose:** define every page so the build stays simple for everyday use while the app's
depth is there when wanted. Research-informed (Golf GameBook, mobile onboarding best
practice).

---

## 1. How to read this

Each screen lists its **job**, the **key elements**, the **simple default** most people
see, the **power underneath** that reveals on demand, and any **design-system** notes. The
governing rule (product-spec principle #7): complexity scales to need — one game, one
group, one tap is the default; outings, stacked games, and stats layer on.

---

## 2. Design system — applies to every screen

So the Home Screen and everything else match the round flow, every page draws from one
token set:

- **Color:** Fairway green `#0E6B3C` (brand/structure), Flare orange `#FF5C24` (energy,
  actions, win moments), Ink `#0B1410`, Chalk `#F6F7F3`. Money semantics: Up `#1FA85A`,
  Down `#E0453C`, Carry `#F2A33C`. Auto light/dark; light tuned for sun.
- **Type:** Saira Condensed (display, scores, status), Saira (labels/eyebrows), Hanken
  Grotesk (body).
- **Components (shared vocabulary):** scoreboard numerals, stroke-index dots, the
  gross+net cell, big athletic status readouts, segmented toggles, the dark "hero" card,
  ledger rows, chip tags.
- **Feel:** bold and sporty, high contrast, large tap targets (on-course, one-handed,
  gloved), minimal taps to act.

---

## 3. Navigation (information architecture)

A 5-slot bottom tab bar with the core action in the center:

```
 Home        Rounds      [ + PLAY ]      Friends      You
 dashboard   history      start/join     crews         profile
```

- **+ Play** (center, Flare): the dominant action — start a round or join one. Everything
  else is secondary to getting a round going.
- Four tabs keep the app shallow; nothing important is more than one tap from Home.

---

## 4. What keeps it simple yet powerful (vs. GameBook)

GameBook's own reviews name the gaps this app wins on — design around them:

- **Fast scoring, always gross + net.** Their users report changing teams to score takes
  "7 clicks… 21 per hole," and that gross *and* net aren't viewable. Our scorecard shows
  both by default; score entry targets 1–2 taps per player and never buries group switching.
- **Offline-first.** A common request they don't meet. Ours works in dead zones (local-first).
- **Stacked games + Wolf.** Their users literally ask for "Wolf" and "3 games at once."
  Ours stacks games with one combined settle-up, Wolf included.
- **Real settlement.** GameBook is social/stats-first; it doesn't square the money. Our
  ledger + minimized payments is the differentiator.

These are the "power" — surfaced only when invoked, never cluttering the default.

---

## 5. Onboarding (guest-first)

**Job:** get someone from install to a live round in under a minute, signup deferred.

- **Welcome (1 screen).** Outcome framing, not features: "Pick a game. Keep score. Settle
  up." Brand visuals. One primary button: **Start playing**. Skip available.
- **Continue as guest** is the default path — no account required to score a round. Apple /
  Google one-tap sign-in offered but not forced (delaying signup converts far better).
- **One useful question:** your handicap index (manual now; GHIN later). It produces an
  immediate payoff — the app shows the strokes you'll get — which is the "aha," not a form.
- **No tour walls.** Help is in-context later (tap-to-learn on first use of a game type).
- Progressive profiling: name/avatar, friends, GHIN are asked later, in context, not upfront.

**Design:** full-bleed Ink hero with Flare CTA; one concept per screen; a progress dot row
only if more than one screen.

---

## 6. Home (dashboard)

**Job:** start the usual round in one tap, or see what's live and what just happened.

**Simple default (top to bottom):**
- Greeting + your handicap index and recent trend (small).
- **Start a round** (big Flare CTA) and **Join** (code/link) side by side.
- **Your regular games** — one-tap re-creates a saved setup (e.g. "Saturday crew · Skins,"
  "Wednesday league · Outing skins"). This is the single biggest friction-killer: regulars
  skip setup entirely.
- **Recent round** card: last result + whether it's settled.

**Power underneath:**
- **Friends on course (live):** if anyone you know is playing right now, show them and let
  you follow their leaderboard (GameBook's strongest hook). Hidden/empty-stated when none.
- A compact stat snapshot (last score, handicap movement) linking into Rounds.

**Design:** the live game / regular-game cards reuse the dark hero + chip vocabulary;
empty states are invitations ("No one's out right now — start a round").

---

## 7. Start a round  *(mockup exists)*

**Job:** configure and launch. Opens on **one game**; everything else is progressive.

- Join code up top (others join during setup), course (cached DB + tee selector), players
  (index + account/guest tag), one game card with the **Social/Stakes toggle** and
  scope/net chips, scoring mode (solo vs everyone-on-phones).
- **+ Add** reveals stacking more games and switching to **whole-outing scope**.
- Smart defaults: last course, last group, last game preselected for repeat rounds.

---

## 8. Join a round

**Job:** get into someone's round instantly.

- Enter/auto-fill code, tap a share link, or scan QR. Guest name only; account optional.
- Lands directly in the round's live view — no setup, no friction.

---

## 9. Live round  *(mockups exist)*

Recap of the in-round screens, all sharing the scoreboard language:
- **Round home (single-game hero):** the one game as the centerpiece; card one tap below;
  "+ Add a game" doorway. Multi-game turns the hero into a swipeable strip/tabs.
- **Hole entry:** oversized stepper, stroke dots, net derived live; solo mode enters for the
  group, live mode each enters their own.
- **Scorecard:** frozen name column + scrolling holes, gross + net per cell.
- **Settle-up:** combined who-pays-whom + by-game toggle (toggle hidden when one game);
  ledger-only with Venmo/Mark-paid.

---

## 10. Rounds (history) + round detail

**Job:** revisit results and feed stats.

- **List:** reverse-chronological round cards — course, date, your gross/net, games played,
  settle status.
- **Detail:** the saved scorecard (read-only), each game's result, the settlement, and any
  shared moments. Re-open to "play this group/setup again."
- **Simple default:** just your rounds. **Power:** filters by course/group/game, season view.

---

## 11. Stats & records

**Job:** show improvement without overwhelming.

- **Default:** three numbers — scoring average, handicap trend, rounds played.
- **Power (one tap deeper):** birdies/pars/bogeys mix, by-hole and by-course breakdowns,
  game records (skins won, match record), head-to-head vs friends. Aligns with the
  "prosumer who wants real signal" audience; gated behind a tap so the default stays clean.

---

## 12. Friends & groups

**Job:** make re-inviting your regular crew effortless and add the social layer.

- **Friends list** with add-by-link/contacts; **Groups** = saved crews (Saturday crew,
  Wednesday league) used for one-tap round creation and team auto-balancing.
- **Friends on course** live indicator feeds Home.
- **Power:** follow a friend's live leaderboard; head-to-head history.

---

## 13. You (profile & settings)

**Job:** identity, handicap, preferences.

- Handicap index (manual / GHIN later), avatar, name, your records snapshot.
- **Settings:** light/dark/auto, default tee, default scoring mode, payment handles for
  settle deep-links, notifications, account/sign-in (upgrade from guest here).
- Keep it short; advanced toggles live under a "More" disclosure.

---

## 14. Outings (multi-group) — the power feature

**Job:** run a bigger event with several tee groups, on demand, without complicating the
default. *(Build Phase 3.)*

- Created from **+ Play → Outing** (or by flipping a round to multi-group). Organizer adds
  groups, assigns players (default) or lets them self-select (toggle).
- **One shared game across the field** (your whole-outing Skins) plus each group's own
  games; a **combined leaderboard** spans all groups; settlement rolls up per player.
- Live "flights on one leaderboard" view for spectators/the organizer.
- Everyday users never see this surface unless they start an outing.

---

## 15. Course search

**Job:** find the course fast.

- Search by name; **"near me"** using location for the common case; recent courses pinned.
- Pulls from the cached DB; manual add/edit fallback for missing data, with the
  **confirm-stroke-index** safeguard at first use.

---

## 16. Cross-cutting

- **Empty states are invitations,** never dead ends ("No rounds yet — start your first").
- **Offline:** any in-round screen works without signal; a small synced/-pending indicator
  shows status; never blocks scoring.
- **Notifications (sparingly):** your turn to enter a hole, a friend teed off, settle-up
  ready. Timed to matter, easy to mute — poorly timed notifications increase churn.
- **Voice/tone:** plain verbs, active voice, golf-native words; the action keeps its name
  through the flow ("Start round" → "Round started").

---

## 17. Build priority (folds into the phased plan)

- **Phase 2 (weekend-ready):** Onboarding (guest), Home (start/join + regular games +
  recent), Start a round, Join, the live screens, Settle-up, basic Rounds list.
- **Phase 3 (summer outings):** Outings, Friends-on-course, combined leaderboard.
- **Phase 4+:** Stats & records depth, Friends/social, profile polish, GHIN.
