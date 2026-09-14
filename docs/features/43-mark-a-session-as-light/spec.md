# Spec - Mark a session as deliberately light (#43)

## Context

`planned()` keeps no memory of what it prescribed: its base is always the last
validated session (`src/progression.js:62-67`). A session performed lighter than
the last one therefore becomes the new reference immediately — measured on the
real engine, a contract at 102,5 kg followed by `8 @ 80` × 3 answers **82,5**,
i.e. nine sessions at +2,5 kg to climb back. After an injury that is right; after
a deliberately easy session it is punitive, and the app cannot tell the two apart
unless it is told.
([#43](https://github.com/Simon0687/programme-12-semaines/issues/43))

The engine already honours the distinction — a session whose `kind` is `"deload"`
is skipped as a base — but `kind` is derived from the week number
(`computeKind`, `src/progression.js:38`), so nothing outside week 7 can carry it.

## Scope

- **In:** a way to mark one validated session as deliberately light, so the next
  suggestion is computed from the last session that was not; the question that
  offers it; the trace it leaves in the exercise sheet.
- **Out:** marking a single exercise rather than a whole session (see Out of
  scope). Any change to how loads are entered, to the progression branches, or to
  the reduction thresholds. Retro-marking a past session from anywhere but the
  session screen.

## User-facing behaviour

**Séance.** The only screen that changes, and only in one case.

When "Valider la séance" is tapped for the first time and at least one exercise's
working load is **more than one increment below the reference the engine is
using**, the button is replaced by a bordered panel — the pattern already used to
confirm an import (`src/App.jsx:905-914`):

> **Séance plus légère que la précédente**
> Développé couché : 80 kg au lieu de 100 kg.
> Si c'était volontaire, ta charge de référence ne bouge pas : la prochaine
> séance repartira de 100 kg.
> [ Valider, séance allégée ] [ Valider, 80 kg est ma référence ]

- One line per exercise whose working load dropped. With more than one, the
  consequence sentence drops the numbers and reads "tes charges de référence ne
  bougent pas : la prochaine séance repartira d'où tu en étais".
- Both buttons validate. They differ only in what they do to the reference, so
  each states its own effect — never an OK/Cancel to decode. Neither is the amber
  primary: a choice with no right answer should carry no default that attracts
  the thumb.
- **Nothing appears when no load dropped**, which is the overwhelming majority of
  sessions. There is no permanent control anywhere — no checkbox, no second
  button, nothing to discover before the situation arises.
- **Nothing appears in weeks 1 and 7.** Those sessions already carry a `kind`
  that drives the engine (calibration, deload) and a light week 7 is the
  programme working as designed; asking there would fire on every exercise and
  would need `kind` to hold two meanings at once.

**Plan.** One sentence in "Progression et charges": a session marked allégée does
not change the reference loads, and the app offers it only when you go below your
last session. Nothing about how the working load is picked — the "Prévu" line
already carries "(jugé sur 100 kg)" where that matters (#31).

**Fiche exercice.** An allégée session carries an "allégée" pill in the historique
and a hollow point on the chart, exactly like calibration and deload
(`src/display.js:103`, `:253`). Without it the curve shows an unexplained dip.

**Semaine, Bilan.** Unchanged. `src/bilan.js` never reads `kind`.

## Acceptance criteria

- [ ] Given a normal-week session not yet validated, whose working load is more
      than one increment below the reference on at least one exercise, when
      "Valider la séance" is tapped, then the panel appears naming each exercise
      that dropped, both loads, and what each choice does.
- [ ] Given a session at or above the reference, when it is validated, then no
      panel appears and the flow is exactly today's — one tap.
- [ ] Given a drop of exactly one increment — 102,5 kg down to 100 on an exercise
      whose `incr` is 2,5 — then no panel appears: that is rounding, not a light
      session, and it climbs back on its own next session.
- [ ] Given an already-validated session, when "Mettre à jour la séance" is
      tapped, then no panel appears and the stored `kind` is preserved — an
      `"allege"` flag survives a corrected note. "Rouvrir" then validating asks
      again.
- [ ] Given a week 1 or week 7 session however light, when it is validated, then
      no panel appears and its `kind` stays `calibration` / `deload`.
- [ ] Given a session validated as allégée, when the next session for that slot
      is planned, then the suggestion is computed from the last session that was
      not allégée — `102,5` after `8 @ 100` then an allégée `8 @ 80`, not `82,5`.
- [ ] Given a session validated as the new reference, when the next is planned,
      then the result is byte-identical to today.
- [ ] Given an allégée session, when its exercise's sheet is opened, then the row
      carries an "allégée" pill and its chart point is hollow.
- [ ] Given a journal written before this issue, when the app loads it, then
      nothing changes: no session is allégée, `SCHEMA_VERSION` is untouched, and
      every suggestion is what it was.

## Data & storage impact

`logs[].kind` gains one value, `"allege"`, beside `calibration` / `deload` /
`normal`. No field added, renamed or removed. `src/journal-shape.js:229` inspects
`date`, `slot` and `ex` and never `kind`, so the validator needs no change and no
journal is rejected.

**Level: MINOR.** CONTRIBUTING.md — "compatible addition, existing journal
intact". A journal saved by the previous version loads without loss, and a
journal carrying `"allege"` opened by an older build reads it as an unknown kind,
which every consumer already tolerates (`KIND_LABELS` renders no pill,
`planned()` treats it as a normal base).

**Workflow level: A**, the stricter axis. `.claude/WORKFLOW.md` Q3 answers YES —
this is a new competence: the user can tell the engine something it could not be
told. The sensitive-module override applies anyway, `progression.js` being on the
list. So: spec → `decisions-spec.md` → `design.md` → code on a branch from `dev`.

## Edge cases

- **Several exercises dropped.** One line each; the consequence sentence goes
  generic. A session where everything dropped is exactly the case the feature
  exists for.
- **A blank weight at validation.** `src/App.jsx:437-439` fills it from
  `planned()` before writing, so the comparison must run on the sets as they will
  be stored — a session validated with empty weights carries the planned load and
  has not dropped.
- **Re-validating ("Mettre à jour la séance").** `validate()` rewrites `kind`
  unconditionally today (`src/App.jsx:441`), so an existing `"allege"` would be
  erased on any later update. See Open question 1.
- **Reopening.** `reopen()` sets `done: false` and leaves `kind` in place
  (`src/App.jsx:445`). A reopened session is not a base for `planned()` — it
  filters on `rec.done` — so nothing is read from it while it is open.
- **An exercise done for the first time.** No previous session, so no comparison
  and no panel for that exercise.
- **Every session allégée.** `planned()` walks back to the last non-allégée
  session; with none at all it falls through to the no-history branch, exactly as
  a fresh cycle does.
- **A `bw` exercise at bodyweight.** The working load is 0 on both sides, so
  nothing dropped.

## Out of scope / follow-ups

- **Per-exercise rather than per-session.** `kind` is a session-level flag, so
  easing off only on squat because of a knee marks the whole session and the
  bench loses its progression too. Accepted deliberately: the "easing off" case is
  fully covered, the injury case partially, and the finer grain means a new stored
  field, a migration and its own level-A change. Simon's reasoning, 2026-09-14:
  in normal training you do not drop the bench by 20 kg and perform on everything
  else. Let usage say whether it is missed.
- **`planned()` writes a suggestion into the journal** (`src/App.jsx:437-439`),
  carried over from #31. Unrelated to this issue and still unfiled.

## Decisions

Settled 2026-09-14, `decisions-spec.md`.

1. **The panel is offered on the first validation only** (Q1-A). An update
   preserves the stored `kind`, so an `"allege"` survives a corrected note.
   Changing the answer goes through "Rouvrir", which a validated session already
   renders on screen (`src/App.jsx:732`).
2. **It fires on a drop of more than one increment** (Q2-C) — `v.incr`, the
   exercise's own value from the registry, not an invented percentage. A
   single-increment dip is rounding and climbs back on its own; over-firing would
   turn the one place this feature exists into something to dismiss.
3. **The comparison is against the reference `planned()` is using, not against
   the previous session.** Found while designing, and it is what makes the
   feature hold: with "previous session", a second light session at the same load
   shows no drop, is never offered the question, and silently becomes the new
   reference — undoing the first session's allégée. The reference is the base
   `planned()` already computes, which skips deloads and now allégées.

## Open questions

None.
