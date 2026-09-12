# Spec - Closed exercise registry and a data-only program catalogue the validator can check (#25)

## Context

The definition format (#6) already carries a `program` field and `buildProgram()`
already threads it into the active bundle, but `parseProgramImport()` rejects any
file that sets it (`unsupported-field`, [src/import.js:104](../../../src/import.js)).
The bundle shipped with the app is not pure data: `cardioPlan` is a function,
`WARM` is prose, `BASE_V` / `SLOTS` / `SESSIONS` / `CORE` are hand-authored
constants ([src/program.js](../../../src/program.js)). Until a program catalogue
can be expressed as JSON *and checked*, an LLM-generated program cannot be loaded
at all - which blocks #13, #14, #16 and #19. Issue: #25.

## Scope

- **In:**
  - A **closed exercise registry**: one versioned data module listing every
    exercise the engine can execute, each keyed by its existing terse slug
    (`dc`, `incl_db`, …) and carrying its attributes - **execution**: `name`
    (full label), unit, increment, `perHand` / `side`, cue (free text);
    **selection**: `muscles` (populated), `pattern`, `type`, `equipement`,
    `articulations`, `stabilite`, `niveau_min`, `cout_systemique`, and the
    catalogue's kebab id as a non-key `alias`. The registry is the **union** of
    `BASE_V` and `catalogue-exercices-v1.json` (~60-70 entries), per
    [decisions.md](decisions.md) Q7 / Q8.
  - A **data-only `program` shape**: `SLOTS` / `SESSIONS` / `CORE` / `WARM`
    expressed as JSON that references only registry ids. `WARM` and cues stay
    free text.
  - **The bundled default re-expressed as a data `program` file** - not an
    adapter - so `buildProgram()` has a single code path for the exercise
    catalogue. Simon loads his own program like everyone else.
  - **Cardio stays a bundled, named engine rule.** `cardioPlan` is not moved
    into the file. The `program` carries `cardio: "default"` (use the bundled
    rule) or `cardio: null` (no cardio). Simon's re-expressed file uses
    `"default"`.
  - **Validator additions** to `parseProgramImport()`: accept `program`, and
    reject an unknown exercise id, a malformed slot/session, a `program`
    referencing an id absent from the registry, or a `startingLoads` key absent
    from the registry - each with a paste-ready, AI-addressable message (per
    #19).
  - `DEFINITION_FORMAT_VERSION` bump 1 -> 2.
- **Out:**
  - Rendering a structurally different program (variable session count, no
    cardio) - that is #13. This issue only makes such a file *load and validate*.
  - **Cardio as data** (per-week table, or a program-defined cardio different
    from the bundled rule) - follow-up issue; #25 ships with `cardio` as a
    named rule reference only.
  - `program.policies` (deload / rotation / test) - #14.
  - The pack, the method doc, the AI interview prompt - #19.
  - Any **fatigue model** built on the muscle distribution - #14 / #16. The
    distribution itself is now populated here (Q8).
  - **Readable registry keys** - the ids stay the terse slugs; the catalogue's
    kebab id rides along as a non-key `alias`. Re-keying the registry means
    re-keying the stored journal (`logs[...].ex[vid]`) and is deferred to #16
    (Q7).

## User-facing behaviour

- **Seance / Semaine / Bilan:** no visible change with the default program - all
  planned loads, phase labels, session lists and bilan text are byte-identical to
  today. With a loaded custom `program` **that matches the default's shape**
  (5 sessions, cardio present), these tabs render from the file's data. A
  differently shaped file may still render incorrectly here until #13 - see Edge
  cases.
- **Plan tab -> "Charger un programme":** a file carrying a `program` object is
  now accepted instead of failing with *"Champ non supporté : program"*. A file
  whose `program` (or `startingLoads`) references an exercise id the registry
  does not know is rejected; the existing `programError` line shows a message
  that names the offending id and states the rule, written to be pasted back to
  an AI. Nothing is loaded and no journal is written on rejection (same pattern
  as #20).
- **Plan tab body:** unchanged for the default; for a custom program the Plan
  sections that are invariant (method, progression rules) stay as they are, and
  "Charges de départ" / "Nutrition" continue to interpolate the definition's
  `profile` / `startingLoads`.

## Acceptance criteria

- [ ] **Given** a definition file with a full `program` (exercises + slots +
      sessions) referencing only known ids, **when** loaded from the Plan tab,
      **then** it loads end to end and `buildProgram()` returns a bundle the UI
      runs without code changes.
- [ ] **Given** a definition whose `program` or `startingLoads` names an id
      absent from the registry, **when** loaded, **then** it is rejected, the
      message names that id and the constraint, and no journal write occurs.
- [ ] **Given** Simon's program - now a bundled data `program` file, loaded on
      first launch in place of the old hardcoded default - **when** the app runs,
      **then** planned loads, phase labels, the Plan tab and `bilanText()` are
      byte-identical to the previous release and `test/progression.test.js`
      passes with every assertion unmodified.
- [ ] **Given** a `program` with `cardio: "default"`, **then** the bundled
      `cardioPlan` rule drives the Cardio content exactly as today; **given**
      `cardio: null`, **then** validation passes and no cardio data is expected
      (rendering the missing affordance is #13); **given** any other `cardio`
      value, **then** it is rejected as an unknown rule.
- [ ] **Given** a `startingLoads` key that is not a registry id, **when**
      loaded, **then** it is rejected with a message naming the key - the
      previous silent skip (`if (V[vid])`) no longer applies.
- [ ] **Given** the registry module, **when** a new exercise is added to it,
      **then** no engine or component file needs to change for it to be
      referenceable.
- [ ] **Given** a file declaring `formatVersion: 2`, **when** loaded, **then** it
      is accepted; **given** `formatVersion: 3`, **then** it is rejected as
      too-new; **given** no `formatVersion` or `1`, **then** it still loads.
- [ ] **Given** the merged registry, **then** every entry carries the selection
      fields, its `muscles` distribution uses the 11 documented keys and sums to
      1.0, its `pattern` is in the taxonomy, its `equipement` values are in the
      vocabulary, `stabilite` / `niveau_min` / `cout_systemique` are in range,
      and its `alias` is unique - all checked by `test/registry.test.js`.
- [ ] **Given** an entry present in both sources, **then** its `incr` and the
      catalogue's `increment_kg` agree, or the entry documents why not; only
      `incr` ships.

## Data & storage impact

**MINOR.** The localStorage journal `prog12_simon_v1` does not change shape:
`programs[id].definition` already exists and simply gains a populated `program`
object where today it is absent or `null`. Journals saved by the previous
version load without loss; no migration (#1) is required. `schemaVersion` stays
`2`. The **definition-file** format version (`DEFINITION_FORMAT_VERSION`,
independent of the journal `schemaVersion`) goes 1 -> 2; files at version 1 or
with no version continue to load.

The bundled default definition moves from the `PROFILE` / `STARTING_LOADS`
constants in `src/profile.js` plus the `src/program.js` catalogue into a data
`program` file shipped in the repo. `emptyJournal()` still stores
`definition: null`, still meaning "use the bundled default" - a stored `null`
keeps working, it just resolves to the new file. No stored journal is touched.

## Edge cases

- **Unknown id in `startingLoads`:** today `buildProgram()` silently skips it
  (`if (V[vid])`, [src/program.js:251](../../../src/program.js)). This issue
  turns it into a rejection with an AI-addressable message (decision, Q3).
- **Structurally valid but differently shaped `program`** (e.g. 3 sessions, no
  mobility): loads and validates at this issue's level, but Seance/Semaine/Bilan
  still assume 5 sessions and always-present cardio until #13. The spec accepts
  this seam; #13 depends on #25.
- **`cardio: "default"` resolves to `cardioPlan`:** the per-week logic
  (`w === 7` deload volume, `w === 1` recalibration text, intervals `null` on
  weeks 1/7/12) stays in code, untouched - `test/progression.test.js` is
  unaffected. Only the *reference* from the file is new. A file asking for
  cardio the bundled rule cannot express is a follow-up, not this issue.
- **Two cycles in memory with different catalogues:** `buildProgram()` already
  `structuredClone`s `V` for isolation
  ([test/definition.test.js:34](../../../test/definition.test.js)); a
  file-provided catalogue must get the same treatment.
- **Default program path (`definition: null`):** must keep using the bundled
  catalogue with zero behaviour change.
- **Storage unavailable / `storageOk === false`:** unchanged - validation runs
  before any write, exactly as `parseProgramImport` does today.

## Out of scope / follow-ups

- #13 - conditional rendering for a variable session count and absent
  cardio/mobility (consumes this issue).
- #14 - `program.policies`; the registry's `muscles` field is populated here.
- #19 - shipping the registry inside a downloadable pack, plus the AI prompt.
- **Cardio as data** - new issue: a `program` that defines its own cardio
  (per-week table, or a plan the bundled `cardioPlan` rule cannot express, or
  non-rower cardio). #25 ships cardio as a `"default"` / `null` rule reference
  only.
- **Empty app on first launch** vs a labelled bundled sample - #19's decision,
  not this one. #25 keeps a bundled default; whether it is presented as the
  user's own or as a sample is settled in #19.
- **#26 - neutral bundled default.** #25 ships with Simon's own program as the
  bundled default. Replacing it with a neutral Upper/Lower 4-day program (and
  shipping Simon's as a loadable example file) is content design, depends on #13
  for the session count, and adapts the Plan-tab method prose - tracked in #26,
  blocked on #25 + #13.

## Open questions

**None.** All six resolved 2026-09-09 / 10, kept here for the record:

1. **Default program** - re-expressed as a bundled data `program` file, loaded
   like any other. One code path for the exercise catalogue; Simon stops being a
   special case in code. (Distinct from #19's "empty app on first launch", which
   stays with #19.)
2. **`cardioPlan`** - cardio stays a bundled named rule (`cardioPlan`
   untouched); the file references it as `cardio: "default"` or opts out with
   `cardio: null`. Cardio periodisation is *method*, like `progression.js`, not
   per-program data. Full cardio-as-data is a follow-up issue.
3. **`startingLoads` with an unknown id** - reject, with a message naming the
   key, consistent with every other unknown-id path in this issue. The #6-era
   silent skip (`if (V[vid])`) is dropped.
4. **Registry id namespace** - keep the terse slugs; each entry's `name` carries
   the full label, so a readable id is unnecessary. *Reopened by the 2026-09-10
   amendment below and re-settled as Q7 in [decisions.md](decisions.md), on a
   stronger argument: the stored journal is keyed by exercise id, so re-keying
   the registry is a migration.*
5. **Sequencing** - `#22 -> #25 -> #13`.
6. **Cues and `WARM`** - free text, rendered as-is.

---

## Amendment - 2026-09-10: the generation catalogue exists, and it is a second registry

**Status: decided 2026-09-10 - see [decisions.md](decisions.md).** Q7 → keep the
terse slugs, carry the catalogue id as a non-key `alias` (re-keying the registry
means re-keying the journal). Q8 → declare all the selection fields and populate
them from the catalogue. The Scope and Acceptance criteria above have been
updated accordingly; the text below is kept as the analysis that reopened Q4.

A 50-exercise catalogue authored for the generation engine now lives in the repo
at [`docs/generation/catalogue-exercices-v1.json`](../../generation/catalogue-exercices-v1.json)
(see [`docs/generation/README.md`](../../generation/README.md) §3). It describes
the same objects as `BASE_V`, from the other side:

| | `BASE_V` ([src/program.js](../../../src/program.js)) | `catalogue-exercices-v1.json` |
|---|---|---|
| Entries | 40 | 50 |
| Ids | terse slugs: `dc`, `incl_db` | kebab-case: `developpe-couche-barre` |
| Fields | **execution**: `name`, `incr`, `start`, `unit`, `perHand`, `side`, `cue` | **selection**: `equipement`, `pattern`, `type`, `muscles`, `stabilite`, `niveau_min`, `articulations`, `increment_kg`, `cout_systemique` |

Neither is a superset of the other. The catalogue does not know a side plank is
measured in seconds (`unit: "time"`); `BASE_V` does not know a bench press loads
the shoulder and the wrist. **The closed registry this issue ships is their
union**, not a choice between them.

Rough overlap (name-matching heuristic, needs a manual pass): ~28 of the 40
`BASE_V` entries have a catalogue counterpart; ~12 do not - Pallof press, side
plank, ab wheel, suitcase carry, the pushdown variants, several cable rows. The
anti-movement core work is the notable gap: the catalogue models `abdominaux` as
one pattern and has no field for the `time` / `reps` / `carry` / `side`
semantics those entries rely on. ~22-28 catalogue entries have no `BASE_V`
counterpart. Union: roughly 60-70 entries.

### Q7 - Which id namespace? (reopens Q4)

**Recommendation: keep the terse slugs, for a reason Q4 did not state.**

Journal entries are keyed by *variant id*: `log.ex[vid]` in `history()`
([src/progression.js:35](../../../src/progression.js#L35)), and `startingLoads`
uses the same keys. Adopting the catalogue's ids would require a journal
migration (#1-style) touching every logged set, for no user-visible gain. Q4's
stated justification (`name` carries the full label) was true but incidental;
this is the argument that decides it.

Consequence: the catalogue's 50 entries are re-keyed onto slugs during the
merge, and the ~22-28 exercises it adds get new slugs. Optionally each entry
carries the catalogue id as an alias, so the generation-side documents stay
usable without a translation table.

### Q8 - Does #25 populate the selection fields, or only declare them?

The spec already reserves `muscles`. The catalogue supplies `muscles`,
`equipement`, `pattern`, `type`, `stabilite`, `niveau_min`, `articulations` and
`cout_systemique` for 50 exercises - authored, not hypothetical.

**Recommendation: declare all of them in the entry shape and populate what the
catalogue already provides.** The cost of deferring is not a format bump (the
registry is bundled and enriches without breaking files); it is annotating
60-70 exercises twice, and shipping a pack (#19) that cannot honour a shoulder
exclusion or a home-gym inventory in the meantime.

`increment_kg` deserves a check during the merge: the catalogue's values are
per-exercise (2.5 upper-body barbell, 5.0 lower, 2.0 dumbbells) and `BASE_V.incr`
already carries the same intent. They should agree entry by entry, or the
disagreement should be deliberate.

### What does not change

Scope, acceptance criteria, the data-only `program` shape, the `cardio` rule
reference and the `DEFINITION_FORMAT_VERSION` bump are untouched. Two open
questions on the registry's *contents*, none on the issue's boundary.
