# External audit triage - `feat/26-neutral-default-program` at c8956eb (2026-09-12)

Scope: the three outside reviews versioned under
[docs/external_audit/](../external_audit/) - GitHub Copilot / GPT
(`2026-09-12-code-review.md`), GitHub Copilot / MAI-Code-1.1-Flash
(`app_refactor_analysis.md`), and the unattributed functional study
(`functionnal audit/2026-09-12-etude-philosophie-produit.md`, section 5 below).
All three were read in full, then every finding was checked against the code at
this commit with Node probes rather than by reading. `npm test` is green at
160/160.

Per [docs/external_audit/README.md](../external_audit/README.md), an audit is
advisory. This document is the verification pass: what survives it, what was
already tracked, and what the audits missed. It produced three issues, listed in
section 5.

A caveat on timing: #26 landed steps 1-3 *while* this triage ran. Both audits
describe `schemaVersion: 3` and `definition: null`, which the pinning commit
(c8956eb) has since replaced. Findings below are stated against the current
commit, not against what the audits saw.

---

## 1. Critique of the two code reviews

The functional study is a different exercise and is handled separately, in
section 5.

### GPT - solid, but stale and partly redundant

The useful document of the two: findings anchored to `file:line`, reproduction
cases, a real bug/debt/smell split. Three reservations.

**It rediscovers tracked work.** F3 is already #30 (Draft, `priority: high`), F5
is #23 (Todo), F2 is the tail of #20 and #25 (both Pushed to Dev). Three of its
eight findings are existing issues. It has no access to the Project, so "new
finding" in the audit does not mean new to the project.

**It describes a superseded version.** Its F1 reproduction case
(`{"schemaVersion":3}`) no longer reproduces anything after c8956eb.

**It misjudges severity in both directions.** On F1 it hedges between "spinner,
mistyped rejection or white screen"; verified, it is a permanent spinner - the
exception kills the effect before `setLoaded(true)`, and `src/App.jsx:434`
holds on "Chargement du journal…". The user is locked out, with no route to the
import panel, which is the only repair. Conversely its F2 announces a crash,
while the worst case does not crash at all: an unvalidated `day` writes logs
dated `NaN-NaN-NaN`.

### MAI-Code - not actionable

**No verifiable finding**: not one line of code cited, no reproduction case, no
named bug.

**It contradicts itself.** The diagnosis says `App.jsx` "handles loading,
storage, migration, import validation" - untrue since #21, #22 and #25. Two
paragraphs later it lists `storage.js`, `schema.js` and `import.js` among the
modules "already well separated". Its Phase 2 asks for the work #21 shipped.

**Its five "open questions" are already decided** in the project docs (no global
store, progressive extraction by domain).

What it does contribute: an independent confirmation that domain boundaries come
before UI splitting, and the observation that `onSet`/`doneMap` is the densest
area. That is the whole of it.

### Their shared blind spot

Neither saw the gap #26 just opened. `parseJournalImport` applies **no
definition validation at all**. Verified: a pasted journal carrying
`definition: { weeks: "douze", program: "n_importe_quoi" }` is **accepted**,
while the same content offered as a program file is rejected. Since c8956eb that
pinned definition drives the whole render - `buildProgram()` returns a bundle
whose `SESSIONS` is `undefined`, and the first render throws.

Neither saw that F4 reaches past `plan.js` either: the `"default"` cardio rule in
`src/cardio.js:24-46` is Simon's cardio hard-coded - "Rameur Z2 mercredi après
Haut B", watts, Tuesday/Thursday/Sunday. Any imported program declaring
`cardio: "default"` inherits it. The #26 design only plans to adapt `plan.js`.

---

## 2. Verified findings

Severity as in the 2026-09-09 review: **bug** = wrong or crashing behaviour
today; **debt** = correct today, taxes a planned issue; **smell** = local.

### V1 - A pasted journal installs an unvalidated definition - bug

`parseJournalImport` (`src/import.js:37-65`) runs `migrate()` and nothing else.
No program shape check runs on the definitions inside `programs`. Probe at this
commit:

| Input | Result today |
|---|---|
| pasted journal, `definition: { id, weeks: "douze", startDate: "pas-une-date", program: "n_importe_quoi" }` | `ok: true`, journal installed |
| the same definition offered as a **program file** | rejected by `validateProgram` |
| `buildProgram()` on it | bundle with `SESSIONS: undefined`, `SLOTS: undefined` |
| first render (`src/App.jsx:277`, `prog.SESSIONS[0].id`) | `TypeError`, white screen |

