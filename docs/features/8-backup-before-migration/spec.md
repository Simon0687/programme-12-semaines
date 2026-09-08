# Spec - Sauvegarder le journal avant la première écriture post-migration (#8)

## Context

Since #1, `migrate()` upgrades an old journal in memory at load
(`src/App.jsx:167-190`), sets `skipSave.current = false` (`:177`) so the migrated
shape is written back, and the debounced 600 ms effect (`:192-204`) overwrites
`prog12_simon_v1` with it. If a migration has a bug, the original journal is gone -
weeks of logged sessions, silently. `MIGRATIONS` is still empty (`src/schema.js:19`),
so nothing has ever been overwritten yet; #6 ships the first real migration, which
makes this the last moment to add the net before it is needed.
Issue: https://github.com/Simon0687/programme-12-semaines/issues/8
Depends on #1 (merged) and on **#10**, which must ship first: #10 fixes a load path
where `migrate()` *throws* and the journal is destroyed today, without any migration
being involved. #8 covers the complementary case - a migration that succeeds but may
be wrong. Blocks #6's `feat(storage)!:` step.

## Scope

- **In:**
  - before the first save that follows a migration, copy the exact pre-migration
    journal text to a distinct key `prog12_simon_v1_backup_pre<N>`, where `N` is the
    stored `schemaVersion` before migrating (see Q1);
  - write it once: if the key already exists, leave it alone (see Q3);
  - never read it automatically - it exists for recovery;
  - if the copy cannot be written, do not let the migrated shape be saved (see Q2);
  - document the key and the recovery procedure in `CONTRIBUTING.md`.
