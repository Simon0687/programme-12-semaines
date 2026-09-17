# Spec - Cardio is Simon's cardio or nothing at all (#34)

## Context

#34 was written before #26 landed, and describes a situation that has since
halved. The Plan tab now follows the active definition: `buildPlan(definition)`
([src/plan.js](../../../src/plan.js)) derives the volume table, the fallback
sessions and the starting-loads paragraph from the program, and omits the cardio,
nutrition and starting-loads sections entirely when the definition has no such
data. The signature the issue names, `buildPlan(profile, startingLoads)`, no
longer exists.

What remains is narrower and sharper than "the Plan describes the wrong program":
**a program's only cardio choices are Simon's cardio or none.** `program.cardio`
accepts `"default"` or `null`, and `"default"` resolves to a bundled rule written
for one person - `"Rameur Z2"`, `~105-115 W`, drag factor 110-120, `"mercredi,
après Haut B"`, mobility on `["mardi", "jeudi", "dimanche"]`
([src/cardio.js](../../../src/cardio.js)). Issue: #34, `priority: medium`, blocks
#19.

## Scope

- **In:** deciding what `program.cardio` may express, and rebuilding the cardio
  rule accordingly so that a program can carry its own conditioning - or declare
  none - without inheriting another athlete's sessions, days and wattages.
- **Out:**
  - The Plan tab's editorial content in general - #26 settled it; only the cardio
    section is still bundled prose.
  - Moving cardio and check-in records off `weekKey(week)` to dated entries -
    that is #29, and this issue must not pre-empt its storage shape.
  - The periodisation *method* itself (how Z2 minutes ramp, when intervals
    appear). Whatever this issue decides, the shape of the rule is at stake, not
    the training logic behind it.
  - Rendering a program with no cardio at all - already works (`cardio: null`).

## User-facing behaviour

- **Séance:** the post-session hint (`session.after` → `z2` / `mob`) and the
  "Aujourd'hui" line keep naming a cardio day only when the active program
  actually has one. For Simon's program, byte-identical to today.
- **Semaine:** the "Cardio et mobilité" checklist lists the sessions *this*
  program defines, on the days it defines, instead of `"mercredi, après Haut B"`
  for every program that asks for cardio.
- **Plan:** the cardio section describes the active program's conditioning, or
  stays absent. No program ever displays another's wattages.
- **Bilan:** `bilanText()` keeps its cardio lines when the program has cardio,
  and omits them when it does not - unchanged in intent from #13.

## Acceptance criteria

- [ ] Given Simon's `haut-bas-5j.json`, when viewing Séance, Semaine, Bilan and
      Plan, then every cardio string is identical to today's, to the character.
- [ ] Given the neutral `upper-lower-4j.json` (`cardio: null`), then no cardio
      affordance appears anywhere - as today.
- [ ] Given a loaded program that declares cardio of its own, then the checklist,
      the day hints and the Plan section name that program's sessions and days,
      and never `"Haut B"`.
- [ ] Given a program whose cardio references a day it has no session on, then
      the definition is rejected at import with a paste-ready message (the #19
      repair loop), not rendered as a dangling reference.
- [ ] `npm test` green, including the #25 cardio-resolution cases in
      `test/program.test.js`.

## Data & storage impact

Depends entirely on the decision (see Open questions). If `program.cardio` grows
from a named reference into carried data, the definition format widens and
`DEFINITION_FORMAT_VERSION` bumps - **MINOR** by
[CONTRIBUTING.md](../../../CONTRIBUTING.md), since existing journals keep loading:
`"default"` and `null` must both stay valid, and a stored definition carrying
`"default"` must keep resolving to the exact same rule it resolves to today.

That last point is invariant 2.1 of
[docs/ARCHITECTURE.md](../../ARCHITECTURE.md) applied to cardio: `"default"` is a
read-time reference, so the day the bundled rule changes, every journal that
names it is re-read against different conditioning. It is the same shape of trap
as `definition: null`, one field over. Whatever this issue does, it must not make
`"default"` mean something new.

No journal *record* changes shape: cardio check marks stay under
`weekKey(week)` (#29's territory).

## Edge cases

- **A program with cardio but no mobility, or the reverse** - already anticipated
  by #13's criteria; the rule must not assume both exist.
- **A program with more or fewer than 12 weeks** - `cardioPlan(w)` hard-codes the
  S7 deload and the S1/S7/S12 interval gaps. Any data-carried cardio inherits
  #14's problem of milestones expressed as week numbers; the decision should not
  invent a second periodisation vocabulary before #14 defines the first.
- **Simon's own journal** - he is the only user of `"default"`, so he is the one
  person a regression here would hit, on real data.
- **A generated program** - an AI producing free-text cardio prose is exactly the
  case #25 closed for exercises by making the registry closed. Whatever cardio
  becomes, it has to be checkable by the validator, not trusted.

## Out of scope / follow-ups

- `CARDIO_DAY_NOTES` is keyed by weekday index (0 = Sunday), a second way of
  saying where a session sits, alongside `SESSIONS[].day`. Worth collapsing into
  one convention whichever option wins.
- The nutrition section is the same class of problem (bundled prose, shown only
  when a profile exists) and was left as-is by #27. If cardio becomes data, the
  argument for nutrition becoming data gets stronger - but it is not this issue.

## Open questions

**None.** Answered in [`decisions-spec.md`](decisions-spec.md) on 2026-09-17:
option 3, and the two questions it carries with it. What follows is the record
of what was open, and of the dependency that unblocked it.

**This issue is deliberately not decided here.** Its answer depends on a product
decision Simon opened on 2026-09-12 - whether program *generation* moves into the
app or stays with an external LLM (the branch `docs/generation/README.md` §4
records as never refuted). The dependency is direct: if the app generates
programs, it must produce conditioning it can also validate, which makes option 1
below close to mandatory; if generation stays external, option 2 stays defensible
for much longer.

1. **Cardio becomes program data.** The definition carries its own conditioning,
   the validator checks it, `cardio.js` keeps only what is genuinely method. The
   long-term answer if programs are to be generated - but it widens the format
   #25 just closed, and a generated program must then produce prose the validator
   can check.
2. **Cardio stays a bundled named rule, honestly scoped.** `"default"` is
   documented as "Simon's conditioning", the Plan section says which program it
   describes, and a program that wants different cardio declares `null` and goes
   without. Cheap, keeps the format closed, leaves a permanent second-class area.
3. **Split it.** Structural facts (which days, how many sessions, which
   modality) come from the program; the periodisation curve (how Z2 ramps, when
   intervals appear) stays method, like `progression.js`. Follows the line #25
   already drew between data and method.
4. **Does the rule stay keyed to week numbers?** Any data-carried cardio inherits
   `cardioPlan`'s S7/S12 thresholds. Decide whether this issue keeps them as-is
   (and waits for #14 to generalise), or refuses to encode week numbers in the
   format at all.
