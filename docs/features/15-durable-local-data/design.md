# Design - Make local data durable: real export, share sheet, and storage persistence (#15)

## Summary

Two new leaf modules carry the whole feature: `src/file-io.js` gets bytes out of
the app and text back in, `src/export-state.js` remembers when that last
happened. Both take their browser objects and their store **injected**, the way
`storage.js` and `backup.js` already do, so both are testable under
`node --test` with no DOM. `App.jsx` then rewires the Données panel from
clipboard-and-textarea to file-out and file-in, and gains a staleness banner in
the slot `loadError` already occupies.

Spec: [spec.md](spec.md). Decisions: [decisions-spec.md](decisions-spec.md).

## Files touched

| File | Change |
|---|---|
| `src/file-io.js` | **New.** `saveFile()` (share sheet, then download anchor) and `readFile()` (FileReader wrapper). Imports nothing. |
| `src/export-state.js` | **New.** `lastExportKey()`, `readLastExport()`, `writeLastExport()`, `isExportStale()`, `journalHasContent()`. Imports nothing. |
| `src/App.jsx` | Données panel (≈614-634): export, import, backups. `importData` (≈387). New `lastExport` / `persisted` state near the other `useState` (≈198-207). Banner beside `loadError` (≈481). `ioText` / `setIoText` / the `<textarea>` removed. |
| `src/import.js` | `IMPORT_MESSAGES["invalid-json"]` only — the text says "Le texte **collé**", which stops being true. `reason` codes untouched, so tests are unaffected. |
| `test/file-io.test.js` | **New.** |
| `test/export-state.test.js` | **New.** |
| `test/import.test.js` | One added case: export → import round-trip. |
| `CONTRIBUTING.md` | §"Pre-migration backups": recovery is a download, not a textarea. |
| `docs/ARCHITECTURE.md` | §1 dependency table: two new rows, both importing nothing. |

`src/storage.js`, `src/backup.js`, `src/schema.js` and `src/journal-shape.js`
are **not** touched. The journal's shape, its validators and its migrations are
all out of this change.

## Approach

**`src/file-io.js`** — one verdict, never a throw (ARCHITECTURE §2.4):

```js
// env is injected: { nav, doc }. No module-level access to window (§2.7).
export async function saveFile(env, { name, content, type })
//  { ok: true,  via: "share" }        share() resolved
//  { ok: true,  via: "download" }     anchor path taken — unobservable by design (decision 2)
//  { ok: false, reason: "cancelled" } share() rejected AbortError
//  { ok: false, reason: "unsupported" } no doc, no share

export function readFile(file) // -> Promise<string>, rejects on read error
```

Control flow: build the `File` **synchronously**, then if
`nav.canShare?.({ files: [f] })` call `nav.share(...)`; an `AbortError` is a
cancel, any other rejection falls through to the anchor; with no share support
go straight to the anchor (`Blob` → `createObjectURL` → `a.download` → `click`
→ `revokeObjectURL`).

**`src/export-state.js`** — the date and the rule, nothing else:

```js
export const STALE_AFTER_DAYS = 14;
export const lastExportKey = (key) => `${key}_last_export`;   // prog12_simon_v1_last_export

export async function readLastExport(store, key)        // -> "YYYY-MM-DD" | null
export async function writeLastExport(store, key, iso)  // -> boolean
export function isExportStale(iso, todayIso)            // null -> true (never exported)
export function journalHasContent(journal)              // any programs[*].logs entry?
```

`readLastExport` needs the same `try/catch` as `readDroppedBackup`
(`backup.js:40-48`): the store shim throws on a missing key (`storage.js:38`).
Unlike backups it overwrites — it is a moving value, not an insurance copy, so
it does **not** use `writeOnce`.

The banner condition is composed in `App.jsx`, not hidden in the module:
`journalHasContent(journal) && isExportStale(lastExport, todayIso)`. That is
what keeps the reminder quiet on a fresh install.

**`App.jsx`** — the export/import wiring:

- Export: `saveFile(env, { name: "prog12-journal-<YYYY-MM-DD>.json", content: JSON.stringify(withVersion(journal)), type: "application/json" })`, then `writeLastExport` on `ok` — which per decision 2 includes `via: "download"`.
- Import: `<input type="file">` → `readFile` → `parseJournalImport(text, MIGRATION_CTX)`. On `ok`, hold the parsed result in state and render the confirmation; only on confirm write the pre-import backup and call `setJournal`, keeping the `skipSave` / `storageOk` handling already at `App.jsx:390-403`, then `writeLastExport` (decision 4).
- Backups: the two "Afficher …" buttons become `saveFile` calls on the raw strings already loaded into `backups` / `droppedBackup`.
- `persist()`: requested once in the existing mount effect; the panel renders `await navigator.storage.persisted()`. No stored state (decision 6).

`copy()` survives this issue with exactly one caller, the bilan
(`App.jsx:580`). #41 removes it.

## Sequencing

1. `feat(export): write a file through the share sheet or a download (#15)` —
   `src/file-io.js` + `test/file-io.test.js`. No UI. **Safe to merge alone.**
