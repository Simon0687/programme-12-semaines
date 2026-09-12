# Decisions - Bundled default: a neutral Upper/Lower program (#26)

Source: spec.md
Scope: product / requirement choices only. Implementation choices (how the
migration is staged, where `MIGRATION_CTX` gets the legacy definition, how the
test fixture is wired) belong to the design round and will be recorded in
`decisions.md` once `/design-tech 26` has run.
Status: answered 2026-09-12

---

## Q1 - Identity of the pinned legacy program

**Question.** The migration writes the legacy definition into journals that
carry `definition: null`. That definition needs an identity. Today it has one
by accident: `DEFAULT_PROGRAM_ID = "simon-12s-2026-09"` in `src/schema.js`,
used as the key inside `programs` and as `activeProgramId`. Left unanswered,
the app keeps carrying a person's name as a structural constant while claiming
to be generic.

Note that `definition.name` already exists and is already populated -
`parseProgramImport` returns `name: parsed.name ?? parsed.id` (`src/import.js`).
The product has a display name slot; it is simply unused today.

**Option A - keep the stored id, give it a real name**
- What it means: `"simon-12s-2026-09"` stays the key in stored journals; the
  definition gains `name: "Upper/Lower 5 jours - definition musculaire"` (or
  similar), which is what the UI shows.
- Implications: no key rewriting, so the migration touches only the
  `definition` field. The catalogue framing lives in the data, not in the
  schema. `src/default-program.js` is emptied of personal data regardless.
- Pros: zero added risk on the one path that must not lose data. The id is an
  opaque key - users never see it.
- Cons: `git grep simon` still finds the constant; the genericity is real in
  the product but not cosmetic in the code.

**Option B - new id, migration rewrites the key**
- What it means: the program becomes e.g. `"upper-lower-5d"`, and the same
  migration rewrites `activeProgramId` and the `programs` key.
- Implications: the migration now mutates the journal's index, not just a leaf
  field. Any stored reference to the old id (exports on Simon's phone, the
  backup keys) is out of step.
- Pros: nothing named after a person anywhere.
- Cons: a second class of change on the migration that already carries the
  whole issue's risk, for a string nobody sees.

**Recommendation.** **A.** The framing you proposed - this is the first entry of
a pre-built catalogue, an Upper/Lower 5-day with Z2 cardio and mobility, aimed
at conditioning and muscle definition - is the right product move, and it lands
entirely in `name`. The id is plumbing. Reversible: renaming the id later is its
own small migration, and it is already listed as a follow-up in the spec.

**Simon's decision.** **A, with the catalogue framing.** The stored id stays
`simon-12s-2026-09`. The definition carries a `name` presenting it as the first
entry of a pre-built catalogue - an Upper/Lower 5-day with Z2 rowing and
mobility, aimed at conditioning and muscle definition. Proposed string:
`"Haut/Bas 5 jours - definition musculaire et condition"`, adjustable at any
time since it is one field in the JSON.

---

## Q2 - Where the legacy definition lives

**Question.** The legacy definition has three consumers: the migration (so the
app must be able to import it), `test/progression.test.js` as an explicit
fixture, and the user as a loadable example. One artefact should serve all
three. You asked for whatever makes it easiest to edit.

**Option A - a JS module in `src/`**
- What it means: e.g. `src/programs/upper-lower-5d.js` exporting the definition
  object, imported by `MIGRATION_CTX` and by the tests.
- Implications: one import path, works today with no tooling question.
- Pros: simplest to wire; the tests import it directly.
- Cons: it is data wearing a code jacket. Editing it means editing a JS file,
  and the "loadable example" has to be produced separately or serialised.

**Option B - a JSON file as the single source**
- What it means: e.g. `programs/upper-lower-5d.json`, imported by the app
  (`import def from "./x.json" with { type: "json" }`) and offered as the
  loadable example verbatim.
- Implications: Node is v24 here and esbuild bundles JSON natively, so both the
  test runner and the build handle it. The file that ships is byte-identical to
  the file a user loads - which is also the strongest possible test that the
  loader path works.
- Pros: pure data, trivially editable, no duplication between "the bundled
  program" and "the example file". It exercises `parseProgramImport` on real
  content.
- Cons: the repo has no JSON import today (`src/` contains none), so this
  introduces one pattern.

**Recommendation.** **B.** The whole epic's thesis is that the versioned JSON
format is the real product. A program that ships as JSON and loads as JSON
proves that claim on every build, and answers "easy to modify" better than any
JS module. Reversible: converting a JSON file back to a JS export is a
mechanical change.

