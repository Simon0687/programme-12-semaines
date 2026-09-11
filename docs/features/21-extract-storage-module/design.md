# Design - Extract the storage adapter and the journal load/save path into src/storage.js (#21)

Spec: [spec.md](./spec.md)

## Summary

Add `src/storage.js` with three functions - `createStore()`, `loadJournal(store, key)`,
`saveJournal(store, key, journal)` - that together replace the adapter IIFE and the two
`useEffect`s in `src/App.jsx` that currently do all the I/O, `JSON.parse`, `migrate()`
and `backupOnce()` calls inline. `loadJournal` returns one verdict object; `App.jsx`'s
job shrinks to a `switch` on that verdict. `emptyJournal()` and the envelope builder
(renamed `withVersion`) move to `src/schema.js`, which becomes the sole owner of the
journal shape - `storage.js` calls into `schema.js` and `backup.js`, it doesn't
duplicate their logic. The dangling-`activeProgramId` fix (issue item 5) is one more
branch inside `loadJournal`, added last, once the verdict shape exists.

## Files touched

- **`src/storage.js`** (new) - `createStore`, `loadJournal`, `saveJournal`.
- **`src/schema.js`** - add `emptyJournal()` and `withVersion()` (moved from
  `App.jsx:44-51` and `:43`); refresh the header comment (`:1-10`), which still says
  the migration chain is empty and `migrate()` is a no-op - both wrong since #6 added
  `MIGRATIONS[1]`.
- **`src/App.jsx`**:
  - `:17-26` (STORE IIFE) → `const STORE = createStore();`
  - `:37-51` (`withVersion`, `emptyJournal`) → deleted, imported from `schema.js`
    instead
  - `:208-252` (load effect) → calls `loadJournal`, switches on the verdict
  - `:254-266` (save effect) → calls `saveJournal`, maps the result to `saveStatus`
  - imports: drop `migrate` (still needed? no - only `storage.js` calls it now) and
    `backupOnce`; add `createStore`, `loadJournal`, `saveJournal` from `./storage.js`;
    `listBackups` import from `backup.js` is unchanged, App.jsx still calls it
    directly (see Approach).
- **`test/helpers/fake-store.js`** (new) - the `fakeStore()` factory currently defined
  in `test/backup.test.js:9-23`, unchanged.
- **`test/backup.test.js`** - `fakeStore` import replaces the local definition;
  assertions untouched.
- **`test/storage.test.js`** (new) - one `node --test` per verdict.

## Approach

### `createStore()`

Verbatim move of the current IIFE body (`App.jsx:17-26`) into a function App.jsx calls
once at module scope. No behaviour change.

### `loadJournal(store, key)`

```js
export async function loadJournal(store, key) {
  if (!store) return { ok: false, reason: "no-store" };

  let raw = null;
  try { raw = (await store.get(key, false)).value; }
  catch (e) { /* missing key: first use */ }
  if (!raw) return { ok: false, reason: "absent" };

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { return { ok: false, reason: "corrupt" }; }

  const res = migrate(parsed);
  if (res.tooNew) return { ok: false, reason: "too-new" };
  if (!res.ok) return { ok: false, reason: "invalid" };            // schemaVersion out of range

  const { activeProgramId, programs } = res.data;
  if (!programs[activeProgramId]) return { ok: false, reason: "invalid" }; // item 5, step 4 below

  const journal = { activeProgramId, programs };
  if (!res.migrated) return { ok: true, journal, migrated: false };

  const backupOk = await backupOnce(store, key, res.from, raw);
  return { ok: true, journal, migrated: true, backupOk };
}
```

`store.get(key, false)` keeps today's second argument verbatim
(`App.jsx:214`/`:261`). Nothing in this repo defines what it does - `window.storage`
is an external host API, never implemented here - so it is preserved as-is rather than
"cleaned up"; see Risks.

