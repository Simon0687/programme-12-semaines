# Decisions - Load a program from a file (#6)

Source: spec.md
Scope: product / requirement choices only - how journals coexist, what #6 does and
does not deliver, where the file enters, and how a rejection is shown.
Implementation mechanics (the `buildProgram` / `buildPlan` signatures, how the
program bundle threads through `progression.js`, the commit split) belong to the
design round and land in a sibling `decisions.md` after `/design-tech 6`.
Status: resolved 2026-09-08 - Simon accepted every recommendation (A / A / A / A / A),
after pushing back on Q1 (see the exchange recorded there).

---

## Q1 - How two cycles coexist in storage

**Question.** The issue names this as the thing to settle first: "decide early
whether the storage key becomes `prog12_<programId>` or whether the journal carries
a reference to its program". Today one key `prog12_simon_v1` (`src/App.jsx:15`)
holds one flat journal (`src/App.jsx:30`), and week keys are `w1`..`w12`
(`wkey()`, `src/App.jsx:237`) - they would collide directly across cycles.

**Option A - One key, envelope with a `programs` map**
- What it means: the key stays `prog12_simon_v1`; its content becomes
  `{ schemaVersion: 2, activeProgramId, programs: { <id>: { definition, logs,
  cardio, checkin } } }`. This is the `{ schemaVersion, data: {…} }` envelope that
  `docs/features/1-version-data-schema-migrations/design.md` already pre-assigned
  to #6.
- Implications: `MIGRATIONS[1]` is a pure object transform, so the whole migration
  is covered by `node --test` exactly like the six existing tests in
  `test/schema.test.js`. One read on load, one write on save. The index is
  intrinsic - the map's own keys - so there is nothing to keep in sync. Every save
  rewrites all cycles.
- Pros: atomic; no separate index; migration testable today with no new tooling;
  matches #1's stated plan.
- Cons: the debounced 600 ms save (`src/App.jsx:196`) serialises every cycle, not
  just the active one - roughly 80 KB per completed 12-week cycle.

**Option B - One key per program plus an index key**
- What it means: `prog12_<programId>` per cycle, plus `prog12_active` (or a full
  index) naming the current one.
- Implications: **the storage adapter cannot enumerate keys.** `src/App.jsx:16-25`
  exposes only `get(k)` and `set(k, v)`, and the `window.storage` bridge it prefers
  may have no listing primitive at all. So the index is mandatory, and it is
  updated by a second write that is not atomic with the data write - the classic
  source of orphaned cycles (data with no index entry) and phantom ones (the
  reverse). The migration also stops being a pure function: it becomes a multi-key
  storage dance, and the repo has no DOM or storage test to cover it.
- Pros: writes scoped to the active cycle; a corrupt cycle does not endanger the
  others.
- Cons: non-atomic index synchronisation; migration untestable with current
  tooling; more moving parts for a single-user app.

**Recommendation. A.** Two independent arguments, and the weaker one was
challenged. Simon asked what happens to Option B if the test tooling is improved
first - a fair point: injecting a fake storage adapter is not a big job, and it
does neutralise the "untestable migration" objection. But the enumeration argument
survives that change entirely: with no way to list keys, Option B needs an index,
and the index needs a second non-atomic write. Option A has no index to desynchronise.
The one real cost - rewriting every cycle on each save - is negligible at this
scale, and if it ever stops being negligible, moving to Option B is itself a schema
migration, which is precisely what `src/schema.js` exists to do.

**Simon's decision.** A (2026-09-08), after the exchange above.

---

## Q2 - Is the cycle length parameterised in #6?

**Question.** #5's spec explicitly reassigned this to #6 - "Re-deriving all of that
is a transform with real regression risk and is the essence of #6". But `12` is not
one constant: it is `phaseOf()`'s boundaries (`src/progression.js:23-28`),
`setsFor()`'s week-7 deload, `blockOf()`'s week-6 split, the week-12 AMRAP rule
(`src/App.jsx:94`), `for (let w = 1; w <= 12; w++)` (`src/progression.js:34`) and
`dayIdx >= 84` (`src/App.jsx:329`).

