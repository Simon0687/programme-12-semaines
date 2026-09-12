# Decisions - Extract the user profile (#5)

Source: spec.md
Scope: product / requirement choices only - where personal values live, how far
the extraction reaches (cycle length, nutrition prose), and the module's name and
value shapes. Implementation mechanics (fold-loop placement, block interpolation
syntax, commit split) belong to the design round and land in a sibling
`decisions.md` after `/design-tech 5`.
Status: resolved 2026-09-07 - Simon accepted every recommendation (A / A / A / A).
Body values supplied: bodyweight 90 kg, height 193 cm, birthdate 1987-06-18.

---

## Q1 - Where the starting loads live, and how `V[id].start` stays resolvable

**Question.** Six starting loads sit inside `V` in `src/program.js` as `start:`
keys. `planned()` (`src/progression.js:64-66`) reads `v.start` in its
"no base entry" branch, and `test/progression.test.js:35` asserts
`p.load === V.dc.start` **by object reference** (plus "pull-ups" at line 200
expects `p.load === 0` from `pullup.start: 0`). #5 must move these into
`src/profile.js` without breaking either. Unanswered, the developer picks a wiring
that may quietly edit the pinned suite.

**Option A - `program.js` folds `STARTING_LOADS` back onto `V` at load**
- What it means: `src/profile.js` exports
  `STARTING_LOADS = { dc: 72.5, incl_db: 30, squat: 105, ohp_db: 26, pullup: 0,
  pd_close: 90 }`. `src/program.js` imports it and, right after the `V` literal
  (which no longer has `start:`), applies
  `for (const [vid, l] of Object.entries(STARTING_LOADS)) V[vid].start = l;`.
- Implications: `V.dc.start === 72.5` at runtime, so `src/progression.js` and
  **both** test files are untouched. `src/program.js` gains an
  `import … from "./profile.js"` - the "structure" module depends on the "person"
  module, which is backwards conceptually but temporary: #6 introduces a loader
  that composes program + profile and this import goes away. `src/plan.js`'s
  "Charges de départ" block reads the same `STARTING_LOADS` (or `V[vid].start`).
- Pros: zero test change; engine maths untouched; smallest blast radius; matches
  how #3 and #4 kept `test/progression.test.js` green.
- Cons: `program.js → profile.js` dependency direction reads wrong until #6
  removes it; a `V` entry is now assembled in two places (literal + fold loop).

**Option B - `planned()` reads `STARTING_LOADS` directly; `V` loses `start`**
- What it means: `src/progression.js` imports `STARTING_LOADS` and its
  no-base branch uses `STARTING_LOADS[vid] ?? null` instead of `v.start`. `V` has
  no `start:` anywhere.
- Implications: `test/progression.test.js:35` (`assert.equal(p.load, V.dc.start)`)
  now compares against `undefined` and fails; it must be rewritten to import
  `STARTING_LOADS` and assert against `STARTING_LOADS.dc`. That is a change to the
  suite #2 pinned "before #3-#6 start moving the program data around". The engine
  module now imports personal data.
