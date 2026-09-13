# Design - Semaine becomes the entry point: Séance is a screen, not a tab (#41)

## Summary

One structural move carries the issue: **the shared sticky header splits in
two**. Today `App.jsx:577-592` renders the week arrows and the rest timer above
every tab, which is why Séance can be entered without choosing and therefore has
to carry its own choosers. After the split, the week nav belongs to Semaine and
Séance gets a header that only says which session is open. Everything else —
the deleted auto-selection effect, the two-entry bar, the Bilan moving into
Semaine — follows from that.

Two extractions make the change testable rather than merely smaller: a pure
`src/bilan.js` (the weekly review text is currently a closure inside `App.jsx`
and cannot be asserted on) and `src/screen-state.js` for the remembered screen.

Spec: [spec.md](spec.md). Decisions: [decisions-spec.md](decisions-spec.md).

## Files touched

| File | Change |
|---|---|
| `src/screen-state.js` | **New.** `readScreen`, `writeScreen`, `resolveScreen`. Synchronous, storage injected. Imports nothing. |
| `src/bilan.js` | **New.** The weekly review text as a pure function. Extracted from `App.jsx:420-468`, then extended with the session-notes line. |
| `test/screen-state.test.js`, `test/bilan.test.js` | **New.** |
| `src/App.jsx` | The sticky header (`577-592`) splits. `tab` becomes `screen`. The auto-selection effect (`309-317`) is **deleted**. Chips rail (`618-628`) removed. Semaine tab (`669-696`) becomes the hub: today marker, validated count, cardio section, Bilan section. Bilan tab (`697-716`) removed. `<nav>` (`798-810`) drops to two entries and loses the `weekDoneCount` badge. `copy()` and its last caller removed. `log` (`340`) loses its cardio guard. |

`src/schema.js`, `src/storage.js`, `src/journal-shape.js`, `src/progression.js`
and `src/program.js` are **not** touched. No journal field is added, renamed or
read differently.

## Approach

**The header split.** Today one sticky block serves every tab. It becomes two,
each rendered inside its own screen:

```
Semaine : [‹] Semaine N sur 12 / <plage> — <phase>, RIR <n> [›]
Séance  : <nom de séance>
          Semaine N · <jour> <date> · <sous-titre>
```

The rest timer moves into the Séance header (Decision 1), which is where the
mockup put it.

**`src/screen-state.js`** — synchronous, storage injected (`sessionStorage` in
`App.jsx`), so both branches are testable with a plain object:

```js
export const SCREEN_KEY = "prog12_screen";
export function readScreen(storage)                 // -> { screen, sessionId } | null
export function writeScreen(storage, state)         // -> boolean
export function resolveScreen(saved, sessionIds)    // -> { screen, sessionId }
```

`resolveScreen` is the load-bearing one: a remembered `sessionId` may belong to
a cycle that is no longer active (switching programs is one tap in Plan), so it
is validated against the current `prog.SESSIONS` and falls back to
`{ screen: "semaine", sessionId: null }`. That is also what replaces the
deleted effect's job of never leaving `sessionId` pointing at nothing.

**`src/bilan.js`** — pure, so the spec's criteria can be tests instead of
click-throughs:

```js
export function buildBilan({ week, range, phaseLabel, sessions, checkin,
                             cardio, keyLines, notes })  // -> string
```

It receives already-derived values; it does not reach into `prog` or `state`.
The session-notes line is computed here from `notes` and appended only when at
least one session has one — `bilanText()` already filters empty lines with
`.filter(Boolean)` (`App.jsx:462`), same rule.

**Deletions, and why each is safe.** The auto-selection effect
(`App.jsx:309-317`) exists only because Séance can be reached without choosing;
once it cannot, its three fallbacks have no case left. `sessionId` then never
holds `"cardio"`, so `session` is never `undefined` (`App.jsx:338`), `si` never
`-1` (`339`), and the `session ? … : {}` guard at `340` goes with them.
`weekDoneCount` (`307`) survives — it moves from the nav badge to the "N sur 4
validées" line on the Semaine hub.

## Sequencing

1. `feat(nav): remember the open screen across a reload (#41)` —
   `src/screen-state.js` + tests. Nothing imports it yet. **Safe to merge alone.**
2. `refactor(bilan): extract the weekly review text into a pure module (#41)` —
   `src/bilan.js`, byte-identical output, tests lock the current text. Pure
   refactor, its own commit per CONTRIBUTING. **Safe to merge alone.**
3. `feat(bilan): session notes feed the weekly review, douleurs leaves the form (#41)`
   — the notes line, seven fields instead of eight.
