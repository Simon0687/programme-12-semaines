# Decisions - Generate a program in the app: the deterministic engine over declared constraints (#58)

Source: `spec.md`
Scope: **product / requirement choices only** - what the feature must do and what
it stores. The implementation round (module boundaries, screen mechanics, test
shape) belongs to `design.md` and, once it exists, to its sibling `decisions.md`.
Status: **answered on 2026-09-17.** Simon's instruction was « applique tes
recommandations » - the six decisions below are the recommendations, recorded as
his. They are folded into `spec.md`, whose **Open questions** now reads « None ».

Q1 to Q5 are the spec's open questions, in its order. **Q6 was not in that list:**
it surfaced while measuring the registry for Q1, and it changes what gets stored,
so it cannot wait for the design round.

---

## Q1 - Which equipment presets are honest, given the registry we actually have

**Question.** The spec offers three presets - salle complète / home gym / poids du
corps - and asks whether « Home gym » should open an inventory. Measuring
`EXERCISES` ([registry.js](../../../src/registry.js)) answers a prior question
first: **the third preset has no program behind it.** With only bodyweight gear
the selectable pool is five entries - pompes, gainage lesté, tractions, relevé de
jambes suspendu, dips - and **8 of the 11 muscles of `VOLUME` have no primary
exercise at all**, the whole lower body included. Left unanswered, v1 ships a
button that returns a stub the six assertions will shred.

For reference, the same measurement on the other two: salle complète = 59
selectable entries, every muscle covered; home gym (haltères, barre EZ, bancs,
barre de traction, poids du corps) = 19 entries, and only `mollets` left without
a primary exercise. Note also that `kettlebell` is in the `EQUIPMENT` vocabulary
and carried by **zero** entries.

**Option A - Two presets, no inventory**
- What it means: « Salle complète » and « Home gym », fixed inventories in
  `src/generator.js`. The bodyweight preset returns in a later issue, once the
  registry gains lower-body bodyweight entries (squat, fente, hip thrust, mollets
  debout) - that is #25's territory, not this one.
- Implications: the `mollets` hole of the home gym is reported by the
  uncovered-target line the spec already requires; no new screen; the third
  button appears only when it has exercises behind it.
- Pros: nothing ships that cannot work; the one honest gap is already surfaced by
  a mechanism this issue builds anyway.
- Cons: a home gym with no pull-up bar, or with a cable machine, is described
  wrongly - a fixed preset is a guess about someone's garage.

**Option B - No presets, a checkbox list over `EQUIPMENT`**
- What it means: one screen, twelve checkboxes (the vocabulary minus
  `kettlebell`, which selects nothing).
- Implications: the collection screen stops being three chip rows; the engine
  takes a real inventory, so the uncovered-target report becomes the normal
  answer rather than an edge case.
- Pros: exact, and it makes bodyweight-only work the day the registry supports it
  without any new product decision.
- Cons: twelve checkboxes is the FitAI failure mode the engine doc opens on -
  asking the user what the app can derive. It also asks a question Simon answers
  identically every time.

**Option C - Two presets plus a « préciser » disclosure on home gym**
- What it means: A, with the home gym preset expandable into the checkbox list of
  B, pre-ticked with the preset's inventory.
- Implications: both paths exist, so both need the uncovered-target report; the
  screen grows one collapsed section.
- Pros: one click for the common case, exact for the real one.
- Cons: the most code of the three for a single-user app whose user has one gym
  and one garage.

**Recommendation. A.** The bodyweight preset is not a granularity question, it is
a missing-catalogue question, and shipping it now would produce exactly the
« cohérent mais faux » program Q1 = B was chosen to eliminate. Reversible at no
cost: presets are a constant in the generator, and B or C can replace them later
without touching what is stored (see Q6).

