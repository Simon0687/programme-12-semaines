# Spec - Load a program from a file (#6)

## Context

After #3, #4 and #5 the data lives in its own modules, but those modules are frozen
at import time: `src/program.js:108` folds `STARTING_LOADS` onto `V` at module
evaluation, `src/plan.js:126-138` interpolates `PROFILE` into template literals, and
`src/App.jsx:14` computes `const START = startDate()` at module scope. Starting a new
cycle therefore still means editing code and redeploying. #6 makes a cycle *data*
rather than *a version of the application*: the app loads a program definition
(program + profile) from a JSON file, keeps the bundled default when none is loaded,
and keeps each cycle's journal separate from the others.
Issue: https://github.com/Simon0687/programme-12-semaines/issues/6
Depends on #5 (merged), on **#10** (a stored journal with an unchainable
`schemaVersion` is destroyed at load - widening the version range makes that window
bigger), on #8 (see Q3, the pre-migration backup must exist before the first real
migration runs against a real journal), and on #7 being merged, since #6 grafts onto
the `src/import.js` it introduced.

## Scope

- **In:**
  - a program definition format (`formatVersion`, `id`, `name`, `startDate`,
    `profile`, `startingLoads`, optional `program`) and a validator that rejects a
    malformed file with a specific reason (see Q5);
  - `src/schema.js` moves to `SCHEMA_VERSION = 2` and gains `MIGRATIONS[1]`: the
    journal becomes `{ schemaVersion, activeProgramId, programs: { <id>: { definition,
    logs, cardio, checkin } } }` under the unchanged key `prog12_simon_v1` (see Q1);
  - `src/program.js`, `src/plan.js` and `src/progression.js` become functions of a
    definition rather than modules holding a snapshot;
  - a file picker in the Plan tab, in its own block, plus a way to switch between
    already-loaded cycles;
  - rejection reasons for a program file, reusing the typed-verdict contract #7
    established in `src/import.js` and the persistent error line already rendered in
    the Plan panel (see Q5).
- **Out:**
  - **cycle length as a parameter** - `12` stays a constant. It is woven into
    `phaseOf()`, `setsFor()`, `blockOf()`, the week-12 AMRAP rule
    (`src/App.jsx:94`), the `for (let w = 1; w <= 12; w++)` loop in
    `src/progression.js:34` and `dayIdx >= 84` in `src/App.jsx:329`. The validator
    rejects any definition whose `weeks` is not 12. Follow-up: #9 (see Q2);
  - renaming the storage key - the `_v1` suffix is redundant, but renaming the key
    in the same release that changes its content doubles the failure modes;
  - the journal import/export textarea itself - #7 already replaced its "JSON
    invalide" catch-all with typed reasons and a persistent line;
  - editing a program definition inside the app, deleting a cycle, exporting a
    definition as a file, any cloud sync.

## User-facing behaviour

- **Séance / Semaine / Bilan:** no visible change for an existing user. After the
  upgrade the v1 journal is migrated in place and every logged set, cardio entry and
  check-in appears exactly where it did. Once a second cycle is loaded, these three
  tabs always show the *active* cycle only.
- **Plan:** a new section, "Programme", above the existing "Données : sauvegarde et
  restauration" block. It shows the active program's name and start date, a
  "Charger un programme" file button (`accept="application/json"`), and - as soon as
  two or more cycles exist - a list to switch between them. States:
  - *empty*: only the bundled default exists; the list is not rendered.
  - *rejected*: a persistent red line under the button naming the reason
    ("Champ manquant : startDate", "Ce programme compte 10 semaines, 12 attendues",
    "JSON illisible"). It stays until the next attempt, unlike the 2.5 s toast.
  - *loaded*: a toast confirms, the Plan figures, the Séance loads and the week
    dates all switch to the new cycle.
- Loading a file whose `id` matches a cycle already present **resumes** that cycle.
  It never wipes its journal.

## Acceptance criteria

- [ ] Given a journal written by 1.x (flat `{schemaVersion: 1, logs, cardio,
      checkin}`), When the app loads, Then it is migrated to v2 under the default
      program id, every entry is preserved, and the migrated shape is written back
      once.
- [ ] Given the default cycle with logged sessions, When a program file with a new
      `id` is loaded and sessions are logged in it, Then switching back shows the
      first cycle's entries unchanged - no entry appears in both.
- [ ] Given a program file missing a required field, or with `weeks` != 12, or that
      is not valid JSON, When it is loaded, Then nothing changes in storage and a
      persistent line states the specific reason.
- [ ] Given a loaded program with `startingLoads.squat = 100`, When the Séance tab
      shows "Prévu" for the first squat session, Then it reads 100 kg - and the
      default cycle still reads 105 kg after switching back.
