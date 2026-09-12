# Spec - Invalid schemaVersion journal is silently overwritten (#10)

## Context

`versionOf()` (`src/schema.js:23-26`) accepts any integer, including `0` and
negatives — only non-integers fall back to v1. A journal stored under
`prog12_simon_v1` with `"schemaVersion": 0` (or any negative value) enters
`applyChain()` (`src/schema.js:32-42`) below v1, finds no migration step, and
`migrate()` throws.

The loading effect (`src/App.jsx:169-192`) wraps the whole read-parse-migrate
sequence in one `try`, and its `catch` (line 189) is commented "first use: key
absent". In reality it also catches `migrate()` throwing on a present-but-
invalid journal. `storageOk` (default `true`, line 157) is never set to
`false` on this path — unlike the existing "journal from a newer version"
guard (lines 182-187) — so the autosave effect (`src/App.jsx:194-206`) later
writes the empty in-memory state over the stored journal. Weeks of logged
data disappear with no message. See #10.

## Scope

- **In:** distinguishing, at load time, "no journal in storage" from "a
  journal is present but could not be read" — whether the cause is an
  invalid `schemaVersion` or corrupt JSON, both get the same treatment
  (Resolved question 2); blocking autosave in that case; telling the user
  their journal could not be read.
- **Out:** the implementation angle (hardening `versionOf()` vs. catching the
  migration step separately) — a design-tech decision, not a spec decision.
  Backing up the journal before a migration that *succeeds* (#8). The import
  panel path (already fixed by #7 — this issue is the load path only).
  Repairing or recovering an unreadable journal.

## User-facing behaviour

This is a startup-level condition, not scoped to one tab — it can occur no
matter which tab the app opens on.

- **Nominal (readable journal) or true first use (no key at all):** pixel-
  identical to today. No new message appears.
- **Journal present but unreadable** (invalid `schemaVersion`, or corrupt
  JSON — same handling, Resolved question 2): the app starts with an empty
  state, same as today, but now shows an **explicit, persistent** message
  telling the user their saved journal could not be read and nothing has
  been overwritten (Resolved question 1). "Persistent" means it does not
  auto-dismiss the way the existing 2.5s toast does (`src/App.jsx:474`, used
  by the `tooNew` case at line 186) — the user must still be able to read it
  after glancing away and back.

  This can't simply reuse #7's persistent line as-is: that line lives inside
  the Plan tab's import panel (`src/App.jsx:469`), scoped to the moment the
  user is actively looking at it. A startup condition must be visible
  regardless of which tab is open. Design-tech decides the exact mechanism
  (e.g. a non-dismissing global banner rather than a tab-scoped line); the
  requirement here is "visible from any tab, does not self-dismiss."

  No spinner, no blocking modal — the app stays usable. Message text: see
  Resolved question 3.

## Acceptance criteria

- [ ] Given a journal stored with `schemaVersion: 0` (or any negative
      integer), when the app loads it, then no autosave overwrites the
      stored content.
- [ ] Given that same journal, when the app loads it, then a message tells
      the user the journal could not be read.
- [ ] Given no key in storage (true first use), when the app starts, then no
      error message appears — current behaviour unchanged.
- [ ] Given a valid journal at the current schema version, then loading and
      saving are unchanged.
- [ ] Given a journal from a newer schema version (the existing `tooNew`
      case, `src/App.jsx:182-187`), then behaviour is unchanged — this fix
      must not regress that guard.
- [ ] Given a journal with corrupt JSON in storage (`JSON.parse` throws),
      when the app loads it, then it gets the same treatment as an invalid
      `schemaVersion` — no autosave overwrite, same message.
- [ ] A test covers the distinction between "no key" and "journal present
      but unreadable" (both the `migrate()`-throws and the
      `JSON.parse`-throws cases).

## Data & storage impact

No change to the journal shape — `schemaVersion`, `logs`, `cardio`, `checkin`
are untouched. **PATCH** per CONTRIBUTING.md: a fix with no change to
intended behaviour (silent data loss was never the intended behaviour). No
migration needed, nothing for issue #1's chain to do.

## Edge cases

- **Corrupt JSON in storage** (`JSON.parse` throws before `migrate()` is even
  called): today falls into the same catch-all as the target bug. Resolved
  question 2: in scope, same fix, same message as the `schemaVersion` case —
  the user does not need to know which of the two technical causes applies.
- **`STORE.get` throwing for a reason other than a missing key:** the
  localStorage adapter (`src/App.jsx:19-25`) only throws `"missing"` for an
  absent key, but the production seam `window.storage` (line 18) is opaque
  and could throw for other reasons. Should stay classified as "unreadable",
  not misreported as first use.
- A journal that is simultaneously "too new" and has an invalid version
  marker cannot happen — `tooNew` requires a valid integer `schemaVersion`
  greater than `SCHEMA_VERSION`, which is mutually exclusive with the
  non-integer-or-out-of-range case here.
- Week 7 deload, a reopened session, etc. — not relevant; this is a
  startup-only concern, before any session data is touched.

## Out of scope / follow-ups

- Hardening `versionOf()` to reject non-positive integers is one possible
  fix angle (decided at design-tech). If chosen, it also benefits the import
  path, which already documents the same root cause
  (`src/import.js:46-54`).
- A recovery/repair UI for an unreadable journal is #8's "recovery button"
  territory (accessing a raw backup), not this issue.
- #8 (backup before a migration that *succeeds*) and #11 (backup before a
  destructive import) are adjacent — same instinct, different moment. This
  issue is about a migration that cannot happen at all.

## Open questions

None outstanding. Resolved by Simon on 2026-09-08:

1. **Explicit and persistent, not a toast.** See User-facing behaviour.
2. **Same fix** covers corrupt JSON in storage, not just an invalid
   `schemaVersion`. See Scope and Edge cases.
3. **Message text (proposed by Claude at Simon's request):**
   > Le journal enregistré n'a pas pu être mis à jour vers le format actuel.
   > Rien n'a été chargé, rien n'a été écrasé.

   Deliberately reuses the wording already validated for
   `IMPORT_MESSAGES["migration-failed"]` (`src/import.js:26`) for
   terminological consistency, plus a reassurance clause specific to this
   issue's stakes — #7's import path never risked overwriting anything;
   this one does.
