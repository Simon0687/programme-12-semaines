# Design - Version the data schema and handle migrations (#1)

## Summary

Add a plain-JS module `src/schema.js` that owns a single `SCHEMA_VERSION`
constant and a `migrate(data)` function. `migrate()` walks an object from its
stored version up to the current one through a `MIGRATIONS` map indexed by source
version (empty at v1), and returns a result flag rather than throwing so callers
can reject a too-new file cleanly. `src/App.jsx` writes `schemaVersion` on every
save and export, and runs `migrate()` on both the load path and the paste-import
path. Spec: [spec.md](spec.md).

## Files touched

- **`src/schema.js`** *(new)* - `SCHEMA_VERSION = 1`; `versionOf(data)` (absent /
  non-integer -> `1`); `applyChain(data, target, migrations)` (pure, the testable
  core); `MIGRATIONS = {}`; `migrate(data)`.
- **`src/App.jsx`**:
  - import line (top, near line 1-2): `import { SCHEMA_VERSION, migrate } from "./schema.js";`
  - `withVersion()` helper next to the other helpers (~line 454, by `bilanText`).
  - load effect (lines 349-361): parse -> `migrate()` -> set state from
    `res.data`, toast on `res.migrated`, clear `skipSave.current` when
    `res.migrated`, handle `!res.ok` (decision Q1).
  - save effect (lines 363-374): `STORE.set(KEY, JSON.stringify(withVersion(state)), false)`,
    and a `if (!storageOk) return;` guard after the `loaded` check (decision Q1).
  - `importData()` (lines 483-490): after the `parsed.logs` guard, `migrate()` ->
    reject / toast / set state.
  - export buttons (lines 695-696): `JSON.stringify(withVersion(state))`.
- **`package.json`** (line ~11): `"test": "node --test"` in place of the echo stub.
- **`test/schema.test.js`** *(new)* - unit tests for `migrate()` / `applyChain()`.

No data-module or component file beyond `App.jsx` is touched; #3-#5 do that.

## Approach

**`src/schema.js`**

```js
export const SCHEMA_VERSION = 1;

// MIGRATIONS[n] takes a vn object, returns a v(n+1) object.
// Empty at v1. #3 adds MIGRATIONS[1], #4 adds MIGRATIONS[2]... each step is
// independent, adding one never edits another.
export const MIGRATIONS = {};

export function versionOf(data) {
  const v = data && data.schemaVersion;
  return Number.isInteger(v) ? v : 1;            // absent / garbage -> v1
}

// Pure: no I/O, no globals. `migrations` is injectable so tests can prove the
// chain runs without shipping a real step.
export function applyChain(data, target, migrations = MIGRATIONS) {
  let out = data, v = versionOf(data);
  while (v < target) {
    const step = migrations[v];
    if (typeof step !== "function") throw new Error(`Migration manquante depuis la v${v}`);
    out = step(out);
    v += 1;
  }
  return out;
}

// Load / import entry point. Never throws on a too-new file: returns { ok:false }.
export function migrate(data) {
  const from = versionOf(data);
  if (from > SCHEMA_VERSION) return { ok: false, tooNew: true, from, data };
  const upgraded = applyChain(data, SCHEMA_VERSION);
  return {
    ok: true,
    tooNew: false,
    from,
    migrated: from < SCHEMA_VERSION,
    data: { ...upgraded, schemaVersion: SCHEMA_VERSION },
  };
}
```

At v1 the `while` loop never runs, so `migrate()` on a current or unversioned
object returns an equivalent object with `schemaVersion: 1` added and
`migrated: false` - dormant until #3 registers the first step.

**`src/App.jsx`**

```js
const withVersion = (s) => ({
  schemaVersion: SCHEMA_VERSION,
  logs: s.logs, cardio: s.cardio, checkin: s.checkin,   // sibling of the three
});
```

Load effect:

```js
const parsed = JSON.parse(r.value);
const res = migrate(parsed);
if (res.ok) {
  setState({ logs: res.data.logs || {}, cardio: res.data.cardio || {}, checkin: res.data.checkin || {} });
  if (res.migrated) {
    skipSave.current = false;   // Q2: write the upgraded shape back on this load
    showToast("Journal mis à jour vers le nouveau format.");
  }
} else {
  setStorageOk(false);   // Q1: stored journal newer than this build - load nothing, and...
  showToast("Ce fichier a été créé par une version plus récente de l'appli. Mets l'appli à jour, puis réimporte.");
}
```

Save effect - one guard so a stale build cannot overwrite a newer journal
(Q1); harmless today since `storageOk` never flips back to true once false:

```js
if (!loaded) return;
if (!storageOk) return;                 // new
if (skipSave.current) { skipSave.current = false; return; }
```

`importData()` - same `migrate()` call after the existing `if (!parsed.logs)`
guard (so malformed / logs-less JSON still shows "JSON invalide"); on
`!res.ok`, `showToast(...)` the update message and `return` before any
`setState`, leaving the stored journal untouched; otherwise `setState` from
`res.data` and toast `res.migrated ? "Journal mis à jour vers le nouveau format." : "Données importées"`.

Toast strings stay inline, matching the rest of the file. `showToast` (line 406)
is safe to call from the mount effect: effects run after the first render, by
which point the const is assigned.

## Sequencing

1. **`chore(schema): add schema module with SCHEMA_VERSION and migrate() (#1)`** -
   new `src/schema.js`, imported by nothing yet. App behaviour unchanged.
   **Safe to merge alone.**
2. **`test(schema): bring up node --test and cover migrate() (#1)`** - flip the
   `package.json` `test` script to `node --test`, add `test/schema.test.js`.
   `npm test` goes green; nothing else changes. Safe to merge alone.
