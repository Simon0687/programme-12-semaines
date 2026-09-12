# Spec - Extract the user profile (#5)

## Context

Personal data is scattered across the code: the start date
(`const START = new Date(2026, 8, 7)`, `src/App.jsx:12`), six starting loads
embedded in the exercise catalogue (`start:` inside `V` in `src/program.js` -
`dc` 72.5, `incl_db` 30, `squat` 105, `ohp_db` 26, `pullup` 0, `pd_close` 90),
and bodyweight / height / maintenance / macro targets written into the Plan
"Nutrition" and "Charges de départ" prose (in `src/plan.js` after #4). Starting a
new cycle means hunting these down in several files with the risk of missing one.
#5 groups them into `src/profile.js` (see Q4) so each value has one home, and the
Plan texts that cite a value compose it from the module. It is the last
separation step before #6 can load a whole cycle - program + profile - from a
file.
Issue: https://github.com/Simon0687/programme-12-semaines/issues/5
Depends on #4 (the Plan content must already be a data module).

## Scope

- **In:**
  - a new `src/profile.js` module (see Q4) exporting: the start date, the six
    starting loads keyed by variant id, and the personal body / nutrition values
    the Plan cites (bodyweight, height, birthdate, estimated maintenance kcal,
    start kcal, protein / fat / carb targets, target weight range);
  - `src/App.jsx` imports `START` (or a `startDate()` helper) from
    `src/profile.js` instead of defining it; `weekRange()`, `dayIdx`, `curWeek`
    and the "Le programme commence lundi …" line derive from it as they already
    do;
  - the six `start:` values leave the `V` literal in `src/program.js`;
    `src/program.js` folds them back onto `V` from `src/profile.js` at module
    load, so every current reader (`planned()`, `test/progression.test.js`) still
    sees `V[id].start` unchanged (see Q1);
  - the `src/plan.js` "Charges de départ (S1)" block and the nutrition
    target figures are composed from `src/profile.js` values rather than repeating
    them (see Q3 for how far this goes);
  - one `refactor:` commit (or a short sequence), no behaviour change.
- **Out:**
  - making the **cycle length** (12 weeks / 84 days) a real parameter - it is
    woven into `phaseOf()` phase boundaries, the `planned()` week-7 branch,
    `setsFor()`, `blockOf()`, the AMRAP-in-S12 rule and loop bounds in
    `src/progression.js`, plus `dayIdx >= 84` in `src/App.jsx:327`. Re-deriving
    all of that is a transform with real regression risk and is the essence of
    #6. #5 keeps 12 as a program constant (see Q2);
  - the localStorage key `prog12_simon_v1` (`src/App.jsx:13`) - it carries the
    name but journal identity / multi-cycle coexistence is #6's explicit call
    (its Notes: `prog12_<programId>` vs a program reference in the journal);
  - the illustrative numbers in the nutrition prose that are not live targets -
    the meal-plan gram amounts, the Mifflin / Katch-McArdle derivation
    (1 916 / 2 071 / 2 000), the adjustment deltas (−150 to −200 kcal etc.) - see
    Q3;
  - any reshape of the journal, changes to the progression maths, the test
    fixtures' assertions, `netlify.toml` or `package.json`.

## User-facing behaviour

- **Séance:** no visible change. The "Prévu" load for a first, un-logged session
  (e.g. Développé couché in S1 → "72,5 kg", squat → "105 kg", tractions → "Poids
  du corps") is identical because `planned()` still reads `V[id].start`. The
  "Aujourd'hui / Le programme commence lundi 7 sept." line is unchanged.
- **Semaine / Bilan:** no visible change. Week ranges and labels are the same as
  long as `START_DATE` in `src/profile.js` equals the old `new Date(2026, 8, 7)`.
- **Plan:** no visible change. "Charges de départ (S1)" reads the same sentence,
  now assembled from `src/profile.js`. The "Nutrition" section shows the same
  maintenance / start-kcal / macro / target-weight figures, now sourced from the
  module (the surrounding prose is unchanged).

This is a pure internal-move issue. Any change to a displayed value is a
regression.

## Acceptance criteria

- [ ] Given `src/profile.js` with `START_DATE` changed to another Monday, When
      the app loads, Then every "Semaine N" header, the `weekRange()` label, the
      current-week detection and the "Le programme commence lundi …" line shift
      by the same offset - no other file edited.
- [ ] Given `src/profile.js` with a changed value in `STARTING_LOADS`, When the
      Séance tab shows the "Prévu" load for that exercise's first session **and**
      the Plan "Charges de départ" section renders, Then both reflect the new
      value.
- [ ] Given `src/App.jsx`, When searched for personal literals (`new Date(2026`,
      `72.5`, `105`, `90`, `3 400`, `185 g`, `92,5`), Then none remain - they
      live only in `src/profile.js`.
- [ ] Given `src/program.js`, Then the `V` object literal contains no `start:`
      key; the six values are applied from `src/profile.js`, and `V.dc.start`
      still equals `72.5` at runtime.
- [ ] Given `test/progression.test.js` and `test/schema.test.js`, When `npm test`
      runs, Then both pass **with their assertions unmodified** (Option A of Q1).
- [ ] `npm run build` succeeds (esbuild resolves `./profile.js` from both
      `src/App.jsx` and `src/program.js`).
- [ ] Given the Plan "Nutrition" and "Charges de départ" sections, When they
      render, Then the maintenance kcal, start kcal, macro grams and target
      weight read byte-identical to the post-#4 output.

## Data & storage impact

None. The localStorage journal (`prog12_simon_v1`) is untouched - no field added,
renamed or removed. The removal of `start:` from the `V` literal changes an
in-memory object shape that is re-filled at load; nothing serialised changes.

**Level: no release bump of its own.** The compatibility contract is the journal
format (CONTRIBUTING.md) and it is untouched; `refactor:` does not bump. Issue #5
targets 1.4.0 in the milestone table, but that minor ships with the coherent
batch whose first `feat` drives the bump - the mechanism from #1
(`docs/features/1-version-data-schema-migrations/decisions.md` Q3), reused by #3
and #4. No migration.

## Edge cases

- **`pullup` starts at `0`.** `start: 0` is a real value (bodyweight, no added
  load), not "absent". `planned()` distinguishes them with `v.start == null`
  (`src/progression.js:64`). `STARTING_LOADS.pullup = 0` must be *applied* to
  `V.pullup` (a fold that skips falsy values would drop it) and must stay
  distinct from a variant with no entry, which still falls to "Paliers".
- **Week-7 starting-load path.** `planned()` uses `roundTo(v.start * 0.85, v.incr)`
  for a first S7 session (`src/progression.js:65`). Must still resolve after the
  fold.
- **`planned()` "no base entry" branch** is the only consumer of `v.start` -
  covered by `test/progression.test.js` "no history" and "pull-ups" describes,
  which assert `p.load === V.dc.start` / `=== 0`. Option A keeps these green
  untouched; any other option edits the pinned suite.
- **Date parsing / timezone.** `new Date("2026-09-07")` parses as **UTC**
  midnight, which is a day earlier in some local zones and would shift `dayIdx`.
  The module must yield a *local* date (`new Date(2026, 8, 7)` semantics) - export
  a `Date` built from parts, or a `startDate()` helper that splits the ISO string
  and calls `new Date(y, m - 1, d)`.
- **Two importers.** `src/profile.js` is imported by both `src/program.js` (for
  `STARTING_LOADS`) and `src/App.jsx` (for the date and the Plan figures). No
  cycle: `profile.js` imports nothing from either.
- **#4 not merged yet.** #5's changes to `src/plan.js` assume #4's block model
  exists; if #4 is still in review, #5 rebases on it.
- **No journal / imported JSON / session reopened.** Irrelevant - #5 touches
  neither storage nor the engine.

## Out of scope / follow-ups

- **#6** parameterises the cycle length, decides the journal-identity question
  (`prog12_<programId>` vs a program reference), and loads program + profile from
  a JSON file - at which point `src/program.js` no longer imports `src/profile.js`
  (a loader composes both).
- **Nutrition prose depth.** If Q3 lands on the minimal option, a later issue can
  push more of the nutrition figures (adjustment deltas, meal-plan amounts) into
  structured profile data - only worth doing if that text starts changing often.
- **`bilanText()` target line.** `bilanText()` (`src/App.jsx:282-309`) prints
  weight / waist but no target; if a "vs target 92,5-93,5 kg" line is ever wanted
  it would read `src/profile.js`. Not now.

## Open questions

Resolved 2026-09-07 (`decisions-spec.md`, all Option A):

1. **Starting loads** - `src/program.js` imports `STARTING_LOADS` from
   `src/profile.js` and folds it back onto `V` at load; `planned()` and both
   test files stay unmodified.
2. **Cycle length** - stays the hardcoded constant `12`; `src/profile.js` does
   not export it. Parameterising the cycle is #6.
3. **Nutrition figures** - only the live targets (maintenance, start kcal,
   macros, target weight) are composed from `src/profile.js`; the Mifflin/Katch
   derivation and the meal-plan amounts stay literal prose.
4. **Module name / shapes** - `src/profile.js`; `START_DATE` ISO string +
   `startDate()` local-date helper; `birthdate`, not `age`. Body values:
   90 kg / 193 cm / born 1987-06-18.
