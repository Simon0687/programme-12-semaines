# Spec - Exercise sheet: the chart shows order, not magnitude, and the estimate reads as a label (#49)

## Context

`chartGeometry` scales the value axis from the data alone — `niceScale(Math.min(...vals),
Math.max(...vals))` (`src/display.js:236`) — so the points always fill the frame and
2,3 kg of progress draws the same climb as 20 kg would. The failure that matters is not
the one observed but the plateau: six months at 70 kg with ±1 kg of noise re-frames onto
69-71 and draws a rise over standing still. On the same screen, the one number worth
reading — `10RM estimé` — is a 14 px section title like the four others
(`src/ExerciseSheet.jsx:36`), so the question the sheet exists to answer has no visual
answer, and `Détails` spends amber (the alert colour, `role="alert"` on three load errors)
to mean "primary muscle".
([#49](https://github.com/Simon0687/programme-12-semaines/issues/49), from
[docs/reviews/2026-09-14-design-review-triage.md](../../reviews/2026-09-14-design-review-triage.md)
findings C3, C2 and 1c.4.)

## Scope

- **In:** a minimum span on the chart's value axis; the estimate promoted to a headline
  value with its variation and a named baseline; a faint gradient under the curve; the
  three muscle bars merged into one stacked bar in a single hue.
- **Out:** any journal read or write, any engine change — `chartGeometry` and
  `ExerciseSheet` are pure consumers. `setSummary`'s compact form, the records table as
  cards, collapsing Technique and Détails, and the "anchor of both blocks" labels (see
  Out of scope / follow-ups).

## User-facing behaviour

**Fiche exercice.** The only screen that changes. Séance, Semaine, Bilan and Plan are
untouched.

*The headline.* Above the chart, the latest session's value renders large: the 10RM
estimate for `kg`, the held time for `time`, the repetitions for `reps`. In `dual` mode
(`bw`, `carry`) **both** quantities are shown — the curve's value large, the load beside it
(`8 reps · +20 kg`) — because `8 reps` at bodyweight and `8 reps` at +20 kg would otherwise
print identically.

Beside it, the variation **since the very first session, all cycles combined**, sign always
shown: `+7,5 kg depuis la première séance`. The baseline is named in the text, never left to
be inferred — that number and "since the start of this cycle" are different, and the reader
cannot guess which one is on screen. In `dual` mode the variation is computed on the curve's
value, which is what the chart traces.

The 14 px `10RM estimé` title above the chart disappears: the headline names the value, and
the `<svg>` keeps its current accessible name so nothing is lost for a screen reader. The
explanatory note under the chart (`COPY[unit].note`) stays where it is.

- **With a single validated session in the whole history**, the headline renders and the
  variation is **absent** — not `+0`: that session *is* the baseline. There is still no
  chart (`n > 1` gate, unchanged). From the second session on the variation always has a
  value, including in a cycle opened yesterday.
- **With the latest best set outside `ESTIMATE_REPS`** (3-12 reps), the large number is
  dimmed to the same slate as the chart's unreliable points (`src/exercise-history.js:161`).
  A figure computed on a 3-rep set must not be the most confident thing on the screen.
- **A variation of exactly zero renders**, as `0 kg` / `0 reps`: hiding it would read as
  missing data, which is the opposite of what a plateau means.

*The chart.* The value axis carries a minimum span. The curve of a small progression
flattens — that is the point; the precision has moved to the headline. A history already
spanning more than the floor draws exactly as it does today. The area under the curve
carries a faint gradient from the polyline's amber to transparent; in `dual` mode
(`bw`, `carry`) the load bars stay readable through it.

*Détails.* The three muscle bars become **one** stacked bar, one hue in three values,
sharing a single 100 % axis instead of repeating it three times. Each segment is named
with its percentage beside or below the bar. The dominant muscle is obvious because it is
the widest segment, so **no amber appears in Détails** — the accent goes back to meaning
"alert" and "the planned load" everywhere else.

## Acceptance criteria

- [ ] Given two sessions 2,3 kg apart, when the chart renders, then the value axis spans at
      least the floor and both points sit near the middle of the frame, not at its edges.
- [ ] Given a span already wider than the floor, when the chart renders, then the axis is
      identical to today's (existing `chartGeometry` tests pass unchanged).
- [ ] Given a plateau at 70 kg with ±1 kg of noise, when the chart renders, then the curve
      reads as flat.
- [ ] Given an exercise whose `incr` is 2, when the floor applies, then the resulting span
      is not finer than a few of that exercise's own increments.
- [ ] Given a `dual` exercise, when the chart renders, then the load bars keep their
      zero-anchored right-hand scale: the floor applies to the value axis only.
- [ ] The headline renders the latest value and its variation since the first session ever,
      with that baseline named on screen; with a single session in the whole history the
      variation is absent, not zero.
- [ ] Given a `bw` or `carry` exercise, when the sheet renders, then the headline shows both
      the curve's value and the load, and the variation is computed on the curve's value.
- [ ] Given a latest best set outside `ESTIMATE_REPS`, when the sheet renders, then the
      large value is dimmed.
- [ ] The area under the curve carries a faint gradient, and the fill does not obscure the
      bars in `dual` mode.
- [ ] The muscles render as a single stacked bar in one hue, the segments summing to the
      full width, and no amber appears in `Détails`.
- [ ] `chartGeometry`'s new behaviour is covered under `node --test`, without DOM.

## Data & storage impact

**None.** The localStorage journal (`prog12_simon_v1`) does not change shape: no field
added, renamed or removed, and nothing new is written. `chartGeometry`, `muscleRows` and
`ExerciseSheet` only read what `exerciseHistory` already extracts, and `chartGeometry` is
consumed by exactly one screen (`src/App.jsx:849`).

**Level: MINOR.** CONTRIBUTING.md — "compatible addition, existing journal intact". A
journal saved by the previous version loads without loss and draws the same data in a
different frame. The axis floor on its own would be a `fix` (PATCH); the headline value is
an addition, and the larger level wins.

**Workflow level: B** (`.claude/WORKFLOW.md`). Q1 NO — no stored journal is *read*
differently; the same values are drawn in a truer frame. Q2 NO, Q3 NO. Q4 YES: two modules
(`display.js`, `ExerciseSheet.jsx`) and the existing `chartGeometry` tests. No sensitive
module is touched. So: this brief spec → code → tests, no `design.md`.

## Edge cases

- **`chartGeometry` does not know the exercise.** Its signature is `(series, box)` and
  `incr` lives in the registry, reachable from `ExerciseSheet` via `v.incr`. The increment
  floor therefore requires the caller to pass it — a signature or `box` change, with the
  existing no-argument behaviour preserved when it is absent.
- **`incr` is absent** on `sideplank` (`time`) and `abwheel` (`reps`) — "pas de charge
  suivie" (`src/registry.js:29`). The percentage floor is unit-agnostic and still applies;
  only the increment floor-under-the-floor drops out.
- **`dual` mode's value axis is not in kilos.** The curve plots reps (`bw`) or seconds
  (`carry`) while `incr` is a kilo step, so the increment floor is meaningless there and
  must not be applied to the line axis. The bar axis keeps `niceScale(0, max)`, anchored at
  zero, untouched.
- **A true plateau, every value identical.** `niceScale` already widens `hi === lo` by ±1
  (`src/display.js:201`); the floor then widens it properly, which is the strongest form of
  the case the issue describes.
- **A median of zero or a single point.** The percentage floor degenerates to zero and the
  behaviour falls back to today's, without dividing by anything.
- **Week 7 deload and calibration sessions** legitimately dip. They stay hollow points; the
  floor only makes the dip proportionate.
- **The first session ever is usually a calibration week**, and on `kg` its estimate can sit
  outside `ESTIMATE_REPS`. It is the baseline anyway (Decision 1): it is what was actually
  lifted then, and it is the point the chart's leftmost dot already shows, so the headline
  and the curve tell the same story. The dim rule applies to the headline value, never to
  the baseline behind it — a dimmed baseline would say the *current* estimate is unreliable,
  which is a different claim.
- **Rounded muscle percentages.** `muscleRows` rounds to whole percents
  (`src/display.js:161`), and `test/display.test.js:84` already asserts the rounded values
  sum to 100 on every registry entry. The stacked bar can use `pct` directly and stay
  exact; that test is the guarantee, and it should be cited where the widths are computed.
- **Two to four segments.** Registry entries carry between one muscle (`lat_db`, 1.0) and
  three; a single-muscle exercise draws one full-width segment, which must not read as an
  error.

## Out of scope / follow-ups

- **`setSummary`'s bounded compact form** (`70 → 72,5  8/8/8`) — it also serves the Semaine
  screen and has its own tests. Separate issue, per #49.
- **Records as cards, Technique and Détails collapsed** (review 1c.2, second half of 1c.4).
  The hierarchy work here stops at the headline.
- **The "anchor of both blocks" labels** (review 1c.5) — needs programme context the sheet
  deliberately does not receive (`src/ExerciseSheet.jsx:1-20`).
- **Amber's other incompatible meanings** (finding C2 outside this screen: `role="alert"`
  load errors, the storage warning, the active tab, the volume table). This issue removes
  the sheet's occurrence only; the rest is candidate B1 in the triage table and still
  unfiled.

## Decisions

Settled by Simon, 2026-09-15. Point 1 went through a second round — see
[decisions-spec.md](decisions-spec.md) for the options weighed and why the probe objection
was set aside.

1. **The variation is measured since the very first session**, all cycles combined — not
   since the start of the current cycle, and not since the first non-calibration session.
   The sheet is the cross-cycle screen (#17) and the question it exists to answer is "have I
   progressed since I started", which a cycle boundary would reset to zero every twelve
   weeks. The baseline being a calibration week costs little: an advanced user declares
   `definition.startingLoads` so week 1 starts from a known load, and on the neutral default
   (#26) the 50 → 75 → 100 % ladder converges inside the session — the set recorded is the
   one that landed in the rep range at the right RIR. The cost accepted: the engine corrects
   the next prescription, never the baseline, so a first session that did land low keeps its
   offset in the lifetime number for good.
2. **In `dual` mode the headline shows both quantities**, the curve's value and the load.
   The variation is computed on the curve's value.

## Open questions

None.
