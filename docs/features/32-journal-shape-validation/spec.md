# Spec - Journal shape is unvalidated on load and on paste, locking the app on the spinner (#32)

## Context

The journal has three entry doors and only one is guarded. A program *file* goes
through `validateProgram` ([src/import.js:84](../../../src/import.js)); the
**stored** journal and the **pasted** journal go through neither. Since #26
pinned the definition into every journal entry, that definition is what the app
executes, so an unchecked one is no longer a stale reference - it is the program.
A stored journal that makes `loadJournal` throw never reaches `setLoaded(true)`
([src/App.jsx:233](../../../src/App.jsx)), so the app holds on
"Chargement du journal…" forever, with the repair panel rendered below that early
return - unreachable. Issue: #32, `priority: high`, one of the two blockers
before the 2.0.0 release that #26's `BREAKING CHANGE` forces.

## Scope

- **In:**
  - One **pure, shared shape validator** for the journal envelope: `programs` is
    a plain object, each program entry is an object, `definition` / `logs` /
    `cardio` / `checkin` have the right shape, log entries are well formed.
  - It is called by **both** `loadJournal` ([src/storage.js:40](../../../src/storage.js))
    and `parseJournalImport` ([src/import.js:37](../../../src/import.js)), so the
    two doors cannot drift apart again.
  - A **definition arriving inside a pasted journal** goes through the same
    program shape check as one arriving as a file (`validateProgram`).
  - **No throw escapes `loadJournal` for any JSON input.** The spinner is never
    terminal: every rejection becomes a verdict the app already knows how to
    render.
  - **Compatibility tests first**: real v1, v2, v3 and v4 journals pinned as
    accepted *before* any tightening lands.
  - **The active program's definition is held to the same bar as a pasted file**
    (full `validateProgram`); inactive cycles get the envelope check only
    (decisions-spec Q2).
  - **Proportionate rejection** (Q3): the envelope is fatal, a malformed **log
    row** is dropped from the loaded journal with a visible count, a malformed
    **inactive cycle** stays stored but cannot be activated.
  - **`saveJournal` runs the same envelope check** and refuses to write a journal
    that fails it, reusing the existing failure verdict (Q4).
  - **The last read-time fallback stops drifting** (Q1): `buildProgram` resolves a
    definition with no `program` to `LEGACY_DEFINITION` - a fixed historical
    value - instead of `DEFAULT_DEFINITION`, whatever ships today.
- **Out:**
  - Per-field hardening of `validateProgram` (`day`, `reps`, set counts, tuple
    shape, duplicate session ids) - that is **#33**, shipped alongside but
    separately.
  - Any semantic judgement: whether loads, dates or volumes make sense.
  - Repairing a rejected journal automatically. A rejection is a refusal to
    load, never a rewrite - the pre-migration backup rules (#8) are untouched.
  - A dedicated recovery screen, or any redesign of the Plan "Données" panel.
  - The Plan-tab / cardio content contract for loaded programs - that is #34.

## User-facing behaviour

Nominal case, every tab: **nothing changes.** A valid journal - stored or pasted -
loads exactly as today.

- **Séance / Semaine / Bilan:** unchanged. These tabs are only reached once a
  journal has loaded, which is precisely what this issue guarantees.
- **Boot, invalid stored journal:** instead of an endless "Chargement du journal…",
  the app finishes loading, falls back to the empty bundled state, and displays a
  persistent message - "Le journal enregistré n'a pas pu être lu. Rien n'a été
  chargé, rien n'a été écrasé." (reworded from
  [src/App.jsx:31](../../../src/App.jsx), which claims a migration that did not
  happen - Q5) - with saving blocked, so the stored journal is never overwritten.
- **Boot, journal loaded with rows dropped:** a toast states how many log entries
  were unreadable and were left out. Silence here would be data loss the user
  never hears about, which is the one thing this behaviour must not do.
- **Plan → Programme:** a stored cycle whose definition is malformed still appears
  in the cycle selector but is disabled, so it cannot become the active program.
