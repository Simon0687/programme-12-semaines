# Spec - Bundled default: a neutral Upper/Lower program (#26)

## Context

After #25 the app carries its program as data, but the bundled default is still
Simon's personal cycle: his starting loads, 12 weeks / 5 sessions, squat and hip
thrust as anchors, and a Plan-tab prose written around those choices. A newcomer
opens the app inside someone else's program ([#26](https://github.com/Simon0687/programme-12-semaines/issues/26)).

A first attempt (`d60f641`) swapped the bundle content alone and was reverted
(`b775800`, `a6f8437`). It exposed what makes this issue structural rather than
editorial: a stored journal carries `definition: null` (`src/schema.js`,
`MIGRATIONS[1]` and `emptyJournal()`), and `null` is resolved *at read time*
against whatever is bundled (`src/App.jsx:157`, `definition || DEFAULT_DEFINITION`).
Replacing the bundle therefore reinterprets every historical log against a program
that was never performed. This issue must pin the definition before it can change
the bundle.

## Scope

- **In:**
  - a migration that writes the legacy definition into journals that currently
    carry `definition: null`, so history stops depending on the current bundle;
  - Simon's cycle leaves `src/default-program.js` and ships as a loadable example
    definition;
  - the bundle becomes a neutral Upper/Lower 4-day program, no squat, no deadlift;
  - the Plan tab prose is adapted where it names squat / hip thrust / rower / "5
    sessions"; the invariant progression rules stay;
  - `test/progression.test.js` and `test/program.test.js` load Simon's program as
    an explicit fixture instead of relying on the bundle.