- [ ] Given a definition with no `program` key, When it is loaded, Then the bundled
      exercise catalogue is used with the file's profile and starting loads.
- [ ] Given `test/schema.test.js`, When `npm test` runs, Then the v1 -> v2 migration
      is covered: entry preservation, idempotence, and a v1 journal with missing
      `logs`.
- [ ] `npm test` and `npm run build` both pass.

## Data & storage impact

The journal changes shape. v1 is flat (`{schemaVersion, logs, cardio, checkin}`,
`src/App.jsx:30`); v2 wraps the three data fields per program:

```json
{
  "schemaVersion": 2,
  "activeProgramId": "simon-12s-2026-09",
  "programs": {
    "simon-12s-2026-09": {
      "definition": null,
      "logs": {}, "cardio": {}, "checkin": {}
    }
  }
}
```

`definition: null` means "the program bundled with the app", which keeps
`MIGRATIONS[1]` pure - it never needs to know the bundled data. Cycles loaded from a
file store their full definition here, which is what binds a journal to the program
that produced it.

**Level: MAJOR (2.0.0).** A journal saved by 1.x does not load without a transform,
which is CONTRIBUTING.md's own test for a major. Migration is required and is
`MIGRATIONS[1]` in `src/schema.js`. The `feat(storage)!:` commit carries a
`BREAKING CHANGE:` footer.

## Edge cases

- **`V[vid].start = load` mutates a module singleton** (`src/program.js:108`). With
  two cycles the second would overwrite the first's loads in memory. `buildProgram()`
  must return a deep copy of `V`, never mutate the imported literal.
- **`pullup: 0`.** A real value, not "absent". `src/progression.js:64` distinguishes
  them with `v.start == null`, and `:65` uses `v.start * 0.85` for a first week-7
  session. The fold must keep assigning falsy values.
- **No journal yet.** First launch writes a v2 journal directly; no migration path is
  exercised.
- **Journal from a newer version.** The existing `tooNew` guard
  (`src/schema.js:52`, `src/App.jsx:180-185`) still refuses to load and blocks
  saving. Unchanged.
- **Storage unavailable.** `STORE === null` sets `storageOk` false
  (`src/App.jsx:170`). A program can still be loaded for the session, but nothing
  persists - the existing "Non enregistré" status covers it.
- **A program file pasted into the journal textarea.** It has no `logs` key, so
  `parseJournalImport` returns `not-a-journal` and the panel says "Ce JSON ne contient
  pas de journal (clé « logs » absente)." (`src/import.js:24`). That is already
  correct after #7; the separate file picker just gives the user the right door.
- **`startDate` that is not a Monday.** Week ranges assume weeks start Monday
  (`weekRange()`, `src/App.jsx:34-37`). The validator warns rather than rejects.
- **Week 7 deload and the week-6 block switch.** Read from the built bundle instead
  of the module singleton; behaviour must be identical, and is pinned by
  `test/progression.test.js`.

## Out of scope / follow-ups

- **Configurable cycle length** - #9, split out per Q2. It is the larger half of the
  original "configurable program" ambition and carries the real regression risk.
- **Storage-layer test tooling.** There is no DOM or storage test in the repo, so the
  multi-cycle read/write path is only covered indirectly through the pure migration.
  Injecting a fake storage adapter would let us test it directly.
- **Renaming `prog12_simon_v1`** once 2.0.0 has settled.
- **Exporting the active definition as a file**, so a cycle can be edited outside the
  app and reloaded. Natural once loading exists.

## Open questions

Resolved 2026-09-08 (`decisions-spec.md`):

1. **Journal identity** - one key, envelope with a `programs` map. Not one key per
   program: the storage adapter (`src/App.jsx:16-25`) exposes only `get`/`set`, with
   no way to enumerate keys, so per-program keys would need a separate index kept in
   sync by two non-atomic writes.
2. **Cycle length** - out of scope, `12` stays constant, validator enforces it, a
   follow-up issue #9 is opened. This reverses what #5's spec anticipated.
3. **#8 ordering** - #8 (backup before the first post-migration write) ships first.
4. **File entry point** - a real `<input type="file">` in its own Plan block, not the
   existing paste textarea.
5. **Rejection message** - superseded by #7 having landed. There is nothing to build:
   `src/import.js` already exposes the typed verdict `{ ok, reason, message }` and
   reserves the slot for #6 in its own header ("#6 y ajoutera parseProgramImport(),
   même forme de verdict", `src/import.js:17`), and the persistent `role="alert"`
   line is already rendered (`src/App.jsx:469`). #6 adds `parseProgramImport()`
   beside it and reuses both.
