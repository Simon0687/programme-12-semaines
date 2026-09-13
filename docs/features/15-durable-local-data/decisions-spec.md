# Decisions - Make local data durable: real export, share sheet, and storage persistence (#15)

Source: spec.md
Scope: product / requirement choices only. Implementation choices are decided in
the second round, in `decisions.md`, once `/design-tech 15` has produced
`design.md`.
Status: all six answered 2026-09-13

## Q1 - Where the last-export date lives, and under what key

**Question.** The reminder needs to know when the last successful export
happened. `withVersion()` (`schema.js:28`) copies exactly
`{schemaVersion, activeProgramId, programs}`, so a field added at the journal
root is dropped by `saveJournal` on the next write — this is not really a free
choice. What remains open is the key name and whether it follows the existing
sibling-key family.

**Option A - A sibling key, `<journal key>_last_export`**
- What it means: `prog12_simon_v1_last_export`, holding a bare ISO date string,
  read and written through the injected store like the backups already are.
- Implications: no journal change, no migration, no `SCHEMA_VERSION` bump; spec
  stays MINOR. Follows `backupKey()` / `droppedBackupKey()` (`backup.js:14,23`).
  Reading an absent key throws in the shim (`storage.js:38`), so it needs the
  same `try/catch` shape as `readDroppedBackup` (`backup.js:40-48`). It is **not**
  probed by `listBackups`, which only walks `_backup_pre<N>` for N < current
  version (`backup.js:68-78`), so no collision.
- Pros: the pattern exists twice already; an older version of the app ignores the
  key entirely; nothing to migrate, ever.
- Cons: a third loose key beside the journal, none of them enumerable.

**Option B - Inside the journal**
- What it means: a root field, or one per program entry.
- Implications: a root field requires changing `withVersion()`, which is the
  compatibility contract — that makes the change MAJOR and pulls in a migration.
  A per-program field makes "last export" mean "last export of this cycle",
  which is not what it is: the export covers the whole journal.
- Pros: one key to carry, visible in the export itself.
- Cons: changes the contract for a convenience field; and the export would then
  contain the date of the export that produced it, which is circular.

**Recommendation. A**, key `prog12_simon_v1_last_export`. B is not a real
alternative once `withVersion` is read. Fully reversible: deleting the key
degrades to "no reminder", nothing else.

**Simon's decision.** **A** — sibling key `prog12_simon_v1_last_export`. Recorded 2026-09-13.

## Q2 - What counts as a successful export on the download path

**Question.** `navigator.share` rejects when the user cancels, so the share path
can tell success from abandonment. A download anchor reports nothing at all.
Unanswered, the reminder either nags forever on desktop or claims a copy exists
when none was saved.

**Option A - The gesture counts as success on the anchor path**
- What it means: the date is recorded when the anchor path is taken; on the
  share path, only a resolved `share()` records it.
- Implications: the recorded date can be optimistic — a blocked download or a
  cancelled OS save dialog still resets the clock. Mitigated by always showing
  the recorded date in Données ("Dernier export : 3 oct."), so a stale or wrong
  value is visible rather than merely trusted.
- Pros: the reminder stays satisfiable everywhere, so it keeps being believed.
- Cons: a false "you are covered" is possible on the path that cannot report.

**Option B - Only an observable success records a date**
- What it means: only a resolved `navigator.share` records; the anchor path
  never does.
- Implications: on any device without the share API — including
  `http://<LAN IP>`, where `navigator.share` is `undefined` because it needs a
  secure context, which is the phone-testing setup — the reminder can never be
  satisfied.
- Pros: the recorded date is always true.
- Cons: a permanent nag on the paths where it cannot be dismissed by acting is
  the fastest way to make someone ignore it for good.

**Recommendation. A**, paired with the date being displayed, not just stored.
For a durability feature, a warning that can never be satisfied is more dangerous
than one that is occasionally optimistic, because the first gets disabled.
Reversible: tightening to B later is a one-line condition.

**Simon's decision.** **A** — the gesture counts on the anchor path, and the recorded date is displayed in Données. Recorded 2026-09-13.

## Q3 - Where the 14-day reminder appears

**Question.** A reminder nobody sees is not a reminder. The app has three
existing places for a message: the toast (`App.jsx:300`, auto-cleared after
2500 ms), the persistent `loadError` banner rendered **outside any tab**
(`App.jsx:481`), and text inside a panel.

**Option A - Inside the Données panel only**
- What it means: a line appears in Plan → Données when the date is stale.
- Implications: seen only by someone who already went to export.
- Pros: zero intrusion.
- Cons: it fires exactly where it is not needed; someone who has not exported in
  a month is by definition not opening that panel.

**Option B - A dismissible banner where `loadError` already renders**
- What it means: the same slot, outside any tab, so it is visible on whatever
  screen the app opens on.
- Implications: `loadError` sits outside the tab conditionals today, so this
  survives #41 moving the landing screen from Séance to Semaine **without being
  touched** — worth choosing deliberately, since #15 lands first. Dismissal state
  can be in-memory: if it reappears next launch, that is correct behaviour.
