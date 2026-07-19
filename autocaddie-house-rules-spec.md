# Autocaddie — House Rules Customization Spec
*Living reference doc — v1, July 2026*

## Purpose
This doc captures the decision to add per-crew, per-game house rule customization to Autocaddie, why it's prioritized, and the data model to build it on top of the existing durable schema (crews, durable players, crew-scoped ledger entries, retained hole scores). Paste this into a fresh chat to pick up context without re-explaining the competitive research behind it.

---

## Why this exists (context for future chats)
Competitive research (July 2026) on golf money-game apps — Skins App (Troon-backed), Settle Up Golf, Beezer Golf, Stick Golf — found:
- Actual App Store traction is much smaller than marketing implies (Skins App: 3.8★/28 ratings despite a 2024 Troon partnership; Settle Up Golf: 4 ratings, brand-new, iPhone-only despite multi-platform marketing claims)
- Common failure modes: sync/reliability complaints, rigid rules that don't match how real groups actually play, and feature-sprawl-driven quality decay (Beezer: ~30 game formats but only 3.7★, crashes, scoring-accuracy complaints)
- **Conclusion**: the category is winnable on execution, not closed. The clearest unaddressed gap is house-rule customization — real groups argue about specific press/carryover/scoring quirks that none of the competitors handle well.

**Game count decision**: ship 6 games deep (Skins, Nassau, Match Play — already built; adding Wolf, Vegas, Nine Point) rather than following Beezer's breadth-over-depth path.

**Sequencing decision**: ship opinionated defaults first, add configuration only for rules that generate real disagreement in actual crew play, and treat every rule combination as requiring a Vitest test case — settlement accuracy can never break.

---

## Design principles
1. **Crew-scoped, savable, reusable.** A crew configures house rules once ("Saturday Crew Rules," "Wednesday League Rules") and reuses them every round — this is the actual differentiator, not the existence of toggles.
2. **Snapshot immutability.** Once a round is played, the rules used must be frozen to that round permanently. If a crew edits their preset later, it must never retroactively change historical settled rounds or ledger entries. This is a hard requirement given the existing `UNIQUE(event_id, player_id)` ledger constraint and the emphasis on a durable, auditable ledger.
3. **Opinionated defaults over blank slates.** Every game ships with a sensible default config. Configuration is additive, not required.
4. **Small, tested surface area.** Every exposed toggle needs a corresponding Vitest case covering its interaction with presses/carryovers/settlement math.
5. **Admin-gated changes.** Preset creation/editing is restricted to a crew admin — not open to any member. Requires an `is_admin` (or `role`) flag on the crew-membership join, if not already present in the durable player/crew schema.
6. **Confirm before lock, unconfirmed rounds are allowed but flagged.** Admin confirmation is the intended path, but a round is not blocked from starting without it — if tee time arrives unconfirmed, the round proceeds using the resolved default config, and the round is marked `flagged_unconfirmed` for visibility. Once a round has any hole scores entered, its `config_snapshot` is frozen regardless of confirmation status — no mid-round changes under any circumstance.
7. **One correction window, then hard lock.** A genuine data-entry mistake (not a rules dispute) in `config_snapshot` can be corrected by an admin only until the first hole score is entered for that round. The instant a score exists, the config is permanently frozen — no exceptions past that point.
8. **Preset limits keep the picker usable.** Cap of 5 saved presets per `(crew_id, game_type)`. Enforced at write time; revisit only if crews are actually hitting the cap in practice.

---

## Data model

### `crew_rule_presets`
Stores a named, reusable rule configuration per crew, per game type.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `crew_id` | uuid, FK → crews | scoped to a crew, not global |
| `game_type` | enum | `skins`, `nassau`, `match_play`, `wolf`, `vegas`, `nine_point` |
| `name` | text | e.g. "Saturday Crew Rules" |
| `config` | jsonb | shape defined per game type below |
| `is_default` | boolean | one default per (crew_id, game_type) |
| `archived_at` | timestamptz, nullable | soft delete — never hard-delete if any round has referenced it |
| `created_at` / `updated_at` | timestamptz | |
| `created_by` | uuid, FK → players | must resolve to a crew admin at write time |

Constraint: at most one `is_default = true` per `(crew_id, game_type)`. Constraint: max 5 non-archived rows per `(crew_id, game_type)` — enforce at write time and surface a clear error in the UI ("archive an old preset to add a new one") rather than a silent failure.

**Permission rule:** insert/update on `crew_rule_presets` requires the acting player to have `is_admin = true` on their `crew_members` row for that `crew_id`. Any single admin can act unilaterally — no multi-admin consensus required, for presets or for round confirmation. Enforce at the API/service layer (and ideally with a DB-level check via row-level security or a trigger) — don't rely on client-side gating alone, since these values feed the settlement ledger.