**Simon's decision.** **B.** Simon had no preference beyond "easy to edit, same
result"; the call is delegated. JSON wins on that criterion and on the stronger
one: the bundled file and the user-loadable example are the same bytes, so every
build exercises the real import path.

---

## Q3 - Cycle length of the neutral program

**Question.** 12 weeks like the legacy program, or shorter for a first contact?

There is effectively one answer. `phaseOf(w)` in `src/progression.js` hardcodes
the shape: week 1 calibration, 2-6 block 1, week 7 deload, 8-11 block 2, week 12
review with the AMRAP flag. An 8-week program would run the same engine and land
its deload at week 7 of 8, then end mid-block. Making the length real is #14
(generic periodisation), which is not in this issue.

**Recommendation.** **12 weeks.** Not a preference - anything else silently
misplaces the deload until #14 lands.

**Simon's decision.** **12 weeks.**

---

## Q4 - Starting loads in the neutral bundle

**Question.** Does the bundled neutral program ship starting loads, or none?

Concretely, `planned()` (`src/progression.js:71-75`) branches on `v.start`: when
a variant has no starting load, the first session shows **"Paliers"** - *50 -> 75
-> 100 % of the guessed load; the first set inside the range at the right RIR
becomes the working load*. When it has one, week 1 shows that number directly.

**Option A - ship none**
- What it means: every slot of the neutral program starts on the Paliers ramp.
- Implications: `buildProgram` already tolerates an absent `startingLoads`
  (`definition.startingLoads || {}`). The bundle carries zero personal data,
  which is the point of the issue.
- Pros: week 1 is a calibration week by design, so the ramp *is* the intended
  first-week behaviour. A newcomer follows the ramp; an experienced lifter
  overwrites it with what they already know.
- Cons: a first screen with no numbers on it at all.

**Option B - a light generic set**
- What it means: invented "typical" loads for a bench, a press, a row.
- Implications: those numbers are wrong for almost everyone and are indexed by
  variant id, so they surface as a confident suggestion on week 1.
- Pros: the first screen shows numbers.
- Cons: a wrong number presented as a plan is worse than no number, and it puts
  fabricated personal data back into the bundle we are trying to empty.

**Recommendation.** **A**, for exactly the reason you gave: week 1 is
calibration. The ramp is not a fallback, it is the feature.

**Simon's decision.** **A - ship none.** Week 1 is a calibration week: a newcomer
follows the Paliers ramp, an experienced lifter already knows what to load. No
fabricated personal data in the bundle.

---

## Q5 - Block rotation (b1/b2) in the neutral program

**What the question actually is.** Each entry of `SLOTS` names two exercises,
not one:

```
dc: { reps: [4, 8], rest: 180, key: true, b1: "dc", b2: "dc_db" }
```

`blockOf(w)` (`src/progression.js`) returns `"b1"` for weeks 1-6 and `"b2"` from
week 7. So this slot is *barbell bench* for the first half of the cycle and
*dumbbell bench* for the second. That is the "block rotation" the method
describes: same slot, same rep range, different exercise after the deload.

The consequence that matters: `planned()` reads history **per variant id**
(`history(prog, state, vid)`). When a slot rotates, the new variant has no
history, so week 7 shows "Paliers" for it and the lifter recalibrates. That is
deliberate in the legacy program - week 7 is literally labelled *"Decharge et
calibration du bloc 2"*. But it means every rotated slot loses its load
reference mid-cycle.

A slot can also decline to rotate: `squat: { b1: "squat", b2: "squat" }` keeps
one exercise for all 12 weeks and progresses continuously.

**Option A - rotate every slot**
- What it means: the neutral program mirrors the legacy one, a different
  variant per slot in each block.
- Implications: at week 7, every exercise changes and every load reference
  resets to the ramp.
- Pros: maximum stimulus variety; faithful to the method as written.
- Cons: for a newcomer, twelve weeks becomes two disconnected six-week blocks.
  The bench press number they earned over six weeks disappears.

**Option B - rotate nothing**
- What it means: `b1` and `b2` name the same exercise in every slot.
- Implications: uninterrupted double progression across 12 weeks; week 7 stays a
  deload but stops being a recalibration.
- Pros: simplest possible read for a first program; one number per exercise that
  goes up.
- Cons: the b1/b2 machinery ships switched off, and the Plan prose about block
  rotation has nothing to point at.

**Option C - rotate the isolations, keep the compounds**
- What it means: the key slots (`key: true` - the ones the Bilan tracks and the
  week-12 AMRAP uses) keep one variant across both blocks; accessory and
  isolation slots rotate.
