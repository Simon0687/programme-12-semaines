# Decisions - Extract the program into a data module (#3)

Source: spec.md
Scope: product / requirement choices only - where #3 stops and #4 begins, and
which file the data lives in. Implementation mechanics (commit split, header
wording, import order) belong to the design round and are recorded in the design's
own **## Open questions** / a sibling `decisions.md` after `/design-tech 3`.
Status: awaiting Simon's answers - recommendations pre-filled so the design and
build can proceed on them if Simon does not object.

---

## Q1 - Where the program data lives: `src/program.js` or `src/data/programme.js`

**Question.** The issue body says "A `src/data/programme.js` module exports these
structures". But #2 already created `src/program.js` (no `data/` folder, English
name) and moved `V` / `SLOTS` / `SESSIONS` / `CORE` into it, and
`test/progression.test.js:4` imports `{ V, SLOTS, SESSIONS } from
"../src/program.js"`. Issues #4-#6 in turn name `src/data/plan.js` and
`src/data/profil.js`. So #3 has to choose: extend the file #2 made, or move it to
the path the issue wrote. Left unanswered, the developer picks silently and #4-#6
inherit an unclear convention.

**Option A - Keep `src/program.js`; add the remaining data to it**
- What it means: `WARM`, `cardioPlan()`, `CARDIO_ITEMS`, `MOB_DAYS` are appended
  to the existing `src/program.js`; no file is moved or renamed.
- Implications: `test/progression.test.js` is not touched - the "#2 tests pass
  unmodified" acceptance criterion holds literally. `App.jsx` keeps its single
  `import ... from "./program.js"` line, just longer. The epic's `src/data/*`
  naming (#4-#6) stays unreconciled and is flagged as a follow-up.
- Pros: smallest change; respects the criterion that matters (#2's suite untouched
  and green); the data lands in the file that is already its home.
- Cons: the issue body's `src/data/programme.js` wording is not honoured; the
  directory question is deferred, not answered.

**Option B - Move to `src/data/programme.js` now**
- What it means: `git mv src/program.js src/data/programme.js`, add the remaining
  data, and update three import sites: `src/App.jsx:4`, `src/progression.js:13`,
  `test/progression.test.js:4`.
- Implications: the #2 test file is edited (one import path) - this contradicts
  "The tests from issue #2 pass unmodified" unless that criterion is read as "pass
  without changing assertions/fixtures". Sets the `src/data/*` convention for
  #4-#6 in one go.
- Pros: matches the issue body; establishes the directory convention early, so
  #4-#6 have no ambiguity.
- Cons: touches the test file for zero behaviour reason; more merge surface; the
  rename is churn that could instead be one deliberate ticket moving *all* data
  modules (`schema.js`, `progression.js`, `program.js`) together.

**Option C - Move to `src/data/program.js` (keep the English name)**
- What it means: as B, but the file keeps the codebase's English naming
  (`schema.js`, `progression.js`, `program.js`) rather than the issue's French
  `programme.js`.
- Implications: same import-site edits as B; slightly more consistent than B with
  the existing module names.
- Pros / Cons: same as B, minus the French-name inconsistency.

**Recommendation. A.** Keep `src/program.js`. The one hard acceptance criterion in
#3 is that #2's suite still passes untouched; A is the only option that satisfies
it without reinterpretation. The `src/data/*` question is real but it is an
epic-wide naming decision, best made once when #4 starts (and ideally applied to
all data modules at once), not smuggled into #3 as an import-path churn.
Reversible: a later rename ticket can move every data module together cheaply.

**Simon's decision.** _(left blank for Simon)_

---

## Q2 - `CARDIO_ITEMS` and `MOB_DAYS`: extract in #3 or leave for #4

**Question.** The issue names `WARM` and `cardioPlan()` explicitly. `CARDIO_ITEMS`
(`src/App.jsx:53-57`, the three cardio checklist rows) and `MOB_DAYS`
(`src/App.jsx:58`, the three mobility weekday labels) sit in the same block and
feed the same `CardioView` component, but the issue does not name them. Do they
move in #3, or wait for #4 ("Extract the Plan tab content")?

**Option A - Extract in #3, with `WARM` and `cardioPlan()`**
- What it means: all four constants move to `src/program.js` together; `CardioView`
  imports `CARDIO_ITEMS` / `MOB_DAYS` from there.