### `crew_rule_preset_edits` (audit log)
Lightweight history of who changed a preset's config and when — separate from the per-round immutable snapshot, this is about accountability within a crew ("who changed our Nassau rules?").

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `preset_id` | uuid, FK → crew_rule_presets | |
| `edited_by` | uuid, FK → players | |
| `previous_config` | jsonb | |
| `new_config` | jsonb | |
| `edited_at` | timestamptz | |

Written automatically on every update to `crew_rule_presets.config` — append-only, never edited or deleted.

### `round_game_configs`
The actual snapshot used for a specific round/event — this is what settlement math reads from, never `crew_rule_presets` directly.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `event_id` | uuid, FK → events | |
| `game_type` | enum | |
| `preset_id` | uuid, FK → crew_rule_presets, nullable | provenance only — "this came from preset X"; null if resolved from `starter_rule_presets` (ad hoc rounds) |
| `config_snapshot` | jsonb | **frozen copy** of the config values actually used, resolved at round creation |
| `confirmed_by` | uuid, FK → players, nullable | admin who confirmed rules; null if round proceeded unconfirmed |
| `confirmed_at` | timestamptz, nullable | |
| `flagged_unconfirmed` | boolean | true if tee time arrived / round started without admin confirmation — surfaced in UI so the group knows defaults were used without sign-off |
| `first_score_entered_at` | timestamptz, nullable | set the moment the first hole score lands on this round |
| `locked_at` | timestamptz, generated | equals `first_score_entered_at` once set — from that point, `config_snapshot` is permanently immutable, confirmed or not |
| `created_at` | timestamptz | |

**Critical rule:** settlement engines read `round_game_configs.config_snapshot` only. `crew_rule_presets.config` can be edited freely without touching history, because nothing historical points at it directly.

