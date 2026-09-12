# Design - Program validator admits definitions that log sessions at NaN dates (#33)

> **Built on the recommendations in [decisions-spec.md](decisions-spec.md), not on
> answers.** Q1 = A (reject everywhere), Q2 = C (enforce `1 <= day <= 7` now, leave
> the convention clash to its own issue), Q3 = A (validate against a constant the
> renderer owns). A different answer on Q2 turns step 2 from a range check into a
> rendering fix; Q1 and Q3 change less.

## Summary

`validateProgram` gains per-field checks, all inside the module #32 created, so
the three doors inherit them at once. The ordering idea is the whole fix for the
throwing half: **every tuple is checked before it is destructured**, so no input
reaches `for (const [x] of …)` unguarded. The corrupting half is closed by
validating `day` and then *proving* the property that matters - no accepted
program can produce a `NaN` date - rather than testing the symptom case by case.
Spec: [spec.md](spec.md).

## Files touched

| File | Change |
|---|---|
| `src/journal-shape.js` | `validateProgram`: tuple guard for `session.ex` / `core.ex`, `day` range, `reps` ordering, set counts, unique `SESSIONS[].id`, `after` membership. `validateDefinition`: `startingLoads` must be a plain object (the gap #32 left here deliberately). Header corrected - the "ne lève jamais" claim becomes true rather than aspirational. |
| `src/cardio.js` | `AFTER_HINTS` moves here from `App.jsx` (pure functions of `cardioPlan(week)`, no React), plus `AFTER_KINDS` as its key list. Keeps `cardio.js` a leaf. |
| `src/App.jsx` | Imports `AFTER_HINTS` instead of declaring it; `handleProgramFile`'s `reader.onload` wraps the parse so a failure becomes `setProgramError` instead of an exception lost in an event handler. |
| `test/journal-shape.test.js` | One case per rule; the "aucune fonction ne lève" list grows to include malformed programs - today it passes without exercising the case that actually throws. |
| `test/storage.test.js` | The stored journal whose definition throws now returns `{ ok: false, reason: "invalid" }` - the #32 regression, pinned. |
| `test/import.test.js` | `startingLoads: 5`; the file door reports rather than swallows. |
| `test/cardio.test.js` | **New**, small: `AFTER_KINDS` matches `Object.keys(AFTER_HINTS)`, so the vocabulary and the renderer cannot drift. |
| `docs/ARCHITECTURE.md` | Removes the remaining 2.4 violation note; adds session-id uniqueness to 2.3, since `findLog` returns the first match. |

## Approach

### Tuple guard - the throwing half

The three throw sites are all the same shape (`session.ex`, `core.ex`, and any
future one). One predicate, applied before destructuring:

```js
const isSlotRef = (e) => Array.isArray(e) && e.length === 2
  && typeof e[0] === "string" && Number.isInteger(e[1]) && e[1] > 0;
```

Set count and tuple shape are the same check, so `sets: -3` and `sets: "trois"`
fall out of it rather than needing a rule of their own. Rejection message names
the path (`program.SESSIONS[2].ex[0]`) and the constraint, per the #19
paste-ready rule.

### `day` - the corrupting half

```js
if (!Number.isInteger(session.day) || session.day < 1 || session.day > 7)
  return { reason: "invalid-program", message: `Champ invalide : program.SESSIONS[${i}].day (entier de 1 à 7 attendu)` };
```

`1..7` is what `dateForSlot` implies (`startDate + 7×(week−1) + (day−1)`), and
both shipped programs use 1, 2, 3, 5, 6. Verified: `day: 99` does **not** produce
`NaN` - it yields a real date 14 weeks out - so the check has to be a range, not
a parse test.

The acceptance criterion is stated as a property, and tested as one:

```js
// for every session of every accepted program, across all 12 weeks
assert.ok(!dateForSlot(startDate, week, session.day).includes("NaN"));
```

That is what prevents a future field from reopening the same hole: the test does
not enumerate bad inputs, it asserts the invariant over accepted ones.

### `reps`, ids, `after`

- `reps`: `[min, max]`, both integers, `0 < min <= max`. Today `[8, 5]` and
  `[-5, -1]` pass the "two numbers" check.
- `SESSIONS[].id` unique - a `Set` over the ids. Not cosmetic: `findLog(logs,
  date, slot)` returns the *first* match, so two sessions sharing an id make the
  second unreachable, the same failure that sank the first #26 attempt.
- `after`: optional; when present, a member of `AFTER_KINDS`.

### Where `after`'s vocabulary lives (Q3)

`AFTER_HINTS` is two pure functions of `cardioPlan(week)` sitting in `App.jsx`
purely by accident of history. Moving both it and `AFTER_KINDS` into `cardio.js`
lets the validator import the authority instead of copying it, and `cardio.js`
stays a leaf, so no new edge appears in the §1 dependency table beyond
`journal-shape → cardio`.

## Sequencing

Each step is green on its own - the rule and its tests land together, since a
test written first would be red and `CONTRIBUTING.md` forbids pushing that.

1. `fix(journal-shape): guard tuple destructuring before it throws (#33)` - closes
   the throw, and with it the terminal spinner #32 reopened through
   `loadJournal → validateDefinition → validateProgram`. **Merge this one alone
   if nothing else ships**: it is the regression fix.
2. `fix(journal-shape): reject a session day outside the week (#33)` - the `NaN`
   corruption, plus the property test.
3. `fix(journal-shape): reject impossible rep ranges (#33)`.
4. `fix(journal-shape): reject duplicate session ids and a non-object startingLoads (#33)`.
5. `refactor(cardio): move the post-session hints beside the rule they render (#33)`
   - pure move, no behaviour change.
6. `fix(journal-shape): reject an unrenderable after value (#33)` - depends on 5.
7. `fix(app): surface a program file failure instead of swallowing it (#33)`.
8. `test(journal-shape): exercise the never-throws invariant on real programs (#33)`
   - and correct the module header, which currently overstates.
9. `docs(architecture): close the 2.4 violation and pin session id uniqueness (#33)`.

## Tests

- **Unit, `node --test`**: one case per row of the issue's table, each asserting a
  `reason` and never a throw.
- **Property**: no accepted program yields a `NaN` date, over every session and
  every week - the criterion that does not degrade as fields are added.
- **Regression**: a *stored* journal carrying a throwing definition returns a
  verdict, closing the hole #32 opened.
- **Non-regression**: both shipped programs validate, the v1-v4 compatibility
  journals load, and the #20 / #25 / #32 suites stay green. Since this issue only
  adds rejections, those suites are the entire safety argument.
- **Manual**: load a deliberately broken program file and check the panel shows a
  message - the one path with no automated coverage, because it lives in a
  `FileReader` callback in `App.jsx`.

## Risks & tradeoffs

- **Over-rejection**, as in #32, is the only real risk. Same mitigation: the
  existing suites and the shipped programs are the gate, and they must pass
  untouched.
- **`day: 0` and `day: 7` become rejections.** Under the current code neither
  works properly anyway (0 dates to the Sunday *before* the cycle; 7 dates
  correctly but never matches `getDay()`), so this forecloses nothing that
  functions - see decisions Q2.
- **Moving `AFTER_HINTS`** touches rendering with no UI test behind it. It is a
  verbatim move of two pure functions, kept in its own step so a bisect lands on
  it cleanly.
- **Storage impact**: none. No shape change, no `SCHEMA_VERSION` bump, **PATCH**,
  inside the 2.0.0 #26 forces.
- **Alternative rejected**: validating only at import and tolerating stored
  definitions. It would need a "strict" flag through `validateDefinition` and
  would restore exactly the two-bar drift #32 removed.

## Out of scope / follow-ups

- **The `day` convention clash** (decisions Q2): `dateForSlot` reads `day` as a
  1-based offset from `startDate`, `App.jsx` compares it to `today.getDay()`
  where 0 is Sunday. They agree only because both shipped programs start on a
  Monday. A program starting mid-week has its whole calendar mapping shifted, and
  a Sunday session cannot be expressed correctly at all. Deserves its own issue,
  and it is a prerequisite for any generated program that does not start on a
  Monday.
- A program declaring `after: "z2"` while carrying `cardio: null` is internally
  inconsistent and would render a hint for conditioning it does not have. Cheap
  to add once #34 settles what `cardio` may express.

## Open questions

**None at the design level.** The three product questions in
[decisions-spec.md](decisions-spec.md) are open and this design assumes their
recommendations; Q2 is the one whose answer would change the work.
