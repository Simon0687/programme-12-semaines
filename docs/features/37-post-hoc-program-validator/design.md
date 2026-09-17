# Design - Post-hoc program validator: the six acceptance assertions as code (#37)

## Summary

One new leaf module, `src/assertions.js`, importing only `registry.js`. It holds
the volume target table and reduction cascade of
[`moteur-generation-programme.md`](../../generation/moteur-generation-programme.md)
§3, and the six assertions of §7. The idea that makes it work: **resolve the
program into a *week* once**, then let all six assertions read that one shape.
Block resolution (`b1` / `b2`), the `CORE` merge and the four exercises with no
selection fields are then handled in exactly one place instead of six. See
[spec.md](spec.md); the requirement choices are settled in
[decisions-spec.md](decisions-spec.md).

## Files touched

| File | Change |
|---|---|
| `src/assertions.js` | **New.** ~330 lines: `VOLUME`, `CASCADE`, `THEME_LEXICON`, `resolveWeek`, `contribution`, `targetsFor`, `assess`. No React, no storage, imports `EXERCISES` / `MUSCLE_GROUPS` from `registry.js` only. |
| `test/assertions.test.js` | **New.** The module's only caller until the surfacing issue. |
| [docs/ARCHITECTURE.md](../../ARCHITECTURE.md) | Two lines: add `assertions` to the §2 dependency table (`assertions` -> `registry`) and to the leaf list. |

Nothing else. In particular [src/import.js](../../../src/import.js),
[src/journal-shape.js](../../../src/journal-shape.js) and `src/App.jsx` are
untouched - the import gate does not move, which is the whole point of Q3 in
`decisions-moteur.md`.

## Approach

### 1. The resolved week - the one shape everything reads

```js
resolveWeek(program, block) -> null | {
  block,                                       // "b1" | "b2"
  sessions: [{
    id, day, name, sub,
    rows: [{ slotId, vid, sets, entry }],      // session.ex then CORE[session.core].ex
    sets,                                      // Σ sets, unmodelled rows included
  }],
}
```

