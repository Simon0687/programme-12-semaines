# Architecture

The rules that hold across modules, and that no single file states on its own.

This is not a module reference - every file in `src/` opens with a header that
states its own contract and non-goals, and those headers are the authority on
what a module does. This document covers what survives *between* them: the shape
of the data flow, the invariants any change has to preserve, and the things we
have decided not to build.

Related, and deliberately not repeated here:

| Document | Covers |
|---|---|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | process, commits, versioning rules, pre-migration backups |
| [WORKFLOW.md](../WORKFLOW.md) | branches, CI/CD, releases |
| [.claude/WORKFLOW.md](../.claude/WORKFLOW.md) | how much documentation an issue needs (A/B/C) |
| [docs/generation/README.md](generation/README.md) | the three JSON contracts of program generation |
| `docs/features/<n>-<slug>/` | why one specific issue was decided the way it was |

---

## 1. The flow

One direction, no cycles:

```
localStorage ──► storage.js ──► schema.js ──► journal ──► program.js ──► App.jsx
   (store)        verdict        migrate      {activeProgramId,  bundle     render
                                              programs}
                                                   │
                                       definition ─┘ (pinned, #26)
```

Module dependencies, as they actually stand - every edge, no others:

| Module | Imports |
|---|---|
| `import` | `schema`, `definition`, `journal-shape` |
| `storage` | `schema`, `backup`, `journal-shape` |
| `journal-shape` | `registry`, `definition` |
| `program` | `registry`, `cardio`, `legacy-program` |
| `definition` | `default-program` |
| `plan` | `registry` |
| `display` | `progression` |
| `exercise-history` | `progression` |
| `schema`, `registry`, `progression`, `cardio`, `backup`, `default-program`, `legacy-program`, `file-io`, `export-state`, `bilan`, `screen-state` | nothing |

`progression.js`, `registry.js`, `cardio.js`, `backup.js`, `schema.js` and
`legacy-program.js` import nothing from the app. `schema.js` being a leaf is
load-bearing: it is why migrations take their program knowledge through an
injected `ctx` instead of importing `program.js`, and why adding a migration
never risks an import cycle.