- Pros: seen, and placed in a slot the app already treats as "important and
  persistent".
- Cons: one more thing that can be on screen at once, alongside `loadError` and
  the `!storageOk` warning.

**Option C - The existing toast**
- What it means: reuse `showToast` at load.
- Implications: cleared after 2500 ms (`App.jsx:300`).
- Pros: no new UI.
- Cons: a data-loss warning that disappears in two and a half seconds is
  decoration.

**Recommendation. B.** Reversible in one line by moving the render site; nothing
stored depends on it.

**Simon's decision.** **B** — dismissible banner, rendered where `loadError` already is. Recorded 2026-09-13.

## Q4 - Does a successful import reset the reminder clock?

**Question.** Importing a journal file means a file existed on disk and now
matches what the app holds. Whether that counts as "you have a copy" decides if
`importData` (`App.jsx:387`) also writes the date.

**Option A - Yes, an import records the date too**
- What it means: a successful `parseJournalImport` records the same date an
  export would.
- Implications: `importData` already knows it succeeded (`res.ok`,
  `App.jsx:389`), so this is one call at a point that exists.
- Pros: at that instant the journal in the app is identical to a file on disk —
  exactly the state the reminder is trying to ensure. Symmetric with export:
  both hold only until the next edit.
- Cons: the imported file may be old; the user is covered for *that* content,
  not necessarily for recent sessions — though the same is true right after an
  export followed by a session.

**Option B - No, only exports count**
- What it means: import leaves the clock alone.
- Implications: importing a file you just exported would still leave a stale
  reminder on screen.
- Pros: "last export" keeps a literal meaning.
- Cons: contradicts what the user just observed themselves doing.

**Recommendation. A.** The field is about "is there a copy off this device", and
an import proves there is. Reversible with no data consequence.

**Simon's decision.** **A** — a successful import records the date too. Recorded 2026-09-13.

## Q5 - Filename convention

**Question.** The exported file is the artefact the whole issue exists for; its
name is what makes a folder of them usable a year later.

**Option A - `prog12-journal-<YYYY-MM-DD>.json`**
- What it means: date only. Backups as
  `prog12-journal-v<N>-avant-migration.json`, dropped-sessions copy as
  `prog12-journal-avant-lignes-ecartees.json`.
- Implications: two exports the same day collide; the OS resolves it by
  appending a number, both on the iOS share sheet into Files and on a desktop
  download.
- Pros: sorts chronologically, reads at a glance, short enough to see in full in
  a file list on a phone.
- Cons: same-day collisions handled by the OS rather than by us.

**Option B - Date and time, `prog12-journal-<YYYY-MM-DD-HHmm>.json`**
- What it means: minute precision.
- Implications: no collisions ever.
- Pros: unambiguous ordering within a day.
- Cons: longer, and the extra precision matters only on a day with several
  exports — which is not the failure mode this issue addresses.

**Recommendation. A.** Reversible at any time: the filename is not parsed by the
import path, which validates content, not name.

**Simon's decision.** **A** — `prog12-journal-<YYYY-MM-DD>.json`. Recorded 2026-09-13.

## Q6 - Is `navigator.storage.persist()` re-requested after a refusal?

**Question.** The call asks the browser to stop treating the origin as evictable
cache. Whether it is asked once ever, once per load, or from a button decides
whether any state has to be stored about it.

**Option A - Once per load, silently; display `persisted()`**
- What it means: request on boot, and render the current state from
  `navigator.storage.persisted()` in Données.
- Implications: **no stored state at all**, so no second sibling key beside the
  one from Q1. Current browsers grant or refuse on engagement heuristics rather
  than by prompting, so repeating the call is not a repeated interruption.
- Pros: self-correcting — an origin refused today can be granted later once the
  PWA is used more, and the app will pick that up without anyone doing anything.
- Cons: a call on every load, for a no-op most of the time.

**Option B - Once ever, recorded**
- What it means: ask on first run, store the outcome, never ask again.
- Implications: a second stored key, for a value the platform can already be
  asked for at any time via `persisted()`.
- Pros: one call in the app's lifetime.
- Cons: freezes a refusal that the browser would grant later; stores something
  that is already queryable.

**Option C - An explicit button in Données**
- What it means: the user asks for it.
- Implications: requires explaining to the user what persistent storage is.
- Pros: nothing happens without intent.
- Cons: the measure's value is that it is free and invisible; putting it behind a
  button most people will never press removes the point.

**Recommendation. A.** It is the only option that needs no stored state and that
benefits from a browser changing its mind. Reversible trivially.

**Simon's decision.** **A** — requested once per load, no stored state. Recorded 2026-09-13.

## How to apply

Once Simon fills in each "Simon's decision", the answers fold back into
`spec.md`: resolved points move out of **Open questions** into the relevant
section (or a new **## Decisions** list), and **Open questions** ends as "None".
Q1 answered as A also fixes the storage impact paragraph as written — MINOR, no
migration; answered as B, that paragraph and the version level both change.
