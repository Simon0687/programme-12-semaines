# Design - Persistent error message when a pasted JSON import is rejected (#7)

## Summary

`importData()` (`src/App.jsx:313`) currently wraps parse, shape check and
migration in one `try/catch`, so four distinct failures collapse into one toast
saying "JSON invalide". The design moves that classification into a new pure
module, `src/import.js`, which returns a **typed verdict** instead of throwing;
`src/App.jsx` keeps the verdict's message in state and renders it under the
textarea until the next edit. The one idea that makes it work: the reason and the
sentence are separate values, so the component never inspects strings and the
tests never assert on wording.

Spec: [`spec.md`](spec.md) · Decisions: [`decisions-spec.md`](decisions-spec.md)
(both questions Option A).

## Files touched

| File | Change |
|---|---|
| `src/import.js` | **new** — `parseJournalImport()`, `IMPORT_MESSAGES`. Imports `migrate` from `./schema.js`; imports nothing else. |
| `test/import.test.js` | **new** — one case per reason plus the success case. |
| `src/App.jsx` | `importError` state next to `ioText` (l. 164); `importData()` rewritten (l. 313-325); error line after the textarea (l. 470); error cleared in the textarea `onChange` (l. 470) and in the "Afficher le JSON" handler (l. 467); new import line at the top (l. 1-7). |

Nothing else. `src/schema.js`, `src/progression.js`, `src/plan.js`,
`src/program.js`, `src/profile.js` and the four existing test files are untouched.

## Approach

### `src/import.js`

```js
export const IMPORT_MESSAGES = {
  "invalid-json":     "Le texte collé n'est pas du JSON valide.",
  "not-a-journal":    "Ce JSON ne contient pas de journal (clé « logs » absente).",
  "too-new":          "Ce fichier a été créé par une version plus récente de l'appli. Mets l'appli à jour, puis réimporte.",
  "migration-failed": "Ce journal n'a pas pu être mis à jour vers le format actuel.",
};

// -> { ok: true,  data, migrated }
// -> { ok: false, reason, message }
export function parseJournalImport(text) { … }
```

Control flow, in order — the order is the design, because several inputs match
more than one branch:

1. `JSON.parse(text)` throws → `invalid-json`.
2. `!parsed || typeof parsed !== "object"` → `not-a-journal`. **This guard comes
   before the `logs` check on purpose:** `JSON.parse("null")` returns `null`, and
   reading `.logs` off it throws a `TypeError` that would otherwise be caught as
   `invalid-json` on a perfectly valid document.
3. `!parsed.logs` → `not-a-journal`. Arrays reach here (`typeof [] === "object"`)
   and fall out correctly.
4. `migrate(parsed)` throws → `migration-failed`. `applyChain()`
   (`src/schema.js:37`) raises `Migration manquante depuis la vN`; reachable today
   because `versionOf()` accepts `0` and negatives (see spec Edge cases).
5. `res.ok === false` → `too-new`.
6. otherwise → `{ ok: true, data: res.data, migrated: res.migrated }`.

`reject(reason)` builds `{ ok: false, reason, message: IMPORT_MESSAGES[reason] }`,
so a reason can never ship without a sentence.

### `src/App.jsx`

```js
const [importError, setImportError] = useState("");

const importData = () => {
  const res = parseJournalImport(ioText);
  if (!res.ok) { setImportError(res.message); return; }   // no toast on rejection
  setImportError("");
  setState({ logs: res.data.logs || {}, cardio: res.data.cardio || {}, checkin: res.data.checkin || {} });
  showToast(res.migrated ? "Journal mis à jour vers le nouveau format." : "Données importées");
};
```

The success path is byte-identical to today's, including both toast sentences.

Rendering, straight after the `<textarea>` inside the existing `Section`:

```jsx
{importError && <p role="alert" className="text-sm text-amber-400">{importError}</p>}
```

`text-amber-400` rather than a red: the app has **no red in its palette**, and
`src/App.jsx:366` (`!storageOk` warning) is the existing precedent for an inline
warning paragraph. `role="alert"` so the message is announced, since it appears
without focus moving.

Clearing needs both write paths to `ioText`, not just the keyboard one:

- textarea `onChange` → `setIoText(e.target.value); setImportError("")`
- "Afficher le JSON" `onClick` (l. 467) → same pair. It replaces the textarea
  content, which the spec counts as an edit.