**Confirm-or-flag flow:** `config_snapshot` is populated (resolved from the crew's default/chosen preset, or the global starter default for ad hoc rounds) when the round is created. An admin can confirm it any time before the first hole score is entered — confirming just sets `confirmed_by`/`confirmed_at` and clears the flag. If no admin confirms before scoring starts, the round proceeds anyway using the resolved default, `flagged_unconfirmed` stays true, and it's visible in round history so the group can see it wasn't explicitly signed off. **Correction window:** an admin can edit `config_snapshot` directly (fixing a genuine data-entry mistake, not renegotiating a rule) any time before `first_score_entered_at` is set — after that, the row is write-protected at the API layer with zero exceptions, confirmed or not.

**Cross-crew rounds:** when a round includes players from more than one crew, `preset_id`/`config_snapshot` resolve from the **round creator's** crew defaults unless someone explicitly picks a different preset before the first score is entered.

**Ad hoc rounds (no crew):** resolve `config_snapshot` from the relevant `starter_rule_presets` default (see below) rather than any crew preset; `preset_id` stays null.

---

### `starter_rule_presets`
A global, non-crew-scoped library of common house-rule combos. Also serves as the default config source for ad hoc rounds with no crew.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `game_type` | enum | |
| `name` | text | e.g. "Standard Friendly Nassau" |
| `description` | text | short human-readable summary shown in picker UI |
| `config` | jsonb | same shape as `crew_rule_presets.config` for that game type |
| `is_featured` | boolean | curated manually by you for now — revisit auto-promotion by usage once there's real data to rank by |
| `is_global_default` | boolean | exactly one `true` per `game_type` — this is what ad hoc/no-crew rounds resolve to |
| `created_at` | timestamptz | |

**Seeding for launch:** one sensible default per game (6 total rows), each flagged `is_global_default = true` for its game type. Expand the library later once real crews show what combos they actually want — don't over-build this up front.

**Flow:** when a crew admin creates a new preset, offer "start from a template" (pulls from `starter_rule_presets`) or "start from scratch" (blank defaults). Selecting a template **copies** its `config` into a new `crew_rule_presets` row — it does not reference the starter preset live, so Autocaddie can edit/improve the shared library later without altering any crew's existing presets.

---

## Per-game config schemas (`config` / `config_snapshot` shape)

### Nassau
```json
{
  "press_mode": "auto" | "manual" | "off",
  "auto_press_trigger": "2_down" | "1_down",
  "press_stacking": "allow_multiple" | "cap_one_active",
  "segments": { "front": true, "back": true, "overall": true },
  "wagers": { "front": 5, "back": 5, "overall": 5 },
  "tie_handling": "push" | "carry"
}
```

### Skins
```json
{
  "carryovers": "on" | "off",
  "carryover_scope": "all_ties" | "birdie_or_better_only",
  "par3_multiplier": 1,
  "scoring": "net" | "gross",
  "validation": "outright_win_no_ties" | "standard"
}
```

### Wolf
```json
{
  "lone_wolf_enabled": true,
  "blind_wolf_enabled": true,
  "lone_wolf_multiplier": 2,
  "rotation_rule": "standard" | "skip_if_absent"
}
```

### Vegas
```json
{
  "flip_rule": "standard" | "flip_on_birdie_or_better",
  "point_value_per_swing": 1
}
```

### Nine Point
```json
{
  "point_split": [5, 3, 1],
  "tie_handling": "redistribute" | "split_even"
}
```

### Match Play
```json
{
  "format": "singles" | "best_ball_2v2",
  "press_mode": "auto" | "manual" | "off"
}
```

---

## Screen / flow inventory
Structural inventory only — no visual design decisions here. Actual layout, spacing, and component choices should be handled at build time by Claude Code using the existing Tailwind v4 / shadcn base-nova design system, so this feature matches the rest of the app rather than inventing a new visual language in the abstract.

1. **Preset picker** — shown during round setup. Lists the crew's saved presets (max 5, admin-managed) plus an option to browse starter templates. Selecting one resolves `config_snapshot` for the round.
2. **Preset editor** — admin-only. Create/edit a named preset's config (the toggles defined in the per-game schemas above). Includes "start from a template" (pulls from `starter_rule_presets`) vs. "start from scratch" (blank defaults). Surfaces the 5-preset cap with a clear message if hit.
3. **Pre-round "Confirm House Rules" screen** — admin sees the resolved config and taps confirm (sets `confirmed_by`/`confirmed_at`, clears the unconfirmed flag). Non-admins see the same rules as a read-only summary, no action needed from them.
4. **Flagged-unconfirmed indicator** — a badge/banner on the round itself and in round history when `flagged_unconfirmed = true`, so the group can see the round used defaults without explicit sign-off.
5. **Starter library browser** — surfaced inside the preset editor's "start from a template" flow. Shows `is_featured` templates first; full list available beneath.
6. **Preset edit history view** (optional, lower priority) — a simple log view surfacing `crew_rule_preset_edits` (who changed what, when) for a given preset, for crews that want the transparency.

---

## Build sequencing
1. Ship Wolf, Vegas, Nine Point with hardcoded defaults (no config UI yet) — matches existing Skins/Nassau/Match Play pattern
2. Add `crew_rule_presets`, `crew_rule_preset_edits`, `round_game_configs`, and `starter_rule_presets` tables; seed `starter_rule_presets` with 1 `is_global_default` row per game (6 total)
3. Wire config resolution into round creation: crew default → cross-crew creator's-crew rule → ad hoc global-default fallback
4. Add preset management UI (create/name/edit/set-default per crew, capped at 5 per game type) — start with Nassau press rules and Skins carryovers only, since those are the highest-friction real-world disagreements
5. Add the pre-round confirm screen (admin-only, non-blocking) and the `flagged_unconfirmed` indicator in round history
6. Enforce the correction window / hard lock at `first_score_entered_at` in the API layer — this is the one rule that must never have an exception path
7. Expand config surface to Wolf/Vegas/Nine Point only after the first two are proven solid in your own crew's rounds
8. Every new toggle ships with a Vitest case exercising it against the settlement engine before merge

---

## Decisions (fully resolved July 2026)
1. **Admin-only preset edits.** Only a crew admin can create/edit `crew_rule_presets`. Any single admin can act unilaterally — no consensus required.
2. **Round confirmation: admin only, not blocking.** An admin confirming rules is the intended flow, but an unconfirmed round is still allowed to start — it proceeds on the resolved default config and is marked `flagged_unconfirmed` so it's visible in round history.
3. **Correction window ends at first score, no exceptions after.** An admin can fix a genuine data-entry mistake in `config_snapshot` any time before the first hole score is entered. The instant a score lands, the config is permanently frozen — confirmed or not, admin or not.
4. **Starter preset library: build it, seed minimally.** One sensible default per game (6 rows) at launch, each flagged `is_global_default`. Expand later based on real crew usage rather than guessing up front.
5. **Ad hoc/no-crew rounds** resolve their config from `starter_rule_presets.is_global_default` for that game type.
6. **Cross-crew rounds** resolve from the round creator's crew defaults, overridable by explicit preset choice before the first score is entered.
7. **Multiple admins:** any single admin can confirm/lock a round or edit a preset — no majority or consensus requirement.
8. **Preset edit audit trail:** yes — `crew_rule_preset_edits` logs every config change (editor, timestamp, before/after), append-only, separate from the per-round immutable snapshot.
9. **Preset cap:** 5 non-archived presets per `(crew_id, game_type)`, enforced at write time with a clear UI error rather than a silent failure.
10. **Starter library curation:** manual for now — you flag `is_featured`; revisit auto-promotion by usage once there's real data.
