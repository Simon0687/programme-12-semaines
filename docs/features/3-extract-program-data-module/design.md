# Design - Extract the program into a data module (#3)

Written on the spec's recommended answers (`decisions-spec.md` Q1/Q2/Q3 = A/A/A):
keep `src/program.js`, extract all four constants, read the "no exercise name"
criterion against structured data + cues. If Simon changes an answer, revisit
**Files touched** and **Sequencing**.

## Summary

Move `WARM`, `cardioPlan()`, `CARDIO_ITEMS` and `MOB_DAYS` verbatim from
`src/App.jsx` into the existing `src/program.js`, add them to `App.jsx`'s import
line, and expand the module header into a field-by-field reference for every
exported structure. One `refactor:` commit, no behaviour change, `#2` test file
untouched. Spec: [spec.md](spec.md).

## Files touched

- **`src/program.js`**
  - Header comment (lines 1-9): replace the 3-line note with a ~35-line reference
    block - the `V` fields, the slot concept and `b1`/`b2` mapping, `SLOTS` /
    `SESSIONS` / `CORE` / `WARM` shapes, and the `cardioPlan()` return shape.
  - Append two sections after `CORE` (currently ends line 95):
    - `/* ---------- Échauffement ---------- */` -> `export const WARM = { ... }`
      (verbatim from `App.jsx:37-40`).
    - `/* ---------- Cardio et mobilité ---------- */` -> `export const cardioPlan
      = (w) => { ... }` (verbatim from `App.jsx:42-51`), then
      `export const CARDIO_ITEMS = [ ... ]` and
      `export const MOB_DAYS = [ ... ]` (verbatim from `App.jsx:53-58`).
- **`src/App.jsx`**
  - Line 4: `import { V, SLOTS, SESSIONS, CORE } from "./program.js";` ->
    `import { V, SLOTS, SESSIONS, CORE, WARM, cardioPlan, CARDIO_ITEMS, MOB_DAYS } from "./program.js";`
  - Delete lines 37-58 (the four definitions and their two comment banners).
  - Nothing else. `WARM[session.warm]` (line 406), `cardioPlan(week)` (line 356),
    `CARDIO_ITEMS` (lines 310, 587), `MOB_DAYS` (line 614) now resolve to the
    imports.

No change to `src/progression.js` (it does not reference any of the four),
`test/progression.test.js`, `test/schema.test.js`, `netlify.toml`, `package.json`.

## Approach

**Verbatim move.** The four declarations are copied character-for-character; only
`const` becomes `export const`. `cardioPlan` stays an arrow function - it derives
the week's cardio prescription (`z2` minutes ramp, `intervals` block selection,
`mob` text) from the week number, which is program logic and belongs with the
program definition. No signature or return-shape change.

**Header reference block** (sketch of the content, not the final prose):

```
/* =========================================================
   Données du programme 12 semaines — Simon

   Source unique de la structure du programme. Aucun import React :
   chargeable par `node --test` (via progression.js) et par App.jsx.

   V[id]      catalogue d'exercices (variantes)
     name     libellé affiché
     incr     pas de charge pour la progression (kg). Absent => pas de
              charge suivie (sideplank, abwheel).
     start    charge de travail en S1 (kg). Absent => rampe "Paliers".
     perHand  charge par main (haltères) ; l'affichage ajoute "/ main".
     unit     "kg" (implicite) | "bw" poids du corps +lest éventuel |
              "time" tenue en secondes | "reps" reps au poids du corps |
              "carry" port lesté chronométré
     side     exécuté par côté ; l'affichage ajoute "par côté"
     cue      consigne technique

   SLOTS[id]  créneau d'une séance ; une variante s'y attache par bloc
     reps     [min, max] — reps, ou secondes si la variante est time/carry
     rest     repos en secondes
     key      exercice clé (AMRAP en S12, repris dans le Bilan)
     fail     dernière série à l'échec autorisée dès S3 (sauf S7)
     b1       id de variante, semaines 1–6   (voir blockOf() dans progression.js)
     b2       id de variante, semaines 7–12

   SESSIONS[] séances, dans l'ordre
     id name sub — identifiant, titre, groupes
     day      jour conseillé (1 = lundi … 6 = samedi)
     warm     clé WARM ("upper" | "lower")
     ex       [[slotId, nSéries], …]
     core     clé CORE

   CORE[id]   bloc d'abdos : { label, ex: [[slotId, nSéries], …] }
   WARM[k]    protocole d'échauffement ("upper" | "lower") -> texte
   cardioPlan(w) -> { z2, intervals | null, mob }  (chaînes affichées)
   CARDIO_ITEMS[] lignes de la check-list cardio : { id, label, when }
                  id "int" = intervalles, masquée quand cardioPlan().intervals est null
   MOB_DAYS[]  libellés des 3 jours de mobilité (cases à cocher)
   ========================================================= */
```

