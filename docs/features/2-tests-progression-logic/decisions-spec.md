# Decisions - Tests for the progression logic (#2)

Source: spec.md
Scope: product / requirement choices only - what the suite must pin, and where
issue #2 stops and #3 begins. Implementation mechanics (exact file layout, export
style, `netlify.toml` keys) belong to the design round; run `/design-tech 2` after
Simon answers, and record those in a sibling `decisions.md`.
Status: awaiting Simon's answers

---

## Q1 - Where the program constants live so the engine is testable

**Question.** `node --test` cannot import `src/App.jsx` (it is JSX and pulls in
React), so `planned()`, `history()`, `lastEntry()` and `loadText()` must move to a
plain `.js` module. Their dependency closure includes the program data constants
`V`, `SLOTS` and `SESSIONS` (`history()` iterates `SESSIONS`; `planned()` reads
`SLOTS[slotId]` and `V[vid]`). Those constants are exactly what issue #3 ("Extract
the program into a data module") is meant to move. Left unanswered, #2 cannot
compile a headless test and #3's boundary stays vague.

**Option A - Engine only; keep `V`/`SLOTS`/`SESSIONS` in `App.jsx`**
- What it means: `src/progression.js` holds the engine and imports the constants
  back from `../App.jsx`.
- Implications: `App.jsx` still imports React and default-exports a component, so
  the test importing `progression.js` transitively parses JSX and loads React -
  the headless requirement fails. No workable path unless `App.jsx` is split
  anyway.
- Pros: nominally "no overlap with #3".
- Cons: does not actually work; wastes the issue.

**Option B - Engine in `src/progression.js`, data in a new `src/program.js`**
- What it means: cut `V`, `SLOTS`, `SESSIONS`, `CORE` verbatim from `App.jsx` into
  `src/program.js` with `export`; `src/progression.js` imports from
  `./program.js`; `App.jsx` imports from both. Two `refactor:` commits, no
  behaviour change, covered by the new tests.
- Implications: #2's PR creates `src/program.js` with the four data constants.
  Issue #3 continues from there - move `WARM`, `CARDIO_ITEMS`, `cardioPlan`,
  `MOB_DAYS`, the `phaseOf` editorial notes, the Plan-tab prose and the starting
  loads out of JSX, and give `program.js` its final shape. A one-line note goes on
  issue #3 ("`src/program.js` already exists, created in #2").
- Pros: smallest change that meets "headless"; the constants land in their
  permanent home, so #3 never moves the same data twice (the trap #1's spec
  called out). The epic context already treats `V`/`SLOTS`/`SESSIONS`/`CORE` as
  "partly structured"; this just gives them a file.
- Cons: #2 touches a few lines that were mentally filed under #3; some merge noise
  if #3 starts before #2 lands.

**Option C - Engine only; inject the program as a parameter**
- What it means: `planned(program, state, slotId, week, si)` and
  `history(program, state, vid)`; tests pass a fixture, `App.jsx` passes the real
  constants.
- Implications: every call site changes - `ExerciseCard`, `validate()`, the
  Semaine tab, `bilanText()`. Tests either import the real `V`/`SLOTS` (same
  problem as A) or hand-roll a fixture that silently drifts from the real
  catalogue.
- Pros: engine has zero data dependency.
- Cons: largest diff, most regression surface, and a fixture that drifts defeats
  the point of pinning real behaviour.

**Recommendation. B.** It is the only option that compiles headless without
moving the same constants twice later. Keep it mechanical: verbatim cut/paste plus
`export`/`import`, in `refactor:` commits separate from the `test:` commits, and
annotate #3. Reversible: file boundaries are cheap to shift; the only cost is
merge coordination with #3.

**Simon's decision.** _(left blank for Simon)_

---

## Q2 - Deload cut: −15% of the pending load, or of the last worked load

