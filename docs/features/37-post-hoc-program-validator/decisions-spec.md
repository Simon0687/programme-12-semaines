# Decisions - Post-hoc program validator: the six acceptance assertions as code (#37)

Source: spec.md
Scope: product / requirement choices only - what the module is asked to judge and
on what basis. The implementation round (module layout, function signatures, test
fixtures) will get its own `decisions.md` once `/design-tech 37` has run; Q1
below is already flagged as belonging there.
Status: **answered 2026-09-17** - Simon validated every recommendation as written.
The six answers are recorded under each question and folded back into `spec.md`.

All figures below were measured against the two shipped programs on 2026-09-17,
not estimated.

---

## Q1 - Module name and home

**Question.** The spec asks whether the module lives at `src/assertions.js` as a
leaf beside `registry.js`, or under a new `src/generation/` folder anticipating
the engine. **This is an implementation choice, not a product one** - it changes
no behaviour, no stored data and nothing a user can observe.

**Recommendation.** Send it to the design round. It belongs in `design.md` next
to the dependency table of [ARCHITECTURE.md](../../ARCHITECTURE.md) §2, where the
"imports nothing from the app" list is maintained, and it should be decided
together with where the future engine lands. If you want a default to argue
against: `src/assertions.js`, flat, because every module in `src/` is flat today
and a folder for one file is a promise about the engine that Q1 of
`decisions-moteur.md` has not yet cashed.

**Simon's decision.** Validated 2026-09-17: **deferred to the design round**,
with `src/assertions.js` flat as the default to argue against there.

---

## Q2 - Where the targets come from for a program the app did not generate

