# Design - Extract the user profile (#5)

Written on the spec's recommended answers (`decisions-spec.md` Q1/Q2/Q3/Q4 =
A/A/A/A): `src/profile.js`, `program.js` folds `STARTING_LOADS` back onto `V`,
cycle length stays hardcoded, only the live nutrition targets are composed,
`START_DATE` is an ISO string with a `startDate()` local-date helper. Depends on
#4 being merged (the `src/plan.js` block model must exist). If Simon changes an
answer, revisit **Files touched** and **Sequencing** per `decisions-spec.md`
"How to apply".

## Summary

Create `src/profile.js` holding every personal value: `START_DATE` + a
`startDate()` helper, `STARTING_LOADS` (six variant loads), and `PROFILE` (body
metrics and nutrition targets). `src/App.jsx` gets `START` from `startDate()`
instead of a literal. `src/program.js` drops the six `start:` keys from the `V`
literal and re-applies them from `STARTING_LOADS` in a fold loop, so `planned()`
and both test files still see `V[id].start` unchanged. `src/plan.js` composes the
"Charges de départ" and nutrition-target figures from `src/profile.js` with
template literals at module load - no renderer change. Cycle length stays the
constant `12`. Spec: [spec.md](spec.md).

## Files touched

- **`src/profile.js`** *(new)*
  - Header: what the module is (the single home for everything that changes cycle
    to cycle), that it imports nothing, and that #6 will feed it from a JSON
    file.
  - `export const START_DATE = "2026-09-07";`
  - `export const startDate = () => { const [y, m, d] = START_DATE.split("-").map(Number); return new Date(y, m - 1, d); };`
    - built from parts → **local** midnight, avoiding the `new Date("2026-09-07")`
      UTC trap.
  - `export const STARTING_LOADS = { dc: 72.5, incl_db: 30, squat: 105, ohp_db: 26, pullup: 0, pd_close: 90 };`
    - keys are variant ids, matching the `start:` keys removed from `V`.
  - `export const PROFILE = { bodyweightKg: 90, heightCm: 193, birthdate: "1987-06-18", maintenanceKcal: 3150, startKcal: 3400, macros: { p: 185, f: 85, c: 470 }, targetWeightKg: [92.5, 93.5] };`
    - `bodyweightKg` / `heightCm` / `birthdate` are included per the issue's field
      list; nothing displays them yet (the Mifflin/Katch derivation stays literal
      prose - Q3 Option A), so they are wired only for #6. Values supplied by
      Simon 2026-09-07 (90 kg, 193 cm, born 1987-06-18).
- **`src/program.js`**
  - Add `import { STARTING_LOADS } from "./profile.js";` at the top (with the
    existing imports - `program.js` currently imports nothing).
  - `V` literal: remove `start: 72.5` (`dc`), `start: 30` (`incl_db`),
    `start: 105` (`squat`), `start: 26` (`ohp_db`), `start: 0` (`pullup`),
    `start: 90` (`pd_close`). Leave every other field on those entries.
  - Immediately after the `V` literal, add:
    `for (const [vid, load] of Object.entries(STARTING_LOADS)) V[vid].start = load;`
    - plain assignment, **not** `if (load) …` - `pullup`'s `0` must be applied.
  - Header comment (lines 7-10): drop "les données personnelles (date de départ,
    charges `start`) dans #5" - now done.
- **`src/App.jsx`**
  - Line 12: `const START = new Date(2026, 8, 7);` →
    `import { startDate } from "./profile.js";` (with the other imports) +
    `const START = startDate();`.
  - Nothing else. `weekRange()` (line 33), `dayIdx` (line 148), `curWeek`
    (line 149), the "Le programme commence lundi …" line (line 326) all keep
    using `START`.
  - `KEY = "prog12_simon_v1"` (line 13) is **left as is** - journal identity is
    #6 (spec Out of scope).
