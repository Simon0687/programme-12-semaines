# Decisions - planned() treats a session's heaviest set as its working load (#31)

Source: spec.md
Scope: product / requirement choices only. The implementation round — how the
working load is computed, where the grouping lives, how `why` is assembled — goes
to `decisions.md`, written after `/design-tech 31`.
Status: settled 2026-09-14. Q1 settled after three rounds on Simon's own rule (see
below); Q2 to Q4 accepted as recommended; Q5 withdrawn.

---

## Q1 - What makes a load eligible to be the working load?

**Question.** `planned()` (`src/progression.js:76-78`) takes
`Math.max(...base.sets.map(s => s.w ?? 0))` and judges `allTop` / `lowCount` over
every set of the session. Replacing that with "the working load" needs a rule for
which load qualifies. The issue's first acceptance criterion says the suggestion
must not be "a load at which the top of the range was never reached"; the spec
proposes the weaker "the heaviest load whose own sets sat inside the range". On
`7 @ 100`, `7 @ 105`, `8 @ 90` in a 4–8 range they disagree: the strict reading
elects **90**, the weaker one **105**. Left unanswered, the implementer picks one
and half the acceptance criteria fail either way.

**Option A - Only loads that reached the top of the range**
- What it means: a load qualifies when its sets hit `mx`. Literal reading of the
  issue's criterion.
- Implications: contradicts the engine's existing semantics. The pinned test
  "in range but not maxed: load held" (`test/progression.test.js:108-112`) feeds
  `72,5 × 6/6/6` in a 4–8 range and expects `72,5` held with "charge validée en
  calibration". No set reached 8, so under this rule that session has **no
  eligible load at all** — and it is a uniform session, which spec criterion 3
  requires to behave byte-identically. The rule would also empty the "même
  charge : viser plus de reps" branch (`src/progression.js:95`), which is the
  modal state of the whole program.
- Pros: satisfies the issue's criterion 1 as written.
- Cons: breaks the uniform case, which is not in scope; conflates "the load I am
  working at" with "the load I have validated"; would suggest 90 kg to a lifter
  who just moved 105 for 7.

**Option B - The heaviest load whose own sets sat inside the range**
- What it means: group the session's sets by load; a load qualifies when its own
  sets are within `[mn, mx]`; take the heaviest qualifying one and compute
  `allTop` / `lowCount` over its sets only.
- Implications: `7 @ 100`, `7 @ 105`, `8 @ 90` gives working load 105, sets
  `[7]`, not top, so "charge validée en calibration" and a suggestion of **105** —
  the number the app already prints, now for a reason that holds. `5 @ 110`,
  `5 @ 110`, `3 @ 120` disqualifies 120 (3 < 4), leaving working load 110, sets
  `[5, 5]`, so "même charge : viser plus de reps" at **110**, which is the issue's
  second criterion. A uniform session has exactly one group containing every set,
  so the 32 tests in `test/progression.test.js` pass untouched.
- Pros: fixes both reproductions; preserves every existing branch; the uniform
  case falls out of the rule instead of being special-cased.
- Cons: contradicts the issue's criterion 1 as written, which then has to be
  rewritten on GitHub.

**Recommendation.** **B.** The decisive argument is not about mixed loads at all:
Option A cannot express "in range but not at the top", which is what the engine
says for most sessions of a normal week and what a pinned test already requires.
Fully reversible — it is one predicate over a grouping that has to exist either
way.

**Simon's decision.** 2026-09-14, settled after three rounds. Neither A nor B:
**the upper half of the range.**

> The working load is the **heaviest load carrying at least one set at
> `mn + (mx - mn) / 2` or above**. If no load reaches it, the **lightest load
> attempted**.

`allTop` and `lowCount` are computed over that load's sets only. Two clauses.
The threshold is not rounded — reps are integers, so the 30–45 carry's 37,5
means 38.

