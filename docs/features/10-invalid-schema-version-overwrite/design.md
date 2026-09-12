# Design - Invalid schemaVersion journal is silently overwritten (#10)

Spec: [spec.md](spec.md). Open questions there: none.

## Summary

Extend `migrate()` (`src/schema.js`) to return a typed `{ ok: false, invalid: true }`
verdict instead of throwing when `schemaVersion` is non-positive — the same
shape it already uses for `tooNew`. This is the spec's "Out" note resolved:
hardening happens in `migrate()`, not in `versionOf()` (reason below). The
loading effect in `src/App.jsx` then stops relying on one catch-all try/catch
and distinguishes "no key" (true first use) from "a value is present but
could not be turned into a journal" (invalid verdict, or `JSON.parse`
throwing on corrupt JSON — same treatment, per the spec's Resolved question
2). That second case blocks autosave and shows a new persistent,
tab-independent message. `src/import.js` needs one added line to keep its
existing, already-tested behaviour after `migrate()` stops throwing.

## Files touched

- `src/schema.js` — `migrate()` (lines 50-61): one new branch.
- `src/import.js` — `parseJournalImport()` (lines 45-56): one new branch, so
  its observable contract (tested in `test/import.test.js:22-28`) survives
  `migrate()`'s change unmodified.
- `src/App.jsx`:
  - loading effect (lines 169-192): split into two narrower try/catch blocks.
  - new `loadError` state, next to `importError` (line 166).
  - new JSX line after the sticky header (after line 359) rendering it,
    visible regardless of `tab`.
  - line 364 (`!storageOk` message) gets one added condition so it stops
    double-firing (see Risks).
- `test/schema.test.js` — new test(s) for the `invalid` verdict.
- `test/import.test.js` — no change expected; run as a regression check.

## Approach

**1. `schema.js` — `migrate()` gains an `invalid` verdict:**

```js
export function migrate(data) {
  const from = versionOf(data);
  if (from > SCHEMA_VERSION) return { ok: false, tooNew: true, from, data };
  if (from < 1) return { ok: false, invalid: true, from, data };   // new
  const upgraded = applyChain(data, SCHEMA_VERSION);
  return { ok: true, tooNew: false, from, migrated: from < SCHEMA_VERSION,
           data: { ...upgraded, schemaVersion: SCHEMA_VERSION } };
}
```

`versionOf()` is deliberately left untouched — it keeps its "always returns
an integer" contract, which `applyChain`'s `while (v < target)` loop depends
on. Hardening `versionOf()` itself (making it return `NaN` or throw) would
make that loop either silently no-op or throw from a different, deeper
place — a subtler regression than the bug being fixed. Guarding in
`migrate()`, the one place already responsible for turning failure into a
typed verdict, is the smaller, more local change.

**2. `import.js` — preserve the existing contract:**

```js
let res;
try {
  res = migrate(parsed);
} catch (e) {
  return reject("migration-failed"); // defensive: a genuine MIGRATIONS gap would still throw
}
if (res.invalid) return reject("migration-failed"); // new
if (!res.ok) return reject("too-new");
return { ok: true, data: res.data, migrated: res.migrated };
```

`res.reason` for `schemaVersion: 0` / negative stays `"migration-failed"` —
`test/import.test.js:22-28` needs no change.

**3. `App.jsx` — split the loading effect:**

```js
useEffect(() => {
  (async () => {
    if (!STORE) { setStorageOk(false); setLoaded(true); return; }
    let raw;
    try {
      raw = (await STORE.get(KEY, false)).value;
    } catch (e) {
      setLoaded(true); return; // no key: true first use, unchanged
    }
    if (raw) {
      try {
        const res = migrate(JSON.parse(raw));
        if (res.ok) {
          setState({ logs: res.data.logs || {}, cardio: res.data.cardio || {}, checkin: res.data.checkin || {} });
          if (res.migrated) { skipSave.current = false; showToast("Journal mis à jour vers le nouveau format."); }
        } else if (res.tooNew) {
          setStorageOk(false);
          showToast("Ce journal vient d'une version plus récente de l'appli. Mets l'appli à jour.");
        } else {
          setStorageOk(false);
          setLoadError(LOAD_ERROR_MESSAGE);
        }
      } catch (e) {
        // JSON.parse threw: corrupt JSON, same treatment as res.invalid (spec Resolved Q2)
        setStorageOk(false);
        setLoadError(LOAD_ERROR_MESSAGE);
      }
    }
    setLoaded(true);
  })();
}, []);
```

The two `setStorageOk(false); setLoadError(LOAD_ERROR_MESSAGE);` pairs can be
factored into a one-line local helper; not decided here, it's implementation
detail. `LOAD_ERROR_MESSAGE` is a module-level constant in `App.jsx` (not
`IMPORT_MESSAGES` — this is the load path, a different concern than import),
holding the spec's approved text:

