# Decisions - Journal shape is unvalidated on load and on paste (#32)

Source: spec.md
Scope: product / requirement choices only - how strict the app is with stored and
pasted data, and what the user sees when it refuses. Implementation choices
(where the validator lives, how it is factored) belong to the design round and
will be recorded in a sibling `decisions.md` after `/design-tech 32`.
Status: answered 2026-09-12 - all five settled, folded back into spec.md

---

## Q1 - The last read-time fallback: `definition.program`

**Question.** `buildProgram()` resolves the program as
`(definition && definition.program) || DEFAULT_DEFINITION.program`
([src/program.js](../../../src/program.js)). A stored definition with **no
`program` field** therefore borrows the program the app currently ships. This is
the exact trap #26 closed for `definition: null`, still alive one level down, and
it contradicts invariant 2.1 of [docs/ARCHITECTURE.md](../../ARCHITECTURE.md)
("Store the value, not the reference"). Verified: a definition without `program`
now renders `upperA, lowerA, upperB, lowerB` - the neutral bundle - not the
program its logs were performed under. Such definitions are real: between #6 and
#25, `parseProgramImport` *rejected* any file carrying `program`, so every
program file loaded in that window produced exactly this shape. Left unanswered,
#32 ships a validator that guarantees shape while leaving meaning free to drift.

**Option A - Require `program` on every stored definition**
- What it means: the shape validator rejects a stored definition without
  `program`; `buildProgram`'s `||` fallback is removed.
- Implications: a journal loaded from a pre-#25 file stops loading and shows the
  load error - its history is intact in `localStorage` but unreachable in the
  app. Needs a migration to pin the then-current program, which makes this
  **MAJOR**, not PATCH, and pulls #32 out of the 2.0.0 blocker slot it occupies.
- Pros: closes the invariant for good; no stored value depends on what ships.
- Cons: the migration has no honest answer - the app cannot know *which* program
  a pre-#25 definition meant; it can only guess `LEGACY_DEFINITION`.

**Option B - Keep the fallback, forbid it from drifting**
- What it means: a definition without `program` still resolves, but to
  `LEGACY_DEFINITION` (a fixed historical value that never changes) instead of
  `DEFAULT_DEFINITION` (whatever ships today). #32 validates shape only.
- Implications: one-line change in `buildProgram`, no migration, stays PATCH.
  Pre-#25 journals keep loading and keep their original meaning.
- Pros: fixes the drift without touching a byte of stored data; reversible.
- Cons: a fallback survives, so ARCHITECTURE.md 2.1 gets a documented exception
  rather than a clean rule.

**Option C - Out of scope for #32**
- What it means: note it, open a follow-up issue, ship #32 on shape only.
- Implications: the neutral bundle keeps re-interpreting pre-#25 journals until
  that issue is done.
- Pros: keeps #32 small and on the 2.0.0 critical path.
- Cons: the bug found *while* writing the validator is left in the code the
  validator is meant to protect.

**Recommendation.** **B.** It removes the drift (the only part that silently
corrupts meaning) at the cost of one line, keeps #32 a PATCH on the release path,
and leaves A available later as a deliberate migration rather than a side effect.
Fully reversible: A remains reachable from B, never the other way round.

**Simon's decision.** **B** - the fallback resolves to `LEGACY_DEFINITION`. #32 stays PATCH; option A stays reachable later as a deliberate migration (2026-09-12).

---

## Q2 - How severe is the stored side?

**Question.** `loadJournal` currently accepts any definition that is an object
([src/storage.js:64](../../../src/storage.js)). How hard should it check one?
Verified: both shipped programs, `LEGACY_DEFINITION` and `DEFAULT_DEFINITION` all
pass the full `parseProgramImport` unchanged, so the strict bar rejects nothing
the app itself writes. The risk is asymmetric - a false rejection costs a user
access to real training history, a false acceptance costs one crash and a reload.

**Option A - Anti-crash only**
- What it means: reject only what would throw or render a degenerate bundle -
  `programs` not an object, entry not an object, `definition` absent, `logs` /
  `cardio` / `checkin` not objects.
