# Decisions - Closed exercise registry (#25), round 2: the amendment's Q7 / Q8

Source: the [2026-09-10 amendment](spec.md#amendment---2026-09-10-the-generation-catalogue-exists-and-it-is-a-second-registry)
to [spec.md](spec.md), which reopened round-1's Q4 once
[`docs/generation/`](../../generation/README.md) landed in the repo.
Scope: the registry's *contents* and id namespace. The issue's boundary, the
data-only `program` shape, the `cardio` named rule and the
`DEFINITION_FORMAT_VERSION` bump are untouched.
Status: **Simon decided, 2026-09-10.** Q8 as recommended; Q7 split in two,
because the option as worded bundled a free change with an expensive one.

---

## Q7 - Which id namespace?

**Decided: the registry keys stay the terse slugs (`dc`, `incl_db`).** The
catalogue's kebab ids (`developpe-couche-barre`) are carried on each entry as a
non-key alias, so [`docs/generation/`](../../generation/README.md) stays readable
without a translation table.

Simon picked "rich schema, readable ids included". The two halves do not cost the
same, and the amendment's own argument decides the second one against itself:

```js
// src/App.jsx:302-311, onSet() - the stored journal is keyed by exercise id
ex[vid] = rows;
st.logs[`w${week}_${sid}`] = { ...cur, ex };
// read back identically at src/App.jsx:354 (bilanText) and
// src/progression.js:35 (history)
```

`logs["w3_A"].ex["dc"]` holds every set already logged on that exercise.
Renaming the key orphans them - the data stays in localStorage, no screen finds
it again. That is #25 going from **MINOR to MAJOR**, a v2 → v3 step in
`MIGRATIONS` ([src/schema.js:26](../../../src/schema.js)) rewriting every `ex`
key of every logged session, and a data-loss risk placed on the critical path of
a change whose entire point is to unblock #19.

What it buys: legibility of a file a machine writes and a machine reads. Round 1
already answered that - `name` carries the human label.

**Escape hatch, if Simon wants the readable ids anyway:** they ride #16 (dated
timeline), which rewrites the journal's shape for its own reasons and can carry
the rename in the same migration at near-zero marginal cost. Deferring costs
nothing here; doing it here costs a migration.

## Q8 - Populate the selection fields, or only declare them?

**Decided: declare all of them and populate what the catalogue already provides**
- the amendment's recommendation, taken as-is.

```
EXERCISES[id] = {
  // execution (round 1) - what the Séance screen needs
  name, cue, unit?, incr?, start?, perHand?, side?,
  // selection (catalogue) - what any generator needs, LLM or code
  muscles: { [group]: number },   // 11 keys, sums to 1.0 - no longer "reserved"
  pattern, type, equipement: [], articulations: [],
  stabilite, niveau_min, cout_systemique,
  alias?,                          // the catalogue's kebab id (Q7)
}
```

These fields are **additive**: no stored journal, no existing definition file and
no current code path reads them. #25 stays **MINOR**, no migration. Deferring
them means annotating 60-70 exercises twice and shipping a #19 pack that cannot
honour a shoulder exclusion or a home-gym inventory in the meantime.

**`increment_kg` vs `incr`:** same intent, two names. `incr` stays the field the
app reads; the catalogue's `increment_kg` is its *source value* during the merge
and must agree entry by entry, or the disagreement must be deliberate. Do not
ship both names.

**Registry contents = the union**, as the amendment states: ~40 `BASE_V` entries
+ ~22-28 catalogue-only entries ≈ 60-70. Two catalogue-level facts carry over
unchanged (see [its note](references/catalogue-exercices-v1.md)): the 3 added
isolation patterns (`iso_pectoraux`, `iso_quadriceps`, `iso_ischios`), without
which "no two exercises of the same pattern in one session" forbids
squat + leg extension; and the 11 muscle keys with `ischios / fessiers` merged.

## Consequences for [design.md](design.md)

- `EXERCISES[id]` gains the selection fields; the "reserved, unused `muscles`"
  wording goes.
- `test/registry.test.js` gains catalogue-integrity checks: 11 muscle keys
  summing to 1.0, `pattern` within the taxonomy, `equipement` values within the
  vocabulary, `stabilite` / `niveau_min` / `cout_systemique` in range, `alias`
  unique.
- Acceptance criterion *"the entry shape includes a documented, optional
  `muscles` field, unused by this issue"* is replaced by a populated-and-checked
  criterion.
- **Unchanged:** the four-step sequencing (step 1 just lands a richer module),
  `buildProgram()`, `validateProgram()` (it validates the `program`, not the
  registry), the `?? DEFAULT_DEFINITION.program` fallback, `formatVersion` 1 → 2,
  and every round-1 open question except Q4.

---

## Flagged, not decided here: which engine (README §4)

Asked alongside Q7/Q8, Simon chose *"the document becomes the #19 pack, now -
the LLM generates the definition, the app validates and executes"*.