- **`src/plan.js`** *(exists after #4)*
  - Add `import { PROFILE, STARTING_LOADS } from "./profile.js";` and two tiny
    local formatters (see Approach).
  - `startloads` section: its single `{ t: "p", text: "Développé couché 72,5 kg ; …" }`
    becomes a template literal reading `STARTING_LOADS`.
  - `nutrition` section: the first block (maintenance / start kcal / macros) and
    the third block's "Cible : 92,5-93,5 kg" become template literals reading
    `PROFILE`. The derivation numbers (1 916 / 2 071 / 2 000), the "3 650 / 3 200"
    branch and the meal-plan grams stay literal (Q3 Option A).

No change to `src/progression.js`, `test/progression.test.js`,
`test/schema.test.js`, `src/schema.js`, `src/main.jsx`, `netlify.toml`,
`package.json`.

## Approach

**`src/plan.js` composes, `<Block>` is untouched.** #4's renderer only handles
`{ t: "p" }` / `{ t: "table" }`. Rather than add a `tpl` block variant and thread
`PROFILE` through `App.jsx`, `src/plan.js` imports the profile and builds the
final strings when the module loads. `PLAN` still ships plain `t: "p"` blocks;
the Plan tab renderer, `App.jsx`, and #4's design all stay as they are.

```
// src/plan.js
import { PROFILE, STARTING_LOADS } from "./profile.js";

const kg = (n) => String(n).replace(".", ",");           // 72.5 -> "72,5", 105 -> "105"
const sp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); // 3150 -> "3 150"
```

- `sp()` must emit **the same space glyph the current prose uses**. Verify
  against `src/App.jsx:515` (`≈ 3 150 kcal`, `Mifflin 1 916`) - if that is a
  plain U+0020 or a U+00A0, match it. This is the sharpest verification point of
  the issue.

```
// startloads block text:
`Développé couché ${kg(STARTING_LOADS.dc)} kg ; squat ${kg(STARTING_LOADS.squat)} kg `
+ `(+5 kg en S2 si ≥ 3 RIR à 8 reps) ; développé épaules haltères ${kg(STARTING_LOADS.ohp_db)} kg par main ; `
+ `tirage vertical serré ${kg(STARTING_LOADS.pd_close)} kg ; tractions au poids du corps ; `
+ `développé incliné haltères ${kg(STARTING_LOADS.incl_db)} kg par main à confirmer. `
+ `Tout le reste en paliers : 50 → 75 → 100 % de la charge devinée, la première série dans la fourchette à 2–3 RIR devient la charge de travail. Hip thrust : paliers depuis 60 kg.`
```

- `pullup` (load `0`) is not interpolated - the sentence says "tractions au poids
  du corps" in words. "Hip thrust : paliers depuis 60 kg" stays literal
  (`hipthrust` has no `start:` and no `STARTING_LOADS` entry).

```
// nutrition block 1:
`Maintenance estimée ≈ ${sp(PROFILE.maintenanceKcal)} kcal (Mifflin 1 916 et Katch-McArdle 2 071 → base 2 000 ; × 1,4 hors sport ; + ~370 kcal/jour d'entraînement). `
+ `Départ : ${sp(PROFILE.startKcal)} kcal par jour, 7 jours sur 7. `
+ `Protéines ${PROFILE.macros.p} g, lipides ${PROFILE.macros.f} g, glucides ${PROFILE.macros.c} g. `
+ `Quatre repas à 40–50 g de protéines, glucides concentrés autour des séances.`

// nutrition block 3 tail:
`… Cible : ${kg(PROFILE.targetWeightKg[0])}–${kg(PROFILE.targetWeightKg[1])} kg fin S12.`
```

**`src/program.js` fold.** Module evaluation order: `program.js` imports
`profile.js` (evaluated first, no dependencies), builds `V`, runs the fold loop,
then exports. `progression.js` and `App.jsx` import `program.js` afterwards and
see `V` fully populated. `V.dc.start === 72.5`, `V.pullup.start === 0` at
runtime, so `test/progression.test.js:35` (`assert.equal(p.load, V.dc.start)`)
and line 200 (`p.load === 0`) pass unchanged.

**`startDate()`** returns a fresh `Date` each call; `App.jsx` calls it once into
the module-level `const START`, matching today's single evaluation.

## Sequencing

1. **`refactor(profile): add src/profile.js and source the start date from it (#5)`**
   - create `src/profile.js` with all exports (`START_DATE`, `startDate`,
     `STARTING_LOADS`, `PROFILE`);
   - `src/App.jsx`: replace the `START` literal with `startDate()`.
   - App builds and runs identically (calendar unchanged). **Safe to merge alone.**
2. **`refactor(profile): move the starting loads out of the exercise catalogue (#5)`**
   - `src/program.js`: remove the six `start:` keys, add the `./profile.js`
     import and the fold loop, trim the header line.
   - `npm test` green with assertions unmodified. **Safe to merge alone.**
3. **`refactor(plan): compose the starting-load and nutrition figures from the profile (#5)`**
   - `src/plan.js`: add the `./profile.js` import + `kg` / `sp` helpers; convert
     the `startloads` block and the two nutrition target blocks to template
     literals.
   - Plan tab renders byte-identical. **Safe to merge alone.**

Three commits because they are three concerns (the module + date wiring; the
catalogue change; the Plan composition) and each leaves the app working. All are
`refactor:`; none mixes with test or feature work (CONTRIBUTING). Steps 2 and 3
each depend only on step 1 (the module existing), not on each other. They may be
squashed to one or two commits if Simon prefers.

## Tests

- **Unit:** none required - relocation and string composition, no logic change.
  `test/progression.test.js` drives `planned()` across weeks 1-12 including the
  no-history and pull-up branches that read `V[id].start`; a broken fold surfaces
  there immediately. Both existing test files keep their assertions verbatim.
- **Optional guard (recommended, ~15 lines), own commit
  `test(profile): guard the fold and the date helper (#5)`:**
  - `Object.keys(STARTING_LOADS)` are all present in `V`, and after import
    `V.dc.start === 72.5` and `V.pullup.start === 0`;
  - `startDate()` returns a local date: `.getFullYear() === 2026`,
    `.getMonth() === 8`, `.getDate() === 7`, `.getHours() === 0`;
  - `PROFILE.macros` has `p` / `f` / `c` numbers and `targetWeightKg` is a
    two-number array.
- **Automated regression:** `npm test` green (both existing files unmodified);
  `npm run build` succeeds (esbuild resolves `./profile.js` from `App.jsx` and
  `program.js`).
- **Manual click-through** (`npm run dev`):
  - Change `START_DATE` to `"2026-09-14"`: every "Semaine N" header, the
    `weekRange()` label, the auto-selected current week and the "commence lundi"
    line move by 7 days. Revert.
  - Change `STARTING_LOADS.dc` to `75`: Séance tab S1 Développé couché "Prévu"
    shows "75 kg", and Plan → "Charges de départ (S1)" shows "Développé couché
    75 kg". Revert.
  - Plan → "Nutrition" and "Charges de départ": `git diff` the rendered text
    against production - maintenance, start kcal, macros, target weight, and the
    six loads are byte-identical, space glyphs included.
  - Séance tab first session of a fresh journal for squat / OHP / tractions /
    incline: "Prévu" loads match production ("105 kg", "26 kg / main", "Poids du
    corps", "30 kg / main").

## Risks & tradeoffs

- **Number formatting is the sharp edge.** The composed nutrition strings must
  reproduce the exact thousands-separator character in the current prose
  (`3 150`, `3 400`, and the untouched `1 916` / `2 071` must still match around
  the substitution). Mitigation: pick the `sp()` separator by copying the glyph
  out of `src/App.jsx:515`, and diff the rendered Plan text in the manual pass.
- **`pullup.start === 0`.** A fold written as `if (load) V[vid].start = load`
  would silently drop it and change the pull-up "Prévu" from "Poids du corps" to
  "Paliers". The loop must assign unconditionally. Called out in Approach and the
  guard test.
- **`program.js → profile.js` import** (Q1 Option A). The structure module now
  depends on the person module - backwards, but temporary: #6's loader composes
  program + profile and this import is removed then. Accepted to keep the pinned
  test suite and the engine untouched.
- **Timezone.** `startDate()` builds from parts; never `new Date(START_DATE)` /
  `Date.parse`, which are UTC and shift `dayIdx` by a day in `UTC+…` zones.
- **Cycle length stays `12`** (Q2 Option A). `src/profile.js` deliberately does
  **not** export `CYCLE_WEEKS`; the phase logic in `src/progression.js` assumes a
  12-week shape and #6 reworks it. Documented in the spec.
- **Unused `PROFILE` fields.** `bodyweightKg` / `heightCm` / `birthdate` are
  exported but not referenced in #5. Intentional (issue field list + #6
  groundwork); flagged so a reviewer does not treat them as dead code to delete.
- **Storage / journal:** untouched - matches the spec's "no release bump of its
  own"; the 1.4.0 minor ships with a later batch (#1 decisions.md Q3).
- **Rejected alternative:** Q1 Option B (engine reads `STARTING_LOADS`, `V` loses
  `start`). Cleaner dependency direction but edits the pinned
  `test/progression.test.js` and pushes profile awareness into the engine for a
  refactor issue.

## Out of scope / follow-ups

- **#6:** cycle length as data; the journal-identity decision
  (`prog12_<programId>` vs a program reference); loading program + profile from a
  JSON file, after which `src/program.js` stops importing `src/profile.js`.
- **Deeper nutrition modelling** (adjustment deltas, meal plan as structured
  rows) - only if that prose starts changing regularly (spec Q3).
- **`bilanText()` "vs target weight" line** - could read `PROFILE.targetWeightKg`
  if ever wanted; not now.
- **`KEY` still carries `simon`** - renamed or namespaced under #6.

## Open questions

None. The four spec questions are settled by `decisions-spec.md` (A/A/A/A). The
one implementation choice - composing the Plan figures inside `src/plan.js` at
load rather than adding a `tpl` block variant and threading `PROFILE` through
`App.jsx` - is settled here (Approach). Body values supplied by Simon
(90 kg / 193 cm / 1987-06-18).
