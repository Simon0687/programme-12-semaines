# Design - Load a program from a file (#6)

## Summary

Three modules currently freeze a snapshot at import time; the whole design follows
from unfreezing them. `src/program.js:108` mutates the shared `V` literal,
`src/plan.js:126-138` interpolates `PROFILE` into template literals, and
`src/App.jsx:14` evaluates `startDate()` at module scope. Each becomes a function of
a *definition* object - `buildProgram(definition)`, `buildPlan(profile,
startingLoads)` - and `src/progression.js` takes that built bundle as its first
argument instead of importing it. On top of that, the journal grows a `programs` map
under the same storage key, migrated by a pure `MIGRATIONS[1]`.
Spec: [spec.md](spec.md) - decisions: [decisions-spec.md](decisions-spec.md).

## Files touched

| File | Change |
|---|---|
| `src/program.js` | Remove the module-level fold (`:108`). Rename the literal to `BASE_V` / keep `SLOTS`, `SESSIONS`, `CORE`, `WARM`, cardio data as-is. Add `buildProgram(definition)` returning a fresh bundle. Drop the `import … from "./profile.js"` (`:59`) - the dependency direction #5 flagged as temporary. |
| `src/progression.js` | `history`, `lastEntry`, `planned` take `prog` as first parameter; remove the `import { V, SLOTS, SESSIONS }` (`:13`). `num`, `fmt`, `roundTo`, `phaseOf`, `blockOf`, `setsFor`, `loadText` unchanged. |
| `src/plan.js` | `PLAN` becomes `buildPlan(profile, startingLoads)`. `PLAN_INTRO` and `PHASE_NOTES` stay plain exports - they cite no profile value. |
| `src/profile.js` | Becomes the *default* profile only; `startDate()` generalised to `parseLocalDate(iso)`. |
| `src/schema.js` | `SCHEMA_VERSION = 2`; add `DEFAULT_PROGRAM_ID` and `MIGRATIONS[1]`. |
| `src/definition.js` | **New.** `DEFAULT_DEFINITION`, `parseLocalDate`. Data and helpers only - the parsing verdict lives in `src/import.js`. |
| `src/import.js` | Add `parseProgramImport(text)` beside `parseJournalImport`, same verdict shape, and extend `IMPORT_MESSAGES` with the program reasons. The slot is already reserved in the module header (`src/import.js:17`). |
| `src/App.jsx` | Journal state holds the envelope; `updateActive()` helper; `weekRange(start, w)` takes the start date; new "Programme" Plan section with the file input, error line and cycle switcher (near `:459-473`). |
| `test/progression.test.js` | Build the default bundle and pass it; assertions unchanged. |
| `test/schema.test.js` | Add v1 → v2 migration cases. |
| `test/definition.test.js` | **New.** Bundle isolation between two definitions. |
| `test/import.test.js` | Extend #7's suite with `parseProgramImport` cases. |
| `test/plan.test.js` | `buildPlan` reflects the profile it is given. |

## Approach

### Definition shape

```js
{
  formatVersion: 1,
  id: "simon-12s-2027-01",
  name: "Cycle hiver 2027",
  weeks: 12,                    // must be 12 (spec Q2)
  startDate: "2027-01-04",      // ISO, local-parsed
  profile: { bodyweightKg, heightCm, birthdate, maintenanceKcal,
             startKcal, macros: { p, f, c }, targetWeightKg: [lo, hi] },
  startingLoads: { dc: 72.5, … },
  program: { … }                // optional; absent => bundled catalogue
}
```

Parsing reuses #7's contract rather than inventing one. `src/import.js` already
returns `{ ok: true, … }` / `{ ok: false, reason, message }` with the sentence held
in a separate `IMPORT_MESSAGES` table, so callers never inspect text and tests assert
on `reason` - a rewording cannot break the suite (`src/import.js:9-15`):

```js
export const IMPORT_MESSAGES = {
  …                                     // #7's journal reasons, untouched
  "invalid-json":     "Le texte collé n'est pas du JSON valide.",   // shared
  "not-a-program":    "Ce fichier ne décrit pas un programme.",
  "missing-field":    "Champ manquant : …",
  "unsupported-weeks":"Ce programme compte N semaines, 12 attendues.",
};

export function parseProgramImport(text) { /* → { ok, definition } | { ok:false, reason, message } */ }
```

