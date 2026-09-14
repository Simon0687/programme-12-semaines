# Design - Exercise sheet: one screen per exercise, all cycles (#17)

## Summary

Two new leaf modules and one new React file. `src/exercise-history.js` holds the
single traversal of `journal.programs` that answers "everything ever done on this
exercise"; `src/display.js` holds the French labels and the formatters the sheet
needs, starting with `setSummary()` moved out of `App.jsx`. The idea that makes
it work: **the sheet reads `EXERCISES[id]` and the whole journal, never `prog`** —
so it needs no active program, no slot and no week, which is exactly what makes a
future "Exercices" tab free. `progression.js` is not touched, so no suggested load
can change.

Spec: [spec.md](spec.md).

## Files touched

| File | Change |
|---|---|
| `src/exercise-history.js` | **New.** `exerciseHistory`, `recordsFor`, `seriesByCycle`. Imports `num` from `progression.js`, nothing else. |
| `src/display.js` | **New.** `setSummary` (moved), the label tables, `muscleRows`, `detailRows`, `chartGeometry`, `dateShort`. Imports `fmt` from `progression.js`. |
| `src/ExerciseSheet.jsx` | **New.** The screen. Props `{ journal, exerciseId, backLabel, onBack }`. |
| `src/screen-state.js` | `SCREENS` gains `"exercice"`; `readScreen` / `writeScreen` carry `exerciseId`; `resolveScreen(saved, sessionIds, exerciseIds)`. |
| `src/App.jsx` | `setSummary` deleted (`:66-74`), imported from `display.js` — three call sites (`:174`, `:507`, `:786`). `nav` gains `exerciseId`, plus open and back handlers. `ExerciseCard` (`:156-164`) turns the name into a button. New `screen === "exercice"` branch. |
| `test/exercise-history.test.js` | **New.** |
| `test/display.test.js` | **New.** |
| `test/screen-state.test.js` | Cases for the third screen. |
| `docs/ARCHITECTURE.md` | §1 dependency table gains two modules; §2.6 wording (see Risks). |

## Approach

### `src/exercise-history.js`

```js
// ascending by date, then by the slot's index in that cycle's own SESSIONS
exerciseHistory(journal, exerciseId) -> [{
  date, slot, programId,
  programName,   // entry.definition.name, or null
  sessionName,   // that cycle's SESSIONS[].name for this slot, or null
  kind,          // "normal" | "calibration" | "deload"
  sets: [{ w, r, rir }],
}]
```

Walks `Object.entries(journal.programs)`, then that entry's `logs`. A row counts
only when `rec.done` is true — which is what excludes the session in progress,
with no new rule (spec, Edge cases).

**Closed by default on the payload.** `isLogRow` (`journal-shape.js:232`) checks
`date`, `slot` and that `ex` is an object; it never looks inside. A row where
`ex.dc` is the string `"87,5"` passes the filter and makes today's `history()`
throw `TypeError: … .map is not a function` (verified 2026-09-14). So:

```js
const raw  = rec.ex && Array.isArray(rec.ex[exerciseId]) ? rec.ex[exerciseId] : [];
const sets = raw.filter(isObj)
  .map((x) => ({ w: num(x.w), r: num(x.r), rir: num(x.rir) }))
  .filter((x) => x.r != null);
```

`sessionName` and `programName` resolve defensively — an unusable definition is
exactly the case where `definition.program.SESSIONS` may be missing. `null` means
"render the date alone".

Two derivations live beside it, so the three sections of the sheet become three
reductions over one traversal:

```js
recordsFor(entries, unit)
// with a load  -> { mode: "byReps", rows: [{ reps, load, date }] }, descending by reps
//                 rows[i].load = max w among sets with r >= reps; date = earliest reaching it
// time | reps  -> { mode: "best", best, date }

chartMode(unit)
// kg           -> { kind: "estimate", line: "kg" }
// bw | carry   -> { kind: "dual", line: "reps" | "time", bar: "kg" }
// time | reps  -> { kind: "raw", line: "time" | "reps" }

estimate10RM(w, r)  // Epley normalised to ten reps: w × (30 + r) / 40, to 0.1 kg
                    // identity at r = 10, which is why it beats Brzycki here
ESTIMATE_REPS = { min: 3, max: 12 }  // outside it the point is dimmed, never dropped

chartPoint(entry, unit)
// estimate -> { value, reps, load, dim }  best set = the best-ESTIMATING one,
//                                         not the heaviest (that was the bug)
// dual     -> { value, bar }              best set = the heaviest, reps as tiebreak
// raw      -> { value }

seriesByCycle(entries, unit)
// -> [{ programId, programName, points: [{ date, kind, ...chartPoint }] }]
// One entry per cycle is one polyline, which is what keeps the line from
// crossing the gap between cycles.
```

