# Design - Support programs with a different session count, or without cardio/mobility (#13)

## Summary
Add three tiny pure predicates to `src/program.js` (`hasCardioItems`, `hasMobilityDays`, `hasCardioContent`) that read the bundle's shape, and a null-safety fix to the existing `getCardioDayNotes`. Use those predicates at every point in `src/App.jsx` that currently reads `prog.CARDIO_ITEMS` / `prog.MOB_DAYS` / `prog.cardioPlan` / `prog.CARDIO_DAY_NOTES` unconditionally, to hide the affordance and skip the crash instead. `CardioView` itself is split so its two sub-sections (checklist, mobility) render independently. No change to `buildProgram()`, `import.js`, or the journal shape — see `spec.md`.

## Files touched
- **`src/program.js`** — add `hasCardioItems(prog)`, `hasMobilityDays(prog)`, `hasCardioContent(prog)` next to `getKeySlots`/`getCardioDayNotes` (~L67-83); guard `getCardioDayNotes` (L78-83) against `prog.CARDIO_DAY_NOTES` being absent.
- **`src/App.jsx`**:
  - L294 — `sessionId` fallback when every session for the week is done.
  - L436 — `todayLine`'s `prog.CARDIO_DAY_NOTES[weekday]` read.
  - L440 — `const cardio = prog.cardioPlan(week)`.
  - L482 — the "Cardio et mobilité" pill (Séance tab).
  - L502-506 — the post-session `AFTER_HINTS` hint.
  - L517 — the `session ? … : <CardioView>` fallback branch.
  - L543 — the compact `CardioView` block (Semaine tab).
  - L354-380 (`bilanText`) — line 4 construction and list numbering.
  - L665-704 (`CardioView`) — split the cardio checklist and the mobility block so each renders independently.
  - L292 — no code change; already fixed transitively once `getCardioDayNotes` stops throwing.
