# Design - Bundled default: a neutral Upper/Lower program (#26)

## Summary

The idea that makes this work: **`definition: null` stops existing**. Today a
journal entry with no definition is a *reference* to whatever is bundled, which
is why swapping the bundle reinterprets history ([spec.md](spec.md)). After this
change every program entry in a journal carries its definition explicitly, a
v3 -> v4 migration writes it in, and the bundle becomes ordinary content that no
stored data points at. The bundle swap then lands last, when it is already inert
for existing journals.

## Files touched

**New**

- `public/programs/haut-bas-5j.json` - the legacy program (Simon's) as a
  definition file, id `simon-12s-2026-09`, `name` per decision 1. Byte-identical
  content to what the app imports and to what a user can load.
- `public/programs/upper-lower-4j.json` - the neutral bundled program, 4
  sessions, no starting loads, `cardio: null`.
- `src/legacy-program.js` - imports the legacy JSON, exports
  `LEGACY_DEFINITION`. Exists so `schema.js` never imports program data directly
  (it stays a leaf, see its header note).

**Changed**

- `src/schema.js` - `SCHEMA_VERSION` 3 -> 4; `DEFAULT_PROGRAM_ID` renamed
  `LEGACY_PROGRAM_ID` (same value); `emptyJournal(definition)` takes the
  definition; `MIGRATIONS[1]` and `[2]` read `ctx.legacyDefinition` instead of
  `ctx.defaultDefinition`; new `MIGRATIONS[3]`.
- `src/default-program.js` - keeps its exported names, but the values now come
  from the neutral JSON instead of being written inline.
- `src/App.jsx` - `MIGRATION_CTX` gains `legacyDefinition` (l.22);
  `active.definition || DEFAULT_DEFINITION` becomes `active.definition` (l.157);
  `useState(emptyJournal())` becomes `useState(emptyJournal(DEFAULT_DEFINITION))`
  (l.155).
- `src/plan.js` - prose adapted where it names squat / hip thrust / rower / a
  5-session week.
- `src/import.js` - the `parseJournalImport` ctx passthrough, same shape change
  as App.jsx.
- `test/helpers/migration-ctx.js` - `testCtx()` returns `legacyDefinition`.
- `test/progression.test.js`, `test/program.test.js`, `test/registry.test.js`,
  `test/schema.test.js` - fixtures point at `LEGACY_DEFINITION` instead of the
  bundle.

## Approach

**Definition files.** A program file is exactly what `parseProgramImport` already
accepts - `formatVersion`, `id`, `name`, `weeks`, `startDate`, `profile`,
`startingLoads`, `program: { SLOTS, SESSIONS, CORE, WARM, cardio }`. The legacy
file is today's `DEFAULT_DEFINITION` serialised, with `name` set to the catalogue
string. Nothing about the format changes.

`src/default-program.js` keeps every name it exports today (`SLOTS`, `SESSIONS`,
`CORE`, `WARM`, `START_DATE`, `STARTING_LOADS`, `PROFILE`, `DEFAULT_DEFINITION`),
so `profile.js`, `program.js` and their re-export shims stay valid - only the
source of the values moves:

```js
import def from "../public/programs/upper-lower-4j.json";
export const DEFAULT_DEFINITION = def;
export const { SLOTS, SESSIONS, CORE, WARM } = def.program;
export const START_DATE = def.startDate;
export const STARTING_LOADS = def.startingLoads ?? {};
export const PROFILE = def.profile;
```

**Migration.** `ctx` gains one field, and the two existing steps stop naming "the
default":

```js
// MIGRATIONS[1] - a v1 journal is always the legacy program
definition: ctx.legacyDefinition,        // was: null

// MIGRATIONS[2] - unchanged except the fallback it names
const definition = p.definition || ctx.legacyDefinition;   // was: ctx.defaultDefinition

// MIGRATIONS[3] - new: pin anything still unpinned. Idempotent.
3: (v3, ctx) => ({
  ...v3,
  programs: Object.fromEntries(Object.entries(v3.programs).map(([id, p]) =>
    [id, p.definition ? p : { ...p, definition: ctx.legacyDefinition }])),
}),
```

A v1 journal reaches v4 through 1 -> 2 -> 3 and is pinned by step 1; a v2 or v3
journal that still carries `null` is pinned by step 3. Either way the dates in
`migrateLogsV2ToV3` are derived from the legacy program, never from the bundle.

**Fresh install.** `emptyJournal(definition)` keys the journal under
`definition.id` and stores the definition, so a new user lands on
`upper-lower-4j` with nothing implicit.

**Block rotation (decision 5).** Purely data: in the neutral JSON, slots with
`key: true` repeat the same variant id in `b1` and `b2`; accessory slots name two.
No code reads this differently - `blockOf()` already does the right thing.

## Sequencing

*Updated after implementation to describe what actually shipped; the deviations
from the original plan are listed under "As built" below.*

1. `chore(programs): add the legacy program as a definition file (#26)` -
   `795d67e`. The JSON plus `src/legacy-program.js`. Nothing imports it yet.
2. `refactor(schema): name the legacy program in the migration ctx (#26)` -
   `9e26b21`. `LEGACY_PROGRAM_ID`, `ctx.legacyDefinition`, `MIGRATIONS[1]`/`[2]`
   switched over, callers and `testCtx()` updated. **Nothing stored changes.**
3. `feat(schema)!: pin the definition into every journal entry (#26)` -
   `c8956eb`. `SCHEMA_VERSION` 4, `MIGRATIONS[1]` writes the definition,
   `MIGRATIONS[3]` pins the rest, `emptyJournal(definition)`, and the
   `|| DEFAULT_DEFINITION` fallback removed from `App.jsx`. `BREAKING CHANGE:`
   footer. Still no content change.
4. `test(programs): run the fixtures against the legacy definition (#26)` -
   `50abf00`. Six test files stop reading the bundle.
5. `refactor(plan): drive the Plan tab from the definition (#26)` - `2623aea`.
   `buildPlan(definition)`; each program-specific section takes its content from
   the data or disappears. Bundle unchanged, nothing moves on screen.
6. `feat(programs): make the bundled default a neutral Upper/Lower program (#26)`
   - `08277fc`. **The step that flips the default, and by then it cannot touch
   stored history.**

Steps 1-5 are each mergeable on their own. Step 6 must not land before 3, 4 and
5 - that ordering is the whole lesson of the reverted attempt.

## As built - deviations from the plan above

- **`emptyJournal(definition)` moved from step 2 to step 3.** It changes what is
  written to storage, so it belongs with the version bump; leaving it in step 2
  would have let two shapes share `schemaVersion: 3`.
- **Steps 5 and 6 swapped.** `buildPlan` read `profile.maintenanceKcal` and
  `startingLoads.dc` directly, so the bundle swap would have broken the Plan tab
  on arrival. Making the Plan tolerant had to come first, while the bundle still
  carried both.
- **Step 5 grew.** "Adapt the prose" became "drive the Plan from the definition":
  the volume table and the fallback paragraphs moved out of `plan.js` and into
  the definition (`program.volume`, `program.fallback` - additive, the validator
  already accepts unknown keys), and the anchors sentence and starting-loads
  paragraph are now derived from the program and the registry. This is the root
  of the external audit's F4.
- **One guard added to `storage.js`**, not in the plan: an active entry without a
  definition returns the `invalid` verdict. It is the direct consequence of
  removing App.jsx's fallback - without it a hand-edited journal would crash the
  first render instead of being refused.
- **Two dead shims removed**: `src/profile.js` had no importer left, and
  `program.js` re-exported `BASE_V`/`SLOTS`/`SESSIONS`/`CORE`/`WARM` that nothing
  read. Listed below as a follow-up, but deleting them was forced - they
  re-exported values the neutral bundle no longer has.
- **`startingLoads: {}` rather than omitted** in the neutral program:
  `parseProgramImport` still requires the field. Whether a generated program may
  omit it is #27's sibling question.

## Tests

- **Unit, `node --test`** - a new `schema.test.js` case per migration path: v1 ->
  v4, v2 -> v4, v3 -> v4, and idempotence on a v4 object. Each asserts the pinned
  definition is the legacy one and that log dates match what v3 produced.
- **Unit** - `storage.test.js` gains the `prog12_simon_v1_backup_pre3` case.
- **Unit** - `progression.test.js` assertions stay byte-identical; only its
  `buildProgram(...)` argument changes. That it still passes *is* the acceptance
  criterion.
- **Unit** - the neutral program validates: feed the JSON to
  `parseProgramImport`, assert `ok: true` and no squat/deadlift variant id.
- **Manual click-through** - with a copy of Simon's real journal: every tab shows
  what it showed before. Then with storage cleared: the neutral program renders
  across all four tabs, cardio affordance absent.

## Risks & tradeoffs

- **MAJOR / 2.0.0.** Journals are rewritten. The existing pre-migration backup
  (`backupOnce`, `#8`) covers the recovery path and needs no change.
- **The migration is the whole risk.** It runs once, on real data, with no undo
  beyond the backup key. Steps 1-4 exist to get it landed and verified while the
  bundle is still Simon's program - so if it is wrong, the symptom is visible
  immediately rather than masked by a simultaneous content change.
- **Journals get bigger** - each entry now embeds a full definition instead of a
  `null`. Rejected alternative: keep `null` and add a `bundleVersion` field to
  detect drift. That preserves the trap and adds a second thing to keep in sync.
- **Rejected alternative: alias tables.** Mapping old slot ids to new ones was
  tried in the reverted attempt and collapses two sessions onto one date.

## Out of scope / follow-ups

- **F3, confirmed regression** - `App.jsx:125` renders `S{last.week}` but
  `history()` (`progression.js:47`) stopped returning `week` with #16, so the line
  reads "Sundefined". Found by the external audit, verified, unrelated to this
  issue. Needs its own `fix` issue at `priority: high`.
- Renaming the stored id away from `simon-12s-2026-09` (decision 1).
- A conditioning rule for the neutral program (decision 6, option C).
- Removing the `profile.js` / `program.js` re-export shims once nothing imports
  the old names.

## Open questions

None - both were settled during implementation.

1. **Where the definition JSON files live: `public/programs/`.** Verified rather
   than assumed - Node reads them through the import attribute
   (`with { type: "json" }`) and esbuild inlines them when bundling, so the bytes
   the app imports and the bytes a user downloads are the same file.
2. **`registry.test.js` checks every shipped program**, not just the current
   bundle: the describe block loops over the legacy and the default definitions.