**Question.** Assertions 1, 2, 5 and 6 need a declared intent - what volume,
what frequency, what session length the program *claims* to meet. A program
loaded from a file carries none of that: `validateDefinition`
([src/journal-shape.js](../../../src/journal-shape.js#L283)) requires only `id`,
`startDate`, `startingLoads` and `weeks === 12`. Left unanswered, the module
either invents targets or cannot run four of its six assertions.

**Option A - The caller passes `targets`; the module never infers**
- What it means: `assess(program, targets)` exactly as the issue writes it. With
  no `targets`, assertions 3 and 4 still run (they need only the program) and 1,
  2, 5, 6 return a "skipped, no declared intent" finding.
- Implications: the module stays pure and has no opinion about where intent is
  stored. The future engine passes what it just computed. The editor of #36
  passes nothing today, so a hand-composed program gets two assertions out of six
  until an issue gives the editor a way to state intent.
- Pros: no assertion is ever checked against a number the module made up; the
  skip is visible rather than silent.
- Cons: four assertions are dormant on every program that exists right now.

**Option B - The module reads `definition.questionnaire`**
- What it means: `assess(definition, ...)` instead of a bare `program`, reading
  the archived questionnaire payload (questionnaire §7, amendment A3).
- Implications: the plumbing already works - `parseProgramImport` spreads
  `{ ...parsed }` ([src/import.js](../../../src/import.js)), `emptyJournal`
  stores the definition as received ([src/schema.js](../../../src/schema.js#L36))
  and `storage.js` round-trips it through `JSON.stringify`. An unknown
  `questionnaire` key survives a full save/load cycle today. **But nothing
  writes one** - not the editor of #36, not either shipped program - so in
  practice this behaves exactly like A with an extra argument shape.
- Pros: when the field does start being written, the caller needs no change.
- Cons: couples a leaf module to the definition format for a field that does not
  exist yet; and it still needs A's skip path for every program without one.

**Option C - Infer targets from the program itself**
- What it means: frequency = `SESSIONS.length`, duration = the longest session's
  own estimate, level = assumed intermediate.
- Implications: assertion 5 compares the program's estimated duration to a budget
  derived from that same estimate. It can never fail.
- Pros: all six assertions always produce a number.
- Cons: **it makes assertion 5 tautological and assertion 2 nearly so.** A
  validator that cannot fail is worse than one that skips - it reassures.

**Recommendation. A.** It is the signature the issue already specifies, and the
"skipped, no declared intent" finding is itself useful information: it says the
program has no recorded intent, which is true and worth seeing. Fully reversible
- B is a wrapper over A that any later issue can add without touching the
assertions.

**Simon's decision.** **A** (2026-09-17) - `assess(program, targets)` never
infers. With no targets, assertions 3 and 4 run and 1, 2, 5, 6 report
"skipped, no declared intent".

---

## Q3 - The threshold that makes a solicitation "primary" (assertion 4)

**Question.** Assertion 4 wants >= 48 h between two *primary* solicitations of a
large group. `EXERCISES[id].muscles` gives a weight per group; nothing in the
repo says which weight counts as primary. Left unanswered, assertion 4 cannot be
written at all.

**Option A - `muscles[m] >= 0.5`**
- What it means: the same cut that already yields contribution 1.0 in the §3 step
  2 counting rule. One threshold in the module, used by two assertions.
- Implications: 33 registry entries qualify as primary for a large group. Hack
  squat counts as primary quadriceps (0.65) but not primary hamstrings (0.35).
- Pros: one number to explain, and it matches the counting rule a reader has
  already met two assertions earlier.
- Cons: a squat-heavy week loads the hamstrings twice at 0.35 without assertion 4
  noticing.

**Option B - `muscles[m] >= 0.2`, i.e. any counted contribution**
- What it means: everything the volume rule counts at all also counts for spacing.
- Implications: 11 more entries qualify - almost all of them `ischios_fessiers`
  between 0.3 and 0.45 on squat-pattern exercises (`squat`, `legpress`, `hack`,
  `goblet_squat`, `lunge_db`, `bulg_split`). In practice this makes "two leg days"
  a hamstring spacing question as well as a quadriceps one.
- Pros: catches the squat-heavy week A misses.
- Cons: two thresholds in one module for two different purposes; and it will
  report leg-day pairs that most programs deliberately place 48-72 h apart anyway.

**Measured:** on both shipped programs the two thresholds give **identical**
results - same primary days, zero violations either way (`upper-lower-4j` pecs and
back on J1/J4, legs on J2/J5; `haut-bas-5j` pecs J1/J5, legs J2/J6, back J3/J6).
Today's data cannot separate them; only a generated program will.

**Recommendation. A.** When the evidence is neutral, take the cheaper invariant:
one threshold, already justified elsewhere in the same module. Trivially
reversible - it is a constant, and the tests that pin it are the same tests
either way.

**Simon's decision.** **A** (2026-09-17) - `muscles[m] >= 0.5`, one threshold
shared with the contribution rule.

---

## Q4 - The time model behind assertion 5

**Question.** Assertion 5 checks estimated duration <= requested duration. §3 step
3 of the engine doc models a session as 10 min of warm-up plus ~3 min per working
set. But `SLOTS` carry a real `rest` (60-180 s in both shipped programs), which a
flat 3 min ignores. Left unanswered, "estimated duration" has no definition.

**Option A - The doc's flat model: 10 min + 3 min per set**
- What it means: the exact inverse of the feasibility cap the same module
  computes, `plafond_séries = floor((durée − 10) / 3)`.
- Implications: `targetsFor` and `assess` speak one language. A program the
  feasibility test declared plannable in 60 min cannot then be reported as over
  60 min by assertion 5, because both used the same arithmetic.
- Pros: internally consistent; comparable with the engine's own planning; one
  constant to defend.
- Cons: ignores real data the program carries. It over-estimates: measured
  55 min for `upperA` where the rest times suggest 48.

**Option B - The program's own `rest`, plus a fixed work time per set**
- What it means: 10 min + Σ sets × (`rest` + ~40 s of work).
- Implications, measured per session: 3 to 14 minutes shorter than A everywhere.
  `haut-bas-5j`'s `hautC` is 64 min under A and 50 min under B - **it flips from
  over a 60-minute budget to comfortably inside it.** So the two models do not
  merely differ in precision, they disagree about a finding on a shipped program.
- Pros: closer to the wall clock; uses a field the format already has.
- Cons: `assess` would then contradict `targetsFor` inside the same module - the
  cap says a 60 min session holds 16 sets, assertion 5 says it holds 20. And the
  40 s work constant is invented, so B trades one assumed number for two.

**Recommendation. A**, with B available later as a second, clearly-labelled
"temps réel estimé" figure that informs but never raises a finding. The job of
assertion 5 is to measure the engine against the cap the engine planned with;
a second model in the same module would make the two halves disagree on purpose.
Reversible, but not silently: switching to B changes which programs report a
finding, so it is a behaviour change and deserves its own note in the CHANGELOG.

**Simon's decision.** **A** (2026-09-17) - the flat model, 10 min + 3 min per
set, the exact inverse of the feasibility cap. `rest` stays unread by
assertion 5.

---

## Q5 - How assertion 6 reads the announced theme

**Question.** Assertion 6 - "announced theme = muscles actually worked", the test
the spec calls the one FitAI fails - needs to read the announcement. Today that is
`session.sub`, free French text that `validateProgram` never inspects at all: the
nine values in the two shipped programs run from "Pecs, épaules, triceps" to
"Hip thrust, presse, dos sagittal, mollets".

**Option A - A closed French lexicon over `sub`**
- What it means: a mapping from French words to `MUSCLE_GROUPS`, reporting only a
  muscle *named but not worked*; unrecognised words ignored in silence.
- Implications: the lexicon needs three kinds of entry, all visible in the nine
  real values - synonyms (`pecs` -> pectoraux, `ischios` -> ischios_fessiers,
  `delt postérieurs` -> deltoide_post), umbrellas (`épaules` -> the three deltoid
  groups, `bras` -> biceps + triceps, `chaîne postérieure` -> ischios_fessiers +
  dos), and words to ignore because they name an exercise or a qualifier
  (`Squat`, `Hip thrust`, `presse`, `sagittal`). Roughly 30 entries, written once.
- Pros: it runs on every program that exists - bundled, hand-written, LLM-produced
  - which is the only population where a *wrong* announcement is possible.
- Cons: a hand-maintained French word list inside an otherwise data-driven module;
  a program written in English announces nothing and skips the assertion.

**Option B - A structured `session.theme: ["pectoraux", ...]`, skip when absent**
- What it means: the generator declares the theme in registry vocabulary, and
  assertion 6 compares two lists of group ids.
- Implications: format-wise it is free - `validateProgram` checks named session
  fields and ignores unknown keys ([src/journal-shape.js](../../../src/journal-shape.js#L175)),
  so a `theme` key passes through untouched. But neither shipped program has one,
  the editor of #36 does not write one, and **if the engine derives `theme` from
  the muscles it just selected, the assertion compares a number to itself.**
- Pros: no natural language anywhere; unambiguous.
- Cons: tautological in the one case that will produce most programs, and dormant
  in every case that exists today. Assertion 6 would never actually run.

**Recommendation. A.** The whole point of assertion 6 is that the *displayed*
text can lie - a session labelled "Épaules et bras" that trains hamstrings is
wrong precisely because a human reads the label. A field the generator writes
from its own selection cannot be wrong in that way. Reversible and additive:
honouring a `theme` field when one appears is a later refinement of the same
assertion, not a rewrite.

**Simon's decision.** **A** (2026-09-17) - a closed French lexicon over `sub`,
reporting only a muscle named but not worked, ignoring unrecognised words.

---

## Q6 - What "the 20 frequency x duration combinations" means with no generator

**Question.** The issue asks for tests covering the 20 combinations of §7 -
5 frequencies (2-6) x 4 durations (45/60/75/90). But nothing generates a program
yet, so 20 programs do not exist. Left unanswered, the criterion is either
unachievable or quietly dropped.

**Option A - 20 runs of `targetsFor` plus the feasibility test**
- What it means: each combination produces a target table and either a total
  within the time cap or an explicit infeasibility naming the cascade step that
  failed. `assess` itself runs on the two real programs.
- Implications: this exercises exactly the half the spec says is the hard half -
  the target table (step 2), the reduction cascade and the time cap (step 3). The
  §5 worked examples give two of the twenty a known-good expected value: 4 x 60
  min -> 51 series for a 64 cap, and 3 x 45 min -> infeasible at 34 for 33.
- Pros: executable today, and it is the part that "sizes the engine".
- Cons: `assess` is never exercised on 18 of the 20 shapes.

**Option B - Hand-write 20 fixture programs**
- What it means: author 20 plausible programs as test fixtures.
- Implications: 20 hand-written programs are 20 hand-written opinions; when the
  engine lands they are all replaced by its output.
- Pros: `assess` gets broad coverage now.
- Cons: days of work inventing data whose only authority is the person inventing
  it, then thrown away. This is the trap #25 already named - the catalogue is the
  chantier, not the algorithm.

**Recommendation. A**, and move the literal reading of the criterion - `assess`
over 20 *generated* programs - to the engine issue, where the generator that
makes it possible will exist. Pin the two §5 worked examples as the expected
values, because they are the only numbers in the repo that were computed
independently of the code being written.

**Simon's decision.** **A** (2026-09-17) - 20 runs of `targetsFor` plus
feasibility, with the two §5 worked examples pinned as expected values. The
literal reading moves to the engine issue.

---

## How to apply

Once Simon fills in each "Simon's decision", the answers fold back into
`spec.md`: resolved points move out of Open questions into the section they
belong to - Q2 and Q6 into Acceptance criteria, Q3, Q4 and Q5 into Scope - and
Open questions ends as "None". Q1 moves to `design.md` when `/design-tech 37`
creates it, and the answers to Q4 and Q5 become the two paragraphs that design
has to turn into constants and a lexicon table.
