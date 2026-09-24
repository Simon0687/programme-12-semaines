# Spec - Build a program in the app: manual editor over the closed registry (#36)

## Context

The app can *execute* any program in the `formatVersion: 2` definition format, but
it can only *receive* one — from the bundled file or from "Charger un programme"
(`src/App.jsx:942`). Writing one means editing JSON by hand, outside the app. This
issue adds the missing half: composing `program = { SLOTS, SESSIONS, CORE, WARM }`
by picking from the closed registry, inside the app.
([#36](https://github.com/Simon0687/programme-12-semaines/issues/36))

It ships before the constraint-driven engine (Q1 = B, `docs/generation/decisions-moteur.md`)
and independently of it (Q2 = A, answered 2026-09-15): it is the only path useful
under every answer to Q1 — correcting a generated program, correcting an LLM's, or
writing one from scratch — and it is the answer the engine document gives itself
for the case its own rules cannot handle (§6, *"contexte hors modèle → édition
manuelle du programme généré"*). The engine, when it lands, fills this editor; it
does not duplicate it.

## Scope

- **In:** an editing surface producing a complete definition (`program`, plus `id`,
  `name`, `startDate`, `weeks: 12`, `startingLoads` — typed in when the loads are
  known, left blank for the week-1 calibration to settle); its own entry point,
  reachable without any generation flow; opening an existing `program` for editing;
  saving through the same path as a file import (`loadProgram`, `src/App.jsx:664`),
  which creates a cycle in `programs` — or refreshes the active one in place, under
  the rule below.
- **Out:** constraint-driven generation (material / focus / days / level → proposal)
  — that is the engine, a later issue. Any new exercise: the registry stays closed
  (#25). Programs of a length other than 12 weeks (#14). Making the Plan tab's
  S7/S12 prose follow the edited program (#34). Editing the `profile` (nutrition)
  block, or the `volume` / `fallback` Plan content — see follow-ups.

## User-facing behaviour

**Plan.** The "Programme" section gains a second button beside "Charger un
programme": **"Composer un programme"**. That is the entry point, and it stands
alone — no generator, no wizard in front of it.

**Editor (a screen of its own, like `exercice` in `src/screen-state.js`).** Back
returns to Plan. One scrollable page:

- A header: program name (free text), start date (defaults to the next Monday),
  and "12 semaines" stated as a fixed fact, not offered as a field.
- **Séances** — an ordered list; each row carries a name, a subtitle, a day of the
  week (1–7), a warm-up block, a core block, and its exercises. Add / remove /
  reorder a session.
- Inside a session, **an exercise row is a slot**: the exercise picked from the
  registry, the number of sets, the rep range (min–max), the rest in seconds, and
  two flags — *exercice clé* (`key`, which drives the Bilan "Exos clés" line and
  the S12 AMRAP) and *jusqu'à l'échec* (`fail`). The block-2 variant (`b2`)
  defaults to the same exercise as block 1 and can be changed.
- **Picking an exercise** opens the registry (63 entries), filterable by muscle
  group (11), pattern (16) and equipment (13). The four entries without selection
  fields (`UNSELECTABLE_IDS`: pallof, sideplank, abwheel, carry) are unreachable
  through filters but reachable through a plain name search — they are valid slot
  targets, they are only invisible to selection metadata (#25, amendment 2026-09-10).
- **Échauffements et gainage** — the `WARM` blocks (a label and a free-text
  instruction) and the `CORE` blocks (a label and a list of slots), each referenced
  by name from the sessions.
- **Charges de départ** — a section at the foot of the editor lists every exercise
  the program names, once each. Typing a load writes it into `startingLoads`;
  leaving it blank means the week-1 calibration ramp settles it, which is what the
  bundled program does since #26. Exercises that carry no load (`time`, `reps`) get
  no field.
- **Un cycle déjà commencé.** In this first batch, **every save writes a new cycle**
  — the editor composes, it does not correct in place, and so it cannot rewrite a
  stored journal at all (Simon, 2026-09-16: *"le plus simple possible, les règles
  apparaîtront après"*). The per-session, per-edit rule answered in Q2 — a started
  session refusing its `day`, its rep ranges and its deletion while everything else
  stays editable — is the issue that follows this one; its design is written up in
  decisions-spec.md Q2 and in design.md step 8.
- **States.** *Empty:* a blank program shows one empty session and the two default
  blocks, with an explicit "aucun exercice" line per session. *Invalid:* a save the
  validator refuses shows the validator's own message — already written as "JSON
  path + rule violated" — and nothing is written. *Complete:* "Enregistrer le
  programme" creates the cycle and returns to Plan with the same toast as a file
  load.

**Séance, Semaine, Bilan.** No change. Once saved, the new cycle is active and
every other tab reads it exactly as it reads an imported program.

## Acceptance criteria

- [ ] Given a program composed in the editor, when it is saved, then it passes
      `validateProgram()` / `validateDefinition()` (`src/journal-shape.js:129`,
      `:271`) unmodified — the editor calls the same gate as a file import and
      carries no rules of its own.
- [ ] Given the exercise picker, when any exercise is chosen, then its id is a key
      of `EXERCISES`; no free-text field can produce an id.
- [ ] Given a saved program, when the app is reloaded, then the cycle loads back
      identically, stored as a definition (`formatVersion: 2`), not as a new shape.
- [ ] Given the Plan tab, when "Composer un programme" is tapped, then the editor
      opens without passing through any generation flow.
- [ ] Given an existing `program` (the active cycle, or one just imported from a
      file), when it is opened in the editor, then every slot, session, core and
      warm block appears as an editable row, and saving without touching anything
      produces a definition whose `program` is deep-equal to the input. The
      editor's input is a `program` object, not internal editor state.
- [ ] Given a save that succeeds, then it goes through `loadProgram()` — the same
      path as a file import — so multi-cycle isolation (#6) is unchanged.
- [ ] Given any program saved from the editor, then it is written under a **new id**
      with empty logs, and no existing cycle's definition is touched (invariant 2.1).
      Editing a cycle in place is the next issue, not this one.
- [ ] Given an exercise with a typed starting load, when the cycle is saved, then the
      load appears in `startingLoads` under that exercise's id; given a blank field,
      then the key is absent and week 1 runs the calibration ramp.
- [ ] Given a session placed on Sunday (`day: 7`), then it is accepted and rendered
      like the other six.
- [ ] Given a validator rejection, when "Enregistrer" is tapped, then the message
      is shown, the editor keeps its content, and `programs` is not written.

## Data & storage impact

**MINOR.** The journal (`prog12_simon_v1`) does not change shape. The editor writes
an entry into `programs` in exactly the form a file import writes one —
`{ definition, logs: {}, cardio: {}, checkin: {} }` — and the definition it produces
is the same `formatVersion: 2` object `parseProgramImport()` returns. No new field,
no renamed field, no migration: a journal saved by the previous version loads
without loss, and a journal saved by this one loads in the previous version (the
extra cycle is just another entry). Per CONTRIBUTING.md that is "new screen,
existing journal intact".

**No draft is stored** (Q4, answered 2026-09-16). A half-composed program does not
survive leaving the editor: nothing is written anywhere until "Enregistrer", and
leaving with unsaved content asks for a confirmation. The `sessionStorage` route of
`src/screen-state.js` stays reserved for *which screen is open*, and gains no key
here — a draft is an unvalidated program, and every read of it would need the
defensive posture of a stored journal for a value thrown away the same evening. If
the first real use proves that wrong, adding the key is a follow-up that changes no
format.

## Edge cases

- **An already-started cycle.** `loadProgram()` keys on `definition.id` and, for an
  id already present, replaces the definition while keeping the logs. This batch
  never reaches that branch — it always mints a new id — which is what makes it safe
  without a single rule; the batch that does reach it is the one where the lock list
  below becomes the only thing standing between the editor and an invariant 2.1
  violation. `history()` matches
  rows by session id and reads `rec.ex[vid]` for the slot's *current* variant
  (`src/progression.js:153-163`): a changed `b1` simply finds no history and
  restarts on the calibration ramp, which is the correct reading of "j'ai changé
  d'exercice"; a changed session `id`, `day`, `startDate` or rep range re-reads or
  hides rows that were performed under other rules. Only the second family is
  refused. Session ids are never exposed in either batch: the editor generates them,
  so that member of the family cannot be reached at all.
- **Duplicate session ids.** `validateProgram` rejects them
  (`src/journal-shape.js:169`) because `findLog` returns the first match and the
  second session becomes unreachable. The editor must generate ids, never ask for
  them.
- **Slot referenced but deleted.** Removing an exercise row that a `CORE` block
  still references leaves an orphan slot; the validator catches it, but the editor
  should not be able to produce it.
- **A program with no cardio.** `program.cardio` is `"default"` or `null`; `null`
  drops the cardio data from the built bundle and the Plan section with it
  (#13/#25). A composed program has no cardio rule to compose — see Open question 3.
- **Storage unavailable.** Same behaviour as everywhere else: the save happens in
  memory and the existing "Non enregistré" banner speaks for itself. The editor
  adds no promise of its own.
- **Week 7 deload, week 12 AMRAP.** Both are computed from the week number, not
  from the program (`computeKind`, `src/progression.js:38`); they apply to a
  composed program without the editor doing anything.
- **Imported JSON then edited.** Opening a program imported from a file and saving
  it back must not overwrite that cycle if it has logs — same rule as above.

## Out of scope / follow-ups

1. **Editing a program's Plan-tab content** (`program.volume`, `program.fallback`):
   rendered by `src/plan.js:112,156`, checked by nothing. A composed program omits
   them and the Plan tab omits the sections. Making them editable is its own issue.
2. **Editing `profile`** (maintenanceKcal, macros, target weight): optional in the
   definition and absent from the bundled program since #26. A separate issue,
   alongside the nutrition sections of the Plan tab.
3. **Exporting a composed program as a file**, so it can be sent to an LLM or kept
   outside the app. The download machinery already exists (`src/file-io.js`).
4. **The `day` contradiction**, already noted in #33: `validateProgram` reads `day`
   as 1–7 (a Monday-based offset from `startDate`) while `App.jsx` compares it to
   `today.getDay()` (0 = Sunday). An editor that asks Simon to pick a weekday makes
   that contradiction visible for the first time. Pre-existing, not created here.
5. **Editing a started cycle in place** (Q2 = B): the rule is decided and designed,
   and it ships as the issue that follows this one. Until then, an edit to a running
   program is a new cycle, which restarts every exercise on the calibration ramp
   unless its loads are typed in.
6. **The six assertions of #37, shown live while editing** (Q5, answered
   2026-09-16): a collapsed panel recomputing `assess(program, targets)` on each
   edit, showing assertions 1–4 — the two that compare against a requested duration
   and an announced theme have no target to read in a manually composed program.
   This editor ships with no panel at all; the panel is its own issue, opened once
   #37 has shipped, and it carries the sub-question of whether the editor should
   start asking for a target duration and a theme.
7. **Stale references in the issue body:** `validateProgram()` moved to
   `src/journal-shape.js:129` in #32, and the `weeks !== 12` refusal to
   `src/journal-shape.js:316`; the issue still cites `src/import.js:84` and `:205`.
   No behaviour change, only the cited lines.

## Open questions

None. Q1 (default content) and Q3 (`cardio: null`) were answered 2026-09-15; Q2
(editing a started cycle — per-session, per-edit rule, **deferred to the next
issue**), Q4 (no stored draft) and Q5 (assertions panel deferred to its own issue)
on 2026-09-16, along with the three implementation questions design.md had raised:
free session order, starting loads typed in when known, Sunday allowed. See
`decisions-spec.md` for the reasoning and `design.md` for the shape.