**Import line.** `App.jsx` keeps one import from `./program.js`; the four names
are added to the existing destructuring. `progression.js` is not involved.

## Sequencing

1. **`refactor(program): move warm-up and cardio data into the data module (#3)`**
   - the header rewrite, the two appended sections in `src/program.js`, the import
     line change and the deletion in `src/App.jsx`, in one commit. The app builds
     and runs identically. **Safe to merge alone.**

One step: the move is small, atomic and only meaningful as a whole (deleting the
`App.jsx` definitions without adding the imports breaks the build). Splitting "add
docs" from "move data" would leave a commit whose only change is a comment.

## Tests

- **Unit:** none added. This is a verbatim relocation; the #2 suite
  (`test/progression.test.js`) already exercises the engine and imports
  `program.js`, so a broken export surfaces there.
- **Automated regression:** `npm test` must stay green **with both test files
  unmodified**. `npm run build` must succeed (esbuild resolves the new imports).
- **Manual click-through** (dev build, `npm run dev`):
  - Séance -> open *Échauffement* on an upper session (e.g. Haut A) and a lower
    session (Bas A): text matches the current app word-for-word.
  - Séance -> *Cardio et mobilité*: for a normal block week (e.g. S3) check the
    Z2 line, the intervals line ("4 × 4 min…"), the mobility text, the three
    `MOB_DAYS` checkboxes.
  - Switch to S7: the intervals row shows "Pas d'intervalles cette semaine…";
    Z2 shows 30 min. Switch to S1: Z2 carries the recalibration sentence.
  - Semaine tab: the compact `CardioView` renders the same.
  - `git diff` review: the moved blocks are character-identical to the deleted
    ones.

## Risks & tradeoffs

- **Regression surface ~0.** A verbatim move of four declarations that no other
  code path transforms. The only realistic failure is a hand-edit slip during
  cut/paste, caught by the `git diff` review and the manual text check.
- **`src/program.js` keeps its path** (spec Q1 / `decisions-spec.md` A). The
  epic's `src/data/*` wording (#4-#6) is left unreconciled; the alternative -
  `git mv` now - would edit `test/progression.test.js`'s import and break the
  "#2 tests unmodified" criterion for no behaviour gain. Reversible by a later
  rename ticket covering all data modules at once.
- **`cardioPlan()` is logic inside a "data" module.** Accepted: it is a pure
  function of the week number that produces the program's cardio prescription,
  and it has no home closer to the program definition. `#6` (load a program from
  a file) will have to decide whether this stays code or becomes data; noted
  there, not here.
- **Storage / journal:** untouched - matches the spec's "no release bump of its
  own"; 1.2.0 ships with a later batch (#1 decisions.md Q3).
- **Rejected alternative:** splitting the commit into "move" + "document". The
  documentation is only useful attached to the moved data, and a comment-only
  commit adds ceremony to a one-step change.

## Out of scope / follow-ups

- **#4:** the Plan-tab prose (12-week table, volume table, progression rules,
  deload recipe, fallback plan, cardio/nutrition sections, "Charges de départ"),
  and relocating the `phaseOf()` editorial notes out of `src/progression.js`.
- **Directory convention** for the data modules (`src/*` vs `src/data/*`) -
  decide when #4 starts, apply to all modules together.
- **`bilanText()` key list** (`src/App.jsx:312`) and the Plan "exos clés" wording
  could derive from `SLOTS[id].key` - a behaviour-risk transform, its own issue.
- **`todayLine` cardio strings** (`src/App.jsx:352`) duplicate cardio structure -
  fold into #4.

## Open questions

None at design level. One implementation choice - one commit vs a move/docs split
- is settled in this document (one commit; see Sequencing). If spec Q1 resolves to
Option B/C, this design needs the `git mv` and three import-site edits added to
**Files touched** and **Sequencing**, and the "tests unmodified" wording relaxed.
