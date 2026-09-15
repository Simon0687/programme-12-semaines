# Design review triage - `dev` at ca0b3fe (2026-09-14)

Scope: the Claude Design review versioned at
[docs/external_audit/Claude Design/2026-09-14-revue-4-ecrans.md](../external_audit/Claude%20Design/2026-09-14-revue-4-ecrans.md)
- six artboards covering Semaine, Séance, Fiche exo and Plan, with a stated bug
list and twenty-three constat/correctif pairs.

Every factual claim below was checked against the code at this commit by reading
the rendering path, not by reading the screenshots. `dev` and `main` are
identical at ca0b3fe; the last code commit is 4dad16d (#43, 14:23). `npm test`
is green at 430/430.

Per [docs/external_audit/README.md](../external_audit/README.md) a review is
advisory. This document is the verification pass.

---

## 1. Method: what the review actually looked at

Its own `github.md` records a single repository read on 2026-09-14T20:25:14Z
covering `plan.js`, the `design/` mockups and `input.css` - and describes its bug
list as "3 incohérences de données repérées **dans les captures**". The screen
map names `App.jsx`, `ExerciseSheet.jsx`, `display.js` and `cardio.js`, but
nothing indicates they were opened.

That single fact explains the shape of the results, and it is the reason to keep
this document rather than the review itself:

- **Where it read source, it is right.** Every Plan-content observation holds,
  and the 1e/1f rewrites of `plan.js` prose are the strongest part of the
  document.
- **Where it read pixels, it is unreliable.** Six claims below are refuted by the
  rendering code, and four of those describe behaviour that #41 and #42 shipped
  earlier the same day - hours before the screenshots were taken, so this is not
  a staleness problem. The review simply could not see the state machine behind
  the pixels.

A second consequence: it judged the Plan from `plan.js`, which is the *content*,
and concluded the screen is a 5 000 px wall. The screen renders that content as
eight collapsed accordions. It measured the source, not the screen.

## 2. Refuted

**R1 - "Sommeil moyen (h) and Énergie (1–5) appear twice."** They are declared
once, at `src/App.jsx:898-899`, inside a section rendered once. No other
component emits those labels.

**R2 - "Sets are numbered S1, S2, S2, S3."** `src/App.jsx:187` renders `S{i + 1}`
over `Array.from({ length: sets })`. The sequence is strictly increasing by
construction, and this is the only set-number in the app. A stitching artefact in
an 11 206 px tall screenshot is the likely source; the truncated upload could not
be decoded past its first 350 px to confirm.

**R3 - "Every check is green, every field identical: the current set does not
exist visually."** Three states already exist and are applied to both the inputs
and the validate button, `src/App.jsx:184-199`: `done` (emerald), `isNext`
(amber border), pending (slate). This is what #42 shipped.

**R4 - "The 2:30 timer is a dead pill."** `validateRow` fires `onTimer` on every
set validation (`src/App.jsx:136-143`), the running timer renders as a 44 px band
with the countdown at 20 px and a stop button (`src/App.jsx:732-737`), and that
band sits inside a `sticky top-0` header (`src/App.jsx:727`), so it stays on
screen while scrolling. The review's own correctif - "it fires when a set is
validated and occupies a band" - describes the current build. Only the
*progress* rendering (a depleting bar rather than a number) is missing.

**R5 - "Plan: ~5 000 px, nine subjects, no landmark."** `PlanContent`
(`src/App.jsx:1049`) renders one `<Section>` per subject, and `Section`
(`src/App.jsx:69`) defaults to collapsed. `src/plan.js` declares eight sections
with `open: true` on `structure` alone (`src/plan.js:90`). Collapsed, the Plan
*is* the "sommaire de 8 lignes" the review proposes as its fix.

**R6 - "The bilan weighs 1 000 px below the fold."** It is a collapsed
`<Section>` too (`src/App.jsx:893`), showing its fill state in the title without
expanding. More importantly, #41 put it on the Semaine screen deliberately - the
comment at `src/App.jsx:888-890` states the rule: *le bilan est une chose de la
semaine, il vit donc dans la semaine*. Moving it to its own screen would undo a
documented decision, and the review had no way to know that decision existed.

## 3. Reformulated

**F1 - "Rameur Z2 dimanche is listed twice identically."** Not a duplicate.
`CARDIO_ITEMS` holds two distinct Z2 sessions, Wednesday and Sunday
(`src/cardio.js:40-42`), each with its own min/W/bpm fields. But `src/App.jsx:1074`
prints `cardio.z2` under both - the same 90-character prescription, word for
word. The observation is right, the diagnosis is wrong: the fix is to state the
Z2 prescription once, not to remove a session.

**F2 - "Amber and grey bars for 60/20/20: colour says good/less good instead of
share."** The condition is `m.dominant` (`src/ExerciseSheet.jsx:171`), so colour
encodes primary vs secondary muscle - legitimate information, not a value
judgement. The proposed remedy (one hue, three values) is still better *if* the
intent is to read shares; that is a product question, not a defect.

## 4. Confirmed

**C1 - The planned/entered gap is invisible.** The card shows `Prévu : {plan.text}`
(`src/App.jsx:168`) and seeds the weight field's placeholder from `plan.load`
(`src/App.jsx:193`), but nothing marks a value that departs from it. The
progression engine reads exactly those numbers. A deliberate jump and a typo look
identical. This is the highest-yield finding in the review, and the only one of
its three "bugs" that survives.

**C2 - The amber accent carries incompatible meanings.** 44 amber usages, 27 of
them outside `focus:ring`. `text-amber-400` currently means: the planned load
(`:168`), a load error with `role="alert"` (`:742`, `:934`, `:974`), a storage
warning (`:764`), the active tab (`:1015-1016`), "à remplir" (`:893`), and the
set counts in the volume table (`:1042`). An alert coloured like a data value
does not alert. The review framed this as style; it is functional.

**C3 - The chart axis re-frames onto the data.** `chartGeometry` calls
`niceScale(Math.min(...vals), Math.max(...vals))` (`src/display.js:236`) with no
minimum span. Two points at 69 and 71.3 give a 69-72 axis, so +2.3 kg fills the
frame. Confirmed. The proposed fix - a fixed 60-80 working range - is the weaker
half of the finding: a hard range breaks once the lifter leaves it, in week 12 or
in another exercise. A minimum span (a multiple of the progression increment, or
a percentage of the value) fixes the distortion without pinning the scale.

**C4 - Everything is expanded, and the primary action is at the end of the
scroll.** `session.ex` and `CORE` both map to a full `ExerciseCard` with no
collapsed state (`src/App.jsx:778-787`), and "Valider la séance" renders after
all of them (`:823`). With seven exercises the review's 2 500 px is the right
order of magnitude. Note the asymmetry the review missed: the header is sticky,
the action bar is not.

**C5 - Cardio fields are labelled by placeholder only.** `src/App.jsx:1079` sets
`placeholder={l}` with a matching `aria-label`. The visible label disappears on
first keystroke, so a filled row of three numbers no longer says which is watts
and which is bpm. Accessible to a screen reader, not to the eye.

## 5. What the review did not see

It proposes to move the bilan off the Semaine screen (1a.1) and to split the Plan
into sub-pages (1d.1) - both of which undo shipped decisions it had no access to
(#41 for the first, the accordion for the second). Reading `docs/features/` would
have cost it two of its four screen-level recommendations.

Conversely, it did not look at where its own principle bites hardest: C2 is a
correctness problem (alerts and data share a colour), and the review states it as
a taste preference about Nocturne.

## 6. On adopting Nocturne

Not recommended. The app's problems, as this triage confirms them, are hierarchy
(C4, C5), data honesty (C1, C3) and colour discipline (C2). None of the three is
a palette problem, and none is solved by swapping design systems - a Nocturne
port would reproduce the same walls of 14 px text in different hues, at the cost
of rewriting every class in `App.jsx` and `ExerciseSheet.jsx`.

Every confirmed finding above is implementable in the existing slate/amber
vocabulary.

## 7. Issue candidates

Not created - per `docs/external_audit/README.md`, Simon decides which of these
enter the tracker.

| # | Finding | Nature | Size |
|---|---|---|---|
| A1 | C1 - mark entered values that depart from the planned load | `feat` | small |
| A2 | F1 - state the Z2 prescription once, not per session | `fix` | small |
| B1 | C2 - take alerts out of the accent; one meaning per colour | `fix` | medium |
| B2 | C3 - minimum span on the chart scale | `fix` | small |
| B3 | C5 - persistent labels on the cardio fields | `fix` | small |
| B4 | 1c.4 / the review's typographic hierarchy, in slate/amber | `feat` | medium |
| C1 | C4 - one active exercise, and a fixed action bar | `feat` | large, needs `/spec` |

A1 and A2 are code-only. B1-B4 are design work inside the current vocabulary. C1
changes how a session is navigated and is a product decision, not a CSS change -
it goes through `/spec` → `/decide` before any code.

Refuted findings R1-R6 are recorded above so they are not reopened from the same
screenshots in three weeks.