3. **`chore(storage): persist and export schemaVersion (#1)`** - import
   `SCHEMA_VERSION`, add `withVersion()`, use it in the save effect and the two
   export buttons. Load still tolerates unversioned journals as before. Safe to
   merge alone.
4. **`chore(storage): migrate journals on load and import (#1)`** - wire
   `migrate()` into the load effect and `importData()`, add the migration toast
   and the too-new rejection message. This is the behavioural step; merge after
   its preview is checked on the phone.

Steps are `chore` / `test` per the epic's issue table. No release is tagged at #1
(decision Q3); see Out of scope / follow-ups.

## Tests

- **Unit** - `test/schema.test.js`, Node's built-in runner (`node --test`,
  `node:assert/strict`), no new dependency (local Node is v24):
  - no-op at current version: `migrate({ schemaVersion: 1, logs: { w1_hautA: {} } })`
    -> `res.ok`, `res.migrated === false`, `res.data` deep-equals the input.
  - unversioned -> v1: `migrate({ logs: {} })` -> `res.data.schemaVersion === 1`,
    `res.migrated === false`.
  - too-new rejection flag: `migrate({ schemaVersion: 99, logs: {} })` ->
    `res.ok === false && res.tooNew === true`; input object not mutated.
  - fake 1->2 chain via `applyChain`:
    `applyChain({ schemaVersion: 1, n: 0 }, 2, { 1: d => ({ ...d, schemaVersion: 2, n: d.n + 1 }) })`
    -> `{ schemaVersion: 2, n: 1 }`, proving the loop applies steps in order.
  - `migrate()` does not mutate its argument (freeze the input, expect no throw).
- **Manual click-through** - Plan tab, "Données : sauvegarde et restauration":
  - *Afficher le JSON* -> output contains `"schemaVersion":1` next to `logs`.
  - Paste a pre-change export (no `schemaVersion`) -> imports, only "Données
    importées", journal intact.
  - Paste `{"schemaVersion":99,"logs":{}}` -> rejection toast; switch tab and
    back -> previous data still present.
  - Paste `{}` or broken JSON -> "JSON invalide" as today.
- **Build** - `npm run build` still succeeds (esbuild resolves `./schema.js`).

Setting up the runner is step 2 in Sequencing, per CONTRIBUTING's "tests pass
before push".

## Risks & tradeoffs

- **Storage impact**: one new integer field, `schemaVersion`, as a sibling of
  `logs` / `cardio` / `checkin`; nothing renamed or removed. A v1.0.0 journal has
  no field -> read as v1 -> `migrate()` is a no-op -> loads identically. This is
  the compatible addition the spec rates **MINOR (1.1.0)**; export gains one line.
- **Toast is transient** (`showToast` auto-hides after 2.5 s). A user who misses
  the rejection toast sees "nothing happened". Accepted here; issue #7 adds a
  persistent inline line in the import panel.
- **Migrated journal written back on load** (Q2, decided): the load effect clears
  `skipSave.current` when `res.migrated`, so the upgraded shape is persisted
  immediately rather than waiting for the next edit. Zero effect at v1 (empty
  chain). **Constraint for #3**: the first real migration must ship #8's
  pre-migration backup in the same change, so the immediate write always has a
  recoverable copy behind it.
- **Too-new journal on the *load* path** (Q1, decided): only happens if this
  device's own storage was written by a newer build. Load nothing, set
  `storageOk = false`, show the update toast, and the new `if (!storageOk) return;`
  in the save effect stops any later edit from clobbering the newer journal. The
  reused `storageOk` warnings ("Stockage indisponible ici / Exporte le JSON") are
  slightly generic for this case; tailored wording is left to #7.
- **`window.storage` bridge vs `localStorage`**: both backends go through the
  same mount effect, so `migrate()` runs regardless - no second code path.
- **Rejected alternative**: a dedicated test framework (Vitest). It understands
  JSX but pulls a large dependency tree, and only `migrate()` - plain JS - needs
  covering here. `node --test` is the minimal runner the spec asks for; #2 can
  build its progression-logic suite on the same runner.
- **Rejected alternative**: `migrate()` throwing on a too-new file. The result
  flag (`{ ok:false, tooNew:true }`) keeps the "reject without destroying"
  behaviour in the caller and is directly unit-testable, which the acceptance
  criteria call for.

## Out of scope / follow-ups

- **#6**: adopt the `{ schemaVersion, data: { ... } }` envelope when the stored
  format is reshaped, instead of the bare sibling field.
- **#7**: persistent inline error line for a rejected import.
- **#8**: pre-migration backup copy of the journal under a backup key. Per Q2
  this is a hard prerequisite of #3, not an optional follow-up: it must land in
  or before the first real migration.
- Real per-version migration functions land with #3 / #4 / #5; the v2 shape and a
  mandatory migration with #6.
- Export/import is still clipboard + textarea; real `.json` file download/upload
  could be its own issue.
- The `_v1` suffix in the key `prog12_simon_v1` is now redundant with
  `schemaVersion` - note or rename issue, not here.
- **Release mechanism for `1.1.0`** (Q3, decided): no release is tagged at #1.
  1.1.0 ships with a later coherent batch, per CONTRIBUTING S7; commits here stay
  `chore` / `test`. If a tag is wanted at the #1/#2 boundary, use
  `npm run release:minor`.

## Open questions

None. The three questions raised in the first draft are settled in
[decisions.md](decisions.md) and folded in above:

1. Too-new journal on the load path -> reuse `storageOk = false` + a save-effect
   guard (Q1).
2. Persist a migrated journal on load -> yes, clear `skipSave.current` when
   `res.migrated`; #3 must carry #8's backup (Q2).
3. How 1.1.0 is cut -> no tag at #1, ship with a later batch (Q3).
