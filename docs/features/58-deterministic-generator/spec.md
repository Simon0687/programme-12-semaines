# Spec - Generate a program in the app: the deterministic engine over declared constraints (#58)

## Context

`assess()` has been reachable from Plan since #57, and it opens on the same line
for every program in the app: *« 1 point à regarder : ce programme ne déclare ni
cible de volume ni durée de séance »*. Nothing collects an intent, so three of the
six assertions never run. `decisions-moteur.md` answered Q1 = **B** (a
deterministic engine inside the app) and Q4 = **A** (in-app screens, no LLM) on
2026-09-15, and #37 already wrote the expensive half - the volume table, the time
model, the contribution counting, all in
[assertions.js](../../../src/assertions.js). What is left is a greedy loop on the
deficit, a placement, and one reps/RIR/rest row. The collection screens of this
issue are what silences the #57 line honestly - by answering it. Issue:
[#58](https://github.com/Simon0687/programme-12-semaines/issues/58).

## Scope

- **In:** three collection screens - frequency (2-6), max duration
  (45/60/75/90), equipment (two presets) - reached from Plan > Programme;
  `src/generator.js`, a leaf module taking those constraints plus three
  constants and returning a `definition`; the six-field `intent` stored on that
  definition; `assess()` finally called with targets; one guard added to
  `targetsFor()` so an unknown `level` degrades like an absent intent rather than
  into beginner targets (Q3); and the proposal landing in the editor as a draft,
  not as an active cycle.
- **Out:** the level, objective and priorities **screens** - the engine takes all
  three as parameters from day one, filled by named constants in v1
  (`"intermediaire"`, `"hypertrophie"`, `[]`), per the issue's reduced scope of
  2026-09-17. Health constraints (Q4, deferred). A « must include this exercise »
  pin - the editor is the retouch path (Q2). The « affiner avec ton IA » overlay.
  A **bodyweight preset**: the registry holds five bodyweight-only entries and no
  lower body at all, so the preset waits for the catalogue, not for this issue
  (`decisions-spec.md` Q1). Editing a declared intent once it is set (Q4).
  `weeks !== 12` (#14). Any finding becoming a condition of generating or saving:
  `assess()` advises, it never blocks.

## User-facing behaviour

**Seance, Semaine, Bilan:** unchanged. Nothing is generated from a training
screen, and no active cycle changes without an explicit save.

**Plan > Programme:** a third button next to « Composer un programme » and
« Partir du programme actif » ([App.jsx:1088](../../../src/App.jsx#L1088)) -
« Générer un programme ». It opens a collection screen, not the editor.

**The collection screen (new):** three questions, answered with chips, in this
order and with nothing preselected:

1. *Combien de séances par semaine ?* - 2 · 3 · 4 · 5 · 6
2. *Combien de temps par séance ?* - 45 · 60 · 75 · 90 min
3. *Avec quel matériel ?* - Salle complète · Home gym

States:

- *Incomplete* - the « Générer » action stays disabled; no partial proposal.
- *Complete and feasible* - generating opens the editor on a filled draft, and
  the screen is left behind. When the budget forced a reduction, it says so
  first, in the vocabulary of the muscles it cut and not of the cascade steps:
  « Ce format ne laisse pas de place aux mollets ni aux abdominaux ».
- *Complete and unfeasible* - no draft. The screen shows the costed refusal
  already computed by `targetsFor()`: « 2 séances de 45 min offrent 22 séries de
  travail par semaine ; même réduit au minimum méthodologique, ce format en
  demande 26 ». The answers stay on screen so one can be changed.
- *Feasible but incompletely covered* - the equipment chosen leaves a muscle with
  no eligible exercise. The draft is produced, and the screen says which targets
  it could not cover before handing over. An engine that says what it left out
  beats one that fills.

**Editeur:** the same screen, opened on a draft it did not build. Everything #36
allows - add, remove, reorder, rename - applies, and saving lands on Plan as
since #57. Two additions:

- The draft arrives **named**: « Upper/Lower 4 jours, 60 min », derived from the
  split and the two numbers, editable in the existing name field. That name is
  what `withNewId()` turns into the stored id at save.
- Under that field, a **read-only line** states what the draft was generated for:
  « Généré pour 4 séances de 60 min, hypertrophie, niveau intermédiaire, salle
  complète ». It does not render for a hand-composed program, and nothing about
  it is editable - it is there so the advice block's targets are legible.

**Plan > Programme, advice block:** for a generated program, the « ni cible ni
durée » line is gone and the three sleeping assertions speak. On a nominal
generation they find nothing, so the block renders nothing at all. Edit the
program in the editor until it breaks a target, and the block says which one -
that is the intended use, not a regression.

## Acceptance criteria

- [ ] **Given** Plan > Programme, **when** I press « Générer un programme »,
      **then** the collection screen opens and `prog12_simon_v1` is untouched.
- [ ] **Given** the three answers 4 / 60 / salle complète, **when** I generate,
      **then** the editor opens on a 4-session Upper/Lower draft and nothing has
      been stored.
- [x] **Given** any of the 19 feasible frequency × duration combinations (all but
      2 × 45), for each of the two equipment presets, **when** the generated
      program is passed to `assess(prog, targetsFor(intent))`, **then** **no
      finding appears that the engine's own report has not already announced**.
      *Amended on 2026-09-17, after measuring.* The original wording asked for
      `ok: true` on all 38; that is not reachable, and the reason is in the
      method rather than in the engine - see « Measured, not assumed » below.
      17 of the 38 are clean; the other 21 carry only shortfalls the collection
      screen names before the editor opens.
- [x] **Given** any generated program, **then** it never carries a volume
      *above* a range, a duplicated pattern, a session under 48 h from another
      on the same large group, a session over its duration budget, or a theme
      naming a muscle it does not train. These have no excuse and are asserted
      directly, on all 38.
- [ ] **Given** a frequency of 2 or 3, **then** the split is full body; 4 gives
      Upper/Lower; 6 gives Push/Pull/Legs ×2 (§3 step 1).
- [ ] **Given** equipment « Home gym », **then** no selected exercise requires an
      item outside that inventory, and the proposal says it could not cover the
      calf target.
- [ ] **Given** a generated draft, **then** the editor shows it named from its
      split and its two numbers, and a read-only line naming the four intent
      values below the name field. **Given** a hand-composed draft, **then** that
      line is absent.
- [ ] **Given** a stored definition whose `intent.level` is a string outside
      `LEVEL_BONUS`, **then** Plan shows « ne déclare ni cible de volume ni durée
      de séance » - not advice computed against beginner targets.
- [ ] **Given** 3 séances / 60 min, **when** I generate, **then** the proposal
      announces that calves and abs were cut, before the editor opens - and the
      generated program indeed carries none.
- [ ] **Given** the same three answers twice, **then** the two definitions are
      identical apart from `id`, `name` and `startDate`.
- [ ] **Given** 2 séances / 45 min - the only refused combination of the twenty -
      **when** I generate, **then** no draft is produced and the refusal names
      both numbers, 22 and 26.
- [ ] **Given** a generated draft, **when** I save it, **then**
      `parseProgramImport()` accepts it and the stored definition carries
      `intent` with its five fields.
- [ ] **Given** a saved generated program, **when** the app is reloaded, **then**
      Plan still runs the six assertions on it - the intent is read from storage,
      not recomputed.
- [ ] **Given** a program composed by hand (#36), **then** Plan still shows
      « ne déclare ni cible de volume ni durée de séance ». Unchanged.

## Data & storage impact

The journal envelope does not change: `SCHEMA_VERSION` stays 4, and definitions
keep living inside `programs[id].definition`. One **new optional top-level field
on the definition**: `intent = { frequency, duration, level, objective,
priorities, equipment }` - the five arguments `targetsFor()` already takes
([assertions.js:275](../../../src/assertions.js#L275)), plus the equipment preset
key, which `targetsFor()` ignores and which is there so the program records the
three answers that produced it (`decisions-spec.md` Q6).

A journal saved by the previous version loads without loss: `intent` is absent,
`assess()` degrades to today's behaviour and says so. No migration.
**→ MINOR.**

`DEFINITION_FORMAT_VERSION` **stays at 2** (`decisions-spec.md` Q2). #25 bumped
1 → 2 for `program` because the field changed what a file *is*; `intent` only
adds advice. Bumping would make every generated file « too new » for an older
build ([journal-shape.js:299](../../../src/journal-shape.js#L299)) - a hard
rejection, where ignoring the field costs nothing but the advice.

The import door does **not** judge `intent` (Q3): a malformed one cannot break
execution, since `targetsFor()` already returns `null` on a non-finite frequency
or duration. The one exception is closed in the module rather than at the door -
an unknown `level` currently falls back to a beginner's bonus silently, and gains
a guard so that it returns `null` like the others.

## Edge cases

- **Unfeasible budget** - the §3 step 3 cascade already runs inside
  `targetsFor()`; only its final failure reaches the screen. Measured on the
  shipped module, exactly **one of the twenty** combinations fails: 2 × 45 (22
  offered, 26 needed). The refusal is therefore a path the screen will almost
  never show and that the module's tests have to cover.
- **Feasible only after the cascade** - six of the nineteen pass reduced, and the
  first step bites earlier than one would guess: 2 × 90 and 3 × 60 already lose
  calves and abs (`periphery`); 2 × 75 and 4 × 45 also drop isolations to their
  floor; 2 × 60 and 3 × 45 run all five steps, so direct front delt goes to zero
  and the large groups sit at their minimum. The generated program deliberately
  drops muscles, assertion 2 stays quiet for them by design, and the screen
  should say what was cut rather than let it be found in the editor.
- **Equipment that starves a muscle** - « Home gym » leaves `mollets` with no
  primary exercise: 19 entries are selectable, and none of them is a calf raise.
  The greedy loop must terminate on an unfillable deficit rather than loop or
  pad, and the uncovered target reaches the screen.
- **The four entries without selection fields** - pallof, sideplank, abwheel and
  carry hold no `muscles` and no `pattern`. The engine never selects them, for
  the same reason the editor's facets never return them.
- **`kettlebell`** is in the `EQUIPMENT` vocabulary and no registry entry uses
  it: a preset must not advertise equipment that selects nothing.
- **Storage unavailable (#12)** - the collection and the engine are pure
  computation; the first write is the editor's save, which already handles it.
- **An active cycle exists** - generating never replaces it. The draft takes a
  new id at save (`withNewId`), as the editor does today.
- **Week 7, a reopened session** - out of reach. The engine never writes to the
  journal (invariant 2.2).

## Measured, not assumed (2026-09-17)

Three numbers came out of running the code rather than reading the method, and
two of them changed this spec.

- **The shipped bundled program fails five assertions** once targets are given
  to it - ischios at 10,5 for a range that stops at 10, and four muscles trained
  once a week. It is the worked example of §5, so the engine could not simply
  reproduce it.
- **The method reasons in sets and never in slots.** A session holds at most six
  exercises, and a small group is only stimulated by an exercise of its own -
  presses do not count for triceps. At two sessions that is twelve slots for
  eleven muscles wanting two each: the set budget fits, the slot budget cannot.
  The engine therefore plans slots before selecting, and declares what it could
  not fit.
- **Assertion 2 is stricter than the table it comes from.** §7 asks for a
  stimulation frequency ≥ 1,5 for every muscle; the « Fréq. cible » column of §3
  step 2 says 1–2 for the three deltoids. #37 implemented §7. The consequence is
  that at two sessions no program can satisfy it for everyone. That is a
  contradiction in the method document - the fifth, after the four listed in
  `decisions.md` of #25 - and it belongs in its own issue, not in this one:
  fixing it here would weaken a shipped assertion on the two shipped programs.

## Out of scope / follow-ups

- **Lot 2:** the level and objective screens, replacing two named constants by
  two rows of chips. No caller changes.
- **Lot 3:** priorities (the « focus »), which is what makes the feasibility test
  fail on purpose - it belongs with a fuller refusal screen.
- The four contradictions of `moteur-generation-programme.md` listed in
  `decisions.md` of #25 are fixed in the code as they are met; if any of them
  turns out to need a product answer, it becomes its own issue.
- **A bodyweight catalogue.** The third preset died on the numbers: five
  bodyweight-only entries, no lower body at all. Adding squat, fente, hip thrust
  and mollets debout au poids du corps to `src/registry.js` is what revives it,
  and that is #25's territory - its own issue.
- **A calf exercise reachable without a machine.** The home gym preset's single
  hole. Same issue as the one above, most likely.
- **The per-muscle stimulation floor** of the point above: make assertion 2 read
  the « Fréq. cible » column instead of a flat 1,5. Its own issue, because it
  changes what #57's advice says about the two shipped programs.
- The dynamic placement of §3 step 5 (recovery-driven rather than fixed days)
  belongs with the continuous timeline, not here.

## Open questions

None. The five questions this spec opened, plus a sixth found while measuring the
registry, were answered on 2026-09-17 and are recorded with their reasoning in
[decisions-spec.md](decisions-spec.md): two equipment presets (Q1),
`DEFINITION_FORMAT_VERSION` unchanged (Q2), no rejection at the import door but a
guard on an unknown level (Q3), a read-only intent line in the editor (Q4), a
derived program name (Q5), and the equipment preset stored with the intent (Q6).
