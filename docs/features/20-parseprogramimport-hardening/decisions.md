# Decisions - parseProgramImport hardening (#20)

Source: GitHub issue #20 (used as the design source - there is no
`docs/features/20-*/design.md`; the issue's **Expected** section already reads
as one, with a concrete input/result table and seven typed rules).
Scope: implementation choices only. No product round applies - #20 is a `fix`
that tightens an existing validator; the closed-registry principle behind
rejecting `program` was settled in the epic
(`epic-configurable-program-roadmap`) and #6's `decisions-spec.md` Q2.
Status: recommendations applied on `fix/20-parseprogramimport-hardening` (Simon
cleared "/decide court puis code"). Each "Simon's decision" below is the
recommendation taken as the working choice; amend and re-run if you disagree -
every one is small and reversible (noted per question).

Context recap. `parseProgramImport()` (`src/import.js:65-100`) today checks the
presence of `id` / `startDate` / `profile`, `weeks === 12`, `profile.macros` and
`profile.targetWeightKg` being an array, a `startDate` regex + `parseLocalDate`
round-trip-ish check, and that every `startingLoads` value is a number.
Everything else passes. `buildPlan()` (`src/plan.js:35`, section `nutrition`)
then reads `profile.maintenanceKcal`, `profile.startKcal`, `profile.macros.p/f/c`
and `profile.targetWeightKg[0..1]` unconditionally - absent, they render
"≈ undefined kcal". `program` is accepted but unusable from a file
(`buildProgram()` expects the bundled catalogue whose `cardioPlan` is a
function, `src/program.js`). `formatVersion` is written by `DEFAULT_DEFINITION`
(`src/definition.js:25`) and never read.

---

## Q1 - Reason-code taxonomy: how many new reasons, and how granular

**Question.** Today `reject("missing-field", ...)` is returned for three
different situations: a truly absent field (`id`), a present-but-wrong value
(`startDate: "pas une date"`, a non-number in `startingLoads`), and a
structurally-absent sub-field (`profile.macros`). Issue #20 asks for `program`
present to be rejected, and for "wrong" to be told apart from "missing" so the
#19 AI repair loop can branch on `reason` without parsing the French sentence.
How many reason codes do we add, and where is the line between them?
Left unanswered, the fix cannot be coded - every `reject()` call site depends on
this.