No effect, no `useMemo`: clearing is an event-time concern, and deriving it from
`[ioText]` in a `useEffect` would fire on mount and read as state that fixes
itself.

## Sequencing

1. **`docs(design): spec, arbitrage et design technique du message d'import persistant (#7)`**
   — `spec.md`, `decisions-spec.md`, `design.md`. No code. **Safe to merge alone.**
2. **`feat(import): classify a pasted journal into typed rejection reasons (#7)`**
   — `src/import.js` + `test/import.test.js` together. The module has no consumer
   yet, so the app is unchanged and green; shipping a new module without its tests
   would leave untested code on `dev` between two commits. **Safe to merge alone.**
3. **`feat(plan): keep a rejected import's reason visible in the panel (#7)`**
   — `src/App.jsx` only. This is the step with user-visible behaviour and the one
   that closes the issue.

Each step leaves `npm test` and `npm run build` green. Steps 2 and 3 are both
`feat`, so the release tooling bumps the minor once — matching the spec's MINOR.

## Tests

**Unit — `test/import.test.js`, `node:test` + `node:assert/strict`**, same shape as
`test/schema.test.js`. Assertions target `res.reason`, never `res.message`, so the
deferred wording pass (Q2) cannot break the suite:

| Input | Expected `reason` |
|---|---|
| `"{"`, `""`, `"pas du json"` | `invalid-json` |
| `"null"`, `"5"`, `"[]"`, `'{"a":1}'` | `not-a-journal` |
| `'{"schemaVersion":0,"logs":{}}'` | `migration-failed` |
| `'{"schemaVersion":99,"logs":{}}'` | `too-new` |
| a real export | `ok: true`, `migrated === false`, `data.logs` preserved |

One extra assertion: every key of `IMPORT_MESSAGES` maps to a non-empty string, so
a future reason cannot be added without its sentence.

**Manual click-through** for step 3 (`npm run dev`, Plan tab, "Données" section) —
there is no jsdom or testing-library in the project and adding one is not in this
issue's scope. The six acceptance criteria of the spec are the script; the two that
only a human can check are that the line survives past 2.5 s and that no toast
appears alongside it.

## Risks & tradeoffs

- **`src/App.jsx` stays untested.** Mitigated by making its share trivial: one
  call, one branch, two setters. All judgement lives in the tested module.
- **Two messages change for inputs that already worked.** A valid JSON without
  `logs` used to say "JSON invalide" and now says something else; rejections no
  longer toast. Both are intended and specified — but they are behaviour changes,
  not pure refactoring, which is why steps 2 and 3 are `feat` and not `refactor`.
- **`migration-failed` can mask a developer error.** Once #6 ships `MIGRATIONS[1]`,
  a missing step in the chain will read as "ce journal n'a pas pu être mis à jour"
  rather than surfacing as a crash. That is the right message for the user and a
  quiet one for the developer; the console still shows nothing. Accepted here,
  worth revisiting when #6 lands a real chain.
- **Alternative rejected — keep the logic in `importData()` and only add the
  state.** Smaller diff, but it leaves the four-way classification permanently
  untestable and gives #6 nothing to reuse, which was the reason for taking #7
  before #6.
- **Alternative rejected — put the classifier in `src/schema.js`.** It already owns
  `migrate()`, but it holds no text parsing today, and #6's program import is not
  journal-schema work. A separate module keeps the seam where #6 needs it.
- **Storage:** nothing serialised changes, `SCHEMA_VERSION` untouched, no
  migration. Confirms the spec's **MINOR**.

## Out of scope / follow-ups

- **#10** — the same `migrate()` throw on the *load* path, where the `catch` at
  `src/App.jsx:187` treats an unreadable journal as an absent one and the autosave
  destroys it. Filed, `priority: high`.
- **`parseProgramImport()`** — #6's program-file validation belongs in
  `src/import.js`, reusing `IMPORT_MESSAGES` and the `{ ok, reason, message }`
  shape.
- **Plain-language pass** on the whole "Données" panel, not just these four
  sentences (spec Q2, deferred to public-readiness work).

## Open questions

None. Both spec questions were settled in `decisions-spec.md`; nothing further was
found while designing.
