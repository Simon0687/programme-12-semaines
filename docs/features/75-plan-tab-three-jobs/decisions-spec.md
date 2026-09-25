# Decisions - The Plan tab does three jobs (#75)

Source: GitHub issue #75 + `docs/reviews/2026-09-25-parcours-plan.md` (no
`spec.md` — the issue states the problem and its two options itself, and the
review document supplies the third one the issue could not see)
Scope: product / requirement choices only. There is no sibling `decisions.md`:
nothing below is a code-shape choice. The one implementation question the move
raises (Q2) is here because it changes a promise the user can observe, not
because it picks a data structure.
Status: **archived — the decision was tried in code on 2026-09-25 and rejected.**
Simon had delegated the answers (« suis tes reco »); the resulting screen was
built on the local branch `feat/75-reglages-hors-plan` and refused after testing
on the phone, for three reasons, all of them fair:

1. an unlabelled ⚙ does not say what it opens;
2. it pushes the « semaine suivante » arrow — used three times a week — aside
   for a screen opened twice a cycle;
3. the six remaining index lines still carry exactly as much text, so the
   complaint the whole thing started from is untouched. §1.2 of the review said
   as much, and that is what #104 went on to fix.

The verdict was to **rework the navigation as a whole rather than patch it**, so
#75 was closed unbuilt. What is kept below is the analysis, not the answer: the
index measurements, the fact that the cycle delete lives under « Ce programme »
and not under « Appareil », and the file-picker round-trip argument for putting
a settings screen into `SCREENS`. Q1's answer itself is dead.

