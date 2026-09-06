# Spec - Version the data schema and handle migrations (#1)

## Context

The journal stored in `localStorage` under `prog12_simon_v1` carries no version
number. Issues #3-#6 will reshape that object; without a version marker the app
would silently load a journal it can no longer read, dropping already-logged sets.
The JSON export has the same gap: nothing records the format it came from. This
issue adds the safety net before any structural change lands.
Issue: https://github.com/Simon0687/programme-12-semaines/issues/1

## Scope

- **In:**
  - a `schemaVersion` integer on the stored object, as a **sibling** of
    `logs`/`cardio`/`checkin` (current value `1`, declared in exactly one place);
  - a `migrate(data)` function that chains version-to-version steps and runs on
    load and on import;
  - `schemaVersion` in the JSON export;
  - import that rejects a file newer than the app understands, with an explicit,
    actionable message;
  - absence of `schemaVersion` treated as v1;
  - bringing a minimal test runner online and covering `migrate()` with unit
    tests (see Data & storage impact for why this lands here).
- **Out:**
  - any actual data-shape migration - those ship with #3-#5, and the v2 format
    with #6;
  - the `{ schemaVersion, data: { ... } }` envelope shape - deferred to #6 (see
    follow-ups);
  - building out the test suite for the progression logic - stays in #2;
  - a persistent inline error line for import failures - separate improvement
    issue (see follow-ups);
  - a pre-migration backup copy of the journal - separate improvement issue (see
    follow-ups);
  - turning export/import into real file download/upload;
  - renaming the `prog12_simon_v1` key.

## User-facing behaviour

- **Seance, Semaine, Bilan:** no visible change. Existing journals load exactly as
  before.
- **Plan** - section *"Données : sauvegarde et restauration"*:
  - *Exporter le JSON* / *Afficher le JSON* now produce an object that includes
    `"schemaVersion": 1` alongside `logs`, `cardio`, `checkin`.
  - *Importer le JSON collé* with a file whose `schemaVersion` is higher than the
    app knows: import is refused, the current journal is untouched, and a toast
    explains the cause and the fix, e.g. *"Ce fichier a été créé par une version
    plus récente de l'appli. Mets l'appli à jour, puis réimporte."*
  - Import of an older or unversioned JSON still succeeds (unversioned is read as
    v1).
  - Malformed JSON, or JSON without `logs`, still shows "JSON invalide" as today.
  - When the app loads (or imports) a journal at an older `schemaVersion` and
    `migrate()` actually upgrades it, a one-time toast is shown, e.g. *"Journal mis
    à jour vers le nouveau format."* At v1 the migration chain is empty, so this
    stays dormant until the first real migration (#3).

## Acceptance criteria

- [ ] Given a journal saved by v1.0.0 (no `schemaVersion`), when the app loads,
      then every logged set, cardio entry and check-in is present and unchanged,
      and no migration toast is shown.
- [ ] Given a JSON exported by v1.0.0, when it is pasted and imported, then it
      loads with no data loss.
- [ ] Given a pasted JSON whose `schemaVersion` is greater than the app's current
      version, when import is run, then a toast naming the cause and the fix is
      shown and the stored journal is not modified (verify by re-opening: previous
      data still there).
- [ ] Given any freshly saved or exported object, then it contains
      `schemaVersion` equal to the app's current schema version, placed next to
      `logs`/`cardio`/`checkin`.
- [ ] The current schema version is declared in exactly one place in the source
      (a single constant), and both save and export read it from there.
- [ ] `migrate(data)` is idempotent: running it on an already-current object
      returns an equivalent object.
- [ ] Migrations are indexed by source version, so adding a future step does not
      touch existing ones.
- [ ] Given a journal at an older `schemaVersion` with a (test) migration step
      registered, when it is loaded, then it is upgraded to the current version
      and the one-time "Journal mis à jour" toast is shown.
- [ ] `npm test` runs a real runner and `migrate()` has unit tests covering:
      no-op at current version, unversioned treated as v1, rejection flag for a
      too-new version, and a fake 1->2 step proving the chain runs.

## Data & storage impact

The stored object gains one field: `schemaVersion` (integer, currently `1`), as a
sibling of the existing keys. No existing field is renamed or removed. A v1.0.0
journal has no `schemaVersion`; it is read as `1`, `migrate()` is a no-op at v1,
and it loads identically.

**Level: MINOR (1.1.0).** Per CONTRIBUTING.md this is a compatible addition with
the existing journal intact - a journal saved by the previous version loads
without loss, so it is not MAJOR. Matches the milestone's target version. No
migration of real user data is required by this issue.

Note on the test runner: `migrate()` is the riskiest piece of the whole epic and
it ships here, so this issue brings a minimal runner online and tests `migrate()`
only. Dev-tooling change, no version impact. Issue #2 builds the suite out for the
progression logic.

## Edge cases

- **No journal yet:** first load finds no key, starts fresh; the first save writes
  `schemaVersion: 1`.
- **Unversioned legacy journal:** `schemaVersion` absent -> treated as v1, no
  migration toast.
- **Import, file newer than app:** rejected with the actionable toast, nothing
  destroyed.
- **Import, file at current version:** loads directly.
- **Import, file older than current (future case):** `migrate()` brings it up,
  then it loads, with the one-time toast.
- **Storage unavailable** (`STORE` is `null`, `storageOk` false): no load or save
  happens, so `migrate()` on load never runs; export from in-memory state still
  includes `schemaVersion`, and paste-import still works into memory.
- **`window.storage` host bridge vs `localStorage`:** both go through the same
  load path, so `migrate()` must run regardless of the backend.
- Week 7 deload, session reopen: unrelated to schema, no impact.

## Out of scope / follow-ups

- **Annotate issue #6:** adopt the `{ schemaVersion, data: { ... } }` envelope
  when the stored format is reshaped there, instead of keeping `schemaVersion` as
  a bare sibling. One deliberate reshape rather than two.
- **New improvement issue:** replace the transient toast for a rejected import
  with a persistent inline message in the Plan import panel, so a missed rejection
  no longer looks like "nothing happened".
- **New improvement issue:** before the first post-migration save, keep a copy of
  the pre-migration journal under a backup key, so a buggy migration shipped by
  #3+ stays recoverable.
- Real per-version migration functions arrive with #3, #4, #5; the v2 shape and a
  mandatory migration with #6.
- Export/import is still clipboard + textarea; making it a downloadable/uploadable
  `.json` file could be its own issue.
- The `_v1` suffix in the key name `prog12_simon_v1` is now redundant with
  `schemaVersion`; worth a note or a rename issue, but not here.

## Open questions

None - the five points raised in the first draft are resolved and folded into the
sections above:

1. `schemaVersion` placement -> sibling field now, envelope deferred to #6.
2. `migrate()` tests -> minimal runner online in this issue, suite built out in #2.
3. "File too new" message -> actionable wording (cause + fix).
4. Rejected-import feedback -> toast for now, persistent inline line tracked as a
   follow-up improvement issue.
5. Migration performed -> one-time toast now; pre-migration backup safeguard
   tracked as a follow-up improvement issue.