**The round that settled it.** The threshold was proposed, then dropped as
over-complex in favour of a bare "at least one set at `mn` or above", then
restored — because a single example killed the simpler rule. On `8 @ 100`,
`4 @ 120` in a 4–8 range, four reps at 120 sit *inside* the range, so the bare
rule elects **120** and prescribes it again. Simon's reading, which is the
product decision: the answer is **102,5** — one increment above 100, the load
that actually reached the top — because "there is no reason, and it is rare in
fact, to go from 100 to 120, and if the user gets motivated the app's role is not
to lead them toward injury risk but to bring them back to the rules". If 120 is
then held for 8 reps next session, the threshold elects it on its own and the
answer is 122,5. Earned, not assumed.

So the threshold is not a refinement of the fix — it *is* the fix. A rule that
only excludes sets below `mn` still ratifies a one-off probe at the bottom of the
contract.

**Why the third tier was dropped.** An intermediate version fell back to "the
heaviest load at `mn` or above" before reaching the lightest attempted. It is
unnecessary: on the issue's own `5 @ 110`, `5 @ 110`, `3 @ 120`, no load reaches
6 and the lightest attempted is already 110 — the intended answer. The two-clause
rule matches every known case (verified against the nine, including the pinned
tests, 2026-09-14), and falling back to the lightest is the conservative choice,
which is the same principle as the threshold itself.

**"At least one set", never "all its sets".** Read as *all*, the pinned test
`72,5 × 3/6/6` (`test/progression.test.js:103-107`) would disqualify 72,5 for its
3-rep set, leaving a uniform session with no working load and breaking spec
criterion 3.

A uniform session has a single group, which both clauses select — the fallback
picking the lightest of one load being that same load. Its behaviour is identical
by construction, not by special case.

---

## Q2 - Does a working load need more than one set?

**Question.** Under Q1-B a ramp (`100 / 102,5 / 105`, all in range) elects 105
with a single set behind it. `allTop` on one set then fires `+5 %` in the
calibration branch (`src/progression.js:87`) or `+incr` in the normal branch
(`src/progression.js:92`). Should a load carry two sets — or a majority of the
session's sets — before the engine is willing to judge it?

**Option A - No minimum: one set is enough**
- What it means: the heaviest qualifying load is the working load whatever its
  set count.
- Implications: none to existing behaviour. `planned()` already judges
  single-set sessions — `history()` (`src/progression.js:46`) keeps any session
  with at least one set carrying reps, and the week-7 test at
  `test/progression.test.js:204-210` judges a two-set session with no
  qualification at all. No new rule enters the engine.
- Pros: the heaviest load that held the range is the best evidence available
  about that load; the verdict is recomputed every week, so a thin reading
  corrects itself at the next session.
- Cons: a single top-of-range set can trigger a load increase.

**Option B - Require at least two sets at the load**
- What it means: a load qualifies only with ≥ 2 sets; a pure ramp falls back to a
  lighter load, or to none.
- Implications: a lifter who ramps is systematically prescribed the *lighter* of
  the loads they touched, and next week's base is again a ramp, so the
  under-prescription compounds. Needs its own fallback when no load carries two
  sets — a second rule to specify and test.
- Pros: no increase is ever decided on one data point.
- Cons: invents a new progression rule under cover of a bug fix, which is exactly
  the silent-change risk `.claude/WORKFLOW.md` names for `progression.js`.

**Recommendation.** **A.** The engine already judges single-set sessions, so a
minimum would be a new requirement smuggled into a PATCH, and it would quietly
hold ramping lifters back. Reversible, but adding the minimum later is a
behaviour change in its own right and deserves its own issue.

**Simon's decision.** 2026-09-14: accepted as recommended.

---

## Q3 - When no load holds the range, what is the reduction computed from?

**Question.** If every set fell below `mn` — `3 @ 120`, `2 @ 130` in a 4–8 range
— no load qualifies under Q1-B. The reduction branches (`src/progression.js:88`
and `:94`) must still fire, but from which reference?

