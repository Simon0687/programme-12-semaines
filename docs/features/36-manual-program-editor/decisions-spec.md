# Decisions - Build a program in the app: manual editor over the closed registry (#36)

Source: spec.md
Scope: product / requirement choices only. The implementation round will get its
own `decisions.md` beside this file, once `/design-tech 36` has produced
`design.md`.
Status: Q1 and Q3 answered by Simon 2026-09-15; Q2, Q4, Q5 awaiting his answers

---

## Q1 - Default content when the editor opens — **answered 2026-09-15**

**Question.** Blank editor, or a copy of the active program?

**Simon's decision.** *Nothing to decide.* "Dans tous les cas c'est pour construire
le réceptacle, ensuite viendra peut-être des programmes tout faits." The editor
takes a `program` object as input either way — that is already an acceptance
criterion in spec.md, and it is what lets a future engine's proposal land here.
Blank versus pre-filled is two buttons in the Plan section, not a requirement.
Withdrawn from this brief.

---

## Q3 - `cardio` on a composed program — **answered 2026-09-15**

**Question.** Does a program composed in the editor carry `cardio: "default"` (the
bundled cardio/mobility rule) or `cardio: null` (none at all)?

**Simon's decision.** **`null` — pas de cardio pour le moment.**

**What that means concretely.** `buildProgram()` (`src/program.js:56`) returns a
bundle with no `cardioPlan`, no `CARDIO_ITEMS`, no `MOB_DAYS`; `src/plan.js:162`
omits the cardio section; the "Cardio et mobilité" affordance stays hidden (#13).
No new code — the path already exists and the bundled `upper-lower-4j.json` already
uses it. The editor simply writes `"cardio": null` and shows no cardio UI.

---

## Q2 - What may be edited on a cycle that has already started

**Question.** spec.md currently forbids it outright: saving from the editor always
writes a new `id`, so a cycle holding validated sessions is frozen. Simon, 2026-09-15:
*"Est-ce qu'on ne laisserait pas la possibilité de changer une séance même
lorsqu'elle est déjà commencée ?"* The real question is not whether, but **which
edits**: they do not all carry the same risk, and the code draws the line for us.

**What the journal actually references.** A log row is
`{ id, date, slot, kind, ex, notes, done }` where `slot` is the **session id**
(`writeLog`, `src/schema.js:91`). Two lookups read it back:

- `findLog(logs, date, slot)` (`src/schema.js:89`) — used by the Semaine checkmarks
  and by reopening a session. `date` comes from
  `dateForSlot(startDate, week, session.day)` (`src/schema.js:76`), so it depends on
  the session's `day` **and** on the cycle's `startDate`.
- `history(prog, state, vid)` (`src/progression.js:153`) — used by every progression
  suggestion. It matches `rec.slot` against `SESSIONS[].id` and reads `rec.ex[vid]`
  for the slot's current variant.

From which three families fall out, not two:

| Edit | Effect on what is already stored |
|---|---|
| Add a session or a slot; rename `name` / `sub`; change a `WARM` text | Nothing. Purely additive. |
| Change a slot's `b1` / `b2` (the exercise) | Past sets stay under the old exercise id; `history()` finds none for the new one, so progression restarts on the calibration ramp. **That is the correct reading of "j'ai changé d'exercice"** — and the old sets stay visible in the fiche exercice, which reads every cycle (`src/exercise-history.js`). |
| Change a session's `id` or `day`, the cycle's `startDate`, or a slot's `reps` range | Silent re-interpretation. A changed `id` makes past rows vanish from both lookups; a changed `day` or `startDate` makes `findLog` miss them (the rows stay in storage, unreachable from the app); a changed range re-judges `8 reps` performed in 4–8 as if performed in 8–12. This is invariant 2.1 (`docs/ARCHITECTURE.md`). |

**Option A - New cycle always** *(what spec.md says today)*
- What it means: every save writes a new `id`; a started cycle is never touched.
- Implications: `loadProgram()` (`src/App.jsx:664`) unchanged, no new rule to test.
  But `history()` reads `state.logs` of the **active cycle only** (`src/App.jsx:226`),
  so a new cycle starts with empty logs and **every** exercise restarts from the
  calibration ramp — including the ten exercises that were not touched.
- Pros: cannot corrupt anything; one sentence to specify.
- Cons: the price is paid on the most common real case. Mid-cycle injury, one
  machine gone, one exercise swapped — Simon loses his loads on everything to
  change one row. It converts a safety rule into a reason not to use the editor.

**Option B - Per-session, per-edit rule** *(recommended)*
- What it means: a session with **no validated row** (`findLog(...)?.done` false for
  every week so far) is fully editable. A session that has one accepts the additive,
  cosmetic and variant edits of the table above, and refuses the identity/range ones
  — those are offered as "dupliquer dans un nouveau cycle" instead. `startDate` is
  locked once any session is validated.
- Implications: one predicate over the active cycle's `logs`, testable under
  `node --test` without React (invariant 2.6); a per-field disabled state in the
  editor with a one-line reason; no change to `loadProgram()` or to storage.
- Pros: keeps the loads where the cycle is still running, which is the whole point
  of editing in place; refuses exactly the four edits that rewrite history and
  nothing else; the refusal is explainable in one sentence to the person reading it.
- Cons: the most code of the three, and the rule has to be right — a family put in
  the wrong column is a silent corruption, not a visible bug. Needs its own tests.

**Option C - Free edit, with a warning**
- What it means: everything editable; a banner says past sessions may be re-read.
- Implications: cheapest to build. Also the shape #26 spent an issue closing —
  invariant 2.1 exists because "the app warned you" is not a property of the data.
- Pros: no rule to get wrong; nothing forbidden.
- Cons: a warning cannot be enforced, and the damage is invisible when it lands:
  sessions keep their numbers and lose their meaning. Not recommended.

**Recommendation. B.** The argument that survives even if the risk of corruption
turned out to be zero: Option A restarts progression on every exercise in order to
change one, because `planned()` only ever reads the active cycle. So A is not "the
safe version of B" — it is a different, worse product, and its cost falls on the
exact scenario the editor exists for. B is reversible in the permissive direction
(relaxing a locked field later costs nothing); A is not reversible at all, since the
cycles it split cannot be merged back.

**Simon's decision.** _(à remplir)_

---

## Q4 - Does a half-composed program survive leaving the screen?

**Question.** Composing a 4-day program is a dozen screens of picking. If Simon
leaves for the Séance tab, or iOS reclaims the web view — which it does every time
he changes track between two sets, the reason #41 exists — is the draft still there
when he comes back?

**Option A - No draft** *(recommended)*
- What it means: leaving the editor loses the content; a confirmation on Back.
- Implications: nothing new stored; `src/screen-state.js` keeps remembering only
  which screen was open, as it does today.
- Pros: nothing to invalidate, nothing to migrate, no half-formed program that can
  outlive a registry change; ships first and can be relaxed later without a format.
- Cons: one accidental Back costs the session's work.

**Option B - Draft in `sessionStorage`**
- What it means: the draft rides beside `prog12_screen`, same lifetime — survives a
  reload and an iOS reclaim, dies with the browser tab.
- Implications: a second key in `src/screen-state.js` or a sibling module, same
  injected-storage and never-throws conventions (ARCHITECTURE §2.7, §2.4); a
  malformed draft must degrade to "blank editor", never to a crash.
- Pros: covers the failure mode that actually happens on the phone — which is not
  Back, it is the OS.
- Cons: a draft is an unvalidated program; every read needs the same defensive
  posture as a stored journal, for a value that is thrown away every evening.

**Recommendation. A for the first version**, because the editor is used sitting
down for twenty minutes, not between two sets, and B stays available the day that
proves wrong — it adds a key, it changes no format. If the first real use says
otherwise, B is a small follow-up issue.

**Simon's decision.** _(à remplir)_

---

## Q5 - The six assertions (#37): live while editing, or on save?

**Question.** #37 ships the six acceptance assertions of the engine doc (§7) as
`assess(program, targets) -> { ok, findings }`: per-muscle volume in range,
stimulation frequency ≥ 1.5, no duplicated pattern within a session, ≥ 48 h between
two primary solicitations of a large group, estimated duration ≤ requested, announced
theme = muscles worked. Q3 of `decisions-moteur.md` settled that they **advise and
never block**. Where does the advice appear in this editor?

**Option A - On save only**
- What it means: "Enregistrer" writes the cycle and then shows the findings as a
  dismissible list. The program is saved either way.
- Implications: one call to `assess()`; the editor needs no live recomputation.
- Pros: cheapest; no risk of a red panel nagging through the whole composition.
- Cons: the advice arrives after the decision, when the thing it criticises is
  already stored. "Tes pecs sont à 4 séries" is useful while there is still a row to
  add, not once the cycle exists.

**Option B - Live, in a collapsed panel** *(recommended)*
- What it means: a permanently visible one-line summary ("6 points vérifiés · 2
  remarques"), expandable, recomputed as the program changes. Never blocks
  "Enregistrer".
- Implications: `assess()` is pure and the program is small (a few dozen slots), so
  recomputing on each edit costs nothing measurable; needs `targets`, which for a
  manually composed program are not declared anywhere — see the catch below.
- Pros: turns the assertions into what they are — a volume model Simon can compose
  against, which is the one thing the manual path otherwise lacks entirely.
- Cons: assertions 5 and 6 (duration ≤ requested, announced theme = muscles worked)
  compare against **targets the manual editor never asks for**. Either the editor
  asks for a session duration and a theme, or those two assertions stay silent here
  and only 1–4 are shown.

**Recommendation. B, showing assertions 1 to 4 only, and only once #37 has shipped.**
This editor does not need to wait for it: it ships with no assertions panel at all,
and the panel is a follow-up that costs an afternoon. The sub-question worth
answering now is the one in the Cons — whether the editor asks for a target duration
and a theme, which would also be the first fields the future engine reuses verbatim.

**Simon's decision.** _(à remplir)_

---

## How to apply

Once Simon fills in each "Simon's decision", the answers fold back into `spec.md`:
resolved points move out of **Open questions** into the section they belong to
(Q2 into Acceptance criteria and Edge cases, Q4 into Data & storage impact, Q5 into
Out of scope), and **Open questions** ends as "None". Q1 and Q3 are already applied
below their headings here and should be folded in at the same time. Then
`/design-tech 36`.