The spec's verdict list (see spec.md, Data & storage impact) doesn't enumerate a
`"no-store"` reason, but its Edge cases section requires `loadJournal`/`saveJournal` to
tolerate a `null` store without throwing, the same way `backup.js` does. `"no-store"`
is the smallest addition that satisfies that: `App.jsx`'s switch treats it exactly like
today's silent `if (!STORE) { setStorageOk(false); ... }` branch (no toast, no
`loadError`).

`listBackups(STORE, KEY, SCHEMA_VERSION)` stays a **direct** call from `App.jsx`
(`:249` today), not folded into `loadJournal`: it runs unconditionally after every load
outcome (including `"absent"` and `"too-new"`) to populate the recovery-button list,
which has nothing to do with the verdict for the *current* journal.

### `saveJournal(store, key, journal)`

```js
export async function saveJournal(store, key, journal) {
  if (!store) return { ok: false, failed: true };
  try {
    const r = await store.set(key, JSON.stringify(withVersion(journal)), false);
    return r ? { ok: true } : { ok: false, failed: false };
  } catch (e) {
    return { ok: false, failed: true };
  }
}
```

The `failed` flag exists to preserve a distinction `App.jsx` already makes and that is
easy to lose in this refactor: today, `store.set` *throwing* (or `STORE` being `null`)
sets `storageOk` to `false` and shows "Non enregistré" (stop trying), while `store.set`
*resolving falsy* shows "Enregistrement échoué" but leaves `storageOk` `true` (retry on
the next change). `App.jsx`'s save effect becomes:

```js
const r = await saveJournal(STORE, KEY, journal);
if (r.ok) setSaveStatus("Enregistré");
else if (r.failed) { setStorageOk(false); setSaveStatus("Non enregistré"); }
else setSaveStatus("Enregistrement échoué");
```

### `schema.js` additions

```js
export const withVersion = (journal) => ({
  schemaVersion: SCHEMA_VERSION,
  activeProgramId: journal.activeProgramId,
  programs: journal.programs,
});

export const emptyJournal = () => ({
  activeProgramId: DEFAULT_PROGRAM_ID,
  programs: { [DEFAULT_PROGRAM_ID]: { definition: null, logs: {}, cardio: {}, checkin: {} } },
});
```

Both are verbatim moves; `DEFAULT_PROGRAM_ID` and `SCHEMA_VERSION` are already declared
in this file.

### App.jsx load effect (replaces `:208-252`)

```js
useEffect(() => {
  (async () => {
    const res = await loadJournal(STORE, KEY);
    if (res.ok) {
      setJournal(res.journal);
      if (res.migrated) {
        if (res.backupOk) {
          skipSave.current = false; // rewrite the migrated shape on this load
          showToast("Journal mis à jour vers le nouveau format.");
        } else {
          setStorageOk(false);
          showToast("Sauvegarde de sécurité impossible : rien ne sera enregistré cette session.");
        }
      }
    } else if (res.reason === "too-new") {
      setStorageOk(false);
      showToast("Ce journal vient d'une version plus récente de l'appli. Mets l'appli à jour.");
    } else if (res.reason === "invalid" || res.reason === "corrupt") {
      setStorageOk(false);
      setLoadError(LOAD_ERROR_MESSAGE);
    } else if (res.reason === "no-store") {
      setStorageOk(false);
    }
    // "absent": nothing to do, the useState(emptyJournal()) initial value stands
    setBackups(await listBackups(STORE, KEY, SCHEMA_VERSION));
    setLoaded(true);
  })();
}, []);
```

Every message and state transition matches today's code path for path; only the
dispatch mechanism (verdict `switch` vs. inline `try/catch`) changes.

## Sequencing

1. `refactor(schema): move emptyJournal and the envelope builder into schema.js (#21)`
   - Add `emptyJournal`/`withVersion` to `schema.js`, refresh its header comment.
     Update `App.jsx` to import them and delete its local copies. No other change.
     Pure move, no behaviour change - **safe to merge alone**.
   - (Reorders the issue's suggested commit list: this must land before the storage
     extraction below, since `saveJournal` needs `withVersion` to already live in
     `schema.js`.)