`display.js` and `exercise-history.js` (#17) both sit *above* `progression.js`
and never the reverse: the engine stays a leaf. That is why `setSummary()` moved
to `display.js` rather than next to `loadText()` as #23 expected, and why
`loadText()` did not move at all - `planned()` calls it, so following #23 to the
letter would have made a leaf of the engine import a view module.

`journal-shape.js` (#32) is the one module both import doors and the storage
adapter depend on - see 2.9. It was made a separate module rather than an
addition to `schema.js` precisely to protect that leaf status: judging a
definition needs `EXERCISE_IDS`, and importing `registry.js` into `schema.js`
would have ended it.

`program.js` depends on `legacy-program` and not on `default-program`: its
fallback for a definition with no `program` field must resolve to a frozen
historical value, never to whatever the app currently bundles (2.1).

---

## 2. Invariants

### 2.1 No stored value may depend on what the code currently ships

**A fallback resolved at read time re-interprets history when the fallback
changes.**

This is the most expensive lesson the project has learned. `definition: null`
inside a stored journal meant "the program bundled with the app". It was a
*reference*, resolved on every load - so the day the bundled program changed,
every past session was silently re-read against a program it was never performed
under. Sessions kept their numbers and lost their meaning.

#26 closed it by pinning the definition into each journal entry. The general rule
outlives the incident:

> Any default that is resolved at read time is a promise that the default will
> never change. Store the value, not the reference.

It applies well beyond definitions - to exercise ids, to phase rules, to anything
a stored record points at by name.

Corollary, and the reason `CONTRIBUTING.md` calls the journal format the
compatibility contract: **the same JSON shape can change meaning without changing
shape.** A migration is needed whenever the *interpretation* of stored data
moves, not only when its fields do.

### 2.2 The journal records what happened, never what was planned

Logs hold `{ id, date, slot, kind, ex, notes, done, deletedAt }` - performed
sets, reps and RIR. Prescribed loads are never written. `planned()`
(`src/progression.js`) recomputes them from history on every render.

That is what allows the progression rules to be fixed, or a program to be
reloaded, without rewriting the past. A stored prescription would freeze a
decision made by a version of the engine nobody can reconstruct later.

### 2.3 Sessions are identified by real date, not by cycle position

Since #16, a log's identity is `(date, slot)`, with `date` derived from
`startDate + 7×(week−1) + (day−1)` (`dateForSlot`). Two passes through the same
program therefore never collide, and `kind` (`calibration` / `deload` /
`normal`) is stamped at write time rather than re-derived from a week number.

**A log's date is its slot's date, not the day it was performed.** Someone who
trains a day early still fills the slot they trained for, so the migration from a
v1 journal re-dates each session onto its slot - anything else would hide it from
`findLog`, which looks sessions up at `dateForSlot(...)`, and invite a duplicate
entry. The original validation date is not discarded: it is carried into
`updatedAt`, which is what the Séance screen renders as "Validée le …" (#40).

Cardio and weekly check-in still use `weekKey(week)`. That is a known exception,
tracked by #29, not a second convention worth copying.

Two consequences the format has to guarantee, both enforced by the validator
since #33:

- **`SESSIONS[].id` must be unique within a program.** `findLog` returns the
  first match, so a duplicate id makes the second session unreachable - the
  failure that sank the first #26 attempt.
- **`day` must be an integer in 1-7**, because `dateForSlot` reads it as a
  1-based offset from `startDate`. Anything else produced `"NaN-NaN-NaN"`, and
  since the date *is* the identity, those rows were unreachable rather than
  merely mislabelled.

**Known contradiction, not yet resolved:** `App.jsx` matches today's session with
`SESSIONS[].day === today.getDay()`, where Sunday is `0` - a different convention
from the offset `dateForSlot` uses. The two agree only because both shipped
programs start on a Monday. A program starting mid-week has its whole calendar
mapping shifted, and a Sunday session cannot be expressed correctly. Documented
in `docs/features/33-program-validator-per-field/decisions-spec.md` Q2; it needs
its own issue before a generated program can start on any other day.

### 2.4 Frontiers return verdicts; they do not throw

Every boundary that accepts foreign data - stored JSON, a pasted journal, a
program file - returns `{ ok: false, reason }`, and `reason` is what tests assert
on so that rewording a message cannot break the suite. `migrate()` catches a
throwing migration step and turns it into `{ ok: false, invalid: true }` for the
same reason: no caller should need its own `try`/`catch` to stay closed by
default.

**One known gap, and it predates #17.** `isLogRow` (`journal-shape.js`) checks
that a log row has a `date`, a `slot`, and that `ex` is an object - it never
looks *inside* `ex`. A row where `ex.dc` holds the string `"87,5"` passes the
filter and makes `history()` throw `TypeError: ... .map is not a function`
(verified 2026-09-14, on the active program). A frontier therefore admits a row
the engine then throws on. `exercise-history.js` is closed by default on that
payload; tightening `isLogRow` would change a frontier verdict and start
dropping rows at load, so it is tracked by #38 rather than shipped alongside a
screen.

Everything else holds. #32 closed the stored-journal half (see 2.9) and #33
closed the last one: `validateProgram` destructures no pair it has not checked
first, so it returns a verdict for any JSON input. The invariant is exercised,
not merely asserted - `test/journal-shape.test.js` runs every validator over
deliberately malformed programs, which is what the earlier version of that suite
failed to do.

### 2.5 The exercise registry is closed

A program references exercises by id, and every id must exist in
`EXERCISE_IDS` (`src/registry.js`). Nothing may invent an exercise on the way in
- which is what makes a generated program checkable at all, and why #25 built the
registry before #19 could generate anything.

### 2.6 Domain modules never import React

A file that imports React emits markup and wires events; every value it displays
is computed by a module that loads under `node --test`. That is why the suite
runs without a DOM, a renderer or a build step - and it is the bar a new
component file has to clear, not a fixed list of filenames.

The rule used to read "only `App.jsx` and `main.jsx`". #17 added
`ExerciseSheet.jsx` and changed the *wording* rather than the list, on purpose:
a list of two watches itself, a list of three stops watching itself, and each
addition is individually justifiable. A rule about content forbids what actually
needs forbidding. `chartGeometry()` (`display.js`) is the test case - the
sheet’s chart is forty lines of arithmetic, unit-tested without a DOM, and the
component only turns its output into `<svg>`.

The second reason that file exists is enforcement of a different kind.
`ExerciseSheet` takes four props - journal, exerciseId, backLabel, onBack - and
neither `prog`, `week` nor `session`. Inside `App.jsx` all three are lexically
in scope, so "the sheet needs no session context" would have been an
honour-system claim; a prop list makes it checkable.

The corollary is a rule about where code goes: anything that can be decided
without rendering belongs outside a component. What remains inside `App.jsx`
today is debt, tracked by #23; `setSummary()` left with #17.

### 2.7 The store is injected, never reached for

`storage.js` and `backup.js` take a store object as a parameter. Neither touches
`window.localStorage` at module level. That is the whole reason the load, save,
migrate and backup paths are unit-tested against an in-memory fake, including
their failure modes.

### 2.8 One declaration per shared constant

`SCHEMA_VERSION` is declared in `src/schema.js` and nowhere else; save and export
read it from there. `MIGRATIONS[n]` never stamps the version itself - `migrate()`
does it once, at the end of the chain. A second declaration of a version number
is how two shapes end up sharing one number, which no migration can then
untangle.

### 2.9 Every door into the journal goes through one validator

Three doors accept a journal or a definition: the stored journal (`loadJournal`),
a pasted journal (`parseJournalImport`), a program file (`parseProgramImport`).
Since #32 all three call `src/journal-shape.js`, and none of them judges shape on
its own.

The rule is not "validate the input" - it is **one callee, so the bar cannot
drift**. Before #32 only the file door was guarded; the pasted door, which is the
documented escape hatch from a blocked store (#12), had no validator at all, and
a definition rejected as a file installed happily inside a pasted journal.

Three consequences worth keeping:

- **The write is a door too.** `saveJournal` runs the same envelope check, because
  `withVersion({})` serialises to `{"schemaVersion":4}` - the very value that made
  the load throw. Without the guard, a state bug could store a journal the loader
  refuses to read.
- **Severity is graded, not uniform.** The envelope and the *active* definition are
  fatal; an inactive cycle that fails only becomes unselectable; an unreadable log
  row is dropped. Rejecting a whole journal over one bad row would trade an
  anomaly for the loss of years of history.
- **Dropping is never silent, and never destructive.** The count is surfaced, and
  the original bytes are copied to `<key>_backup_dropped` before the filtered
  journal can be rewritten - the same rule as a pre-migration backup (#8): a
  rejection is never a rewrite.

---

## 3. Non-goals

- **No backend, no account, no sync.** Data lives in the browser, on one device.
  Recorded in #18, with the argument that matters: *durability is not
  multi-user*. Losing data on a cleared browser is solved by real file export,
  the share sheet and `navigator.storage.persist()` (#15) - none of which needs a
  server. A backend becomes a question only for multi-device or multi-athlete,
  and not before.
- **No global store, no reducer.** State stays local to `App.jsx` with pure
  modules underneath. Re-evaluated after every extraction so far, including by
  two outside audits in September 2026, and declined each time as
  over-architecture for the current size.
- **No calculation delegated to a language model.** Volume, spacing, progression
  and registry compatibility are deterministic problems; they are computed and
  validated in the app. Since 2026-09-15 this holds one step further than it
  used to: the program itself is *composed* in the app, by hand in the editor or
  by a deterministic engine, so **the app proposes, the app verifies, and the
  user decides**. The older formula - *a model proposes and explains, the app
  verifies and remembers* - described the split while generation was delegated
  to an outside LLM; it no longer describes the main path. A model may still be
  offered as an optional way to draft a program, never as the only one, and what
  it returns enters through the same door as any other file. The generation
  contracts are in [docs/generation/README.md](generation/README.md), the choice
  itself in [docs/generation/decisions-moteur.md](generation/decisions-moteur.md).

---

## 4. Where a decision lives

An architectural choice is recorded where it was made, not restated here:

- **Per issue** - `docs/features/<n>-<slug>/decisions.md` holds the options that
  were weighed and the one that was taken. #25's records the LLM-vs-engine
  choice; #26's records why a pinned definition needed a schema version of its
  own.
- **Per review** - `docs/reviews/` holds grouped code reviews and the triage of
  outside audits, each stating what was verified and what was rejected.
- **Advisory only** - `docs/external_audit/` holds reviews produced by other AIs.
  They carry no authority: what survives verification becomes an issue, and
  nothing is applied as written.

If a rule in section 2 has to change, the decision belongs in the issue that
changes it, and this document follows.
