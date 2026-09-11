# Design - Derive the program's shape from the active bundle instead of literals in App.jsx (#22)

## Summary

Remove the ten hardcoded program-shape literals from `src/App.jsx` and read them from the active `prog` bundle and `definition` instead. Add two pure helper functions to `src/program.js` to derive the key-slot list and cardio-only days (the two values that aren't plain property reads), add an `after` hint field to each session, wrap the `state` object in `useMemo` to unblock memoization elsewhere, and refresh `src/program.js`'s stale header. The change is a pure refactor: no visible behaviour change for the default program, and it unblocks #13 (which depends on this landing first). See [spec.md](spec.md).

## Files touched

- `src/program.js` — add `getKeySlots(prog)` and `getCardioDayNotes(prog, CARDIO_DAY_NOTES)` helper functions with unit tests; add `after` field to each SESSIONS entry; refresh header comment.
- `test/program.test.js` — new file with unit tests for the two helpers.
- `src/App.jsx` — remove/replace ten literals; wrap `state` in `useMemo`; refresh inline references from hardcoded values to derived ones.
- No storage changes; no new files beyond the test file.

## Approach

### 1. Helper functions in `src/program.js`

**`getKeySlots(prog)`**: Return an array of slot ids from `prog.SLOTS` that have `key: true`, in their declaration order. Used by `bilanText()` in App.jsx instead of the hardcoded `["dc","squat","pull","ohp","hipthrust","latraise"]`.

```js
export function getKeySlots(prog) {
  return Object.entries(prog.SLOTS)
    .filter(([, slot]) => slot.key)
    .map(([id]) => id);
}
```

**`getCardioDayNotes(prog)`**: Return an array of weekday numbers (0–6) that have a `CARDIO_DAY_NOTES` entry but no matching session in `prog.SESSIONS`. Used by App.jsx line 282 (`weekday === 0 || weekday === 4`) instead of hardcoding.

```js
export function getCardioDayNotes(prog) {
  const sessionDays = new Set(prog.SESSIONS.map(s => s.day));
  return Object.keys(prog.CARDIO_DAY_NOTES)
    .map(Number)
    .filter(day => !sessionDays.has(day));
}
```

### 2. Session `after` field

Add an optional `after` field to each SESSIONS entry, e.g.:
```js
{ id: "hautB", name: "Haut B", …, after: "z2" }
{ id: "basA", name: "Bas A", …, after: "mob" }
```

App.jsx currently hardcodes this logic as two separate lines checking `session.id === "hautB"` and `session.id === "basA"`. Instead, read `session.after` if present.

### 3. Replace literals in App.jsx

| Current | New |
|---|---|
| `useState("hautA")` | `useState(prog.SESSIONS[0].id)` (line 186) |
| `weekday === 0 \|\| weekday === 4` | `getCardioDayNotes(prog).includes(weekday)` (line 282) |
| `const keys = […]` | `const keys = getKeySlots(prog)` (line 351) |
| `[false, false, false]` in toggleMob | `Array(prog.MOB_DAYS.length).fill(false)` (line 336) |
| `/3` in bilan | `prog.MOB_DAYS.length` (line 365, and same elsewhere) |
| `/5` in badges | `prog.SESSIONS.length` (line 364, 606-607) |
| `session.id === "hautB"` / `"basA"` | read `session.after` (line 492-493) |
| `week === 12` (AMRAP) | `week === definition.weeks` (line 109) |
| `Math.min(12, …)` | `Math.min(definition.weeks, …)` (line 176, 447) |
| `dayIdx >= 84` | `dayIdx >= definition.weeks * 7` (line 424) |
| `"sur 12"` | `"sur " + definition.weeks` (line 444) |

### 4. Wrap `state` in `useMemo`

Currently `state` is rebuilt on every render:
```js
const state = { logs: active.logs, cardio: active.cardio, checkin: active.checkin };
```

This defeats every `useMemo` downstream (line 104-105, 272-276) because its identity changes every render. Wrap it:
```js
const state = useMemo(() => 
  ({ logs: active.logs, cardio: active.cardio, checkin: active.checkin }),
  [active]
);
```

### 5. Refresh `src/program.js` header

Update the comment at line 10 from "viennent de src/profile.js ... refold sur V ci-dessous" to "injected by `buildProgram(definition)` (#6)".

## Sequencing

1. `refactor(program): add getKeySlots and getCardioDayNotes helpers (#22)` — add the two functions to `src/program.js` (lines 195+), create `test/program.test.js` with unit tests for both, export them. Verify: `npm test` passes with 100% coverage of the helpers.

2. `refactor(program): add after field to SESSIONS, refresh header (#22)` — add `after: "z2"` to hautB and `after: "mob"` to basA in `SESSIONS` array ([src/program.js:133-139](../../../src/program.js#L133-L139)); refresh the header comment (line 10). No logic change; `npm test` unchanged.

3. `refactor(app): remove hardcoded program literals, read from prog and definition (#22)` — replace all ten literals in App.jsx (see table above). No behaviour change for the default program; the AMRAP flag and week-number displays change from hardcoded 12 to `definition.weeks` (which is 12, so invisible). `npm test` unchanged; `npm run build` succeeds. **Safe to merge alone.**

4. `refactor(app): wrap state in useMemo to unblock memoization (#22)` — memoize `state` object on `active` (line 167). Unblocks the `useMemo` dependencies at lines 104-105 and 272-276 from being defeated by `state` identity churn on every render. Improves performance on the 500ms rest-timer tick (`setTick` at line 260). `npm test` unchanged.

## Tests

- **Unit tests:** `test/program.test.js` covers `getKeySlots()` and `getCardioDayNotes()` against the default bundle. Assertions:
  - `getKeySlots(prog)` returns exactly `["dc", "latraise", "squat", "pull", "ohp", "hipthrust"]` (7 items, in declaration order).
  - `getCardioDayNotes(prog)` returns exactly `[0, 4]` (days with cardio notes but no session).
  - A synthetic bundle with no `key: true` slots returns an empty array (no crash).
  - A synthetic bundle with zero `MOB_DAYS` passes to the mobility rendering (doesn't break).
- **Manual click-through:** Load the default program on any tab, verify pixel-identical UI and that Bilan line 5 shows the six key lifts in the new order (cosmetic change). Verify S12 AMRAP flag still shows on week 12. Verify week-number badges ("Semaine X sur 12") render correctly.

## Risks & tradeoffs

- **Risk: `definition.weeks` not present in imported programs.** Mitigation: `definition.weeks` is required by `DEFAULT_DEFINITION` ([src/definition.js:32-40](../../../src/definition.js#L32-L40)) and validated at import (`parseProgramImport`, [src/import.js:140-142](../../../src/import.js#L140-L142)); importing a program without `weeks: 12` is already rejected. So this is safe.
- **Risk: `SESSIONS` entries without `after` field break the rendering.** Mitigation: the field is optional; read it as `session.after && <hint>` so missing entries render no hint (correct for hautA, hautC, basB).
- **Bilan key-lift order changes from hardcoded to derived.** Consequence: `latraise` moves from 6th to 2nd. This is cosmetic and deliberately accepted (see spec's Decisions section); it's the whole point of deriving instead of hardcoding.
- **Performance**: `useMemo` on `state` removes a source of unnecessary renders/recomputes. No downside — `state` only changes when `active` changes (program switch or load).
- **PATCH-level storage impact**: no journal schema change, no data loss, fully backward-compatible with existing deployments.

## Out of scope / follow-ups

- Making key-lift selection configurable per program (#25+, when programs become user-definable).
- Relaxing `weeks !== 12` at import to accept variable-length programs (#9/#14, the engine's own phase/block logic).
- Splitting `Programme` into per-tab components (noted in the issue as deliberately out of scope).

## Open questions

None. The spec is resolved; all design choices are specified.
