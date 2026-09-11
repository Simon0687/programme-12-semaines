# Design - Centralise the journal key builders ahead of the dated timeline (#24)

## Summary

Add two exported functions, `logKey(week, sessionId)` and `weekKey(week)`, to
`src/schema.js`, and route every inline `` `w${...}` `` template literal in
`src/progression.js`, `src/App.jsx`, and `test/progression.test.js` through them.
The builders return byte-identical strings to today's inline literals, so this is
a pure refactor with no data or behaviour change. See
[spec.md](spec.md).

**Where the builders live:** `src/schema.js`, not a new `src/journal.js`. Reasons:
`schema.js` already owns the journal shape (`emptyJournal`, `withVersion`,
`DEFAULT_PROGRAM_ID`) and imports nothing itself, so importing it from
`src/progression.js` (which today has zero imports, by design, so it stays
`node --test`-loadable) introduces no import cycle. A new file for two one-line
functions would be a second place to look for "how is a journal key shaped" with
no offsetting benefit.

## Files touched

- `src/schema.js` — add `logKey(week, sessionId)` and `weekKey(week)` near the
  other journal-shape exports (after `emptyJournal`, before `MIGRATIONS`).
- `src/progression.js` — `history()` (line 34): replace the inline template
  literal with `logKey(w, s.id)`. Add the import.
- `src/App.jsx` — replace every inline key:
  - `doneMap` (line 251, two occurrences) → `logKey(week, s.id)`.
  - local `wkey` helper (line 274) → deleted; its five call sites
    (278, 282, 289, 292, 297, 306, 310) call `logKey(week, session.id)` directly,
    or keep a one-line local alias `const wkey = (sid) => logKey(week, sid);` if
    that reads better at the call sites — implementer's call, behaviour is
    identical either way.
  - `setCardio`, `toggleMob`, `setCheck` (312-314) → `weekKey(week)`.
  - `bilanText` (322, 323, 331) → `weekKey(week)` / `logKey(week, s.id)`.
  - the "Semaine" tab summary (417, 418, 505) → `weekKey(week)` / `logKey(week, s.id)`.
  - add `logKey, weekKey` to the existing `import ... from "./schema.js"` at
    line 3.
- `test/progression.test.js` — the `S(...)` fixture builder (line 26): replace
  the inline template literal with `logKey(week, sid)`. Add the import.

No other file references the `w{week}...` format (confirmed by
`grep -rn 'w\$\{' src/ test/`, which today returns exactly the eleven lines
above).

## Approach

```js
// src/schema.js
export const logKey = (week, sessionId) => `w${week}_${sessionId}`;
export const weekKey = (week) => `w${week}`;
```

Both are one-line, no validation: they format whatever they're given, same as the
literals they replace. `src/progression.js` and `test/progression.test.js` import
them from `./schema.js` / `../src/schema.js` respectively; `src/App.jsx` adds them
to its existing `schema.js` import.

No other control flow changes: every caller keeps its current signature and
return shape, only the key string's construction moves behind a named call.

## Sequencing

1. `refactor(journal): add logKey/weekKey builders to schema.js (#24)` — add the
   two functions and a small unit test pinning their output
   (`logKey(3, "hautA") === "w3_hautA"`, `weekKey(3) === "w3"`). Nothing calls
   them yet. Safe to merge alone; `npm test` and `npm run build` unaffected.
2. `refactor(progression): route history() and test fixtures through logKey (#24)`
   — update `src/progression.js:34` and `test/progression.test.js:26`. Run
   `npm test`: every existing assertion in `test/progression.test.js` must pass
   unmodified, since `logKey` produces the same string the fixtures relied on.
3. `refactor(app): route App.jsx journal keys through logKey/weekKey (#24)` —
   update all remaining call sites listed above and drop the local `wkey`
   closure (or fold it into a one-line alias, per Approach). Manual
   click-through with `npm run dev`: open a session, fill a set, validate,
   reopen; fill a cardio entry and a check-in; open "Semaine" and "Bilan" and
   confirm the same values render as before the change.
4. Verify: `grep -rn 'w\$\{' src/ test/` returns only the two definitions from
   step 1. Fold this check into step 3's commit if it's clean on the first try;
   otherwise a short follow-up commit.

Each step leaves the app in a working, testable state; steps 2 and 3 are
independently revertable without touching the other.

## Tests

- **Unit** (`node --test`, added in step 1): pin `logKey`/`weekKey` output for a
  couple of representative weeks (1, 3, 7, 12) and session ids — this is also the
  regression net #16 will trip if it ever changes these builders' output by
  accident instead of on purpose.
- **Existing suite** (`test/progression.test.js`): must pass with zero changes to
  expected values, per the spec's acceptance criteria.
- **Manual** (`npm run dev`): click-through described in step 3, plus reloading
  the page to confirm a real journal already in `localStorage` (Simon's) renders
  identically — the keys read back must match what's already stored.

## Risks & tradeoffs

- **Risk: a missed call site.** Mitigated by the grep check in step 4 being part
  of the acceptance criteria, not just a suggestion.
- **Risk: import cycle.** None introduced — `schema.js` has zero imports of its
  own; `progression.js` gains its first import but stays free of React, so
  `node --test` can still load it directly.
- **Alternative rejected: new `src/journal.js`.** Considered per the issue body's
  wording ("`src/schema.js` ... or a new `src/journal.js`"). Rejected: no
  functional or cycle-avoidance reason to split two one-line functions out of the
  module that already owns the journal's shape.
- **Version level:** PATCH, as the spec states — the produced keys are
  byte-identical, so no journal, stored or exported, changes shape.

## Out of scope / follow-ups

- Replacing this key format with the dated, append-only timeline (`kind`,
  `updatedAt`, `deletedAt`, `schemaVersion` per record) — #16, which is exactly
  what this issue exists to prepare.

## Open questions

None.
