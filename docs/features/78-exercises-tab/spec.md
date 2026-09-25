# Spec - Exercises tab: browse the registry and open any exercise sheet (#78)

## Context

The registry is a closed set (`src/registry.js`, **76 entries** today — the issue
and the review still say 73). Every entry has a full sheet with chart, records,
history and technique (`src/ExerciseSheet.jsx`), but the only door to it is the
slot card of the session currently open (`onOpen={openExercise}`,
[App.jsx:1256](src/App.jsx#L1256)). An exercise the active program does not use
is unreachable, and so is any sheet at all outside a training session. Two
header comments already promise this screen — [screen-state.js:80](src/screen-state.js#L80)
and [ExerciseSheet.jsx:13](src/ExerciseSheet.jsx#L13) — and the pieces they
promise it with exist: `resolveScreen()` already accepts a sheet with no
session, `ExercisePicker` already carries the #64 facets. Issue: #78.

**Blocker, unresolved.** #78 depends on #75 (how many tabs the bottom bar
carries). #75 is still open and its decision brief was *abandoned* on 2026-09-25,
so nothing has been settled. #78 keeps `priority: later` until it is. This spec
describes the screen; Open question 1 is the gate.

## Scope

- **In:** a third screen that lists the whole registry with the #64 facets and
  a name search, opens `ExerciseSheet` on a tap, and returns to the list with
  the filters intact. One new entry in the bottom bar. One new `screen` value in
  `screen-state.js` so a reload reopens it.
- **Out:** anything the sheet itself shows (that is #67 / #49 / #63). Editing a
  program from this screen — it is read-only, it never substitutes and never
  writes. Any change to the `exercise-filter.js` rules. The *shape* of the bottom
  bar if #75 decides against a third tab (that becomes a follow-up).

## User-facing behaviour

**New tab — Exercices.** A screen listing the registry, sorted by name, French
collation (`filterExercises` already does this). Each row: the exercise name,
then the same second line the picker shows — movement · equipment, or
"Gainage et portés" for the four entries with no selection fields (#25). Above
the list, the picker's own controls: a "Chercher un exercice" field with no
`autoFocus`, then the three selects **Muscle / Mouvement / Matériel**, each
offering only values viable with the others (#64). Nothing pre-selected on first
open. No close cross: the bottom bar is the way out, as on Semaine and Plan.

**Tapping a row** opens the exercise sheet, unchanged, with a back control
reading **‹ Exercices**. Every row is tappable — the picker's inert-entry state
(`disabledIds`, "déjà dans cette séance") has no meaning here.

**Empty / partial / complete.** The list is never empty of content: filters that
match nothing keep the existing sentence ("Aucun exercice ne correspond. Le
registre est fermé…"), and #64 already makes that state hard to reach by facets
alone. A sheet for an exercise never trained shows the existing "Jamais fait."
state ([ExerciseSheet.jsx:341](src/ExerciseSheet.jsx#L341)) — expected here, not
an error: most of the 76 entries have no history.

**Séance, Semaine, Bilan, Plan:** unchanged. The sheet opened from a slot card
still reads ‹ Séance <name>; only the new door reads ‹ Exercices.

## Acceptance criteria

- [ ] Given the Exercices tab, When it opens, Then the full registry is listed,
      no keyboard is up, and no facet is pre-selected.
- [ ] Given the list, When the four entries without selection fields (pallof,
      sideplank, abwheel, carry) are searched by name, Then they appear and open
      their sheet. (Open question 4 covers reaching them without typing.)
- [ ] Given a facet combination, When it is set, Then the list narrows and the
      other selects drop the values that would empty it (#64 behaviour, reused
      as-is).
- [ ] Given a sheet opened from the list, When the back control is used, Then
      the list reappears **with its search text and facets as they were**.
- [ ] Given a sheet opened from a session slot, When back is used, Then it still
      returns to Séance — this issue adds a door, it does not move the old one.
- [ ] Given the Exercices list, When the page is reloaded, Then the Exercices
      list reopens (not Semaine).
- [ ] Given the Exercices tab is open, When the bottom bar is read, Then its
      Exercices entry is the highlighted one, and stays highlighted while a
      sheet opened from it is showing.
- [ ] `npm test` green, with the new screen value pinned in
      `test/screen-state.test.js`.

## Data & storage impact

The localStorage journal (`prog12_simon_v1`) does **not** change: no field added,
renamed or removed, nothing written by this screen. The only persisted change is
the *navigation* key `prog12_screen` in **sessionStorage**
([screen-state.js:24](src/screen-state.js#L24)), which gains one accepted value
in `SCREENS`. That key is disposable by design — `readScreen` returns `null` on
anything it does not recognise, and an unknown value falls back to Semaine.

**Level: MINOR.** A journal saved by the previous version loads with no loss; a
new screen is the versioning table's own example of a compatible addition.

## Edge cases

- **No program, no journal yet (onboarding).** The tab can list the registry
  anyway — it depends on nothing but `registry.js`. Whether it is *reachable*
  before a program exists is Open question 3.
- **Sheet reloaded while opened from the list.** `resolveScreen` keeps
  `exerciseId` and drops an unknown `sessionId`, and today `closeExercise` sends
  a session-less sheet to Semaine ([App.jsx:284](src/App.jsx#L284)). After a
  reload, back must land on Exercices instead — the origin has to survive, or the
  back criterion is broken by a single reload.
- **Sheet for an exercise from an inactive cycle, or absent from the active
  program.** Already handled: the sheet reads the whole journal and takes no
  `prog`.
- **Week 7 deload, session in progress.** Untouched: this screen reads no week
  and no session. Opening it must not lose a session in progress — `nav` already
  drops `sessionId` when leaving, which is the existing Plan behaviour, and the
  session is reopened from Semaine.
- **Storage unavailable (private browsing).** `writeScreen` returns `false` and
  the app keeps working; the tab simply does not survive a reload.
- **Program editor open.** Leaving to the new tab must pass the same guard as
  Semaine and Plan (`guarded(...)`, [App.jsx:995](src/App.jsx#L995)) — an
  unsaved draft is not lost to a tab tap.

## Out of scope / follow-ups

- **The count is wrong in three places.** `registry.js` holds 76 entries; the
  issue, review P5 and the `exercise-filter.js` header ("les 63 entrées") all say
  otherwise. A `chore` issue: either make the headers stop counting, or count
  correctly.
- **`ExercisePicker` is a modal overlay** (`fixed inset-0 z-20`) with a close
  cross and an `onChoose` contract. Reusing it as a tab screen means it stops
  being a modal for one caller. If that distorts it, extracting the list body
  from the overlay is a separate `refactor` issue, not this one.
- **Facet-less entries and #25.** The four anti-movement entries staying out of
  the facets is a #25 taxonomy question, unchanged here.

## Open questions

1. **#75 first.** How many entries does the bottom bar carry, and is Exercices
   one of them? #41 reduced the bar to two on purpose, #75's brief was abandoned,
   and this screen cannot be placed until that is answered. If the answer is "not
   a tab", where does the door live (a Plan index row? a control on Semaine?) —
   that rewrites the whole "User-facing behaviour" section.
2. **Do the filters survive a reload, or only a back from the sheet?** Criterion
   4 only needs them across the sheet round-trip. Recommendation: back-only, held
   in component state — a reload resetting an index's filters is what an index is
   expected to do, and `planTopic` is already handled exactly that way
   ([App.jsx:269](src/App.jsx#L269)).
3. **Is the tab reachable before a program exists?** `Welcome` takes the whole
   screen and hides the bar until a program is created
   ([App.jsx:1091](src/App.jsx#L1091)). Browsing the registry before choosing a
   program is arguably when it is most useful.
4. **Do the four facet-less entries need a facet door?** Today only name search
   reaches them. In a picker that is defensible; in a *browse* screen, an entry
   no combination of facets can surface reads as missing. Options: leave as-is,
   or give the Mouvement select a "Gainage et portés" value.