Amended 2026-09-14 (spec Decision 4). The first version plotted `max(w)` and
never looked at reps, so a session that collapsed from 8 reps to 2 at the same
load read as a plateau. `bestValue()` is gone, replaced by `chartPoint()`.

### `src/display.js`

`setSummary(sets, v)` moved verbatim from `App.jsx:66-74` — no behaviour change,
pinned by tests first (CONTRIBUTING). **Amended 2026-09-14** (spec Decision 5):
the compact form is kept only while the load is constant across the sets, where
it is exact; otherwise each set carries its own load. That is the point at which
the pinned tests earned their keep — they are what made the format change
visible in all four call sites at once. Beside it, the label tables the registry
deliberately does not carry (`registry.js` stays a leaf of keys, spec Decision 1):

```js
MUSCLE_LABELS = { pectoraux: "Pectoraux", deltoide_ant: "Deltoïde antérieur", … } // 11 keys
EQUIPMENT_LABELS, JOINT_LABELS, TYPE_LABELS

muscleRows(ex)  -> [{ label, pct, dominant }], sorted desc; dominant = the max
detailRows(ex)  -> { muscles, equipement, articulations, type } | null
                   null for UNSELECTABLE_IDS — a missing section, not an empty one
chartGeometry(series, { w, h, padL, padB })
                -> { plot, polylines, dots, bars, grid, xLabels, barTop }
                   dots[i].dim  = estimate outside ESTIMATE_REPS, drawn grey
                   bars         = load, only in "dual" and only where load > 0
                   barTop       = { y, value } | null, the single right-hand label
```

Bars occupy the bottom `BAR_ZONE` (55 %) of the frame rather than its full
height: at full height they would run behind the polyline, and reading the two
progressions *together* is the entire point of the dual regime. `barTop` keeps
the scale honest. A history with no added load produces no bars, no right-hand
padding and no legend entry — the chart degrades cleanly to a single plot.

`chartGeometry` is pure arithmetic over `{ date, value }`, so the chart is
unit-tested without a DOM and `ExerciseSheet.jsx` only emits `<svg>` from its
output. No chart library: the app has three dependencies and this is ~40 lines.

### Navigation

`nav` becomes `{ screen, sessionId, exerciseId }`. `sessionId` is **kept** while
the sheet is open — it is the return address, and `backLabel` is built from it.
Opened from somewhere with no session, `sessionId` is `null` and back goes to
Semaine; that is the whole of what a future "Exercices" tab needs.

`resolveScreen` gains a third argument and applies to `exerciseId` the rule it
already applies to `sessionId`: a stored id absent from the list presented falls
back to `HOME`. `App.jsx` passes `EXERCISE_IDS`.

## Sequencing

1. **`test(display): pin setSummary output before moving it (#17)`** — tests
   against the current `App.jsx` behaviour for all five units. Safe to merge alone.
2. **`refactor(display): extract setSummary and the label tables (#17)`** — create
   `src/display.js`, move the function, update three call sites. No behaviour
   change; step 1's tests must still pass. Safe to merge alone.
3. **`feat(history): read one exercise across every cycle (#17)`** — create
   `src/exercise-history.js` with its tests. Wired to no screen yet. Safe to merge
   alone.
4. **`feat(nav): the exercise sheet is a screen (#17)`** — `screen-state.js` gains
   the screen and the id; `App.jsx` gains the nav shape and the tap target;
   `ExerciseSheet.jsx` renders header, back, empty state and Technique only. The
   app is usable at this point.
5. **`feat(fiche): chart, records and session history (#17)`** — `chartGeometry`,
   `recordsFor` and `seriesByCycle` wired into the sheet.