**Option A - The lightest load attempted**
- What it means: `roundTo(120 × 0.95, incr)`, i.e. below the lightest failure.
- Implications: mirrors Q1-B — heaviest *qualifying* load when one exists,
  lightest *attempted* when none does. One extra branch over the same grouping.
- Pros: the next prescription is strictly below a load already proven too heavy.
- Cons: a lifter who opened far too heavy drops in one step from a load they
  never had a chance at.

**Option B - The heaviest load attempted**
- What it means: `roundTo(130 × 0.95, incr)` = 123,5.
- Implications: prescribes 123,5 after 120 produced 3 reps — heavier than a load
  that already failed.
- Pros: keeps the existing `Math.max` expression for this one case.
- Cons: incoherent, and it re-fails next week and reduces again from the new
  maximum, so it only converges after several wasted sessions.

**Recommendation.** **A.** Not a preference: B can prescribe a load heavier than
one that just failed, which is the same class of defect this issue was filed
against. Fully reversible.

**Simon's decision.** 2026-09-14: accepted as recommended.

---

## Q4 - Should `why` name the load it judged?

**Question.** The session card renders `plan.why` after the suggestion
(`src/App.jsx:168-169`). After a session where the lifter touched 120 kg, the
card would read "Prévu : 110 kg — même charge : viser plus de reps" with nothing
saying why 120 was set aside.

**Option A - Name it only when the session was not uniform**
- What it means: "même charge : viser plus de reps (jugé sur 110 kg)" when the
  base session carried more than one load; today's wording, unchanged, otherwise.
- Implications: spec criterion 3 requires a uniform session to render
  byte-identically, and `test/progression.test.js` asserts exact `why` strings
  (`:93`, `:105`, `:111`, `:160`). Only the mixed-load case is new, so no existing
  assertion moves. Always naming it — a third option — is ruled out by that
  criterion, not by taste.
- Pros: the suggestion stays auditable exactly where it would otherwise look
  broken; silent everywhere else.
- Cons: two wordings for one branch.

**Option B - Never name it**
- What it means: `why` keeps today's vocabulary in every case.
- Implications: none to the tests.
- Pros: shortest line on a phone card.
- Cons: the one case where the number is surprising is the one case with no
  explanation — the same failure as the exercise-sheet chart, which was believed
  for a day because nothing on screen contradicted it.

**Recommendation.** **A.** The engine now derives its answer from a *subset* of
the previous session, and a number the user cannot reconstruct from what they see
is what makes an engine untrustworthy. Trivially reversible: it is one string.

**Simon's decision.** 2026-09-14: accepted as recommended.

---

## Q5 - Withdrawn: `lowCount` when nothing held the range

Raised while the tiered rule was on the table, and dropped with it. `lowCount`
is always counted over the working load's own sets — one population, one rule,
no exception.

The consequence is worth writing down so it is not rediscovered as a bug. On
`3 @ 120`, `2 @ 130` in a 4–8 range, the fallback elects 120, whose sets are
`[3]`, so `lowCount` is 1. The normal branch only reduces at `>= 2`
(`src/progression.js:93`), so the answer is "même charge : viser plus de reps" at
120. **That is today's behaviour already** — a uniform session of a single failed
set produces exactly the same verdict — so #31 does not introduce it and does not
owe a fix for it. The calibration branch, which reduces at `>= 1`
(`src/progression.js:88`), is unaffected either way.

If the `>= 2` threshold turns out to be wrong, it is a change to *when* the load
drops, which is #28's subject, not this one.

---

## How to apply

All five questions are settled. The answers fold back into `spec.md`: the
**Open questions** section becomes "None", the working-load rule joins
**User-facing behaviour**, and acceptance criterion 4 is rewritten to match Q5 —
the suggestion is never *heavier* than the lightest load attempted, rather than
a reduction always firing.

The issue's first acceptance criterion has to be rewritten on GitHub too: it
demands a load at which the top of the range was reached, and the settled rule
asks only for a load that held the bottom. It is the one place where the two
disagree in writing.
