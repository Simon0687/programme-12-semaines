# Spec - Support programs with a different session count, or without cardio/mobility (#13)

## Context
`buildProgram()` (`src/program.js`) already threads a custom `program` through the active bundle (#6, #25), including the closed `program.cardio: "default" | null` switch validated at import (`src/import.js:133`). When `cardio` is `null`, the bundle simply omits `cardioPlan`/`CARDIO_ITEMS`/`MOB_DAYS`/`CARDIO_DAY_NOTES` — a case the `program.js` comments explicitly say is "left to #13". Today `src/App.jsx` reads those four properties unconditionally, so a validated, importable program with `cardio: null` currently crashes the UI instead of rendering. See [issue #13](https://github.com/) for the original report.

Two adjacent issues already absorbed part of what #13's original body described, and are explicitly not reopened here:
- **#22** ("Derive the program's shape from the active bundle instead of literals in App.jsx") *blocks* #13 by design ("should land first, so #13's diff contains only the new conditional rendering"). It already fixed the session-count literal (`App.jsx:619-620` reads `prog.SESSIONS.length`, not `5`) and already created the `getKeySlots(prog)` / `getCardioDayNotes(prog)` helpers in `src/program.js`. Its four commits (`9b61855`, `1ed100d`, `e984bbf`, `fc587d0`) are all on `dev` and cover every item in its issue body; it stays open on GitHub only because closing happens on merge to `main` (`CONTRIBUTING.md` §6), not `dev` — decided in `decisions-spec.md` Q1: #13 proceeds on `dev` now, no wait.
- **#20** ("parseProgramImport accepts definitions that crash the app...") originally assigned "re-enabling `program` with a shape check" to #13. That data-only validation (the `program.cardio: "default" | null` switch itself) was in fact delivered by **#25**, not #13. #13 does not touch `import.js`.

What's left for #13, once #22's and #25's territory is excluded, is purely the conditional rendering in `App.jsx` (and one small extension of #22's `getCardioDayNotes` helper — see Scope and Edge cases).

## Scope
- **In:** making `src/App.jsx` tolerate a bundle with no `CARDIO_ITEMS`/`MOB_DAYS`/`cardioPlan`/`CARDIO_DAY_NOTES` — hiding the "Cardio et mobilité" affordance and every dependent line of text/UI, and never routing the app into that view when it has nothing to show.
- **In:** deriving the presence of the cardio checklist and of the mobility checklist independently (a bundle with items in one but not the other renders only the relevant sub-section), so the UI doesn't assume both always travel together even though today's closed `cardio` rule only produces "both" or "neither".
- **In:** guarding `getCardioDayNotes(prog)` (`src/program.js:78-83`) against a bundle with no `CARDIO_DAY_NOTES`. This helper is #22's deliverable, but #22 was written and shipped before #25 introduced `cardio: null` — it never had a reason to handle "no cardio data at all". Decided in `decisions-spec.md` Q2: the guard ships inside #13's commit, not a reopened #22.
- **Out:** any change to `buildProgram()`, the import validator, or the `program.cardio` schema itself — that surface was intentionally finished by #25 and is not reopened here.
- **Out:** re-deriving anything #22 already derives (session count, key slots) — #13 only consumes those, per #22's own "blocks #13" framing.
- **Out:** a new named cardio rule that would let a custom program mix, e.g., cardio items with no mobility days at the data layer. Today only "default" (both) or `null` (neither) exist; this issue makes the rendering correct for that today and for either partial case if the data ever allows it, without inventing a new rule.
- **Out:** the session-count badge (`X/N` on the Semaine tab) — already derived from `prog.SESSIONS.length`, not a literal, since #22.

## User-facing behaviour
- **Séance tab:** the "Cardio et mobilité" pill next to the session tabs (`App.jsx:482`) only appears when the active bundle defines at least one cardio item or at least one mobility day. When the bundle has neither, the pill is gone and the session list is the only way to navigate the tab. The "today" banner line (`todayLine`, `App.jsx:432-438`) stops appending a cardio note for days that have none.
- **Semaine tab:** the compact `CardioView` block under the session list (`App.jsx:543`) is omitted entirely when there is nothing to show; when there is a cardio checklist but no mobility days (or vice versa), only that sub-section renders inside it.
- **Bilan tab:** `bilanText()` (`App.jsx:354`) drops line 4 ("Cardio : … — mobilité …") cleanly when the bundle has neither; keeps only the relevant half of that line when only one of the two is present.
- **Plan tab:** unaffected.
- **Default (Simon's) program:** pixel-identical to today — it defines both cardio items and mobility days, so every affordance above keeps rendering exactly as it does now.

## Acceptance criteria
- [ ] Given a definition with 3 sessions, when viewing the Semaine tab, then the badge reads "X/3" (already true since #22 — regression-check only, not new work).
- [ ] Given a definition with `program.cardio: null` (no cardio items, no mobility days), when on Séance, then no "Cardio et mobilité" pill appears, and the app never auto-navigates the session tab into a cardio view (including the day-completed fallback at `App.jsx:294` and the day-note fallback at `App.jsx:292`).
- [ ] Given the same definition, when on Semaine, then no cardio/mobility block renders under the session list.
- [ ] Given the same definition, when copying or displaying the Bilan text, then it contains no "Cardio" line.
- [ ] Given a bundle that defines cardio items but an empty (or absent) mobility list, when on Séance/Semaine, then only the cardio checklist renders, not an empty "Mobilité" section.
- [ ] Given a bundle that defines mobility days but no cardio items, then only the mobility checklist renders.
- [ ] Given a definition with no cardio, completing all sessions for the week does not require touching any cardio/mobility control, and no crash occurs when every session is marked done (the `sessionId` fallback in `App.jsx:294` must not select `"cardio"` when there is nothing to show there).
- [ ] Given the default (Simon's) definition, behaviour and layout are unchanged from today.

## Data & storage impact
No change to the localStorage journal shape (`prog12_simon_v1`): no new field, no renamed field. `state.cardio` keeps being written the same way when a cardio bundle exists; it is simply never read or written through the UI when it doesn't. **Level: MINOR** — this is a compatible UI addition (existing, already-validated `program.cardio: null` inputs start working instead of crashing); no journal written by the current version becomes unreadable, so no migration is needed.

## Edge cases
- **`program.cardio: null` but a session still declares `after: "z2"` or `after: "mob"`** (`AFTER_HINTS`, `App.jsx:37-38`, used at `App.jsx:504`): a custom program that disables cardio but still points a session at a cardio hint is an authoring inconsistency in that program's own data, not something #13 needs to validate. The rendering must simply not crash (`cardio` should default to an empty object rather than being `undefined` when `prog.cardioPlan` is absent) — cosmetic garbage text in that scenario is acceptable and left to the program author.
- **`getCardioDayNotes(prog)`** (`src/program.js:78-83`) reads `prog.CARDIO_DAY_NOTES` unguarded; it must not throw when the bundle has no cardio data (called from `App.jsx:292` on every week change). Ships inside #13 per `decisions-spec.md` Q2.
- **Mid-week toggle of the active program** (`journal.activeProgramId` changing, `App.jsx:298-304`): switching from a program with cardio to one without must not leave `sessionId` stuck on `"cardio"`.
- **Empty array vs. absent key:** a bundle with `CARDIO_ITEMS: []` (present but empty) must be treated the same as the key being entirely absent — no empty checklist box.

## Out of scope / follow-ups
- Adding a named cardio rule that mixes cardio-only or mobility-only content at the data layer (currently only "default"/`null` exist) — not needed unless a real program requires it.
- Any cleanup of the "left to #13" comments in `src/program.js` once this ships (small, can ride along with the implementing commit rather than a separate issue).

## Open questions
None — resolved in `decisions-spec.md` (#22's dependency treated as satisfied on `dev`; the `getCardioDayNotes` guard ships inside #13).
