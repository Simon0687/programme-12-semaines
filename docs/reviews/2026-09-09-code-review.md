# Code review - `dev` at 174f318 (2026-09-09)

Scope: everything merged into `dev` since 1.0.0 - issues #1 to #8 and #10, i.e.
`src/` (9 modules, ~1 450 lines), `test/` (7 files, 83 tests, all green), the
per-issue docs, and the open follow-ups #9 to #19. Every file was read in full;
the validator claims below were verified with small Node probes against this
commit.

This is the grouped review Simon deferred while running #6, #7, #8 and #10 in
parallel. It produced five GitHub issues, listed in section 5.

---

## 1. What holds up well

- **Module boundaries are real.** `schema.js` (versioning), `import.js`
  (verdicts), `backup.js` (safety copy), `program.js` (catalogue),
  `progression.js` (engine), `plan.js` (editorial), `definition.js` (file
  format). Each header states its contract and its non-goals. None of the pure
  modules imports React, so `node --test` loads them as-is.
- **The verdict pattern** `{ ok, reason, message }` (#7) is used consistently by
  `parseJournalImport`, `parseProgramImport` and `migrate()`. Tests assert on
  `reason`, never on text - a rewording cannot break the suite.
- **`migrate()` is pure and idempotent**, `MIGRATIONS[n]` never stamps the
  version itself, and the "too new" / "invalid" cases return instead of throwing
  (#10). That is exactly the shape a migration chain should have.
- **`buildProgram()` clones before folding loads**, and `test/definition.test.js`
  pins the isolation between two cycles - the highest-risk point of #6, covered
  both by a unit test and by a real click-through.
- **`backup.js` takes an injected store**, which is why it is fully unit-tested.
  The rest of the storage path does not follow that convention yet - see F2.
- **Process discipline:** Conventional Commits with the issue number, refactor
  never mixed with feature work, a spec/decisions/design trio per issue, and the
  progression tests pinned *before* the data was moved (#2). The 46 commits
  between `main` and `dev` read cleanly.

---

## 2. Findings

Severity: **bug** = wrong or crashing behaviour today; **debt** = correct today,
blocks or taxes a planned issue; **smell** = local clarity or duplication.

### F1 - `parseProgramImport` accepts files that crash the app - bug

`src/import.js:65-100` checks the presence of `id`, `startDate`, `profile`,
`weeks === 12`, and the type of `startingLoads` values. Verified gaps:

| Input | Result today |
|---|---|
| `program: "garbage"` or `program: { V: {} }` | `ok: true`; `buildProgram()` returns a bundle without `SESSIONS`, `TypeError` on first render, white screen |
| any `program` coming from a JSON file | `cardioPlan` is a **function** in the bundled catalogue (`src/program.js:153`). A file cannot carry it, so `prog.cardioPlan(week)` (`src/App.jsx:420`) throws. `definition.program` is unusable from a file, yet accepted |
| `formatVersion: 99` | accepted - the format is versioned but the version is never read |
| `profile` without `maintenanceKcal` / `startKcal`, or `macros: {}` | accepted; Plan tab prints "Maintenance estimée ≈ undefined kcal" |
| no `startingLoads` | accepted; Plan prints "Développé couché undefined kg" |
| `startDate: "2027-02-30"` | accepted (JS `Date` rolls over to 2 March) |
| no `name` | accepted; the Programme section and the cycle switcher show `undefined` |

`missing-field` is also reused for *invalid* values, which the planned AI repair
loop (#19) will need to tell apart. Issue created (fix), see section 5.

### F2 - Storage lifecycle lives inside React effects - debt

`src/App.jsx:17-26` (adapter IIFE), `:198-242` (load: read, parse, migrate,
backup, three distinct error states) and `:244-256` (debounced save). Nothing
here can be unit-tested, which is why:

- #12's acceptance criterion "un test couvre ce comportement" cannot be met as
  the code stands;
- #11 (backup before import) and #15 (real export, `storage.persist()`) will each
  add orchestration to the same effect;
- the journal's *shape* is known in two places - `emptyJournal()` /
  `withVersion()` (`:37-45`) and `MIGRATIONS[1]` (`src/schema.js:28-38`) - which
  must move together at the next schema bump.

One latent bug hides here: `:211` trusts `res.data.activeProgramId` without
checking that `programs[activeProgramId]` exists. A dangling id crashes the first
render with no message, unlike the cases #10 handled. Issue created (refactor).

### F3 - App.jsx hardcodes the program's shape in twelve places - debt

`buildProgram()` (#6) threads a bundle through the whole UI, but these literals
still describe Simon's program rather than *the* program:

| Line | Literal | Should come from |
|---|---|---|
| `:186` | `useState("hautA")` | `prog.SESSIONS[0].id` |
| `:282` | `weekday === 0 \|\| weekday === 4` (cardio-only days) | days present in `CARDIO_DAY_NOTES` with no session that day |
| `:351` | `keys = ["dc","squat","pull","ohp","hipthrust","latraise"]` | slots with `key: true` - the **same six**, already declared in `SLOTS` |
| `:336`, `:365` | `[false,false,false]`, `/3` | `prog.MOB_DAYS.length` |
| `:364`, `:596-597` | `/5`, `=== 5` | `prog.SESSIONS.length` |
| `:482-483` | `session.id === "hautB"` / `"basA"` post-session hints | data on the session (for example `after: "z2"` or `"mob"`) |
| `:109`, `:176`, `:414`, `:434`, `:437` | `12`, `84`, "sur 12" | `definition.weeks` (validated to be 12, so zero behaviour change today) |

Two of these are silent duplications of data that already exists (`key` flags,
cardio-day notes). #13 lists the first four as its own problem statement, but
they are a pure refactor and should land before it, so #13's diff contains only
the new conditional rendering. The engine's own 12s (`phaseOf`, `blockOf`,
`setsFor`, the four `week === 7` in `planned()`, the `history()` loop) are
**not** in this list - they are the substance of #9 and #14, not a constant
swap. Issue created (refactor).

### F4 - Pure logic duplicated between App.jsx and the engine - smell

- Set normalisation `.map(x => ({ w: num(x.w), r: num(x.r), rir: num(x.rir)
  })).filter(x => x.r != null)` - three copies: `src/progression.js:36`,
  `src/App.jsx:356`, `:507`.
- `planned()` and `lastEntry()` both filter history to "before (week, si)"
  (`src/progression.js:43`, `:52`).
- Unit semantics (`kg` / `bw` / `time` / `reps` / `carry`) are decided by eight
  independent ternaries: `src/progression.js:58` (two *identical* branches),
  `:61`, `:72-73`; `src/App.jsx:61-62`, `:110-112`. Adding a unit means finding
  them all.
- `setSummary()` (`src/App.jsx:55-63`) is pure, mirrors `loadText()`, feeds the
  bilan, and is untested.
- `bilanText()` (`src/App.jsx:344-371`) is a pure string builder over
  `(prog, state, week, start)`. #13 must change it (omit cardio lines when the
  bundle has none) and it cannot be tested where it lives.
- `validate()` (`:326`) re-implements `fmt()` with
  `String(p.load).replace(".", ",")`.

Issue created (refactor).

### F5 - Journal key format spelled inline in ten places - debt

`w${week}_${sid}` and `w${week}`: `src/progression.js:34`; `src/App.jsx:274`,
`:297`, `:335-337`, `:345-346`, `:354`, `:421-422`, `:504`; plus the fixture in
`test/progression.test.js:23`. #16 replaces this indexing with dates; today that
rewrite touches every one of these lines. Two builders in one module turn #16's
storage change into a one-file edit plus a migration. Issue created (refactor,
small).

### F6 - Memoisation defeated by a fresh `state` object - smell

`src/App.jsx:167` builds `state = { logs, cardio, checkin }` on every render. It
is a dependency of every `useMemo` downstream (`:104-105` in each
`ExerciseCard`, `:272-276` `doneMap`), so they recompute on every render,
including the 500 ms tick while a rest timer runs. Cost is negligible at this
scale (`history()` is 12 x 5 lookups), but the memos are misleading as written.
One-line fix: `useMemo(() => ({ ... }), [active])`, or pass `active` itself.
Folded into the F3 issue as a separate commit.

### F7 - Small UI warts - smell

- `showToast()` (`:296`) arms a bare `setTimeout`; two toasts in quick
  succession and the first timer clears the second early.
- `copy()`'s fallback (`:339-342`) and the Bilan "Afficher" button (`:540`) write
  the bilan into the *import* textarea, which enables "Importer le JSON collé"
  with non-JSON content. The Bilan tab already shows the text in a `<pre>`, so
  "Afficher" looks like a leftover.
- `loadProgram()` (`:385-396`) reads `existing` from the closed-over `journal`
  but spreads from the updater's `j` - correct today, inconsistent.
- The `definition: null` sentinel is resolved in two places (`:166`, `:561`).

Not worth issues; fix opportunistically when touching those lines.

### F8 - Stale comments - smell

- `src/schema.js:7-9`: "À la v1 la chaîne est vide : migrate() est un no-op" -
  `SCHEMA_VERSION` is 2 and `MIGRATIONS[1]` exists.
- `src/program.js:9-11`: loads "viennent de src/profile.js ... refold sur V
  ci-dessous" - they now arrive via `buildProgram(definition)`.
- `test/progression.test.js:8-9`: "before #3-#6 start moving the program data
  around" - they have.

Fix inside whichever refactor touches each file.

---

## 3. Test coverage gaps

Well covered: the `migrate()` chain and verdicts, `planned()` across the cycle,
both parsers' reasons, backup semantics, bundle isolation, plan shape.

Not covered at all:

| Area | Why it matters | Unlocked by |
|---|---|---|
| Load / save path (read, migrate, backup, refuse-to-save) | #12 nearly lost a real journal through exactly this path | F2 issue |
| `loadProgram()` merge - reloading an existing id keeps its logs | #6's "never overwrite" promise, verified only by clicking | F2 issue (once it is a pure function) |
| `setSummary`, `bilanText` | user-visible text, pure, changed by #13 | F4 issue |
| `cardioPlan(w)`, `setsFor`, `blockOf` boundaries | week 7 volume halving, block switch | trivial to add any time |
| `weekRange`, `dateLabel`, month boundaries | header text; `weekRange` has a subtle same-month rule | trivial |
| `parseProgramImport(DEFAULT_DEFINITION)` is `ok` | the app's own definition should pass its own validator | F1 issue |

---

## 4. Documentation drift (no issue created - Simon to decide)

- `README.md`: "Wendler 5/3/1" (the engine is double progression), "npm run
  test (placeholder)" (83 tests run), "GitHub Actions valide" (there is no
  `.github/workflows/`; Netlify runs `npm test`).
- `WORKFLOW.md`: `git add .` (the working tree routinely holds other issues'
  untracked docs), GitHub Actions again, a `staging` flow that is not used.
- `CONTRIBUTING.md`: branches from `main`; actual practice since #1 is `dev`.

---

## 5. Issues created from this review

| # | Type | Title | Motivated by | Unblocks |
|---|---|---|---|---|
| #20 | fix | `parseProgramImport` accepts definitions that crash the app or render "undefined" | F1 | 2.0.0 release safety, #19 |
| #21 | refactor | Extract the storage adapter and the journal load/save path into `src/storage.js` | F2 | #12's test, #11, #15 |
| #22 | refactor | Derive the program's shape from the active bundle instead of literals in App.jsx | F3, F6 | #13, part of #9 |
| #23 | refactor | Move pure display and summary logic out of App.jsx into testable modules | F4 | #13 (`bilanText`) |
| #24 | refactor | Centralise the journal key builders ahead of the dated timeline | F5 | #16 |

All four refactors are PATCH-level: the stored journal does not change shape.

### Recommended order

1. **#12** (existing, two lines) and **#20** - both before 2.0.0 reaches `main`.
   #12 is a live data-loss path; #20 is a crash inside the very feature 2.0.0
   ships. Neither should wait for a refactor.
2. **#21** storage extraction - then #12's missing unit test is ten lines, and
   #11 / #15 start from a testable function instead of an effect.
3. **#22** then **#13** - #13's diff shrinks to the conditional rendering.
4. **#23** - independent; do it before #13 if #13 needs to touch `bilanText`.
5. **#24** - any time before #16 starts.

### Considered and not recommended now

- **Splitting `Programme` into four tab components.** The component is 445 lines
  but linear; splitting it without changing state ownership just moves props
  around. Revisit after #21 / #23 have removed the non-UI code from it.
- **A single "notice" reducer** for `toast` / `importError` / `loadError` /
  `programError` / `storageOk` / `saveStatus`. Six pieces of feedback state is a
  smell and #12 is a symptom, but the right shape will be clearer once #21 has
  isolated the storage verdicts.
- **TypeScript.** The #6 design noted "the compiler will not catch a missed
  call site". True, but the engine is small and pinned by tests; the migration
  cost outweighs the benefit for one developer today.
