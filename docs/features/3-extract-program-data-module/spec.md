# Spec - Extract the program into a data module (#3)

## Context

Issue #2 already cut `V`, `SLOTS`, `SESSIONS` and `CORE` out of `src/App.jsx` into
`src/program.js` (its Q1 decision, Option B), so the progression engine could be
tested headless. What is left inline in `App.jsx` is the rest of the program
definition: `WARM` (warm-up protocols, lines 37-40), `cardioPlan()` (the
week-by-week cardio prescription, lines 42-51), `CARDIO_ITEMS` and `MOB_DAYS`
(the cardio checklist and mobility days, lines 53-58). This issue finishes the
move and turns `src/program.js` into the documented, single source of the program
structure, so #4 (Plan-tab content), #5 (user profile) and #6 (load a program
from a file) have a clean module to build on.
Issue: https://github.com/Simon0687/programme-12-semaines/issues/3

## Scope

- **In:**
  - move `WARM`, `cardioPlan()`, `CARDIO_ITEMS`, `MOB_DAYS` **verbatim** from
    `src/App.jsx` into `src/program.js`, exported;
  - `App.jsx` imports them from `./program.js` instead of defining them;
  - expand the `src/program.js` header comment into a field-by-field reference
    for every exported structure: what a slot is, how a variant attaches to a
    slot via `b1` / `b2`, and the meaning of every field (`name`, `incr`,
    `start`, `perHand`, `unit` and its values, `side`, `cue`; `reps`, `rest`,
    `key`, `fail`; the `SESSIONS` / `CORE` / `WARM` shapes; the `cardioPlan()`
    return shape);
  - one `refactor:` commit, no behaviour change.