The argument that survives the rare-corruption objection: pasted import is the
**documented escape hatch from a blocked store** (#12). It is the one door that
has to stay closed by construction, and it is the only one with no validator
behind it.

### V2 - A structurally invalid stored journal locks the app on the spinner - bug

`loadJournal` (`src/storage.js:64`) now checks `programs[activeProgramId]` and
its `.definition` - #26 closed the `programs: { x: {} }` case. What remains:

| Stored value | Result today |
|---|---|
| `{"schemaVersion":4}` | `TypeError: Cannot read properties of undefined` - thrown out of `loadJournal` |
| `logs: null` (or `cardio` / `checkin` not objects) | `ok: true`, throws later in `history()` / `findLog` |
| skeletal `definition` (`{ id: "x" }`) | `ok: true`, degenerate bundle at render |

The throw rejects the async IIFE in the load effect, so `setLoaded(true)` never
runs and `src/App.jsx:434` holds on "Chargement du journal…" forever. The import
panel that would repair it renders below that early return, so there is no way
out from inside the app.

### V3 - The program validator still admits definitions that corrupt dates - bug

`parseProgramImport` / `validateProgram` were hardened by #20 and reopened for
`program` by #25. Gaps reproduced at this commit:

| Input | Result today |
|---|---|
| `session.ex` element not a tuple (`42`, `null`) | `TypeError: ... is not iterable`, thrown from `validateProgram` |
| `core.ex` element not a tuple | same |
| `day` absent, `99`, or `"lundi"` | **accepted** - `dateForSlot()` then yields `"NaN-NaN-NaN"` |
| `reps: [8,5]` (inverted) or `[-5,-1]` | accepted |
| sets `-3` or `"trois"` | accepted |
| `startingLoads: 5` (a number) | accepted - `Object.entries(5)` is `[]` |
| duplicate `SESSIONS[].id` | accepted |
| `after` outside `z2` / `mob` | accepted |

Two distinct damages, and the quiet one is worse. The throw is not caught in
`handleProgramFile`'s `reader.onload` (`src/App.jsx:412-417`), so the panel stays
silent - bad, but recoverable. The accepted `day` is silent corruption: logs are
written at an invalid date, and no reload repairs them.

This also blocks #19: the rejection message is what gets pasted back to an AI for
repair, and "accepted, then dated NaN" produces no message to paste.

### V4 - Plan and cardio describe the bundled program, not the active one - debt

`buildPlan(profile, startingLoads)` (`src/plan.js:35`) never receives the active
bundle. Its prose is fixed: "Structure des 12 semaines", named anchors (bench,
squat, hip thrust), rower wattages, the fallback sessions, the meal-by-meal day.
Only `profile` and `startingLoads` are interpolated. `src/cardio.js` has the same
shape for the `"default"` rule.

#26 step 6 plans to "adapt the method prose to the neutral program". That
rewrites which program the tab is wrong about; it does not make it follow the
active one.

The decisive argument is what #26 does to Simon's own position: **after #26 he
becomes a loaded-program user**. His Plan tab and his cardio checklist will
describe the neutral program. This stops being a hypothetical import case and
becomes the nominal one.

### V5 - Concurrent toasts clear early - bug, minor

`src/App.jsx:288` - `showToast` schedules a `setTimeout` per call without
clearing the previous one. Two toasts in quick succession and the first timer
wipes the second message. Worth fixing inside #23, not on its own.

### V6 - Confirmed, already tracked

- **`Sundefined`** - `src/App.jsx:129` reads `last.week`; `history()`
  (`src/progression.js:47`) returns `date`, `si`, `kind`, `session`, `sets` and
  no `week`. Already **#30** (Draft, `priority: high`).
- **Pure display logic inside `App.jsx`** (`setSummary`, `bilanText`, set
  normalisation, `weekRange`) and **no integration test on the component** -
  already **#23** (Todo).

---

## 3. Rejected or downgraded

- **MAI-Code Phase 2 (extract persistence)** - shipped by #21.
- **MAI-Code Phase 1 (extract cycle state)** - largely covered by #22.
- **Tab-by-tab component splitting** (both audits) - premature. It moves
  complexity without reducing it while the data boundaries are still open. Both
  audits agree it comes last; it does.
- **Reducer / global store** - both audits say not now, and the project already
  decided this.
- **GPT F8 smells** - real but local (`validate()` reformatting loads instead of
  reusing `fmt()`, `loadProgram()` mixing the captured `journal` with the
  updater's `j`, stale test comments). Opportunistic, no issue.

---

## 4. Recommended order

The through-line both audits get right: **close the data boundaries before
redistributing the UI**. It matters more than they knew, because #26 just turned
the stored definition from a reference resolved at read time into the source of
truth for the render.

1. **Finish #26** (steps 4-6, in progress). Nothing else decides on top of a
   half-flipped default.
2. **#30** - `Sundefined`. Already written, `priority: high`, visible defect.
   Show the real date; add the regression test.
3. **V1 + V2 as one issue** - a shared shape validator called by both
   `loadJournal` and `parseJournalImport`. Legacy journals covered by
   compatibility tests *before* tightening, per GPT's own warning.
4. **V3** - complete the program validator, `day` first.
5. **V4** - a decision (`/decide`) before any code. Gates #19's generation work.
6. **#23** - extract the pure display functions, fixing V5 on the way.
7. **Integration tests on `App.jsx`** - after #23, when there is less to mount.

---

## 5. The functional study - a different register, mostly already written

`functionnal audit/2026-09-12-etude-philosophie-produit.md` is not a code review:
it is a product and strategy study. It is judged on that register, so the absence
of reproduction cases is not held against it the way it is against MAI-Code.

**Traceability defect first.** It carries no tool and no model in its header,
which every document in `docs/external_audit/` is required to state
([README](../external_audit/README.md), "Organisation"). Its origin is not
traceable. It also sits in a directory named `functionnal audit`, with a typo and
a space, outside the `<tool>/<model>/<date>-<subject>.md` convention.

### What it gets right

- The formulation **"L'IA comprend et propose. L'application vérifie et mémorise.
  L'utilisateur décide."** is a clean statement of the split the project already
  runs on (#25's closed registry, the six assertions required by #19). Valuable
  as a phrasing, not as a direction.
- The three-level split - deterministic calculation in the app, closed data
  handed to the LLM, judgement left to the LLM - is correct and usable.
- **§6.5 is its best line**: *"Toute valeur de repli dépendant du code courant
  peut réinterpréter un ancien journal."* That is exactly the `definition: null`
  lesson, stated as a general rule rather than as one incident. It deserves to be
  captured as a durable principle.
- The micro (deterministic) / macro (assisted) distinction is sound and matches
  #14's framing.

### Where it adds nothing

Its roadmap is the existing backlog, reworded. Priority 1 is #32, #33, #34, #30,
#11 and #23. Priority 2 is #15 almost item for item. "Historique par exercice"
is #17. Priority 5 is #14. The six assertions are #19 and #25.

More seriously, it re-derives - less precisely - what
[docs/generation/README.md](../generation/README.md) already documents, while
listing "documents de génération" in its own scope:

| Study | Already in the repo, sharper |
|---|---|
| §4, "three contracts" | `docs/generation/README.md` §1 - same three, with a diagram, `schema_version` / `formatVersion`, the validator of each, and the field-by-field mapping from generated program to definition |
| §6.3, the six assertions | `moteur-generation-programme.md` §7, where they are specified |
| §6.1, scope of an adaptation | `benchmarks/retro-spec-fitai-app.md:112` - ephemeral overrides vs persisted plan, already flagged as "la bonne séparation" |
| §8, in-session quick actions | same benchmark line - adjust remaining sets, replace an exercise, change rest |
| §6.5, protect historical meaning | #26, whose steps 1-3 have already shipped |

**Its §10 step 5 asks a question that was answered on 2026-09-10.** "Décider si
le programme est généré par un moteur déterministe externe ou par un LLM encadré
par le validateur" is recorded in
[#25's `decisions.md`](../features/25-closed-exercise-registry/decisions.md):
Simon chose the LLM branch, with the counter-argument deliberately left standing
in `docs/generation/README.md` §4. The study also calls for "résoudre les
contradictions du moteur de génération" without naming one - they are listed and
located in `moteur-generation-programme.notes.md` §4.

This is the one place a strategy study could have gone past the backlog, and it
defers instead.

### What is genuinely new

**§9, the structured AI review.** A stable response shape - findings, hypotheses
with a confidence level, recommendations, impact, validation, limits - so a
weekly review comes back as something auditable rather than free prose. Nothing
in the repo covers it: `confiance.inventaire` exists in `questionnaire-llm.md`,
but only for intake, never for the adaptation loop. The separation
**recommendation / decision / trace** is what makes an AI-driven adaptation
reviewable after the fact, and it is finer than #14's framing. Issue created
(#35).

The rest of §8's UI proposal is noise: it recommends a four-tab structure
(Aujourd'hui / Semaine / Bilan / Plan) for an app that already has four tabs
(Séance / Semaine / Bilan / Plan), without saying what changes.

---

## 6. Issues created

| Issue | Finding | Label |
|---|---|---|
| #32 | V1 + V2 - unvalidated journal shape on load and on paste | `fix`, `priority: high` |
| #33 | V3 - program validator admits date-corrupting definitions | `fix`, `priority: high` |
| #34 | V4 - Plan and cardio contract for loaded programs | `feat`, `priority: medium` |
| #35 | Functional study §9 - structured AI review, decision and trace | `feat`, `priority: later` |

#30 (`Sundefined`) and #23 (pure display extraction) already existed and were not
duplicated.

Not turned into issues: §6.5's rule belongs in the architecture documentation
rather than in the tracker, and §8's in-session quick actions are already
captured in the FitAI benchmark - they belong to #14's design when it opens.