4. `feat(semaine): mark today's session and count what is validated (#41)` —
   still a tab, no structural change.
5. `feat(semaine): the weekly review becomes a section of Semaine (#41)` — Bilan
   leaves the tab bar, which drops to three.
6. `feat(seance): Séance becomes a screen opened from Semaine (#41)` — the
   header split, the rail and week nav out of Séance, the auto-selection effect
   deleted, the bar down to two, `screen-state` wired in. The big one.
7. `feat(semaine): cardio gets its own section and the "cardio" sentinel goes (#41)`.
8. `feat(bilan): download the weekly review instead of copying it (#41)` —
   `copy()` loses its last caller and is deleted.
9. `docs: the app opens on Semaine (#41)` — `docs/ARCHITECTURE.md` dependency
   table gains the two modules; any wording in `CONTRIBUTING.md` or
   `src/plan.js` that names a tab that no longer exists.

## Tests

- **Unit, `node --test`.** `screen-state`: absent key → null; write/read
  round-trip; a remembered session that is not in `sessionIds` falls back to
  Semaine; storage that throws (private mode) degrades without raising.
- **Unit, `node --test`.** `bilan`: step 2 locks the current output verbatim, so
  step 3's diff is visible in the test rather than argued about. Then: notes
  from two sessions appear attributed; a session with an empty note contributes
  nothing; no notes at all means no notes line; `douleurs` no longer appears.
- **Manual click-through**, `npm run dev`: land on Semaine; open each session;
  return by the bar; reload mid-session and land back in it; switch cycle from
  Plan while Séance is open and land on Semaine rather than on a stale session.

## Risks & tradeoffs

- **The header split is the risky edit**, because it is the one place where
  markup that served four tabs becomes markup that serves two screens. Step 6
  is where a regression would hide; it is also the step that cannot be made
  smaller without leaving the app in a state where Séance has no way back.
- **`sessionStorage` can throw** (Safari private mode) rather than return null.
  `readScreen`/`writeScreen` return a verdict, never raise — same rule as every
  other door in this codebase (ARCHITECTURE §2.4).
- **Storage impact: none.** No journal field is added, renamed or read
  differently; `checkin.wN.douleurs` stays in storage and in the export, simply
  unread. `prog12_screen` lives in `sessionStorage`, which is not the journal
  and not persisted. The spec's **MINOR** stands, with no migration.
- **Rejected:** keeping Séance as a fourth tab that reopens the last session.
  It is the smaller change, but it preserves the defect the issue is about —
  landing on a session nobody chose.

## Out of scope / follow-ups

- Extracting `bilan.js` moves one piece of #23 ("move display and summary logic
  out of `App.jsx`"). The rest — `setSummary`, `weekRange`, `todayLine` — stays
  where it is; this design takes only what the spec's criteria require to be
  testable.
- `src/plan.js` prose refers to tabs by name in places. Step 9 checks it; if it
  turns out to be more than wording, it belongs to #34, not here.
- The `weekDoneCount` badge disappears from the nav. Confirmed by the spec's
  Out of scope; the count survives on the hub.
- **`getCardioDayNotes` has no caller left in `src/`.** Its only consumer was
  the deleted auto-selection effect, which used it to open straight onto
  "Cardio et mobilité" on days without a session. It and `CARDIO_DAY_NOTES`
  are kept rather than deleted: the latter is part of the program format, and
  removing a field because one screen stopped reading it is a decision for #34,
  not a cleanup to slip into this issue. Both comments now say so.

## Decisions

Settled 2026-09-13.

1. **The rest timer lives in the Séance header**, as in the mockup — not in the
   global slot this design first recommended. Stepping back to Semaine mid-rest
   hides the countdown, which is the intended reading: you left the session.
   Nothing is lost either way, since `remaining` is recomputed from `timer.end`
   (`App.jsx:294-297`) rather than decremented, so reopening the session shows
   the correct time.
2. **`buildBilan` takes already-derived values.** The alternative — importing
   `program.js` to dig them out — would tie the review text to the program
   format and make its test require a whole built program. Same reasoning as
   `dateForSlot` redoing its own date parsing to keep `schema.js` a leaf
   (`schema.js:73`). Cost: a longer call site in `App.jsx`, which is the file
   that already knows everything.
3. **`screen-state` takes `sessionStorage` injected.** ARCHITECTURE §2.7, "the
   store is injected, never reached for" — the same rule that lets
   `test/helpers/fake-store.js` stand in for `localStorage`, and that let
   `file-io.js` test all five share/download branches with no browser. Cost: one
   argument at four call sites; gain: "a remembered session that no longer
   exists falls back to Semaine" becomes a test instead of a manual click.

## Open questions

None.
