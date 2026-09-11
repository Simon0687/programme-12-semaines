# Spec - La progression de charge exige RIR<=1 en plus du haut de fourchette, au lieu de suivre le haut de fourchette seul (#28)

## Context

`planned()` in [src/progression.js:80-81](../../../src/progression.js#L80-L81) only raises the working load when *every* logged set hits the top of the rep range (`mx`) **and** every logged RIR is `<= 1`. A user who respects the prescribed rep range and stops right at the top (e.g. contract 8-12, stops at 12) never triggers the increase if they logged a higher RIR, even though hitting or exceeding `mx` at all is already the signal a double-progression scheme uses. Real case: 15 reps at 2 kg, RIR 4, on an 8-12 rep-range exercise — the app still returns "même charge : viser plus de reps" the following week, with nowhere higher to aim inside the displayed range. See #28.

Widened after testing the first pass locally: the calibration-weeks branch (S1/S7, [src/progression.js:76-79](../../../src/progression.js#L76-L79)) has its own top-of-range condition (`>= 3 RIR` for +5%) that the original spec left out of scope. Simon confirmed the same rule is meant to be immutable everywhere: 8 reps at 80 kg in week 1 (top of an 4-8 range) still held at 80 kg into week 2, because the RIR logged wasn't `>= 3`. Same root cause, same fix, so it's folded into #28 rather than a separate issue — the branch hadn't been pushed yet.

## Scope

- **In:** Change the load-increase condition in `planned()` to fire whenever all logged sets are `>= mx`, in **both** the regular-week branch and the calibration-week branch (S1/S7), dropping the RIR requirement in each. Update the "why" text shown on the Seance tab accordingly. Update the product-facing rule description ([src/plan.js:85](../../../src/plan.js#L85) for regular weeks, [src/plan.js:86](../../../src/plan.js#L86) for calibration) and the engine spec ([docs/generation/moteur-generation-programme.md:264](../../../docs/generation/moteur-generation-programme.md#L264)) to match. Update the tests pinned by #2 (`test/progression.test.js`) that currently assert an RIR requirement, in either branch. Remove the `rirs` local (line 68) once nothing reads it.
- **Out:** The `lowCount >= 1` / `lowCount >= 2` under-range and deload branches (both regular and calibration) — unchanged. The `unit === "time" || unit === "reps"` branch (isometric holds, bodyweight-reps-only exercises with no loaded progression) — unchanged, out of scope. No journal schema change.

## User-facing behaviour

**Seance tab** — for a loaded exercise (kg/bodyweight+load), on the set where `planned()` is evaluated:
- "Prévu : X kg — <why>" line ([src/App.jsx:130-132](../../../src/App.jsx#L130-L132)): when every set of the last logged session was at or above the top of the rep range, `<why>` reads "+X kg : haut de fourchette atteint" (RIR no longer mentioned as a condition) and the suggested load is `load + increment`, regardless of what RIR was logged.
- Auto-fill of the weight field when reps are entered but weight is left blank ([src/App.jsx:325-327](../../../src/App.jsx#L325-L327)) picks up the new `p.load` — so a session pre-filled from a top-of-range prior week now proposes the incremented load instead of holding.

**Plan tab** — "Règles de progression" section ([src/plan.js:85](../../../src/plan.js#L85)): the sentence "Quand toutes les séries d'un exercice atteignent le haut de la fourchette à ≤ 1 RIR, la charge monte" drops the RIR clause: "Quand toutes les séries d'un exercice atteignent le haut de la fourchette, la charge monte."

**Semaine / Bilan tabs**: no direct change; they don't render `planned().why`.

## Acceptance criteria

- [ ] Given a non-calibration week (not S1/S7), when every logged set of the prior session is `>= mx` reps, regardless of RIR (including `null`/blank RIR), then `planned()` returns `load + v.incr` and `why` credits reaching the top of the range only.
- [ ] Given the same condition but with `rir <= 1` on every set (previous behaviour), the load still increases by the same amount — no regression for the case that already worked.
- [ ] Given at least one logged set below `mx` (not all sets at top), the load-increase branch does not fire; the existing `lowCount >= 2` / "même charge" branches are unaffected and unchanged.
- [ ] Given a calibration week (S1 or S7), when every logged set is `>= mx` reps, regardless of RIR, then `planned()` returns the calibration +5% bump (`why: "calibration : +5 %"`) — the `RIR >= 3` requirement is dropped from this branch too.
- [ ] Given a calibration week with at least one set below `mx` and none below `mn`, the load holds (`why: "charge validée en calibration"`) — unchanged.
- [ ] `src/plan.js`'s progression paragraphs (regular and calibration) no longer state an RIR condition for the load increase.
- [ ] `docs/generation/moteur-generation-programme.md` reflects the same rule change.
- [ ] `test/progression.test.js` is updated: the "a blank RIR blocks the +increment branch" test (currently asserting load is held) is rewritten to assert the increase now fires; the "maxed at <= 1 RIR" test keeps passing; a new case covers "maxed at high RIR (e.g. 4)" firing the increase.
- [ ] `npm test` and `npm run build` pass.

## Data & storage impact

None. No change to the localStorage journal shape (`prog12_simon_v1`) — `rir` stays a logged field, just no longer read as a gating condition in this branch. Per CONTRIBUTING.md's versioning table, this is a **PATCH**: "Fix with no change to intended behaviour" explicitly lists "wrong progression formula" as the example.

## Edge cases

- **Blank/null RIR on some or all sets**: currently blocks the increase (a pinned test asserts this — see `test/progression.test.js:252`). Under the new rule this no longer matters for this branch: `allTop` alone decides, RIR is purely informative here (decided, see [decisions-spec.md](decisions-spec.md) Q1).
- **Mixed sets, some above `mx` some exactly at `mx`**: already covered by `allTop = base.sets.every(s => s.r >= mx)` — no change needed, `>=` already used.
- **Week 7 (deload)**: the post-branch `-15%` deload adjustment (line 87) applies after `next` is computed and is untouched by this change.
- **Bodyweight variant (`unit === "bw"`)**: uses the same branch (load arithmetic, not the time/reps branch) — increase behaviour changes the same way; covered by the existing "maxed at <= 1 RIR at bodyweight" test, to be extended.

## Out of scope / follow-ups

- The `unit === "time" || unit === "reps"` branch's own "allTop" wording ("progresser : +5 s") was not flagged as confusing and is left as is.

## Open questions

None. See [decisions-spec.md](decisions-spec.md) for Q1 (resolved: RIR is ignored for this branch, informative only).