**Option A - Out of scope; validator enforces 12**
- What it means: a definition whose `weeks` is not 12 is rejected with an explicit
  message. A follow-up issue (#9) carries the parameterisation.
- Implications: #6 still delivers everything its own acceptance criteria ask for -
  they mention loading, coexistence and migration, and say nothing about variable
  length. The engine and `test/progression.test.js` are untouched by the feature
  half of the work.
- Pros: keeps a MAJOR migration, multi-cycle storage, a definition format, a
  validator and new UI in one issue without also rewriting the progression engine;
  respects CONTRIBUTING.md's "no refactoring and feature work in the same commit".
- Cons: contradicts what #5's spec announced; the epic's "configurable program"
  ambition is only half delivered by #6.

**Option B - Parameterise in #6**
- What it means: re-derive every phase boundary, the deload week, the AMRAP week
  and the loop bounds from the definition's `weeks`.
- Implications: a large engine transform with matching test rework, landing in the
  same issue as the storage migration. If something regresses, bisecting between
  "the migration broke it" and "the phase maths broke it" is hard.
- Pros: honours #5's announcement; one issue closes the epic.
- Cons: very large regression surface; two unrelated risk sources in one release.

**Recommendation. A.** #6 is already the biggest issue in the epic. The phase
logic genuinely encodes a 12-week shape (a 6/1/5 block structure with a deload at
7), so making it variable is a design problem in its own right, not a constant
substitution - it deserves its own spec. Rejecting non-12 definitions explicitly is
honest: the file format carries `weeks` from day one, so the follow-up issue only
has to relax a validator rule, not change the format. Reversible: nothing is built
that must later be undone.

**Simon's decision.** A (2026-09-08). Simon asked for the follow-up user story to be
created alongside this spec: #9 "Make the cycle length configurable".

---

## Q3 - Ordering against #8 (backup before the first post-migration write)

**Question.** `docs/features/1-version-data-schema-migrations/design.md` names #8 a
hard prerequisite of the first real migration. `MIGRATIONS` is still empty
(`src/schema.js:19`), so #6 *is* that first migration - and it runs against Simon's
real training journal.

**Option A - Ship #8 first**
- What it means: #8 lands on `dev` before #6 starts.
- Implications: #6 begins with the safety net already in place and does not have to
  reason about it. #8 is a small isolated chore, so the delay is short.
- Pros: the backup is tested on its own, before the migration it protects exists;
  honours #1's stated prerequisite.
- Cons: #6 waits.

**Option B - Fold the backup into #6**
- What it means: #6 writes the pre-migration backup as part of its own work.
- Implications: #6 grows further, and the backup is tested in the same breath as
  the migration it is supposed to guard against - if both are wrong in the same
  way, nothing catches it.
- Pros: one branch.
- Cons: the safety net and the hazard ship together.

**Option C - Skip it**
- What it means: migrate with no backup.
- Implications: a bug in `MIGRATIONS[1]` destroys a real journal with no way back.
- Pros: fastest.
- Cons: unacceptable for the one dataset that cannot be regenerated.

**Recommendation. A.** #8 is small, already specified as a prerequisite, and
protects the exact event #6 introduces.

**Simon's decision.** A (2026-09-08).

---

## Q4 - How the program file enters the app

**Question.** The issue is titled "Load a program **from a file**", but the app has
no file input anywhere - import is clipboard/textarea only (`src/App.jsx:463-471`).

**Option A - A real `<input type="file">` in its own Plan block**
- What it means: a "Charger un programme" button with
  `accept="application/json"`, in a new "Programme" section separate from the
  existing "Données : sauvegarde et restauration" block.
- Implications: the program path and the journal path have separate validation and
  separate error messages, so #6 and #7 do not collide.
- Pros: matches the issue title; works well on a phone, which is how the app is
  actually used; no interference with #7.
- Cons: one new UI affordance to style and test.

**Option B - Reuse the paste textarea**
- What it means: a second button next to "Importer".
- Implications: `src/App.jsx:316` (`if (!parsed.logs) throw`) turns any program
  file into the misleading toast "JSON invalide" - #7's exact complaint, made worse.
- Pros: no new UI.
- Cons: actively aggravates a known open bug.

**Option C - Both**
- Pros: more flexible.
- Cons: two entry paths to validate and test, for one user.

**Recommendation. A.**

**Simon's decision.** A (2026-09-08).

---

## Q5 - How a rejected program file is reported

**Question.** #6's acceptance criteria require "An invalid program file is rejected
with an explicit message", but the app's only mechanism is `showToast()`, which
disappears after 2.5 s (`src/App.jsx:236`). #1's design already deferred "a
persistent inline error line for a rejected import" to #7.

**Option A - #6 ships a persistent inline error for the program loader**
- What it means: a red line under the file button naming the specific reason,
  staying until the next attempt. #7 keeps its own scope: the journal import path.
- Implications: a small amount of UI that #7 can later generalise into a shared
  component.
- Pros: #6 meets its own acceptance criterion without depending on #7; the two
  error paths stay independent, matching Q4.
- Cons: two similar error affordances exist until #7 unifies them.

**Option B - Make #6 depend on #7**
- Implications: adds a second prerequisite in front of #6 (alongside #8) for a
  message #6 could ship in a few lines.
- Cons: serialises three issues.

**Recommendation. A.** A validator that knows *why* it refused should say so; a
toast that vanishes mid-read is not "explicit". Reversible: when #7 builds the
shared error line, this one is replaced by it.

**Simon's decision.** A (2026-09-08).

**Amended 2026-09-08, same day.** The question was decided on the belief that #7 was
still open. It is not: #7 is implemented on `feat/7-persistent-import-error` and
already ships `src/import.js` with the typed verdict `{ ok, reason, message }`, an
`IMPORT_MESSAGES` table, and the persistent `role="alert"` line in the Plan panel
(`src/App.jsx:469`). Its module header even reserves the slot - "#6 y ajoutera
parseProgramImport(), même forme de verdict" (`src/import.js:17`).

The decision's *intent* stands - a rejected program file gets an explicit, persistent
reason - but its *cost* collapses: #6 builds nothing, it adds
`parseProgramImport(text)` next to `parseJournalImport(text)` and reuses the existing
line. The "two similar error affordances until #7 unifies them" con disappears, and
so does the Option B / Option C tradeoff, since #7 is no longer a thing to wait for.
`design.md` reflects the amended version.

---

## How to apply

The answers are already folded into `spec.md`: **## Open questions** lists them as
resolved, Scope reflects Q2 (cycle length out) and Q4 (file picker), the
**Data & storage impact** section describes Q1's envelope, and the acceptance
criteria carry Q5's persistent message. `design.md` is written assuming
A / A / A / A / A. If Q1 were ever revisited toward Option B, the design's storage
section and the shape of `MIGRATIONS[1]` change together, and a storage-test tooling
task becomes a prerequisite.
