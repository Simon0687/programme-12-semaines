# Design - Sauvegarder le journal avant la première écriture post-migration (#8)

## Summary

A new `src/backup.js` holds three small storage-aware functions; the hydration
effect (`src/App.jsx:167-190`) calls one of them inside the `res.migrated` branch
and *awaits* it before enabling the save. The idea that makes it work: the copy is
the **raw string read from storage**, never a re-serialised object, and the write is
gated on `await` so the debounced save (`:192-204`) cannot start until the copy has
landed or failed. Existence of an earlier backup is discovered by probing a bounded
range of keys rather than by keeping an index.
Spec: [spec.md](spec.md) - decisions: [decisions-spec.md](decisions-spec.md).

## Files touched

| File | Change |
|---|---|
| `src/backup.js` | **New.** `backupKey()`, `backupOnce()`, `listBackups()`. Takes the store as a parameter - no module-level storage access. |
| `src/App.jsx` | Hydration effect (`:167-190`): await `backupOnce()` inside the `res.migrated` branch, before `skipSave.current = false`. New `backups` state, populated on every load via `listBackups()`. Plan "Données" section (`:463-471`): one recovery button per backup found. |
| `CONTRIBUTING.md` | Document the backup key format and the recovery procedure, under the versioning rules. |
| `test/backup.test.js` | **New.** Unit tests against an in-memory fake store. |

`src/schema.js` is **not** touched: it is documented as pure with no I/O
(`src/schema.js:29`) and must stay that way, so the copy lives outside it.

## Approach

### `src/backup.js`

```js
export const backupKey = (key, from) => `${key}_backup_pre${from}`;

// Returns true when the original is protected: either we just wrote the copy,
// or a copy for that version already existed. false only on a failed write.
export async function backupOnce(store, key, from, rawValue) {
  if (!store) return false;
  const k = backupKey(key, from);
  try {
    const existing = await store.get(k, false);
    if (existing && existing.value) return true;   // never overwrite
  } catch (e) { /* absent: the shim throws on a missing key */ }
  try { await store.set(k, rawValue, false); return true; }
  catch (e) { return false; }
}

export async function listBackups(store, key, currentVersion) { /* → [{ from, value }] */ }
```

`rawValue` is `r.value` from the hydration read - the untouched string. Passing
`JSON.stringify(parsed)` instead would silently normalise key order and number
formatting and break the "byte for byte" acceptance criterion.

`store.get` on a missing key **throws** (`src/App.jsx:21`), so the `catch` around the
existence probe is the normal "no backup yet" path, not an error path. The
`existing && existing.value` test also covers a future bridge that returns null
instead.

### Wiring into the hydration effect

Inside `if (res.ok)`, replacing the current `if (res.migrated)` block at
`src/App.jsx:176-179`:

```js
if (res.migrated) {
  const safe = await backupOnce(STORE, KEY, res.from, r.value);
  if (safe) {
    skipSave.current = false;                    // rewrite the migrated shape
    showToast("Journal mis à jour vers le nouveau format.");
  } else {
    setStorageOk(false);                         // decisions Q2: block the save
    showToast("Sauvegarde de sécurité impossible : rien ne sera enregistré cette session.");
  }
}
```

`setState` still runs before this, so the migrated journal is usable in memory even
when the copy failed. Blocking works because the save effect checks `storageOk`
(`:194`) *before* the `skipSave` self-clearing branch (`:195`) - so `storageOk` is
the real guard; leaving `skipSave` true would not be enough on its own.

### Discovering existing backups

A backup written in an earlier session must still be reachable, but the storage
adapter (`src/App.jsx:16-25`) exposes only `get`/`set` - it cannot enumerate keys,
the same constraint that shaped #6's storage decision. Rather than add an index key
to keep in sync, `listBackups()` probes `backupKey(key, n)` for `n` from 1 to
`SCHEMA_VERSION - 1`. That is one read at v2 and stays bounded by a small integer.

### Recovery UI

```js
const [backups, setBackups] = useState([]);   // [{ from, value }]
```

Populated at the end of hydration. In the "Données : sauvegarde et restauration"
`Section`, rendered only when `backups.length > 0`:

```jsx
{backups.map((b) => (
  <Btn key={b.from} small onClick={() => setIoText(b.value)}>
    Afficher la sauvegarde d'avant-migration (v{b.from})
  </Btn>
))}
```

