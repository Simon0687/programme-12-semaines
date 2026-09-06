# Decisions - Version the data schema and handle migrations (#1)

Source: design.md
Scope: design / implementation choices only. Product choices are settled in
spec.md (its "Open questions" section, the five resolved points).
Status: resolved 2026-09-06 (Simon)

## Q1 - Too-new journal found on the load path

**Question.** `migrate()` returns `{ ok: false, tooNew: true }` when the stored
`schemaVersion` is higher than this build's `SCHEMA_VERSION`. On **import** the
spec is explicit (reject, keep the journal, toast). On the **load** path (mount
effect in `src/App.jsx` lines 349-361) the spec says nothing. This only happens
if this device's `localStorage` was written by a newer deployment and then opened
in an older one - rare for a single-user app, but the old build must not silently
overwrite the newer journal on its next save. If left unanswered, the developer
picks a behaviour by default and it may not be the safe one.

**Option A - Reuse the `storageOk = false` path**
- What it means: on `!res.ok` at load, call `setStorageOk(false)`, show the
  too-new toast, load nothing; and add one guard line to the save effect
  (`if (!storageOk) return;` after the `loaded` check) so no later edit can
  write over the newer journal.
- Implications: reuses the existing amber warnings (Seance tab line 531, Plan tab
  line 693) and the existing `storageOk` state; the save guard is a general
  safety improvement (today `storageOk` never flips back to true, so no
  behaviour change elsewhere). No new UI string. ~3 lines. Tailored wording can
  come with issue #7, which already owns "persistent inline message".
- Pros: smallest change; the "don't trust local persistence here" meaning of
  `storageOk` already fits; save is genuinely blocked.
- Cons: the reused warnings say "Stockage indisponible ici / Exporte le JSON",
  which is slightly off for "your journal is from a newer version".