- Pros: dependency direction is right (engine reads loads from a profile-shaped
  source, which is #6's end state); `V` is purely structural.
- Cons: edits the pinned test; larger conceptual change inside the engine for a
  refactor issue; more to review.

**Option C - Defer the starting-load move to #6**
- What it means: #5 extracts only the start date and the body/nutrition values;
  `start:` stays in `V`.
- Implications: the issue's AC "Changing a starting load propagates to both the
  session view and the Plan table" and "No personal value remains in `App.jsx`"
  are partly unmet (loads are in `program.js`, not `App.jsx`, so the second holds
  narrowly, but the first is not delivered). #6 inherits the work.
- Pros: smallest #5.
- Cons: leaves the epic's clearest personal-data example half-done; #6 is already
  the biggest issue.

**Recommendation. A.** It delivers the issue's propagation requirement, keeps
both test files and the engine untouched, and the only cost - a temporary
`program.js → profile.js` import - is erased by #6's loader. Reversible: if #6's
design wants Option B's direction, moving the read into `planned()` and updating
one test line is a small, well-understood change then.

**Simon's decision.** A (2026-09-07).

---

## Q2 - Cycle length: parameterise or leave hardcoded

**Question.** "12 weeks" appears as `Math.min(12, …)` (`src/App.jsx:149`),
`dayIdx >= 84` (`src/App.jsx:327`), the loop `for (let w = 1; w <= 12; w++)`
(`src/progression.js:34`), and - crucially - as the *phase boundaries* inside
`phaseOf()` (`w === 1` / `w <= 6` / `w === 7` / `w <= 11` / else,
`src/progression.js:23-28`), `setsFor()`'s `w === 7` deload, `blockOf()`'s
`w <= 6`, and the "S12 AMRAP" rule. The issue lists "cycle length" among the
values to group. How much of this does #5 touch?

**Option A - Leave 12 hardcoded as a program constant**
- What it means: `src/profile.js` holds the start date, loads and body/nutrition
  values; the number 12 stays literal in `src/progression.js` and `src/App.jsx`.
- Implications: no change to `phaseOf()`, `setsFor()`, `blockOf()`, `planned()`
  or the loop bounds; `test/progression.test.js` (which drives weeks 1-12 and
  the S7 deload) is unaffected. The issue's "cycle length" bullet is explicitly
  reassigned to #6 in the spec.
- Pros: no regression risk to the engine; honest - the phase logic genuinely
  assumes a 12-week shape and can't be made variable by moving one constant.
- Cons: one item on the issue's list is not delivered by #5.

**Option B - Half-extract: `CYCLE_WEEKS` for the trivial spots only**
- What it means: `src/profile.js` exports `CYCLE_WEEKS = 12`; `src/App.jsx` uses
  it for `Math.min(CYCLE_WEEKS, …)` and `dayIdx >= CYCLE_WEEKS * 7`;
  `src/progression.js`'s phase boundaries stay literal.
- Implications: the app *looks* parameterised but changing `CYCLE_WEEKS` to 10
  would produce a broken cycle (phases still cut at 6/7/11/12, loop still runs to
  12). Anyone who tries it hits subtle bugs.
- Pros: the constant has a named home; two call sites read cleaner.
- Cons: a false affordance - the most dangerous outcome; a reader assumes it
  works.

**Option C - Fully parameterise the cycle length**
- What it means: re-derive every phase boundary, the deload week, the AMRAP week
  and the loop bounds from `CYCLE_WEEKS`.
- Implications: a real transform across `src/progression.js` with matching test
  rework; this is the substance of #6 ("a cycle should be data, not a version of
  the application").
- Pros: the issue's list is fully honoured.
- Cons: scope creep into #6; large diff; regression surface across the engine for
  what is filed as a refactor.

**Recommendation. A.** Leave 12 as a program constant and say so plainly in the
spec. `src/profile.js` covers the values that genuinely have one obvious home.
Parameterising the cycle is #6's job and #6 is where the phase logic gets
reworked to match. Reversible: nothing is done, so nothing to undo.

**Simon's decision.** A (2026-09-07).

---

## Q3 - How far the nutrition figures are parameterised

**Question.** The `src/plan.js` "Nutrition" section (moved there by #4, from
`src/App.jsx:515-520`) contains, in prose: maintenance ≈ 3 150 kcal, the
derivation "Mifflin 1 916 et Katch-McArdle 2 071 → base 2 000 ; × 1,4 ; + ~370",
start 3 400 kcal, "Protéines 185 g, lipides 85 g, glucides 470 g", the branch
values "3 650" / "3 200", adjustment deltas ("−150 à −200 kcal", "+100 à +150"),
a full meal plan in grams, and "Cible : 92,5-93,5 kg fin S12". Which of these go
into `src/profile.js`?

**Option A - Live targets only**
- What it means: `src/profile.js` exports the canonical numbers -
  `maintenanceKcal: 3150`, `startKcal: 3400`, `macros: { p: 185, f: 85, c: 470 }`,
  `targetWeightKg: [92.5, 93.5]`, plus `bodyweightKg`, `heightCm`, `birthdate`.
  The `src/plan.js` nutrition blocks interpolate those four target values; the
  derivation numbers, the "3 650 / 3 200" branch and the meal-plan grams stay as
  literal prose.
- Implications: needs a way for a `src/plan.js` block to carry a value slot -
  e.g. a `{ t: "p", tpl: (p) => \`Départ : ${p.startKcal} kcal…\` }` block
  variant, or render-time token substitution. #4's design already anticipates
  this ("a `{ t: "p", tpl }` block variant"). Each *target* then exists once
  (in `src/profile.js`); "Charges de départ" likewise composes from
  `STARTING_LOADS`.
- Pros: satisfies the issue's intent (values cited, not repeated) for everything
  that actually gets tuned cycle to cycle; keeps the prose readable; bounded
  work.
- Cons: a strict reading of "Each value exists in exactly one place" is not met
  for the derivation and meal-plan numbers - they stay in text.

**Option B - Model the whole nutrition section**
- What it means: every number becomes profile/plan data - derivation inputs,
  deltas, meal plan as structured rows.
- Implications: `src/profile.js` grows a large nutrition sub-tree; `src/plan.js`
  needs list/row block types for the meal plan; the interpolation templates get
  long and brittle.
- Pros: literally every value in one place.
- Cons: heavy for text that rarely changes; the meal plan as data is awkward to
  render back into the current sentence; high effort, low payoff.

**Option C - Only the values that appear more than once**
- What it means: extract start kcal (twice) and the 185 g macro (twice) and the
  six loads and the date; leave single-occurrence numbers in prose.
- Implications: `maintenanceKcal`, `targetWeightKg` etc. stay as literals despite
  being exactly the kind of value the issue names.
- Pros: minimal.
- Cons: contradicts the issue's explicit field list (bodyweight, height,
  maintenance, macros); an odd rule ("in the module iff repeated").