It reuses the existing `ioText` textarea (`:470`) and the existing `copy()` helper,
so nothing new is built to get the data off the phone.

## Sequencing

1. **`chore(storage): copy the journal before a post-migration save (#8)`** -
   `src/backup.js` with `backupKey` / `backupOnce`, the hydration wiring, and
   `test/backup.test.js`. **Safe to merge alone**: the branch is unreachable until a
   migration exists, and no existing behaviour changes.
2. **`feat(plan): show a pre-migration backup for recovery (#8)`** - `listBackups`,
   the `backups` state and the buttons. Safe to merge alone; with no backup present
   it renders nothing.
3. **`docs(storage): document the backup key and recovery (#8)`** - `CONTRIBUTING.md`.

Step 1 is the one #6 depends on.

## Tests

- **Unit, `node --test`, `test/backup.test.js`**, against a fake store built from a
  plain `Map` that throws on a missing key, mirroring the real shim:
  - writes the copy under `<key>_backup_pre1` with the exact input string;
  - a second call with a different value leaves the first copy untouched and still
    returns `true`;
  - returns `false` when `store.set` throws;
  - returns `false` when `store` is `null`;
  - `listBackups` finds nothing on an empty store, and finds the copy after one.
- **Unit, `test/schema.test.js`** - unchanged. `applyChain(data, target, migrations)`
  already accepts an injected chain (`src/schema.js:32`), which is what lets step 1
  be exercised with a fake migration even though `MIGRATIONS` is empty.
- **Manual, during #8** - temporarily raise `SCHEMA_VERSION` to 2 with a throwaway
  `MIGRATIONS[1]` in the working tree (not committed), load a real journal, confirm
  the copy appears and the button shows it, then revert.
- **Manual, during #6** - the real end-to-end run, already written into
  `docs/features/6-load-program-from-file/design.md`.

## Risks & tradeoffs

- **Re-serialising the copy would break fidelity.** The design passes `r.value`
  through untouched for exactly this reason; a reviewer should check that no
  `JSON.stringify` sits on that path.
- **"Never overwrite" has a blind spot.** If a `_backup_pre1` already exists and the
  user later imports a *different* v1 journal which then migrates, the new original
  is not copied - the older backup wins. This is the direct consequence of decisions
  Q1/Q3 Option A and is accepted; the untouched original is the copy worth keeping.
  It also argues for the separate follow-up on backing up before an import.
- **Blocking the save costs a session's entries** if the failure is transient and
  specific to that one write. Accepted in decisions Q2, and consistent with the
  existing `tooNew` behaviour (`src/App.jsx:180-185`).
- **The probe is bounded by `SCHEMA_VERSION`.** One read today. If the schema ever
  reaches a dozen versions this becomes a dozen reads at every launch and should be
  replaced by a pointer key.
- **Storage impact ties back to the spec's level:** the journal's shape is unchanged
  and only a new, separate key appears, which an older build ignores - so no bump of
  its own. Step 2 is a `feat` and rides the batch's minor.
- **The path is dead until #6.** Step 1 can be merged confidently on its unit tests,
  but it will not have caught a real migration until #6 runs. This is stated in the
  spec's Edge cases so it is not mistaken for validated.
- **This design protects only the successful-migration path.** The copy hangs off
  `res.migrated`, so a `migrate()` that *throws* - `schemaVersion: 0`, which
  `versionOf()` accepts (`src/schema.js:23-26`) - bypasses it entirely and the
  journal is destroyed by the path #10 describes. #10 ships first for that reason.
  The two are complements, not overlaps: #10 stops a migration that is *impossible*
  from passing for an absent journal, #8 keeps a copy before a migration that
  *succeeds* but might be wrong. A reviewer should resist the temptation to widen
  `backupOnce` to cover the throw case - without a known source version there is no
  key to write under, which is precisely why #10 fixes it at the root instead.

## Out of scope / follow-ups

- **Backing up before a destructive import** - #11. After #7, `importData`
  (`src/App.jsx:317-323`) still replaces the entire journal from pasted text with no
  copy of what it replaced - #7 fixed the *message*, not the destruction - and unlike
  a migration the user triggers it by hand. It reuses `src/backup.js` and the
  recovery button from this issue.
- **Pruning old backups** once several majors have accumulated.
- **A shared fake-store test helper.** `test/backup.test.js` builds one; #6's design
  notes the same need for the envelope read/write path. Worth extracting when the
  second one appears.

## Open questions

None.