It checks required keys, `weeks === 12`, an ISO-parsable `startDate`, and numeric
`startingLoads` values. A non-Monday `startDate` is a warning, not a rejection. The
persistent error line already exists (`src/App.jsx:469`) - the file picker feeds the
same `importError` state, so no new error UI is built.

### Building the bundle

```js
export function buildProgram(definition) {
  const catalogue = definition.program ?? { V: BASE_V, SLOTS, SESSIONS, CORE, WARM, … };
  const V = structuredClone(catalogue.V);          // never mutate the shared literal
  for (const [vid, load] of Object.entries(definition.startingLoads)) {
    if (V[vid]) V[vid].start = load;               // unconditional: pullup 0 is a real value
  }
  return { ...catalogue, V, cardioPlan };
}
```

The `structuredClone` is the load-bearing line. Today `V[vid].start = load` mutates a
module singleton; with two cycles in memory the second would silently overwrite the
first's loads. Node 24 and every target browser have `structuredClone`.

### Threading the bundle through the engine

`src/progression.js` gains `prog` as first parameter:

```js
history(prog, state, vid)
lastEntry(prog, state, vid, week, si)
planned(prog, state, slotId, week, si)
```

Inside, `SLOTS[slotId]` → `prog.SLOTS[slotId]`, `V[vid]` → `prog.V[vid]`,
`SESSIONS.forEach` → `prog.SESSIONS.forEach`. A mutable "current program" module was
rejected: it is a hidden global and would make `node --test` order-dependent.

### Journal state in App.jsx

One source of truth - the envelope itself - with a helper so the eight existing
mutation call sites (`onSet`, `setNotes`, `validate`, `reopen`, `setCardio`,
`setCheck`, …) keep their bodies:

```js
const [journal, setJournal] = useState(emptyJournal());
const active = journal.programs[journal.activeProgramId];
const state = { logs: active.logs, cardio: active.cardio, checkin: active.checkin };

const updateActive = (fn) => setJournal((j) => {
  const id = j.activeProgramId;
  return { ...j, programs: { ...j.programs, [id]: { ...j.programs[id], ...fn(j.programs[id]) } } };
});
```

Each `setState((s) => ({ …s, logs: … }))` becomes `updateActive((s) => ({ logs: … }))`.
The debounced save (`src/App.jsx:196-202`) writes `JSON.stringify(journal)` - the
whole envelope, atomically, which is Q1's tradeoff.

Switching cycles is `setJournal((j) => ({ ...j, activeProgramId: id }))`; the derived
`prog`, `START` and `plan` are `useMemo`s keyed on the active definition, so
everything downstream follows.

### Migration

```js
export const DEFAULT_PROGRAM_ID = "simon-12s-2026-09";

MIGRATIONS[1] = (v1) => ({
  activeProgramId: DEFAULT_PROGRAM_ID,
  programs: {
    [DEFAULT_PROGRAM_ID]: {
      definition: null,                            // null => the bundled default
      logs: v1.logs || {}, cardio: v1.cardio || {}, checkin: v1.checkin || {},
    },
  },
});
```

`migrate()` (`src/schema.js:50-61`) already stamps `schemaVersion`, so the step does
not set it. `definition: null` keeps the step pure - it never imports program data.

## Sequencing

1. **`refactor(program): build the program bundle from a definition (#6)`** - add
   `buildProgram`, remove the module-level fold and the `profile.js` import; update
   `test/progression.test.js` to build the default bundle. **Safe to merge alone**:
   no user-visible change, no storage change.
2. **`refactor(plan): compose the Plan from a profile (#6)`** - `buildPlan(profile,
   startingLoads)`; `src/App.jsx` calls it with the default profile. **Safe to merge
   alone.**
3. **`feat(storage)!: multi-program journal (#6)`** - `SCHEMA_VERSION = 2`,
   `DEFAULT_PROGRAM_ID`, `MIGRATIONS[1]`, the envelope and `updateActive` in
   `src/App.jsx`. Carries the `BREAKING CHANGE:` footer. Requires #8 merged first.