- Implications: `src/storage.js` gains an envelope check; the skeletal definition
  `{ id: "p1" }` used by today's `storage.test.js` fixtures keeps loading, so no
  existing test has to be rewritten.
- Pros: smallest possible behaviour change; near-zero risk of locking anyone out.
- Cons: a definition that is structurally wrong but non-crashing still installs,
  and #33's `NaN` dates stay reachable from the stored side.

**Option B - Same bar as a pasted file, for the active program only**
- What it means: the **active** program's definition goes through the full
  `validateProgram`; inactive cycles get the envelope check only.
- Implications: the two fixtures in `test/storage.test.js` that use
  `{ id: "p1", startDate: "..." }` must become real definitions. That rewrite is
  the signal that severity changed, not a nuisance.
- Pros: one bar for all three doors; a program cannot be worse-formed because it
  arrived stored rather than pasted.
- Cons: a definition that is merely *unusual* (a future field, a hand-edited
  cycle) now blocks the boot instead of degrading.

**Recommendation.** **B**, gated on the compatibility tests (v1-v4) being written
and green first, per the spec's ordering. The asymmetry argument is real but it
cuts the other way once the escape hatch works: after #32 a rejected journal
leaves the app usable and the Données panel reachable, so a false rejection is
recoverable by pasting an export - a false acceptance since #26 is a program
executing against someone else's definition.

**Simon's decision.** **B** - full `validateProgram` on the active program's definition, envelope check on the rest, gated on the v1-v4 compatibility tests landing first (2026-09-12).

---

## Q3 - Whole-journal rejection, or per-entry skip?

