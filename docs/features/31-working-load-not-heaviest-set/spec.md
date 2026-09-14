# Spec - planned() treats a session's heaviest set as its working load (#31)

## Context

`planned()` (`src/progression.js:56-98`) collapses a session to one number —
`Math.max(...base.sets.map(s => s.w ?? 0))` — then judges the rep range over
*every* set of that session, whatever load each was performed at. When the sets
carry different loads, the load and the verdict describe different things: the
app can credit a top-of-range set performed at 90 kg to a 105 kg set, or
prescribe a load that produced 3 reps in a 4–8 range and ask for *more reps* at
it. Found on Simon's real journal, 2026-09-12
([#31](https://github.com/Simon0687/programme-12-semaines/issues/31)).

This matters now because the failure concentrates in weeks 1 and 7 — the
calibration weeks, when a lifter probes several loads on one exercise — and
those are precisely the weeks that set the load for the six that follow.

## Scope

- **In:** identifying a session's **working load** when its sets carry different
  loads, and computing `allTop` / `lowCount` only over the sets performed at that
  load. Both the calibration/deload branch and the normal branch. The `why` text
  must stay truthful about which load was judged.
- **Out:** *when* the load goes up (settled by #28, shipped). The `time` / `reps`
  units, which return before any load is read. Rewriting the progression model.
  Any change to how sets are entered or stored.

## The rule

Settled 2026-09-14, `decisions-spec.md` Q1. Group the previous session's sets by
load, then:

> The **working load** is the **heaviest load carrying at least one set at
> `mn + (mx - mn) / 2` or above** — the upper half of the rep range. If no load
> reaches it, the **lightest load attempted**.

`allTop` and `lowCount` are then computed over that load's sets only. Two
clauses, no set-count minimum, no third tier. The threshold is not rounded; reps
are integers, so the 30–45 carry's 37,5 means 38.

**Why a threshold and not simply "in the range".** The app's job is not to follow
a lifter who got motivated and jumped. On `8 @ 100`, `4 @ 120` in a 4–8 range,
four reps at 120 is technically inside the range, so a bare "in range" rule would
adopt **120** as the new working load and chase a weight the lifter reached once,
at the very bottom of the contract. The upper-half threshold ignores that probe,
keeps 100 — where the top of the range *was* reached — and returns **102,5**:
one increment, by the rules. If the lifter comes back next week and puts 8 reps on
120, the threshold elects 120 on its own and the app answers 122,5. Earned, not
assumed.

That principle is the point of the rule, and the reason it is worth one
threshold: a jump from 100 to 120 is rare in practice and carries injury risk, so
the engine brings the lifter back to incremental progression instead of
ratifying the jump.

Meant to be revised with use — the current journal holds deliberate test data,
so the rule is not tuned against it.

## User-facing behaviour

**Séance.** The only visible surface. The card's "Prévu" line
(`src/App.jsx:168-169`) renders `plan.text` — the suggested load — followed by
`plan.why`. Both can change for a session whose previous entry carried mixed
loads:

- The suggested load becomes the one actually worked at, not the heaviest
  touched.
- `why` must name what it judged when the session was not uniform, so the line
  is auditable rather than merely different. A session performed at a single
  load must render **exactly as it does today**, wording included.

**Semaine, Bilan, Plan.** Unchanged. No new control, no new screen, no new
state.

Note a second, quieter surface: on validation, `App.jsx:438` fills any set whose
weight was left blank with `p.load`. A wrong suggestion is therefore not only
displayed, it is written into the journal.

## Acceptance criteria

- [ ] Given a previous session of `8 @ 100`, `4 @ 120` in a 4–8 range, when the
      next is planned, then the suggestion is **102,5** — one increment above 100,
      the load that reached the top — and never 120.
- [ ] Given a following session of `8 @ 120` at that load, when the next is
      planned, then the suggestion is **122,5**: a jump is adopted once it has
      been held at the top of the range, not before.
- [ ] Given a previous session of `5 @ 110`, `5 @ 110`, `3 @ 120` in a 4–8
      range, when the next session is planned, then the suggestion is not 120 kg
      and the wording does not ask for more reps at a load that failed the range.
- [ ] Given a previous session of `7 @ 100`, `7 @ 105`, `8 @ 90` in a 4–8 range
      in week 1, when week 2 is planned, then the suggestion is **105** — the
      heaviest load reaching the upper half — and `why` says it judged 105. The
      issue's own first criterion asks for a load that reached the *top* of the
      range, which would elect 90; it is superseded and must be rewritten on
      GitHub.
- [ ] Given a previous session whose sets all carry the same load, when the next
      is planned, then `load`, `text` and `why` are byte-identical to today. The
      32 tests in `test/progression.test.js` must pass unmodified.
- [ ] Given a previous session where every set fell below the bottom of the
      range, when the next is planned, then the suggestion is never **heavier**
      than the lightest load attempted. Whether a reduction actually fires still
      depends on the existing `lowCount >= 2` threshold in the normal branch
      (`src/progression.js:93`), which this issue leaves untouched — see
      `decisions-spec.md` Q5.
- [ ] Given a `bw` exercise performed at bodyweight (`w` absent or 0), when the
      next is planned, then 0 is treated as a real load and not as "no load".
- [ ] Given a deload session used as the base, when the next is planned, then the
      working-load rule applies to it exactly as to a normal session.

## Data & storage impact

**None to the shape.** No field added, renamed or removed; `SCHEMA_VERSION`
untouched; `prog12_simon_v1` loads and saves exactly as before.

**Level: PATCH.** CONTRIBUTING.md names this case directly — "Fix with no change
to intended behaviour | *wrong progression formula*". A journal saved by the
previous version loads without loss.

**Workflow level: A**, which is the stricter axis and the one that governs the
process. `.claude/WORKFLOW.md` Q1 answers YES — *an already-stored journal will
be read differently*: the same past sessions will yield different prescriptions
without a byte changing. The sensitive-module override applies independently,
`progression.js` being on its list. So: spec → `decisions.md` → `design.md` →
code on a branch from `dev`, regression tests included.

## Edge cases

- **Every load appears once** (a pure ramp: 100 / 102,5 / 105). The heaviest that
  held `mn` wins, on a single set; there is no set-count minimum, by decision.
- **No load holds the range** — every set below `mn`. The fallback elects the
  lightest load attempted, so the suggestion is never heavier than a load that
  already failed.
- **A single set in the session.** Trivially uniform; must behave as today.
- **`w` absent on some sets but not others.** Today `null` becomes 0, which is
  indistinguishable from a real 0 on a `bw` exercise.
- **Deload as base.** `planned()` already skips a deload base when a non-deload
  one exists (`src/progression.js:64-67`); whatever is finally chosen as base
  must go through the same working-load rule.
- **Calibration week.** The branch whose whole purpose is to probe several loads,
  so it is where mixed loads are the norm rather than the exception.

## Out of scope / follow-ups

- **`planned()` writes into the journal.** `App.jsx:438` fills a blank weight
  with the suggested load at validation time, so an engine mistake becomes stored
  data rather than a displayed opinion. Whether the app should ever write a
  *suggestion* into a log is a separate question, and worth its own issue.
- **#28 is closed and shipped**; the issue's note asked whether the two should be
  handled together. They should not — #28 changed *when* the load rises, this
  changes *which load* the verdict is computed against. They are independent and
  #28 needs no revisiting.
- **The registry's `plank_weighted` carries `unit: "bw"`** while its `r` is a
  hold in seconds. Unrelated to this issue, but it means any per-unit reasoning
  about "reps" is wrong for that one entry.

## Open questions

None. The four opened here were settled 2026-09-14 in `decisions-spec.md`: the
upper-half threshold as the working-load rule (Q1, settled after three rounds),
no set-count minimum (Q2), the lightest load attempted as the fallback
reference (Q3), and `why` naming the load it judged only when the session was not
uniform (Q4).