6. **`feat(fiche): muscle split, equipment and joints from the registry (#17)`** —
   the Détails block.
7. **`docs: the exercise sheet and its two new modules (#17)`** — `ARCHITECTURE.md`
   §1 and §2.6.

Steps 1-3 touch no screen and can land ahead of the rest.

## Tests

`node --test`, no DOM, matching the existing suite.

- **`test/display.test.js`** — `setSummary` for `kg`, `bw` (zero and loaded),
  `time`, `reps`, `carry`, and for `perHand`; `detailRows` returns `null` for each
  of the four `UNSELECTABLE_IDS` and a full object for `dc`; `muscleRows` sums to
  100 % and marks exactly one dominant; `chartGeometry` on a two-cycle series
  produces two polylines and places the higher value higher on the canvas.
- **`test/exercise-history.test.js`** — a fixture journal with two cycles: entries
  come back from both, ordered, each carrying its own cycle's session name; a
  `done: false` row contributes nothing; **a row whose `ex[id]` is a string, a
  number or an array of junk yields no sets and does not throw**; `recordsFor` is
  monotone decreasing and dates the earliest occurrence; `recordsFor` returns
  `mode: "best"` for a `time` unit; an entry whose definition has no `SESSIONS`
  yields `sessionName: null` rather than throwing.
- **`test/screen-state.test.js`** — `"exercice"` survives a round trip with its
  `exerciseId`; an unknown `exerciseId` resolves to `HOME`; an old stored value
  carrying no `exerciseId` still resolves.
- **Manual** — the seven acceptance criteria at phone width, against the design
  canvas.

## Risks & tradeoffs

- **`progression.js` is not touched.** That is the design's main safety property:
  no suggested load can move. `history()` stays deliberately narrower than the new
  reader (active program only, because `planned()` must not compare prescriptions
  across rep ranges). Collapsing the two is a follow-up, not a cleanup.
- **`resolveScreen` changes signature.** Its call site (`App.jsx:249`) and
  `test/screen-state.test.js` must move together; a forgotten third argument would
  silently reject every stored exercise id. Covered by step 4's tests.
- **ARCHITECTURE §2.6 reads "Only `App.jsx` and `main.jsx`" import React.**
  `ExerciseSheet.jsx` makes that three. The invariant that matters — *domain
  modules never import React* — is unchanged, and the alternative is a 1 200-line
  `App.jsx`. Per §4 the wording change belongs to this issue; step 7.
- **Full traversal on every render.** ~260 sessions a year on one device, so the
  cost is irrelevant, but `useMemo` on `[journal, exerciseId]` is required anyway:
  `App.jsx:217-221` already records that a fresh object per render defeats every
  downstream memo.
- **Storage: MINOR, as the spec sets.** No journal field added, renamed or re-read.
  Only `prog12_screen` changes shape, and `readScreen` already returns `null` for
  anything unparseable.

## Out of scope / follow-ups

- **`isLogRow` never validates the `ex` payload** (open question 1). However that
  is settled, the underlying gap — a frontier admitting a row the engine then
  throws on — is broader than this issue and belongs in #38 ("Full pass on
  validation").
- **Collapsing `history()` onto `exerciseHistory()`**, once the engine's output is
  pinned by tests. Belongs with #23.
- **`normalizeSets` / `historyBefore` / the `UNITS` traits table** — the rest of
  #23, untouched here.

## Open questions

1. **Does the payload guard also go into `isLogRow`, or only into
   `exerciseHistory()`?** Guarding the new reader alone is strictly additive and
   cannot change what loads today. Tightening `isLogRow` also fixes the live throw
   on the active program, but it changes a frontier's verdict: more rows get
   dropped at load, the "N séances illisibles écartées" toast starts firing on
   journals that open cleanly today, and `journal-shape.js` joins this issue.
   **Recommendation: guard the new reader here, and file the `isLogRow` tightening
   against #38** — a validation change should never be a side effect of shipping a
   screen.
2. **`src/ExerciseSheet.jsx` as a second React file, or the sheet inside
   `App.jsx`?** The design assumes the separate file. Worth confirming, because it
   is the one choice that edits a stated invariant rather than extending one.
