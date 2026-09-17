# Decisions - Surface the six assertions where a program is composed or loaded (#57)

Source: spec.md
Scope: product choices only - what is shown, where the user lands, what is stored.
Status: **answered 2026-09-17**, on the spot. Three recommendations validated as
written; Q4 came back simpler than the recommendation. The four answers are folded
back into `spec.md`, whose Open questions now reads "None".

---

## Q1 - Where the targets come from

**Question.** Ship with `no-declared-intent` shown as a plain finding and
assertions 1, 2 and 5 dormant, or give the editor a form to state frequency /
duration / level in this issue?

**Recommendation.** Ship dormant. That form is the engine's collection screen
(`decisions-moteur.md` Q4); built here it would be built without the engine that
consumes it, and the three silent assertions are already named on screen by the
module's own sentence.

**Simon's decision.** **Validated as written** (2026-09-17).

---

## Q2 - How much is shown

**Question.** A summary line with a count plus a collapsed disclosure of every
message, or the worst finding only?

**Recommendation.** Count plus disclosure. The messages are written to be pasted
whole into an AI conversation (#19); showing one of five destroys that, and a
collapsed list is as quiet as a single line.

**Simon's decision.** **Validated as written** (2026-09-17).

---

## Q3 - Dismissal

**Question.** Can a finding be dismissed, and does the dismissal survive a reload?

**Recommendation.** No dismissal in this issue. Collapsed by default is already
quiet, and nothing `assess()` produces is stored today.

**Simon's decision.** **Validated as written** (2026-09-17). This is what keeps
the issue MINOR with no new journal field.

---

## Q4 - Where the editor's save lands

**Question.** `saveDraft` ends on `goSemaine()`
([App.jsx:715](../../../src/App.jsx#L715)), so a user who saves never passes by
the Plan block. Land on Plan when there are findings and on Semaine otherwise, or
always Semaine with the count carried by the existing toast?

**Recommendation.** Land on Plan when there are findings.

**Simon's decision.** **Neither - always land on Plan** (2026-09-17): « on arrive
toujours dans le plan, si besoin de le modifier ». Simpler than the
recommendation and better: a program one has just composed is likelier to need
another pass than to be trained in the next minute, and an unconditional
navigation has no branch to reason about, no state where the same gesture ends on
two different screens. The advice block stops being something the app has to
deliver and becomes something the user walks past.
