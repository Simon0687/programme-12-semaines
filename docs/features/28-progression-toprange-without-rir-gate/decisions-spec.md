# Decisions - La progression de charge exige RIR<=1 en plus du haut de fourchette, au lieu de suivre le haut de fourchette seul (#28)

Source: spec.md
Scope: product / requirement choices only. No implementation choices here — those belong in `design.md` / a future `decisions.md`.
Status: awaiting Simon's answers

## Q1 - Does a blank/unlogged RIR still block the load increase?

**Question.** `planned()` ([src/progression.js:80-81](../../../src/progression.js#L80-L81)) currently requires `rirs.every(x => x != null && x <= 1)`. The spec drops the `<= 1` part, but `x != null` was also part of that same condition — so simply deleting the RIR check also removes the "RIR must be logged at all" requirement. A pinned test (`test/progression.test.js:252`, "a blank RIR blocks the +increment branch") currently asserts that a set logged as `set(75, 8, null)` — 8 reps (= `mx` for that slot) with no RIR typed in — holds the load. Under the new top-of-range rule, should a set that hit `mx` reps but has **no RIR value at all** still count toward the increase, or should it keep blocking it?

**Option A - RIR is fully ignored, present or not**
- What it means: the branch becomes `else if (allTop) { next = load + v.incr; ... }` — no read of `rirs` at all in this branch.
- Implications: `test/progression.test.js:252` is rewritten to assert the increase now fires for that exact input (blank RIR, all sets at `mx`). `rirs`/`lowCount` computation for *this* branch becomes dead — `rirs` stays used by the calibration branch (line 77) and can stay as is. No new UI text needed; the RIR field's role for a top-of-range set becomes purely informational (still logged, still shown in history, just not read here).
- Pros: matches exactly what was asked — one rule, one condition (`allTop`), nothing left to interpret. Simplest to implement and to explain on the Plan tab.
- Cons: a set where the athlete simply forgot to fill in RIR is treated the same as one where they consciously logged a high RIR — the app can no longer distinguish "didn't push" from "didn't log."

**Option B - Require RIR to be logged (any value), just not `<= 1`**
- What it means: `else if (allTop && rirs.every(x => x != null)) { ... }` — a blank RIR still blocks the increase, only the `<= 1` threshold is dropped.
- Implications: `test/progression.test.js:252` keeps passing unchanged (blank RIR still holds the load), but its assertion text/comment needs updating since the *reason* changes from "RIR too high" framing to "RIR not logged." The Plan tab text and this issue's stated rule ("si tu es >= fourchette haute sur toutes les séries, tu montes") would need a caveat about RIR still needing to be filled in, reintroducing exactly the interpretation nuance Simon asked to avoid.
- Pros: keeps a light incentive to log RIR every set.
- Cons: contradicts the simplification Simon asked for in this issue ("on fait simple... comme ça on évite les soucis d'interprétation"); adds a rule nobody asked for and that isn't in the spec's proposal.

**Recommendation.** Option A. It is what was actually asked for, it is the simpler diff, and it removes rather than adds an edge case to explain to users. Fully reversible later if incomplete-RIR logging turns out to be a real problem in practice — Option B's condition can be added back as a one-line change with its own issue if the data shows it's needed.

**Simon's decision.** Option A — RIR is ignored for this branch, it's informative only.

## How to apply

Once Simon fills in "Simon's decision", fold the answer back into `spec.md`: move this point out of "Open questions" (which becomes "None") and add a short note under "Edge cases" stating the final rule for a blank RIR at top-of-range.
