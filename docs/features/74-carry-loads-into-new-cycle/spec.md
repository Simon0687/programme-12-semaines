# Spec - Carry working loads into a new cycle (#74)

## Context

A new cycle starts with no memory of the last one. `generate()` returns
`startingLoads: {}` (`src/generator.js`), and `planned()` (`src/progression.js`)
reads history through `historyBefore()`/`history()`, which skip every slot not in
the active program. With no base and no `v.start`, week 1 prescribes "Paliers —
50 → 75 → 100 % de la charge devinée". After twelve weeks of logged sets the app
asks the athlete to guess again, while the exercise sheet (#17,
`exerciseHistory()` in `src/exercise-history.js`) already shows every load across
cycles. The app knows; the session screen does not.
[#74](https://github.com/Simon0687/programme-12-semaines/issues/74) — unblocks #77.

## Scope

- **In:** when a draft opens in the program editor, every exercise it references
  that has logged history in *any* cycle gets its last working load pre-filled
  in "Charges de départ", marked as carried. Saved as ordinary `startingLoads`
  of the new definition. One pure module (`carryover.js`) computes the values.
- **Out:** widening `history()` or `planned()` to other cycles (the engine stays
  narrow on purpose: 8 reps in a 4–8 range is not 8 reps in 8–12); the
  end-of-cycle screen (#77); programs loaded from a file, which do not pass
  through the editor; the welcome screen's first program, which has no history.

## User-facing behaviour

**Plan → Programme → a creation door (« Générer mon programme », « Composer le mien », « Partir du programme actif »)** — the
editor opens as today. In **Charges de départ**:

- An exercise with history shows its carried load already filled, with a quiet
  note under the field: `reporté · 12 sept.` (the date of the session it comes
  from).
- An exercise without history stays empty, with today's text ("Laissé vide,
  l'exercice démarre par la semaine 1 de calibration…").
- Every value stays editable; clearing it returns the exercise to "Paliers".
- An exercise added to a session while editing is pre-filled the same way.

**Séance** — in the new cycle's week 1, a carried exercise shows a planned load
("charge de départ") instead of "Paliers". **Semaine, Bilan** — unchanged.

## Acceptance criteria

- [ ] Given a journal where `dc_db` was last logged at 26 kg × 8/8/7 in a
      completed cycle, when a new cycle is generated, then the editor shows 26 in
      its starting load, marked as carried with that session's date.
- [ ] Given the last session of an exercise was a deload, "allégée" or test
      session, then the value comes from the latest *other* session — the same
      `SKIPPED_AS_BASE` rule `planned()` applies.
- [ ] Given an exercise with no logged set in any cycle, then its field is empty.
- [ ] Given a bodyweight or no-load unit, then its field follows its unit (added
      load or nothing), never an invented kilo value.
- [ ] Given the athlete edits or clears a carried value, then the saved
      definition holds exactly what the field shows.
- [ ] Given the new cycle is saved, then its week-1 session shows the carried
      load as planned, and no older journal reads differently.
- [ ] `carryover.js` is pure and tested under `node --test`; `progression.js` is
      not modified.

## Data & storage impact

No new field: carried loads are written into the existing `startingLoads` of the
new definition — ARCHITECTURE §2.1, **store the value, not the reference**. The
value becomes data of the new cycle; re-reading an old journal is unaffected, so
no migration and no `SCHEMA_VERSION` bump. **MINOR** — a compatible addition;
every existing journal loads unchanged. Level A per `.claude/WORKFLOW.md` Q3 (new
capability, `startingLoads` changes provenance), hence `/decide` before code.

## Edge cases

- **Mixed loads in the last session** (drop set, back-off): the carried value is
  the working load `workingSets()` selects, not the heaviest set.
- **Same exercise in two slots with different ranges:** one value per exercise
  (`startingLoads` is keyed by exercise id), taken from the most recent session.
- **Exercise last done a year ago:** still carried, but its date is on screen.
- **Journal with rows that fail validation** (unusable cycle): its sets still
  count — the sheet already reads them; `setsOf`/`normalizeSets` guard the shape.
- **« Partir du programme actif »:** its old `startingLoads` are overwritten by
  observed values where history exists (see Q2).

## Out of scope / follow-ups

- The header of `src/exercise-history.js` still says `history()` throws on a
  string `ex` payload and points to #38; stale since #86/#85 — fix in passing.

## Open questions

1. **Raw load, or adjusted to the new rep range?** Last cycle's working load was
   at 1 RIR in its own range; week 1 of the new cycle is calibration at 2–3 RIR,
   possibly in another range. Proposal: carry the **raw** load and let
   calibration correct it; convert through the existing 10RM estimate only if
   the ranges differ by more than a few reps. Needs a decision.
2. **« Partir du programme actif »:** should observed loads replace the copied
   `startingLoads`, or only fill empty fields? Proposal: replace — the copied
   values are the old cycle's *starting* guesses, the observed ones are newer.
3. **How old is too old?** Carry anything, or ignore history older than, say,
   six months? Proposal: carry anything, the date on screen lets the athlete judge.
