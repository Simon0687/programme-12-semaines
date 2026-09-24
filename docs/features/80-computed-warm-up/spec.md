# Spec - Computed warm-up: a ladder from the first heavy exercise's planned load (#80)

## Context

The session's "Échauffement" section renders `prog.WARM[session.warm]` as fixed
text (`src/App.jsx`, `<Section title="Échauffement">`). The bundled program's
text already prescribes a ramp — "montée en charge sur le premier exercice :
50 % × 8, 70 % × 4, 85 % × 2" — but leaves the athlete to turn percentages into
kilos, between the band and the bench. The app already knows that load:
`planned()` (`src/progression.js`) returns it for every slot, and `loadText()`
already writes it in the exercise's own terms. [#80](https://github.com/Simon0687/programme-12-semaines/issues/80)

## Scope

- **In:** under the existing warm-up text, one computed line with the ramp in kg
  for the session's first exercise (`session.ex[0]`), rounded to that exercise's
  `incr`. A pure function computes it; the component only renders it.
- **Out:** changing or parsing the `WARM` texts; recording warm-up sets; a ramp
  for any exercise other than the first; a setting to edit the percentages.

## User-facing behaviour

**Séance** — the "Échauffement" section keeps its text, then adds one line:

> Montée en charge — Développé couché haltères : 12 kg × 8 · 16 kg × 4 · 20 kg × 2 / main

- Loads follow `loadText()`: "/ main" for `perHand`, same unit wording.
- When the first exercise has no planned load (calibration "Paliers", a unit
  with no load, bodyweight), the line is absent and the text is unchanged — no
  empty shell, no placeholder.
- A step that would round to the same load as the previous one, or to 0, is
  dropped (light loads with a 2 kg increment).
- Deload week: the ramp is computed from the deload load `planned()` already
  returns — nothing to special-case.

**Semaine, Bilan, Plan** — unchanged.

## Acceptance criteria

- [ ] Given a first exercise with planned load 24 kg / main and `incr` 2, when
      the session opens, then the line reads `12 kg × 8 · 16 kg × 4 · 20 kg × 2 / main`
      (50 / 70 / 85 %, rounded to `incr`).
- [ ] Given week 1 (calibration, `planned()` returns "Paliers", `load: null`),
      then no ramp line is shown and the text is as today.
- [ ] Given a first exercise whose unit has no load or is bodyweight, then no
      ramp line.
- [ ] Given a substituted first exercise (#55), then the ramp uses the
      substituted exercise's name, load and `incr`.
- [ ] Given steps that collapse after rounding, then duplicates and zeros are
      dropped; a ramp reduced to nothing shows no line.
- [ ] The computing function is pure and tested under `node --test`; no
      calculation in the component (ARCHITECTURE §2.6).
- [ ] Nothing new is written to the journal; `npm test` green.

## Data & storage impact

None. Read-only: the ramp is derived from `planned()` on each render and never
stored. A warm-up is not a working set, and the journal must not learn to carry
one (ARCHITECTURE §2.2). **MINOR** — a compatible addition to a screen, every
existing journal loads unchanged.

## Edge cases

- **Calibration / no history:** no planned load → no line (above).
- **Session reopened after validation:** the ramp is recomputed from
  `planned()`, which reads history *before* this slot — stable, not affected by
  the sets just logged.
- **Imported or generated program:** generator warm-ups (`src/generator.js`,
  `WARMUPS`) say "deux séries montantes" without percentages; the computed line
  applies the same ladder to them. Legacy programs behave the same.
- **Very light first exercise:** rounding collapses steps; handled by dropping
  duplicates.

## Out of scope / follow-ups

- The bundled `WARM` texts keep their percentages, which now duplicate the
  computed line. Trimming them is a data edit to the program file, worth doing
  only once the line has proved itself in the gym.

## Open questions

None. Settled by Simon on 2026-09-24, as proposed:

1. **Ladder:** 50 / 70 / 85 %, the bundled program's own percentages, not the
   40 / 55 / 70 / 85 % of the issue.
2. **Reps on the line:** yes, × 8 / × 4 / × 2. The bundled "lower" text says
   × 6 on the first step; the line keeps 8 everywhere rather than parsing the
   text — a one-rep difference on a 50 % set, noted rather than special-cased.
