# Design - Carry working loads into a new cycle (#74)

## Summary

A pure module, `src/carryover.js`, answers one question: "what should this
exercise start at in a program whose slot asks for this rep range?", reading every
cycle of the journal. The editor asks it when a draft opens and whenever an
exercise enters the draft, and writes the answer into the draft's ordinary
`startingLoads` — the engine (`planned()`) is untouched and already returns
`v.start` in week 1. The one idea: carry **at creation**, as a value, never as a
reference read later. [spec](spec.md) · [decisions](decisions-spec.md)

## Files touched

- **`src/carryover.js`** (new) — `carriedLoad()`; imports `exerciseHistory`,
  `estimate10RM`, `chartMode` (`exercise-history.js`), `workingSets`, `roundTo`
  (`progression.js`), `findLog` (`schema.js`), `EXERCISES` (`registry.js`).
- **`src/program-editor.js`** — `targetRange(program, vid)`,
  `withCarriedLoads(draft, carry)`, `carryNewlyReferenced(prev, next, carry)`;
  `sealed` re-used so an opened, pre-filled draft is not dirty.
- **`src/ProgramEditor.jsx`** — new optional prop `carry`; `apply` runs
  `carryNewlyReferenced`; the "Charges de départ" rows show the provenance note.
- **`src/App.jsx`** — `openEditor` (≈ line 1192) pre-fills through
  `withCarriedLoads`; `<ProgramEditor carry=…>` (≈ line 1548).
- **`src/exercise-history.js`** — header comment only: stale since #86 (says
  `history()` throws and points to #38).
- **`test/carryover.test.js`** (new), **`test/program-editor.test.js`**.
- **`docs/external_audit/functionnal audit/2026-09-12-etude-philosophie-produit.md`**
  — short section "Ce que retient un cycle" (decision Q1).

## Approach

```js
// carryover.js
// → null | { load, date, fromLoad, fromReps, converted }
export function carriedLoad(journal, vid, targetRange /* [mn, mx] | null */)
```

1. `exerciseHistory(journal, vid)`, newest first; skip `kind` in
   `{deload, allege, test}` — the rule `SKIPPED_AS_BASE` applies in `planned()`
   (not exported there; mirrored with a comment pointing at it).
2. **Source range.** From that entry's cycle: `journal.programs[programId]
   .definition.program`, the session whose `id === entry.slot`, its slot ids
   (`ex` then `CORE[core].ex`), the first `slotId` where `log.sub?.[slotId] ===
   vid` (substitution, #55) or `SLOTS[slotId].b1/b2 === vid`; `reps` of that
   slot. The log comes from `findLog(journal.programs[programId].logs, date, slot)`. Unknown → `null`.
3. `workingSets(sets, mn, mx)` on the source range (or the entry's own min/max
   reps when unknown) → `load`; `fromReps` = best reps at that load.
4. **Asymmetric rule (Q2 = D).** Convert only when all hold: `chartMode(unit) ===
   "estimate"` (kg units; `bw` / `carry` / no-load excluded), both ranges known,
   `targetRange[1] > sourceRange[1]`. Then
   `conv = roundTo(estimate10RM(load, fromReps) * 40 / (30 + targetRange[1]), incr)`,
   `load = Math.min(conv, load)`, `converted = conv < fromLoad`.
5. No-load units (`time`, `reps`) → `null`: nothing to carry.

```js
// program-editor.js
targetRange(program, vid)            // reps of the first slot with b1|b2 === vid
withCarriedLoads(draft, carry)       // on open: every referenced vid with a carry
                                     // → startingLoads[vid] = load (replaces, Q3);
                                     // draft.carried[vid] = info; then sealed()
carryNewlyReferenced(prev, next, carry) // during editing: only vids referenced in
                                     // next and not in prev, and with no value yet
```

`carry` is `(vid, range) => carriedLoad(journal, vid, range)`, built in `App.jsx`
so the editor module never sees the journal. `draft.carried` is draft-only: not in
`snapshot()`, not in `toDefinition()`. "Only newly referenced" is what keeps a
field the athlete cleared from being refilled on the next edit.

**Note under the field** (`ProgramEditor.jsx`), shown while the value still equals
the carried one: `reporté · 12 sept.` or `converti de 115 kg × 4 · 12 sept.`
(`dateShort()` from `display.js`, `fmt()` for the decimal comma).

## Sequencing

1. `docs(carryover): fold decisions into the spec, and what a cycle remembers (#74)`
   — spec, decisions, philosophy section, `exercise-history.js` header. Safe alone.
2. `feat(carryover): the last working load of an exercise, for a new range (#74)`
   — `carryover.js` + tests. Unused yet; safe alone.
3. `feat(editor): pre-fill starting loads carried from past cycles (#74)` —
   `program-editor.js`, `ProgramEditor.jsx`, `App.jsx` + tests. The visible step.

## Tests

- **Unit (`node --test`), `carryover.js`:** raw carry; deload / allégée / test
  skipped; mixed loads → `workingSets` choice; substituted exercise found through
  `log.sub`; conversion only toward more reps (115 × 4, 2–5 → 8–12 = 92,5 kg),
  never above raw; `bw` raw; `time` → `null`; unknown source definition → raw;
  empty history → `null`; malformed `ex` (string) ignored.
- **Unit, `program-editor.js`:** open replaces copied values and seals (not
  dirty); `toDefinition` carries no `carried` key; a newly added exercise is
  filled; a cleared field is not refilled by an unrelated edit.
- **Manual (browser):** log a session, create a new cycle from "Générer mon
  programme", see the note, save, open week 1 — planned load instead of
  "Paliers".

## Risks & tradeoffs

- **Source range lookup** fails on a legacy cycle with `definition: null` →
  treated as unknown → raw carry. Safe direction only when the new range is
  lower; acceptable, and visible through the date.
- **Rejected:** widening `history()` (the engine must stay narrow); storing a
  reference to the old cycle instead of the value (§2.1, and the `definition:
  null` lesson in the philosophy study §6.5).
- **Storage:** nothing new is persisted — `startingLoads` already exists, and
  `carried` never leaves the draft. **MINOR**, as the spec set; no migration.
- **Cost:** one `exerciseHistory()` walk per referenced exercise at open —
  ~20 exercises over a few hundred logs, well under the N1 measurements of the
  2026-09-24 review.

## Out of scope / follow-ups

- #77 (end-of-cycle screen) will call the same `withCarriedLoads` from its
  "Créer le cycle suivant" button.
- Programs loaded from a file keep their own `startingLoads`; no carry there.

## Open questions

None.
