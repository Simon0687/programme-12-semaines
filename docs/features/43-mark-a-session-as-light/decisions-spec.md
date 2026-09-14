# Decisions - Mark a session as deliberately light (#43)

Source: spec.md
Scope: product / requirement choices only. The implementation round — where the
comparison lives, how the panel is wired into `validate()`, how `kind` reaches
`planned()` — goes to `decisions.md`, written after `/design-tech 43`.
Status: settled 2026-09-14 — Q1 A, Q2 C, both as recommended.

---

## Q1 - Does re-validating an already-validated session ask again?

**Question.** `validate()` (`src/App.jsx:429-443`) rewrites `kind` on every tap:
`writeLog(..., { ex, done: true, kind: computeKind(week) })`. On a session that is
already validated the button reads "Mettre à jour la séance"
(`src/App.jsx:754`), so fixing a typo in the notes and tapping it would erase an
`"allege"` flag without a word. Unanswered, the feature ships with a hole that
only appears days later, as a suggestion that quietly dropped by 20 kg.

**Option A - Ask on the first validation only; an update preserves the stored kind**
- What it means: the panel appears when `!log.done`. On an update, `kind` is
  carried over from the existing record instead of being recomputed. To change
  the answer, the user taps "Rouvrir" and validates again.
- Implications: `validate()` writes `cur.kind ?? computeKind(week)` on an update
  and the panel's choice on a first validation. `reopen()` (`src/App.jsx:445`)
  needs no change — it sets `done: false`, so the next validation is a first one
  again and the question comes back. No new state, no new affordance.
- Pros: the decision is asked once, about the session as it was performed. The way
  to change it is already on screen — a validated session renders "Validée le … ·
  **Rouvrir**" (`src/App.jsx:732`), one tap away, visible without scrolling.
- Cons: "Rouvrir" was built for correcting a mistyped set; it now also carries
  "I answered that question wrong".

**Option B - Ask again on every update while the load is still below**
- What it means: any tap on "Mettre à jour la séance" re-runs the comparison and
  re-shows the panel.
- Implications: the condition is the comparison alone, with no `log.done` term —
  marginally simpler in `validate()`.
- Pros: the answer is always changeable in place, with no detour through
  "Rouvrir".
- Cons: a one-off decision is re-asked every time the user edits a note or a RIR,
  which is how a rare and important question becomes wallpaper — and the second
  answer can flip the first by reflex, silently.

**Option C - Ask again only when the sets changed**
- What it means: compare `ex` before and after within `validate()` and re-ask only
  on a real change.
- Implications: a third rule to specify and test, and "changed" needs a
  definition — a corrected RIR is a change that cannot alter the working load.
- Pros: no noise on a notes-only update.
- Cons: the most code for the least difference from A; the user cannot predict
  when the question returns.

**Recommendation.** **A.** The panel asks about the session as performed, so it
belongs to the moment the session is closed; and the path to change the answer is
not hidden, it is the "Rouvrir" link already rendered on every validated session.
Reversible — moving to B later is deleting one condition.

**Simon's decision.** 2026-09-14: accepted as recommended.

---

## Q2 - Compared against what: the previous session, the suggestion, or a margin?

**Question.** The panel fires on "the working load went down", which needs a
reference. The spec says the previous session's working load. The alternative is
`planned()`'s suggestion, and a third is to require the drop to be worth more than
the exercise's own increment. Unanswered, the panel either misses the case it
exists for or fires so often it stops being read.

**Option A - Against `planned()`'s suggestion**
- What it means: fire whenever the working load is below what the app prescribed.
- Implications: reads `plan.load`, already computed per exercise in
  `ExerciseCard` (`src/App.jsx:107`).
- Pros: catches every session that fell short of the plan.
- Cons: fires on a gym with no 1,25 kg plates — 100 kg where 102,5 was asked,
  every session, for ever. That is not a light session, it is rounding, and the
  panel would become something to dismiss.

**Option B - Against the previous session's working load, any drop**
- What it means: fire when this session's working load is strictly below the last
  validated session's, per exercise. Both sides come from `workingSets` (#31).
- Implications: no threshold to invent; the comparison is a fact the engine
  already computes on both sides.
- Pros: never fires for want of small plates — the previous session's load is
  what the user actually did, not what was asked.
- Cons: fires on a single-increment dip (102,5 → 100) that self-corrects next
  session anyway, since 8/8/8 at 100 answers 102,5.

**Option C - Against the previous session, by more than one increment**
- What it means: fire when the drop exceeds `v.incr` — the exercise's own
  increment from the registry, not an invented number. 105 → 100 on squat
  (incr 5) stays quiet; 105 → 95 asks. `incr` is defined for every loaded
  exercise: the only two entries without one are `sideplank` and `abwheel`, whose
  units never reach the load path.
- Implications: one more term in the same comparison, using a value already in
  `EXERCISES`.
- Pros: the panel only appears when something actually happened. A rare question
  that is always worth reading stays worth reading — which is the whole reason
  there is no permanent control.
- Cons: a deliberate one-increment back-off is not offered the choice, and
  becomes the new reference silently. Recoverable: the next normal session climbs
  straight back.

**Recommendation.** **C.** The feature exists for "j'ai levé le pied", not for
"il me manquait 2,5 kg", and the cost of over-firing is not clutter but a panel
the user learns to dismiss. Using `v.incr` keeps it in the app's own vocabulary
rather than inventing a percentage. Reversible in one comparison operator.

**Simon's decision.** 2026-09-14: accepted as recommended.

---

## How to apply

Once Simon fills in each "Simon's decision", the answers fold back into
`spec.md`: the resolved points move into **User-facing behaviour** and
**Acceptance criteria** — in particular the first criterion, which currently says
"below the previous session's" with no margin — and **Open questions** ends as
"None". Then `/design-tech 43`.
