# Decisions - Move the journal to a dated, append-only timeline (#16)

Source: spec.md
Scope: product / requirement choices only. No design.md exists yet; the
implementation choices these decisions unlock (migration code shape, where
`id`s are generated, exact `MIGRATIONS[2]` structure) belong to design-tech and
are not addressed here.
Status: awaiting Simon's answers

## Q1 - How is a session's `kind` decided?

**Question.** `kind` (`normal | deload | calibration | test`) is the field that
replaces `week === 7` as the engine's safeguard
(`src/progression.js:56-59,65-66,77,88`). The spec proposes it is set
automatically at validation time from the session's position in the current
cycle — the same rule `phaseOf(week)` already applies today (week 1 →
calibration, week 7 → deload, everything else → normal) — with no manual
override yet. Left unanswered, design-tech would have to guess whether it also
needs to build a "mark this session as a deload/test" control in the Séance tab.

**Option A - Fully automatic, same rule as today**
- What it means: at validation (`src/App.jsx`'s `validate()`, currently around
  line 294), the app computes the equivalent of `phaseOf(week).id` from the
  session's real-time position in `journal.programs[activeProgramId].definition`
  and stores it as `kind`. No new UI.
- Implications: zero new interaction surface; `kind: "test"` is accepted by the
  engine (per the spec's acceptance criteria) but nothing in the app can ever
  produce one yet — it stays a value the engine tolerates, not a reachable
  state. #14 (deload-by-signal) is the issue that adds a way to set `kind`
  other than the calendar.
- Pros: keeps #16 to a pure data-model change, matching its own acceptance
  criteria exactly (they never mention a UI control). Smallest diff, easiest to
  verify against the existing `test/progression.test.js` fixtures.
- Cons: `kind: "test"` ships unreachable until some later issue adds a producer
  - dead code path, technically, until then.

**Option B - Automatic + a manual override now**
- What it means: same automatic default, plus a control (e.g. a dropdown on the
  session view) letting the user override `kind` before validating.
- Implications: new UI on the Séance tab, new state to wire through
  `validate()`, and a decision about which kinds are user-selectable (probably
  not `deload`, to avoid conflicting with #14's future signal-driven logic).
  Widens this issue's surface into product design territory explicitly deferred
  to #14 by the issue body ("Blocks: #14").
- Pros: makes `kind: "test"` reachable immediately, useful today if Simon wants
  to log a max-effort session before #14 exists.
- Cons: duplicates work #14 is scoped to do; risks the two issues disagreeing
  on how manual overrides should work.

**Recommendation.** A. The issue explicitly lists #14 as the follow-up that
handles anything other than the calendar deciding `kind`; building that control
here would pre-empt a decision #14 is meant to make. Reversible: adding a
manual override later is additive (a new control writing to the same field),
not a rework of the data model this issue lands.

**Simon's decision.** _(left blank for Simon)_

## Q2 - Do weekly cardio and check-in move to dated records too?

**Question.** `cardio[weekKey(week)]` and `checkin[weekKey(week)]`
(`src/App.jsx:312-314,322-323,417-418`) have the exact same "second cycle
overwrites the first" flaw as session logs, but the issue's acceptance criteria
only mention "sessions." Left unanswered, design-tech would have to guess
whether to fold these into the same migration or leave them for later.

**Option A - Leave them on `weekKey`, out of scope for #16**
- What it means: only `logs` moves to dated records in this issue; `cardio` and
  `checkin` keep their current week-relative shape and the same overwrite
  behaviour they have today.
- Implications: `planned()`/`history()` never read `cardio`/`checkin` today (a
  grep of `src/progression.js` confirms neither name appears there) - so this
  gap does not touch the engine's correctness, only `bilanText()`
  (`src/App.jsx:321-334`) and the "Semaine"/"Bilan" tabs' display, which already
  tolerate a second cycle's week 1 quietly reusing the first's slot. A follow-up
  issue can port them once #16's pattern exists to copy.
- Pros: keeps #16's diff to exactly what its own acceptance criteria test;
  avoids widening a MAJOR migration's surface right before it needs to run
  against Simon's real journal.
- Cons: the overwrite bug survives for cardio/check-in until a follow-up lands.

**Option B - Migrate them to dated records in the same pass**
- What it means: `MIGRATIONS[2]` also rewrites `cardio`/`checkin` into
  date-keyed entries (e.g. `date = startDate + 7 × (week − 1)`, no slot offset
  needed since they are once-per-week).
- Implications: touches `setCardio`, `toggleMob`, `setCheck`, `bilanText`, and
  the "Semaine"/"Bilan" render paths in the same commit as the session-log
  change - the "one concern per commit" rule in CONTRIBUTING.md gets harder to
  hold, and `test/progression.test.js`'s `S()` fixture (which sets `cardio: {}`,
  `checkin: {}`, per `test/progression.test.js:30-31`) would need matching
  fixtures for cardio/checkin, currently untested at all.
- Pros: fully closes the overwrite bug in one migration instead of two; the
  dated-record pattern is designed once instead of twice.
- Cons: larger, riskier migration to validate against a real ten-year-old
  journal that does not exist yet to test against; mixes a fix for a bug that
  is cosmetic today (a display quirk) with one that corrupts training data
  (session logs).

**Recommendation.** A. The engine's correctness - the actual reason #16 exists
- depends only on session logs; cardio/check-in overwriting is a display
  annoyance, not a data-integrity or progression-safety problem. Reversible:
  Option B's migration can be added as `MIGRATIONS[3]` later, following the
  exact shape this issue establishes for logs, without touching this issue's
  work.

**Simon's decision.** _(left blank for Simon)_

## Q3 - What counts as "running the same program twice" for the acceptance test?

**Question.** The spec identifies the concrete overwrite path as
`loadProgram()` (`src/App.jsx:381-392`): reopening `activeProgramId` with a
refreshed `definition.startDate` keeps the existing `logs` object but resets
`curWeek` to 1, so the next validated session reuses `w1_hautA`. There is no
other path in the app today that resets a cycle in place. Left unanswered,
it's unclear whether verifying the "append, don't overwrite" criterion against
that existing (somewhat obscure) path is enough, or whether #16 should also add
a more direct "restart this cycle" action.

**Option A - Test against the existing `loadProgram()` path only**
- What it means: the acceptance criterion is verified by calling `loadProgram`
  with the same `definition.id` and a new `startDate` (exactly how re-importing
  a program file today works), and checking both cycles' logs survive.
- Implications: no new UI or entry point. Whatever manual step Simon uses today
  to start a new mesocycle (re-importing the definition file with an updated
  `startDate`) becomes safe as a side effect of this issue, without the issue
  building a button for it.
- Pros: matches the issue's own scope (a storage/engine change, not a new
  feature); no feature-work-and-refactor mixing per CONTRIBUTING.md.
- Cons: restarting a cycle stays as awkward as it is today (re-import a file) -
  #16 fixes the data-loss risk but not the ergonomics.

**Option B - Add an explicit "restart cycle" action in this issue**
- What it means: a new button/flow that bumps `definition.startDate` to today
  for the active program without requiring a file re-import.
- Implications: new UI, new interaction to design and test, on top of an
  already-MAJOR migration. Not requested anywhere in the issue body.
- Pros: makes the fixed behaviour immediately usable day-to-day.
- Cons: pure feature work bolted onto a data-model issue; better scoped as its
  own follow-up once #16's model exists to build it on.

**Recommendation.** A. Nothing in the issue's acceptance criteria asks for a new
way to restart a cycle - only that doing so (however it happens) stops losing
data. Reversible: a "restart cycle" button is a thin, independent addition on
top of whatever #16 ships; it does not depend on any choice made here.

**Simon's decision.** _(left blank for Simon)_

## How to apply

Once Simon fills in each "Simon's decision", the answers fold back into
spec.md: Q1-Q3 move out of Open questions into the relevant sections (Scope,
User-facing behaviour, Acceptance criteria), and spec.md's Open questions ends
as "None" - at which point `/design-tech 16` can proceed.
