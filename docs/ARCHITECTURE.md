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
| `import` | `schema`, `definition`, `registry` |
| `storage` | `schema`, `backup` |
| `program` | `registry`, `cardio`, `default-program` |
| `definition` | `default-program` |
| `plan` | `registry` |
| `schema`, `registry`, `progression`, `cardio`, `backup`, `default-program`, `legacy-program` | nothing |

`progression.js`, `registry.js`, `cardio.js`, `backup.js`, `schema.js` and
`legacy-program.js` import nothing from the app. `schema.js` being a leaf is
load-bearing: it is why migrations take their program knowledge through an
injected `ctx` instead of importing `program.js`, and why adding a migration
never risks an import cycle.

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

Cardio and weekly check-in still use `weekKey(week)`. That is a known exception,
tracked by #29, not a second convention worth copying.

### 2.4 Frontiers return verdicts; they do not throw

Every boundary that accepts foreign data - stored JSON, a pasted journal, a
program file - returns `{ ok: false, reason }`, and `reason` is what tests assert
on so that rewording a message cannot break the suite. `migrate()` catches a
throwing migration step and turns it into `{ ok: false, invalid: true }` for the
same reason: no caller should need its own `try`/`catch` to stay closed by
default.

**This invariant is currently violated in two places**, both tracked: a
structurally invalid stored journal can throw out of `loadJournal` (#32), and a
malformed `session.ex` can throw out of `validateProgram` (#33). They are bugs
against this rule, not exceptions to it.

### 2.5 The exercise registry is closed

A program references exercises by id, and every id must exist in
`EXERCISE_IDS` (`src/registry.js`). Nothing may invent an exercise on the way in
- which is what makes a generated program checkable at all, and why #25 built the
registry before #19 could generate anything.

### 2.6 Domain modules never import React

Only `App.jsx` and `main.jsx` do. Every other module in `src/` loads under
`node --test` as it is, which is why the suite runs without a DOM, a renderer or
a build step.

The corollary is a rule about where code goes: anything that can be decided
without rendering belongs outside `App.jsx`. What remains inside it today
(display formatting, summary text) is debt, tracked by #23.

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
  validated in the app. A model proposes and explains, the app verifies and
  remembers, the user decides. The generation contracts implementing this split
  are in [docs/generation/README.md](generation/README.md).

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