- **Out:**
  - any reshape of the data - this issue relocates, it does not transform (the
    issue's own Notes);
  - the Plan-tab editorial prose (12-week table, volume table, progression rules,
    deload recipe, fallback plan, cardio/nutrition sections, "Charges de départ")
    - that is #4;
  - `START`, `KEY` and the starting loads embedded in `V` (`start:`) - personal
    profile, that is #5;
  - the `phaseOf()` editorial notes currently parked in `src/progression.js` - #4
    relocates those (already noted in that file's header);
  - renaming or moving `src/program.js` (see Open questions Q1);
  - any change to `src/progression.js`, the test suite, `netlify.toml` or
    `package.json`.

## User-facing behaviour

- **Seance:** no visible change. The *Échauffement* section shows the same
  `WARM.upper` / `WARM.lower` text; the *Cardio et mobilité* view shows the same
  Z2, intervals and mobility strings from `cardioPlan(week)`, the same three
  `CARDIO_ITEMS` rows, the same three `MOB_DAYS` checkboxes.
- **Semaine:** no visible change - the compact `CardioView` reads the same data.
- **Bilan, Plan:** no visible change.

This is a pure internal-move issue. Any change to a displayed string is a
regression.

## Acceptance criteria

- [ ] Given the #2 suite (`test/progression.test.js`), When `npm test` runs after
      this change, Then it passes **with the test file unmodified** (no import
      path change, no fixture change).
- [ ] `npm run build` succeeds (esbuild resolves the new imports from
      `./program.js`).
- [ ] `src/App.jsx` no longer defines `WARM`, `cardioPlan`, `CARDIO_ITEMS` or
      `MOB_DAYS`; it imports all four from `./program.js`.
- [ ] `src/App.jsx` defines no exercise catalogue data and no coaching cue: the
      exercise `name` and `cue` strings live only in `V` in `src/program.js`. (The
      Plan-tab prose still *mentions* exercises in free text; finishing that is
      #4 - see Open questions Q3.)
- [ ] The header of `src/program.js` documents every exported structure
      field-by-field, including `unit` values (`kg` implicit, `bw`, `time`,
      `reps`, `carry`) and the `b1` / `b2` block mapping.
- [ ] Given weeks 1, 7 and a normal block week, When the Cardio view renders,
      Then the Z2 minutes, the interval block (or its absence in weeks 1 / 7 /
      12) and the mobility text are identical to the pre-change output.
- [ ] Given the *Échauffement* section on an upper and a lower session, Then the
      text is byte-identical to before.

## Data & storage impact

None. The localStorage journal (`prog12_simon_v1`) is untouched - no field added,
renamed or removed. `planned()` and its inputs are not modified.

**Level: no release bump of its own.** Per CONTRIBUTING.md the compatibility
contract is the journal format, and it is untouched; this is a `refactor:` change,
which `standard-version` does not bump. Issue #3 targets 1.2.0 in the milestone
table, but 1.2.0 ships with a later coherent batch whose first `feat` drives the
minor bump - the same mechanism decided for #1
(`docs/features/1-version-data-schema-migrations/decisions.md`, Q3, Option C). No
migration.

## Edge cases

- **`cardioPlan(7)`:** `z2 = 30`, `intervals = null` - the "Pas d'intervalles
  cette semaine" row must still show. Unchanged by a verbatim move.
- **`cardioPlan(1)` / `cardioPlan(12)`:** `intervals = null` as well; week 1 also
  appends the recalibration sentence to `z2`. Unchanged.
- **Weeks 2-6 vs 8-11:** different interval strings ("4 × 4 min" vs "5 × 4 min").
  Unchanged.
- **No journal / storage unavailable:** irrelevant - this issue does not touch the
  progression engine or storage.
- **`window.storage` bridge vs `localStorage`:** irrelevant, same reason.
- **Session reopened, imported JSON:** no effect - no calculation changes.

## Out of scope / follow-ups

- **#4** takes the Plan-tab prose (including "Charges de départ (S1)" and the
  nutrition sections) into `src/data/plan.js`, and relocates the `phaseOf()`
  editorial notes.
- **Directory convention.** Issues #4-#6 name `src/data/plan.js` /
  `src/data/profil.js`; #2 and #3 use `src/program.js` (no `data/`). Pick one
  convention when #4 starts - either move the data modules under `src/data/`
  together in one rename ticket, or drop the `data/` prefix from #4-#6. Not done
  in #3: moving `src/program.js` now would force an import-path edit in
  `test/progression.test.js` and break the "#2 tests pass unmodified" criterion,
  for no user benefit.
- **`bilanText()` key-exercise list.** `src/App.jsx:312` hardcodes
  `["dc","squat","pull","ohp","hipthrust","latraise"]`, and the Plan "exos clés"
  wording repeats it; both could derive from `SLOTS[id].key`. That is a
  transform with a behaviour-risk, so it is its own issue, not #3.
- **`todayLine` cardio strings.** `src/App.jsx:352` inlines "rameur Z2",
  "rameur intervalles + mobilité" etc. to build the day summary - editorial glue
  that duplicates cardio structure; fold into #4.

## Open questions

1. **Module path.** Keep the data in `src/program.js` (where #2 put it), or move
   it to `src/data/programme.js` as the issue body wrote? Moving it forces an
   edit to `test/progression.test.js` (its `import ... from "../src/program.js"`),
   which collides with the "#2 tests pass unmodified" criterion. See
   `decisions-spec.md` Q1. **Reco: keep `src/program.js`;** treat the issue's
   path as superseded by #2's decision; settle the `src/data/*` convention when
   #4 starts.
2. **`CARDIO_ITEMS` / `MOB_DAYS` boundary.** Extract them in #3 with `WARM` and
   `cardioPlan()`, or leave them for #4 with the Plan-tab content? See
   `decisions-spec.md` Q2. **Reco: extract in #3** - they are structural
   catalogue data feeding the Séance/Semaine `CardioView`, the same nature as
   `SESSIONS`, not Plan-tab prose.
3. **"No exercise name in `App.jsx`" criterion.** Read it against structured
   catalogue data and cues only (already satisfied by `V`), or block #3 until the
   Plan-tab prose that names exercises is also extracted? See `decisions-spec.md`
   Q3. **Reco: structured data + cues only;** #4 finishes the editorial side.