**This contradicts [`docs/generation/README.md`](../../generation/README.md) §4**,
written the same day, which recommends the opposite split: *"LLM pour la
collecte, règles pour la génération, et le moteur hors de l'app"* - and argues
it with the failure mode the questionnaire itself names, that a wrong program
reads as a coherent one and only shows up six weeks later on a volume imbalance.
That recommendation stands unrefuted; recording the choice does not settle it.

It does not block #25 either way. README §4 says so itself: reconciling the two
registries (B3) is on the critical path in both branches, because an LLM and a
deterministic engine need the same closed catalogue. **Q7 and Q8 above are that
reconciliation, and they are safe to implement before the engine question is
settled.** What the answer changes is only what #19 ships - a prompt, or a tool.

## Blocker for the LLM branch, if it is confirmed: fix the engine document first

Under the chosen branch, [`moteur-generation-programme.md`](../../generation/moteur-generation-programme.md)
stops being a design note and becomes **prompt text**. A prompt cannot be
"mostly right": a contradiction in it is a licensed hallucination. Four found on
this pass, none of them recorded elsewhere:

1. **§2 contradicts §5.** §2 concludes *"le déficit [deltoïde antérieur] tombe à
   0 et le moteur ne prescrit pas de développé vertical en plus"*, and it is the
   headline argument of the whole section - the fix for FitAI's "muscles
   parasites". §5 then prescribes a **développé militaire haltères, 2 séries**,
   in Haut B. The two cannot both be right.
2. **The worked example does not balance**, and by exactly that amount: §5
   prescribes **53 sets** (14 + 14 + 13 + 12) against an announced target of
   **51**, while the deviations listed at the end of §5 cancel out
   (+1 mollets, +1 abdos, −1 biceps, −1 triceps = 0). The 2 extra sets are that
   développé militaire. Finding 1 and this one corroborate each other.
3. **`cible(m)` can go negative** for a prioritised group:
   `max − min − bonus_niveau` is `2 − 2 − 2 = −2` for the rear delt at advanced
   level. The `[min, max]` clamp catches it, but the formula should be written as
   an explicit clamp rather than rely on a later line.
4. **The §4 score mixes units** - `3 × couverture` (sets), `2 × stabilité` (1-3),
   `+1 × composé` (boolean). Reproducible, but the weights are not comparable,
   which matters as soon as the score is a rule an LLM is meant to apply rather
   than code that just runs.

Plus the two the catalogue note already carries: the pattern taxonomy announces
12 and lists 13, and §5 uses an `isolation ischios` pattern that appears in
neither list.

## Follow-up, 2026-09-10: constrain vs delegate, for the #19 pack

Simon's question: does the LLM get the full rule set to follow step by step, or
free choice from the registry, guided by its own judgement? Neither extreme
works, for different reasons.

- **Free choice** reproduces the FitAI bug the engine document exists to fix -
  40-50% overshoot on shoulders/arms from not counting indirect volume, junk
  volume filling the time slot, duplicated patterns in a session. Not because
  the LLM is bad, but because these rules are *counts* (contribution
  1.0/0.5/0, a deterministic reduction cascade), and an LLM approximates a
  count instead of computing it.
- **Full instructions** (the 7-step algorithm as prompt text, step by step) asks
  an LLM to execute a greedy loop with cumulative deficits and clamps reliably -
  errors accumulate silently, undetectable short of full revalidation. And if
  the algorithm is spelled out in full, it might as well be the ~400-600 lines
  of JS it already is (§7 of the engine doc) - an LLM's advantage is judgement,
  not arithmetic.

**Working split, three tiers:**

1. **Post-hoc validator, never a followed instruction** - the engine doc's §7
   acceptance assertions (volume in range, no duplicated pattern in a session,
   ≥48h spacing, duration ≤ requested, announced theme = muscles actually
   worked). Computed in code after generation, not hoped-for via prompt wording.
   Reject with an AI-addressable message, same pattern as #20 - a repair loop,
   not one-shot.
2. **Closed data handed to the LLM, not recomputed by it** - the registry (no
   invented ids), the closed vocabularies (patterns, equipment, joints), and
   *already-computed targets* where the app can compute them (per-muscle volume,
   session set cap) - the result, not the algorithm that derives it. Smaller
   error surface, and it is mechanically closer to the "app generates it"
   end-state Simon wants to reach.
3. **Genuinely delegated to LLM judgement** - the engine doc's own §6: choosing
   between two equally-valid exercises, exercise ordering/pairing, and the
   out-of-model cases (evolving injury, secondary sport, competition prep) that
   the rules explicitly cannot handle.

**Consequence for suite A (chosen earlier this session):** "the app validates"
must mean tier 1 above, not just `parseProgramImport()`'s shape check. Without
the §7 assertions running as code, suite A is the exact failure the README §4
warns about - a coherent but wrong program passing undetected. The validator
(previously offered as an alternative "suite C") becomes a **required piece of
suite A**, not a competing option.

Not yet actioned: this reflection is recorded, not yet turned into a #19
sub-task or a validator module. Next step when resumed: decide whether the
validator is scoped inside #19 or as its own issue ahead of it.