- **Out:**
  - first-launch onboarding and the "empty app vs sample" decision (#19);
  - cardio expressed as data rather than a named engine rule (#25 follow-up);
  - generic periodisation, variable deload count (#14);
  - renaming `DEFAULT_PROGRAM_ID` or the `prog12_simon_v1` storage key (follow-up
    below);
  - any change to `progression.js` behaviour - planned loads must stay identical.

## User-facing behaviour

**For an existing user (Simon), nothing changes.** That is the acceptance bar: the
same sessions, same names, same planned loads, same Plan text, same history. The
migration runs once on first load and is invisible.

**For a fresh install**, all four tabs show the neutral program:

- **Seance** - 4 sessions (Upper A, Lower A, Upper B, Lower B) instead of 5.
  The cardio/mobility affordance follows whatever the neutral bundle declares
  (already conditional since #13).
- **Semaine** - the week grid lists 4 sessions; the "done" counter reads `n/4`.
- **Bilan** - the "Exos clés" line lists the neutral program's key slots.
- **Plan** - structure, volume, fallback and starting-loads sections describe the
  Upper/Lower split. No dangling reference to squat, hip thrust, rower Z2 or a
  5-session week.

## Acceptance criteria

- [ ] **Given** a journal stored at `schemaVersion: 3` with `definition: null`,
      **when** the app loads it, **then** the journal is rewritten at the new
      version with the legacy definition written in explicitly, and a
      `prog12_simon_v1_backup_pre3` backup exists.
- [ ] **Given** that migrated journal, **when** Simon opens any week, **then**
      every session name, date and planned load is identical to what the app
      showed before the migration.
- [ ] **Given** a journal whose program already carries a `definition` (a file
      loaded via #6), **when** it migrates, **then** that definition is left
      untouched.
- [ ] **Given** no stored journal, **when** the app starts, **then** it runs the
      neutral Upper/Lower program.
- [ ] **Given** the neutral program, **when** it is validated by
      `parseProgramImport`, **then** it passes against the closed registry (#25),
      and contains no squat and no deadlift variant.
- [ ] **Given** Simon's program loaded as an explicit fixture, **when**
      `test/progression.test.js` runs, **then** its assertions pass unchanged.
- [ ] **Given** the full suite, **when** `npm test` runs, **then** 0 failures.

## Data & storage impact

**MAJOR.** `SCHEMA_VERSION` goes 3 -> 4 and a migration is required.

Per CONTRIBUTING.md the test is *"does a journal saved by the previous version load
without loss?"*. A v3 journal loaded by the new version would silently rebind its
logs to a different program - loss of meaning, not of bytes, but loss. The new step
`MIGRATIONS[3]` replaces `definition: null` with the legacy definition for every
program that has none; `storage.js` writes the usual pre-migration backup under
`prog12_simon_v1_backup_pre3`.

Note the ordering constraint: `MIGRATIONS[1]` writes `definition: null` for a v1
journal, and `MIGRATIONS[2]` already resolves it through `ctx.defaultDefinition`.
Once the bundle is neutral, `ctx.defaultDefinition` is no longer the right answer
for those steps either - they need the legacy definition, not the current bundle.

## Edge cases

- A journal that has never been migrated (v1 or v2) and reaches v4 in one pass -
  every step must use the legacy definition, not the new bundle.
- An export produced before this change, re-imported after it - same path as a
  stored journal, through `parseJournalImport`.
- `definition: null` with an empty `logs` - nothing to preserve, but pinning still
  applies so the cycle does not shift under the user later.
- Storage unavailable or the journal unreadable - existing behaviour (#10) stands:
  nothing loaded, nothing overwritten.

## Out of scope / follow-ups

- `DEFAULT_PROGRAM_ID` is literally `"simon-12s-2026-09"` and is a key inside every
  stored journal. Renaming it is a second migration for no user-visible gain -
  worth its own issue, not this one.
- `src/profile.js` and `src/program.js` still re-export `SLOTS`/`SESSIONS`/`CORE`/
  `WARM`/`STARTING_LOADS` under their pre-#25 names "for one version". Once Simon's
  data leaves the bundle those shims have no remaining caller - removal issue.
- `test/progression.test.js` builds its program with
  `buildProgram({ startingLoads: STARTING_LOADS })`, i.e. through the bundle. The
  fixture change is in scope here; auditing the other suites for the same implicit
  coupling is not.

## Decisions

Settled on 2026-09-12; the reasoning is in `decisions-spec.md`.

1. **The legacy program keeps its stored id** (`simon-12s-2026-09`) and gains a
   `name` presenting it as the first entry of a pre-built catalogue - an
   Upper/Lower 5-day with Z2 rowing and mobility, aimed at conditioning and muscle
   definition. Proposed string: `"Haut/Bas 5 jours - definition musculaire et
   condition"`. Renaming the id stays a follow-up.
2. **Programs ship as JSON.** The legacy definition lives in a `.json` file
   imported by the app and offered verbatim as the loadable example - the bundled
   bytes and the user-loadable bytes are the same, so each build exercises the real
   import path. Node is v24 and esbuild bundles JSON natively.
3. **The neutral program runs 12 weeks.** `phaseOf()` hardcodes week 1
   calibration / week 7 deload / week 12 review; any other length misplaces the
   deload until #14 lands.
4. **The neutral bundle ships no starting loads.** Every slot starts on the
   "Paliers" ramp (`planned()`, `src/progression.js:73`), which is the intended
   week-1 calibration behaviour, and the bundle carries zero personal data.
5. **Partial block rotation.** Key slots (`key: true`) name the same variant in
   `b1` and `b2` and progress continuously across the cycle; accessory and
   isolation slots rotate at week 7. Rationale: `planned()` reads history per
   variant id, so a rotating slot resets to the ramp at week 7 - acceptable on a
   lateral raise, not on the lifts the Bilan tracks and the week-12 AMRAP compares.
6. **The neutral program declares `cardio: null`.** It ships as a lifting program.
   `src/cardio.js` is left untouched and keeps serving the legacy program verbatim,
   so no newcomer meets a reference to *Haut B* or to a rowing machine. A
   conditioning rule for the neutral program is a follow-up (MINOR, no stored data).

## Open questions

None.

The exact exercise list per slot, and which variant fills `b1` and `b2` under
decision 5, is content work for `/design-tech 26` rather than a product choice -
the registry (`src/registry.js`, 63 entries) already holds every candidate.
