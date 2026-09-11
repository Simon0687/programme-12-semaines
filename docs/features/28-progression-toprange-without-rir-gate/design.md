# Design - La progression de charge exige RIR<=1 en plus du haut de fourchette, au lieu de suivre le haut de fourchette seul (#28)

## Summary

Drop the `rirs.every(x => x != null && x <= 1)` clause from the load-increase branch of `planned()` in [src/progression.js:80](../../../src/progression.js#L80), so `allTop` alone decides. The one idea: this is a single boolean condition shrinking from `allTop && rirGate` to `allTop`, with a matching one-line change to the "why" string. Everything else in `planned()` — calibration weeks, the under-range/deload branches, the time/reps branch, the week-7 deload multiplier — is untouched. See [spec.md](spec.md) (resolved, no open questions) and [decisions-spec.md](decisions-spec.md) Q1 (RIR stays logged, becomes purely informative for this branch).

## Files touched

- `src/progression.js` — `planned()`, lines 80-81: the condition and its `why` string.
- `test/progression.test.js` — line 97 test keeps passing as-is; line 252 test ("a blank RIR blocks the +increment branch") is rewritten to assert the opposite; one new test added for "maxed at a high RIR (not <=1)" firing the increase; the file's header comment (lines 8-12) gets a one-line note that the RIR gate pinned by #2 was superseded by #28.
- `src/plan.js` — line 85, the "Règles de progression" paragraph text.
- `docs/generation/moteur-generation-programme.md` — line 264, the engine spec sentence.

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

`rirs` stays declared at line 68 — still read by the calibration branch (line 77, `S1`/`S7`, unchanged by this issue) — so no dead code. `lowCount`, `prev`, the week-7 deload multiplier (line 87) and every other branch are reached exactly as before; only the `allTop` branch's second condition disappears.

`src/plan.js:85` sentence changes from:
> "Quand toutes les séries d'un exercice atteignent le haut de la fourchette à ≤ 1 RIR, la charge monte à la séance suivante..."

to:
> "Quand toutes les séries d'un exercice atteignent le haut de la fourchette, la charge monte à la séance suivante..."

`docs/generation/moteur-generation-programme.md:264` drops the same clause: "Toutes les séries en haut de fourchette à ≤ 1 RIR → `+increment_kg`." becomes "Toutes les séries en haut de fourchette → `+increment_kg`."

## Sequencing

1. `fix(progression): drop the RIR gate on the top-of-range branch (#28)` — `src/progression.js` lines 80-81, plus `test/progression.test.js`: rewrite the line-252 test to assert the increase now fires for `set(75, 8, null)` (rename it, e.g. "a blank RIR no longer blocks the +increment branch: informative only"), add a new case with e.g. `set(2, 15, 4)` mirroring the reported bug (reps above `mx`, RIR 4 → increase fires), and add a one-line note to the file's header comment that the original RIR gate (pinned by #2) is superseded by #28. Safe to merge alone — app behaviour is correct and fully tested at this point, docs just lag by one commit.
2. `docs(plan): drop the RIR clause from the progression rule text (#28)` — `src/plan.js:85` and `docs/generation/moteur-generation-programme.md:264`. No code behaviour change, pure copy fix; independently committable.

## Tests

- Unit, `node --test` (`npm test`): the two edits to `test/progression.test.js` described in step 1 cover the changed branch directly. Existing tests in `describe("progression")` (line 97, RIR 1) and `describe("edge cases")` (lines 271-288, range boundaries) continue to pass unmodified and confirm no regression on the cases that already worked.
- Manual click-through (per CONTRIBUTING §2, `npm run dev`): log a session at the top of an exercise's rep range with a high RIR, reopen the same exercise the following week on the Seance tab, and confirm the "Prévu : X kg — +Y kg : haut de fourchette atteint" line reflects the increase (visual check of [src/App.jsx:130-132](../../../src/App.jsx#L130-L132), and of the auto-fill at line 325-327 if reps are entered with the weight field left blank).

## Risks & tradeoffs

- **PATCH, no storage impact** (per spec's Data & storage impact section) — `rir` stays a logged field with the same shape, it's just no longer read as a gate in this one branch.
- **Alternative rejected**: requiring RIR to be logged (non-null) without the `<= 1` threshold (spec's Option B) — rejected in [decisions-spec.md](decisions-spec.md) Q1 because it reintroduces an interpretation nuance Simon explicitly asked to avoid, for a benefit (nudging RIR logging) nobody asked for.
- **Accepted inconsistency**: the calibration-week branch (S1/S7, line 77) keeps its own RIR condition (`>= 3` for +5%) — a different rule, on purpose, out of scope per spec. Worth knowing this leaves two different RIR philosophies in the same function, but re-litigating the calibration rule is not part of #28.

## Out of scope / follow-ups

- Whether the calibration-week `>= 3 RIR` condition should also be revisited for consistency — not raised by #28, no follow-up filed unless Simon asks (same note as spec.md).

## Open questions

None.