```js
const LOAD_ERROR_MESSAGE = "Le journal enregistré n'a pas pu être mis à jour vers le format actuel. Rien n'a été chargé, rien n'a été écrasé.";
```

**4. The new banner, tab-independent:**

```jsx
{loadError && <p role="alert" className="mx-4 mt-3 text-sm text-amber-400">{loadError}</p>}
```

Placed right after the sticky header closes (after line 359), before any
`{tab === "..." && (...)}` block — so it renders no matter which tab is
active, unlike `importError` (Plan-tab-scoped, line 469) or the existing
`!storageOk` line (Séance-tab-scoped, line 364). No dismiss button: nothing
in this design resolves the underlying state, so there is nothing yet for a
dismiss to mean.

## Sequencing

1. **`fix(schema): make migrate() return a verdict instead of throwing on
   invalid schemaVersion (#10)`** — `src/schema.js`, `src/import.js`,
   `test/schema.test.js`, `test/import.test.js` (unmodified, run as
   regression check). **Safe to merge alone**: even before step 2 touches
   `App.jsx`, this closes the data-loss hole on its own — `App.jsx`'s
   current code funnels any `!res.ok` into the same `setStorageOk(false)`
   branch, so autosave is already blocked for the invalid case the moment
   `migrate()` stops throwing. Only the message shown is temporarily wrong
   (reuses the `tooNew` toast text) until step 2.
2. **`fix(app): distinguish an unreadable journal from a too-new one, with a
   persistent message (#10)`** — `src/App.jsx` only: split the loading
   effect, new `loadError` state and banner, guard on line 364. Completes
   the user-facing behaviour the spec describes.

## Tests

- **`test/schema.test.js`** (unit, `node --test`): `migrate({schemaVersion: 0, ...})`
  and `migrate({schemaVersion: -3, ...})` return `{ ok: false, invalid: true, from }`
  and leave `data` untouched (mirror the existing "n'altère pas son argument"
  test at line 40-43).
- **`test/import.test.js`**: no new test required; re-run as a regression
  check that `reason` for schemaVersion 0/-3 is still `"migration-failed"`.
- **`App.jsx` loading effect**: no automated coverage possible — the project
  has zero jsdom/testing-library setup and `App.jsx` has no existing tests
  (adding that harness is its own undertaking, out of scope here). Manual
  click-through on the dev server or Netlify preview:
  1. In devtools console: `localStorage.setItem('prog12_simon_v1', JSON.stringify({schemaVersion: 0, logs: {w1_hautA: {done: true}}}))`, reload.
  2. Confirm the new banner appears, survives switching tabs, does not
     disappear after a few seconds.
  3. In devtools (Application → Local Storage), confirm the stored value is
     still the original one after a few seconds (no overwrite).
  4. Repeat with corrupt JSON (`localStorage.setItem('prog12_simon_v1', '{not json')`) — same banner.
  5. Regression: clear the key entirely → no message. Load a valid journal →
     unchanged. Set `schemaVersion: 99` → the existing `tooNew` toast, not
     the new banner.

## Risks & tradeoffs

- **Alternative considered:** catch the migration step separately inside
  `App.jsx` only, leaving `schema.js` untouched. Smaller diff, but leaves
  `migrate()` throwing for this case — a footgun for any future caller
  (e.g. #6, if it reuses schema versioning for a loaded program file).
  Rejected: the issue's own notes already flagged that hardening the root
  "benefits the import [path] too," and the fix above shows that benefit is
  achievable for one added line in `import.js`, with its existing test
  suite as proof nothing regresses.
- **Adjacent bug found, left out of scope:** the existing line 364 message
  ("Stockage indisponible ici...") fires on any `!storageOk`, including
  today's `tooNew` case — so on the Séance tab, once the 2.5s `tooNew` toast
  has faded, a user sees a *stockage indisponible* message that's wrong for
  that situation (storage works fine; the app is deliberately refusing to
  load). Not introduced by this change (already true today), only made
  slightly more visible by the `!loadError` guard added alongside it. Same
  family of issue as #7 (a toast fading is the only notice for something
  that deserves to persist) — worth its own small follow-up, not folded in
  here.
- No backward-compatibility impact: journal shape unchanged, matches the
  spec's PATCH level.

## Out of scope / follow-ups

- jsdom/testing-library for `App.jsx` coverage — real gap, bigger than this
  issue.
- The `tooNew` case reusing the misleading line-364 message on the Séance
  tab (see Risks) — candidate for its own small `fix`.
- A recovery/repair affordance for an unreadable journal — #8's territory.

## Open questions

None.
