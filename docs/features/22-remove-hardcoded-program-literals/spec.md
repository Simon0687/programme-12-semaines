# Spec - Derive the program's shape from the active bundle instead of literals in App.jsx (#22)

## Context

`buildProgram(definition)` ([src/program.js:185-195](../../../src/program.js#L185-L195), delivered by #6) already threads a program bundle through the whole UI, but `src/App.jsx` still hardcodes Simon's own program shape in several places: a default session id, which days open on cardio, the list of "key" lifts, the mobility-day count, the session count, which sessions get a post-session hint, and the 12-week cycle length. Two of these silently duplicate data that already exists in `src/program.js`; the rest duplicate `definition.weeks` ([src/definition.js:36](../../../src/definition.js#L36), already `12`, just not read by the UI). As long as they stay literals, a program with a different shape (#13, #25, #26 — different session count, no cardio, a different key-lift list) renders wrong even though `buildProgram()` already carries the right data. This is a pure refactor: #13 is blocked on it landing first, so #13's own diff stays pure feature (CONTRIBUTING: "no refactoring and feature work in the same commit"). See #22.

## Scope

- **In:** every literal in the table below, replaced by a read of `prog`/`definition`; two new pure helpers in `src/program.js` (key-slot list, cardio-only days) with unit tests; a data field on `SESSIONS` entries for the post-session hint; the `state` object in `Programme()` rebuilding on every render and defeating `useMemo`; refreshing `src/program.js`'s stale header comment.
- **Out:** the engine's own week-based constants in `src/progression.js` (`phaseOf`, `blockOf`, `setsFor`, the four `week === 7` checks in `planned()`, the `history()` loop) — those encode the cycle's *shape*, not a count, and belong to #9/#14. Relaxing the `weeks !== 12` rejection in `parseProgramImport` ([src/import.js:140-142](../../../src/import.js#L140-L142)) — #22 only makes `definition.weeks` reach the UI, it does not change what values are accepted; still #9/#14.

## Current literals and their source of truth

| File:line | Literal | Derives from |
|---|---|---|
| [App.jsx:186](../../../src/App.jsx#L186) | `useState("hautA")` | `prog.SESSIONS[0].id` |
| [App.jsx:282](../../../src/App.jsx#L282) | `weekday === 0 \|\| weekday === 4` | days present in `CARDIO_DAY_NOTES` with no session that day |
| [App.jsx:351](../../../src/App.jsx#L351) | `["dc","squat","pull","ohp","hipthrust","latraise"]` | the `SLOTS` entries with `key: true`, in declaration order: `dc, latraise, squat, pull, ohp, hipthrust` (see Open questions) |
| [App.jsx:336](../../../src/App.jsx#L336), [:365](../../../src/App.jsx#L365) | `[false, false, false]`, `/3` | `prog.MOB_DAYS.length` |
| [App.jsx:364](../../../src/App.jsx#L364), [:606-607](../../../src/App.jsx#L606-L607) | `/5`, `weekDoneCount === 5` | `prog.SESSIONS.length` |
| [App.jsx:492-493](../../../src/App.jsx#L492-L493) | `session.id === "hautB"` / `"basA"` | nothing yet — a field on the session |
| [App.jsx:109](../../../src/App.jsx#L109) | `week === 12` (AMRAP flag) | `definition.weeks` |
| [App.jsx:176](../../../src/App.jsx#L176), [:447](../../../src/App.jsx#L447) | `Math.min(12, …)` | `definition.weeks` |
| [App.jsx:424](../../../src/App.jsx#L424) | `dayIdx >= 84` | `definition.weeks * 7` |
| [App.jsx:444](../../../src/App.jsx#L444) | `"sur 12"` | `definition.weeks` |

(Line numbers refreshed against `dev` at the time of writing; the issue's original table was written against an older commit and is slightly stale — #13's four items, #351/#336/#365/#364+606-607, are unchanged in substance.)

## User-facing behaviour

None, for the default (Simon's) program — every criterion below must hold pixel- and byte-identical, with one deliberate exception: the order of the six key lifts in the Bilan tab's line 5 (`bilanText()`, [App.jsx:344-371](../../../src/App.jsx#L344-L371)) changes from the hardcoded `dc, squat, pull, ohp, hipthrust, latraise` to the `SLOTS` declaration order `dc, latraise, squat, pull, ohp, hipthrust` — `latraise` moves from 6th to 2nd. See Open questions.

No tab layout, label, or interaction changes. The only reason this is visible at all is that a *future* program with a different shape (different session count, no cardio, a different key-lift list) will now render correctly instead of silently reusing Simon's numbers — that's the point of the issue, not a change for today's user.

## Acceptance criteria

- [ ] Given the default definition, when viewing any tab, then the UI is pixel-identical to today's `dev`, and `bilanText()` is byte-identical **except** the key-lift order in line 5 (per the decision in Open questions).
- [ ] Given a hypothetical bundle with a different `SESSIONS.length` (not reachable via import today, per Out of scope — but exercised by unit tests on a synthetic bundle), the "X/5" badges and Bilan line 3 read the real count, not `5`.
- [ ] Given a hypothetical bundle with zero `MOB_DAYS`, the mobility checkboxes and the "/3" count read `0`, not `3`.
- [ ] Given a hypothetical bundle with no `key: true` slots, the Bilan line 5 key-lift list is empty (falls back to "aucune séance validée", already handled) instead of throwing or hardcoding.
- [ ] Given the default bundle, the key-slot helper returns exactly `dc, latraise, squat, pull, ohp, hipthrust` and the cardio-only-day helper returns exactly days `0` and `4` — unit-tested against the default bundle in `src/program.js`.
- [ ] Given a session with a post-session hint field set (Haut B → `after: "z2"`, Bas A → `after: "mob"`), the Séance tab shows the corresponding hint; given a session without the field (Haut A, Haut C, Bas B), no hint shows.
- [ ] Given the rest timer is running (500 ms tick, [App.jsx:258-262](../../../src/App.jsx#L258-L262)), `planned()`/`lastEntry()` (`ExerciseCard`, [App.jsx:104-105](../../../src/App.jsx#L104-L105)) and `doneMap` ([App.jsx:272-276](../../../src/App.jsx#L272-L276)) do not recompute on every tick — only when `journal`/`week` actually change.
- [ ] `npm test` passes with every existing assertion in `test/progression.test.js` unmodified.
- [ ] `npm run build` succeeds.
- [ ] Stored format unchanged (PATCH — no field in the localStorage journal changes shape).

## Data & storage impact

None. No change to the localStorage journal shape (`prog12_simon_v1`). The `after` hint field and the two new helpers live on the program bundle (`src/program.js`), not on stored data — a bundle is derived from a `definition`/`program` file, never persisted itself in the journal. Per CONTRIBUTING.md's versioning table, this is a **PATCH**: no change to intended behaviour for the shipped (default) program.

## Edge cases

- **Custom program with a session on every cardio-note day** (e.g. a 7-session program covering days 0 and 4): the cardio-only-days helper must return an empty set in that case, not `[0, 4]` — it excludes any day that has a session, which the default bundle's days `2` and `3` already exercise (they have both a session and a `CARDIO_DAY_NOTES` entry, and are correctly excluded today).
- **Program with fewer than one `key: true` slot**: Bilan line 5 and the S12 AMRAP flag both already handle an empty/false case gracefully (`.filter(Boolean)`, `&& slot.key`) — no new code path, just confirm it still holds once the list is derived instead of literal.
- **`week === prog.weeks` on a program that isn't 12 weeks**: not reachable today (import still rejects `weeks !== 12`, see Out of scope), but the derivation must not special-case `12` — otherwise this issue's own point is defeated.

## Out of scope / follow-ups

- Relaxing `weeks !== 12` at import — #9/#14.
- Splitting `Programme` into per-tab components — deliberately not part of this issue (noted in the original issue body): once this and the storage extraction (#21) remove non-UI logic from it, what's left is linear JSX that a split would only shuffle.

## Open questions

None. See decisions below.

## Decisions

**Q1 — Bilan line 5 key-lift order:** Accepted as a cosmetic change. `latraise` moves from 6th to 2nd position when the list is derived from `SLOTS` declaration order instead of the hardcoded literal. The key-lift selection itself (`key: true` flag) is fixed within Simon's program for now; making it configurable per custom program is a feature for later (#25+, when programs become user-definable). This issue only removes the literals and reads from the bundle.