> **Supersedes** the brief abandoned on the morning of 2026-09-25, kept on the
> unpushed branch `docs/75-plan-tab-decision`
> (`git show docs/75-plan-tab-decision:docs/features/75-plan-tab-three-jobs/decisions-spec.md`).
> Two of its facts were wrong — the index is seven lines, not six, and
> `planTopic` is **not** part of the persisted screen state
> ([App.jsx:269-273](../../../src/App.jsx#L269)). The direction of its
> recommendation survives both corrections; its option set does not, because it
> only ever weighed "a third tab" against "change nothing".

---

## What the index actually holds today

Measured by running `buildPlan(DEFAULT_DEFINITION)` and adding the two
screen-owned entries of [App.jsx:1130](../../../src/App.jsx#L1130):

| Group ([PlanViews.jsx:62](../../../src/PlanViews.jsx#L62)) | Lines | What they are |
|---|---:|---|
| `methode` — « La méthode » | 3 | Structure des 12 semaines, Règles de progression, Décharge |
| `programme` — « Ce programme » | 3 | Volume par semaine, Plan de repli, Programme |
| `appareil` — « Appareil » | **1** | Données : sauvegarde et restauration |

Three facts drive every question below.

**The device is one line out of seven.** Everything the issue lists under it —
export, import, backups, persistence state — is behind that single `donnees`
entry ([App.jsx:1627](../../../src/App.jsx#L1627)).

**The destructive action is not in that group.** Deleting a cycle is
`setPendingDelete` → `removeProgram`, rendered under `planPage.id ===
"programme"` — the **« Ce programme »** group. Moving « Appareil » out would
leave "read a training rule" and "delete a cycle" behind the same tab, so
option (a) of the issue does not solve the sentence the issue opens with.

**But the import does replace the journal**, and it is one tap from a reading
screen, drawn exactly like the lines one opens out of curiosity. That is the
real asymmetry — and it is about *this* line, not about the delete.

---

## Q1 - Does « Appareil » leave the Plan tab, and through which door?

**Question.** The issue offers two answers: a third *Réglages* tab, or nothing
moves. #41 reduced the bar to two on purpose and it is a `grid-cols-2`
([App.jsx:1720](../../../src/App.jsx#L1720)); #78 (Exercises tab) is blocked on
this issue by its own note. Left unanswered, #78 stays `priority: later` and
#79 (rest-timer sound) has nowhere to land.

**Option A - A third bottom-bar tab, *Réglages*** (the issue's (a))
- What it means: `donnees` leaves `planTopics`, `SCREENS`
  ([screen-state.js:26](../../../src/screen-state.js#L26)) gains `"reglages"`,
  the bar becomes `grid-cols-3`.
- Implications: a permanently visible slot for one index line and one future
  preference. With #78 the bar would be at four, which the 2026-09-24 review
  says outright does not fit.
- Pros: settings stop sitting next to training content; somewhere obvious for
  #79 and any later preference.
- Cons: the cost is paid on every screen, forever, for a page opened twice a
  cycle. It spends the slot #78 wants, and buys none of the safety the issue
  asks for, since the delete stays under « Ce programme ».

**Option B - Keep two tabs, nothing moves** (the issue's (b))
- What it means: no code change. The three group headings keep doing the
  separating, which is what #62's drill-in index was built for.
- Implications: none. #78 must then answer the door question on its own terms,
  and #79 lands in the same drawer.
- Pros: free, and the groups do tell the reader which job a line belongs to
  before they tap.
- Cons: the one screen that can replace the journal keeps the exact same
  affordance — a chevron row — as « Règles de progression ». A group heading is
  a label, not a door: it separates in reading, not in reach.

**Option C - Out of Plan, behind a ⚙ icon in the Semaine header**
(`docs/reviews/2026-09-25-parcours-plan.md` §3.4)
- What it means: `donnees` leaves `planTopics`; its contents move to a full
  screen reached by an icon button in the Semaine header. The bar stays
  `grid-cols-2`. The `appareil` group disappears from `PLAN_GROUPS`, the index
  drops to six lines.
- Implications: `SCREENS` gains `"reglages"` (see Q2); the header of Semaine
  gains one 44 px icon button; the onboarding sentence at
  [App.jsx:1209](../../../src/App.jsx#L1209) ("onglet Plan, section Données")
  has to be reworded. #79 has a home that costs no bar slot. #78 keeps the slot
  it never needed.
- Pros: gets the separation the issue asks for **without spending the scarce
  resource**. A ⚙ is the one glyph every phone user already reads as "this is
  not content" — the drawing itself says the line is a different kind of thing,
  which is what a group heading could not do.
- Cons: a ⚙ is a grab-bag by convention, so it invites future clutter; and the
  icon is one more thing in a header #41 worked to keep quiet.

**Recommendation.** **C.** The argument I would not lead with is that the bar
is full: that is one className, and a reason of that size should not decide
where a screen lives. The one that survives is that the import replaces the
journal while being drawn as a reading row — the fix for that is a different
*affordance*, not a different *label*, and a tab is not the only affordance
available. Reversible in the cheap direction: promoting a ⚙ screen to a tab
later is adding a button; demoting a tab nobody taps is the awkward direction.

**Simon's decision.** _Delegated on 2026-09-25 → **C**._

---

## Q2 - Is Réglages remembered across a reload?

**Question.** `prog12_screen` validates `screen` against `SCREENS` and falls
back to `HOME` on anything unknown
([screen-state.js:77](../../../src/screen-state.js#L77)). The Plan *page* is
deliberately not remembered — `planTopic` sits outside `nav`
([App.jsx:269](../../../src/App.jsx#L269)) — so today a reload on the Données
page reopens the Plan index. Whether Réglages inherits that treatment decides
what happens when the user comes back from a file picker.

**Option A - Réglages is a screen value, remembered like the others**
- What it means: `"reglages"` joins `SCREENS`; `resolveScreen` needs no new
  branch — it already returns `{ screen, sessionId: null }` for any screen that
  is neither `seance` nor `exercice`.
- Implications: one string, plus tests in `test/screen-state.test.js` alongside
  the existing `"plan"` cases. An older build reading a newer state falls back
  to `HOME`, which is safe by construction.
- Pros: **export and import are the app's only flows that leave the app** — a
  save dialog, a file picker — and the header of `screen-state.js` records that
  on iOS the web view is recycled whenever the app backgrounds. Not persisting
  means coming back from the picker lands on Semaine. That is today's behaviour
  on the Données page, and this is the chance to not carry it over.
- Cons: one more value that has to stay valid; a screen remembered "too long"
  reopens settings the next morning.
- Notes: that second con is bounded — it is `sessionStorage`, not
  `localStorage`, so it dies with the tab.

**Option B - Transient, like `planTopic`**
- What it means: a React state flag, nothing persisted.
- Implications: zero change to `screen-state.js`.
- Pros: keeps the persisted vocabulary at four values.
- Cons: keeps the file-picker round-trip broken, which is the one thing this
  screen exists to do.

**Recommendation.** **A.** The reason `planTopic` is not persisted is that a
reload reopening an *index* is the right default — and that reasoning does not
transfer to a screen whose main action hands control to the OS and expects you
back.

**Simon's decision.** _Delegated on 2026-09-25 → **A**._

---

## Q3 - Does deleting a cycle move too?

**Question.** The sentence opening the issue — "reading a training rule and
deleting a cycle have no business behind the same tab" — is about
`removeProgram` ([App.jsx:1591](../../../src/App.jsx#L1591)), which lives under
« Ce programme », not under « Appareil ». Q1 does not touch it. Left
unanswered, #75 closes while the thing that motivated it is untouched.

**Option A - Leave it where it is, and say so**
- What it means: deletion already takes two steps — `setPendingDelete`, then a
  « Supprimer ce programme ? » confirmation — and `removeProgram` refuses to
  delete the last remaining program (covered by `test/program-list.test.js`).
- Implications: none.
- Pros: the guard is a dialog, which is a stronger protection than distance in
  a navigation tree. And the delete belongs beside the cycle list it acts on:
  moving it would mean choosing a program in one screen and deleting it in
  another.
- Cons: the issue's premise stays formally unaddressed.

**Option B - Move it to Réglages with the rest of the destructive actions**
- What it means: the cycle list keeps activation; deletion moves.
- Implications: the program list would have to be duplicated in Réglages, or
  the delete would act on a name shown out of context.
- Pros: one screen holds everything that can lose data.
- Cons: separates an action from its object, which is the same ergonomic
  mistake this issue is trying to fix, in the other direction.

**Recommendation.** **A, recorded in the issue rather than dropped.** The
premise is half right: the destructive thing that *is* badly placed is the
import, and Q1 moves it. The delete is already guarded by the stronger of the
two available protections.

**Simon's decision.** _Delegated on 2026-09-25 → **A**._

---

## Q4 - What closes with #75, and what becomes a follow-up?

**Question.** The review of 2026-09-25 proposes four lots. Q1 is lot 2. If #75
absorbs lots 3 (the tab lands on the active program) and 4 (the single anchored
reference page), it stops being a decision and becomes an epic — and nothing
ships until all of it does.

**Option A - #75 = the tab list + the ⚙ move; lots 1, 3, 4 become their own issues**
- What it means: this brief, plus the code for Q1 and Q2, closes #75. Its
  acceptance criterion ("a decision recorded, with the resulting tab list") is
  met with: **two tabs, Semaine and Plan, plus a ⚙ that is not a tab.**
- Implications: #78 is unblocked — its door is a line in the Plan index, not a
  bar slot, which is what its own brief recommends. Lot 1 (`Block` gains a
  heading form and a list form) depends on nothing and can go in parallel.
- Pros: each lot has its own value and its own revert.
- Cons: the tab keeps the name « Plan » for now, so the review's headline
  proposal is only visible in pieces.

**Option B - #75 carries the whole parcours**
- What it means: rename, landing page, reference page, contextual links, all
  at once.
- Implications: touches `plan.js`, `PlanViews.jsx` and the whole Plan branch of
  `App.jsx` in one change.
- Pros: the intended shape is seen in one go.
- Cons: one revert for four independent ideas, and the decision the issue
  actually asks for is held hostage by the largest of them.

**Recommendation.** **A.** Lot 2 is the only lot that *needs* a decision; the
others need a design, and they are easier to judge on screen once this one is
in.

**Simon's decision.** _Delegated on 2026-09-25 → **A**._

---

## How to apply

- **Q1 + Q2** → implemented in this delivery (level B per `.claude/WORKFLOW.md`:
  Q1 no — no stored journal reads differently; Q2 no — `prog12_screen` gains a
  value it already validates and rejects safely; Q3 no; Q4 yes, it touches
  navigation).
- **Q3** → a note in #75 when it closes, not a code change.
- **Q4** → #75 closes as "decided: two tabs + ⚙". Open follow-ups for lot 1
  (`Block`: heading and list), lot 3 (the tab lands on the active program) and
  lot 4 (single reference page + contextual links). Relabel #78 off
  `priority: later` and write "a line in the Plan index" into its Expected
  section, replacing the assumption of a third tab.