- **Out:**
  - automatic restore, or any attempt to detect that a migration went wrong;
  - **the case where `migrate()` throws** - the chain has no step for the stored
    version, so no migration happens and this feature never triggers. That is #10's
    data-loss path, not this one;
  - pruning old backups, or a quota strategy;
  - backing up on any event other than a migration - a normal save, an import, a
    program load (#6) do not produce copies;
  - changing the journal's own shape, the migration chain, or `migrate()`'s contract.

## User-facing behaviour

- **Séance / Semaine / Bilan:** no change.
- **Plan:** no change in the nominal case. The existing "Journal mis à jour vers le
  nouveau format." toast (`src/App.jsx:178`) still appears after a migration.
  - *backup write fails*: a toast states that the journal could not be secured and
    that nothing will be saved this session; the "Données" section already shows
    "Stockage automatique indisponible ici." via `storageOk`.
  - *a backup exists* (Q4): a "Afficher la sauvegarde d'avant-migration" button in
    the "Données : sauvegarde et restauration" section dumps it into the existing
    `ioText` textarea, so it can be copied off the phone.

In the normal case this feature is invisible. That is the intent: it is insurance,
not a feature.

## Acceptance criteria

- [ ] Given a stored journal at `schemaVersion` N < current, When the app loads and
      migrates it, Then `prog12_simon_v1_backup_pre<N>` contains the exact original
      text, byte for byte, and it is written **before** any save of the new shape.
- [ ] Given a backup key that already exists for version N, When the app loads and
      migrates again from N, Then the existing copy is not overwritten.
- [ ] Given a journal already at the current version, When the app loads, Then no
      backup key is created.
- [ ] Given storage is unavailable (`STORE === null`), When the app loads, Then no
      copy is attempted and nothing crashes.
- [ ] Given the backup write throws, When the app has migrated a journal, Then the
      migrated shape is **not** saved over the original and the user is told.
- [ ] Given `test/schema.test.js` or a new test file, When `npm test` runs, Then the
      "back up once, never overwrite, skip when current" logic is covered with an
      injected fake migration and a fake storage adapter.
- [ ] `CONTRIBUTING.md` documents the key format and how to recover from it.

## Data & storage impact

The journal `prog12_simon_v1` does not change shape - no field added, renamed or
removed. A **new, separate key** `prog12_simon_v1_backup_pre<N>` may be created; it
holds a verbatim copy of a previous journal and is never read by the app.

**Level: no release bump of its own.** The compatibility contract is the journal
format (CONTRIBUTING.md) and it is untouched; an old version of the app ignores the
extra key entirely. Labelled `chore`, so it does not drive a bump; it ships with the
batch whose first `feat` does - the same mechanism #3, #4 and #5 used. If Q4's
recovery button lands, that part is a `feat` and rides the minor. No migration.

## Edge cases

- **No migration ever runs today.** `MIGRATIONS` is empty (`src/schema.js:19`), so
  `res.migrated` is always false and this code path is dead until #6. It must
  therefore be tested with an injected migration - `applyChain(data, target,
  migrations)` already takes `migrations` as a parameter (`src/schema.js:32`) - and
  its real end-to-end verification happens during #6's click-through, as recorded in
  `docs/features/6-load-program-from-file/design.md`.
- **First launch, no journal.** `STORE.get` throws and is swallowed
  (`src/App.jsx:187`); nothing to back up.
- **Journal from a newer version.** `res.ok` is false, nothing is loaded and saving
  is already blocked (`src/App.jsx:180-185`). No backup: the original is not at risk
  because it is never overwritten.
- **`migrate()` throws (`schemaVersion: 0` or negative).** `versionOf()` accepts any
  integer (`src/schema.js:23-26`), so `applyChain` finds no step and throws. The
  hydration `catch` labelled "première utilisation : clé absente"
  (`src/App.jsx:187`) swallows it, the app starts empty with `storageOk` still true,
  and the debounced save overwrites the journal. **#8 does not cover this**: no
  migration ran, so `res.migrated` is never true and the copy is never attempted.
  This is #10, and it is why #10 ships first. Stating the boundary explicitly matters
  - once #8 exists it is easy to assume the journal is protected at load, and it is
  not, until #10 lands.
- **Unversioned v1.0.0 journal.** `versionOf()` returns 1 for a missing
  `schemaVersion` (`src/schema.js:23-26`), so the key is `…_backup_pre1`.
- **Multi-step migration** (v1 → v3 once #6 and a later issue exist). One copy of the
  original, keyed by the starting version - see Q3.
- **localStorage quota.** A copy roughly doubles the journal's footprint at each
  migration. A 12-week journal is tens of KB against a ~5 MB budget, so this is not a
  practical limit, but the write can still throw and must be handled (Q2).
- **Session reopened / week 7 deload / imported JSON.** Irrelevant: this touches only
  the load path, and only when a migration actually runs.

## Out of scope / follow-ups

- **Pruning backups.** After several majors the keys accumulate. Only worth an issue
  if it ever matters.
- **Backing up before a destructive *import*** - #11. `importData`
  (`src/App.jsx:313-325`) replaces the whole journal from pasted text with no copy of
  what it replaced - arguably a bigger hazard than migration, since the user triggers
  it by hand.
- **A generic storage wrapper.** #6's design already notes that a fake `STORE` would
  make the storage path testable; #8 is the second feature to need it.

## Open questions

Resolved 2026-09-08 (`decisions-spec.md`, all Option A):

1. **Key naming** - `prog12_simon_v1_backup_pre<N>`, `N` being the stored
   `schemaVersion` before migrating. One canonical copy per source version, never
   overwritten.
2. **Backup write fails** - block saving for the session (`storageOk` false), the
   same posture the `tooNew` branch already takes (`src/App.jsx:180-185`). The
   migrated shape never overwrites an unprotected original.
3. **Multi-step migrations** - only the original is copied, keyed by its version.
   Intermediate states are reproducible by re-running `applyChain`.
4. **Recovery affordance** - a button in the Plan "Données" section, shown only when
   a backup key exists, dumps the copy into the existing `ioText` textarea. A backup
   that cannot be reached from the phone it lives on is not insurance.
