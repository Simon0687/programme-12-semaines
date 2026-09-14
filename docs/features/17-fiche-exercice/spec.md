# Spec - Exercise sheet: one screen per exercise, all cycles (#17)

## Context

Mid-session, the exercise card answers "what did I do last time" with one line —
`lastEntry()` / `lastEntryLabel()` (`App.jsx:174`) — and nothing beyond it. Worse,
`history()` skips any log whose `slot` is absent from the active program
(`progression.js:45`), so changing cycle makes everything older unreachable. For
someone training over years that long view *is* the point. The data has been
there since #16 (dated timeline) and #26 (definition pinned per cycle); what is
missing is the screen that reads it.

Issue: [#17](https://github.com/Simon0687/programme-12-semaines/issues/17).
Level A per `.claude/WORKFLOW.md` (Q3: reading the journal across cycles is a
capability the system does not have; `screen-state.js` gains a screen and a
field). Q1 answers **no** — no stored journal is re-interpreted.

## Scope

- **In:** a read-only screen keyed by exercise id, reachable by tapping an
  exercise name in Séance; a load chart over real time across all cycles; a
  records table indexed by rep count; a reverse-chronological session history
  with cycle separators; the technique cue; a Détails block rendered from the
  registry's selection fields; a rendering module holding the French labels for
  `MUSCLE_GROUPS`, `EQUIPMENT` and articulations, into which `setSummary()` moves
  out of `App.jsx` (taken from #23 ahead of time, so the sheet and the Semaine
  list share one formatter instead of growing a second); and a reading module,
  `src/exercise-history.js`, holding the one traversal of the journal every
  long-view feature needs.
- **Out:** any write — the sheet never edits the journal. A per-exercise
  persistent note. Opening a past session from a history row. Suggesting similar
  exercises. Animated illustrations. An "Exercices" tab (the sheet is designed
  not to need one, and adding it is a separate issue). The exercise card's own
  "Technique" disclosure, which stays as it is.

## User-facing behaviour

**Séance.** The exercise name becomes a tap target, marked by a chevron. Nothing
else on the card changes: "Prévu", "Dernière fois", the Technique disclosure and
the set grid are untouched.

**Fiche exercice** (new screen). A back row naming where it came from
("← Séance Haut A"), then the exercise name. No figure of merit in the header.
Then, in order:

- **Chart.** One point per session, plotted against real dates, all cycles. One
  polyline per cycle — never joined across the gap between them. Calibration and
  deload sessions are drawn as hollow points. What the point *measures* depends
  on the registry `unit`, in three regimes (Decision 4):
  - `kg` — an **estimated 10RM**, taken from the session's best-estimating set.
    Points computed from fewer than 3 or more than 12 reps are drawn grey, and a
    line under the chart says why.
  - `time`, `reps` — the best set as recorded; there is nothing to estimate.
  - `bw`, `carry` — **two plots on one time axis**: a polyline for reps (or
    hold), bars for the load, taken from the heaviest set of the day. A single
    right-hand label declares the top of the bar scale. Bodyweight-only history
    draws no bars at all.

  Below it, one quiet line: `N séances validées depuis le <date>`.
- **Records.** One row per rep count actually reached: the heaviest load ever
  carried for *that many reps or more*, with its date. The table is therefore
  monotone by construction. For `time` and `reps` units it degenerates to a
  single row ("Meilleure tenue"), with the rule line reworded.
- **Historique.** One row per session, most recent first: `<date> · <session
  name>` on the left, the set summary on the right. Calibration and deload rows
  carry a pill saying so. **Every cycle carries a header** naming the program and
  its period — the most recent one included (Decision 6). **The session name is
  the one stored in that cycle's pinned definition**, not the name today's
  program gives the slot. The set summary stays compact while the load holds
  (`72,5 kg 8/8/10`) and becomes explicit as soon as it moves
  (`8@90/8@85/10@70 kg`, Decision 5).
- **Technique.** The registry `cue`, always expanded.
- **Détails.** Muscle split as labelled bars (dominant muscle in amber, the rest
  in grey), then équipement, articulations, type. Rendered from
  `EXERCISES[id]`; omitted entirely for the four ids in `UNSELECTABLE_IDS`.

**Empty state.** An exercise with no validated set shows "Jamais fait." and one
sentence; chart, records and historique are not rendered as empty shells.
Technique and Détails still render when the registry carries them.

**Semaine, Bilan, Plan.** Unchanged. The bottom bar keeps its two entries, with
"Semaine" highlighted while the sheet is open.

## Acceptance criteria

- [ ] Given an exercise card in Séance, when its name is tapped, then its sheet
      opens; when back is tapped, then Séance reopens on the same session with
      any in-progress entry intact.
- [ ] Given a journal holding several cycles, when a sheet is opened, then
      sessions from every cycle appear, separated and labelled with the session
      name each cycle's own definition gives them.
- [ ] Given a session that is started but not validated, then none of its sets
      appear in the chart, the records table or the historique.
- [ ] Given an exercise whose unit is `bw`, `time` or `reps`, then the chart,
      the records table and the historique render with that unit and no kilo
      column is shown.
- [ ] Given an exercise never performed, then "Jamais fait." is shown and no
      empty chart or empty table is rendered.
- [ ] Given an exercise in `UNSELECTABLE_IDS`, then no Détails section is
      rendered — neither a section nor a placeholder.
- [ ] Given a reload while the sheet is open, then the sheet reopens on the same
      exercise; given an exercise id the registry no longer knows, then the app
      falls back to Semaine rather than rendering nothing.
- [ ] Given a log row whose `ex` payload is malformed — a key that is not in
      `EXERCISE_IDS`, or a value that is not an array of set objects — then the
      sheet renders without throwing and that payload contributes nothing to the
      chart, the records or the historique.

## Data & storage impact

**None on the journal.** The sheet only reads. No field is added, renamed or
re-interpreted; `SCHEMA_VERSION` is untouched. A journal written by the previous
version loads without loss, and one written after this issue loads in the
previous version unchanged.

`prog12_screen` (`sessionStorage`, #41) does change shape: `SCREENS` gains
`"exercice"` and the stored object gains an `exerciseId`. It is navigation
state, rebuilt from nothing on a miss, and `readScreen` already returns `null`
for anything it cannot parse — so an old or new value is handled, not migrated.

**Level: MINOR.** A new screen, an existing journal intact.

## Edge cases

- **Exercise never performed** — the empty state above.
- **Deload and calibration** — kept in the chart as hollow points and in the
  historique with a pill; never silently dropped, which would leave unexplained
  gaps, and never drawn as ordinary points, which would read a programmed −15 %
  as a regression.
- **Session in progress** — excluded everywhere on the sheet. `history()`
  already filters on `rec.done`, so this needs no new rule: a record announced
  after set 1 could be contradicted by set 3, and the sets in progress are
  visible on the screen you came from.
- **The same date in two cycles** — two cycles can both hold a session for the
  same day; nothing forbids it and nothing should. Both rows are shown, each
  under its own cycle header. See Decision 6.
- **Dates in the future** — a log dated after today is plotted and listed like
  any other. The sheet does not judge dates: a journal is allowed to hold
  deliberately out-of-range entries, and silently dropping them would hide data
  the user entered on purpose.
- **Sets with no reps recorded** — already dropped by `history()`
  (`progression.js:46` filters `r != null`); a session whose sets are all empty
  produces no row.
- **Logs from a cycle whose definition is unusable** (#32 `unusableProgramIds`) —
  **their sets appear.** `unusableProgramIds` marks an entry unselectable; it does
  not remove it from `journal.programs`, so the sets stay reachable. A definition
  the app cannot *run* is not a reason to deny that the reps were done. Where such
  a definition cannot supply a session name, the row falls back to its date alone,
  which is the log's identity anyway (ARCHITECTURE §2.3).
- **Malformed `ex` payload.** `isLogRow` (`journal-shape.js:232`) checks `date`,
  `slot`, and that `ex` is an object — it never looks *inside* `ex`. A row where
  `ex.dc` is the string `"87,5"` passes the filter and makes `history()` throw
  `TypeError: … .map is not a function`, verified 2026-09-14. The gap is live
  today on the active program; reading every cycle widens its surface to exactly
  the entries whose definition already failed validation. `exerciseHistory()`
  must therefore be closed by default on the payload — an unknown key or a
  non-array value contributes nothing and never throws (ARCHITECTURE §2.4).
  Whether the guard belongs in the new reader or one level down in `isLogRow` is
  a `design.md` question, not a product one.
- **Rep range changed between cycles** — the records table is range-agnostic by
  design, so a record set under a 5–10 program still counts under a 4–8 one.
- **One exercise, two slots** — nothing special: the sheet reads `ex[vid]`
  wherever it was written.

## Out of scope / follow-ups

- **Per-exercise persistent note.** A new stored field, therefore Level A with a
  migration. Deliberately not folded in here.
- **Opening a past session from a history row.** The app cannot render a session
  outside the week currently displayed.
- **Similar exercises / variants.** Computable from `pattern` and `muscles`, but
  that is the selection brick of #19, not a screen.
- **An "Exercices" tab.** The sheet takes no session context, so the tab is
  additive; it needs its own issue (a catalogue has to decide ordering, search
  and what an exercise looks like before you have ever done it).
- **The rest of #23.** This issue takes `setSummary()` only. `normalizeSets()`,
  `historyBefore()`, the `UNITS` traits table and `buildBilan()` stay in #23 —
  they touch `progression.js`, a sensitive module, and #23 requires pinning the
  current output with tests before moving anything.
- **Collapsing `history()` onto `exerciseHistory()`.** The engine's read is
  deliberately narrower — active program only, because `planned()` must not
  compare prescriptions across rep ranges — so `history()` is a filtered case of
  the new function, not a duplicate of it. Merging them touches `progression.js`
  and needs the engine's output pinned by tests first, exactly as #23 requires.

## Decisions

Settled 2026-09-14 in conversation, before `/decide`. Product choices only;
implementation choices follow `/design-tech 17`.

1. **The rendering module takes `setSummary()` now, from #23.** The French
   labels for `MUSCLE_GROUPS`, `EQUIPMENT` and articulations have to live
   somewhere that is not `registry.js` — the registry stays a leaf carrying keys
   and no display text — and the sheet needs a set summary that already exists
   in `App.jsx`. Writing a second one would be the exact duplication #23 was
   filed against.

   **Deviation from #23, to be carried back into it:** #23 expects
   `setSummary()` to land next to `loadText()` in `progression.js`. It goes to
   the rendering module instead. `setSummary` produces a French display string
   whose wording depends on the unit; putting it in the engine is what keeps
   forcing `planned()` to return pre-formatted text. `loadText()` stays where it
   is — `planned()` calls it internally, and moving it would make a sensitive
   leaf module import a view module.

2. **All sets appear, including those of a cycle the app can no longer execute.**
   A definition that fails validation makes its cycle unselectable, not its
   history untrue.

   This answer exposed a structural property: the journal indexes sets by
   `(program, date, slot)` and never by exercise, so every long-view read is a
   full traversal. **The answer is one shared function, not a new storage
   shape** — `exerciseHistory(journal, exerciseId)` in `src/exercise-history.js`,
   which every later long-view feature (#14, #35) calls instead of re-walking
   the journal. At this volume — about 260 sessions a year on one device — the
   traversal costs nothing; what was worth avoiding was writing it three times.

   A flat two-table shape (`sets` rows carrying date, slot, program, exercise,
   set index, load, reps, RIR; `sessions` rows carrying `kind`, `done`,
   `updatedAt`, `notes`) remains the natural target if a reason ever appears —
   it is easier to hand-edit and maps to a backend table. It is recorded here
   rather than filed, because with the shared reader in place nothing needs it.
   Note that a reshape would still cost a re-read of `progression.js`, which
   receives a session's sets pre-grouped today and would have to group them
   itself; that module decides every suggested load, silently.

3. **No tapped point on the chart.** No hit-testing, no value bubble. The
   historique immediately below carries every number the chart plots.

---

Settled 2026-09-14, **after** the screen shipped to `dev` and was used against a
real journal. Decisions 4 and 5 reverse choices 1–3 were written under; both
reversals come from the same source — the screen was read, and it said something
untrue.

4. **The chart plots an estimated 10RM, not raw load.** This **reverses** the
   original refusal of any estimated max. That refusal was argued on two
   grounds, and only one survived contact with the data.

   The refusal held that a model invents what the journal did not record. What
   the shipped chart did instead was *worse*: it plotted the heaviest set's load
   and ignored its reps, so 8 reps at 90 kg and 2 reps at 90 kg landed on the
   same point. The chart did not decline to model — it modelled reps as
   irrelevant, silently, and read a collapse as a plateau.

   **10RM and not 1RM**, which is the part that makes this worth doing: a one-rep
   max answers a question this program never asks. No session in it prescribes a
   single. A ten-rep max is the order of magnitude actually trained, so the curve
   lands inside the working range instead of extrapolating past its own data.

   **Epley, normalised to ten reps** — `w × (30 + r) / 40`. It is the identity at
   `r = 10`, so a genuine set of ten is plotted at the weight actually lifted,
   with no drift; Brzycki has no such property and degrades past ten reps.

   **The window is 3–12 reps.** Outside it the estimate measures something else —
   the nervous system below, local endurance above — so those points are drawn
   grey with the reason stated on screen. Grey and not dropped: a session that
   happened belongs on the chart, and hiding it would be the same class of lie in
   the other direction.

   **The surviving half of the original refusal is the unit problem, and it is
   answered rather than overruled.** `bw` and `carry` carry two progressions at
   once, and a 10RM extrapolated from six weighted pull-ups yields a *negative*
   added load — a number with no meaning. Those units therefore get no estimate
   at all: reps (or hold) as a polyline, load as bars, on one time axis. `time`
   and `reps` have nothing to estimate. So the model applies exactly where it is
   defined, and nowhere else.

   *Follow-up, not filed:* an estimate that runs high at high reps suggests an
   endurance profile, one that runs high at low reps a force/CNS profile. Simon
   wants this written up as an article, and sees a broader place for training
   articles in the app. Nothing in the code depends on it.

5. **The set summary is compact while the load holds, explicit once it moves.**
   The compact form took the *maximum* load and concatenated *all* the reps, so
   8 at 90, 8 at 85 and 10 at 70 rendered as `90 kg 8/8/10` — a set that was
   never performed. It is kept only where it is exact, which is the common case:
   `planned()` prescribes one working load, so the three sets usually share it.
   When they do not, each set carries its own: `8@90/8@85/10@70 kg`. A row that
   changes shape is itself the signal that the load had to come down.

   Consequences: `@` now means "at this load", so RIR moves to `·`; and a RIR
   that was never entered prints nothing instead of `@ ? RIR`. The change reaches
   the three other callers in `App.jsx` — "Dernière fois", the session recap and
   the downloaded weekly review — which is intended: the summary lied in all four
   places.

6. **Every cycle in the historique carries a header, the most recent included.**
   A session dated 7 sept. appeared twice, above and below a cycle separator,
   and read as a duplication bug. It is not one: no code path copies a log
   (`loadProgram` reuses the entry, `migrateLogsV2ToV3` rebuilds `logs` from
   scratch), so those are two genuine records in two different cycles. A date is
   unique within a cycle and nowhere else. The defect was that the header only
   appeared *between* groups, leaving the most recent cycle anonymous — so two
   dates looked identical while belonging to different programs.

## Open questions

None.
