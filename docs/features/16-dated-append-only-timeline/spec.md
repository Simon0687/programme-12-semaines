# Spec - Move the journal to a dated, append-only timeline (#16)

## Context

Sessions are stored under `w{week}_{sessionId}` (now built by `logKey()` /
`weekKey()`, #24), where `week` is 1..12 — a position inside one fixed cycle, not
a point in time. Concretely: `loadProgram()` (`src/App.jsx:381-392`) reuses the
same `programs[id].logs` object when the same program is reopened, and a program
resumed with a refreshed `definition.startDate` recomputes `curWeek` back down to
1 (`src/App.jsx:167`) — so the first session validated in the new cycle writes to
`w1_hautA` again, silently merging into whatever the first run left there. The
same positional key also means "what did I bench a year ago" cannot be answered
(no index by date or by exercise), and the engine hard-codes `week === 7` in four
places in `planned()` (`src/progression.js:56,65-66,77,88`) to recognise a
deload — a rule with nothing to hold onto once a session is not a week number.
This issue replaces the key with a date-indexed, append-only log, and replaces
the week-based deload detection with an explicit `kind` field. See
[issue #16](https://github.com/Simon0687/programme-12-semaines/issues/16).

Depends on #24 (merged into `dev`) for `logKey`/`weekKey`, which this issue
retires. Blocks #14 (deload-by-signal) and #17 (per-exercise history screen).

## Scope

- **In:**
  - A session log record indexed by a real date and a stable `id`, replacing
    `logs[logKey(week, sessionId)]`.
  - An explicit `kind` (`normal | deload | calibration | test`) on every session
    record, computed the same way the app decides it today — first week of a
    cycle → `calibration`, seventh week → `deload`, everything else → `normal`
    (`test` is a new value the engine must accept but this issue does not add a
    UI to produce one; see Open questions).
  - `src/progression.js`'s `history()`/`lastEntry()`/`planned()` reading the new
    per-record `kind` and `date` instead of looping `for (w = 1; w <= 12)` and
    parsing week numbers out of keys.
  - An automatic migration of the existing journal (schemaVersion 2 → 3) that
    derives each record's date from
    `date = definition.startDate + 7 × (week − 1) + slot offset` and its `kind`
    from the week it came from.
  - `id`, `updatedAt`, `deletedAt`, `schemaVersion` on every session record.
- **Out:**
  - Deload triggered by anything other than the current week-position rule
    (#14) — this issue only moves where that rule's *output* is stored.
  - The per-exercise history screen that reads this new index (#17).
  - The exercise registry's own shape (`id`, `repRange`, `increment`,
    `keyLift`) — already closed by #25; this issue only stores and reads the
    slugs it already uses.
  - A sync backend. Only the four sync-ready fields land now.
  - Storage backend choice (`localStorage` vs. IndexedDB) — an implementation
    detail for design-tech, not a product behaviour; either way the record
    shape and migration described here are unchanged.
  - Weekly cardio (`cardio[weekKey(week)]`) and the Sunday check-in
    (`checkin[weekKey(week)]`) moving to a dated shape — out unless Open
    question 2 below is answered otherwise.
  - The staleness fallback (~6-week gap ⇒ recalibrate) described in the issue's
    Notes — not in its acceptance criteria, and it needs a tuned threshold this
    spec has no basis to set. Tracked as a follow-up.

## User-facing behaviour

None of the four tabs changes appearance or interaction as a direct result of
this issue: **Séance**, **Semaine**, **Bilan**, and **Plan** read and write the
same fields they do today (a session's done state, its logged sets, the weekly
cardio/check-in). The only user-visible change is indirect and only shows up
once someone resumes a finished program: validating "Haut A" in a new cycle no
longer silently merges into the first cycle's "Haut A" entry — both are kept,
and `history()`-backed screens (Semaine's per-session summary, `Bilan`'s
key-lift lines) keep reading correctly across the boundary because they now
scan by date instead of by a week counter reset to 1.

## Acceptance criteria

- Given a session log written today, when it is saved, then it is stored keyed
  by a client-generated `id` (not `w{week}_{sessionId}`), and its record carries
  `date` (ISO `AAAA-MM-JJ`), `slot` (today's session id, e.g. `hautA`), `kind`,
  `updatedAt`, `deletedAt: null`, and `schemaVersion`.
- Given a program already run to completion once, when the same `activeProgramId`
  is resumed with a new `definition.startDate` and a session is validated in the
  new week 1, then the previous cycle's week-1 session record is untouched and
  both exist side by side (`Object.keys(logs).length` grows, nothing is
  overwritten).
- Given any session, when it is validated, then its `kind` is set exactly as
  `phaseOf(week)` decides it today: week 1 → `calibration`, week 7 → `deload`,
  every other week → `normal`.
- Given `history()`/`lastEntry()`/`planned()` fed the *migrated* form of the
  journal `test/progression.test.js` uses today, when `npm test` runs, then
  every existing assertion in that file passes unmodified — in particular the
  week-7 deload exclusion from `base`/`prev` (today's
  `src/progression.js:56-59`) is reproduced using `kind === "deload"` instead of
  `week === 7`, and the week-1 calibration math (today's line 77) is reproduced
  using `kind === "calibration"` instead of `week === 1`.
- Given an existing v2 journal (`schemaVersion: 2`), when the app loads it, then
  it is migrated automatically to v3: every entry under `programs[id].logs` gains
  `date` (computed from that program's `definition.startDate` and the week
  parsed out of the old key), `kind` (from the same week), `id`, `updatedAt`,
  and `deletedAt: null` — with no change to `ex`, `notes`, or `done`. The
  migration follows the existing `MIGRATIONS[n]` chain
  (`src/schema.js:38` onward) as `MIGRATIONS[2]`.
- Given a v2 journal whose `programs[id].definition` is `null` (the app-bundled
  default program, `src/schema.js:29`), when it migrates, then the date formula
  uses that program's own `DEFAULT_DEFINITION.startDate`
  (`src/default-program.js:129`), not a guess.
- Given the migrated journal, when `Bilan`'s key-lift summary and `Semaine`'s
  per-session summary render (both currently reading `state.logs[logKey(...)]`
  directly, `src/App.jsx:331,505`), then they show the same values as before the
  migration, now looked up by date/id instead of by key string.

## Data & storage impact

**MAJOR.** `schemaVersion` moves from 2 to 3. A journal saved by 1.x does not
load without loss under the new code without running the migration — per
CONTRIBUTING.md's rule ("does a journal saved by the previous version load
without loss?"), this is a breaking change requiring `MIGRATIONS[2]` and a
pre-migration backup (`prog12_simon_v1_backup_pre2`, per the existing
backup-before-migration mechanism, #8) written automatically before the
rewrite.

## Edge cases

- **A log entry with no `done: true` (an in-progress, unvalidated session).**
  Today's `history()` only reads `log.done` entries; `kind` is described as
  "written when the session is validated" — an unvalidated entry has no `kind`
  yet and must not be read by `history()`, same as today.
- **Migrating a log whose `week` cannot be parsed from the key** (defensive:
  should not exist, but `loadJournal`'s `invalid` verdict already handles a
  corrupt/unexpected shape) — the migration step should fail closed (`ok:
  false`) rather than guess a date, consistent with how `migrate()` already
  rejects out-of-range `schemaVersion` (`src/schema.js`, `versionOf`).
- **Two programs (`programs[idA]`, `programs[idB]`) each with their own
  `definition.startDate`** — the migration must use each program's own
  `startDate` for its own logs, not a single global one.
- **Reopening a validated session** (`reopen()`, `src/App.jsx:310`) — sets
  `done: false` but keeps the record; `kind` and `date` must not be recomputed
  or cleared on reopen, only on a fresh validation of a session that has never
  been validated before (a reopened-then-revalidated session keeps its original
  `date`/`kind`, since it is still describing the same real workout).

## Out of scope / follow-ups

- Staleness fallback (~6-week gap) — own issue once a threshold is chosen from
  real data.
- `kind: "test"` producer (a UI to log a max-effort test) — no such concept
  exists in the app today; this issue only makes the engine accept the value.
- Moving weekly cardio/check-in to dated records — tracked as #29 under the new
  "Cardio improvement" milestone (`priority: later`); the overwrite bug survives
  there until that lands, but it is a display quirk (`bilanText()`,
  `src/App.jsx:321-334`), not a data-integrity risk, since `planned()`/
  `history()` never read `cardio`/`checkin`.
- IndexedDB migration, if design-tech recommends it — independent of this
  issue's record shape.
- A "restart cycle" action — restarting today's way (re-importing the program
  file with a refreshed `startDate`) becomes safe as a side effect of this
  issue; a friendlier entry point is separate feature work, not requested here.

## Decisions

Resolved 2026-09-12, see
[decisions-spec.md](decisions-spec.md) for the full brief on each.

1. **Kind assignment** — fully automatic, same rule as `phaseOf()` today (week 1
   → calibration, week 7 → deload, else normal), computed at validation. No
   manual override in this issue; #14 owns anything other than the calendar
   deciding `kind`.
2. **Weekly cardio/check-in** — out of scope. They keep their current
   `weekKey(week)` shape; moving them to dated records is #29.
3. **"Same program run twice"** — verified via the existing `loadProgram()`
   path (`src/App.jsx:381-392`, reopening `activeProgramId` with a refreshed
   `definition.startDate`). No new "restart cycle" UI in this issue.

## Open questions

None.
