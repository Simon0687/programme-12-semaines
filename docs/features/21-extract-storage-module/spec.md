# Spec - Extract the storage adapter and the journal load/save path into src/storage.js (#21)

## Context

The whole storage lifecycle currently lives inside `src/App.jsx`: the store adapter
IIFE (`:17-26`), the load effect (`:208-252`, `JSON.parse` → `migrate()` →
`backupOnce()` → three error states), and the debounced save effect (`:254-266`).
None of it is reachable from a unit test because it runs inside `useEffect`. This
already blocks #12's acceptance criterion ("un test couvre ce comportement"), and #11
(backup before import) and #15 (real export, `navigator.storage.persist()`) would each
add more orchestration to the same effect if it stays as is. `backup.js` (#8) already
takes an injected `store` and is fully unit-tested - this issue brings storage/journal
loading to the same convention. Found during the 2026-09-09 code review of `dev`
(`docs/reviews/2026-09-09-code-review.md`, finding F2).
Issue: https://github.com/Simon0687/programme-12-semaines/issues/21

## Scope

- **In:**
  - `src/storage.js` exporting `createStore()`, `loadJournal(store, key)`,
    `saveJournal(store, key, journal)`, store injected exactly like `backup.js`;
  - `loadJournal` internally calls `migrate()` (`schema.js`) and `backupOnce()`
    (`backup.js`) and returns one verdict per situation `App.jsx` already
    distinguishes today (see Data & storage impact);
  - `emptyJournal()` and the envelope builder (`withVersion`) move from `App.jsx` to
    `schema.js`, which becomes the sole owner of the journal shape;
  - `App.jsx`'s load effect shrinks to: call `loadJournal`, switch on the verdict, set
    state (`journal`, `storageOk`, `loadError`, `toast`, `backups`);
  - `App.jsx`'s save effect shrinks to: call `saveJournal`, set `saveStatus`;
  - the fake in-memory store defined in `test/backup.test.js` moves to a shared test
    helper, reused by the new test file;
  - `test/storage.test.js` covering every verdict listed in the issue's acceptance
    criteria;
  - the fix noted as item 5 in the issue: `loadJournal` refuses a journal whose
    `activeProgramId` has no matching entry in `programs` (reason `"invalid"`),
    instead of the current code loading it as-is and crashing on first render. Landed
    as its own commit once the verdict shape exists, per the issue's suggested split.
  - refresh the `schema.js` header comment, which still says the migration chain is
    empty and `migrate()` is a no-op (both are false since #6 added `MIGRATIONS[1]`).
- **Out:**
  - #11 (backup before import) and #15 (real export / `navigator.storage.persist()`)
    - `storage.js` is built to receive that orchestration later, but neither lands
      here;
  - any change to `migrate()` / `applyChain()` / the migration chain itself in
    `schema.js`, beyond relocating `emptyJournal`/`withVersion`;
  - any change to `backup.js`'s public contract (`backupOnce`, `listBackups`) -
    `storage.js` becomes a caller of it, not a replacement;
  - `import.js`'s `parseJournalImport` path (paste-a-journal), which calls `migrate()`
    directly and is untouched;
  - any change to the journal's on-disk shape, field names, or `schemaVersion`
    semantics;
  - any visible copy change, except reusing the existing persistent load-error message
    for the new dangling-`activeProgramId` case (see below).

## User-facing behaviour

This is a refactor: nothing changes for the nominal path on **Seance**, **Semaine**,
**Bilan**, or **Plan**. The one behaviour change is a fix bundled with it:

- **Plan ("Données" section) / first render, any tab:** today, a stored journal whose
  `activeProgramId` doesn't exist in `programs` (a hand-edited or corrupted journal)
  crashes the first render silently. After this issue, it is treated the same as an
  out-of-range `schemaVersion` or corrupt JSON: nothing loads, nothing is overwritten,
  and the existing persistent banner is shown outside any tab:
  > "Le journal enregistré n'a pas pu être mis à jour vers le format actuel. Rien n'a
  > été chargé, rien n'a été écrasé."
- Every other state (empty journal, migrated journal + toast, up-to-date journal,
  too-new journal, corrupt JSON, backup-write failure) keeps its current wording and
  placement, only the code path producing it changes.

## Acceptance criteria

- [ ] Given no `prog12_simon_v1` key in storage, When the app loads, Then
      `loadJournal` returns `{ ok: false, reason: "absent" }` and the app starts from
      `emptyJournal()`.
- [ ] Given a v1 raw journal in storage, When the app loads, Then `loadJournal`
      migrates it, writes the pre-migration backup, saves the migrated form, and
      returns `{ ok: true, journal, migrated: true, backupOk: true }`.
- [ ] Given a v2 (current) journal in storage, When the app loads, Then it loads
      unchanged, no backup key is written, and the verdict is
      `{ ok: true, journal, migrated: false }`.
- [ ] Given a journal whose `schemaVersion` is greater than `SCHEMA_VERSION`, When the
      app loads, Then `loadJournal` returns `{ ok: false, reason: "too-new" }` and the
      store is not written to.
- [ ] Given a journal whose `schemaVersion` is out of range (< 1) or JSON that fails to
      parse, When the app loads, Then `loadJournal` returns
      `{ ok: false, reason: "invalid" }` / `{ ok: false, reason: "corrupt" }`
      respectively, and the store is not written to.
- [ ] Given a journal whose `activeProgramId` has no matching key in `programs`, When
      the app loads, Then `loadJournal` returns `{ ok: false, reason: "invalid" }` and
      the store is not written to.
- [ ] Given a migration that succeeds but the backup write fails, When the app loads,
      Then `loadJournal` returns `{ ok: true, journal, migrated: true, backupOk: false }`
      and the caller (App.jsx) blocks subsequent saves for the session, as it does
      today.
- [ ] `test/storage.test.js` (node --test, fake store) covers every verdict above.
- [ ] `src/App.jsx` no longer contains `JSON.parse`, `migrate(`, `backupOnce(`, or
      `localStorage`.
- [ ] `npm test` passes with every existing assertion unmodified.
- [ ] Manual: export Simon's real journal before this change, load the app after,
      export again - byte-identical JSON. The `_backup_pre<N>` key from #8 is still
      present and unchanged.

## Data & storage impact

No change to the journal's shape or to `schemaVersion` semantics - this is a code
reorganization plus one defensive check. `saveJournal` stamps `schemaVersion` exactly
as today's `withVersion()` does. The verdict shape `loadJournal` returns is new
*internal* API (module boundary), not a storage format:

```
{ ok: true,  journal, migrated: false }
{ ok: true,  journal, migrated: true, backupOk: true | false }
{ ok: false, reason: "absent" }
{ ok: false, reason: "too-new" }
{ ok: false, reason: "invalid" }   // schemaVersion out of range, or dangling activeProgramId
{ ok: false, reason: "corrupt" }   // JSON.parse failed
```

**Level: PATCH.** Per CONTRIBUTING.md's test ("does a journal saved by the previous
version load without loss?") - yes, nothing about the stored format changes. The
dangling-`activeProgramId` check is a fix with no change to *intended* behaviour (that
journal was never valid to begin with; it just crashed instead of failing safely),
which is exactly CONTRIBUTING's PATCH example. No migration required (issue #1's
migration mechanism is irrelevant here).

## Edge cases

- **First use, no key at all** → `reason: "absent"`, app starts from `emptyJournal()`
  (now in `schema.js`).
- **Storage unavailable** (`createStore()` returns `null`, e.g. `localStorage` throws)
  → `loadJournal`/`saveJournal` must handle a `null` store the same way `backup.js`
  already does (returns falsy/empty rather than throwing).
- **v1 → v2 migration, backup already exists** (re-load without ever saving) →
  `backupOnce` already no-ops on an existing key; `loadJournal` still reports
  `migrated: true, backupOk: true`.
- **Dangling `activeProgramId`** (new case, item 5) → treated as `"invalid"`, same
  persistent banner as corrupt JSON / out-of-range `schemaVersion`.
- **Session reopened / week 7 deload / imported JSON** → out of scope: `storage.js`
  only covers the localStorage load/save path, not `import.js`'s paste flow.

## Out of scope / follow-ups

- **#11** (backup before *import*, not migration) and **#15** (real export,
  `navigator.storage.persist()`) both slot into `saveJournal`/a new function in
  `storage.js` later - this issue is what makes that addition testable in isolation.
- Pruning old `_backup_pre<N>` keys - already flagged as a follow-up in #8's spec, still
  unaddressed.

## Open questions

1. Location/name for the shared fake-store test helper extracted from
   `test/backup.test.js` (e.g. `test/helpers/fake-store.js`) - no functional impact,
   left to the implementer unless Simon wants a specific convention. Not blocking:
   design can proceed with a default choice.
