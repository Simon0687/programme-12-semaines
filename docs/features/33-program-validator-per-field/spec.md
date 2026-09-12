# Spec - Program validator admits definitions that log sessions at NaN dates (#33)

## Context

`validateProgram` checks that a program's ids resolve and that its containers are
the right type, but almost nothing about the *values* inside them
([src/journal-shape.js](../../../src/journal-shape.js), moved there from
`import.js` by #32). Two damages follow, and the quiet one is worse: a
`session.ex` entry that is not a two-element tuple **throws**, and a `day` that
is absent or non-numeric is **accepted**, after which every session logged under
that program is written at `"NaN-NaN-NaN"`. Since #16 the date *is* the log
identity, so those entries are not mislabelled - they are unreachable by
`findLog` and unsortable by `history()`. Issue: #33, `priority: high`, the last
blocker before the 2.0.0 release that #26's `BREAKING CHANGE` forces.

**#32 changed the blast radius, and this is new.** Before it, a throwing
`validateProgram` could only escape `handleProgramFile`'s `reader.onload`
([src/App.jsx](../../../src/App.jsx)), where it was swallowed: the panel stayed
silent and a reload recovered. Now `loadJournal` and `parseJournalImport` call
`validateDefinition`, which calls `validateProgram` - so the same malformed
definition, stored, throws out of the load effect and holds the app on
"Chargement du journal…" for good. **#32's headline promise, "no throw escapes
`loadJournal` for any JSON input", is false on exactly this input.** #33 is what
makes it true.

## Scope

- **In:** per-field validation of a `program`, with the existing `{ reason,
  message }` vocabulary and the `missing-field` / `invalid-field` /
  `invalid-program` split:
  - `session.ex` and `core.ex` entries are two-element tuples, checked **before**
    destructuring - no input reaches a `for (const [x] of …)` unguarded;
  - `day` is an integer within the week the program's own layout allows;
  - `reps` is `[min, max]` with `0 < min <= max`;
  - set counts are positive integers;
  - `startingLoads` is a plain object (the gap #32 deliberately left here);
  - `SESSIONS[].id` values are unique;
  - `after` is restricted to what the app can render (`z2`, `mob`);
  - **`validateProgram` never throws, for any JSON input.**
- **In:** `handleProgramFile` surfaces a failure instead of swallowing it, so a
  future gap degrades into a message rather than silence.
- **Out:**
  - Judging training content - whether a volume, a load or an exercise choice is
    sensible. That is the six-assertion validator of #19, a different job.
  - Relaxing `weeks === 12`, or anything about periodisation milestones (#14).
  - The journal *envelope* and the log rows - #32 owns those, shipped.
  - Repairing definitions already stored with a bad `day`. See Open questions.

## User-facing behaviour

- **Plan → Programme, loading a file:** a definition failing any rule above is
  refused with a message naming the field and the constraint, in the existing
  `role="alert"` line. Today the same file either loads and corrupts, or fails in
  complete silence.
- **Plan → Données, pasting a journal:** same rejection, same vocabulary.
- **Boot:** a stored journal whose active definition is malformed shows the
  load-error message and leaves the app usable - instead of the terminal spinner
  it produces today.
- **Everywhere else:** nothing changes. A valid program is unaffected; both
  shipped programs pass untouched.

## Acceptance criteria

- [ ] Given a program whose `session.ex` or `core.ex` holds `42` or `null`, when
      it is validated by any of the three doors, then it is rejected with a
      reason and **never throws**.
- [ ] Given a stored journal carrying such a definition, when the app boots, then
      the load-error message appears and the Plan tab is reachable - not the
      spinner.
- [ ] Given `day` absent, `99`, `"lundi"`, or a non-integer, then the program is
      rejected. Today all four are accepted.
- [ ] Given any accepted program, when a session is logged, then `dateForSlot`
      cannot produce `"NaN-NaN-NaN"` - asserted as a property over every session
      of the program, not case by case.
- [ ] Given `reps: [8, 5]`, `[-5, -1]`, or set counts `-3` / `"trois"`, then the
      program is rejected.
- [ ] Given two `SESSIONS[]` sharing an `id`, then the program is rejected.
- [ ] Given `after: "n_importe_quoi"`, then the program is rejected.
- [ ] Given `startingLoads: 5`, then the definition is rejected - today
      `Object.entries(5)` is `[]` and the loop never runs.
- [ ] Given a program file that fails validation, when it is loaded, then the
      panel shows a message - today a throw leaves it silent.
- [ ] The #20, #25 and #32 suites stay green, and the v1-v4 compatibility
      journals still load. Both shipped programs still validate.

## Data & storage impact

No change to the journal's shape, no new field, no `SCHEMA_VERSION` bump, no
migration. **PATCH** per [CONTRIBUTING.md](../../../CONTRIBUTING.md) - a `fix`
with no change to intended behaviour, released inside the 2.0.0 #26 forces.

Same condition as #32, and the same proof: the v1-v4 compatibility fixtures and
both shipped programs must stay green untouched. If a real definition has to be
rejected, the level becomes MAJOR and a repairing migration is required instead.

The asymmetry is worth stating: this issue only *adds* rejections. Every test
that passes today and still passes tomorrow is evidence the additions are safe;
the risk is entirely in over-rejection, which is why the existing suites are the
gate.

## Edge cases

- **`day` bounds depend on the program.** A 5-session week uses days 1-6 in
  Simon's program; the rule must be "an integer the program's own layout allows",
  not a hardcoded 1-7, or a legitimate Sunday session breaks.
- **`day: 99` does not produce `NaN`** - verified, it yields a real date 14 weeks
  out. So the check cannot be "does it parse"; it has to be a range.
- **Definitions already stored with a bad `day`.** Rejecting them at load means a
  journal that opens today stops opening. Its sessions are already written at
  `NaN-NaN-NaN` and already unreachable, so nothing readable is lost - but the
  user sees a working app become a refusal. See Open questions.
- **`after` is optional.** Absent must stay valid; only an unknown *value* is a
  rejection.
- **A program with no `CORE` entries, or empty `ex` arrays** - legitimate, and
  must not be caught by a "non-empty" rule written too eagerly.

## Out of scope / follow-ups

- The header of `src/journal-shape.js` claims the module "ne lève jamais, pour
  aucune entrée". That is the intent, and it becomes true with this issue; until
  then the sentence overstates. It should be corrected as part of this work
  rather than left contradicting the code.
- `test/journal-shape.test.js`'s "aucune fonction ne lève" suite passes today
  because its list of absurd inputs does not include a program with a malformed
  `session.ex`. The list should grow with the cases this issue fixes - a test
  that asserts an invariant it cannot actually exercise is worse than no test.
- Duplicate `SESSIONS[].id` has a second consequence beyond validation:
  `findLog(logs, date, slot)` returns the first match, so two sessions sharing an
  id would make the second unreachable - the same failure mode the #26 revert
  hit. Worth a line in `docs/ARCHITECTURE.md` once the rule exists.

## Open questions

1. **What happens to a journal already stored with a `NaN` date?** Three
   positions: (a) reject the definition at load, consistent with #32 and with
   this issue's own rule, but a previously-opening journal stops opening;
   (b) accept the stored definition and only reject at import, which reintroduces
   the two-bar drift #32 just removed; (c) reject, plus a migration that repairs
   or quarantines the unreachable rows. Recommendation: (a), because those rows
   are already unreachable and the escape hatch (#32) now works - with (c) kept
   as a follow-up if it ever bites in practice.
2. **How strict is `day`'s range?** Derived from the program's own sessions
   (max day present), or a fixed 1-7 per week? Recommendation: 1-7, because a
   week has seven days regardless of the program, and deriving a bound from the
   data being validated makes the rule circular.
3. **Does `after` become a closed vocabulary in the format, or stay a rendering
   concern?** `AFTER_HINTS` in `App.jsx` is the actual authority on what renders.
   Recommendation: validate against a constant exported by the module that owns
   the rendering, so the two cannot drift - the same pattern #32 used for the
   three doors.