4. **`feat(plan): load a program definition from a file (#6)`** - `src/definition.js`,
   `parseProgramImport()` in `src/import.js`, the file input and the cycle switcher.
   Requires #7 merged.

Steps 1-2 are pure refactors and land first precisely so that step 3's diff contains
only the storage change - CONTRIBUTING.md's "no refactoring and feature work in the
same commit".

## Tests

- **Unit, `node --test`** (the only runner in the repo):
  - `test/import.test.js` - extend #7's suite with `parseProgramImport`: missing
    field, `weeks: 10`, unparsable `startDate`, valid minimal definition with no
    `program`, valid full definition. Assert on `reason`, not on `message`, following
    the convention #7 set.
  - `test/definition.test.js` - the isolation guard: build two bundles from
    definitions with different `startingLoads` and assert neither `V.dc.start` moved.
    This is the regression test for the singleton mutation and the most important
    test in the issue.
  - `test/schema.test.js` - v1 → v2: entries preserved under `DEFAULT_PROGRAM_ID`; a
    v1 journal with no `logs` key; idempotence on an already-v2 object; an
    unversioned journal migrating through the full chain.
  - `test/progression.test.js` - existing assertions unchanged, now passed a built
    bundle. Week-7 deload and the week-6 block switch stay pinned.
  - `test/plan.test.js` - `buildPlan` with a modified profile changes the nutrition
    and starting-load text.
- **Manual click-through** (`npm run dev`, then the Netlify preview on the phone):
  seed a real v1 journal in localStorage, load the app, confirm every entry survives
  and the shape is rewritten once; load a second definition; log a set in it; switch
  back and confirm the first cycle is untouched; load a malformed file and confirm
  the message stays on screen.
- **#8's end-to-end verification happens here, not in #8.** `MIGRATIONS` is empty
  today (`src/schema.js:19`), so #8 ships with unit tests using an injected fake
  migration and its trigger condition never fires in the real app. Step 3 is the
  first migration that actually runs, so the click-through above must also confirm:
  the pre-migration backup key exists with the exact v1 content *before* the v2
  shape is written, relaunching does not overwrite it, and a journal already at v2
  produces no new copy. If these fail, the bug is in #8 even though #6 surfaced it.

There is no DOM or storage test in the repo, so the envelope's read/write path is
covered only manually - see Out of scope.

## Risks & tradeoffs

- **The singleton mutation is the highest-risk item.** If `buildProgram` returns a
  shallow copy, two cycles silently share exercise objects and the second corrupts
  the first's planned loads. Mitigated by `structuredClone` plus the isolation test.
- **Signature change across the engine.** `planned`/`history`/`lastEntry` change
  arity; every call site in `src/App.jsx` and `test/progression.test.js` must move
  together. The compiler will not catch a missed one (plain JS), so step 1 must not
  be merged until `npm test` is green.
- **Every save rewrites every cycle** (~80 KB per completed cycle). Accepted in
  decisions Q1; if it ever matters, splitting into per-program keys is itself a
  schema migration.
- **Backward compatibility.** A v1 journal migrates automatically; a v2 journal
  cannot be read by 1.x, which the existing `tooNew` guard (`src/schema.js:52`)
  handles by refusing to load *and* blocking saves. This is why the spec sets
  **MAJOR / 2.0.0**.
- **#8 is a hard prerequisite** of step 3: it is the first migration to run against
  a real journal.

## Out of scope / follow-ups

- **Configurable cycle length** - #9, opened alongside this spec.
- **Storage-layer test tooling** - injecting a fake `STORE` would let the envelope
  read/write path and the switch logic be tested rather than clicked.
- **Exporting the active definition as a file**, so a cycle can be edited outside the
  app and reloaded.
- **Renaming `prog12_simon_v1`** once 2.0.0 has settled.
- **A shared persistent-error component** once #7 builds one for the journal import.

## Open questions

None. The five product questions were settled in `decisions-spec.md`, and the
implementation choices above (bundle threading by parameter, `structuredClone`,
`updateActive`) are recorded here as design decisions rather than open ones.
