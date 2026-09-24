# Decisions - The Plan tab does three jobs (#75)

Source: GitHub issue #75 (no spec.md — the issue states the problem and both
options itself, and a full spec for a two-option layout question would be
ceremony)
Scope: product / requirement choices only. There is no sibling `decisions.md`:
nothing here is an implementation choice, and if Q1 lands on a move, the
implementation questions belong to the follow-up issue.
Status: awaiting Simon's answers

---

## What the index actually holds today

The issue describes three jobs of roughly equal weight. The code says
otherwise. `planTopics` (`App.jsx:1089`) is built from `buildPlan()`
(`plan.js`) plus two screen-owned entries, and `PlanViews.jsx:63` labels the
three groups. Run against the bundled program, the index holds **six lines**:

| Group | Lines | What they are |
|---|---:|---|
| `methode` — « La méthode » | 3 | Structure des 12 semaines, Règles de progression, Décharge |
| `programme` — « Ce programme » | 2 | Cardio et mobilité, Programme |
| `appareil` — « Appareil » | **1** | Données : sauvegarde et restauration |

Two facts follow, and they drive every question below.

**The device is one line out of six, not a third of the tab.** Everything the
issue lists under it — export, import, backups, persistence state — lives
behind that single `donnees` entry (`App.jsx:1578`).

**The destructive action is not in that group.** Deleting a cycle is
`setPendingDelete` → `removeProgram` at `App.jsx:1522-1542`, rendered under
`planPage.id === "programme"` — the **« Ce programme »** group. So moving
« Appareil » into a Réglages tab would leave "read a training rule" and "delete
a cycle" behind exactly the same tab as today. Option (a) as written in the
issue does not solve the problem the issue opens with.

---

## Q1 - Does « Appareil » leave the Plan tab?

