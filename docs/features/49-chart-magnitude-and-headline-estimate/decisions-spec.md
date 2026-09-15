# Decisions - Exercise sheet: the chart shows order, not magnitude, and the estimate reads as a label (#49)

Source: spec.md
Scope: product / requirement choices only. #49 is a level-B issue, so there is no
`design.md` and no sibling `decisions.md`: the implementation choices it would have held
(the floor constants, how `chartGeometry` receives `incr`, the draw order of the gradient,
the stacked bar's hue) are made in code and explained there.
Status: settled 2026-09-15 — Q1 answered A, folded back into `spec.md`

This is a **second round on Q1 only**, opened at Simon's request on 2026-09-15 after the
first answer ("depuis le début") surfaced a point the spec had not stated plainly.

## Q1 - Which session is "the start"?

**Question.** The headline shows the latest value and its variation since a baseline the
text names. "Since the very first session" is the intent, and it is the right one for a
screen built to read across cycles (#17). But the first session on an exercise is, by the
engine's own rules, a **probe rather than a performance**: week 1 is `calibration`, and
`phaseOf` prescribes RIR 2–3 there against RIR 1 in the blocks (`src/progression.js:144`).
With no starting load known, that session is a 50 → 75 → 100 % ladder to find the load at
all (`planned()`, the `v.start == null` branch). `planned()` never treats it as a
reference either: from a calibration base it moves ±5 %, not ±`incr`
(`src/progression.js:210-213`). A variation anchored there therefore counts "I found my
real load" as strength gained — a one-time offset of a few percent that never washes out.
Left unanswered, the headline ships with the flattering baseline and the number is wrong
from the first day, in the only direction nobody questions.

**Option A - The first session ever, whatever it was** *(the current answer)*
- What it means: baseline = `entries[0]`, the first point `exerciseHistory` returns, cycle
  1 week 1 included. Label: `depuis la première séance`.
- Implications: no selection rule to write — `entries[0]` is already in hand in
  `ExerciseSheet`. The number agrees exactly with the chart's leftmost point, which is what
  the eye will check it against.
- Pros: literally true to its own label. Simplest thing that can work. Nothing to explain.
- Cons: the baseline is the least reliable point in the whole history — the chart draws it
  hollow (`kind === "calibration"`) precisely because it is not a normal session. The
  variation is permanently inflated by however far the first guess was off, and on `kg` the
  baseline estimate can itself be one the app greys out as not credible.

**Option B - The start of the current cycle**
- What it means: baseline = the first point of the last group in `seriesByCycle`. Label:
  `depuis le début du cycle`.
- Implications: reads the same data, one group later. The variation resets every twelve
  weeks and is absent in a cycle opened yesterday, so the headline's shape changes with the
  calendar.
- Pros: answers "is this block working", the number that actually moves; its baseline is a
  recent, comparable session.
- Cons: it resets exactly what you asked to see. And it duplicates the chart: one polyline
  per cycle already draws the current cycle's trajectory (`seriesByCycle`), so the headline
  would restate in a number what the curve beside it shows in a shape.

**Option C - The first session that was not a calibration or a deload**
- What it means: baseline = the first entry whose `kind` is neither `calibration` nor
  `deload` — the first point the chart draws **solid**. Falls back to "no variation" when
  there is none, the same rule as a single-session history. Label: `depuis la première
  séance de travail`.
- Implications: one filter on `entries`, no stored data, no engine change. It mirrors a rule
  the engine already applies for the same reason (`SKIPPED_AS_BASE`, `src/progression.js:91`
  — a session that was deliberately easy is not a reference), and the rule is *visible*: the
  hollow dot and the legend "calibration ou décharge" already say that point is not a normal
  session.
- Pros: keeps your intent — still "depuis le début", never resets — while removing the
  probe from the measurement. The baseline is a session performed at the same intent as
  today's.
- Cons: the number no longer matches the chart's leftmost point, so on an exercise started
  in week 1 the curve visibly rises more than the headline claims. One extra word in the
  label to explain why.

**Recommendation.** **C.** It preserves the answer you gave — the variation is measured from
the beginning, across cycles, and never resets — and only moves the anchor off the one
session the app itself marks as unreliable everywhere else. The staleness you were warned
about is not an argument for B: the chart already carries the recent trend, one polyline per
cycle, so the headline's job is precisely the total the curve cannot show. Showing both
numbers was considered and rejected — #49 exists to give the screen one focal point, and two
variations beside a big number start rebuilding the row of equal-weight figures it is
removing. Fully reversible: a display-only selector, no stored field, no fixture change.

**Simon's decision.** **A**, 2026-09-15. Two cases, and the probe gap is small in both. An
advanced user declares their loads — `definition.startingLoads`, validated at
`src/journal-shape.js:327` — so week 1 starts from the load they already know and the gap
narrows to RIR 2–3 against RIR 1. A beginner on the neutral default (#26) has no
`startingLoads`, so the ladder fires; but it converges *inside the session*, and the set
recorded is the one that landed in the rep range at the right RIR, not the opening guess.
Either way the following week's prescription is computed from that session, so the engine
closes whatever gap is left within a few sessions.

**What the answer accepts.** The engine corrects the *prescription*; it never corrects the
*baseline*. If the first working set does land low, the lifetime variation keeps that offset
for good. Judged not worth a selection rule: the offset is a few percent, and the option that
removed it cost a number that disagrees with the chart's leftmost point.

## Q2 - What the headline shows in `dual` mode

Settled 2026-09-15 and not reopened here: **both quantities**, the curve's value large and
the load beside it (`8 reps · +20 kg`), the variation computed on the curve's value. Recorded
in `spec.md` under "## Decisions".

## How to apply

Once Simon fills in "Simon's decision" for Q1, the answer folds back into `spec.md`: point 1
of its "## Decisions" list is rewritten to match, the headline paragraph under "User-facing
behaviour" takes the chosen label, and the acceptance criterion on the variation names the
chosen baseline. The edge case "The first session ever is usually a calibration week" is
rewritten or removed depending on the answer. "## Open questions" ends as "None".
