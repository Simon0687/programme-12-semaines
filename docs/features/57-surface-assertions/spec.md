# Spec - Surface the six assertions where a program is composed or loaded (#57)

## Context

#37 shipped `src/assertions.js` to `dev` (`8c4cf7b`): `assess(program, targets)`
resolves a program into one week and returns `{ ok, findings }`, never throwing.
It is pinned by [test/assertions.test.js](../../../test/assertions.test.js) - and
that test file is its only caller, so nothing in the running app can reach it.
Both shipped programs produce true findings today (ischios/fessiers at 10,5
series for the bundled one, a 64-minute session for Simon's), so this surface is
populated from the first screen, not a rare empty state. Issue:
[#57](https://github.com/Simon0687/programme-12-semaines/issues/57).

## Scope

- **In:** one advice surface, fed by `assess()`, attached to the **active**
  program and reachable from both doors that install one - the editor's save
  ([App.jsx:708](../../../src/App.jsx#L708)) and a program file
  ([App.jsx:718](../../../src/App.jsx#L718)). The module's own messages, shown
  unedited. No new stored field.
- **Out:** collecting a declared intent (frequency / duration / level) - that is
  most of the engine's input screen, deferred by `decisions-moteur.md` Q4 and left
  to its own issue. Any change to `assertions.js`. Any finding becoming a
  condition of saving, loading or activating. Assessing inactive cycles.
  Dismissing a finding, which would turn a UI preference into stored state.

## User-facing behaviour

**Seance, Semaine, Bilan:** unchanged. The advice never reaches a training
screen - a program is judged where it is chosen, not where it is executed.

**Plan > Programme:** the section gains an advice block about the active program,
below the three buttons and below the existing rejection line. Two states only:

- *No finding* - nothing at all. No panel, no "tout est bon".
- *Findings* - one summary line, `text-notice`, not `role="alert"`: for example
  « 5 points à regarder sur ce programme », followed by a control that discloses
  the list. Collapsed by default. Each item in the list is the `message` string
  from `assess()`, verbatim, one per line.

The block must not read as the rejection line of `parseProgramImport()` directly
above it, which is `role="alert"` + `text-alert`
([App.jsx:1026](../../../src/App.jsx#L1026)). The two never appear together - a
refused file never loads - but they share a place, and today `alert` and `notice`
are the same amber
([tailwind.config.js:41-42](../../../tailwind.config.js#L41-L42)), so the
distinction has to be carried by wording, role and shape, not by colour alone.

**Plan > Programme, after a file loads:** the block above is already the answer -
the loaded program becomes the active one, so its findings appear in place, on
the screen the user is already looking at.

**Editeur, on save:** `saveDraft` keeps its current order - `validateDefinition`
first, and a refused draft still shows its sentence and stays in the editor. Once
saved, the program is active and its findings are the ones the Plan block shows.
What changes is the landing screen: **saving always ends on Plan**, findings or
not, instead of Semaine - the screen where the program can be looked at again and
recomposed if the advice calls for it.

**A composed program always carries at least one finding**: nothing declares an
intent, so `assess()` appends `no-declared-intent` - « Ce programme ne déclare ni
cible de volume ni durée de séance : le volume par muscle, la fréquence de
stimulation et la durée n'ont pas été vérifiés. » That sentence *is* the "not
checked" line; it is shown like any other finding, and it is what keeps three
dormant assertions visible instead of silent.

## Acceptance criteria

- [ ] Given a program that fails every assertion, when it is saved from the editor
      or loaded from a file, then it saves / loads / activates exactly as today.
- [ ] Given a composed program, when it is saved, then the app lands on Plan -
      always, findings or not - with the save completed and the block populated.
- [ ] Given a program file that loads, when it becomes active, then its findings
      appear in Plan > Programme.
- [ ] Given a file refused by `parseProgramImport()`, then the rejection line is
      shown as today and **no** advice block appears - nothing was loaded.
- [ ] Given a program with no finding, then no advice element renders at all.
- [ ] Each item shown is the module's `message` string, unmodified - no
      re-wording, no code reference, no field path added.
- [ ] Given several stored cycles, when the active one is switched, then the block
      follows the newly active program.
- [ ] `prog12_simon_v1` gains no field, and no key is written when findings are
      computed, shown or disclosed.
- [ ] `npm test` and `npm run build` pass.

## Data & storage impact

**MINOR.** Nothing about the journal changes shape: findings are computed from the
active definition on render and thrown away. A journal saved by the previous
version loads without loss, and one saved by this version loads in the previous
one. The `feat` prefix bumps the minor anyway (CONTRIBUTING, "Versioning rules").

Nothing is dismissible (decision Q3), which is what keeps it that way: a dismissal
surviving a reload would become stored state, and would put a UI preference inside
the training journal, which nothing in `assess()` justifies today.

## Edge cases

- **A pre-#25 definition with no `program`** runs on `LEGACY_DEFINITION` through
  `buildProgram()` ([program.js:49](../../../src/program.js#L49)). The advice must
  judge the program the app actually executes, not an absent field.
- **`unreadable-program`**: `assess()` returns that single finding when it cannot
  resolve a week. It is a normal finding here, not an error state - the program is
  still active and still runs.
- **Week 7 deload, a reopened session, an empty journal**: findings depend on the
  definition alone. The block reads the same in week 1 and week 12, and on an app
  where nothing has been logged.
- **Storage unavailable**: nothing is written, so the block behaves normally.
- **An imported journal carrying several cycles**: only the active one is
  assessed.
- **A cycle in `unusable`** cannot be activated, so it is never assessed.

## Out of scope / follow-ups

- **Declaring an intent** (frequency, duration, level, priorities) so assertions 1,
  2 and 5 stop skipping - the input screens of `decisions-moteur.md` Q4. Worth its
  own issue: it is the last missing input of the engine, not a detail of this one.
- **`alert` and `notice` are the same amber today.** If carrying the distinction
  proves hard here, that is a design-token issue, not a fix to improvise in this
  one.
- **A per-finding action** ("corrige ça pour moi") belongs to the engine, not to a
  validator whose whole contract is to advise.

## Open questions

None. The four were answered on 2026-09-17 - see
[decisions-spec.md](decisions-spec.md) for the options and the arguments. Three
were validated as written and are folded into Scope, User-facing behaviour and
Data & storage impact above; the fourth came back simpler than its
recommendation - the editor's save lands on Plan **always**, not only when there
are findings.