- Implications: load continuity is preserved exactly where progression is
  measured, and variety lands where losing a load reference costs nothing (a
  lateral raise re-ramps in one set).
- Pros: the method stays visible, the newcomer keeps a progression line on the
  lifts that matter, and the week-12 test compares against a real history.
- Cons: a rule to explain in the Plan text.

**Recommendation.** **C.** Option A's cost is concentrated exactly where the app
is supposed to be good - the key lifts and the week-12 comparison - and option B
throws away a mechanism the app already implements. C is data-only, so it is
reversible by editing the JSON.

**Simon's decision.** **C.** Key slots (`key: true`) name the same variant in
`b1` and `b2` and progress continuously across the 12 weeks; accessory and
isolation slots rotate at week 7. The Plan prose states the rule.

---

## Q6 - Cardio and mobility in the neutral program

**What the question actually is.** Cardio is not data in this codebase, it is a
**named engine rule**. A program file says `cardio: "default"` or `cardio: null`
(#25), and `buildProgram` resolves the name against `src/cardio.js`, which
supplies four things: `cardioPlan(w)` (the Z2 / intervals / mobility text per
week), `CARDIO_ITEMS` (the checklist), `MOB_DAYS`, and `CARDIO_DAY_NOTES`.

The catch is that the bundled rule is written around the legacy 5-session week.
Literally:

```
CARDIO_ITEMS = [{ id: "z2a", label: "Rameur Z2", when: "mercredi, apres Haut B (ou le soir)" }, ...]
MOB_DAYS = ["mardi", "jeudi", "dimanche"]
CARDIO_DAY_NOTES = { 0: ..., 2: ..., 3: ..., 4: ... }
```

Pointing a 4-session Upper/Lower program at `"default"` therefore produces text
naming a session (*Haut B*) that does not exist in it, and day notes landing on
days that no longer match - which directly violates the spec's acceptance
criterion *"no dangling references"*. It also assumes a rowing machine, which is
a piece of equipment, not a method.

**Option A - `cardio: null` for the neutral program**
- What it means: the bundled program is lifting only. `hasCardioContent(prog)`
  returns false and App.jsx hides the whole Cardio/mobility affordance -
  supported since #13, no new code.
- Implications: `src/cardio.js` is untouched and keeps serving the legacy
  program verbatim.
- Pros: zero dangling text, zero equipment assumption, and it keeps this issue -
  already MAJOR with a migration - from growing a second front.
- Cons: a newcomer gets no conditioning guidance from the bundle.

**Option B - point it at `"default"` and generalise that rule**
- What it means: rewrite `cardio.js` so its text names no session and no day.
- Implications: `cardio.js` is shared, so this rewrites the legacy program's
  cardio prose too - the thing the spec says must stay identical for Simon.
- Pros: one rule for everyone.
- Cons: it breaks the "nothing changes for the existing user" acceptance bar.

**Option C - add a second named rule**
- What it means: `cardio.js` gains e.g. a `"conditioning-4d"` rule alongside
  `"default"`; the neutral program references it, the legacy one keeps
  `"default"`.
- Implications: `buildProgram`'s resolution stops being a two-case ternary and
  becomes a lookup - small, contained.
- Pros: both programs get coherent cardio text, nothing shared is disturbed.
- Cons: real content to write (weekly Z2 progression, mobility days) on an issue
  whose hard part is already a migration.

**Recommendation.** **A for this issue, C as the follow-up.** #25 already
decided that cardio-as-data is a follow-up, and #26 carries a schema migration
that deserves undivided attention. Shipping the neutral program lifting-only is
honest - it is a lifting program - and adding a conditioning rule afterwards is
a MINOR change that touches no stored data. If you would rather the first
impression include Z2 and mobility, C is the option to take, and it should be
said now because it changes the content work in the design round.

**Simon's decision.** **A - `cardio: null`.** The neutral program ships as a
lifting program. `src/cardio.js` stays untouched and keeps serving the legacy
program verbatim, so no dangling reference to *Haut B* or to a rowing machine
reaches a newcomer. A conditioning rule for it (option C) becomes a follow-up
issue, MINOR, touching no stored data.

---

## How to apply

Once each "Simon's decision" is filled in, the answers fold back into `spec.md`:
resolved points move out of Open questions into the relevant section (Scope,
User-facing behaviour, or a new "## Decisions" list), and Open questions ends as
"None". Q5 and Q6 in particular change what `/design-tech 26` has to plan for, so
they should be answered before it runs.
