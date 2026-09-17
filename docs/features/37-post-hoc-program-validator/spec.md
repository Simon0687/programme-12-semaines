# Spec - Post-hoc program validator: the six acceptance assertions as code (#37)

## Context

Nothing in the app judges whether a program is *good training* - only whether it
is *well-formed*. `validateProgram`
([src/journal-shape.js](../../../src/journal-shape.js#L129)) closes the shape
door; past it, a program that works chest six times a week and legs never loads
and runs without a word. Issue #37 turns the six acceptance assertions of
[`moteur-generation-programme.md`](../../generation/moteur-generation-programme.md)
§7 into a module. Q3 of
[`decisions-moteur.md`](../../generation/decisions-moteur.md) settled its home
(its own issue, now) and its severity (it advises, it never blocks) on
2026-09-15. It is on the critical path whatever writes the program - an LLM, the
future engine (Q1 = B), or the manual editor of #36 - and writing it first is
what sizes the engine: assertions 1, 2, 5 and 6 *are* the target table (§3 step
2), the time model (step 3) and the contribution arithmetic.

## Scope

- **In:** a leaf module, no React (invariant 2.6), that computes the target table
  (§3 step 2, including the level/priority formula and the reduction cascade),
  the time model (§3 step 3), and the six assertions over a `program`:
  - `assess(program, targets)` -> `{ ok, findings: [{ code, message, ... }] }`,
    never throws, for any JSON input (invariant 2.4);
  - `targetsFor(inputs)` -> the per-muscle target table and the feasibility
    verdict, from `{ frequency, duration, level, priorities }`;
  - contribution arithmetic over `EXERCISES[id].muscles` (1.0 at >= 0.5, 0.5
    between 0.2 and 0.5, direct-only counting for arms, lateral and rear delts,
    calves, abs).
- **In, settled by [decisions-spec.md](decisions-spec.md) on 2026-09-17:**
  - **Targets are always passed in, never inferred** (Q2). With none, assertions
    3, 4 and 6 still run; 1, 2 and 5 report "skipped, no declared intent".
    *(Corrected while implementing: assertion 6 reads the announced theme out of
    the program itself and needs no declared intent at all.)*
  - **A primary solicitation is `muscles[m] >= 0.5`** (Q3) - the same cut that
    gives contribution 1.0, so the module carries one threshold, not two.
  - **Duration is the flat model of §3 step 3**, 10 min + 3 min per working set
    (Q4). It is the exact inverse of the feasibility cap
    `floor((durée − 10) / 3)`, which is what keeps `assess` and `targetsFor`
    from contradicting each other. `SLOTS[].rest` stays unread by assertion 5.
  - **Assertion 6 reads `session.sub` through a closed French lexicon** (Q5),
    reporting only a muscle *named but not worked* and ignoring unrecognised
    words. A structured theme written by the generator would compare a number
    to itself.
- **In:** each finding names the field and the constraint, in a sentence that can
  be pasted to an AI unedited, with no reference to source code.
- **Out:**
  - **Any UI.** This issue ships no screen and no call site. The module is
    reachable only from tests. See Out of scope / follow-ups.
  - Any change to `parseProgramImport()` or `validateProgram()`. The import gate
    stays exactly as strict as it is - a program failing all six still loads and
    still runs.
  - Generating or repairing a program. This module reads and reports.
  - Health constraints (`articulations`) - deferred by Q4 of `decisions-moteur.md`.
  - The fatigue model and the dynamic calendar of §3 step 5.

## User-facing behaviour

**Nothing changes in Seance, Semaine, Bilan or Plan.** No new button, no new
line, no new message. That is deliberate, and it is the one thing to check when
reviewing: a program that fails every assertion loads through Plan > Programme,
runs in Seance, and reads in Bilan exactly as it does today.

The findings are written for a human even so, because the surfacing issue that
follows must not have to rewrite them. Shape of a message, for an Upper/Lower
week where the hamstrings get 10.5 series against a 6-10 range:

> Ischios/fessiers : 10,5 series de travail par semaine, pour une fourchette de
> 6 a 10. Les series indirectes (presse, hack squat) comptent pour moitie dans ce
> total.

No "invalid", no "error", no red. It is an opinion, phrased as one.

## Acceptance criteria

- [ ] **Given** any JSON value - `null`, `42`, a program `validateProgram` would
      reject - **when** `assess` runs on it, **then** it returns a verdict and
      never throws.
- [ ] **Given** the bundled `upper-lower-4j.json` and `haut-bas-5j.json`,
      **when** `assess` runs, **then** every finding it reports is true of the
      program (see Edge cases - both shipped programs *do* produce findings).
- [ ] **Given** a session containing `pallof`, `sideplank`, `abwheel` or `carry`,
      **when** `assess` runs, **then** those rows raise no finding of their own -
      they are skipped by assertions 1, 2, 3, 4 and 6, and counted by 5.
- [ ] **Given** the 20 frequency x duration combinations of §7, **when**
      `targetsFor` runs on each, **then** it returns a target table whose sum is
      either within the time cap or marked infeasible, naming the cascade step
      that failed. Two of the twenty have a known-good expected value from the
      §5 worked examples and are pinned to it: 4 x 60 min -> 51 series for a cap
      of 64, and 3 x 45 min -> infeasible at 34 for 33 (Q6). Running `assess`
      itself over 20 *generated* programs moves to the engine issue, where a
      generator will exist.
- [ ] **Given** a session with two exercises of the same `pattern`, **when**
      `assess` runs, **then** it reports one finding naming the session and the
      pattern.
- [ ] **Given** two sessions placing a primary solicitation of the same large
      group less than 48 h apart, **then** it reports one finding - and the week
      wraps, so day 6 and day 1 are 48 h apart, not 120.
- [ ] **Given** a session whose `sub` names a muscle the session does not work,
      **then** it reports a theme finding naming that muscle.
- [ ] **Given** no `targets` argument, **then** assertions 3, 4 and 6 still run,
      and 1, 2 and 5 report that they were skipped for want of a declared intent -
      never a volume finding computed against invented targets.
- [ ] `npm test` passes whole; the `parseProgramImport` tests are untouched.

## Data & storage impact

**None. The journal `prog12_simon_v1` does not change shape** - no new field, no
renamed field. Nothing this module produces is stored: a verdict is computed on
read and discarded, like `validateProgram`'s. `definition.questionnaire` is read
if present (questionnaire §7, amendment A3) but this issue does not write it.

**Level: MINOR.** A new module and a `feat` commit; a journal saved by the
previous version loads with no loss, because there is nothing new to load.

## Edge cases

- **Both shipped programs produce findings, measured 2026-09-17.** The issue's
  criterion "without a false positive" cannot be read as "without a finding":
  `upper-lower-4j` gives ischios/fessiers 10.5 against a 6-10 range, and a
  stimulation frequency of 1 for biceps, triceps and both small delts, under the
  1.5 floor; `haut-bas-5j` puts `dc` and `incl_db` in `hautA` - two
  `poussee_horizontale` in one session - and reaches 8 series of abs against 3-6.
  **The flat-plus-incline pair is a deliberate, standard choice.** It is the best
  argument in the repo for Q3's "it advises, it never blocks", and the reference
  case the tests should pin: a true finding on a program nobody wants to change.
- **`deltoide_ant` is counted, not targeted.** The engine's own worked example
  reaches 3.5 indirect series and prescribes 0 direct on purpose; the bundled
  program reaches 5.5 against a 2-5 range. Checking that muscle against its raw
  range reports what the method explicitly wants. It needs the target the cascade
  produced, not the table row.
- **A slot resolves to a different exercise per block** (`b1` / `b2`,
  [progression.js:149](../../../src/progression.js#L149)) - `latraise` is
  `lat_cable` then `lat_db`. Patterns and muscles can differ between blocks, so
  the assertions run per block and every finding names which.
- **Week 7 halves every set count** (`setsFor`,
  [progression.js:150](../../../src/progression.js#L150)). The assertions read
  the program's declared counts - a normal week. A deload week is not a volume
  failure and must not be assessed as one.
- **`CORE` rows are series too**: they carry the abs volume and they count toward
  the duration. A program whose abs live only in `CORE` is not an abs-free
  program.
- **`PATTERNS` holds 16 entries, not the 12 of the engine doc** - the registry is
  the authority. `poussee_horizontale` and `iso_pectoraux` are distinct, so a
  press plus a pec deck is not a duplicated pattern.
- A program with a single session; a session with an empty `ex` (#36 now refuses
  to save one, but a loaded file can still carry it); `day` values that are not
  contiguous.

## Out of scope / follow-ups

- **Surfacing the findings.** Worth its own issue, and the reason this one stays
  small: the natural homes are the editor's save step (#36) and Plan > Programme
  after a file loads, both of which want a design pass. Until then the module is
  test-only - the cost Q3 accepted in exchange for measuring the engine.
- **`definition.questionnaire` as a written field.** Archiving the payload that
  produced a program is what makes assertions 1, 2 and 6 checkable without the
  caller re-declaring intent. The questionnaire doc assumes it is free because
  `parseProgramImport` keeps unknown fields - true for reading, not for writing.
- **The duplicate-pattern finding on `haut-bas-5j`.** If Simon decides that flat
  plus incline should never be reported, that is a rule change to assertion 3,
  not a bug here.
- Exercise-level `articulations` filtering, deferred by Q4 of `decisions-moteur.md`.

## Open questions

None. The six were answered on 2026-09-17 - see
[decisions-spec.md](decisions-spec.md) for the options and the arguments. Five
folded into Scope and Acceptance criteria above; the sixth, where the module
lives on disk, is an implementation choice and was deferred to the design round.