The row list is assembled exactly as the Seance screen does it
([App.jsx:467](../../../src/App.jsx#L467)): `[...session.ex,
...CORE[session.core].ex]`. `entry` is `EXERCISES[vid]`; for `pallof`,
`sideplank`, `abwheel` and `carry` it has **no `muscles` and no `pattern`**.
Every assertion but 5 skips such a row by testing `entry.muscles`, never by
naming the four ids - the same discipline as
[exercise-filter.js](../../../src/exercise-filter.js), so the day #25 gives them
a pattern they start counting with no edit here.

`resolveWeek` returns `null` for anything it cannot read. **Structural guards, no
`try`/`catch`**: it destructures no pair it has not checked first, which is the
rule #33 imposed on `validateProgram` and the reason invariant 2.4 holds there.
`assess` does not call `validateProgram` - `assertions.js` stays a leaf, and
judging shape belongs to `journal-shape.js` alone (§2.9).

### 2. Counting contributions

```js
const PRIMARY = 0.5;                       // Q3: one threshold, two uses

const VOLUME = {
  dos:              { min: 6, max: 10, direct: false },
  pectoraux:        { min: 6, max: 10, direct: false },
  quadriceps:       { min: 6, max: 10, direct: false },
  ischios_fessiers: { min: 6, max: 10, direct: false },
  deltoide_ant:     { min: 2, max:  5, direct: false },
  deltoide_lat:     { min: 2, max:  5, direct: true  },
  deltoide_post:    { min: 2, max:  3, direct: true  },
  biceps:           { min: 3, max:  6, direct: true  },
  triceps:          { min: 3, max:  6, direct: true  },
  mollets:          { min: 4, max:  8, direct: true  },
  abdominaux:       { min: 3, max:  6, direct: true  },
};

const contribution = (entry, m) =>
  !entry.muscles            ? 0
  : entry.muscles[m] >= PRIMARY ? 1
  : VOLUME[m].direct        ? 0            // direct-only groups stop here
  : entry.muscles[m] >= 0.2 ? 0.5
  : 0;
```

The order is the design: the `direct` test sits **after** the 1.0 tier, so a leg
curl (1.0) counts for hamstrings while a hack squat (0.35) contributes 0.5 - and
a bench press contributes nothing to triceps (0.2, direct-only). That is the
"muscles parasites" rule of §3 step 2, and it is what produces the measured 10.5
hamstring series on the bundled program.

### 3. `targetsFor` - the half that sizes the engine

```js
targetsFor({ frequency, duration, level = "intermediaire", priorities = [] })
  -> { volume: { [m]: n }, frequency, duration,
       capPerSession, capPerWeek, feasible, cascade: ["maintenance", ...] }
```

`capPerSession = floor((duration - 10) / 3)` and `capPerWeek = capPerSession *
frequency` (§3 step 3, Q4 - the flat model, the exact inverse of the duration
estimate used by assertion 5). The base target is
`clamp(min + levelBonus + priorityBonus, min, max)`; while `Σ volume >
capPerWeek`, apply the next of the seven cascade steps and push its id onto
`cascade`. Step 7 is not a reduction: it sets `feasible: false` and carries the
refusal sentence of §3.

### 4. `assess`

```js
assess(program, targets) -> { ok: boolean, findings: [{ code, block, sessionId?, muscle?, message }] }
```

It runs `resolveWeek` for **both** blocks and tags each finding with its own.
Findings identical in `b1` and `b2` are emitted once with `block: "both"` -
without that, every volume finding on both shipped programs doubles, since their
block variants have identical muscle profiles.

| `code` | Assertion | Raised when |
|---|---|---|
| `volume-out-of-range` | 1 | weekly series outside `[min, max]`, or off the cascade target |
| `frequency-below-floor` | 2 | a non-excluded muscle stimulated < 1.5 sessions/week |
| `duplicate-pattern` | 3 | two rows of one session share a `pattern` |
| `insufficient-recovery` | 4 | two primary solicitations of a large group < 48 h apart |
| `duration-over-budget` | 5 | `10 + 3 × sets > targets.duration` |
| `theme-mismatch` | 6 | `sub` names a muscle the session does not work |
| `no-declared-intent` | 1, 2, 5 | `targets` absent - the skip is reported, never inferred (Q2) |
| `unreadable-program` | - | `resolveWeek` returned `null` for both blocks |

Assertion 4 measures a **circular** week:
`hours(a, b) = min(|a − b|, 7 − |a − b|) × 24`, over the large groups only, so
day 6 and day 1 are 48 h apart and not 120.

### 5. The theme lexicon (assertion 6)

Two tables and a fold. Phrases are matched first, on word boundaries with an
optional trailing `s`, then single words on what is left:

```js
const THEME_PHRASES = { "chaine posterieure": ["ischios_fessiers", "dos"],
                        "delt posterieur":    ["deltoide_post"], ... };
const THEME_WORDS   = { pecs: ["pectoraux"], ischios: ["ischios_fessiers"],
                        epaules: ["deltoide_ant", "deltoide_lat", "deltoide_post"],
                        bras: ["biceps", "triceps"], ... };   // ~25 entries
```

A claim is met when **any** of its groups is worked - "Épaules" is satisfied by
lateral raises alone. Unrecognised words are ignored in silence, and a muscle
worked but not named is never a finding. Prototyped against all 18 session ×
block combinations of the two shipped programs: **zero mismatches**, and the
ignored tokens are exactly exercise names and connectors (`squat`, `hip`,
`thrust`, `presse`, `sagittal`, `et`). `sub` is what the Seance header prints
([App.jsx:786](../../../src/App.jsx#L786)) and what `validateProgram` never
inspects - which is why it is the only text that can lie.

### 6. The abs exception

`coreB` of the bundled program is `pallof`, an exercise with no `muscles`. A
program whose core is *only* anti-movement work would therefore be reported at 0
series of abs against a 3-6 range - a finding caused by the registry gap, not by
the program. **So an under-range finding on `abdominaux` is suppressed when the
week contains any unmodelled row**, while an over-range one is not. This is not
an exception invented here: the registry's own header records that the
generation catalogue models all anti-movement and carry work as the single
`abdominaux` pattern (#25, 2026-09-10 amendment).

## Sequencing

Every step below leaves the app working, because nothing imports the module - so
**each one is safe to merge alone**, and the tests are the caller throughout.

1. `feat(assertions): resolve a program into a week and count contributions (#37)`
   - `resolveWeek`, `contribution`, `VOLUME`. Tests pin the measured volumes of
     both shipped programs.
2. `feat(assertions): volume target table, time cap and reduction cascade (#37)`
   - `targetsFor` and the 20 combinations.
3. `feat(assertions): assess() and the two assertions that need no intent (#37)`
   - verdict shape, block dedup, `unreadable-program`, assertions 3 and 4. First
     step that produces the real `duplicate-pattern` finding on `hautA`.
4. `feat(assertions): volume, frequency and duration against declared targets (#37)`
   - assertions 1, 2, 5, the `no-declared-intent` skip and the abs exception.
5. `feat(assertions): the announced theme against the muscles worked (#37)`
   - the lexicon and assertion 6.
6. `docs(architecture): assertions.js is a leaf beside the registry (#37)`

## Tests

`test/assertions.test.js`, `node --test`, `describe` / `test` with
`node:assert/strict`, as the rest of the suite. No DOM, no build step.

- **Fixtures**: `DEFAULT_DEFINITION` and `LEGACY_DEFINITION`, imported the way
  [test/registry.test.js](../../../test/registry.test.js) already does - the
  shipped JSON, not a hand-written copy.
- **Negative cases**: `structuredClone` a shipped program and break one thing -
  move a session's `day`, swap a slot's `b1` for a duplicate pattern, rewrite a
  `sub`. One mutation per test, so a failure names its own cause.
- **Never throws**: run `assess` over the malformed-program corpus
  [test/journal-shape.test.js](../../../test/journal-shape.test.js) already
  maintains, plus `null`, `42`, `[]`. Assert a verdict comes back every time.
- **The 20 combinations**: table-driven over frequency 2-6 × duration
  45/60/75/90, asserting feasibility and, for the two §5 examples, the exact
  totals - see Open question 1.
- **True findings are pinned**: `hautA`'s two `poussee_horizontale`, the bundled
  program's 10.5 hamstring series and its frequency of 1 on biceps, triceps and
  both small delts. These are the regression fence around "it advises, it never
  blocks" - if a later change makes them disappear, the assertion stopped working.
- **Manual**: none. There is no UI in this issue.

## Risks & tradeoffs

- **A module with no caller.** Until the surfacing issue lands, only tests reach
  it, so a mistake shows up late. Accepted deliberately in Q3 of
  `decisions-moteur.md`: the module is here to size the engine, and the tests are
  a real caller, not a stand-in.
- **`fold()` is duplicated** from `exercise-filter.js` - two lines, accent
  stripping and lower-casing. Extracting a shared helper for a second copy would
  create a module that exists to hold two lines. If a third copy appears, extract
  then; noted in follow-ups.
- **The volume table is now in two places** - this module and §3 of the engine
  doc. They will drift. The code is the one that runs, and step 2's tests are
  what will catch a doc that no longer matches.
- **Storage: none.** Nothing here writes to `prog12_simon_v1`, so the spec's
  MINOR stands - a `feat` bumping the minor, with no migration and no journal
  field.
- **Performance**: 63 registry entries, at most 6 sessions, two blocks. Not a
  consideration.
- **Rejected**: calling `validateProgram` from `assess` to skip the defensive
  path. It would couple "is this good training" to "is this well-formed" - the
  separation the spec is built on - and end `assertions.js`'s leaf status.

## Out of scope / follow-ups

- Surfacing the findings in the editor's save step and in Plan > Programme,
  already carried by the spec.
- Extracting `fold()` if a third copy appears.
- The §5 worked example's internal arithmetic - see Open question 1. If the doc
  is wrong, fixing it is a `docs(generation)` commit of its own, not a change to
  this module.

## Open questions

None. Both were answered on 2026-09-17 (Simon delegated the call), and the answers
are in the code:

1. **What to pin the §5 worked example to.** Resolved by measuring rather than by
   choosing. `targetsFor(4 × 60)` returns **54**, and the §5 total of **51** is
   exactly 54 minus the 3 series of `deltoide_ant` that indirect coverage makes
   unnecessary *at selection time* (§3 step 2). A target and a prescription, not
   the same quantity - and this module does not select. The `decisions.md` of #25
   flags a different contradiction, between §5's session tables (53) and its own
   announced total (51); that one is untouched here. Both numbers are pinned in
   `test/assertions.test.js` with the reason, so the question does not reopen.
   The 3 × 45 cascade reproduces the doc's own arithmetic exactly (−9 periphery,
   −4 isolation floor, −4 large floor, landing on 34 for a cap of 33).
2. **`level` and `priorities` vocabularies.** Local constants in
   `assertions.js`. `MUSCLE_GROUPS`, `PATTERNS` and `EQUIPMENT` describe the
   *catalogue*; a training level describes the *user's intent*, which the registry
   has no business holding. They move as a block when the input screens of Q4 of
   `decisions-moteur.md` land.

**One correction found while implementing.** The spec said assertion 6 skips
without declared targets. It does not: the announced theme is `session.sub`, part
of the program itself, so assertion 6 needs no intent at all. Without targets, 3,
4 and 6 run and 1, 2, 5 skip. `spec.md` is corrected accordingly.
