# Design - Extract the Plan tab content (#4)

Written on the spec's recommended answers (`decisions-spec.md` Q1/Q2/Q3/Q4 =
A/A/A/A): new module at `src/plan.js`, typed-block content model, `phaseOf()`
notes split out into the plan module, the four `todayLine` cardio phrases sourced
from `program.js`. If Simon changes an answer, revisit **Files touched** and
**Sequencing** as noted in `decisions-spec.md` "How to apply".

## Summary

Create `src/plan.js` holding the Plan tab's editorial content as a typed-block
tree (`PLAN`), the intro line (`PLAN_INTRO`), and the five phase notes
(`PHASE_NOTES`) lifted out of `phaseOf()`. Add a ~25-line `<PlanContent>`
renderer inside `src/App.jsx` that maps `PLAN` through the existing `Section`
component. `phaseOf()` in `src/progression.js` stops returning `note`. The four
weekday cardio phrases in `todayLine` move to a `CARDIO_DAY_NOTES` map in
`src/program.js`, next to the cardio data #3 put there. All strings and table
rows move **verbatim**; the rendered output is byte-identical. Spec:
[spec.md](spec.md).

## Files touched

- **`src/plan.js`** *(new)*
  - Header comment: what the module is, that it is display-only editorial content
    with no import, consumed by `App.jsx`'s `<PlanContent>`.
  - `export const PLAN_INTRO` - the string at `src/App.jsx:459`.
  - `export const PLAN` - array of nine section objects
    `{ id, title, open?, blocks: [...] }`, blocks verbatim from
    `src/App.jsx:460-524` (see Approach for the block shapes and the section
    list).
  - `export const PHASE_NOTES` - `{ calib, b1, deload, b2, bilan }`, the five
    `note:` strings verbatim from `src/progression.js:24-28`.
- **`src/program.js`**
  - Append `export const CARDIO_DAY_NOTES` after `MOB_DAYS` (line 164): a map
    keyed by weekday index (`0`=dimanche … `6`=samedi) holding the four cardio
    phrases from `src/App.jsx:329` (`2`, `3`, `4`, `0`; other days absent).
  - Header comment: add one line documenting `CARDIO_DAY_NOTES`; drop the "la
    prose de l'onglet Plan … restent à sortir dans #4" clause from lines 7-10
    (now done).