**Recommendation. A.** Put the canonical targets and body metrics in
`src/profile.js`, interpolate those into the nutrition and starting-load prose,
and leave the derivation and meal-plan numbers as text. It honours the issue
where it matters - the values you change when re-baselining - without turning a
paragraph of dietary advice into a data structure. Reversible: extending to more
fields later is additive.

**Simon's decision.** A (2026-09-07).

---

## Q4 - Module name and value shapes

**Question.** Three small shape choices that are cheaper to settle now than to
redo: the file name, the start-date representation, and age vs birthdate.

**Option A - `src/profile.js`, ISO string + helper, `birthdate`**
- What it means: file is `src/profile.js` (English, like `program.js`,
  `progression.js`, `schema.js`); it exports `START_DATE = "2026-09-07"` and
  `startDate()` returning `new Date(2026, 8, 7)` (parsed from parts, local
  midnight); it exports `birthdate: "1987-..."` and no `age`.
- Implications: `src/App.jsx` swaps `const START = new Date(2026, 8, 7)` for
  `import { startDate } from "./profile.js"; const START = startDate();` -
  `weekRange()`, `dayIdx`, `curWeek`, the "commence lundi" line all keep working.
  The ISO-string shape is what #6's JSON profile will carry, so #6 reuses
  `startDate()` unchanged. `birthdate` never goes stale; nothing displays age
  today so nothing needs it computed.
- Pros: consistent with the codebase; #6-ready; the timezone trap
  (`new Date("2026-09-07")` = UTC) is handled once in the helper.
- Cons: `startDate()` is a tiny indirection over what was a one-liner.

**Option B - `src/profil.js`, exported `Date`, `age`**
- What it means: follow the issue's French `profil.js`; export a ready
  `START = new Date(2026, 8, 7)`; store `age: 39`.
- Implications: matches the issue text literally. But `profil.js` breaks the
  English-module convention #2/#3 set; a bare exported `Date` is fine at module
  load but is not the shape #6's file format uses, so #6 adds a conversion; `age`
  must be bumped every birthday / cycle.
- Pros: least indirection now; issue-literal name.
- Cons: naming inconsistency; `age` drifts; #6 has to reconcile the date shape
  anyway.

**Recommendation. A.** `src/profile.js`, `START_DATE` ISO string plus a
`startDate()` local-date helper, `birthdate` not `age`. Same reasoning that kept
`src/program.js` over the issue's `programme.js` in #3, and it lines the module
up with #6's file format. Reversible: renaming a module or swapping a date
representation is a contained change, but doing it once here avoids a churn
commit later.

**Simon's decision.** A (2026-09-07).

---

## How to apply

Once Simon fills in each "Simon's decision", fold the answers into `spec.md`:
resolved points move out of **## Open questions** (which then ends as "None") into
Scope / Acceptance criteria. Q1 Option B → the design adds a
`test/progression.test.js` edit and an engine import, and the spec's "assertions
unmodified" criterion is reworded; Option C → cut the `STARTING_LOADS` work from
Scope and reassign to #6. Q2 Option B/C → Scope gains `CYCLE_WEEKS` and the
design lists the affected files. Q3 Option B → the design needs list/row block
types in `src/plan.js` and a bigger `src/profile.js`. Q4 Option B → the design
uses `src/profil.js` and a bare `Date`. The design (`design.md`) will be written
assuming A / A / A / A; revisit it only if a decision differs.