**Question.** A journal holds several cycles (#6) and many log rows. If one
*inactive* cycle or one log row is malformed, does the whole journal fail? Note
that `history()` already skips an unusable row silently
([src/progression.js:40](../../../src/progression.js)), and that the cycle
selector lets the user switch to any stored program
([src/App.jsx:577](../../../src/App.jsx)) - so a malformed inactive cycle is one
click away from being the active one.

**Option A - All or nothing**
- What it means: any malformed entry anywhere rejects the entire journal.
- Implications: one bad row in a two-year history blocks access to all of it; the
  user's only route is export, hand-edit, paste back.
- Pros: trivial to specify and to test; no silent data loss.
- Cons: wildly disproportionate; converts a cosmetic anomaly into total lockout.

**Option B - Envelope is fatal, entries are filtered**
- What it means: the envelope (`programs`, each entry's `definition` / `logs` /
  `cardio` / `checkin` being objects) is fatal; an individual malformed **log
  row** is dropped from the loaded journal; a malformed **inactive cycle** is
  kept but cannot be activated - the selector disables it.
- Implications: `loadJournal` returns `ok: true` with a count of dropped rows;
  the app needs a way to say so (a toast, or a line in the Données panel) or the
  loss is silent - which is the one thing this option must not do.
- Pros: proportionate; the active cycle keeps working; nothing crashes.
- Cons: more surface to specify and test; needs a user-visible signal.

**Option C - Active cycle only is validated**
- What it means: only the active cycle is checked at all; inactive ones are
  checked when selected.
- Implications: validation moves into the selector handler as well as
  `loadJournal`; two call sites again, the exact drift #32 exists to prevent.
- Pros: cheapest at boot.
- Cons: reintroduces the multi-door problem this issue closes.

**Recommendation.** **B**, with the dropped-row count surfaced in the toast that
already exists for migrations. Dropping a row silently would violate the
project's own rule that a rejection is never a rewrite - so the count is not
optional decoration, it is what makes B honest.

**Simon's decision.** **B** - envelope fatal, malformed log rows dropped with a visible count, malformed inactive cycles kept but not selectable (2026-09-12).

---

## Q4 - Does `saveJournal` get the same guard on the way out?

**Question.** Verified: `saveJournal(store, key, {})` writes literally
`{"schemaVersion":4}`, because `withVersion` drops `undefined` fields at
`JSON.stringify` ([src/schema.js:28](../../../src/schema.js)). That string is
exactly the input that locks the app on the spinner at the next boot. The app can
therefore inflict the worst case of #32 on itself - no hand-edited journal
needed.

**Option A - Guard the write too**
- What it means: `saveJournal` runs the same envelope check and refuses to write
  a journal that fails it, returning `{ ok: false, failed: true }` - a verdict
  the save effect already handles ([src/App.jsx](../../../src/App.jsx) sets
  `storageOk: false`, "Non enregistré").
- Implications: one extra call in `src/storage.js`; no new UI state, because the
  failure path already exists.
- Pros: closes the self-inflicted route; the store can no longer hold a shape the
  loader refuses.
- Cons: a bug that produces a malformed journal now silently stops saving instead
  of announcing itself - the user sees "Non enregistré" with no cause.

**Option B - Load-side only**
- What it means: accept that a malformed write can happen, and rely on the loader
  never locking up.
- Implications: nothing to build; the failure mode degrades from "locked forever"
  to "journal rejected at next boot, paste an export to recover".
- Pros: smaller change.
- Cons: leaves a write path that destroys the stored journal.

**Recommendation.** **A.** The write guard is a few lines, reuses a verdict the
UI already renders, and is the only thing standing between a future bug in
`updateActive` and a journal overwritten with `{"schemaVersion":4}`. The "silent
stop" objection is real but strictly better than the current "silent destroy".

**Simon's decision.** **A** - `saveJournal` runs the envelope check and refuses to write, reusing the existing failure verdict (2026-09-12).

---

## Q5 - Does a rejected stored journal keep the existing message?

**Question.** `LOAD_ERROR_MESSAGE` ([src/App.jsx:31](../../../src/App.jsx)) says
the journal "n'a pas pu être mis à jour vers le format actuel" - accurate for a
failed migration, misleading for a journal that is simply malformed, since
nothing was being updated.

**Option A - Reuse it**
- What it means: `reason: "invalid"` keeps one message for both causes.
- Implications: no new string, no new state; the second sentence ("Rien n'a été
  chargé, rien n'a été écrasé") stays true either way.
- Pros: zero cost; the reassuring half is the half that matters to a user staring
  at a blocked app.
- Cons: the first sentence is wrong in the new case.

**Option B - A second message keyed on the cause**
- What it means: `loadJournal` distinguishes `invalid` (migration) from a new
  reason (malformed shape), and App.jsx picks the wording.
- Implications: a new `reason` value in the verdict vocabulary, which
  `storage.test.js` and `App.jsx` both assert on.
- Pros: the message tells the truth and points at the right fix.
- Cons: widens a vocabulary the spec deliberately keeps closed.

**Recommendation.** **B**, but only as far as the wording: keep `reason:
"invalid"` as the single verdict and let App.jsx render a message that covers
both causes without claiming a migration happened - e.g. "Le journal enregistré
n'a pas pu être lu. Rien n'a été chargé, rien n'a été écrasé." One string
changed, no new vocabulary, and the sentence is true in both cases.

**Simon's decision.** **B (wording only)** - one verdict, a message that does not claim a migration happened (2026-09-12).

---

## Q6 - Where the validator lives - sent to the design round

Spec Q5 (`schema.js` leaf vs `import.js`) is an implementation choice, not a
product one: it decides module boundaries and nothing a user can observe. It is
recorded here only so it is not lost, and is answered in `/design-tech 32`
against the dependency table in [docs/ARCHITECTURE.md](../../ARCHITECTURE.md) §1 -
specifically whether `schema.js` stays a leaf, which that document calls
load-bearing for migrations.

---

## How to apply

Once Simon fills in each "Simon's decision", the answers fold back into
`spec.md`: resolved points move out of Open questions into Scope or Data &
storage impact, and Open questions ends as "None". Q1 additionally decides
whether #32 stays PATCH (options B, C) or becomes MAJOR with a migration
(option A), which changes its place in the 2.0.0 release.
