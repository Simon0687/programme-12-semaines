# Spec - Extract the Plan tab content (#4)

## Context

The Plan tab is built from ~75 lines of editorial text hardcoded inside JSX in
`src/App.jsx:457-533`: the 12-week structure table, the volume table, the
progression rules, the deload recipe, the fallback plan, the cardio/nutrition
sections and "Charges de départ (S1)". Fixing one sentence means editing a React
component. #3 finished moving the *structural* program data into `src/program.js`
and explicitly left this prose, plus the `phaseOf()` editorial notes now parked in
`src/progression.js:23-28`, for #4. Extracting it into a data module the `Section`
component consumes is the last cleanup before #5 (personal profile) and #6 (load a
program from a file) can treat a cycle as data.
Issue: https://github.com/Simon0687/programme-12-semaines/issues/4

## Scope

- **In:**
  - a new data module (`src/plan.js` - see Open questions Q1) exporting the Plan
    tab content as structured, typed blocks: the intro line, and the nine
    editorial `Section`s from "Structure des 12 semaines" to "Charges de départ
    (S1)" (`src/App.jsx:459-524`);
  - one block type per rendering shape (issue Notes): rich paragraph, 2-column
    table (week structure), 3-column table (volume, with the amber right-aligned
    number), and the `Section` wrapper (`title`, `open` flag);
  - `App.jsx` renders the Plan tab by mapping over that data through a small block
    renderer, instead of holding the literals;
  - relocate the five `phaseOf()` `note:` strings (`src/progression.js:24-28`) out
    of the engine into the plan module, keyed by phase id; `App.jsx:380` and
    `App.jsx:412` read them from there (see Q3);
  - move the three hardcoded cardio label fragments in `todayLine`
    (`src/App.jsx:329`: "rameur Z2", "rameur intervalles + mobilité", "rameur Z2 +
    mobilité", "puis mobilité") into the program/plan data (see Q4);
  - one `refactor:` commit (or a short sequence), no behaviour change.
- **Out:**
  - the "Données : sauvegarde et restauration" section (`src/App.jsx:525-533`):
    it is interactive UI (export/import buttons, textarea, `storageOk`
    conditional), not editorial content - it stays in `App.jsx`;
  - the lead paragraphs of the Séance / Semaine / Bilan tabs - not the Plan tab;
  - turning "Charges de départ" or the nutrition numbers into values *computed*
    from a profile - that is #5; #4 relocates the prose verbatim, #5 rewires the
    numbers;
  - deriving the "exos clés" wording or `bilanText()`'s key list
    (`src/App.jsx:289`) from `SLOTS[id].key` - its own issue (#3 follow-up);
  - any change to the progression maths, the test fixtures' assertions, the
    journal shape, `netlify.toml` or `package.json`.

## User-facing behaviour

- **Plan:** no visible change. Same intro line ("Référence du programme. Les
  modifications se font dans le chat, le fichier est régénéré."), same nine
  sections in the same order, "Structure des 12 semaines" still expanded on open,
  the others still collapsed. The week-structure table keeps its 2-column layout,
  the volume table its 3 columns with the count in amber, right-aligned. Every
  paragraph, including the `<`/`>` characters in the deload and nutrition text
  and the `≈ × → %` symbols, renders byte-identical. The "Données" section is
  unchanged.
- **Séance:** no visible change. The session sub-header
  (`Jour conseillé : … {phase.note}`, `src/App.jsx:380`) shows the same phase
  note; the "Après la séance" cardio lines are unchanged.
- **Semaine:** no visible change. The lead line (`{phase.note}`,
  `src/App.jsx:412`) shows the same text.
- **Bilan:** no visible change.

This is a pure internal-move issue. Any change to a displayed string is a
regression.

## Acceptance criteria

- [ ] Given the Plan tab, When it renders after this change, Then every section
      title, paragraph and table cell is identical to the pre-change output,
      section by section, and only "Structure des 12 semaines" starts expanded.
- [ ] Given `src/App.jsx`, Then its `tab === "plan"` block contains no editorial
      sentence and no table-row literal: the nine sections are produced by
      mapping over data imported from the plan module. (The "Données" section and
      its buttons stay.)
- [ ] Given the phase note, When a Séance sub-header and the Semaine lead line
      render for weeks 1, 3, 7, 9 and 12, Then the text matches the current
      `phaseOf(week).note` output exactly.
- [ ] Given `src/progression.js`, Then `phaseOf()` no longer contains the `note:`
      prose; it returns `{ id, label, rir }` and the engine still works.
- [ ] Given `test/progression.test.js` and `test/schema.test.js`, When `npm test`
      runs, Then both pass **with their assertions unmodified** (an import line
      may change only if Q3 requires it - see Q3).
- [ ] `npm run build` succeeds (esbuild resolves the new import).
- [ ] Given a one-word edit to any Plan sentence in the data module, When the app
      re-renders, Then the change shows and no `.jsx` file was touched.

## Data & storage impact

None. The localStorage journal (`prog12_simon_v1`) is untouched - no field added,
renamed or removed. `planned()` and its inputs are unchanged.

**Level: no release bump of its own.** Per CONTRIBUTING.md the compatibility
contract is the journal format, and it is untouched; `refactor:` does not bump.
Issue #4 targets 1.3.0 in the milestone table, but that minor ships with the
later coherent batch whose first `feat` drives the bump - the mechanism decided
for #1 (`docs/features/1-version-data-schema-migrations/decisions.md` Q3) and
reused by #3. No migration.

## Edge cases

- **Section `open` flag.** Only "Structure des 12 semaines" passes `open` today
  (`src/App.jsx:460`). The data must carry a per-section `open` boolean; the
  default is collapsed.
- **The two table shapes.** Week structure is `[label, description]`; volume is
  `[group, count, location]` with the count styled `text-amber-400 text-right`.
  These are different rendering shapes - one block type each, per the issue
  Notes; a single "table" format that hides the amber-count styling is a
  regression risk.
- **Literal `<` / `>` in prose.** `src/App.jsx:500` (`sommeil &lt; 6 h`) and
  `src/App.jsx:516` (`gain &gt; 0,4 kg/sem`) are JSX entities today. As plain
  strings in a data module they are just `<` and `>` and React escapes them on
  render - output is identical, but the data must store the literal character,
  not the entity.
- **`phaseOf()` is engine code.** It is imported by `test/progression.test.js`
  (via `progression.js`) and called inside `planned()` for `.rir`. Removing
  `.note` must not touch `.id`/`.label`/`.rir`. No test asserts on `.note`
  (checked: `test/progression.test.js` references `V.*.start`, `V.*.incr`,
  `SLOTS.*.reps` only).
- **`todayLine` cardio fragments.** `src/App.jsx:325-331` also branches on
  `dayIdx` and weekday for the non-cardio parts - only the four quoted cardio
  strings move; the date/session logic stays.
- **No journal / storage unavailable / imported JSON.** Irrelevant - this issue
  does not touch storage or the progression engine.

## Out of scope / follow-ups

- **#5** turns "Charges de départ (S1)" and the nutrition figures (bodyweight,
  height, maintenance ≈ 3 150 kcal, start 3 400 kcal, P 185 / L 85 / G 470,
  target 92,5-93,5 kg) into values composed from `src/profil.js`. #4 leaves them
  as prose in the plan module; #5 replaces the numbers with references.
- **`bilanText()` key list** (`src/App.jsx:289`, `["dc","squat","pull","ohp",
  "hipthrust","latraise"]`) and the Plan "exos clés" wording could both derive
  from `SLOTS[id].key`. Behaviour-risk transform - its own issue.
- **Directory convention** for data modules (`src/*` vs `src/data/*`) - #3
  deferred this to "when #4 starts"; it is Q1 below.
- **`Section` open/closed state is component-local.** Not changed here; a future
  "expand all" affordance would be its own issue.

## Open questions

Resolved 2026-09-07 (`decisions-spec.md`, all Option A):

1. **Module path** - `src/plan.js` (flat, matching `src/program.js` /
   `src/progression.js` / `src/schema.js`); the `src/data/` wording in #4-#6 is
   superseded by #2/#3.
2. **Block model** - typed-block tree (`section` / `p` / `table` with a
   `variant`) plus a small renderer in `src/App.jsx`.
3. **`phaseOf()` notes** - split `note` out into `PHASE_NOTES` in `src/plan.js`;
   `phaseOf()` returns `{ id, label, rir }`.
4. **`todayLine` cardio fragments** - the four phrases move to `CARDIO_DAY_NOTES`
   in `src/program.js`; nothing else in `todayLine` changes.
