# Spec - Tests for the progression logic (#2)

## Context

`planned()` in `src/App.jsx` (lines 176-219) decides the suggested load for every
set: starting loads, calibration in weeks 1 and 7, double progression, −15% deload,
−5% after two sessions below the rep range, plus the bodyweight and time/reps
special cases. It is the densest code in the app and has zero tests. A mistake here
never crashes - it silently suggests the wrong load, and you find out in the gym.
This issue locks the current behaviour behind a headless test suite before issues
#3-#6 start moving the program data around.
Issue: https://github.com/Simon0687/programme-12-semaines/issues/2

## Scope

- **In:**
  - a headless unit-test suite for the progression calculation, run by
    `npm test` (`node --test`, same runner brought up in #1);
  - extraction of the pure calculation into an importable `.js` module
    (`src/App.jsx` cannot be imported by `node --test`: it is JSX and pulls in
    React), done as its own `refactor:` commit, separate from the `test:` commits;
  - tests covering every case listed in the issue (see Acceptance criteria);
  - a build/CI change so a failing suite fails the deploy (`npm test` before
    `npm run build`).
- **Out:**
  - any change to the progression behaviour itself - this issue documents and
    pins what the code does today; a formula that looks wrong is recorded in
    Open questions, not fixed here (a fix would be its own `fix:` issue);
  - the full program/data-module extraction - that is #3; this issue moves only
    what the tests need (see Open questions Q1 for the boundary);
  - tests for rendering, storage, timer, import/export, or the Bilan text;
  - `lastEntry()` beyond what `planned()` needs (it only feeds the "Dernière fois"
    display).

## User-facing behaviour

- **Seance, Semaine, Bilan, Plan:** no visible change. Same suggested loads, same
  "Prévu :" text and reasons, same placeholders. This is a test + internal-move
  issue; if any displayed value changes, that is a regression.

## Acceptance criteria

- [ ] `npm test` runs the suite headless (no browser, no DOM, no React render) and
      exits non-zero when any progression result drifts.
- [ ] The deploy pipeline runs `npm test` before the build and refuses to publish
      when it fails (via `netlify.toml` `command`, or an equivalent CI gate).
- [ ] The calculation under test lives in a plain `.js` module importable from
      `test/`, with named exports; `src/App.jsx` imports it and its displayed
      output is unchanged.
- [ ] Given no history for a variant with a starting load (e.g. `dc` 72,5 kg),
      When `planned()` runs for week 1, Then `load` is the starting load and the
      reason is "charge de départ".
- [ ] Given no history for a variant with no starting load (`v.start` absent),
      Then `load` is `null` and the text is "Paliers" (ramp-up).
- [ ] Given no history for a time/reps variant, Then `load` is `null` and the text
      is the "Cible X–Y s/reps à N RIR" target.
- [ ] Calibration (reference week 1 or 7): all sets at the top of the range at
      ≥ 3 RIR ⇒ +5% rounded to the variant increment; at least one set below the
      bottom of the range ⇒ −5%; otherwise the load is held.
- [ ] Progression (reference week not 1/7): all sets at the top of the range at
      ≤ 1 RIR ⇒ load + the variant increment (2,5 kg `dc`, 5 kg `squat`, 2 kg
      dumbbell variants, per each variant's `incr`), not percentage-rounded.
- [ ] Stalling: two or more sets below the range once ⇒ load held ("on retente");
      two sessions in a row with ≥ 2 sets below ⇒ −5%.
- [ ] Week 7: for a variant with pre-week-7 history, the suggested load is the
      otherwise-computed load × 0.85, rounded to the increment, reason "décharge
      −15 %".
- [ ] Week 8: for an anchor variant (history before and during week 7),
      progression resumes from the last pre-deload session, not from the week-7
      load; no −15% is applied.
- [ ] A block-2 variant first seen in week 7 (no earlier history) shows the
      starting-load / "Paliers" branch in week 7, then is treated as calibration
      in week 8 (+5% / −5% / hold off the week-7 numbers).
- [ ] Same variant logged twice in one week (e.g. `latraise` in Haut A then
      Haut C): the second session's suggestion accounts for the first
      (`e.week === week && e.si < si`).
- [ ] Pull-ups (`unit: "bw"`, `start: 0`): no added load reads "Poids du corps";
      once at the top of the range at ≤ 1 RIR the suggestion becomes bodyweight +
      the increment (2,5 kg).
- [ ] Time-based variant (`sideplank`, `unit: "time"`): `load` stays `null`; the
      reason moves to duration ("+5 s") when all sets hit the top of the range,
      otherwise "viser le haut de la fourchette".

## Data & storage impact

None. The localStorage journal (`prog12_simon_v1`) does not change shape - no new,
renamed or removed field. `planned()` only reads the journal.

**Level: PATCH.** Per CONTRIBUTING.md the compatibility contract is the journal
format, and it is untouched: a journal saved by the previous version loads
identically, so this is not MINOR and not MAJOR. In practice it is a test +
`refactor` change with no independent release bump; it ships inside the 1.1.0
milestone release driven by #1. No migration required.

## Edge cases

- **No journal at all:** every variant falls to the starting-load / "Paliers" /
  target branch; nothing throws.
- **Blank RIR on a logged set:** neither the +increment nor the +5% branch fires
  (both require every RIR present); the load is held.
- **Rounding:** percentage moves (`×1.05`, `×0.95`, `×0.85`) round to the
  variant's `incr`; the flat +increment step does not.
- **Week 7, first stall inside the deload:** `prev` may be a different
  session/week; when it is missing the stall holds rather than cutting.
- **`carry` (`unit: "carry"`):** not "time"/"reps", so it goes through the kg
  path and is progressed as a load - confirm this is intended (Open questions Q3).
- **Storage unavailable:** irrelevant to `planned()`, which is pure over the
  in-memory state.
- Session reopened, imported JSON: no effect on the calculation beyond the state
  it produces.

## Out of scope / follow-ups

- If a test documents behaviour that is actually wrong (see Open questions Q2/Q3),
  open a `fix:` issue with the failing case attached; do not fix it here.
- Building the CI workflow file (`.github/workflows/`) if `netlify.toml` is not the
  chosen gate could be its own `chore:` issue.
- Property-based / fuzz testing of `planned()` across a whole 12-week cycle.

## Open questions

1. **Extraction boundary.** The tests force a `.js` module. Minimum viable:
   `src/progression.js` exporting `history`, `lastEntry`, `planned`, `loadText`
   plus the pure helpers (`num`, `fmt`, `roundTo`). But `planned()` also needs
   `V`, `SLOTS`, `blockOf`, `phaseOf`, `setsFor`. Do we (a) move those into
   `src/progression.js` now, (b) move them into a new `src/program.js` now
   (overlapping #3), or (c) keep them in `App.jsx` and import back? Recommend
   (a) for periodisation helpers (`blockOf`, `phaseOf`, `setsFor`) and a thin
   `src/program.js` for `V`/`SLOTS`, with #3 taking `SESSIONS`/`CORE`/editorial.
   The tech-lead design decides the final split.
2. **Deload baseline is "computed next × 0.85", not "last non-deload load × 0.85".**
   In week 7 the code first runs the normal progression/hold branch, then applies
   −15%. So a variant that was due +2,5 kg gets `(load + 2,5) × 0.85`. The issue
   wording says "−15% relative to the last non-deload week". Pin the current
   behaviour, or is this the bug the suite should catch?
3. **`carry` progresses as kilograms.** `unit: "carry"` misses the time/reps
   branch, so suitcase carry is treated as a loaded lift (increment 2 kg).
   Intended, or should it behave like a time exercise?
4. **CI gate mechanism.** There is no `netlify.toml` and no `.github/workflows/`
   in the repo - the Netlify build command is set in the dashboard. Add
   `netlify.toml` with `command = "npm test && npm run build"`, or a GitHub
   Actions check? Simon to confirm where the build is configured.
5. **"below the range" uses `r < mn` (strict) and "top" uses `r >= mx`.** Confirm
   these boundaries are what the tests should assert (a set exactly at `mn` is not
   "below"; a set above `mx` still counts as "top").

## Decisions - Simon's Answers (#2)

* **Q1 (Module boundaries):** **Option B**. Cut `V`, `SLOTS`, `SESSIONS`, and `CORE` from `App.jsx` into `src/program.js`. `src/progression.js` imports from `./program.js`. Annotate issue #3.
* **Q2 (Deload base calculation):** **Option A**. Pin current behavior `roundTo((computed_next) * 0.85, incr)`. Open a follow-up `fix(progression)` task if recalculation from actual last worked load is desired later.
* **Q3 (Suitcase carry progression):** **Option A**. Pin as weighted exercise (progress weight when time threshold is met).
* **Q4 (Deployment gating):** **Option A**. Create `netlify.toml` using `command = "npm test && npm run build"`.
* **Q5 (Rep range operators):** **Option A**. Assert existing bounds (`>= mx` for top, `< mn` for failure).