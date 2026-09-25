# Decisions - Exercises tab: browse the registry and open any exercise sheet (#78)

Source: spec.md
Scope: product / requirement choices only. The sibling `decisions.md` does not
exist yet — it will hold the implementation round once `/design-tech 78` has run,
and anything below that turns out to be a code-shape choice is sent there rather
than answered here.
Status: awaiting Simon's answers

---

## What was found before answering

**The #75 brief exists, on an unpushed branch, and it is half wrong.** `git show
docs/75-plan-tab-decision:docs/features/75-plan-tab-three-jobs/decisions-spec.md`
holds the brief abandoned on 2026-09-25. Two of its factual claims do not hold
against `dev`:

- It counts the Plan index at **six lines** (méthode 3 / programme 2 / appareil
  1). Running `buildPlan(DEFAULT_DEFINITION)` gives five sections — Structure,
  Volume, Progression, Décharge, Plan de repli — and no "Cardio et mobilité" (the
  bundled program has no `cardioPlan`). With the two screen-owned entries added
  at [App.jsx:1130](src/App.jsx#L1130) the index is **seven lines: méthode 3, ce
  programme 3, appareil 1**.
- It claims a Plan-index door would get #78's reload criterion for free because
  "`planTopic` is already part of the screen state". It is **not**:
  [App.jsx:269-275](src/App.jsx#L269) says so explicitly and gives the reason —
  `planTopic` is deliberately outside `nav`, and a reload reopens the Plan index.

The *direction* of its recommendation survives both corrections (one index line
out of seven is an even weaker case for a Réglages tab than one out of six), so
Q1 below builds on it rather than restarting it. But the second correction
changes the answer's shape: **the door and the screen identity are two separate
things**, and treating them as one is what made the old brief's option A look
cheaper than it was.

---

## Q1 - Where is the door to the catalogue?

**Question.** The spec assumes a third bottom-bar entry. The bar is a
`grid-cols-2` with Semaine and Plan ([App.jsx:1720](src/App.jsx#L1720)); #41
reduced it to two on purpose. #75 was supposed to settle this and was abandoned,
so #78 has to answer it for itself. Unanswered, #78 stays `priority: later` and
the whole "User-facing behaviour" section of the spec is unbuilt.

Note for both options: the list is **its own `screen` value in
[screen-state.js:26](src/screen-state.js#L26) either way**. That is what carries
the reload criterion, and it is independent of where the door sits — the old
brief conflated the two.

**Option A - A third bottom-bar tab, "Exercices"**
- What it means: `grid-cols-2` becomes `grid-cols-3`, one more button beside
  Semaine and Plan, `SCREENS` gains `"exercices"`.
- Implications: three 130 px tabs on a 390 px screen — comfortably above the
  44 px target. No change to `planTopics` or `PlanIndex`. If a Réglages tab is
  ever wanted (#75's option a, #79's rest-timer sound), the bar is then at four,
  which the review's U1 says outright does not fit.
- Pros: one tap from anywhere. A catalogue is a browsing activity, and browsing
  two taps deep behind a tab named "Plan" is where the "what does this exercise
  actually look like over time" impulse dies.
- Cons: a permanently visible slot for a screen consulted occasionally — the
  in-session substitution path already has its own picker, so the tab is for
  curiosity and planning, not for training. It also spends the last slot the bar
  has.

**Option B - A line in the Plan index, under "La méthode"**
- What it means: one more entry in `planTopics`, whose tap sets the new screen
  (not a `planTopic`), so back from a sheet and a reload both land on the list.
- Implications: one object in the `planTopics` array, one `onOpen` branch. The
  group already exists at [PlanViews.jsx:62](src/PlanViews.jsx#L62); no new
  group, no `grid-cols-3`, and `PlanIndex` needs no change. The line gets a
  `meta` like every other — "76 exercices · 11 groupes musculaires" is the kind
  of measured subtitle #62 built the index for.
- Pros: the registry is **bundled, closed reference data** — that is the exact
  line #25/#26 drew and that `PLAN_GROUPS` already names. A catalogue of
  exercises is the same *nature* as "Règles de progression": material you
  consult, never today's training. Plan is the drawer for precisely that, and
  this keeps the bar free for whatever earns it later.
- Cons: two taps to browse. And "La méthode" currently holds three *rules*; a
  catalogue among them is a slightly loose fit — a fourth group « Le catalogue »
  is one line in `PLAN_GROUPS` if that grates.

**Recommendation.** **B.** The argument I would not lead with is the bar being a
`grid-cols-2`: that is one className, trivially reversible, and a reason of that
size should not decide a screen's home. The one that survives is what the screen
*is* — bundled reference material, the same kind of thing as every other Plan
line, and unlike Semaine it never answers "what do I do now". Reversible in the
cheap direction: if it turns out to be opened constantly, promoting it to a bar
slot is removing one `planTopics` entry and adding one button, whereas demoting a
tab nobody taps is the awkward direction. Deciding this also answers #75's
acceptance criterion ("a decision recorded, with the resulting tab list": two
tabs, Semaine and Plan).

**Simon's decision.** _(left blank for Simon)_

---

## Q2 - Do the list's filters survive a reload, or only the trip to a sheet?

**Question.** Criterion 4 of the spec requires the search text and facets to be
intact when coming back from a sheet. Whether they also survive a reload is a
separate promise. `prog12_screen` today carries two or three strings and
validates them against the active program and the registry
([screen-state.js:26](src/screen-state.js#L26)). If this is left open, the
implementation will pick by accident.

**Option A - Back-only: filters are screen state, a reload resets them**
- What it means: the filters live in React state, lifted so they survive the
  sheet round-trip. `prog12_screen` keeps carrying only `screen`, `sessionId`,
  `exerciseId`.
- Implications: nothing added to `screen-state.js`. Exactly the treatment
  `planTopic` already gets, for the reason written at
  [App.jsx:269](src/App.jsx#L269) — a reload reopening an index is the right
  default.
- Pros: no new validation. An index that reopens unfiltered is what an index is
  expected to do; a reload landing on a list filtered three ways by a decision
  made an hour ago reads as a broken registry ("where did my exercises go").
- Cons: on iOS the web view is recycled whenever the app backgrounds
  ([screen-state.js](src/screen-state.js) header) — so "reload" happens more
  often than a deliberate refresh, and the filters go with it.

**Option B - Persist the filters in `prog12_screen` alongside the screen**
- What it means: three more fields, validated on read against `MUSCLE_GROUPS`,
  `PATTERNS`, `EQUIPMENT` ([exercise-filter.js:96](src/exercise-filter.js#L96)).
- Implications: `readScreen`/`writeScreen`/`resolveScreen` gain a third kind of
  subject — the module's header states it knows neither a session nor a program
  and only checks what it is handed, so the vocabularies would have to be
  injected like `exerciseIds` already is. Three more test branches.
- Pros: the iOS recycling case keeps a narrowed list.
- Cons: real cost in the one module deliberately kept ignorant, for a state
  nobody asked to keep. A stale filter is also the kind of state that looks like
  a bug rather than a memory.

**Recommendation.** **A.** The cost sits in the module whose whole design is not
knowing what it stores, and the benefit is keeping a transient choice. If the
iOS recycling case turns out to bite in practice, B is an additive change to one
module with no stored-journal consequence — MINOR then as now.

**Simon's decision.** _(left blank for Simon)_

---

## Q3 - Is the catalogue reachable before a program exists?

**Question.** `Welcome` returns early for every screen except `generateur` and
`editeur` ([App.jsx:1091](src/App.jsx#L1091)), so the bottom bar does not exist
until a program is saved. Browsing the registry while deciding what to train is
arguably when it is most useful. Unanswered, the answer defaults to "no" by
accident rather than by choice.

**Option A - No: the catalogue lives behind the app proper, like everything else**
- What it means: nothing added to the `welcome` exception list.
- Implications: none at all. Note that under **Q1-B this is automatic** — Plan
  itself is unreachable before a program, so a Plan line cannot be reachable
  either, and the two answers stop being independent.
- Pros: Welcome has one job — get a program into the journal — and four `Route`
  doors already compete for that tap. A fifth door to a reference screen is the
  one that does not advance it.
- Cons: someone weighing "which program do I want" cannot look at what the app
  actually knows how to execute.

**Option B - Yes: a door on Welcome, with back returning to Welcome**
- What it means: `"exercices"` joins the `screen !== "generateur" && screen !==
  "editeur"` exception, plus a fifth `Route` in `Welcome.jsx` and new copy for
  it.
- Implications: the list screen must render with no bottom bar and therefore
  needs its own back control — the one affordance the tab version does not have,
  so the screen grows a second mode. Contradicts Q1-B directly.
- Pros: the registry is the most concrete thing the app can show a newcomer.
- Cons: a second layout for one screen, to serve a moment that happens once.

**Recommendation.** **A.** The catalogue answers "what could I do", and Welcome
is not yet asking that — the closed registry is the same 76 entries whichever
program is chosen, so nothing about the choice depends on browsing it first.
Fully reversible, and cheap to revisit if the first-run screen is ever reworked.

**Simon's decision.** _(left blank for Simon)_

---

## Q4 - Do the four facet-less entries need a door through the facets?

**Question.** pallof, sideplank, abwheel and carry
([registry.js:219](src/registry.js#L219)) carry no `pattern` and no `equipement`,
so no facet combination surfaces them; only name search reaches them
([exercise-filter.js](src/exercise-filter.js) header). The spec asked whether a
browse screen can live with that.

Checking the screen changes the premise: with nothing selected, the list renders
**all 76 entries sorted by name**, so the four are visible on open and reachable
by scrolling. The gap only appears once a facet is set — and a narrowed list not
containing them is then correct, not broken.

**Option A - Leave it. The default list is the door**
- What it means: no change to `exercise-filter.js`.
- Implications: none. The spec's criterion 2 (reachable by name) already holds,
  and the browse screen adds "reachable by scrolling" for free.
- Pros: `matchesFacets` ([exercise-filter.js:60](src/exercise-filter.js#L60))
  keeps reading nothing but #25's real selection fields, which is the rule that
  makes these four reappear in the facets by themselves the day #25 gives them a
  pattern.
- Cons: someone who filters by habit before scrolling may never see them.

**Option B - Give "Mouvement" a "Gainage et portés" value**
- What it means: a synthetic facet value matching entries with no `pattern`.
- Implications: a special case in `matchesFacets`, and `facetValues` must stop
  deriving viability purely from `filterExercises` over `VOCAB`
  ([exercise-filter.js:98](src/exercise-filter.js#L98)). The vocabulary would no
  longer be defined only by the registry — the invariant the module's header
  states twice. It also pre-empts #25's unsettled anti-movement taxonomy with a
  label chosen in a list screen.
- Pros: every entry reachable without typing, under any browsing habit.
- Cons: the filter module starts holding a rule the registry does not, which is
  the one thing its header forbids.

**Recommendation.** **A.** The label already exists in the picker's row subtitle
for exactly these four, so they announce what they are once seen; what is
missing is only a facet path, and inventing a pattern value here is #25's
decision taken in the wrong file. If #25 ever assigns them a pattern, the facets
pick them up with no change to any of this.

**Simon's decision.** _(left blank for Simon)_

---

## How to apply

Once Simon fills in each "Simon's decision":

- **Q1** → rewrite the spec's "User-facing behaviour" opening (tab vs Plan index
  line) and criterion 7 (which bar entry highlights). Record the same answer on
  issue #75 and close it as decided — its acceptance criterion is a recorded
  decision with the resulting tab list — and drop `priority: later` from #78.
- **Q2** → fold into the spec's criterion 4 as an explicit "and a reload resets
  them" (or not), so `/design-tech` is not left guessing where the state lives.
- **Q3** → one sentence in the spec's Edge cases, replacing the pointer to this
  question. If Q1 = B, this is decided by Q1.
- **Q4** → one sentence in Scope ("Out:"), and nothing else — A changes no code.
- All four answered, the spec's "## Open questions" ends as "None", and
  `/design-tech 78` can run. Storage level is unaffected by every answer above:
  still **MINOR**.