- **`test/program.test.js`** — new `describe` blocks for the three predicates, plus one more `getCardioDayNotes` case: `CARDIO_DAY_NOTES` entirely absent (today's suite only covers `{}`, not `undefined`).

## Approach

**New predicates (`src/program.js`)**, pure property reads, same style as `getKeySlots`:
```js
export function hasCardioItems(prog) {
  return !!(prog.CARDIO_ITEMS && prog.CARDIO_ITEMS.length);
}
export function hasMobilityDays(prog) {
  return !!(prog.MOB_DAYS && prog.MOB_DAYS.length);
}
export function hasCardioContent(prog) {
  return hasCardioItems(prog) || hasMobilityDays(prog);
}
```
`getCardioDayNotes` changes one line: `Object.keys(prog.CARDIO_DAY_NOTES)` → `Object.keys(prog.CARDIO_DAY_NOTES || {})`.

**`App.jsx` call sites** — import the three predicates alongside the existing `getKeySlots`/`getCardioDayNotes` import (L6). Each site becomes a guard, not a rewrite of its surrounding logic:
- L294: `setSessionId(next ? next.id : hasCardioContent(prog) ? "cardio" : prog.SESSIONS[0].id)`.
- L436: `const extra = (prog.CARDIO_DAY_NOTES && prog.CARDIO_DAY_NOTES[weekday]) || "";`
- L440: `const cardio = prog.cardioPlan ? prog.cardioPlan(week) : null;`
- L482: wrap the `<button>` in `{hasCardioContent(prog) && (...)}`.
- L502-506: `{session.after && cardio && (...)}` — `cardio` is `null` when the bundle has none, so a session that still declares `after` (an authoring inconsistency the spec's Edge cases accepts) degrades to "no hint shown" instead of crashing.
- L517: `session ? (...) : hasCardioContent(prog) ? <CardioView .../> : null` — a defensive backstop; with L294 fixed, `sessionId` should never reach `"cardio"` without content, but this keeps the render itself safe on its own.
- L543: wrap the `<div className="mt-4"><CardioView .../></div>` in `{hasCardioContent(prog) && (...)}`.

**`bilanText()` line 4** — currently one hardcoded template literal. Rebuild it from independent parts, then drop it from the list if both are empty, and renumber the remaining lines instead of leaving a numbering gap:
```js
const cardioPart = hasCardioItems(prog) ? `Cardio : ${cardioLines.length ? cardioLines.join(" ; ") : "aucun"}` : null;
const mobPart = hasMobilityDays(prog) ? `mobilité ${mob}/${prog.MOB_DAYS.length}` : null;
const cardioLine = [cardioPart, mobPart].filter(Boolean).join(" — ") || null;
```
`cardioLines` itself (L359) becomes `(prog.CARDIO_ITEMS || []).filter(...)` — dead code once `cardioPart` is guarded by `hasCardioItems`, but kept safe in case `CARDIO_ITEMS` is ever `[]` rather than absent. The final `[...]` array in `bilanText` becomes a list of nullable strings (no leading "N.") filtered with `.filter(Boolean)`, then numbered by `.map((l, i) => \`${i + 1}. ${l}\`)`. This changes the numbering of a bilan copied from a bundle without cardio (jumps straight from 3 to what was "5") — see Risks.

**`CardioView`** — the component currently renders `prog.CARDIO_ITEMS.map(...)` unconditionally followed by an unconditional mobility block. Split it:
```jsx
{hasCardioItems(prog) && prog.CARDIO_ITEMS.map((it) => (...))}
...
{hasMobilityDays(prog) && (
  <div className="py-3">
    <div className="font-medium">Mobilité, 3 fois par semaine</div>
    ...
  </div>
)}
```
Callers already guarantee `hasCardioContent(prog)` before mounting `CardioView` at all, so this split only matters for the "one without the other" case — it makes each half independently absent rather than assuming they travel together.

## Sequencing
Each step keeps the default (Simon's) program pixel-identical, and is a separate `feat` commit under #13 per `CONTRIBUTING.md`'s one-concern-per-commit rule. Steps 2-3 alone are not enough to make a `cardio: null` program crash-free end to end (Semaine/Bilan still touch the old code until steps 3-4 land) — only step 4 completes that; every step is still independently mergeable without regressing the default program.

1. `feat(program): derive cardio/mobility presence and guard the day-notes helper (#13)` — add `hasCardioItems`/`hasMobilityDays`/`hasCardioContent`, fix `getCardioDayNotes`'s null case, add the corresponding tests in `test/program.test.js`. Safe alone: pure additions plus a one-line guard on an existing helper, no caller changes yet.
2. `feat(app): hide the cardio affordance on Séance when the bundle has none (#13)` — L294, L436, L440, L482, L502-506, L517. Manual check: default program unchanged; a program loaded with `program.cardio: null` (via "Charger un programme", Plan tab) shows no pill and does not crash on Séance.
3. `feat(app): hide the cardio block on Semaine when the bundle has none (#13)` — L543. Manual check: same cardio-less program, Semaine tab.
4. `feat(app): omit the cardio/mobility line from the bilan when absent (#13)` — `bilanText()` rewrite. Manual check: same program, Bilan tab; compare byte-for-byte against today's output for the default program.
5. `feat(app): render the cardio checklist and mobility block independently (#13)` — `CardioView` split. Manual check: craft a bundle with items in only one of `CARDIO_ITEMS`/`MOB_DAYS` (a local test tweak, not shipped) and confirm only the relevant sub-section renders.

## Tests
- **Unit (`node --test`, `test/program.test.js`):** `hasCardioItems`/`hasMobilityDays`/`hasCardioContent` against the default bundle (both true) and against `{}` / `{ CARDIO_ITEMS: [] }` / `{ MOB_DAYS: [] }` shapes (false, false, mixed). `getCardioDayNotes({ SESSIONS: prog.SESSIONS })` (no `CARDIO_DAY_NOTES` key at all) returns `[]` without throwing.
- **Manual click-through (`npm run dev`, per the project's local-testing convention):** the default program end to end (Séance pill, Semaine block, Bilan line 4 — byte-identical to today) is the regression guard for every step. For the "no cardio" path, there is no ready-made fixture program: build a minimal JSON definition (`id`, `startDate`, `profile`, `weeks: 12`, `program.cardio: null`, otherwise copying `DEFAULT_DEFINITION.program`'s `SLOTS`/`SESSIONS`/`CORE`/`WARM`) and load it through the Plan tab's "Charger un programme" button (already wired by #6) to exercise steps 2-5 for real, on a phone if possible.
- `App.jsx` itself has no test harness (no React test runner in this repo — `bilanText`, `CardioView` etc. are only reachable through a browser render); this is tracked separately by #23 ("Move pure display and summary logic out of App.jsx into testable modules"), not reopened here.

## Risks & tradeoffs
- **Bilan renumbering:** dropping line 4 shifts every following line number when a program has no cardio (what was "5. Exos clés" becomes "4."). Considered leaving a gap (skip straight from 3 to 5) to minimize the diff, but a skipped number reads as a bug in a bilan Simon copies into chat weekly; renumbering is the "cleanly" the spec's acceptance criteria ask for. Only ever visible for a non-default program, so no impact on Simon's own weekly bilan.
- **`session.after` pointing at a disabled cardio bundle:** accepted as an authoring inconsistency of that custom program (spec's Edge cases) — the hint silently disappears rather than crashing. Not validated at import (`import.js`) because `import.js` doesn't know which `after` values a custom `SESSIONS` array uses versus which cardio rule it picked; adding that cross-check is a follow-up, not blocking here.
- **Storage/versioning:** unchanged from the spec — MINOR, no journal field added or renamed, `state.cardio` keeps being written exactly as today when a cardio bundle exists.
- **Alternative considered:** computing `hasCardioContent` once in the component body and passing it down as a prop to `CardioView`, instead of `CardioView` re-deriving `hasCardioItems`/`hasMobilityDays` itself. Rejected: `CardioView` already receives `prog` as a prop, and re-deriving from it keeps the component self-contained (it can be reasoned about, or unit-extracted by #23 later, without threading two more booleans through every call site).

## Out of scope / follow-ups
- A named cardio rule that lets a custom program mix cardio-only or mobility-only content at the data layer (spec's Out of scope) — not needed until a real program requires it.
- Cross-validating `SESSIONS[].after` against the chosen `program.cardio` rule at import time (see Risks) — would belong to #20's territory (import hardening) if it's ever worth doing.
- Extracting `bilanText`/`CardioView`'s pure logic into a testable module — already #23.

## Open questions
None.
