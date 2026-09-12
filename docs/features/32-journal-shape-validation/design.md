# Design - Journal shape is unvalidated on load and on paste (#32)

## Summary

One new leaf-ish module, `src/journal-shape.js`, becomes the single authority on
what a well-formed journal and a well-formed definition look like. `import.js`
(pasted journal, program file) and `storage.js` (stored journal, and now the
write path) both call it, which is what makes the spec's "the three doors agree"
structural instead of a promise. `validateProgram` moves there unchanged; the
definition checks currently inlined in `parseProgramImport` are lifted into a
reusable `validateDefinition`, leaving normalisation behind in `import.js`.
Spec: [spec.md](spec.md) - decisions: [decisions-spec.md](decisions-spec.md).

## Files touched

| File | Change |
|---|---|
| `src/journal-shape.js` | **New.** `validateProgram` (moved verbatim from `import.js:84-138`), `validateDefinition`, `validateEnvelope`, `isLogRow`, `sanitizeJournal`, `unusableProgramIds`. Imports `registry.js` (`EXERCISE_IDS`) and `definition.js` (`parseLocalDate`, `DEFINITION_FORMAT_VERSION`) only. |
| `src/import.js` | `validateProgram` and the per-field definition checks leave (lines 67-216); `parseProgramImport` keeps `JSON.parse`, the `not-a-program` guard and the normalisation (`name ?? id`, `profile ?? DEFAULT`), delegating the judging to `validateDefinition`. `parseJournalImport` gains the envelope + active-definition checks after `migrate()` and returns `dropped`. |
| `src/storage.js` | `loadJournal` (l. 52-70): envelope check before destructuring, `validateDefinition` on the active program, `sanitizeJournal`, a `_backup_dropped` copy before any rewrite, `dropped` in the verdict. `saveJournal` (l. 73-81): envelope check before `store.set`. |
| `src/program.js` | `buildProgram` (l. 41): fallback resolves to `LEGACY_DEFINITION.program`, not `DEFAULT_DEFINITION.program`. New import from `legacy-program.js` (already bundled - `App.jsx` pulls it for `MIGRATION_CTX`). |
| `src/backup.js` | `droppedBackupKey(key)`; `listBackups` also probes it so the copy is reachable from the Données panel rather than only from devtools. |
| `src/App.jsx` | `LOAD_ERROR_MESSAGE` reworded (l. 31); a toast when `res.dropped > 0`; the cycle selector (l. 575-580) disables entries whose definition does not validate, via a `useMemo` over `journal.programs`. |
| `test/journal-shape.test.js` | **New.** One case per rejection rule, each asserting a verdict and never a throw. |
| `test/fixtures/journals/v1.json` … `v4.json` | **New.** Real journals, one per schema version, as the compatibility floor. |
| `test/storage.test.js`, `test/import.test.js`, `test/program.test.js` | New cases; the two skeletal `{ id: "p1", startDate }` fixtures in `storage.test.js` (l. 44, 57) become real definitions - the expected consequence of decisions-spec Q2. |
| `docs/ARCHITECTURE.md` | §1 dependency table gains `journal-shape`; a new invariant states the journal shape contract and that both doors go through one validator. |

## Approach

### The module

```js
// src/journal-shape.js
export function validateProgram(definition)   // null | { reason, message }  (moved)
export function validateDefinition(def)       // null | { reason, message }
export function validateEnvelope(journal)     // null | { reason }   - fatal only
export function isLogRow(row)                 // boolean
export function sanitizeJournal(journal)      // { journal, dropped }
export function unusableProgramIds(programs)  // string[]
```

`validateDefinition` is exactly what `parseProgramImport` judges today, minus
`JSON.parse` and minus normalisation: `formatVersion`, `id`, `startDate`
(round-trips as a real date), `weeks === 12`, `profile` when present,
`startingLoads` entries in the registry, and `program` via `validateProgram`. So
`parseProgramImport` shrinks to parse → `not-a-program` guard →
`validateDefinition` → normalise, and the stored side gets the identical bar by
calling the same function. **This is the whole point of the design**: the bar
cannot drift between doors because there is only one.

`validateEnvelope` is deliberately narrower - it only rejects what makes the app
unusable, and never judges training content:

```
journal is an object, not an array
programs is a plain object (not null, not an array, not a string)
activeProgramId is a non-empty string and programs[activeProgramId] exists
each program entry is an object carrying definition (object), and
  logs / cardio / checkin are objects when present
```

`isLogRow` accepts `{ date: "AAAA-MM-JJ", slot: non-empty string }` plus optional
`ex` (object), `done` (boolean), `kind`, `id`, `updatedAt`, `deletedAt`. Anything
else is dropped by `sanitizeJournal`, which returns the filtered journal and the
count.

### Load path

```js
const res = migrate(parsed, ctx);          // unchanged
if (res.tooNew) return { ok:false, reason:"too-new" };
if (!res.ok)    return { ok:false, reason:"invalid" };

if (validateEnvelope(res.data))                             return { ok:false, reason:"invalid" };
const active = res.data.programs[res.data.activeProgramId];
if (validateDefinition(active.definition))                  return { ok:false, reason:"invalid" };

const { journal, dropped } = sanitizeJournal(res.data);
if (dropped) await backupOnce(store, droppedBackupKey(key), null, raw);  // verbatim, before any rewrite
…
return { ok:true, journal, migrated, dropped };
```

The envelope check runs **before** the destructuring at `storage.js:56`, which is
where every throw in the spec's table originates. `reason: "invalid"` is reused
rather than adding a verdict, per decisions-spec Q5 - only the App.jsx wording
changes.

