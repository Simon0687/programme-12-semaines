# Decisions - Program validator admits definitions that log sessions at NaN dates (#33)

Source: spec.md
Scope: product / requirement choices only - how strict the validator is, and what
a user loses or keeps when it refuses. Implementation choices are settled in
`design.md`.
Status: awaiting Simon's answers - the recommendations below are what `design.md`
is built on, so a different answer means revisiting it.

---

## Q1 - What happens to a journal already stored with a malformed definition?

**Question.** Since #32, `loadJournal` runs `validateDefinition` on the active
program, so every rule added here also applies to journals already on disk. A
definition with `day: "lundi"` has been writing its sessions at `"NaN-NaN-NaN"`
for as long as it existed; rejecting it means a journal that opens today stops
opening. Leaving it unanswered means shipping a validator whose severity differs
between the import door and the storage door - the exact drift #32 removed.

**Option A - Reject everywhere, consistently**
- What it means: the stored door and the import doors share one bar, as #32
  established.
- Implications: a journal carrying such a definition shows the load-error message
  and the app stays usable (that is #32's contribution); the data is still in
  `localStorage` and still exportable from the Données panel. Nothing *readable*
  is lost, because rows dated `NaN-NaN-NaN` are already unreachable by `findLog`
  and unsortable by `history()`.
- Pros: one bar, no drift, no new concept; the failure is visible instead of
  silently corrupting more sessions every week.
- Cons: someone whose app opened yesterday finds a refusal today, with no
  in-app way to repair the definition.

**Option B - Reject at import, tolerate what is stored**
- What it means: only new definitions are held to the new rules.
- Implications: two severities again, and `validateDefinition` needs a "strict"
  flag - the shape #32 spent a whole issue removing.
- Pros: nobody's app stops opening.
- Cons: a program known to be writing corrupt dates keeps writing them, every
  session, indefinitely. The bug this issue exists to stop continues under a
  validator that has been taught to recognise it.

**Option C - Reject, plus a repairing migration**
- What it means: A, plus a migration that recomputes or quarantines rows dated
  `NaN-NaN-NaN`.
- Implications: `SCHEMA_VERSION` bump, so **MAJOR** rather than PATCH, and #33
  leaves the 2.0.0 blocker slot it currently occupies. The migration has no
  honest input either: a row dated `NaN` carries no week number since #16, so
  its real date is not recoverable - only quarantine is.
- Pros: leaves no unreachable rows behind.
- Cons: pays a migration to relocate data nobody can read anyway, and delays the
  release.

**Recommendation.** **A.** The rows in question are already unreachable, so the
refusal costs visibility of something that was not visible; and #32 made that
refusal survivable - the app opens, the panel is reachable, the export works. C
stays available later if a real journal ever hits it, which is unlikely: reaching
this state requires a hand-edited definition, since neither import door has ever
accepted `day: "lundi"` without also throwing.

**Simon's decision.** _(left blank)_

---

## Q2 - What does `day` actually mean? (the rule cannot be written without this)

**Question.** The spec asks for "`day` is an integer within the week". Verified,
there are **two incompatible conventions in the code today**:

- `dateForSlot(startDate, week, day)` computes `startDate + 7×(week−1) + (day−1)`
  ([src/schema.js](../../../src/schema.js)) - a **1-based offset from the start
  date**. `day: 1` is the start date itself, `day: 7` the seventh day.
- `App.jsx` finds today's session with `prog.SESSIONS.find(x => x.day === weekday)`
  where `weekday = today.getDay()` - a **JS weekday index, 0 = Sunday**.

They agree only because both shipped programs start on a Monday, where
`getDay()` happens to equal the 1-based offset. The consequences are real:

| `day` | `dateForSlot` gives | `App.jsx` "Aujourd'hui" |
|---|---|---|
| `0` (Sunday, JS convention) | the Sunday **before** the cycle starts | matches on Sundays |
| `7` (seventh day of the week) | the correct Sunday | never matches - `getDay()` is never 7 |

So a Sunday session cannot be expressed correctly at all, and any program whose
`startDate` is not a Monday has its whole calendar mapping shifted.

**Option A - `day` is a 1-based offset from `startDate` (1-7)**
- What it means: the validator enforces `1 <= day <= 7`; `App.jsx`'s lookup is
  corrected to compare against an offset derived from `startDate`, not `getDay()`.
- Implications: touches the "Aujourd'hui" line and `CARDIO_DAY_NOTES`, which is
  keyed by `getDay()` index. Makes a non-Monday `startDate` work correctly.
- Pros: matches what the stored dates already mean - `dateForSlot` is what wrote
  every date in every journal, so this convention is the one with history behind
  it.
- Cons: widens #33 beyond validation into a rendering fix.

**Option B - `day` is a JS weekday (0-6) and `startDate` must be a Monday**
- What it means: the validator enforces `0 <= day <= 6` *and* that `startDate`
  falls on a Monday, making the current coincidence an explicit rule.
- Implications: rejects any program starting mid-week - including, potentially, a
  generated one. `day: 0` still needs fixing in `dateForSlot`, or Sunday sessions
  stay mis-dated by a week.
- Pros: smallest change to `App.jsx`; encodes what the data already looks like.
- Cons: a format constraint invented to protect a bug, and it forbids a perfectly
  reasonable program - one starting on a Wednesday.

**Option C - Validate `1 <= day <= 7` now, fix the convention in its own issue**
- What it means: #33 enforces the range that `dateForSlot` implies and that both
  shipped programs satisfy (1, 2, 3, 5, 6); the Sunday and non-Monday bugs get a
  separate issue.
- Implications: blocks the `NaN` corruption immediately without pulling a
  rendering fix into a release blocker. `day: 0` becomes a rejection, so nobody
  can newly reach the mis-dated-Sunday case.
- Pros: keeps #33 small, shippable, and on the 2.0.0 path; the range chosen is
  correct under either convention for days 1-6.
- Cons: leaves the ambiguity documented but alive.

**Recommendation.** **C.** The corruption is the blocker; the convention clash is
a real bug but a separate one, and folding a rendering change into the last issue
before a release is how blockers slip. Rejecting `day: 0` and `day: 7` now is
conservative in the right direction - both shipped programs use 1-6, and it
prevents anyone from newly reaching the broken cases while the convention is
settled.

**Simon's decision.** _(left blank)_

---

## Q3 - Does `after` become part of the format's closed vocabulary?

**Question.** `session.after` selects the post-session hint; `AFTER_HINTS` in
`App.jsx` knows `z2` and `mob`, and an unknown value renders nothing. Should the
validator reject an unknown one, and against what authority?

**Option A - Validate against a constant the renderer owns**
- What it means: the keys of `AFTER_HINTS` move into a module the validator can
  import (or the module that owns cardio rendering), and the validator checks
  membership.
- Implications: one more small module boundary; the validator and the renderer
  cannot disagree about what is renderable.
- Pros: the same pattern #32 applied to the three doors - one authority, no
  drift; a new hint added later is automatically accepted.
- Cons: couples the format's vocabulary to a rendering table.

**Option B - Hardcode `["z2", "mob"]` in the validator**
- What it means: the list lives in the validator.
- Pros: trivial.
- Cons: two lists, and the day someone adds a third hint the validator silently
  rejects it - drift, reintroduced in the small.

**Recommendation.** **A.** The cost is one export; the alternative is a second
source of truth for a vocabulary the app renders, which is precisely the class of
bug this pair of issues has been closing.

**Simon's decision.** _(left blank)_

---

## How to apply

Once each "Simon's decision" is filled in, the answers fold back into `spec.md`
(Open questions becomes "None") and `design.md` is checked against them - Q2 in
particular decides whether step 3 of the sequencing is a one-line range check or
a rendering fix.
