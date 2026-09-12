# Design - Closed exercise registry and a data-only program catalogue the validator can check (#25)

*Refreshed 2026-09-11: folds in [decisions.md](decisions.md)'s Q7/Q8 (registry entry shape, id namespace) — flagged there as pending under "Consequences for design.md" and never actioned until now — plus the `SESSIONS[].after` field #22 added to the program shape after this design was first drafted. No other section changed; sequencing, risks and open questions are unaffected.*

## Summary

Split `src/program.js` into three data modules - a **closed exercise registry**
(`src/registry.js`), the **cardio rule** (`src/cardio.js`), and **Simon's
program as a plain definition object** (`src/default-program.js`) - then teach
`parseProgramImport()` to accept and shape-check a `program` field whose slots
reference only registry ids. `buildProgram()` stops carrying an inline fallback
catalogue: it reads `definition.program`, falling back to the one canonical
default. The idea that makes it work: the catalogue was already data
(`SLOTS`/`SESSIONS`/`CORE`/`WARM`); only `cardioPlan` was code, and it stays code,
referenced by name (`cardio: "default" | null`). Spec:
[spec.md](spec.md).

## Files touched

**New**

- `src/registry.js` - `EXERCISES` (today's `BASE_V`, verbatim), `REGISTRY_VERSION`,
  `EXERCISE_IDS` (a `Set` for O(1) validation). Header documents the entry shape
  incl. the reserved optional `muscles` field.
- `src/cardio.js` - `cardioPlan`, `CARDIO_ITEMS`, `MOB_DAYS`, `CARDIO_DAY_NOTES`
  moved out of `program.js` unchanged. This is the bundled "default" cardio rule.
- `src/default-program.js` - `DEFAULT_DEFINITION`: the full definition object,
  with `SLOTS` / `SESSIONS` / `CORE` / `WARM` moved here from `program.js` and
  `profile` / `startDate` / `startingLoads` moved here from `profile.js`. Carries
  `formatVersion: 2` and `program: { SLOTS, SESSIONS, CORE, WARM, cardio: "default" }`.
- `test/registry.test.js` - coverage checks (below).

**Modified**

- `src/program.js` - drops the data constants; keeps `buildProgram()`, rewritten
  to read `definition.program ?? DEFAULT_DEFINITION.program` and resolve `cardio`.
  Re-exports `BASE_V`, `SLOTS`, ... from the new modules for one release so
  nothing breaks silently (removal is a follow-up). Header rewritten.
  **`getKeySlots(prog)` / `getCardioDayNotes(prog)` (#22, landed after this
  design was first written) stay here unchanged** — both are pure functions of
  an already-built `prog` bundle (`prog.SLOTS`, `prog.SESSIONS`,
  `prog.CARDIO_DAY_NOTES`), not of the registry/cardio/default-program split;
  they work identically whether `prog` came from the default or a loaded file.
- `src/definition.js` - `DEFINITION_FORMAT_VERSION` `1 -> 2`; `DEFAULT_DEFINITION`
  becomes `export { DEFAULT_DEFINITION } from "./default-program.js"`. `parseLocalDate`
  unchanged.
- `src/profile.js` - `PROFILE` / `START_DATE` / `STARTING_LOADS` become
  re-exports from `./default-program.js`. Header updated.
- `src/import.js` - remove the `parsed.program != null` blanket reject; add a
  `validateProgram(program)` pass; import `EXERCISE_IDS`; add
  `startingLoads`-key checks against the registry; new `IMPORT_MESSAGES` entries.
- `test/import.test.js` - flip the "champ program présent => unsupported-field"
  test; add well-formed + malformed `program` cases, `formatVersion: 2` case.

**Not touched:** `src/App.jsx` (only calls `buildProgram(definition)`; the
fallback keeps a `program`-less stored definition working), `src/progression.js`,
`src/plan.js`, `src/schema.js`. `test/progression.test.js`,
`test/definition.test.js`, `test/profile.test.js` need **no change** because the
`?? DEFAULT_DEFINITION.program` fallback keeps `buildProgram({ startingLoads })`
valid.

## Approach

**Registry entry** (revised per [decisions.md](decisions.md) Q7/Q8 — no longer just `BASE_V` verbatim: the selection fields are populated from `docs/generation/catalogue-exercices-v1.json` during the merge, not reserved-and-empty):

```
EXERCISES[id] = {
  // execution (round 1) - what the Séance screen needs
  name, cue, unit?, incr?, start?, perHand?, side?,
  // selection (catalogue, Q8) - what any generator needs, LLM or code
  muscles: { [group]: number },   // 11 keys, sums to 1.0
  pattern, type, equipement: [], articulations: [],
  stabilite, niveau_min, cout_systemique,
  alias?,                          // the catalogue's kebab id (Q7)
}
EXERCISE_IDS = new Set(Object.keys(EXERCISES))
REGISTRY_VERSION = 1
```

`incr` stays the field the app reads; `increment_kg` (the catalogue's source value for the same intent) is checked to agree during the merge and does not ship. `id` stays the terse slug (Q7) — re-keying would migrate every logged `ex[vid]` in the journal for no user-visible gain; the catalogue's kebab id rides along as `alias`.

`start` stays absent in the registry; `buildProgram` injects it from
`startingLoads` exactly as now.

**Data `program` shape** (what a definition file may carry):

```
program = {
  registryVersion?: number,           // reserved, not enforced in v1 (OQ1)
  SLOTS:    { [slotId]: { reps: [min, max], rest, key?, fail?, b1, b2 } },
  SESSIONS: [ { id, name, sub, day, warm, ex: [[slotId, n], ...], core, after? } ],
  CORE:     { [coreId]: { label, ex: [[slotId, n], ...] } },
  WARM:     { [key]: string },        // free text
  cardio:   "default" | null,         // absent -> "default"
}
```

`SESSIONS[].after` (`"z2" | "mob"`, optional) landed in #22, after this design was first written — a data field for App.jsx's post-session hint, already part of the plain-object session shape `default-program.js` will carry verbatim. No new validation needed: `validateProgram()` doesn't reject unknown extra keys on a session (see Approach below), so a `program` omitting or misusing `after` still loads; the hint just doesn't render or renders nothing extra. Not worth a dedicated check in #25 — a bad `after` value has no failure mode worse than "no hint shown".

Keys are uppercase to match the bundle object the UI already destructures - no
mapping layer. No `V`: exercise data lives only in the registry. No `cardioPlan`:
that is what made the field unserialisable and is now a named rule.

**`buildProgram()`** (`src/program.js`):

```js
import { EXERCISES } from "./registry.js";
import { cardioPlan, CARDIO_ITEMS, MOB_DAYS, CARDIO_DAY_NOTES } from "./cardio.js";
import { DEFAULT_DEFINITION } from "./default-program.js";

export function buildProgram(definition = {}) {
  const p = definition.program ?? DEFAULT_DEFINITION.program;
  const V = structuredClone(EXERCISES);
  for (const [vid, load] of Object.entries(definition.startingLoads || {})) {
    if (V[vid]) V[vid].start = load;           // import.js guarantees vid is known
  }
  const cardio = (p.cardio ?? "default") === "default"
    ? { cardioPlan, CARDIO_ITEMS, MOB_DAYS, CARDIO_DAY_NOTES }
    : {};
  return { V, SLOTS: p.SLOTS, SESSIONS: p.SESSIONS, CORE: p.CORE, WARM: p.WARM, ...cardio };
}
```

The `??` fallback is a **reference to the one canonical default**, not the inline
literal the spec's "one code path" targets (that was `|| { V: BASE_V, ... }`
duplicating module data). It also covers a definition stored before #25, when
`program` was rejected and such a file meant "the bundled structure, my profile".

**Validator** (`src/import.js`), after the existing `startDate` / `startingLoads`
checks and before `return { ok: true, ... }`:

```js
if (parsed.program != null) {
  const bad = validateProgram(parsed.program);   // -> null | { reason, message }
  if (bad) return reject(bad.reason, bad.message);
}
for (const vid of Object.keys(parsed.startingLoads)) {
  if (!EXERCISE_IDS.has(vid))
    return reject("unknown-exercise",
      `startingLoads: « ${vid} » n'est pas un exercice du registre.`);
}
```

`validateProgram` checks, each failure naming the JSON path and the rule
(paste-ready for an AI, per #19):

- `SLOTS` is an object; each slot has `reps: [number, number]`, numeric `rest`,
  string `b1` / `b2` both in `EXERCISE_IDS`.
- `SESSIONS` is a non-empty array; each has string `id`, `warm` in
  `keys(WARM)`, `core` in `keys(CORE)`, and every `ex[i][0]` in `keys(SLOTS)`.
- `CORE` object; each entry `label` + `ex` with slot ids in `keys(SLOTS)`.
- `WARM` object of strings.
- `cardio`, if present, is exactly `"default"` or `null`.

New `IMPORT_MESSAGES` keys: `unknown-exercise`, `invalid-program`,
`unknown-cardio-rule`. `formatVersion` handling is unchanged except the constant
is now `2`, so a `formatVersion: 2` file passes and `3` is `too-new`.

**Import cycle note:** `default-program.js` hardcodes `formatVersion: 2` with a
comment pointing at `DEFINITION_FORMAT_VERSION`, to avoid a
`definition.js <-> default-program.js` import cycle. See Open question 2.

## Sequencing

1. **`refactor(registry): extract the exercise catalogue into src/registry.js (#25)`**
   Move `BASE_V` -> `EXERCISES`, add `REGISTRY_VERSION` / `EXERCISE_IDS`.
   `program.js` imports and re-exports `BASE_V`. No behaviour change; all tests
   green unmodified. **Safe to merge alone.**
2. **`refactor(cardio): move the cardio and mobility rule into src/cardio.js (#25)`**
   Move the four cardio constants out of `program.js`, re-export for now. No
   behaviour change. **Safe to merge alone.** (Can be squashed with step 1.)
3. **`refactor(program): express the default program as a data definition (#25)`**
   Create `src/default-program.js` with `SLOTS`/`SESSIONS`/`CORE`/`WARM` +
   profile bits; `definition.js` and `profile.js` become re-exports;
   `buildProgram()` reads `definition.program ?? DEFAULT_DEFINITION.program` and
   resolves `cardio`. UI pixel-identical, every existing test passes unmodified.
   **Safe to merge alone** - the app still only runs the bundled program; an
   external `program` is still rejected by `import.js`.
4. **`feat(import): accept and validate a data-only program field (#25)`**
   Remove the blanket reject; add `validateProgram()` + `startingLoads`-key
   checks; bump `DEFINITION_FORMAT_VERSION` to `2`; new messages. Update
   `test/import.test.js`. Merge after step 3. This is the only `feat` and the
   only step that changes what a file may contain.

Steps 1-3 are pure refactor (CONTRIBUTING: no refactor + feature in one commit);
step 4 is the feature.

## Tests

- **`test/registry.test.js`** (new, `node --test`): every `b1`/`b2` in
  `DEFAULT_DEFINITION.program.SLOTS` is in `EXERCISE_IDS`; every
  `startingLoads` key is in `EXERCISE_IDS`; every entry has `name` and `cue`;
  `REGISTRY_VERSION` is an integer. **Catalogue-integrity checks added per Q8**
  ([decisions.md](decisions.md)): every entry's `muscles` uses exactly the 11
  documented keys and sums to `1.0`; `pattern` is in the taxonomy; each
  `equipement` value is in the closed vocabulary; `stabilite` / `niveau_min` /
  `cout_systemique` are in range; `alias` is unique across the registry (where
  present); for entries carried over from `BASE_V`, `incr` agrees with the
  catalogue's `increment_kg` or the mismatch is a deliberate, commented
  exception.
- **`test/import.test.js`** (update): well-formed `program` -> `ok: true`;
  `SLOTS.<x>.b1` = unknown id -> `reason: "unknown-exercise"`, message names the
  id; `startingLoads` unknown key -> `unknown-exercise` naming the key; `reps`
  not a 2-number array -> `invalid-program`; `session.warm` not a `WARM` key ->
  `invalid-program`; `cardio: "z2"` -> `unknown-cardio-rule`; `cardio: null` ->
  `ok`; `formatVersion: 2` -> `ok`; `formatVersion: 3` -> `too-new`.
- **`test/progression.test.js`**: unchanged - it must stay byte-identical, and
  does, because `buildProgram({ startingLoads: STARTING_LOADS })` still resolves
  the default `program` via the fallback. This is the regression guard for
  "planned loads identical".
- **Manual click-through** (dev server): default app - Séance / Semaine / Bilan /
  Plan identical to production; load Simon's own exported definition file - same
  cycle resumes; hand-write a file with a typo'd `b1` id - the Plan tab's
  `programError` line shows the id by name; a file with `cardio: null` - loads,
  Cardio tab still renders the old way (that gap is #13).

## Risks & tradeoffs

- **Backward compatibility / version level: MINOR**, as the spec sets. The
  localStorage journal `prog12_simon_v1` is untouched: `definition: null` still
  means "bundled default", now resolved from `default-program.js`. A definition
  stored by a user before #25 has no `program`; `buildProgram`'s `??` fallback
  makes it behave exactly as it did. No migration (#1).
- **"One code path" wording.** The spec's Scope says the default is re-expressed
  "so `buildProgram()` has a single code path". The design keeps a one-line
  `?? DEFAULT_DEFINITION.program` fallback. This removes the duplication the spec
  actually objected to (the inline `{ V: BASE_V, SLOTS, ... }` literal) while
  keeping pre-#25 definitions and the test setup working. Flagged rather than
  hidden; if Simon wants a hard requirement of `definition.program`, that is
  Open question 3.
- **Re-export shims** in `program.js` / `profile.js` leave two names for the same
  data for one release. Cheap insurance against a missed import; deletion is a
  follow-up, not this issue.
- **Performance:** `structuredClone(EXERCISES)` per `buildProgram` call - same
  cost as today's `structuredClone(catalogue.V)`, and `buildProgram` is
  `useMemo`'d on `definition` in `App.jsx`. No change.
- **Rejected alternative:** a per-week cardio data table in the file (spec Q2
  Option A). More verbose, loses the "+5 min / 2 weeks" intent, and forces a
  generating AI to emit 12 near-identical rows. Cardio periodisation is method,
  like `progression.js` - kept as a named rule.
- **Rejected alternative:** `src/programs/` folder for the default. One file does
  not need a folder; revisit when #19 ships bundled sample programs.

## Out of scope / follow-ups

- **#26 - neutral bundled default.** After #25 the bundled default is still
  Simon's personal 12-week / 5-session cycle. Making it a neutral Upper/Lower
  4-day program (and shipping Simon's as a loadable example file) is content
  design, needs #13 for the session count, and touches the Plan-tab method
  prose - its own issue, blocked on #25 + #13. The `?? DEFAULT_DEFINITION.program`
  fallback below is what lets Simon's program become a loadable file later
  without any further plumbing change.
- **Cardio as data** - a new issue: a `program` defining its own cardio (per-week
  table, or non-rower cardio the `"default"` rule cannot express). Needs a
  `CARDIO_RULES` map or an inline schema.
- **Delete the `program.js` / `profile.js` re-export shims** once nothing imports
  the old names.
- **`program.registryVersion` enforcement** - reserved in the shape now (OQ1),
  wire it to `REGISTRY_VERSION` when the registry first has a breaking change.
- **Idiomatic lowercase keys** for the `program` file (`slots` vs `SLOTS`) with a
  normalisation layer, if the pack's published JSON schema wants them.

## Open questions

**None.** Resolved 2026-09-10:

1. **`program.registryVersion`** - not enforced in v1. Added to the documented
   shape as a reserved, optional field; per-id existence checks (already
   required) cover the practical failure. Enforcement is a follow-up.
2. **`formatVersion` constant location** - hardcode `formatVersion: 2` in
   `default-program.js` with a comment referencing `DEFINITION_FORMAT_VERSION`,
   to avoid the `definition.js <-> default-program.js` import cycle. No new file.
3. **Hard-require `definition.program`** - no. Keep the
   `?? DEFAULT_DEFINITION.program` fallback: pre-#25 stored definitions and the
   existing test setups keep working unmodified, and it is the seam #26 needs to
   turn Simon's program into a loadable file.
