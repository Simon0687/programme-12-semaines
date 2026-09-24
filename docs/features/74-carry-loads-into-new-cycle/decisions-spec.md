# Decisions - Carry working loads into a new cycle (#74)

Source: spec.md
Scope: product / requirement choices only — including the method question Simon
raised on 2026-09-24 ("does this need a review of the tool's philosophy?").
Implementation choices will go in `decisions.md`, after `/design-tech 74`.
Status: decided by Simon on 2026-09-24 — Q1 A, Q2 D, Q3 A, Q4 A

## Q1 - What a new cycle remembers, and what calibration is for

**Question.** Today a cycle is an island: `history()` / `historyBefore()`
(`src/progression.js`) skip every slot outside the active program, and with no
`startingLoads` week 1 prescribes "Paliers". Carrying loads changes what week 1
*is*. The method text already anticipates both cases — `PHASE_NOTES.calib`
(`src/plan.js`): "Séries à 2–3 RIR pour **valider** les charges. Exercices sans
référence : paliers…" — and the legacy program ships six `startingLoads`
(`src/legacy-program.js`). So the question is not new to the method; it is
whether the *app* fills the reference itself. Unanswered, #74 and #77 stay
blocked.

**Option A - Continuity: the app carries, calibration validates**
- What it means: an exercise with history arrives in week 1 with a reference;
  calibration at 2–3 RIR confirms or corrects it. Exercises without history
  still ramp through "Paliers".
- Implications: `carryover.js` + editor pre-fill (spec); `planned()` untouched —
  it already returns `v.start` in week 1. Unblocks #77's "Créer le cycle suivant".
- Pros: uses calibration exactly as `PHASE_NOTES.calib` words it; matches the
  philosophy study's split — the app computes and remembers (level 1), the
  athlete decides (the value is shown, dated, editable).
- Cons: a stale or wrong reference is only caught in week 1, not avoided.

**Option B - Clean slate by design**
- What it means: every cycle re-discovers loads; the sheet (#17) remains the
  only place with the long view. Close #74 as not planned.
- Implications: nothing to build; #77 loses its main button.
- Pros: nothing new to trust; a fresh cycle is a clean experiment.
- Cons: contradicts the calibration note, and asks the athlete to guess what
  the app displays one tap away.

**Recommendation.** A. The method already treats calibration as validation when a
reference exists; B keeps a gap, not a principle. Reversible: carried values are
ordinary `startingLoads` in each new definition — stop pre-filling and nothing
stored changes meaning.

**Simon's decision.** A — continuity: the app carries, calibration validates.

## Q2 - Raw load, or adjusted to the new rep range and RIR

**Question.** The carried load was lifted at 1 RIR in its old range; week 1 asks
2–3 RIR, maybe in another range (`press` is 5–10, `incline` 8–12). The engine
deliberately never compares ranges (header of `src/exercise-history.js`).

**Option A - Raw last working load** (`workingSets()` on the last session not in
`SKIPPED_AS_BASE`)
- Implications: simplest `carryover.js`; the date and value are shown.
- Pros: an observed number, never a model; calibration absorbs the 1–2 RIR gap.
- Cons: moving from 4–8 to 8–12 carries a load too heavy for the new range.

**Option B - Converted through the 10RM estimate**
- What it means: `estimate10RM(w, r)` (`w × (30 + r) / 40`, already used by the
  sheet) → load for the new range's top, rounded to `incr`; only inside the
  credibility window `ESTIMATE_REPS` (3–12), raw otherwise.
- Pros: right order of magnitude across ranges.
- Cons: a model inside the engine's input — what the engine has refused so far;
  undefined for `bw` / `carry` (the sheet's own caveat).

**Option C - Raw when the range matches, blank otherwise**
- Pros: never wrong across ranges. Cons: most rotated exercises lose the benefit.

**Option D - Asymmetric: raw toward fewer reps, converted toward more** (added
2026-09-24 after Simon's hypertrophy → strength question)
- What it means: if the new range's top is at or below the old one, carry the
  raw load — it errs light, and the engine climbs (+5 % after calibration, then
  +`incr` per session at the top of the range). If the new range asks for more
  reps, convert through `estimate10RM` to the new range's top, never above the
  raw load, rounded to `incr`. `bw` / `carry` units: raw, as the sheet does.
- Example: 100 kg × 8 (4–8) → strength 2–5: 100 kg carried, ~10 % light, safe.
  115 kg × 4 (2–5) → 8–12: raw would be 20 %+ too heavy; converted ≈ 92,5 kg.
- Pros: the model is only ever used to *lower* a load, so its error is on the
  safe side; covers both directions of a program change.
- Cons: two rules instead of one; needs the source slot's rep range.

**Recommendation.** D (revised from A). Calibration exists to absorb a light error, and an
observed value is easier to trust and to correct than an estimate. Reversible:
B can be added later inside `carryover.js` without touching stored data.

**Simon's decision.** D — raw toward fewer reps, converted toward more.

## Q3 - « Partir du programme actif »: observed loads replace the copied ones?

**Question.** `draftFrom(definition)` (`src/program-editor.js`) copies the active
definition's `startingLoads` — its guesses from the *start* of that cycle.

**Option A - Observed replaces copied** where history exists.
- Pros: newer, real values. Cons: overrides a value someone typed on purpose.

**Option B - Fill empty fields only.**
- Pros: never overrides. Cons: for this door, the copied values are always
  older than the history, so the carry-over rarely shows.

**Recommendation.** A, with the "reporté · date" note so the replacement is
visible. Reversible per field by editing it.

**Simon's decision.** A — observed replaces copied, with the "reporté · date" note.

## Q4 - How old is too old

**Question.** `exerciseHistory()` reads every cycle; an exercise may not have
been done for a year.

**Option A - Carry anything, show the date.** Pros: no arbitrary threshold; the
athlete judges. Cons: a year-old load pre-filled without friction.

**Option B - Ignore history older than N months** (e.g. 6). Pros: avoids stale
references. Cons: an arbitrary constant, and a returning athlete gets "Paliers"
for loads the app knows.

**Recommendation.** A. The date is on screen and calibration catches the rest;
a threshold can be added later without data impact.

**Simon's decision.** A — carry anything, show the date.

## How to apply

Once Simon fills in each "Simon's decision", the answers fold back into
`spec.md`: resolved points move out of Open questions into the relevant section
(or a new "## Decisions" list), and Open questions ends as "None". Q1's answer
also earns a short section in
`docs/external_audit/functionnal audit/2026-09-12-etude-philosophie-produit.md`
— what a cycle remembers — since it is a method choice, not a screen detail.