2. `refactor(storage): extract createStore/loadJournal/saveJournal into storage.js (#21)`
   - Add `src/storage.js` (without the item-5 check yet, so this commit is a pure
     lift-and-shift of current behaviour). Rewire `App.jsx`'s two effects as sketched
     above; drop its now-unused `migrate`/`backupOnce` imports. Satisfies "`App.jsx`
     no longer contains `JSON.parse`, `migrate(`, `backupOnce(`, or `localStorage`."
     Verify with a manual click-through (no automated coverage exists until step 3):
     first load, a v1→v2 migration, a normal save.
3. `test(storage): cover the load/save path (#21)`
   - Move `fakeStore` out of `test/backup.test.js` into `test/helpers/fake-store.js`;
     update `test/backup.test.js`'s import. Add `test/storage.test.js` covering every
     verdict in the spec's Acceptance criteria except the item-5 case. Pure test
     addition - **safe to merge alone**.
4. `fix(storage): refuse a journal whose active program is missing (#21)`
   - Add the `programs[activeProgramId]` check to `loadJournal`, plus one test case
     in `test/storage.test.js`. The one behavioural change in this issue, isolated in
     its own commit per CONTRIBUTING's "no refactoring and feature work in the same
     commit".

## Tests

- **Unit (`node --test`, `test/storage.test.js`)**, using the shared fake store: absent
  key; v1 raw journal migrated with backup written and migrated form returned; v2
  journal returned unchanged with no backup attempted; too-new refused; corrupt JSON
  refused; out-of-range `schemaVersion` refused; backup write failure reported via
  `backupOk: false`; dangling `activeProgramId` refused as `"invalid"` (step 4); `null`
  store returns `"no-store"` without throwing.
- **Regression:** `test/backup.test.js` keeps every existing assertion, only its
  `fakeStore` import changes.
- **Manual click-through** (spec's manual AC): export Simon's real journal, load the
  app, export again - byte-identical JSON; confirm the `_backup_pre<N>` key from #8 is
  untouched.
- `npm test` and `npm run build` must pass before the branch is pushed (CONTRIBUTING).

## Risks & tradeoffs

- **The "Enregistrement échoué" vs "Non enregistré" distinction** is the one subtle
  piece of behaviour this refactor could silently drop - it's not covered by any
  existing test. `saveJournal`'s `{ ok, failed }` shape (see Approach) exists
  specifically to preserve it; the implementer should double check the mapping in
  `App.jsx` against today's `try/catch` before removing the old code.
- **The `store.get(key, false)` / `store.set(key, value, false)` second argument** is
  preserved verbatim rather than investigated or removed - `window.storage` is an
  external host API with no implementation in this repo, so its contract can't be
  verified here. Out of scope for this issue.
- **Adding a `"no-store"` verdict** goes slightly beyond the spec's explicit verdict
  list, but is required by the spec's own edge-case text ("`loadJournal`/`saveJournal`
  must handle a `null` store... rather than throwing"). It changes nothing observable:
  `App.jsx` maps it to exactly today's silent `storageOk = false`.
- **Version impact**: unchanged from the spec - PATCH. No journal field is added,
  renamed or removed; `saveJournal` stamps `schemaVersion` exactly as `withVersion()`
  does today.

## Out of scope / follow-ups

- #11 (backup before import) and #15 (real export / `navigator.storage.persist()`)
  slot into `saveJournal` or a sibling function in `storage.js` later - not here.
- Investigating what `store.get`/`.set`'s trailing `false` argument is for (see Risks)
  - only worth an issue if it ever turns out to matter.
- Pruning old `_backup_pre<N>` keys - already tracked as a follow-up from #8.

## Open questions

None. (The spec's one open question - naming/location of the shared fake-store test
helper - is resolved above as `test/helpers/fake-store.js`, per the spec's note that
this doesn't block design.)
