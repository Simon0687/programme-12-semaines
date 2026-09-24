# Design - End of cycle: « Continuer ce programme » as the default door (#77)

## Summary

One pure function, `cycleReview()`, turns the active cycle into a few lines; the
Semaine screen renders them in an end-of-cycle block with two doors. The primary
door reuses what #74 built — `nextCycleFrom()` then `openEditor()`, which applies
`withCarriedLoads()` — so continuing a program is the same gesture as « Partir du
programme actif », made the default. [spec](spec.md)

## Files touched

- **`src/cycle-review.js`** (new) — `cycleReview(prog, state, weeks)`.
- **`src/App.jsx`** — `cycleNote` keeps only the before-start sentence;
  `cycleEnd` computed near it; the block rendered at the top of the Semaine
  screen; `continueProgram()` and `changeProgram()` handlers.
- **`test/cycle-review.test.js`** (new).

## Approach

```js
// cycle-review.js — pure, no React (§2.6)
// → { done, planned, lines: [{ vid, name, first, last, unit text }] }
export function cycleReview(prog, state, weeks)
```

- `planned = weeks × prog.SESSIONS.length`; `done` = logs of the active state
  with `done` and a `slot` in `prog.SESSIONS`.
- Lines: for each slot with `key: true`, each distinct exercise it held (`b1`,
  `b2`, plus any substitution found in the logs), `history(prog, state, vid)`
  (`progression.js`, active cycle only — the right scope for "this cycle"),
  non-deload/allégée/test entries; `workingSets()` on the slot's range for the
  first and the last entry; text through `loadText()`. No entry → no line.
- `display.js` gets nothing new: `loadText` already writes the unit.

In `App.jsx`:

```js
const cycleEnd = at && at.week >= definition.weeks
  ? { over: at.week > definition.weeks, review: cycleReview(prog, state, definition.weeks) }
  : null;
const continueProgram = () => openEditor(nextCycleFrom(definition, today));
const changeProgram = () => { setNav({ screen: "plan", sessionId: null }); setPlanTopic("programme"); setNewProgram(true); };
```

The block: a `bg-surface-raised` card, title, review lines, then `Btn primary`
« Continuer ce programme » and `Btn` « Changer de programme ». Tokens only (#51).

## Sequencing

1. `feat(cycle): a short review of the active cycle (#77)` — module + tests.
2. `feat(semaine): continue the program at the end of the cycle (#77)` — App
   wiring. Both with the spec and design in step 1.

## Tests

- **Unit:** counts; first → last working load; a key exercise never logged gives
  no line; substituted exercise gets its own line; deload / allégée / test
  ignored; empty state.
- **Browser:** a cycle started 13 weeks ago shows `Cycle terminé`; « Continuer »
  opens the editor on next Monday with carried loads; saving lands in week 1;
  « Changer de programme » opens the doors.

## Risks & tradeoffs

- `history()` skips logs of other cycles on purpose — correct here, the review is
  about this cycle.
- Rejected: a separate end-of-cycle screen. A card on Semaine is where the
  athlete already looks; a screen would be one tap further for no gain.
- Storage: nothing new. **MINOR**, as the spec set.

## Out of scope / follow-ups

- Calibration only for stale loads (spec, follow-ups).

## Open questions

None.