- **`src/progression.js`**
  - `phaseOf()` (lines 23-28): remove `note:` from all five branches. It returns
    `{ id, label, rir }`.
  - Header comment lines 9-10 ("Les notes éditoriales de phaseOf() voyagent ici
    temporairement …"): delete - the relocation is done.
- **`src/App.jsx`**
  - Import line 4: add `CARDIO_DAY_NOTES` to the `./program.js` destructuring.
  - New import: `import { PLAN, PLAN_INTRO, PHASE_NOTES } from "./plan.js";`
  - Add `function PlanContent()` and `function Block({ block })` near
    `CardioView` (end of file) - see Approach.
  - `tab === "plan"` block (lines 457-535): replace the intro `<p>` and the nine
    hand-written `<Section>`s (lines 459-524) with
    `<p …>{PLAN_INTRO}</p>` + `<PlanContent />`. Keep the "Données : sauvegarde
    et restauration" `<Section>` (lines 525-533) exactly as is.
  - `todayLine` (line 329): replace the inline weekday ternary chain for `extra`
    with `CARDIO_DAY_NOTES[weekday] || ""`.
  - `phase.note` reads at line 380 and line 412: `PHASE_NOTES[phase.id]`.

No change to `test/progression.test.js`, `test/schema.test.js`, `src/schema.js`,
`src/main.jsx`, `netlify.toml`, `package.json`.

## Approach

**Block vocabulary** (smallest set covering the four shapes in the spec):

```
PLAN_INTRO = "Référence du programme. Les modifications se font dans le chat, le fichier est régénéré."

PLAN = [
  { id: "structure", title: "Structure des 12 semaines", open: true, blocks: [
      { t: "table", variant: "weeks", rows: [
          ["S1", "Calibration, 2–3 RIR"],
          ["S2–S6", "Bloc 1, 1 RIR, double progression"],
          ["S7", "Décharge (volume −50 %, charges −15 %, 3–4 RIR) et calibration des variantes du bloc 2"],
          ["S8–S11", "Bloc 2, 1 RIR"],
          ["S12", "Bloc 2, dernière série AMRAP sur les exercices clés, mesures, re-baseline"],
      ] },
      { t: "p", text: "Ancres conservées sur les deux blocs : développé couché, squat, hip thrust. …" },
  ] },
  { id: "volume", title: "Volume par semaine, et où il se fait", blocks: [
      { t: "table", variant: "volume", rows: [
          ["Delt latéraux", "5", "Haut A 2 + Haut C 3"],
          /* … 12 rows verbatim from src/App.jsx:474-485 … */
      ] },
      { t: "p", text: "Une « série dure » = une série de travail menée à 1 RIR (ou à l'échec). …" },
  ] },
  { id: "progression", title: "Règles de progression", blocks: [ { t: "p", text: "…" }, /* ×4 */ ] },
  { id: "deload",      title: "Décharge : déclencheurs et recette", blocks: [ { t: "p", text: "… sommeil < 6 h …" }, { t: "p", text: "…" } ] },
  { id: "fallback",    title: "Plan de repli (séances manquées)", blocks: [ /* 4× p */ ] },
  { id: "cardio",      title: "Cardio et mobilité", blocks: [ /* 3× p */ ] },
  { id: "nutrition",   title: "Nutrition", blocks: [ /* 6× p, incl. "… gain > 0,4 kg/sem …" */ ] },
  { id: "startloads",  title: "Charges de départ (S1)", blocks: [ { t: "p", text: "Développé couché 72,5 kg ; squat 105 kg …" } ] },
]
```

- `<` and `>` are stored as literal characters (not `&lt;` / `&gt;`); React
  escapes them on render, so output matches `src/App.jsx:500` / `:516`.
- `open` is present only on `structure`; elsewhere it is absent and `Section`'s
  `open: o0 = false` default applies.

**Renderer** (in `src/App.jsx`, sibling of `CardioView`):

```
function Block({ block }) {
  if (block.t === "p") return <p>{block.text}</p>;
  if (block.t === "table") {
    if (block.variant === "weeks")
      return (
        <table className="w-full text-sm"><tbody>
          {block.rows.map(([a, b]) => (
            <tr key={a} className="border-t border-slate-700">
              <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap align-top">{a}</td>
              <td className="py-1.5">{b}</td>
            </tr>
          ))}
        </tbody></table>
      );
    // variant === "volume"
    return (
      <table className="w-full text-sm"><tbody>
        {block.rows.map(([g, n, o]) => (
          <tr key={g} className="border-t border-slate-700">
            <td className="py-1.5 pr-2">{g}</td>
            <td className="py-1.5 pr-2 text-amber-400 text-right">{n}</td>
            <td className="py-1.5 text-slate-400">{o}</td>
          </tr>
        ))}
      </tbody></table>
    );
  }
  return null;
}

function PlanContent() {
  return PLAN.map((s) => (
    <Section key={s.id} title={s.title} open={s.open}>
      {s.blocks.map((b, i) => <Block key={i} block={b} />)}
    </Section>
  ));
}
```

The `<td>` / `<tr>` / `<table>` class strings are copied character-for-character
from `src/App.jsx:461-490`. `Section` already wraps children in
`text-sm text-slate-300 leading-relaxed space-y-2` (line 57), so the paragraphs
keep their spacing with no per-block class.

**`CARDIO_DAY_NOTES`** in `src/program.js`:

```
export const CARDIO_DAY_NOTES = {
  0: "rameur Z2 + mobilité",   // dimanche
  2: " puis mobilité",          // mardi
  3: " puis rameur Z2",         // mercredi
  4: "rameur intervalles + mobilité", // jeudi
};
```

`todayLine` line 329 becomes `const extra = CARDIO_DAY_NOTES[weekday] || "";` -
the leading spaces inside the Wed/Tue strings are preserved so the assembled
sentence is unchanged.

**`PHASE_NOTES`** keys are exactly the `id` values `phaseOf()` returns
(`calib`, `b1`, `deload`, `b2`, `bilan`). `App.jsx` reads `PHASE_NOTES[phase.id]`
at the two display sites; `phase.rir` / `phase.label` are untouched.

## Sequencing

1. **`refactor(plan): extract the Plan tab content into src/plan.js (#4)`**
   - create `src/plan.js` (`PLAN_INTRO`, `PLAN`, `PHASE_NOTES`);
   - add `<Block>` / `<PlanContent>` to `src/App.jsx`, rewire the `tab === "plan"`
     block and the two `phase.note` sites, add the `./plan.js` import;
   - remove `note:` from `phaseOf()` in `src/progression.js` and its header
     caveat; trim the `src/program.js` header clause about the Plan prose.
   - App builds and renders identically. **Safe to merge alone.**
2. **`refactor(plan): source the today-line cardio phrases from program data (#4)`**
   - add `CARDIO_DAY_NOTES` to `src/program.js` (+ header line);
   - replace the `extra` ternary chain in `todayLine` with the lookup.
   - Small, independent, also safe alone.

Two steps because they are two concerns (Plan-tab content vs the Séance
today-line) and step 2 is the optional tail of #3's handoff; both are `refactor:`
and neither mixes with test or feature work (CONTRIBUTING). They can also ship as
one commit if Simon prefers - nothing forces the split.

## Tests

- **Unit:** none required - verbatim relocation, no logic change. The #2 suite
  (`test/progression.test.js`) still imports `program.js` / `progression.js` and
  exercises `planned()`; a broken export or a changed `phaseOf()` shape surfaces
  there. Both test files' assertions stay unmodified.
- **Optional guard (recommended, ~10 lines):** a new `test/plan.test.js` that
  asserts `Object.keys(PHASE_NOTES).sort()` equals
  `["b1","b2","bilan","calib","deload"]` and that every `PLAN` section has a
  non-empty `title` and `blocks`. Catches a future phase-id rename silently
  blanking the Séance sub-header, and a malformed block. If added, it is its own
  step `test(plan): guard the plan data shape (#4)` - test work, separate commit.
- **Automated regression:** `npm test` green with both existing files unmodified;
  `npm run build` succeeds (esbuild resolves `./plan.js`).
- **Manual click-through** (`npm run dev`):
  - Plan tab: open each of the nine sections; compare every paragraph and table
    cell to production. "Structure des 12 semaines" is expanded on arrival, the
    rest collapsed. Volume table: count column amber and right-aligned. Deload
    and Nutrition paragraphs: `<` and `>` render literally.
  - "Données : sauvegarde et restauration": still present, buttons and textarea
    still work.
  - Séance tab, weeks 1 / 3 / 7 / 9 / 12: the sub-header phase note
    (`src/App.jsx:380`) matches production for each phase.
  - Semaine tab, same weeks: the lead line (`src/App.jsx:412`) matches.
  - Séance tab "Aujourd'hui …" line on a Tuesday / Wednesday / Thursday / Sunday
    (change the device clock or the `weekday` locally): the cardio tail is
    unchanged, spacing included.
  - `git diff` review: every moved string and row is character-identical to the
    deleted one.

## Risks & tradeoffs

- **Regression surface: low-moderate.** Higher than #3 because `<Block>` is new
  code, not a pure move. The three sharp edges: (a) the volume table's
  `text-amber-400 text-right` count cell - the `variant: "volume"` branch must
  reproduce it exactly; (b) `<` / `>` stored as entities instead of characters
  would double-escape - store the character; (c) `PHASE_NOTES` is coupled to
  `phaseOf()`'s `id` strings by convention only - the optional guard test closes
  this.
- **`phaseOf()` shape change.** `note` is dropped from the return object. No test
  asserts on it (verified against `test/progression.test.js` line by line); the
  only readers are `src/App.jsx:380` and `:412`, both updated in step 1.
- **`src/plan.js` path** (spec Q1 / `decisions-spec.md` A). The epic's
  `src/data/*` wording is left unreconciled; the alternative - creating
  `src/data/` and moving `program.js` / `progression.js` / `schema.js` - is churn
  across both test files for no behaviour gain and belongs in its own rename
  ticket. Reversible by a later `git mv`.
- **Renderer lives in `App.jsx`, not its own file.** Consistent with `CardioView`
  and the small components already there; a `src/PlanContent.jsx` is not worth a
  new file for ~25 lines. #6 may promote it when the plan becomes loadable.
- **Storage / journal:** untouched - matches the spec's "no release bump of its
  own"; the 1.3.0 minor ships with a later batch (#1 decisions.md Q3).
- **Rejected alternative:** Option B from `decisions-spec.md` Q2 (strings-only,
  JSX skeleton stays). Smaller diff but the Plan tab structure would still live
  in `App.jsx`, missing the issue's intent and leaving the rest of the cost to
  #6.

## Out of scope / follow-ups

- **#5:** "Charges de départ (S1)" and the nutrition figures become values
  composed from `src/profil.js`; the `startloads` and `nutrition` blocks in
  `PLAN` gain interpolation (a `{ t: "p", tpl: (p) => … }` block variant, or
  render-time substitution). #4 ships them as plain `t: "p"` text.
- **`bilanText()` key list** (`src/App.jsx:289`) and the Plan "exos clés" wording
  from `SLOTS[id].key` - separate issue.
- **`todayLine` sentence assembly** still happens in `App.jsx` after step 2 (only
  the phrases move). Folding the whole day-summary line into a helper is a
  future tidy, not #4.
- **`src/data/` directory convention** - decide as a standalone rename ticket if
  still wanted (see Risks).

## Open questions

None at design level. The four spec questions are settled by `decisions-spec.md`
(recommended A/A/A/A); two implementation choices - `CARDIO_DAY_NOTES` living in
`src/program.js` keyed by weekday index, and the renderer living inside
`src/App.jsx` - are settled in this document (Approach / Risks). If spec Q1
resolves to Option B/C, add the `git mv` + import edits to **Files touched**; if
Q2 → B, drop the renderer and enlarge the `App.jsx` diff; if Q3 → B, keep
`phaseOf()` whole and drop the `PHASE_NOTES` work; if Q4 → B, drop step 2 and
open a follow-up issue.
