# Decisions - Support programs with a different session count, or without cardio/mobility (#13)

Source: spec.md
Scope: product / requirement choices only — no design exists yet for #13; implementation choices (how the JSX branches, where the guard lives inside the render tree) are for `/design-tech 13` once these are settled.
Status: resolved — both A

## Q1 - Is #22 actually done, given it's still open on GitHub?

**Question.** `spec.md`'s Context flags a "dependency check": #22 blocks #13 by design ("should land first, so #13's diff contains only the new conditional rendering"), but the GitHub issue is still open. Does #13 wait on anything, or can it start now on top of `dev`?

I checked `git log --all --oneline | grep "(#22)"`: four commits, all reachable from `dev` (`git branch --contains` confirms), each tagged `(#22)`:
- `9b61855` — add `getKeySlots` and `getCardioDayNotes` helpers
- `1ed100d` — add `after` hint field to `SESSIONS`, refresh header
- `e984bbf` — remove hardcoded program literals, read from `prog`/`definition`
- `fc587d0` — wrap `state` in `useMemo` to unblock memoization

That covers every row of F3's literal table in `docs/reviews/2026-09-09-code-review.md` (session count, key slots, `MOB_DAYS.length`, cardio-only weekdays) plus the F6 memoisation fix from the same review. Nothing from #22's issue body is missing. Per `CONTRIBUTING.md` §6, an issue auto-closes on a `closes #N` commit merged to **`main`**, not `dev` — and #22's commits haven't gone through a `main` release yet, matching the pattern already noted for #6/#7/#8/#10 (memory: everything sits in `dev` awaiting a release). So the open state is the normal workflow, not a sign of unfinished work.

**Option A - Treat #22 as satisfied, start #13 now on `dev`**
- What it means: no waiting, no manual GitHub action; #13 branches off current `dev`.
- Implications: none on code — the four commits are already there. If a future audit ever needs "is #22 done", `git log` answers it, not the issue's open/closed state.
- Pros: no delay; matches how the last batch (#6/#7/#8/#10) was already handled.
- Cons: the GitHub Project board will show #22 as open/in-progress while #13 (which depends on it) is worked — mildly confusing to a reader who only looks at issue state, not `git log`.

**Option B - Manually close #22 now, out of the normal merge-to-main flow**
- What it means: close the issue by hand before starting #13, to make the board match reality.
- Implications: breaks the project's own convention that closing happens via `closes #N` on the `main` merge (per `CONTRIBUTING.md` and the "Statut GitHub Project" memory note about updating status at each merge). Would need a manual re-open if a release-time audit expects it to close itself.
- Pros: board accurately reflects "code done".
- Cons: extra manual step, inconsistent with every other issue in this batch (#6/#7/#8/#10 are also open in `dev`, unclosed).

**Recommendation.** Option A. The verification is already done (four commits, all on `dev`, covering every item in #22's body); waiting on a GitHub label would just be busywork out of step with how the rest of this batch is being tracked. Fully reversible — nothing here is a code decision, just when #13 branches.

**Simon's decision.** A — proceed on `dev` now.

## Q2 - Where does the `getCardioDayNotes` null-guard belong?

**Question.** `spec.md`'s Edge cases requires `getCardioDayNotes(prog)` (`src/program.js:78-83`) to not throw when the bundle has no cardio data — today it does `Object.keys(prog.CARDIO_DAY_NOTES)` unguarded. This helper is #22's own deliverable (commit `9b61855`), created before `cardio: null` existed (`cardio: null` only became possible via #25, which landed after #22). Does this one-line guard ship inside #13's commit, or does it belong back in a reopened #22?

**Option A - Land the guard inside #13's commit**
- What it means: `getCardioDayNotes` (or its caller at `App.jsx:292`) gets defensive to an absent `CARDIO_DAY_NOTES`, committed together with the rest of #13's conditional-rendering work.
- Implications: touches `src/program.js`, a file #22 "owns" by the review's own framing (F3); `CONTRIBUTING.md`'s "no refactoring and feature work in the same commit" rule is about not mixing *unrelated* cleanup with a feature, and this is a one-line null-safety fix required *for* #13's feature to work at all — not an unrelated refactor.
- Pros: keeps #13 self-contained and shippable without touching a second issue; avoids reopening a batch-reviewed, effectively-finished issue for a single guard clause.
- Cons: slightly blurs #22's "done" boundary — a future reader of #22's commits won't see this guard there.

**Option B - Reopen #22, land the guard there, #13 depends on it landing first**
- What it means: file the guard as a small addendum to #22, merge it, then branch #13.
- Implications: reopens an issue already treated as complete in Q1; adds a sequencing step (#13 now waits on a fresh #22 commit) for a one-line change.
- Pros: keeps every commit touching `getCardioDayNotes` under the issue that created it.
- Cons: process overhead disproportionate to the size of the fix; contradicts the Q1 recommendation to treat #22 as closed-in-substance.

**Recommendation.** Option A. The guard exists only because #13's own acceptance criteria require it (a bundle `getCardioDayNotes` was never asked to handle when it was written); shipping it with #13, with a one-line comment noting why, is proportionate. Cheap to reverse later if Simon prefers strict issue ownership — it's a two-line diff either way.

**Simon's decision.** A — guard ships inside #13's commit.

## How to apply

Once Simon fills in each "Simon's decision", the answers fold back into `spec.md`: the two numbered items under **## Open questions** are replaced with "None", and Q1's outcome (branch now vs. wait) plus Q2's outcome (guard lives in #13 vs. #22) are reflected in `spec.md`'s Context/Scope sections accordingly.