- Implications: the whole cardio/warm-up structure lands in one place in one
  commit. #4 is left with pure Plan-tab prose (paragraphs and tables), no stray
  data constants.
- Pros: coherent unit - `CARDIO_ITEMS` is a catalogue (`{ id, label, when }`
  rows), structurally the same kind of thing as `SESSIONS`, and it renders in the
  Séance/Semaine tabs, not the Plan tab; leaving it behind would split one
  concept across two issues.
- Cons: #3 touches two lines the issue did not literally list.

**Option B - Leave them for #4**
- What it means: #3 moves only `WARM` and `cardioPlan()`; `CARDIO_ITEMS` /
  `MOB_DAYS` stay in `App.jsx` until #4.
- Implications: `App.jsx` still holds two program-data constants after #3; #4 has
  to pick them up even though they are not Plan-tab prose.
- Pros: literal reading of the issue scope.
- Cons: `App.jsx` is left in a half-extracted state; #4's scope ("editorial
  content, not interface") does not naturally cover a `{ id, label, when }`
  catalogue.

**Recommendation. A.** Extract all four in #3. `CARDIO_ITEMS` and `MOB_DAYS` are
structural program data of the same kind #3 is meant to move, and they belong with
`cardioPlan()` which produces the text those rows display. The spec's acceptance
criteria and Scope already assume A. Reversible: trivially.

**Simon's decision.** _(left blank for Simon)_

---

## Q3 - The "no exercise name or coaching cue in `App.jsx`" acceptance criterion

**Question.** The issue's acceptance list has "`App.jsx` no longer contains any
exercise name or coaching cue". Coaching cues (`cue:`) and structured names
(`name:`) already live only in `V` (moved in #2). But the Plan tab still contains
~100 lines of free text that name exercises - "Développé couché 72,5 kg ; squat
105 kg ...", "tractions 3, rowing appuyé 2", the volume table rows, etc.
(`src/App.jsx:483-547`). Taking those into a data module is exactly issue #4's job
("roughly a hundred lines of hardcoded text inside JSX"). Does #3 satisfy the
criterion as-is, or must it also strip the Plan prose?

**Option A - Read the criterion as "structured catalogue data + cues", satisfied by #2/#3**
- What it means: #3 is done when no exercise `name` / `cue` / slot / session
  structure is defined in `App.jsx`. The Plan-tab prose that mentions exercises in
  sentences is explicitly #4's scope and is called out as a follow-up.
- Implications: #3 stays a clean mechanical move; #4 owns all editorial text. The
  spec states plainly that the criterion is met in spirit and #4 finishes it.
- Pros: keeps #3 small and reviewable; matches the issue's own Notes ("This issue
  relocates, it does not transform") - turning prose into structured data is a
  transform; matches #4's stated problem statement.
- Cons: a literal reader of the checkbox sees exercise names still in `App.jsx`
  after #3 and has to check the spec note to understand why that is expected.

**Option B - #3 also extracts the Plan prose that names exercises**
- What it means: pull "Charges de départ (S1)" and any exercise-naming Plan
  paragraphs into a module now.
- Implications: #3 absorbs a large part of #4; the two issues overlap; the move
  stops being purely mechanical (prose has to be modelled as data - block types,
  tables - which is #4's Notes verbatim).
- Pros: the checkbox is literally true after #3.
- Cons: scope creep onto #4; a much bigger diff and review; contradicts "relocate,
  don't transform".

**Recommendation. A.** Interpret the criterion against structured data and cues,
which #2 and #3 fully cover, and let #4 do the editorial extraction it is defined
for. Record the interpretation in the spec so the checkbox is not read as unmet.
Reversible: this is a scoping note, not code.

**Simon's decision.** _(left blank for Simon)_

---

## How to apply

Once Simon fills in each "Simon's decision", fold the answers into `spec.md`:
resolved points move out of **## Open questions** (which then ends as "None") into
Scope / Acceptance criteria / Out of scope. If Q1 goes to Option B or C, the
design's **Files touched** and **Sequencing** gain the `git mv` and the three
import-site edits, and the spec's first acceptance criterion is reworded. If any
answer changes scope (Q2 Option B, Q3 Option B), update Scope accordingly before
the build starts. The design (`design.md`) is written assuming the
recommendations (A / A / A) hold; revisit it only if a decision differs.