**Option A - Two new reasons: `unsupported-field` + `invalid-field`**
- What it means: `unsupported-field` for a field the format defines but the app
  cannot execute yet - today only `program`. `invalid-field` for a field that is
  present but the wrong type or unparseable - `startDate`, `startingLoads`
  values, the newly-required numeric `profile.*` fields. `missing-field` narrows
  to strictly absent. `unsupported-weeks` stays as its own code (untouched by
  #20; it is #9/#14's concern).
- Implications:
  - `src/import.js` - three new entries in `IMPORT_MESSAGES`
    (`unsupported-field`, `invalid-field`); the existing
    "aucune raison sans phrase" test then covers them for free.
  - `test/import.test.js` - the two current tests asserting `missing-field` for
    `startDate` and `startingLoads` flip to `invalid-field`; new rows for
    `program`, `formatVersion`, `profile.maintenanceKcal` &c. assert their code.
  - #19 gets a stable 5-value enum to switch on: `invalid-json`, `not-a-program`,
    `missing-field`, `invalid-field`, `unsupported-field` (+ `unsupported-weeks`,
    `too-new`).
- Pros: "regenerate this field, it's the wrong type" and "this field isn't
  supported, drop it" are genuinely different repair instructions; the machine
  can act on each without NLP. Matches the wording already in the issue body.
- Cons: two codes to introduce at once; a reviewer has to learn which is which.

**Option B - One new reason: `invalid-field` only**
- What it means: `program` present is rejected with `invalid-field` too. One new
  code; "not supported" and "wrong type" share it.
- Implications: one `IMPORT_MESSAGES` entry; fewer test edits. #19 cannot tell
  "unsupported, remove it" from "present but malformed, fix it" without reading
  the message.
- Pros: smallest diff; one concept to review.
- Cons: collapses the one distinction #19 will most need - `program` is expected
  to reappear (re-enabled with a shape check in #13), so "unsupported *for now*"
  is a real, temporary category worth naming. Re-splitting later means touching
  every call site and test again.

**Option C - Reason + a `field` name on the verdict**
- What it means: keep `missing-field` / `invalid-field` / `unsupported-field`
  and also return `{ ok: false, reason, field: "profile.startKcal", message }`.
- Implications: the verdict shape grows a key; `parseJournalImport` and
  `migrate()` don't return it, so the shape stops being uniform across the three
  verdict producers (review section 1 calls that uniformity out as a strength).
  #19's loop is not yet built, so we would be designing its input blind.
- Pros: a repair loop could point at the exact field.
- Cons: speculative - #19 has no spec. The message string already names the
  field; adding a structured field is cheap to do later when #19 defines what it
  needs. YAGNI for #20.

**Recommendation.** Option A. It is the taxonomy the issue already describes,
and `unsupported-field` names a category (#13 will empty it) that is worth
keeping distinct from day one. Reversible at moderate cost - collapsing A into B
later is a mechanical find-and-replace across `src/import.js` and
`test/import.test.js`, no stored data involved (PATCH).

**Simon's decision.** Recommended option, taken as working choice pending review.

---

## Q2 - `formatVersion`: where the constant lives, and which reason a too-new file gets

**Question.** The definition format is versioned (`DEFAULT_DEFINITION.formatVersion
= 1`, `src/definition.js:25`) but `parseProgramImport` never reads it. #20 wants
absent or `1` accepted, anything greater rejected. Two sub-choices: (a) where
does the "current format version" number live, and (b) does a too-new file reuse
the journal's `too-new` reason or get its own?
Left unanswered: no way to write the check or its message.

**Option A - New `DEFINITION_FORMAT_VERSION` constant in `definition.js`, reuse `too-new`**
- What it means: `export const DEFINITION_FORMAT_VERSION = 1;` in
  `src/definition.js`, next to `DEFAULT_DEFINITION`, which sets
  `formatVersion: DEFINITION_FORMAT_VERSION` instead of a literal `1`.
  `parseProgramImport` imports it; `parsed.formatVersion == null ||
  parsed.formatVersion <= DEFINITION_FORMAT_VERSION` passes, else
  `reject("too-new")`. The existing `too-new` sentence ("Ce fichier a été créé
  par une version plus récente de l'appli. Mets l'appli à jour, puis réimporte.")
  fits a program file verbatim.
- Implications:
  - `src/definition.js` - one constant, one reference change; no behaviour change
    to `DEFAULT_DEFINITION` (still emits `formatVersion: 1`).
  - `src/import.js` - one new branch; no new `IMPORT_MESSAGES` entry.
  - mirrors `SCHEMA_VERSION` in `src/schema.js:14` ("Déclarée ici et nulle part
    ailleurs") - same pattern, different file, so the two version numbers stay
    independent (a journal-schema bump must not force a definition-format bump).
  - `test/import.test.js` - one row: `formatVersion: 99` -> `reason: "too-new"`.
- Pros: smallest surface; one obvious home for the number; message already
  written and accurate; consistent with how the journal schema does it.
- Cons: `too-new` now means two things (journal too new, definition too new).
  Both are "update the app", so the message holds, but a reader of `reason`
  alone can't tell which file was at fault - mitigated because the two parsers
  are called from different buttons.

**Option B - Dedicated `unsupported-format-version` reason**
- What it means: as A for the constant, but `reject("unsupported-format-version",
  ...)` with its own `IMPORT_MESSAGES` sentence.
- Implications: one extra `IMPORT_MESSAGES` entry and test assertion; #19 can
  distinguish "the definition format moved on" from "the journal is from a newer
  app".
- Pros: precise `reason`; no overloading.
- Cons: a fourth "too new"-shaped code (`too-new`, `unsupported-weeks`,
  `unsupported-field`, this) for a case that, in practice, only happens if a
  future app version ships `formatVersion: 2` and someone feeds that file to an
  old build - rare, and the user action is identical to `too-new`.

**Recommendation.** Option A. The constant belongs in `definition.js` beside the
format it versions, and `too-new` already carries the right instruction. If #19
later proves it needs the distinction, splitting out
`unsupported-format-version` is a one-line change plus one test. PATCH, no stored
data.

**Simon's decision.** Recommended option, taken as working choice pending review.

---

## Q3 - `name` absent: default to `id` (confirm) and where the default is applied

**Question.** A definition with no `name` currently renders `undefined` in the
Programme section and the cycle switcher (`src/App.jsx`). Simon already chose
(Q&A, 2026-09-09): default to `id`, do not reject. This entry records that and
settles the one implementation point left - *where* the default is filled in.
Left unanswered: the fix could put the fallback in the validator, in
`loadProgram()`, or at each render site.

**Option A - `parseProgramImport` normalises: `definition.name ??= definition.id`**
- What it means: on the success path, before `return { ok: true, definition }`,
  set `parsed.name = parsed.name ?? parsed.id`. Callers and the UI always see a
  string.
- Implications:
  - `src/import.js` - one line on the ok path; the returned `definition` is no
    longer byte-identical to the file when `name` was absent. The test
    "définition complète valide => ok, préservée telle quelle" stays green (that
    fixture has a `name`); a new "name absent => defaulted to id" test asserts
    the fill-in.
  - `handleProgramFile` -> `loadProgram(res.definition)` (`src/App.jsx:398-410`)
    stores the normalised definition in `journal.programs[id].definition`, so the
    fallback is persisted once, not recomputed.
  - `DEFAULT_DEFINITION` has a `name`, unaffected.
- Pros: single choke point; every consumer (Programme section, switcher, a
  future export) gets a real string; the value is stable across reloads.
- Cons: the validator now lightly rewrites its input instead of only judging it.
  Small precedent, but worth noting - the other checks are read-only.

**Option B - Resolve at render: `definition.name || definition.id` at each use**
- What it means: leave the file's data untouched; each display site coalesces.
- Implications: `src/App.jsx` - two or more `|| definition.id` (Programme header,
  switcher `<option>`); anyone adding a third display site must remember it. No
  test change in `import.test.js`; the gap moves to the component, which has no
  test harness (review F2).
- Pros: `parseProgramImport` stays a pure judge; file data is preserved verbatim.
- Cons: the "spelled in N places" smell the review flags as F3/F5 for other
  constants; easy to miss one and reship `undefined`.

**Recommendation.** Option A. The validator already coerces nothing and this is
the one exception worth making, because it kills a class of `undefined`-render
bugs at one line. Fully reversible: delete the line and add the `|| id` coalesce
if the "validator stays read-only" principle wins later.

**Simon's decision.** Recommended option, taken as working choice pending review.

---

## Mechanical changes (no decision needed)

These follow directly from the issue once Q1-Q3 are set; listed so the code
review has the full diff in view.

- **`startingLoads` becomes required** (an empty object passes). Today it is
  optional (`if (parsed.startingLoads)`). `buildPlan()`'s "Charges de départ"
  section reads specific keys (`dc`, `squat`, ...) but those are Simon-program
  ids the validator can't know; a present `{}` is the contract.
- **`profile` numeric fields required and type-checked**:
  `profile.maintenanceKcal`, `profile.startKcal`, `profile.macros.p`,
  `profile.macros.f`, `profile.macros.c`, `profile.targetWeightKg[0]`,
  `profile.targetWeightKg[1]` must all be numbers. Absent -> `missing-field`;
  present but not a number -> `invalid-field` (per Q1-A).
- **`startDate` must round-trip**: parse with `parseLocalDate`, format back to
  `YYYY-MM-DD`, compare - rejects `"2027-02-30"` (JS rolls it to 2 March), which
  the current regex + `getTime()` check lets through. Reason: `invalid-field`.
- **`test/import.test.js` `minimalDefinition()` helper** gains
  `maintenanceKcal`, `startKcal` and full `macros` so it stays valid under the
  stricter rules; the "définition minimale valide => ok" test is the guard that
  the helper is still a valid floor.
- **Regression guard**:
  `parseProgramImport(JSON.stringify(DEFAULT_DEFINITION)).ok === true` - a new
  test asserting the app's own definition passes its own validator.
- **Scope fence**: `weeks !== 12` handling is untouched (`unsupported-weeks`
  stays). Relaxing it is #9/#14.

## How to apply

Once Simon fills in each "Simon's decision", fold the answers into the
implementation: this doc is the reference the `fix/20-parseprogramimport-hardening`
commit(s) point back to. No `design.md` to update (the issue was the source); if
any answer diverges from issue #20's Expected list, edit the issue to match
before coding.