**Question.** In week 7, for a variant with history before week 7, `planned()`
(`src/App.jsx:210-217`) first runs the normal progression/hold branch to compute
`next`, then applies `next = roundTo(next * 0.85, v.incr)`. So a lift that was due
`+2,5 kg` gets `(load + 2,5) × 0.85`, not `load × 0.85`. The issue wording says
"−15% relative to the last non-deload week". Does the suite pin what the code does,
or is this the bug the suite should surface? Unanswered, the week-7 test has no
expected value.

**Option A - Pin current behaviour**
- What it means: the test asserts `roundTo((computed next) * 0.85, incr)` - e.g.
  `load 100`, due `+2,5` ⇒ `roundTo(102.5 * 0.85, 2.5) = 87.5`.
- Implications: zero code change in #2. If Simon later wants `load * 0.85`, that is
  a separate `fix:` issue with its own PATCH release and its own test update.
- Pros: the suite does its job - freeze today's output before #3 moves data;
  no scope creep; respects CONTRIBUTING's "no refactor + fix in one commit".
- Cons: the test encodes a slightly odd number; a future reader sees `87.5` and
  has to check why it is not `85`.
- Note: low stakes in practice - week 7 is deliberately light, and week 8 resumes
  from the pre-deload baseline (the `base.week === 7 && hist.some(e => e.week < 7)`
  recompute), so the deload figure never propagates forward.

**Option B - Treat it as a bug, fix first, then pin the fixed value**
- What it means: open a `fix(progression):` issue to change line 217 to
  `roundTo(load * 0.85, v.incr)` (deload from where you are, not from where you
  were heading); land it before or alongside #2; the suite asserts `85`.
- Implications: an extra issue and PATCH release; #2 waits on it or documents both.
- Pros: the intent ("charges −15%") reads more naturally as −15% of the current
  working load.
- Cons: scope creep on an issue whose whole point is "produces nothing visible";
  changes a suggested load that Simon may have already worked against in a real
  cycle.

**Recommendation. A.** Pin the current behaviour in #2 - the suite exists to
freeze what ships today. Add one line to the spec's follow-ups opening a
`fix(progression):` issue to reconsider the deload base. Reversible: it is one
line of code and one test assertion.

**Simon's decision.** _(left blank for Simon)_

---

## Q3 - Suitcase carry progresses by kilograms, not by time

**Question.** `V.carry` has `unit: "carry"` and `SLOTS.carry.reps` is `[30, 45]`
(seconds). `unit === "carry"` is not caught by the `unit === "time" || unit ===
"reps"` branch in `planned()`, so carry flows through the kilogram path: `load` is
the max weight logged, and once every set reaches 45 s at ≤ 1 RIR the suggestion
is `load + 2 kg`. The card shows "Prévu : X kg" with a "30–45 s" target. Intended,
or should carry behave like `sideplank` (no load, progress the duration)?

**Option A - Intended; pin it**
- What it means: the test asserts carry returns a `kg` load and progresses it by
  `V.carry.incr` (2 kg) when the duration target is met.
- Implications: none - documents current behaviour. `sideplank` (`unit: "time"`)
  and `abwheel` (`unit: "reps"`) stay the pure-bodyweight cases; carry is the
  weighted one.
- Pros: matches how a suitcase carry actually loads - you add weight once you can
  hold the distance/time; the duration is the rep target, the kilos are the load.
  No follow-up.
- Cons: three unit values (`time`, `reps`, `carry`) with `carry` behaving like
  `kg` is a small readability wart.

**Option B - Bug; carry should be duration-only**
- What it means: fold `carry` into the `time` branch (separate `fix:` issue);
  carry then shows no load and "progress +5 s".
- Implications: loses weight tracking for a loaded exercise; contradicts the cue
  ("un haltère lourd").
- Pros: only two behaviours to reason about.
- Cons: wrong model for the movement.

**Recommendation. A.** Carry is a weighted exercise; progressing the load once the
time target is hit is correct. Have the suite cover it deliberately as its own
case so the `unit: "carry"` path is not mistaken for an oversight later.
Reversible: yes, trivially.

