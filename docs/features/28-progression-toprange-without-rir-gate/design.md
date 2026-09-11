# Design - La progression de charge exige RIR<=1 en plus du haut de fourchette, au lieu de suivre le haut de fourchette seul (#28)

## Summary

Drop the `rirs.every(x => x != null && x <= 1)` / `rirs.every(x => x != null && x >= 3)` RIR clauses from **both** load-increase branches of `planned()` — the regular-week branch ([src/progression.js:80](../../../src/progression.js#L80)) and the calibration-week branch ([src/progression.js:76-79](../../../src/progression.js#L76-L79), S1/S7) — so `allTop` alone decides in each. The one idea: the rule is immutable across the whole function, not just outside calibration; `rirs` becomes dead once both reads are gone and is deleted. Round 1 of this design left calibration out of scope; round 2 (this revision) folds it in after Simon confirmed the rule applies there too and local testing showed 8 reps at 80 kg in week 1 still held at 80 kg into week 2. See [spec.md](spec.md) (resolved, no open questions) and [decisions-spec.md](decisions-spec.md) Q1 (RIR stays logged, becomes purely informative for both branches).

## Files touched

- `src/progression.js` — `planned()`: lines 80-81 (regular-week condition and `why`), lines 76-79 (calibration-week condition and `why`), line 68 (`rirs` local, removed — nothing reads it once both branches drop it).
- `test/progression.test.js` — line 97 test keeps passing as-is; line 252 test ("a blank RIR blocks the +increment branch") is rewritten to assert the opposite; a new test added for "maxed at a high RIR (not <=1)" firing the increase in the regular branch; the calibration `describe` block (lines 74-93) gets its `>= 3 RIR` test title corrected and a new case added for a low-RIR calibration set still firing +5%; the file's header comment (lines 8-12) gets a one-line note that the RIR gates pinned by #2 were superseded by #28.
- `src/plan.js` — line 85 (regular progression paragraph) and line 86 (calibration paragraph).
- `docs/generation/moteur-generation-programme.md` — line 264, the engine spec sentence (untracked file, belongs to another work stream — edited on disk for accuracy but not committed under #28, see Risks & tradeoffs).

No other file reads `planned()`'s `why` field or re-implements this condition ([src/App.jsx:104,132,325](../../../src/App.jsx#L104) only consumes the returned `{ load, text, why }`, it doesn't branch on RIR itself).

## Approach

Before:
```js
} else if (allTop && rirs.every((x) => x != null && x <= 1)) {
    next = load + v.incr; why = `+${fmt(v.incr)} kg : haut de fourchette atteint à ≤ 1 RIR`;
```

After:
```js
} else if (allTop) {
    next = load + v.incr; why = `+${fmt(v.incr)} kg : haut de fourchette atteint`;
```

The calibration branch (lines 76-79) gets the same treatment:
```js
// before
if (allTop && rirs.every((x) => x != null && x >= 3)) { next = roundTo(load * 1.05, v.incr); why = "calibration : +5 %"; }
// after
if (allTop) { next = roundTo(load * 1.05, v.incr); why = "calibration : +5 %"; }
```
Once both branches drop their `rirs.every(...)` read, `const rirs = base.sets.map((s) => s.rir);` (line 68) has no reader left in the function and is deleted. `lowCount`, `prev`, the week-7 deload multiplier (line 87) and every other branch are reached exactly as before; only the two `allTop` branches' second condition disappears.

`src/plan.js:85` sentence changes from:
> "Quand toutes les séries d'un exercice atteignent le haut de la fourchette à ≤ 1 RIR, la charge monte à la séance suivante..."

to:
> "Quand toutes les séries d'un exercice atteignent le haut de la fourchette, la charge monte à la séance suivante..."

`src/plan.js:86` sentence changes from:
> "Calibration (S1 et S7) : toutes les séries au haut de la fourchette avec ≥ 3 RIR → +5 % ; une série sous le bas de la fourchette → −5 %."

to:
> "Calibration (S1 et S7) : toutes les séries au haut de la fourchette → +5 % ; une série sous le bas de la fourchette → −5 %."

`docs/generation/moteur-generation-programme.md:264` drops the same clause: "Toutes les séries en haut de fourchette à ≤ 1 RIR → `+increment_kg`." becomes "Toutes les séries en haut de fourchette → `+increment_kg`."

## Sequencing

1. `fix(progression): drop the RIR gate on the top-of-range branch (#28)` — `src/progression.js` lines 80-81, plus `test/progression.test.js`: rewrite the line-252 test to assert the increase now fires for `set(75, 8, null)` (rename it, e.g. "a blank RIR no longer blocks the +increment branch: informative only"), add a new case with e.g. `set(2, 15, 4)` mirroring the reported bug (reps above `mx`, RIR 4 → increase fires), and add a one-line note to the file's header comment that the original RIR gate (pinned by #2) is superseded by #28. Safe to merge alone — app behaviour is correct and fully tested at this point, docs just lag by one commit. **Done.**
2. `docs(plan): drop the RIR clause from the progression rule text (#28)` — `src/plan.js:85`. No code behaviour change, pure copy fix; independently committable. **Done.**
3. `fix(progression): drop the RIR gate on the calibration branch too (#28)` — `src/progression.js` lines 76-79 (condition + `why`) and line 68 (delete the now-dead `rirs` local); `test/progression.test.js`: fix the line-77 test title (no longer conditional on `>= 3 RIR`), add a case for a calibration set at top-of-range with a low RIR firing +5%; `src/plan.js:86` calibration paragraph. Safe to merge alone once step 1-2 are in — same rule, different branch, no dependency between the two fixes beyond sharing the file.

`docs/generation/moteur-generation-programme.md:264` is edited on disk to stay accurate but is **not** part of any of these commits: the file is untracked, belonging to the separate #25 work stream that hasn't committed it yet — staging it here would bundle unrelated draft content into a #28 commit.

## Tests

- Unit, `node --test` (`npm test`): the edits to `test/progression.test.js` in steps 1 and 3 cover both changed branches directly. Existing tests in `describe("progression")` (line 97, RIR 1), `describe("calibration")` (RIR 3, RIR 2 below-range case) and `describe("edge cases")` (range boundaries) continue to pass unmodified and confirm no regression on the cases that already worked.
- Manual click-through (per CONTRIBUTING §2, `npm run dev`): log a session at the top of an exercise's rep range with a high RIR, reopen the same exercise the following week on the Seance tab, and confirm the "Prévu : X kg — +Y kg : haut de fourchette atteint" line reflects the increase — once for a regular week, once for week 1→2 (calibration) (visual check of [src/App.jsx:130-132](../../../src/App.jsx#L130-L132), and of the auto-fill at line 325-327 if reps are entered with the weight field left blank).

## Risks & tradeoffs

- **PATCH, no storage impact** (per spec's Data & storage impact section) — `rir` stays a logged field with the same shape, it's just no longer read as a gate in either branch.
- **Alternative rejected**: requiring RIR to be logged (non-null) without the threshold (spec's Option B) — rejected in [decisions-spec.md](decisions-spec.md) Q1 because it reintroduces an interpretation nuance Simon explicitly asked to avoid, for a benefit (nudging RIR logging) nobody asked for.
- **`docs/generation/moteur-generation-programme.md` stays uncommitted here**: it's edited for accuracy but left untracked, since it belongs to #25's not-yet-committed work. Whoever commits that work stream should carry this one-line change forward; if it lands first and reverts the wording, it'll just be stale until #25 catches up — low stakes, it's a planning doc, not shipped copy.

## Out of scope / follow-ups

None new. The `unit === "time" || unit === "reps"` branch is still out of scope (see spec.md).

## Open questions

None.
