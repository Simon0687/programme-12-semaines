# Spec - Make local data durable: real export, share sheet, and storage persistence (#15)

## Context

The journal lives in one `localStorage` key on one device, and the only safety
net is "Exporter le JSON" (`App.jsx:617`), which calls `navigator.clipboard` and
nothing more — nothing lands in a file, nothing reminds anyone to do it, and the
clipboard is gone at the next copy. A real journal was nearly lost during the #6
testing session; the only surviving copy had been pasted into a chat by chance.
This also blocks #41, whose Données rework and bilan download both need a file to
exist.

Issue: [#15](https://github.com/Simon0687/programme-12-semaines/issues/15).
Workflow level **A** — `.claude/WORKFLOW.md` Q2 (new persisted data: the
last-export date), plus the sensitive-module override on `storage.js` /
`backup.js`.

## Scope

- **In:** writing the journal to a file and handing it to the OS
  (`navigator.share` with `files`, download-anchor fallback); importing a journal
  from a file picker; recording the date of the last successful export;
  a discreet reminder after ~14 days without one; `navigator.storage.persist()`
  and showing its outcome. The JSON clipboard export and the paste `<textarea>`
  are replaced, not kept alongside.
- **Out:** any backend, account or sync — durability and multi-user are separate
  needs. The **placement** of the Données panel inside the new navigation, and
  the bilan's own download button, are #41. Scheduled or automatic backups.
  Encryption of the exported file.

## User-facing behaviour

**Plan → Données** is the only tab that changes.

- "Exporter le JSON" (clipboard) is replaced by **"Télécharger le journal"**.
  On a device where the OS share sheet accepts files, it opens the share sheet
  so the file can land in Files / iCloud Drive / Drive in one gesture; elsewhere
  it downloads. The generated filename is shown next to the button after the
  gesture.
- "Afficher le JSON", "Importer le JSON collé" and the paste `<textarea>` are
  replaced by **"Importer un fichier"**, a file picker restricted to
  `application/json`. Selecting a file states what will happen — the current
  journal is backed up before being replaced — and asks for confirmation before
  anything is written.
- The pre-migration and dropped-session backups stop being dumped into the
  textarea: each gets its own **download** button, same mechanism as the journal.
- A line states whether the browser has granted persistent storage, in plain
  words: granted, refused, or not supported here.
- When the last successful export is older than ~14 days, a discreet reminder
  appears. Its placement is Open question 3.

**Séance, Semaine, Bilan** are unchanged by this issue. In particular the Bilan
keeps its "Copier le bilan" button; #41 switches it to a download, reusing the
helper this issue introduces.

## Acceptance criteria

- [ ] Given a journal in storage, when "Télécharger le journal" is used, then a
      file is produced that the user can save outside the browser — not only a
      clipboard copy.
- [ ] Given a device where `navigator.share` with files is unavailable, when the
      same button is used, then the export still produces a downloadable file.
- [ ] Given a file exported this way, when it is re-imported, then the journal is
      restored exactly — round-trip verified by a test over `withVersion` and
      `parseJournalImport`.
- [ ] Given a file that is not a valid journal, when it is picked, then the
      existing rejection message is shown and **nothing is written**.
- [ ] Given an import about to replace a journal, then a backup of the current
      journal is written first, and the import is confirmed by the user.
- [ ] Given a successful export, then its date is recorded; given no export for
      more than 14 days, then the reminder is shown; given an export today, then
      it is not.
- [ ] Given the Données panel, then it states whether persistent storage was
      granted, refused, or is unsupported.
- [ ] Given the whole app, then `grep -n "ioText" src/App.jsx` returns nothing.
- [ ] `npm test` passes in full.

## Data & storage impact

**MINOR.** The journal at `prog12_simon_v1` does not change shape. The
last-export date is new persisted data, but it belongs **beside** the journal,
not inside it, for a decisive reason: `withVersion()` (`schema.js:28`)
whitelists exactly `{schemaVersion, activeProgramId, programs}`, so any field
added at the journal root is silently dropped by `saveJournal` on the next
write. Storing it in the journal would mean changing the compatibility contract
itself; storing it per program would make "last export" mean "last export of
this cycle", which is not what it is.

The repository already has the pattern for sibling keys: `backupKey()` →
`<key>_backup_pre<N>` and `droppedBackupKey()` → `<key>_backup_dropped`
(`backup.js:14,23`). A third key of the same family costs no migration, and a
previous version of the app simply ignores it. No `SCHEMA_VERSION` bump.

The injected store exposes only `get` and `set` (`storage.js:33-42`, and
`backup.js:64-67` documents the absence of enumeration) — enough for a single
known key, and the reason no index has to be maintained.

## Edge cases

- **No secure context.** `navigator.share`, like `navigator.clipboard`, exists
  only in a secure context. Over `http://<LAN IP>` — the phone-testing setup —
  it is `undefined`, so the download-anchor fallback is the nominal path there,
  not an exotic one. `<a download>` is not gated on secure context and works.
- **Share sheet cancelled.** `navigator.share` rejects on cancel; a cancelled
  share must not count as a successful export for the reminder.
- **Download anchor.** It reports nothing back — success is not observable. See
  Open question 2.
- **Store unavailable** (`createStore()` returns `null`, `storageOk` false).
  Export must still work: it serialises in-memory state, and this is precisely
  the situation where getting a file out matters most.
- **Journal too new or unreadable.** `loadJournal` returned a verdict and nothing
  was loaded; the export must not write an empty journal over a real one, and
  the import path is the documented way out (`App.jsx:390-399`).
- **First use, empty journal.** The reminder must not fire when there is nothing
  to lose.
- **Import of a file exported by an older schema.** Already covered:
  `parseJournalImport` migrates, and the pre-migration backup applies.

## Out of scope / follow-ups

- `copy()` survives this issue with exactly one caller, the bilan
  (`App.jsx:580`). It disappears in #41, which switches that button to a
  download. The two specs agree on this split; neither removes the other's half.
- `CONTRIBUTING.md` §"Pre-migration backups" documents recovery as "dumping the
  raw original into the visible textarea". This issue removes that textarea and
  must update the paragraph in the same change.
- Automatic export on a schedule, and export to a chosen folder, were considered
  and left out: both need permissions the app does not have.

## Decisions

Settled 2026-09-13 via `decisions-spec.md`. Product choices only; implementation
choices follow `/design-tech 15`.

1. **The last-export date lives in a sibling key**, `prog12_simon_v1_last_export`,
   holding a bare ISO date string. Not in the journal: `withVersion()`
   (`schema.js:28`) whitelists three keys and drops anything else on the next
   `saveJournal`. This is what keeps the issue MINOR.
2. **On the download-anchor path, the gesture counts as a successful export**,
   since that path cannot report back. The recorded date is always displayed in
   Données, so an optimistic value stays auditable. On the share path, only a
   resolved `navigator.share` records.
3. **The 14-day reminder renders where `loadError` already does**
   (`App.jsx:481`), outside any tab, dismissible in memory. Chosen so that #41
   moving the landing screen does not have to touch it.
4. **A successful import records the date too** — at that instant the journal
   matches a file on disk, which is the state the reminder exists to ensure.
5. **Filenames:** `prog12-journal-<YYYY-MM-DD>.json`;
   `prog12-journal-v<N>-avant-migration.json` for a pre-migration backup;
   `prog12-journal-avant-lignes-ecartees.json` for the dropped-sessions copy.
   Same-day collisions are left to the OS.
6. **`navigator.storage.persist()` is requested once per load**, with no stored
   state; Données renders the current `navigator.storage.persisted()` value.

## Open questions

None.
