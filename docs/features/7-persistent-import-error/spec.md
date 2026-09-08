# Spec - Persistent error message when a pasted JSON import is rejected (#7)

## Context

The "Données : sauvegarde et restauration" panel (Plan tab) reports every import
outcome through `showToast`, which clears itself after 2.5 s (`src/App.jsx:236`).
For a confirmation that is right; for a **rejection** it is not — look away for
three seconds and a failed import is indistinguishable from "nothing happened",
with no way to recover the reason. #7 makes a rejection leave a message in the
panel until the next attempt.

It also lands ahead of #6, whose criteria already call for "an invalid program
file is rejected with an explicit message" — the same surface. Shipping #7 first
gives #6 something to reuse instead of a second, divergent mechanism.

Issue: https://github.com/Simon0687/programme-12-semaines/issues/7
Depends on #1 (merged): the "too recent" case it must cover comes from `migrate()`.

## Scope

- **In:**
  - a persistent error line in the import panel, shown when `importData()`
    rejects the pasted text;
  - four distinguishable rejection reasons — malformed JSON, valid JSON that is
    not a journal (no `logs`), journal from a newer schema version, and a journal
    whose migration to the current format fails — each with its own message;
  - clearing rules: the line disappears when the textarea content changes or
    when a later import succeeds;
  - extraction of the classification into a pure, tested module (`src/import.js`),
    because `src/App.jsx` has no test coverage and none can be added without new
    dependencies;
  - fixing the current conflation: `!parsed.logs` throws `Error("format")` into
    the same `catch` as `JSON.parse` (`src/App.jsx:316`), so a *valid* JSON
    without `logs` is announced as "JSON invalide".
- **Out:**
  - the load-time "journal from a newer version" toast (`src/App.jsx:184`) — that
    is a load, not an import, and no panel is on screen (default tab `seance`);
  - the success path's toast, which stays as it is;
  - any change to `KEY`, `withVersion()`, the autosave effect, `SCHEMA_VERSION`
    or the journal shape;
  - program-file import and its validation messages (#6);
  - validating a journal's *contents* beyond the presence of `logs` (per-week
    shapes, log entry fields).

## User-facing behaviour

- **Séance / Semaine / Bilan:** no change.
- **Plan — "Données : sauvegarde et restauration":** unchanged in layout. Below
  the textarea, a line appears only after a rejected import:
  - malformed JSON → "Le texte collé n'est pas du JSON valide."
  - valid JSON, no `logs` → "Ce JSON ne contient pas de journal (clé « logs »
    absente)."
  - newer `schemaVersion` → "Ce fichier a été créé par une version plus récente
    de l'appli. Mets l'appli à jour, puis réimporte." (the sentence already in
    use, now persistent)
  - migration failed → "Ce journal n'a pas pu être mis à jour vers le format
    actuel."

  The line stays until the user edits the textarea (typing, or pressing
  "Afficher le JSON") or an import succeeds. A rejected import shows **no
  toast** — the toast keeps its confirmation role. A successful import behaves
  exactly as today: toast, no error line.

  States: no line before the first attempt, none when the panel is opened fresh,
  one line at a time (a second rejection replaces the first).

## Acceptance criteria

- [ ] Given `{` pasted, When "Importer le JSON collé" is clicked, Then the panel
      shows the malformed-JSON line, it persists beyond 2.5 s, and no toast appears.
- [ ] Given `{"a":1}` pasted, When importing, Then the panel shows the
      *not-a-journal* line — not the malformed-JSON one.
- [ ] Given an export whose `schemaVersion` exceeds `SCHEMA_VERSION`, When
      importing, Then the "newer version" line shows and persists, and the
      in-memory journal is untouched.
- [ ] Given a pasted journal with a non-positive `schemaVersion` (e.g. `0`), When
      importing, Then the *migration-failed* line shows — not the malformed-JSON
      one — and the in-memory journal is untouched.
- [ ] Given an error line is showing, When the user types in the textarea, Then
      it disappears.
- [ ] Given an error line is showing, When "Afficher le JSON" replaces the
      textarea content, Then it disappears.
- [ ] Given a valid exported journal, When importing, Then the existing toast
      appears, no error line is shown, and the Séance tab reflects the imported logs.
- [ ] Given `npm test`, Then a new `test/import.test.js` covers one case per
      reason plus the success case, and the four existing suites pass **with
      assertions unmodified**.
- [ ] Given `npm run build`, Then it succeeds (esbuild resolves `./import.js`).

## Data & storage impact

None. No field added, renamed or removed; `SCHEMA_VERSION` untouched; a journal
saved by 1.x loads without loss. The change is UI state plus a new pure module.

**Level: MINOR** per CONTRIBUTING.md — "compatible addition, existing journal
intact". No migration.

## Edge cases

- **`JSON.parse("null")` / `JSON.parse("5")`** — parse succeeds, then
  `parsed.logs` throws a `TypeError` on `null`. Must classify as *not-a-journal*,
  not *malformed JSON*.
- **`migrate()` can throw, and it is reachable today.** `applyChain()` raises
  `Migration manquante depuis la vN` (`src/schema.js:37`). `versionOf()`
  (`src/schema.js:23`) accepts any integer, so a pasted journal carrying
  `"schemaVersion": 0` (or a negative) enters the chain at v0, finds no
  `MIGRATIONS[0]` and throws — verified against the current v1 code, where
  `MIGRATIONS` is empty. It must not surface as "JSON invalide"; it takes the
  `migration-failed` reason (Q1, Option A). #6 widens this path by shipping the
  first real migration step.
- **Empty textarea** — the button is already `disabled={!ioText}`
  (`src/App.jsx:468`), so no attempt is possible.
- **Whitespace-only text** — passes the `disabled` guard, fails `JSON.parse` →
  malformed-JSON line. Acceptable.
- **Storage unavailable (`storageOk === false`)** — import writes to React state,
  not storage, so the panel still works; the surrounding paragraph already says
  storage is unavailable. Unchanged.
- **A journal that migrates successfully** — success path; keeps its existing
  "Journal mis à jour vers le nouveau format." toast, shows no line.

## Out of scope / follow-ups

- **`src/import.js` will grow.** #6's program-file import belongs in the same
  module (`parseProgramImport`), reusing the reason/message shape.
- **Messages are not yet actionable for an AI-generated file.** Once #6 lets a
  program come from an LLM, a message could name the valid alternatives so the
  user pastes the error back and gets a corrected file. Separate issue.
- **A stored journal with an invalid `schemaVersion` is silently overwritten** —
  the same `migrate()` throw on the *load* path (`src/App.jsx:167-189`), where its
  `catch` treats an unreadable journal as an absent one and the autosave then
  destroys it. Filed as
  [#10](https://github.com/Simon0687/programme-12-semaines/issues/10).
- **CONTRIBUTING.md §2 and §6 say to branch from and merge into `main`, but the
  work actually flows through `dev`** (`origin/dev` carries #1–#5). The document
  is out of date with practice. Worth a `docs:` issue.

## Open questions

Resolved 2026-09-08 (`decisions-spec.md`, both Option A):

1. **`migration-failed` reason** — added now. The case is reachable at v1 through
   a non-positive `schemaVersion`, so today's "JSON invalide" is actively wrong,
   not merely imprecise.
2. **Message wording** — the proposed sentences ship as written; the
   plain-language pass is deferred to the public-readiness work, where the whole
   panel is reviewed together rather than three strings in isolation.
