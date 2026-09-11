# Spec - Centralise the journal key builders ahead of the dated timeline (#24)

## Context

The journal's key format — `w{week}_{sessionId}` for a session log, `w{week}` for
cardio/check-in — is spelled inline at every call site instead of being built by one
function. #16 (move the journal to a dated, append-only timeline) will replace this
format entirely; done as-is, that single conceptual change would touch every call
site and the test fixtures in one commit, which is exactly the mix that makes a
regression hard to attribute. This issue extracts the format into two named
builders so #16 later changes one function instead of doing a search-and-replace.
See [issue #24](https://github.com/Simon0687/programme-12-semaines/issues/24) for
the source review finding (F5).

## Scope

- **In:** two exported functions, `logKey(week, sessionId)` and `weekKey(week)`,
  replacing every inline `` `w${...}` `` template literal in `src/` and `test/`.
- **Out:** any change to what the keys look like, to the journal shape, or to the
  data itself. No migration. No change to `planned()`, `history()`, or any other
  behaviour. The dated-timeline model itself is #16.

## User-facing behaviour

None. This is a pure refactor: same keys, same storage, same screens, same output
on every tab (Séance, Semaine, Bilan, Plan).

## Acceptance criteria

- [ ] Given the codebase after this change, when running
      `grep -rn 'w\$\{' src/ test/`, then the only matches are inside the two
      builder definitions themselves.
- [ ] Given `src/progression.js`, when `history()` looks up a session log, then it
      calls `logKey(w, s.id)` instead of building the string inline
      (`src/progression.js:34`).
- [ ] Given `src/App.jsx`, when any of the following read or write a session log,
      cardio entry, or check-in, then they go through `logKey`/`weekKey`: the
      `doneMap` computation, the local `wkey` helper (folded into `logKey`),
      `setCardio`, `toggleMob`, `setCheck`, `bilanText`, and the "Semaine" tab's
      per-session summary (`src/App.jsx:251,274,312-314,322-323,331,417-418,505`
      as of this spec — exact lines may shift; the point is no inline
      `` `w${...}` `` remains).
- [ ] Given `test/progression.test.js`, when the `S(...)` fixture builder
      constructs a log key, then it calls `logKey(week, sid)` instead of the
      inline template literal (`test/progression.test.js:26`).
- [ ] Given a journal already in localStorage, when the app loads it after this
      change, then every key produced is byte-identical to before (same string,
      same casing) — Simon's real journal loads with no visible difference.
- [ ] Given the existing suite, when running `npm test`, then every assertion
      passes unmodified — no expected value changes, only how the fixture builds
      keys.

## Data & storage impact

None. **PATCH.** No field is added, renamed, or reshaped; the key format produced
is identical to today's. This is an internal refactor of how the app computes a
string it already computes, not a behaviour or schema change.

## Edge cases

- **Deload week (week 7) and any other week number:** `weekKey`/`logKey` must
  produce the same string as the current inline literal for every `week` value
  used today (1..12), including the ones read by `phaseOf`, `blockOf`, and
  `setsFor` in `src/progression.js`, which are untouched by this issue and must
  keep matching the keys the builders produce.
- **The local `wkey` closure in `App.jsx` (line 274):** it is defined after its
  first inline use at line 251 (`doneMap`), which is presumably why that one call
  site was never routed through it. Replacing both with the shared `logKey` import
  removes the ordering constraint that caused the inconsistency.
- **Import cycle:** `src/progression.js` importing from `src/schema.js` (or a new
  `src/journal.js`) must not create a circular import back into `progression.js`.
  Verify with `npm run build` in addition to `npm test`.

## Out of scope / follow-ups

- The dated, append-only timeline itself, the `kind` field, staleness handling,
  and the sync-ready record fields — all #16.
- Whichever module ends up owning `logKey`/`weekKey` (`src/schema.js` vs. a new
  `src/journal.js`) is a design-tech decision, not settled here.

## Open questions

None.
