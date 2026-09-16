# Design - Build a program in the app: manual editor over the closed registry (#36)

## Summary

The editor edits a `program` object directly — the draft *is* the thing that gets
stored, not a parallel model converted at the edges — so opening a program and
saving it untouched is deep-equal by construction, and a future engine's proposal
lands here with no adapter. Two new pure modules carry everything that can be
tested (`src/program-editor.js` for the draft mutations, the generated ids and the
started-cycle policy; `src/exercise-filter.js` for the picker's filtering), one new
component renders them (`src/ProgramEditor.jsx`, markup only, controlled by
`App.jsx` like `ExerciseSheet.jsx`), and the save calls `validateDefinition()` then
the existing `loadProgram()`. No new storage key, no new field. This first batch is
the editing surface alone (Simon, 2026-09-16: *"le plus simple possible, les règles
apparaîtront après"*): saving always writes a **new cycle**, so nothing it does can
rewrite a journal, and the in-place rule (Q2 = B) follows in its own batch.
Spec: [spec.md](spec.md) · decisions: [decisions-spec.md](decisions-spec.md).

## Files touched

| File | Change |
|---|---|
| `src/program-editor.js` | **New.** Draft model over `program`: `emptyProgram()`, `draftFrom(definition)`, the pure mutations (sessions, exercise rows, WARM/CORE blocks), id generation, slot pruning and forking, `referencedExercises()`, `setStartingLoad()`, `toDefinition(draft)`. No React, no storage, no DOM. The started-cycle policy (`startedSessionIds`, `lockedEdits`) joins it in the second batch. |
| `src/exercise-filter.js` | **New.** `filterExercises(query, facets)` over `EXERCISES`, plus the facet vocabularies re-exported from `registry.js`. Knows the `UNSELECTABLE_IDS` rule. |
| `src/ProgramEditor.jsx` | **New.** The screen: header, session list, exercise rows, block editor, starting-loads section, picker overlay, save bar. Receives `{ draft, onChange, onSave, onBack, error }`; performs no calculation of its own. |
| `src/App.jsx` | `editor` state + `openEditor` / `leaveEditor` / `saveDraft` next to `loadProgram` (:664); `loadProgram` gains an optional toast argument; two buttons in the "Programme" section (:945); a `screen === "editeur"` render branch beside the `exercice` one (:848); the tab bar highlights Plan while the editor is open (:1030). |
| `test/program-editor.test.js` | **New.** Round-trip, validity of every mutation, ids, forking, pruning, the policy. |
| `test/exercise-filter.test.js` | **New.** Facets, search, the four unselectable entries. |
| `docs/ARCHITECTURE.md` | §2.9 "Every door into the journal goes through one validator" becomes four doors: the editor is one, and calls the same `journal-shape.js`. |

`src/screen-state.js` is deliberately **not** touched — see the navigation
paragraph in Approach.

## Approach

**The draft is a `program`.** `draftFrom(definition)` returns
`{ id, name, startDate, program, seed }`, where `program` is a structural clone of
the definition's own object and `seed` the untouched copy that answers "is this
dirty?". `toDefinition(draft)` re-emits
`{ formatVersion: DEFINITION_FORMAT_VERSION, id, name, weeks: 12, startDate, startingLoads, profile?, program }`,
carrying `startingLoads`, `profile` and `program.volume` / `program.fallback` /
`program.cardio` through verbatim — editing them is out of scope, losing them would
not be. A blank program is `emptyProgram()`: one session, an empty `WARM.default`,
an empty `CORE.default`, `cardio: null` (Q3), `startingLoads: {}`, `startDate` = next
Monday. It passes `validateDefinition()` as it stands, which is the first test to
write.

```js
// src/program-editor.js — every mutation is (draft, …) -> a new draft
export function emptyProgram()                                   // -> program
export function draftFrom(definition)                            // -> draft
export function toDefinition(draft)                              // -> definition
export function addSession(draft), removeSession(draft, sid), moveSession(draft, sid, delta)
export function patchSession(draft, sid, patch)                  // name | sub | day | warm | core
export function addRow(draft, sid, exerciseId), removeRow(draft, sid, i), moveRow(draft, sid, i, delta)
export function patchRow(draft, sid, i, patch)                   // sets | reps | rest | key | fail | b1 | b2
export function patchBlock(draft, kind, key, patch)              // kind: "WARM" | "CORE"
```

**Ids are generated, never typed.** `sessionId(program, name)` slugs the name
(accents stripped) and suffixes `-2`, `-3`… until unique; the same helper mints slot
ids and the definition id of a new cycle. That closes the duplicate-id failure
(`src/journal-shape.js:168`) and the whole "changed session id" family by
construction — the field does not exist in the UI.

**Slot ids are invisible to storage**, and that is what makes direct editing safe: a
log row is `{ date, slot, ex }` where `slot` is the *session* id and `ex` is keyed by
*exercise* id (`writeLog`, `src/schema.js:92`; `history`,
`src/progression.js:153-163`). Nothing in the journal ever names a slot id. Two
consequences follow. `patchRow` **forks** a slot that more than one session or block
references before writing to it — a row edited in Upper A must not change Upper B —
and every mutation ends with a prune that drops slots nothing references any more,
which is the orphan the spec's edge case asks the editor not to be able to produce.

**Sessions keep a free order** (Simon, 2026-09-16: *"on laisse faire dans l'ordre que
l'on veut"*). `SESSIONS`'s order is what the Semaine list renders, and `day` stays an
independent field: a session may sit at day 2 and display after one at day 5, because
the person composing the program is the one who knows why. Arrows reorder, nothing
sorts behind their back. **Sunday (`day: 7`) is offered** like the other six; the
"aujourd'hui" badge (`src/App.jsx:874`) will not light up on it until #33's
convention clash is fixed, which is a bug that exists with or without this editor
(follow-up 5).

**Starting loads are typed in, or left blank** (Simon, 2026-09-16: *"si le user
connaît ses poids il les met, sinon calibrage"*). `startingLoads` is keyed by
*exercise* id, not by slot, so it gets a section of its own at the foot of the
editor rather than a field on each row — `referencedExercises(program)` lists the
ids that `b1`/`b2` actually name, deduplicated, in the order the sessions introduce
them. One field each; a blank field means no key in `startingLoads`, which is
calibration week 1 doing the work, exactly as the bundled program does since #26.
Exercises with no `incr` (`sideplank`, `abwheel` — `unit` `time` or `reps`) carry
no load and get no field; `perHand` entries say "par main" and `bw` entries say
"lest", reusing the wording `loadText()` already produces. A plain numeric field is
enough: the load wheel (#46) anchors on an existing value or on a planned one
(`anchorFor`, `src/load-picker.js:40`), and a program being composed has neither, so
it would not open anyway — it can be grafted on later without touching the format.

**The in-place rule (Q2 = B) is not in this batch.** Until it lands, both entry
points save under a new id, which is option A — and option A's cost is real (a new
cycle starts with empty logs, so every exercise restarts on the calibration ramp).
That is why the second entry point is worded "Partir du programme actif" and not
"Modifier": what this batch ships is a way to *compose*, and correcting a running
cycle in place is the batch that follows. Its design is written in
decisions-spec.md Q2 and summarised in step 8 below.

**Saving** builds the definition, calls `validateDefinition()` from
`src/journal-shape.js` — the same callee as both import doors (§2.9), not a rule of
its own — and on a verdict shows `bad.message || IMPORT_MESSAGES[bad.reason]` while
writing nothing. On `null` it calls `loadProgram(definition, "Programme
enregistré.")`, whose existing branch already does both halves: an id already
present keeps `logs` / `cardio` / `checkin` and refreshes the definition, a new id
creates `{ definition, logs: {}, cardio: {}, checkin: {} }`. No change to
`loadProgram` beyond the toast argument.

**Navigation.** `nav.screen === "editeur"`, and `"editeur"` is *not* added to
`SCREENS` in `src/screen-state.js`: `writeScreen` already refuses an unknown screen
(tested, `test/screen-state.test.js:30`), so a reload while editing restores the
last screen written — Plan, which is where the editor returns anyway. That is Q4's
"no draft survives" for free, with no module change. The draft itself lives in
`App.jsx` (`const [editor, setEditor] = useState(null)`), so the leave-guard is one
predicate — `editor.program` deep-differs from `editor.seed` — shared by the Back
button and by the two tab-bar buttons; the confirmation is the inline two-button
panel the import flow already uses (`pendingImport`, `src/App.jsx:989`), not
`window.confirm`.

**The picker.** `filterExercises(query, { muscle, pattern, equipment })` returns
registry entries sorted by name. When any facet is set, `UNSELECTABLE_IDS` are
excluded — they carry no selection metadata by design (#25, amendment 2026-09-10) —
while a plain text query searches `name` accent- and case-insensitively across all
63 entries, which is what keeps pallof, sideplank, abwheel and carry reachable.

**Two entry points, one editor** (Q1's answer, as two buttons): "Composer un
programme" opens `emptyProgram()`, "Partir du programme actif" opens
`draftFrom(definition)` with a fresh id. Cycles other than the active one are not
openable in this version — switching to one first is a tap in the same section.

## Sequencing

Steps 1 to 7 are this batch. Step 8 is the one that follows, and it is the only one
that can write into an existing cycle.

1. **`feat(editor): pure draft model over the program shape (#36)`** —
   `src/program-editor.js` (creation, mutations, ids, fork, prune, `toDefinition`)
   plus `test/program-editor.test.js`. No UI. *Safe to merge alone: nothing imports
   it yet.*
2. **`feat(editor): filter the closed registry for the exercise picker (#36)`** —
   `src/exercise-filter.js` plus `test/exercise-filter.test.js`. *Safe to merge
   alone.*
3. **`feat(plan): open a program editor screen from the Programme section (#36)`** —
   the two buttons, the `editeur` branch, the leave-guard, and `ProgramEditor.jsx`
   rendering the seeded draft read-only. The app works: the screen shows a program
   and goes back.
4. **`feat(editor): compose sessions, exercise rows and blocks (#36)`** — the
   interactive rows and the picker overlay, wired to steps 1 and 2. Still no save:
   the screen composes and discards.
5. **`feat(editor): type the starting loads, or leave them to calibration (#36)`** —
   `referencedExercises` / `setStartingLoad` and the section that renders them.
6. **`feat(editor): save a composed program as a new cycle (#36)`** — the save bar,
   `validateDefinition()`, the error line, `loadProgram()` with a new id **always**.
   *First shippable step, and it cannot touch an existing cycle.*
7. **`docs(architecture): the editor is a fourth door into the journal (#36)`** —
   §2.9, plus the note that slot ids are invisible to storage, which is what this
   whole design rests on.
8. **Next batch, its own issue —
   `feat(editor): edit the active cycle in place, minus the edits that re-read it`**:
   `startedSessionIds` / `lockedEdits` / `LOCK_REASONS` as pure functions over the
   active cycle's logs, the disabled fields they drive, in-place save, and the
   "Modifier dans un nouveau cycle" escape. Scanning `rec.slot` rather than
   recomputing `dateForSlot()` over twelve weeks is what makes it correct: it still
   finds the rows after a `day` has been changed, which is exactly when the answer
   matters.

## Tests

- **Unit, `node --test`** (`test/program-editor.test.js`): `emptyProgram()` passes
  `validateDefinition()`; `draftFrom` → `toDefinition` with no edit is deep-equal on
  `program`, `startingLoads` and `profile` (the acceptance criterion, asserted with
  `assert.deepStrictEqual` against `public/programs/upper-lower-4j.json`); every
  mutation applied to that program leaves `validateProgram()` at `null`; two
  sessions added with the same name get two ids; editing a row of a shared slot
  forks it and leaves the other session's row untouched; removing a row prunes the
  slot and never leaves a dangling reference.
- **Unit, starting loads** (same file): `referencedExercises` deduplicates an
  exercise named by both `b1` and `b2`, and skips none of the four unselectable
  ones when a slot names them; a typed load lands in `startingLoads` under the
  exercise id and survives `toDefinition`; a blank field leaves the key absent;
  `0` is a value, not a blank (pullup at bodyweight).
- **Unit** (`test/exercise-filter.test.js`): a facet never returns the four
  unselectable ids; a name search does; "developpe" matches "Développé couché".
- **Manual click-through** (`npm run dev`, phone on the LAN): compose a two-session
  program from blank — one session on Sunday — type a starting load on one exercise
  and leave the rest blank, save, reload the page, confirm the cycle is active, that
  the Semaine list shows both sessions in the order they were composed, and that the
  Séance tab proposes the typed load on week 1 while the others show the calibration
  ramp.

No React test runner is added: `ProgramEditor.jsx` emits markup only, which is what
keeps the testable half testable (§2.6).

## Risks & tradeoffs

- **Storage: MINOR, as the spec set it.** A composed definition is shaped exactly
  like an imported one; the editor adds no key, no field, no migration. A journal
  written by this version loads in the previous one — the extra cycle is just
  another entry.
- **This batch cannot corrupt anything, by construction:** every save mints a new
  id, so `loadProgram`'s in-place branch is never reached. The price is option A's,
  and it is paid only by someone using the editor to correct a running cycle — which
  is step 8's job, not this batch's.
- **A typed starting load is a promise about week 1.** `buildProgram` assigns it
  unconditionally (`V[vid].start = load`, `src/program.js:56`), so a wrong number is
  a wrong first session — recoverable by editing the row in Séance, and never a
  stored-data problem, since what gets stored is what was performed.
- **Forking a shared slot changes slot ids.** Invisible to storage (nothing keys on
  them), visible in an exported JSON diff. The alternative — editing a shared slot
  in place — makes one row silently change another session, which is worse than a
  cosmetic diff.
- **Rejected: a flat draft model** (sessions carrying inline exercises, converted to
  `SLOTS` on save). It reads better inside the component and breaks the deep-equal
  criterion the moment a program shares one slot between two sessions, because the
  conversion cannot know the two rows were one slot.
- **Rejected: saving always as a new cycle** (Q2 option A) — argued in
  decisions-spec.md: it restarts progression on every exercise in order to change
  one.
- **Performance:** the draft is rebuilt on each keystroke — a few dozen slots, inside
  the editor's subtree only, since `prog` and `plan` are memoised on `definition`,
  which the editor does not touch until save. If a text field ever feels slow on the
  phone, local state committed on blur is the escape, not a redesign.

## Out of scope / follow-ups

1. **Editing the active cycle in place** (Q2 = B, step 8 above): the whole point of
   the rule, deferred so that the editing surface can ship first. Its own issue, and
   the first follow-up to open.
2. **Seed `startingLoads` from the previous cycle**, so that duplicating a running
   program does not restart every exercise on the calibration ramp. The data is
   there (`history()` over the old cycle's logs); which value to take is a product
   question. Less urgent now that the loads can simply be typed.
3. **The assertions panel of #37** (Q5): live, collapsed, assertions 1 to 4, opened
   as its own issue once #37 has shipped.
4. **Editing `program.volume` / `program.fallback`** (spec follow-up 1) and
   **`profile`** (follow-up 2): both carried through untouched here.
5. **Exporting a composed program as a file** (spec follow-up 3) — `src/file-io.js`
   already has the machinery; the editor is what makes it worth wanting.
6. **The `day` contradiction** (#33, spec follow-up 4): `validateProgram` reads `day`
   as a 1–7 offset from `startDate`, `src/App.jsx:874` compares it to
   `today.getDay()` (0 = Sunday). This editor is the first screen that asks for a
   weekday, so it is where the contradiction becomes visible, and Sunday is offered
   anyway.
7. **Drag-and-drop reordering** is not attempted: arrows only, which also keeps the
   component free of gesture state.

## Open questions

None. The three raised by this design were answered by Simon on 2026-09-16, against
the recommendation in two of the three cases:

1. **Session order** — free, kept as reorder arrows, with `day` independent of it.
   (Recommended: sorting by `day`. Overruled: the person composing the program is
   the one who knows why a session sits where it sits.)
2. **Starting loads** — typed in when known, blank for calibration, in a section of
   their own. (Recommended: no starting-loads UI at all and a follow-up for seeding
   them from the previous cycle. Overruled: typing them is simpler than deriving
   them, and it removes the need for the follow-up in the common case.)
3. **Sunday** — allowed, `day: 7` like any other. (As recommended.)