**Option B - Dedicated flag and message**
- What it means: new state `journalTooNew`, a specific amber line ("Ce journal
  vient d'une version plus récente de l'appli..."), and the save effect guarded
  by that flag.
- Implications: new state + new JSX string + save guard. Import path could later
  share the same flag/message (folds into #7).
- Pros: accurate wording immediately.
- Cons: more new code and a new string for a case that essentially never occurs
  in this app; partly duplicates what #7 will build.

**Recommendation.** Option A. It blocks the overwrite (the only real risk) with
~3 lines and no new vocabulary; precise wording is #7's job. Fully reversible -
swapping to a dedicated flag later is a small change.

**Simon's decision.** Option A. Reuse `storageOk = false` + the save-effect
guard; tailored wording left to #7.

## Q2 - Persist a migrated journal immediately, or on next edit

**Question.** `skipSave` (`useRef(true)`, `src/App.jsx` line 347) makes the first
save after load a no-op, so a journal loaded from storage is not rewritten until
the user changes something. When `migrate()` actually upgraded the journal
(`res.migrated === true`), should the load effect clear `skipSave.current` so the
upgraded shape is written back right away, or leave it until the first real edit?
At v1 the migration chain is empty, so `res.migrated` is always false and this
branch is dead code - the decision is guidance for issue #3, which ships the
first real migration. If unanswered, #3 inherits no rule.

**Option A - Persist immediately (`if (res.migrated) skipSave.current = false;`)**
- What it means: right after `setState` on a migrated load, allow the save
  effect to run once and write `withVersion(migratedState)` (new shape,
  `schemaVersion` bumped).
- Implications: storage holds the migrated shape immediately, even if the user
  only looks and closes. Issue #8 (pre-migration backup) gets one clear seam:
  "copy the old journal to a backup key just before this first post-migration
  save". No test impact at v1 (dead branch).
- Pros: the risky transform is written once, deterministically; #8 has a precise
  hook; disk and memory agree right after load, so the "Journal mis a jour" toast
  is truthful.
- Cons: writes to storage with no explicit user action. If a migration shipped by
  #3 is buggy and #8's backup is not yet in, the only copy is overwritten before
  the user did anything. Mitigation: require #3 to land the #8 backup in the same
  change (or immediately before).

**Option B - Wait for the first real edit (leave `skipSave` as is)**
- What it means: on a migrated load, do nothing extra; the upgraded shape reaches
  storage only when the user next changes something and the debounced save runs.
- Implications: after a migration, memory holds v(n) while disk still holds
  v(n-1) until the user edits something; every load re-runs `migrate()`, which is
  idempotent, so the two never disagree in a harmful way.
- Pros: no silent write; the old journal on disk is untouched until the user acts,
  a natural recovery window if a #3 migration is bad and #8 is not in yet.
- Cons: #8's backup seam is fuzzier ("first save after a migrated load"); the
  toast claims an update that disk has not received yet (cosmetic).

**Recommendation.** Option A, with the design noting that issue #3 must ship the
#8 backup in the same change so the immediate write always has a backup behind
it. This keeps "write the risky result once" without the blast-radius downside.
One line, dead until #3, so trivially reversible.

**Simon's decision.** Option A. `if (res.migrated) skipSave.current = false;` on
load; the design records that #3 must land the #8 pre-migration backup in the
same change.

## Q3 - How the 1.1.0 release is actually cut

**Question.** The spec rates this issue MINOR (1.1.0) and the epic's milestone
table targets 1.1.0. But all four commits in the design's Sequencing are `chore`
/ `test`, and `standard-version` (the `npm run release` tool) bumps minor only on
`feat` and patch only on `fix` - `chore`/`test` bump nothing. So how does the
version reach 1.1.0? CONTRIBUTING.md `package.json` already has `release`,
`release:minor`, `release:major` scripts. Not a coding decision, but a process
one Simon should record.

**Option A - Cut with `npm run release:minor`** when #1 (or #1 + #2, both 1.1.0)
are merged.
- Pros: matches the milestone target; no commit relabelling; the script exists.
- Cons: manual; the "minor, not patch" intent lives only in someone's memory.

**Option B - Relabel one commit as `feat`** so `npm run release` bumps minor by
itself.
- Pros: `npm run release` "just works".
- Cons: dishonest type - the epic states #1 and #2 "produce nothing visible";
  breaks CONTRIBUTING's "prefixes determine the version number" contract, whose
  own example is `chore(storage): add schemaVersion and migrations`.

**Option C - Do not cut a release at #1** - let 1.1.0 ship with a later coherent
batch (CONTRIBUTING S7: "Not on every merge - when a coherent set of changes is
ready"), where the first `feat` in that batch drives the minor bump.
- Pros: matches the repo's stated release cadence; no manual override.
- Cons: `package.json` stays 1.0.0 while the milestone says 1.1.0 until that
  batch ships (cosmetic).

**Recommendation.** Option C for cadence; if a tag is wanted at the #1/#2
boundary, use Option A (`release:minor`). Not Option B - keep commit types
honest.

**Simon's decision.** Option C. No release tagged at #1; 1.1.0 ships with a later
coherent batch. If a tag is wanted at the #1/#2 boundary, use `npm run
release:minor`.

## Applied to design.md

Done 2026-09-06:

- Q1 -> **Approach** (load-effect `else` branch is now definitive) and **Files
  touched** / **Risks & tradeoffs** (the `if (!storageOk) return;` save guard).
- Q2 -> **Approach** (load effect clears `skipSave` on `res.migrated`) and
  **Risks & tradeoffs** (the #3-must-carry-#8 note).
- Q3 -> **Out of scope / follow-ups** as a settled note.
- **Open questions** in design.md now reads "None" with a pointer back to this
  file.

## Spec decisions vs design decisions

Two separate rounds, two separate homes - do not merge them:

| Round | Command / role | Decisions recorded in | Kind of choice |
|-------|----------------|-----------------------|----------------|
| Palier 1 | `/spec` (BA) | `spec.md`, its own **Open questions** section (ends as the resolved numbered list - the five points) | product / requirement: *what* and *why* |
| Palier 2.5 | `/decide` (tech lead) | `decisions.md` (this file), header `Source: design.md`, `Scope: design` | implementation: *how* |

`decisions.md` never re-opens a spec point. If `/decide` hits a question that is
really a product choice, it kicks it back to `/spec` instead of answering it. If
`/decide` is ever run at spec stage (before a design exists) it writes
`decisions-spec.md`, so the filename always names its source.