**Question.** The issue proposes a third tab, *Réglages*, to host the device
group and future preferences (e.g. the rest-timer sound from #79). #41 reduced
the bottom bar to two tabs on purpose, and the bar is a `grid-cols-2`
(`App.jsx:1671`). If this is left unanswered, #78 (Exercises tab) cannot start
— it is blocked on this issue by its own "do not start before #75 is settled".

**Option A - Move « Appareil » out into a third tab, *Réglages***
- What it means: the `donnees` entry leaves `planTopics`, `SCREENS`
  (`screen-state.js:26`) gains `"reglages"`, the bar becomes `grid-cols-3`.
- Implications: `resolveScreen()` and the persisted screen state gain a value.
  A screen state written by this version and read by an older build is safe —
  `readScreen()` rejects an unknown `screen` and falls back to `HOME`. The
  real cost is the bar: at three tabs, #78 would push it to four.
- Pros: settings stop sitting next to training content; there is somewhere
  obvious to put the rest-timer sound and any future preference.
- Cons: a whole permanently visible tab for one index line and one future
  preference. It does not move the destructive action, which is the problem
  the issue actually names. It spends the bar slot #78 wants.

**Option B - Keep two tabs; Plan stays the drawer for what is not today's training**
- What it means: nothing moves. The three group headings keep doing the
  separating, which is what #62's drill-in index was built to do.
- Implications: no code change, no new screen value, no compatibility concern.
  #78 then has to answer the bar question on its own terms (see Q2).
- Pros: the bar stays at two, which #41 chose deliberately and #62's index made
  workable — the groups already tell the reader which job a line belongs to
  before they tap it.
- Cons: "Appareil" remains one tap from a training rule. Preferences arriving
  later (rest-timer sound) would land in the same drawer.

**Recommendation.** **B.** The premise that the tab carries three jobs of equal
weight does not survive contact with the index: one is three lines, one is two,
one is a single line. A permanent tab for one line is a poor trade — and it
would buy none of the safety the issue asks for, since deleting a cycle stays
under « Ce programme » either way. Fully reversible: if preferences do
accumulate, the move is the same work then as now, and better informed.

**Simon's decision.** _(left blank for Simon)_

---

## Q2 - If the bar stays at two, how does the Exercises tab (#78) reach the user?

**Question.** #78 needs the 73-entry registry browsable. It assumed a third
bottom-bar slot, which Q1 declines. `ExerciseSheet` already renders without a
session — `resolveScreen()` handles a sheet with no session
(`screen-state.js`), and the component's own header says so — so the screen is
not the problem, only its door. Unanswered, #78 stays blocked whatever Q1 says.

**Option A - A line in the Plan index, in its own group**
- What it means: a fourth group (« Le catalogue ») or an entry under « La
  méthode », opening the list screen through `planTopic` like every other Plan
  page.
- Implications: one entry in `planTopics`, one branch in the `screen === "plan"`
  render. No change to `SCREENS`, none to the bar, none to #62's drill-in.
  Reload behaviour comes free — `planTopic` is already part of the screen
  state, which is #78's third acceptance criterion.
- Pros: the cheapest possible door; reuses the index the app already has for
  "everything that is not today's training".
- Cons: browsing exercises is a browsing activity, and it sits two taps deep
  behind a tab named Plan.

**Option B - An entry point on the Semaine screen**
- What it means: a header action on Semaine, or a link beside the session
  screen's picker.
- Implications: touches the screen #41 deliberately made the entry point; a
  catalogue competes with today's session for the same attention.
- Pros: one tap from where training happens.
- Cons: Semaine answers "what do I do now". A catalogue is the opposite of
  that, and that single-question focus was #41's whole argument.

**Option C - Take the third bar slot after all (reverses Q1 toward A)**
- What it means: Exercices becomes the third tab instead of Réglages.
- Implications: `SCREENS` and `grid-cols-3` as in Q1-A, but spent on the
  catalogue rather than on settings.
- Pros: if one thing earns a permanent slot, a 73-entry catalogue consulted
  while choosing a substitution is a better candidate than one index line of
  backups.
- Cons: still a third tab, for a screen consulted occasionally rather than
  daily.

**Recommendation.** **A.** It costs one index entry and no new screen concept,
and it can be measured: if the catalogue turns out to be opened often,
promoting it to a bar slot later is a small change, whereas removing a tab
nobody uses is the awkward direction. It also keeps Q1's answer honest — the
bar stays at two because nothing has yet earned the third slot, not because
three is forbidden.

**Simon's decision.** _(left blank for Simon)_

---

## Q3 - Where does the destructive action go?

**Question.** The sentence that opens the issue — "reading a training rule and
deleting a cycle have no business behind the same tab: one is done calmly, the
other is destructive" — is about `removeProgram` (`App.jsx:1522`), which lives
under « Ce programme », not under « Appareil ». Neither option in the issue
touches it. Left unanswered, #75 can be closed while the thing that motivated
it is untouched.

**Option A - Leave it, and consider the existing guard sufficient**
- What it means: deletion already takes two steps — `setPendingDelete`, then a
  « Supprimer ce programme ? » confirmation (`App.jsx:1537-1542`) — and
  `removeProgram` refuses to delete the last remaining program.
- Implications: none.
- Pros: the guard is real and already covered by `program-list` tests; a
  mis-tap cannot delete a cycle.
- Cons: the issue's own premise stays formally unaddressed.

**Option B - Separate it visually within the page**
- What it means: the delete affordance moves to the foot of the « Programme »
  page, under a rule, away from the activation and creation actions it sits
  beside in the cycle list today.
- Implications: markup only, inside the `planPage.id === "programme"` branch.
  No state, no stored data, no test to rewrite.
- Pros: addresses the real complaint for a few lines, without spending a tab.
- Cons: a layout tweak where the issue asked an architecture question — which
  may read as dodging.

**Recommendation.** **A, stated explicitly in the issue rather than dropped.**
The two-step confirmation plus "never delete the last program" is the
protection that matters; distance in the navigation tree is a weaker guard than
a dialog, and the app already has the stronger one. If this is accepted, #75
closes as "decided: two tabs", with the destructiveness sentence answered
instead of quietly abandoned.

**Simon's decision.** _(left blank for Simon)_

---

## How to apply

Once Simon fills in each "Simon's decision":

- **Q1** → record the answer in issue #75 and close it as decided; its
  acceptance criterion is "a decision recorded, with the resulting tab list".
  If the answer is A, open the follow-up issue for the move, as the issue
  requires.
- **Q2** → unblocks #78: relabel it off `priority: later` and write the chosen
  door into its "Expected" section, replacing the assumption of a third tab.
- **Q3** → either a note in #75 (option A) or a small `fix:` issue (option B).
