# Design - Generate a program in the app: the deterministic engine over declared constraints (#58)

## Summary

One new leaf module, `src/generator.js`, turns three answers into a `definition`
in the format `parseProgramImport()` already accepts. It does not re-implement the
engine doc's seven steps: steps 2 and 3 - the volume targets and the time budget -
are `targetsFor()` from #37, called as-is, and step 7 is `progression.js`, which
already runs on any program. What this module writes is the split table, the
greedy selection, the placement and one prescription row. The idea that makes the
result honest: **a session's announced theme is written from the split's
assignment, not from the exercises the loop selected**, so assertion 6 still
compares two different things on a generated program. Spec:
[spec.md](spec.md), decisions: [decisions-spec.md](decisions-spec.md).

## Files touched

| File | Change |
|---|---|
| `src/generator.js` | **New.** The engine, the two equipment presets, the chip vocabularies, and the v1 constants for level / objective / priorities. |
| `src/GenerateProgram.jsx` | **New.** The collection screen: three chip rows, the refusal and the reduction report. Markup only, over `generator.js`. |
| `src/assertions.js` | One guard in `targetsFor()` (~[L281](../../../src/assertions.js#L281)): a `level` present but outside `LEVEL_BONUS` returns `null` instead of falling back to a beginner's bonus. Nothing else. |
| `src/program-editor.js` | `intent` added to `emptyDraft()` (as `undefined`), copied in `draftFrom()` ([L140](../../../src/program-editor.js#L140)) and passed through `toDefinition()` ([L164](../../../src/program-editor.js#L164)) like `profile` already is. |
| `src/ProgramEditor.jsx` | The read-only intent line, under the name input ([L253](../../../src/ProgramEditor.jsx#L253)). |
| `src/App.jsx` | A third button in Plan > Programme ([L1088](../../../src/App.jsx#L1088)); a `generateur` case in the screen switch ([L959](../../../src/App.jsx#L959)); and `assess()` fed with targets ([L308](../../../src/App.jsx#L308)). |
| `src/definition.js` | Header comment: `intent`, optional, `formatVersion` unchanged at 2. |
| `docs/ARCHITECTURE.md` | Non-goal n°3 and the « a model proposes, the app verifies » formula - `decisions-moteur.md` « Comment appliquer » item 3, due the day the engine lands. |
| `test/generator.test.js` | **New.** |
| `test/assertions.test.js`, `test/program-editor.test.js` | The guard; the intent's round trip. |

`src/screen-state.js` is **not** touched: `SCREENS` is
`["semaine", "seance", "plan", "exercice"]` and `editeur` is deliberately absent,
so a reload mid-edit falls back to Semaine. A half-answered collection deserves
the same treatment, and gets it for free.

## Approach

### The module's surface

```js
export const FREQUENCIES = [2, 3, 4, 5, 6];
export const DURATIONS   = [45, 60, 75, 90];

/* Q1: two presets. A third exists only when the registry can feed it. */
export const PRESETS = {
  "salle-complete": { label: "Salle complète", gear: EQUIPMENT },
  "home-gym":       { label: "Home gym",
                      gear: ["halteres", "barre_ez", "banc", "banc_incline",
                             "barre_traction", "poids_du_corps"] },
};

/* v1 constants, named rather than inlined: the lot-2 screens replace these
   three lines and nothing else. */
export const DEFAULT_LEVEL     = "intermediaire";
export const DEFAULT_OBJECTIVE = "hypertrophie";
export const DEFAULT_PRIORITIES = [];

export function generate(constraints, today)
//  constraints: { frequency, duration, equipment, level?, objective?, priorities? }
//  -> { ok: true,  definition, report: { cut: [muscle], uncovered: [muscle] } }
//  -> { ok: false, reason: "budget", message }   // targetsFor().message, verbatim
```

`generate()` returns a **definition**, not a draft: `draftFrom()` is then the only
bridge into the editor, and the editor stays the single door to storage. `report`
carries what the screen must say before handing over - `cut` translated from
`targets.cascade`, `uncovered` from deficits the pool could not fill.

### The seven steps, and which are new code

- **Step 1 - split.** A five-row table keyed by frequency (§3), returning a list of
  session templates: an id, a label, the muscles assigned to it, a day.
- **Steps 2-3 - targets and budget.** `targetsFor({ frequency, duration, level,
  priorities })`. Nothing is rewritten. `ok: false` is simply its `feasible: false`
  with its own message.
- **Step 4 - greedy selection.** The doc's loop, over a pool pre-filtered once:

  ```js
  const pool = entries.filter((e) => e.muscles                       // the four
      && e.equipement.every((q) => gear.includes(q))                 // unselectable
      && e.niveau_min <= LEVELS[level]);                             // entries fall
  ```

  Note the equipment predicate: `equipement ⊆ gear`, not the editor's « uses a
  pulley » facet. Candidates are scored by the doc's formula, ties broken by id so
  two runs give the same program.
- **Step 5 - placement.** The frequency → days table, verbatim. The dynamic,
  recovery-driven variant of the same section belongs to the continuous timeline
  and is not built here.
- **Step 6 - prescription.** One row - hypertrophy: 5-10 reps compound, 8-12
  isolation, rest 150 s / 90 s - written as a three-row table indexed by objective
  with two rows unused, so lot 2 adds a screen and not a table.
- **Step 7 - progression.** Nothing: `progression.js` reads the ranges from the
  slots.

### Writing the theme from the assignment

#37 recorded the trap in its own `decisions-spec.md` Q5: *« un thème que le
générateur écrirait lui-même à partir des muscles qu'il vient de choisir
comparerait un nombre à lui-même »*. Assertion 6 reads `session.sub` and nothing
else. So `sub` is written at the end of **step 1**, from the muscles the split
assigned to that session, and never touched afterwards. If the greedy loop then
fails to serve one of them - no equipment, no pattern left - the session announces
a muscle it does not train and assertion 6 says so. Written the other way round,
it could never fire.

### The emitted `program`

The shape is the bundle's, not a new one
(`public/programs/upper-lower-4j.json`):

```js
SLOTS:    { press: { reps: [5, 10], rest: 150, key: true, b1: "dc_db", b2: "dc_db" } }
SESSIONS: [{ id, name, sub, day, warm, ex: [["press", 4], …], core }]
CORE / WARM / cardio: null
volume:   [["Pectoraux", "7", "Upper A 4 + Upper B 3"], …]
```

- `key: true` on the first compound of each session - `plan.js` keeps those as
  block anchors and `App.jsx` turns them into the S12 AMRAP.
- `fail: true` from `stabilite === 3`, which is the doc's RIR floor expressed in
  the field the editor already exposes as a checkbox.
- `b1`/`b2`: compounds hold the same variant across both blocks (anchors, as
  `plan.js:64` expects); isolations rotate to the next variant of the same pattern
  when the pool has one. See open question 3.
- `volume` is emitted - the generator has the numbers, and Plan renders the table
  when it is there. `fallback` is not: it is prose about what to drop, and an
  engine that invents prose is the thing this epic is built against. Plan omits
  the section by itself.

### The intent, and the wiring

```js
definition.intent = { frequency, duration, level, objective, priorities, equipment }
```

`toDefinition()` passes it through the way it already passes `profile`;
`draftFrom()` copies it, so « Partir du programme actif » on a generated cycle
does not silently strip it. In `App.jsx`:

```js
const targets = useMemo(() => targetsFor(definition.intent ?? {}), [definition]);
const advice  = useMemo(() => assess(prog, targets), [prog, targets]);
```

`targetsFor({})` already returns `null`, so a definition without intent reaches
exactly today's behaviour with no branch of its own.

## Sequencing

One branch, `feat/58-deterministic-generator`, merged as a lot - nothing ships
dormant, the way #57 was sequenced. Step 2 is the exception and can be merged
alone.

1. `fix(assertions): an unknown level no longer yields beginner targets (#58)` -
   the `targetsFor()` guard and its test. Independent of everything else here;
   **safe to merge alone**.
2. `feat(generator): a deterministic program from frequency, duration and equipment (#58)` -
   `src/generator.js` and `test/generator.test.js`, including the acceptance
   matrix. No caller yet.
3. `feat(editeur): a draft carries its declared intent (#58)` - `program-editor.js`
   round trip, then the read-only line in `ProgramEditor.jsx`.
4. `feat(plan): generate a program from three constraints (#58)` -
   `GenerateProgram.jsx`, the third button, the screen case, the refusal and
   report states. The engine becomes reachable here.
5. `feat(plan): the six assertions read the program's declared intent (#58)` - the
   two-line change in `App.jsx`. This is the step that removes « ne déclare ni
   cible de volume ni durée de séance » from generated programs.
6. `docs(architecture): the app proposes a program (#58)` - non-goal n°3,
   `definition.js`'s header, and `decisions-moteur.md`'s « Comment appliquer »
   item 3 ticked off.
7. `feat(generator): the level and the objective are declared, not assumed (#58)` -
   **lot 2, added on 2026-09-17, after lot 1 was merged into `dev`.** Two more
   chip rows in `GenerateProgram.jsx`, `LEVEL_LABELS` / `OBJECTIVE_LABELS` /
   `LEVELS` exported from `generator.js` so no libellé is written twice, and the
   acceptance matrix widened from 38 to 114 generated combinations. No caller
   changed and no stored shape moved - step 6's three-row prescription table was
   already right, so this really was a screen and not a table. What it measured
   is recorded in the spec's « Lot 2 » section.

## Tests

`node --test`, one file per module, no DOM - the JSX pieces stay thin enough that
their logic lives in the tested modules.

- **`test/generator.test.js`** (unit, the bulk):
  - the acceptance matrix - for each of the 19 feasible frequency × duration
    combinations × 2 presets, `assess(buildProgram(definition), targetsFor(intent))`
    returns `ok: true`;
  - 2 × 45 returns `ok: false` and names 22 and 26;
  - 3 × 60 reports calves and abs as cut;
  - home gym reports `mollets` uncovered and selects nothing outside its gear;
  - determinism: two calls differ only in `id`, `name` and `startDate`;
  - the split table: 2 and 3 full body, 4 upper/lower, 6 PPL;
  - the output passes `validateDefinition()` - the same door a file goes through.
- **`test/assertions.test.js`**: `targetsFor({ frequency: 4, duration: 60,
  level: "zzz" })` is `null`, and the three known levels are unchanged.
- **`test/program-editor.test.js`**: `draftFrom(generated) → toDefinition()`
  preserves `intent`; `emptyDraft()` produces none.
- **Manual click-through** (steps 4-5): generate 4 × 60 salle complète, land in the
  editor, see the name and the intent line, save, and check the Plan advice block
  renders nothing at all; then delete two exercises and watch it speak.

## Risks & tradeoffs

- **Assertion 6 is weak on generated programs by construction**, even with the
  theme written from the assignment: both sides descend from the same split. It
  catches a selection that failed to serve an announced muscle, which is a real
  failure, but it is not the independent check it is on a hand-written program.
  Stated here rather than discovered later.
- **The acceptance matrix is written by the same head as the engine.** The
  mitigation is that the assertions are #37's, shipped before the engine existed
  and derived from the method, not from this implementation. The matrix must not
  be relaxed to make a run pass - a red cell is an engine bug.
- **A 59-entry pool is thin at 6 × 90.** Six sessions with no repeated pattern per
  session and a variant rotation between blocks can exhaust the candidates before
  the deficits close. That is what `report.uncovered` is for; if it fires on a
  full-gym preset, the answer is registry entries, not a looser rule.
- **Backward compatibility.** One optional field on the definition,
  `SCHEMA_VERSION` unchanged at 4, `DEFINITION_FORMAT_VERSION` unchanged at 2, no
  migration: **MINOR**, as the spec set. A journal written before this lands reads
  identically; a journal written after it opens in an older build minus the advice.
- **Performance.** `generate()` runs once per press. `targetsFor()` and `assess()`
  are memoized on `definition`, so the Plan advice does not recompute while a set
  is being logged.

## Out of scope / follow-ups

- **A bodyweight catalogue** in `src/registry.js` - the third preset's blocker,
  measured in `decisions-spec.md` Q1. Its own issue, in #25's territory.
- **`fallback` prose on generated programs**: Plan's « si tu ne peux pas tout
  faire » section simply does not render for them. Writing it deterministically -
  from the cascade, which knows exactly what it would cut next - is a small, real
  feature and not this one.
- Lot 2 (level and objective screens) and lot 3 (priorities plus a fuller refusal
  screen), already named in the spec.
- The recovery-driven placement of §3 step 5, which belongs with the continuous
  timeline.

## Open questions

1. **Warm-up texts for splits the bundle does not have.** `WARM` holds one text
   per key, and the bundle ships `upper` / `lower`. A full body, a PPL or a
   5-session split has none. Proposal: one short generic text per split family,
   written as a constant in `generator.js` - four strings, not a content project.
2. **Where the collection screen lives.** Its own `GenerateProgram.jsx`, as
   designed above, or a case inside `App.jsx` like the smaller panels? Proposal:
   its own file, mirroring `ProgramEditor.jsx` over `program-editor.js`.
3. **Variant rotation between blocks.** Rotate only isolations (compounds anchored
   on both blocks, which is what the bundle does and what `plan.js:64` reads), or
   rotate every non-`key` slot? Proposal: isolations only for v1 - it keeps the
   S7 calibration week meaningful without making half the program change shape.