- **Plan → Données:** the panel is reachable in that state, which is what makes
  the pasted-journal escape hatch (#12) work as documented.
- **Plan → Données, rejected paste:** the existing `role="alert"` line shows a
  message naming what is wrong, in the same place and style as today's import
  errors. The textarea keeps its content.

## Acceptance criteria

- [ ] Given a stored journal of `{"schemaVersion":4}` (no `activeProgramId`, no
      `programs`), when the app boots, then the Plan tab is reachable and the
      load-error message is shown - the spinner does not persist.
- [ ] Given a stored journal whose `programs` is `null`, `"texte"`, an array, or
      absent, when the app boots, then `loadJournal` returns
      `{ ok: false, reason: "invalid" }` and does not throw.
- [ ] Given a stored journal whose `logs`, `cardio` or `checkin` is not an object,
      when the app boots, then it is rejected as `invalid` rather than accepted
      and crashed later in `history()` / `findLog`.
- [ ] Given a pasted journal carrying `definition: { id: "x", weeks: "douze",
      startDate: "pas-une-date", program: "n_importe_quoi" }`, when it is
      imported, then it is rejected with a `reason` + `message`, and the same
      definition offered as a program **file** is rejected for the same reason.
- [ ] Given a pasted journal of `{ "logs": {}, "programs": { "p1": {} } }`, when
      it is imported, then it is rejected - today it is accepted.
- [ ] Given a real v1, v2, v3 and v4 journal, when loaded, then each still loads
      with its logs intact. (Written and green **before** the tightening.)
- [ ] Given any JSON whatsoever, when passed to `loadJournal` or
      `parseJournalImport`, then the call returns a verdict and never throws.
- [ ] Given a journal whose active definition would be rejected as a pasted file,
      when the app boots, then it is rejected too - the three doors agree.
- [ ] Given a journal with one malformed log row among valid ones, when it loads,
      then the valid rows are present, the bad row is absent, and the user is told
      how many were dropped.
- [ ] Given a journal whose *inactive* cycle is malformed, when the app boots,
      then the active cycle works and the malformed cycle cannot be selected.
- [ ] Given `saveJournal(store, key, {})`, when it runs, then nothing is written
      and the call reports failure - today it writes `{"schemaVersion":4}`.
- [ ] Given a definition with no `program` field, when it is built, then it
      resolves to `LEGACY_DEFINITION`, not to whatever the app currently bundles.
- [ ] `npm test` green, including the existing #10, #20, #21, #25 and #26 cases.

## Data & storage impact

**No change to the journal's shape.** No new field, no rename, no
`SCHEMA_VERSION` bump, no migration: this issue only changes which stored values
are *accepted*.

Level: **PATCH** per [CONTRIBUTING.md](../../../CONTRIBUTING.md) - a `fix` with no
change to intended behaviour, released inside the 2.0.0 that #26 already forces.

The conditional matters more than the label: PATCH holds **only if every journal a
previous version could legitimately write still loads**. The compatibility tests
are what proves it. If a real journal shape turns out to need rejecting, the level
becomes MAJOR and a repairing migration is required instead - which is why those
tests come first, not last.

Verified while writing this spec: both shipped definitions
(`public/programs/haut-bas-5j.json`, `public/programs/upper-lower-4j.json`),
`LEGACY_DEFINITION` and `DEFAULT_DEFINITION` all pass `parseProgramImport`
unchanged - so validating a stored definition at the same severity as a file
rejects none of them.

## Edge cases

- **First use, no key at all:** stays `reason: "absent"`; the empty bundled
  journal is not a rejection and must not become one.
- **A journal mid-migration (v1 → v4):** the shape check runs on the *migrated*
  object, so a v1 journal is judged on what it becomes, not on what it was.
- **A non-active program is malformed:** a journal can hold several cycles (#6).
  Rejecting the whole journal because an *inactive* cycle is malformed would lock
  out a user whose current cycle is fine - see Q3.
- **A single malformed log entry** (`logs: { a: 42 }`) is already ignored by
  `history()` rather than fatal. Rejecting the entire journal over one bad row
  would trade a harmless anomaly for total loss of access - see Q3.
- **Storage unavailable** (`no-store`) and **too-new** journals keep their current
  verdicts and messages; this issue adds no new user-facing state.
- **`cardio: 42`** does not crash today but is silently replaced by an object on
  the first write (`{ ...st.cardio }` on a number yields `{}`), so it is a shape
  error worth catching at the door.
- **The app can write the worst case itself.** Verified: `saveJournal(store, key,
  {})` writes literally `{"schemaVersion":4}`, because `withVersion` drops
  `undefined` fields at `JSON.stringify`
  ([src/schema.js:28](../../../src/schema.js)) - exactly the input that locks the
  spinner at the next boot. No hand-edited journal is needed to reach the failure
  this issue fixes, which is why the write is guarded too (Q4).

## Out of scope / follow-ups

- **Pinning `program` into pre-#25 definitions.** Q1 settled the drift by freezing
  the fallback on `LEGACY_DEFINITION`; removing the fallback entirely means
  rejecting stored definitions without `program` and migrating them, which the app
  can only do by guessing. Worth its own issue if the exception ever bites.
- `handleProgramFile` swallows a throw from the file path
  ([src/App.jsx:412](../../../src/App.jsx)) - owned by **#33**.
- The log entry shape (`date`, `slot`, `ex`, `done`, `kind`) has never been
  written down as a contract anywhere; `docs/ARCHITECTURE.md` is the place, once
  this validator fixes it in code.

## Open questions

**None** - the five raised here were answered on 2026-09-12 and are recorded, with
their options and consequences, in [decisions-spec.md](decisions-spec.md). Their
outcomes are folded into Scope, User-facing behaviour and Acceptance criteria
above. The remaining question (where the validator lives) is an implementation
choice and belongs to `/design-tech 32`.

<details>
<summary>Original questions, for the record</summary>

1. **How severe is the stored side?** Two defensible bars: (a) *anti-crash only* -
   reject only what would throw or render a degenerate bundle; (b) *same bar as a
   pasted file* - run the full `validateProgram` on every stored definition. (b)
   is more coherent and rejects none of today's shipped definitions, but the risk
   is asymmetric: a false rejection costs a user access to real training history,
   a false acceptance costs one crash and a reload. Recommendation: (b) for the
   **active** program, (a) for the envelope, with the compatibility tests as the
   gate.
2. **Does a rejected stored journal keep the existing message, or get its own?**
   Today's text says the journal "n'a pas pu être mis à jour vers le format
   actuel", which is accurate for a migration failure and misleading for a
   malformed shape. Reuse it, or add a second one?
3. **Whole-journal rejection, or per-entry skip?** For a malformed *inactive*
   program, or a single malformed log row - reject everything (safe, brutal), or
   drop the offending entry and load the rest (forgiving, but it silently hides
   data loss)? This is the decision that most changes the design.
4. **Does `saveJournal` get the same guard on the way out?** Refusing to write a
   journal that fails the validator closes the self-inflicted path found above,
   but a write that refuses itself needs its own user-visible verdict.
5. **Where does the validator live?** `schema.js` is a leaf module and already
   owns the journal's shape (`emptyJournal`, `withVersion`), which makes it the
   natural home; `import.js` already owns `validateProgram` but imports
   `registry.js` and `definition.js`. The answer decides whether `schema.js`
   stays a leaf - an invariant `docs/ARCHITECTURE.md` calls load-bearing.

</details>