**Simon's decision.** **A - two presets** (2026-09-17). « Salle complète » and
« Home gym », fixed inventories in `src/generator.js`. The bodyweight preset is
not built: it is a missing-catalogue problem, and it returns when the registry
gains lower-body bodyweight entries - its own issue, in #25's territory. The home
gym's one hole (`mollets`) is reported by the uncovered-target line this issue
builds anyway.

---

## Q2 - `DEFINITION_FORMAT_VERSION`: keep 2, or bump to 3

**Question.** `intent` is a new optional top-level field on the definition. #25
bumped the format 1 → 2 when it added `program`. Does `intent` bump it to 3?
`validateDefinition()` refuses any file whose `formatVersion` exceeds the current
one with the verdict `too-new`
([journal-shape.js:299](../../../src/journal-shape.js#L299)), shown as « Ce
fichier a été créé par une version plus récente de l'appli. Mets l'appli à jour,
puis réimporte. »

**Option A - Keep 2**
- What it means: `toDefinition()` keeps writing 2; `intent` is documented as
  optional in `src/definition.js`.
- Implications: a generated file opened by an older build loads and runs, and
  loses only the advice - `validateDefinition()` ignores fields it does not name.
  Nothing else changes.
- Pros: the loss on an old build is exactly proportional to what the old build
  lacks; no rejection of a file that is entirely executable by it.
- Cons: `formatVersion` stops being a faithful record of the format's history, so
  a future reader cannot tell a v2 file with intent from one without. Only the
  field's presence says it.

**Option B - Bump to 3**
- What it means: `DEFINITION_FORMAT_VERSION = 3`, written by `toDefinition()`.
- Implications: every generated file is **hard-rejected** by any build shipped
  before this one, with a message telling the user to update. The bundled
  `public/programs/upper-lower-4j.json` stays at 2, so the note in
  `src/default-program.js` about the two staying in sync needs rewording.
- Pros: the version number keeps meaning « this file may contain things you do
  not know about ».
- Cons: it trades a working import for a refusal, over a field that only feeds
  advice. The precedent does not transfer: `program` changed what a file *is*.

**Recommendation. A.** A version bump is for a file an older app would
*misexecute*; this one it would merely under-advise. Reversible: if `intent` ever
becomes load-bearing - a stored plan, a regeneration input - that change is what
bumps the format, and it can bump it then.

**Simon's decision.** **A - keep 2** (2026-09-17). `toDefinition()` keeps writing
`DEFINITION_FORMAT_VERSION = 2`; `intent` is documented as optional in
`src/definition.js`. The bump is reserved for the day `intent` becomes
load-bearing rather than advisory.

---

## Q3 - Does the import door judge `intent`

**Question.** `parseProgramImport()` is the closed door on *form*. Should a file
carrying `intent: { frequency: "beaucoup" }` be rejected as `invalid-field`, or
carried through? The spec proposed rejecting. Running the module first changes
the picture: `targetsFor()` **already returns `null`** for a non-finite
`frequency` or `duration` ([assertions.js:276](../../../src/assertions.js#L276)),
and `assess(prog, null)` falls back to the exact behaviour of today - three
assertions skip and the « ni cible ni durée » finding is added. A malformed
intent is therefore already harmless **on those two fields**.

It is not harmless on `level`: `LEVEL_BONUS[level] ?? 0`
([assertions.js:281](../../../src/assertions.js#L281)) silently treats an unknown
level as a beginner, which is **not** the same as an absent one - `level: "zzz"`
yields targets of 6/6/6/6 where an absent level yields 7/7/7/7. The advice is
then computed against quietly wrong numbers, which is the one failure mode this
whole epic exists to avoid.

**Option A - The door validates and rejects**
- What it means: `validateDefinition()` gains an `intent` block; a malformed one
  yields `invalid-field` and the file does not load.
- Implications: one more rejection path, one more message, and a file that is
  perfectly executable is refused over an advisory field.
- Pros: one rule, applied everywhere - the door judges form, full stop.
- Cons: harsher than any other optional field, and it cannot be reached by any
  file the app itself writes.

**Option B - The door ignores it; live with the `level` fallback**
- What it means: nothing changes anywhere.
- Implications: bad numbers degrade to « no declared intent »; a bad level
  degrades to *beginner targets*, silently.
- Pros: no code.
- Cons: the silent branch is precisely the « coherent but wrong » mode.

**Option C - The door ignores it; an unknown `level` behaves like no intent**
- What it means: no new rejection. In `targetsFor()`, a `level` that is present
  but outside `LEVEL_BONUS` returns `null`, joining the two numeric guards
  already there.
- Implications: three lines in `assertions.js` and one test; the advice either
  speaks with correct targets or says it has none. No third state.
- Pros: the degradation is uniform and visible; the import door stays as narrow
  as it is today.
- Cons: touches a module shipped in #37, which nothing in this issue otherwise
  needs to change.

**Recommendation. C.** The door should not grow a rejection for a field that
cannot break execution, but the module must not have a branch where a wrong value
produces confident advice. Reversible: if the door ever validates `intent`, C's
guard simply becomes unreachable rather than wrong.

**Simon's decision.** **C - no rejection, one guard** (2026-09-17).
`parseProgramImport()` and `validateDefinition()` gain nothing: a malformed
`intent` cannot break execution. `targetsFor()` gains a third guard beside its two
numeric ones - a `level` present but outside `LEVEL_BONUS` returns `null`, so the
advice either speaks with correct targets or says it has none. No silent
beginner fallback.

---

## Q4 - Is the declared intent visible in the editor

**Question.** After generation the draft opens in `ProgramEditor`
([ProgramEditor.jsx](../../../src/ProgramEditor.jsx)), which today shows a name
field, the sessions and the starting loads. The intent has to travel through the
draft either way - `draftFrom()` must copy it or « Partir du programme actif »
silently strips it from a generated cycle. The question is whether the user sees
it.

**Option A - Invisible, carried through**
- What it means: `intent` rides in the draft and in `toDefinition()`, shown
  nowhere.
- Implications: smallest change; `isDirty()` compares a snapshot, so an untouched
  intent never marks the draft dirty.
- Pros: nothing new on screen.
- Cons: Plan will say « Dos : 4 séries de travail pour une cible de 7 » about a
  program whose cible the user cannot see anywhere. The advice becomes an oracle.

**Option B - One read-only line in the editor header**
- What it means: under the name field, « Généré pour 4 séances de 60 min,
  hypertrophie, niveau intermédiaire ». Text, not inputs.
- Implications: one block of JSX reading `draft.intent`; absent for a
  hand-composed draft, so the line simply does not render.
- Pros: the advice block becomes readable - the targets it judges against are on
  the screen where the program is edited. It also makes the v1 constants visible
  rather than hidden, which is what makes the lot-2 screens an obvious next step.
- Cons: a surface to keep in sync if the intent ever gains fields.

**Option C - Editable**
- What it means: changing the frequency in the editor changes the targets.
- Implications: editing the intent without regenerating produces a program judged
  against an intent it was never built for - which is legitimate, but it is a
  feature with its own design.
- Pros: full control.
- Cons: out of scope, and it invites « I changed it to 6 days, why did nothing
  happen ».

**Recommendation. B.** The advice is the point of storing the intent; an advice
whose reference values are invisible is worse than no advice. Reversible: B is
additive to A, and C remains open afterwards.

**Simon's decision.** **B - one read-only line** (2026-09-17). Under the name
field of `ProgramEditor`, a static line naming the frequency, the duration, the
objective and the level a generated draft was built for. It does not render for a
hand-composed draft. Editing the intent stays out of scope.

---

## Q5 - Naming a generated program

**Question.** `withNewId()` mints the stored id from the name -
`uniqueId(slug(draft.name) || "programme", takenIds)`
([program-editor.js:155](../../../src/program-editor.js#L155)) - so the name is
not decoration, it is the identity of the cycle in `programs`. A generated draft
has to arrive with one.

**Option A - Derived from the split and the constraints**
- What it means: « Upper/Lower 4 jours, 60 min », yielding the id
  `upper-lower-4-jours-60-min`. The editor's existing name input
  ([ProgramEditor.jsx:253](../../../src/ProgramEditor.jsx#L253)) keeps it
  editable before the id is minted at save.
- Implications: one naming function in the generator, fed by data it already has.
- Pros: no extra screen; a readable id in storage and in exports; and a name that
  says what the cycle is when three of them sit in the Plan list.
- Cons: none identified beyond having to pick a wording.

**Option B - Asked on a fourth screen**
- What it means: « Comment veux-tu l'appeler ? » before generating.
- Pros: the user's own vocabulary.
- Cons: a screen for something derivable, which §1.3 of the engine doc names as
  the thing not to do; and it is asked before the user has seen the program.

**Option C - Fixed, like `emptyDraft()`'s « Nouveau programme »**
- Pros: zero code.
- Cons: two generated cycles collide into `nouveau-programme` and
  `nouveau-programme-2`; the storage stops being readable.

**Recommendation. A.** Derived, editable in place. Reversible: the name is a
string in the draft and B is always available as a later refinement.

**Simon's decision.** **A - derived** (2026-09-17). The generator names the draft
from the split and the two numbers - « Upper/Lower 4 jours, 60 min » - and the
editor's existing name input keeps it editable before `withNewId()` mints the id
from it at save.

---

## Q6 - Does the stored intent record the equipment (not in the spec's list)

**Question.** The spec stores `intent = { frequency, duration, level, objective,
priorities }` - the five fields `targetsFor()` takes. Equipment is deliberately
absent, because the targets do not depend on it. But it is the field that
*explains the program*: on a home-gym cycle, Plan will report a missing calf
target, and nothing stored says why. Left unanswered, v1 stores a program whose
main deviation has no recorded cause.

**Option A - Five fields, as specced**
- What it means: the equipment lives only in the moment of generation.
- Implications: `intent` is exactly `targetsFor()`'s argument, which is a clean
  correspondence; regenerating later starts from scratch.
- Pros: nothing stored that no reader uses.
- Cons: the « mollets : 0 série » on a home-gym program is unexplainable six
  months later - and unexplainable is what the whole assertions surface exists to
  fight.

**Option B - Six fields: add `equipment`**
- What it means: `intent.equipment` holds the preset key from the closed
  vocabulary decided in Q1 (e.g. `"home-gym"`).
- Implications: `targetsFor()` destructures what it needs, so an extra key costs
  nothing there; the field is what a future « regenerate » and the lot-2 screens
  read; it is also the natural place for a list, if Q1 ever becomes an inventory.
- Pros: the program carries the three answers that produced it, not two of them.
- Cons: one field nothing reads on day one - the same shape as `articulations` in
  the registry, and for the same reason.

**Recommendation. B.** The stored intent should record what was asked, not only
what the validator consumes; otherwise the app's own explanation of its program
is incomplete at exactly the point where it deviates. Reversible either way, and
cheap: a single optional string, MINOR like the rest.

**Simon's decision.** **B - six fields** (2026-09-17). `intent.equipment` holds
the preset key (`"salle-complete"` or `"home-gym"`). `targetsFor()` ignores it;
it is there so the program carries the three answers that produced it, and so
that the day Q1 becomes an inventory nothing stored has to change shape.

---

## How to apply

Once Simon fills in each « Simon's decision », the answers fold back into
`spec.md`: each resolved point moves out of **Open questions** into the section it
belongs to - Q1 into *User-facing behaviour* and the acceptance criteria, Q2, Q3
and Q6 into *Data & storage impact*, Q4 and Q5 into *User-facing behaviour* - and
**Open questions** ends as « None ». Q3's recommendation, if kept, adds a line to
*Scope > In* (a guard in `assertions.js`), which the spec currently does not
touch. Then `/design-tech 58`.
