# Decisions - Semaine becomes the entry point: Séance is a screen, not a tab (#41)

Source: spec.md
Scope: product / requirement choices only. Implementation choices are decided in
the second round, in `decisions.md`, once `/design-tech 41` has produced
`design.md`.
Status: all six answered 2026-09-13

## Q1 - Aggregated session notes: computed or stored?

**Question.** The bilan gains a line built from every `logs[].notes` of the week.
That line can be recomputed each time the bilan is generated, or written once
into the journal (the spec's starting point was reusing `checkin.wN.douleurs`,
which stops being edited). Left unanswered, `design.md` cannot state whether
`setCheck` (`App.jsx:340`) gains a writer or `bilanText()` (`App.jsx:347`) gains
a reader.

**Option A - Computed at generation**
- What it means: `bilanText()` iterates the week's sessions — it already does,
  to build the "Exos clés" line — and concatenates `log.notes`. Nothing new is
  written.
- Implications: no new field, no migration, `SCHEMA_VERSION` untouched. Stays
  MINOR. `checkin.wN.douleurs` becomes an orphan field: present in old journals
  and in the export, written by nobody, read by nobody.
- Pros: cannot go stale. Consistent with `docs/ARCHITECTURE.md` §2.2 ("the
  journal records what happened, never what was planned") and with the same
  reasoning already written into `App.jsx:167-170` for `unusableProgramIds`.
- Cons: the bilan text exists only at the moment it is generated — there is no
  record of "the bilan as sent" if that is ever wanted.

**Option B - Stored in `checkin`**
- What it means: generating the bilan writes the aggregate into the week's
  `checkin` entry, reusing `douleurs` or a new key.
- Implications: `checkin` entries carry no timestamp — `setCheck` writes none,
  unlike `writeLog` which stamps `updatedAt` (`schema.js:96`). Correcting a
  session note afterwards, via the "Rouvrir" button the app offers, makes the
  stored aggregate disagree with `logs` **with nothing able to arbitrate**. Adds
  a field for #29 to carry when `checkin` moves to dated records.
- Pros: the bilan is recoverable from the journal alone, without recomputation.
- Cons: making it correct means adding `updatedAt` to `checkin` entries plus a
  rule "regenerate if any log in the week is newer" — which is recomputing, with
  a cache that can be wrong in between.

**Recommendation. A.** The failure it avoids is not hypothetical: reopening a
session to fix a note is a gesture the app invites. Reversible — if "the bilan
as sent" is later wanted, that is a new field with a clear meaning, not a
retrofit of this one.

**Simon's decision.** **A** — computed. Q1 recorded 2026-09-13.

## Q2 - What replaces `sessionId`, and what a reload shows

**Question.** `sessionId` (`App.jsx:197`) and `tab` (`App.jsx:188`) are plain
`useState`, persisted nowhere. A reload therefore always lands on Séance and
lets the effect at `App.jsx:283-289` guess a session. That effect is being
deleted, so the reload behaviour has to be decided rather than inherited.

**Option A - Nothing persisted: a reload returns to Semaine**
- What it means: `screen` and the open session live in component state only.
- Implications: no storage of any kind. Journal data is unaffected either way —
  the autosave debounce (`App.jsx:249-258`) persists `journal`, not navigation.
- Pros: smallest change; nothing new to migrate or invalidate.
- Cons: on iOS the web view is reclaimed while the app is backgrounded — which
  happens every time you switch to a music app between two sets. Coming back
  mid-session drops you on Semaine and you re-tap your session.

**Option B - The open screen is kept in `sessionStorage`**
- What it means: `{screen, sessionId}` written on change, read at boot.
- Implications: `sessionStorage`, not `localStorage` — it must not resume a
  session three days later. Independent of the journal; no schema impact.
- Pros: surviving the iOS reload is exactly the case that matters, since it
  happens mid-session rather than between sessions.
- Cons: one more piece of state to keep consistent with `activeProgramId` and
  the displayed week (switching cycle already resets `week`, `App.jsx:294-297`).

**Recommendation. B**, with `sessionStorage`. The reload it protects against is
the ordinary one, not the exotic one. Reversible in one commit: deleting the
read at boot degrades to A with no data consequence.

**Simon's decision.** **B** — sessionStorage. Q2 recorded 2026-09-13.

## Q3 - Does the bottom bar stay at two entries?

**Question.** With Bilan leaving the tab bar and Séance no longer being a tab,
the bar holds Semaine and Plan. Two entries is thin for a bottom bar, and the
alternative — removing it — collides with the decision already taken that Séance
has no back arrow.

**Option A - Keep a two-entry bar**
- What it means: Semaine and Plan, with Semaine highlighted while Séance is open.
- Implications: the bar is the return path from Séance, so it must render there
  too. `App.jsx:641-656` loses two entries and the `weekDoneCount` badge (see
  spec, Out of scope).
- Pros: one affordance does two jobs — switching destination and returning.
  Nothing new is invented.
- Cons: a two-item bar reads like a leftover.

**Option B - No bar; Plan moves into Semaine**
- What it means: Plan becomes a row at the end of the Semaine screen or a header
  button; the bottom bar disappears.
- Implications: Séance then has no return affordance and needs a back chevron,
  reversing the decision taken during the design session.
- Pros: the app becomes a pure stack, visually lighter.
- Cons: reintroduces exactly the affordance that was deliberately removed.

**Recommendation. A.** B is only better if the back arrow comes back, and that
trade was already made in the other direction. Cheap to revisit later: moving
Plan out of the bar does not touch any data.

**Simon's decision.** **A** — two-entry bar. Q3 recorded 2026-09-13.

## Q4 - Cardio and mobility on Semaine: in this issue or after #34?

**Question.** Today cardio is reachable two ways: the `"cardio"` chip in the
Séance rail (`App.jsx:497`), and the compact block already rendered in the
Semaine tab (`App.jsx:559-561`). The rail is being deleted. One fact settles
most of this: `compact` only hides a heading — `CardioView` renders the same
checkboxes and inputs either way (`App.jsx:696`). **Nothing becomes unreachable.**

**Option A - Handle it here, minimally**
- What it means: keep the existing `CardioView … compact` and give it its own
  section in the new Semaine layout, between the session list and the Bilan
  section, behind the existing `hasCardioContent(prog)` guard.
- Implications: `sessionId` stops ever holding `"cardio"`, so `session` is never
  `undefined` (`App.jsx:302`) and `si` is never `-1` (`App.jsx:303`) — that
  sentinel and the `-1` it feeds into `planned()` and `lastEntry()` leave the
  codebase. Does not touch #34, which is about cardio *content* following the
  active program, not about where the checklist sits.
- Pros: removes a special case rather than relocating it; the bundled default
  program carries no cardio, so the section simply does not render for it.
- Cons: slightly widens this issue.

**Option B - Defer to #34**
- What it means: leave cardio where it is and revisit after #34.
- Implications: the `"cardio"` sentinel survives with no UI that can set it —
  dead state until #34, plus the `si === -1` path it feeds.
- Pros: keeps this issue narrower.
- Cons: ships a state value nothing can produce. #34 is about content, so it
  would not naturally clean this up.

**Recommendation. A.** The deletion of the rail is what orphans the sentinel;
the issue that deletes it is the one that should remove it.

**Simon's decision.** **A** — handled here, minimally. Q4 recorded 2026-09-13.

## Q5 - A "Bilan" row in the session list?

**Question.** Should the week's bilan appear as a row among the four sessions,
as part of "what is left this week", or only as the collapsible section below
the list?

**Option A - No row**
- What it means: the Bilan section header sits directly under the list, carrying
  its own state counter (`à remplir` / `N sur 7` / `complet`).
- Implications: none beyond layout.
- Pros: the counter already answers "what is left", roughly 60 px below where
  the row would have been. A row would duplicate it on one screen.
- Cons: the bilan is not literally in the list of things to tick off.

**Option B - A row in the list**
- What it means: a fifth row, "Bilan — à remplir dimanche", that scrolls to or
  unfolds the section.
- Implications: the list stops being homogeneous — four rows open a screen, one
  scrolls within the current one.
- Pros: one single list of everything the week owes.
- Cons: two affordances for one object, and a row whose chevron means something
  different from its neighbours'.

**Recommendation. A.** The section header is already visible without scrolling
on a 844 px screen; a second entry point adds ambiguity, not information.

**Simon's decision.** **A** — no row. Q5 recorded 2026-09-13.

## Q6 - Sequencing against #15

**Question.** Removing the JSON preview and the paste area needs a real file
export and a file picker; so does the Bilan's "Télécharger le bilan" button.
That is #15, whose body reads "draft — not scoped for implementation yet".

An earlier draft of this brief proposed extracting the file-writing measure from
#15 into its own small issue. **That was wrong and is withdrawn.** Of #15's three
measures, measure 2 (the 14-day reminder) explicitly stores "the last-export
date" — it cannot exist without measure 1. And four of #15's five acceptance
criteria depend on measure 1. What extraction would leave behind is
`navigator.storage.persist()`: one call, not an issue.

**Option A - Ship #41 without any file export, catch up with #15 later**
- What it means: navigation and Bilan placement land now; the Bilan section
  keeps "Copier le bilan"; Plan → Données is untouched.
- Implications: `copy()` and `ioText` survive for two callers, so the two
  defects named in the issue survive with them — in code this issue is otherwise
  rewriting. The spec criterion `grep -n "ioText|copy(" src/App.jsx` cannot
  pass. The Bilan section is touched twice: once to place it, once to swap its
  button.
- Pros: the designed change ships now; no dependency.
- Cons: two passes over the same code; one acceptance criterion deferred.

**Option B - Do #15 in full first, then #41 complete**
- What it means: #15 gets its own spec → decide → design-tech → code; #41 then
  delivers everything, Données included.
- Implications: #15 is costed at "roughly a day" of code in its own notes. Its
  level hinges on one storage choice: if the last-export date lives in its own
  `localStorage` key — the pattern already used by
  `prog12_simon_v1_backup_pre<N>` and by the dropped-sessions key — the journal
  does not change shape and #15 stays MINOR. Put inside the journal, matrix Q2
  answers yes and it becomes level A with a migration.
- Pros: one pass over `App.jsx`; #41 ships whole and all its criteria pass.
  Respects the `CONTRIBUTING.md` rule against mixing refactor and feature work.
- Cons: #41 waits for #15's full cycle.

**Recommendation. B.** The two issues rewrite the same region of `App.jsx`, and
#15 is small once its storage question is settled. Weakly reversible: if #15
turns out bigger than a day, falling back to A is still possible at that point.

**Simon's decision.** **B** — #15 first, in full, then #41 complete. Recorded
2026-09-13. Done since: #15 is implemented on `feat/15-durable-local-data`
(file export and import, the three safety copies as downloads, the 14-day
reminder, storage persistence), so the dependency is satisfied and this issue
can deliver everything including the Données placement.

## How to apply

Once Simon fills in each "Simon's decision", the answers fold back into
`spec.md`: resolved points move out of **Open questions** into the relevant
section (or a new **## Decisions** list), and **Open questions** ends as "None".
Q6 answered as B means #15 runs its own cycle first and stays named in the
spec's **Depends on** line; answered as A, the Données rework and the bilan
download move to the spec's **Out of scope / follow-ups**.