2. `feat(export): record and read the date of the last export (#15)` —
   `src/export-state.js` + `test/export-state.test.js`. No UI. **Safe to merge alone.**
3. `feat(plan): export the journal as a file instead of the clipboard (#15)` —
   "Exporter le JSON" becomes "Télécharger le journal"; records the date; the
   panel shows "Dernier export : …".
4. `feat(plan): download the pre-migration and dropped-session backups (#15)` —
   **before** step 5: these buttons are `setIoText` callers, so removing the
   textarea first would break them.
5. `feat(plan): import a journal from a file, with confirmation and backup (#15)`
   — file picker in; `ioText`, the `<textarea>`, "Afficher le JSON" and
   "Importer le JSON collé" out. Carries `closes #11`.
6. `feat(app): remind after two weeks without an export (#15)` — banner in the
   `loadError` slot.
7. `feat(storage): request persistent storage and show its state (#15)`.
8. `docs: recovery is a download, and two new leaf modules (#15)` —
   `CONTRIBUTING.md` and `docs/ARCHITECTURE.md`. Not optional: step 5 falsifies
   a written recovery procedure.
9. `refactor(plan): read the program file through readFile (#15)` — folds
   `handleProgramFile`'s inline `FileReader` (`App.jsx:428-451`) onto the shared
   helper. Its own commit, per CONTRIBUTING's rule against mixing refactor and
   feature work. Optional.

## Tests

- **Unit, `node --test`.** `file-io`: share resolves → `via: "share"`; share
  rejects `AbortError` → `cancelled`; share rejects otherwise → falls back to
  download; no `canShare` → download; no `doc` → `unsupported`. All with a fake
  `{ nav, doc }`, no DOM.
- **Unit, `node --test`.** `export-state` against `test/helpers/fake-store.js`
  (which already throws on a missing key): absent → `null`; write/read
  round-trip; overwrite; staleness at 13 / 14 / 15 days; `journalHasContent` on
  an empty journal and on one with a log.
- **Integration.** In `test/import.test.js`, one case asserting
  `parseJournalImport(JSON.stringify(withVersion(j)), ctx)` returns a journal
  deep-equal to `j` — the round-trip is an acceptance criterion and is not
  covered today.
- **Manual, on a branch preview** (Netlify, HTTPS): iPhone standalone — share
  sheet, file lands in Files, reminder clears. Desktop Chrome — download path.
  `http://<LAN IP>` — `navigator.share` undefined, download path, reminder still
  clears.

## Risks & tradeoffs

- **The user gesture.** Safari drops `navigator.share` if the call is not
  reached synchronously from the click. Hence building the `File` first and
  awaiting nothing before `share()`. This is the most likely thing to get wrong
  and it only shows up on a real iPhone — step 3 is not "done" until tested
  there.
- **The download path lies by design.** Decision 2 records success on a path
  that cannot confirm it. The mitigation is that the date is rendered, so a
  wrong value is visible; tightening to observable-only is one condition.
- **Removing the textarea removes a documented recovery route.** Step 8 is part
  of the change, not paperwork after it.
- **Storage.** One new sibling key, `prog12_simon_v1_last_export`, additive and
  ignored by older versions. The journal is untouched: **MINOR**, no migration,
  no `SCHEMA_VERSION` bump — as the spec states.
- **Rejected:** putting `saveFile` in `backup.js`. That module is about
  write-once insurance copies; a moving date and a file-out helper are neither,
  and folding them in would blur a module whose whole contract is "never
  overwrite" (`backup.js:50-62`).

## Out of scope / follow-ups

- **This closes #11.** "Sauvegarder le journal avant un import destructif" is
  exactly the backup written in step 5 — the spec made it an acceptance
  criterion, so #11 stops having independent content. The step's commit should
  say so.
- `journalHasContent` reads `programs[*].logs`, which is journal-shape
  knowledge living outside `journal-shape.js`. Tolerable for one predicate;
  worth revisiting if a second one appears.
- `#23` (move display logic out of `App.jsx`) touches the same file and would be
  cheaper merged with this work, but mixing them breaks CONTRIBUTING's
  one-concern rule. Left alone.

## Decisions

Settled 2026-09-13. Implementation choices; the product round is in
`decisions-spec.md`. No `decisions.md` was produced: the four points below were
accepted as recommended, so there was nothing to arbitrate.

1. **`saveFile` takes `{ nav, doc }` injected.** Consistent with ARCHITECTURE
   §2.7 ("the store is injected, never reached for"), and it is what makes the
   five branches testable under `node --test` with no DOM. Cost: one more
   argument at each call site in `App.jsx`.
2. **The import confirmation renders inline in the Données panel**, under the
   picker. No new component, and it matches how the panel already surfaces
   `importError` and the backup buttons.
3. **`IMPORT_MESSAGES["invalid-json"]` becomes "Ce fichier n'est pas du JSON
   valide."** The current wording says "Le texte collé", which stops being true
   once the only route is a file. Tests assert `reason`, not text
   (`import.js:26-40`), so nothing breaks.
4. **`journalHasContent` lives in `export-state.js`**, next to its only caller.
   Revisit if a second journal-shape predicate appears outside
   `journal-shape.js` — noted under Out of scope.

## Open questions

None.