### Why dropping rows needs a backup

A dropped row is gone from the in-memory journal, and the autosave effect rewrites
that journal to the store - so filtering without a copy would silently delete
stored data on the next keystroke. The pre-migration backup mechanism (#8) already
exists for exactly this shape of risk; reusing it under `_backup_dropped` keeps the
project's rule that a rejection is never a rewrite. `listBackups` is extended so the
copy shows up as a button in Données instead of being devtools-only.

### Selector

No new state, nothing persisted: `unusableProgramIds(journal.programs)` behind a
`useMemo` keyed on `journal.programs`, and the selector renders those entries
disabled. Adding an `unusable` flag onto the entry itself would be written straight
back into the store by `withVersion`, which is precisely the kind of derived value
the journal must not carry.

## Sequencing

1. `test(storage): pin the journal shapes v1 to v4 actually load (#32)` - fixtures
   + tests, green against today's code. **Safe to merge alone**; it is the gate
   every later step is measured against.
2. `refactor(import): extract shape validation into journal-shape.js (#32)` - pure
   move, no behaviour change, `import.js` delegates. **Safe to merge alone.**
3. `fix(program): resolve a definition without program to the legacy program (#32)`
   - decisions-spec Q1, one line plus a test. **Safe to merge alone.**
4. `fix(storage): reject a malformed journal envelope instead of throwing (#32)` -
   the spinner stops being terminal. **Safe to merge alone**, and the single most
   valuable step.
5. `fix(storage): hold the active definition to the file-import bar (#32)` -
   `validateDefinition` on load; updates the two skeletal test fixtures.
6. `fix(storage): drop unreadable log rows and back up the original (#32)` -
   `sanitizeJournal` + `_backup_dropped` + `dropped` in the verdict.
7. `fix(import): validate a pasted journal through the same checks (#32)` - closes
   the escape-hatch door.
8. `fix(storage): refuse to write a journal that would not load back (#32)` -
   `saveJournal` guard (Q4).
9. `fix(app): reword the load error, report dropped rows, disable unusable cycles (#32)`
   - the only user-visible step.
10. `docs(architecture): record the journal shape contract (#32)` - §1 table and the
    new invariant.

Steps 1-4 are each independently mergeable and already remove the terminal spinner.
Steps 5-8 tighten; 9 surfaces; 10 documents.

## Tests

- **Unit, `node --test`** (the project's only runner - no setup step needed):
  `test/journal-shape.test.js` covers one row per rejection rule from the issue's
  two tables, each asserting a `reason` and never a throw.
- **Unit, `storage.test.js`**: every row of the stored table returns a verdict;
  `saveJournal({})` writes nothing; a journal with one bad row loads the good ones,
  reports `dropped: 1`, and leaves `_backup_dropped` holding the original bytes.
- **Unit, `import.test.js`**: the same malformed definition is rejected identically
  through `parseJournalImport` and `parseProgramImport` - the drift test.
- **Compatibility, step 1**: the v1-v4 fixtures load with their logs intact, and
  stay green through steps 4-8. A failure there is the signal that the level moved
  from PATCH to MAJOR (spec, Data & storage impact).
- **Manual, on the phone, before merging to `dev`**: load the real journal, confirm
  no toast and no behaviour change; paste a truncated export and confirm the panel
  rejects it with a message instead of locking.

## Risks & tradeoffs

- **Over-rejection is the real risk**, not under-rejection. Mitigated by ordering
  (compatibility tests first) and by the fact that a rejected journal now leaves the
  app usable: the Données panel is reachable, so an export can be pasted back.
- **Dropping rows can delete data.** Addressed by the `_backup_dropped` copy; note
  it is written once and never read automatically, like every backup here. Worth
  stating plainly: a malformed row is *not* fatal today (`history()` skips it,
  `findLog` ignores it), so step 6 buys robustness against shapes not yet seen, at
  the cost of a real deletion path. That is why the backup is part of the step and
  not a follow-up.
- **New dependency edge** `storage → journal-shape → definition → default-program`.
  `schema.js` stays a leaf - the invariant ARCHITECTURE.md calls load-bearing is
  untouched, because the validator is a separate module rather than an addition to
  `schema.js`. The alternative (duplicating date parsing to keep `journal-shape` a
  leaf, as `schema.js` does for `dateForSlot`) was rejected: no invariant demands it
  here, and a third copy of date parsing is worse than one more edge.
- **Storage impact**: unchanged from the spec - no shape change, no
  `SCHEMA_VERSION` bump, **PATCH**, shipped inside the 2.0.0 that #26 forces. The
  `_backup_dropped` key is a new *key*, not a new journal field.
- **Alternative rejected**: putting the validator in `schema.js`. It owns the
  journal's shape already, but validating a definition needs `EXERCISE_IDS`, and
  importing `registry.js` there would end `schema.js`'s leaf status - the property
  that keeps migrations free of import cycles.

## Out of scope / follow-ups

- `handleProgramFile` swallowing a throw (`App.jsx:412`) - **#33** owns it, and
  after #33 no throw can reach it anyway.
- Removing the `definition.program` fallback entirely, with a migration that pins a
  program into pre-#25 definitions - noted in the spec, not started.
- The `cardio` / `checkin` payloads are still indexed by cycle week (`weekKey`) and
  unvalidated beyond "is an object"; #29 moves them to dated records and is the
  right place to give them a shape.

## Open questions

**None.** The one design-level question carried over from the spec (where the
validator lives) is answered above: a new `src/journal-shape.js`, so that
`schema.js` keeps its leaf status.