**Simon's decision.** _(left blank for Simon)_

---

## Q4 - How a failing suite stops a deploy

**Question.** The issue requires "Netlify fails the build when tests fail". The
repo has no `netlify.toml` and no `.github/workflows/`, so the build command is
set in the Netlify dashboard. CONTRIBUTING's flow merges locally (`git checkout
main; git merge …; git push`), not through PRs, so a GitHub status check would not
block anything on its own. Where should the gate live? (Mechanism detail is for
`/design-tech 2`; this asks which mechanism.)

**Option A - `netlify.toml` with `command = "npm test && npm run build"`**
- What it means: add `netlify.toml` at the repo root with the test-then-build
  command, `publish = "public"`, and `NODE_VERSION` pinned (Node 18+ for stable
  `node --test`; the dev machine runs v24). Overrides the dashboard command for
  previews and production.
- Implications: one version-controlled file; every branch preview and the prod
  deploy run `npm test` first. Nothing else in the repo changes.
- Pros: matches the actual process - the effective gate today is "preview build
  goes red, Simon does not merge"; this makes that gate real and reviewable in
  git.
- Cons: only gates Netlify; a broken test still lets a local `npm run build`
  succeed if Simon skips `npm test` (CONTRIBUTING already forbids that).

**Option B - GitHub Actions workflow**
- What it means: `.github/workflows/test.yml` running `npm ci && npm test` on push
  and PR.
- Implications: new CI to maintain; does not block a local merge unless the repo
  adopts branch protection and PR-based merges.
- Pros: a real status check, independent of Netlify; useful if the project later
  moves to PRs.
- Cons: does not satisfy "Netlify fails the build" as written, and blocks nothing
  under the current local-merge flow.

**Option C - Both**
- Pros: belt and braces.
- Cons: two things to maintain for a solo project; premature.

**Recommendation. A.** `netlify.toml` with `command = "npm test && npm run
build"` fits the existing merge flow and is the literal reading of the acceptance
criterion. Revisit B if/when the project switches to PR-based merges. Simon to
confirm the current Netlify build command and publish directory so the toml
matches. Reversible: deleting the file restores the dashboard command.

**Simon's decision.** _(left blank for Simon)_

---

## Q5 - Rep-range boundary operators

**Question.** `planned()` uses `allTop = base.sets.every(s => s.r >= mx)` and
`lowCount = base.sets.filter(s => s.r < mn).length`, where `[mn, mx] =
slot.reps`. So "top of range" includes a set exactly at `mx` (and anything above);
"below range" is strictly under `mn` (a set exactly at `mn` is in range, not
below). Confirm the suite should assert these, or are the operators wrong?

**Option A - Operators are correct; assert as-is**
- What it means: for `reps: [4, 8]`, progression triggers when every set is 8+;
  the −5% / hold logic triggers when sets fall to 3 or fewer.
- Implications: none - matches standard double progression (progress at the top of
  the range; you have "failed the range" only below its floor).
- Pros: correct model; no code change.
- Cons: none.

**Option B - Operators are wrong**
- What it means: e.g. treat `<= mn` as "below". No evidence this is intended - a
  set at the bottom of the prescribed range is a successful set.
- Cons: would change suggested loads with no rationale.

**Recommendation. A.** The operators are right for double progression; assert them
directly. No follow-up.

**Simon's decision.** _(left blank for Simon)_

---

## How to apply

Once Simon fills in each "Simon's decision", fold the answers back into `spec.md`:
resolved points move out of **## Open questions** into the relevant section (Scope,
Acceptance criteria, Edge cases) or a new **## Decisions** list, and **## Open
questions** ends as "None". Any point that turns into a code change (Q2 Option B,
Q3 Option B) becomes a new issue referenced under **## Out of scope / follow-ups**,
never work done inside #2. Then run `/design-tech 2` for the implementation round
(module layout, export names, `netlify.toml` contents), recorded in a sibling
`decisions.md`.
