# Design - Tests for the progression logic (#2)

## Summary

Split the load engine out of `src/App.jsx` so `node --test` can reach it, then pin
its behaviour with a headless suite and gate the deploy on that suite. Two new
plain-ESM modules: `src/program.js` holds the data constants (`V`, `SLOTS`,
`SESSIONS`, `CORE`); `src/progression.js` holds the engine (`planned`, `history`,
`lastEntry`, `loadText`) plus the small pure helpers it needs. `App.jsx` keeps
every component and imports the moved names back - no behaviour change. Spec:
[spec.md](./spec.md); answers in its "Decisions - Simon's Answers" section.

## Files touched

- **`src/program.js`** (new). Cut verbatim from `App.jsx`: `V` (lines 52-93),
  `SLOTS` (96-122), `SESSIONS` (124-130), `CORE` (131-135). Add `export` to each.
  No imports, no functions.
- **`src/progression.js`** (new). Cut from `App.jsx`: `num` (25-29), `fmt` (30),
  `roundTo` (33), `blockOf` (48), `phaseOf` (42-47), `setsFor` (49), `history`
  (160-171), `lastEntry` (172-175), `planned` (176-219), `loadText` (220-224).
  `import { V, SLOTS, SESSIONS } from "./program.js";` at the top. `export` every
  moved name.
- **`src/App.jsx`**. Remove the definitions above. Add two imports (see Approach).
  Call sites that stay and now resolve through imports: `blockOf` (270, 449, 478,
  573, 578, 604), `phaseOf` (277, 423), `setsFor` (273, 567), `planned` (274,
  450), `lastEntry` (275), `num` (481, 605), `fmt` (321), and `V`/`SLOTS`/
  `SESSIONS`/`CORE` throughout. `setSummary` (225-233) stays in `App.jsx` (display
  only, takes `v` as an argument) and uses the imported `fmt`.
- **`test/progression.test.js`** (new). The suite. Imports `planned` etc. from
  `../src/progression.js` and `V`/`SLOTS`/`SESSIONS` from `../src/program.js`.
- **`netlify.toml`** (new, repo root). `command = "npm test && npm run build"`,
  `publish = "public"`, pinned `NODE_VERSION`.
- **`package.json`**. Unchanged - `test` is already `node --test`, `build` already
  bundles from `src/main.jsx`; esbuild follows the new imports with no config
  change.

## Approach

**Module graph.** `program.js` (leaf, data only) ← `progression.js` (engine) ←
`App.jsx` (view). One direction, no cycle. `progression.js` never imports React or
`App.jsx`, which is what lets `node --test` load it.

```js
// src/progression.js
import { V, SLOTS, SESSIONS } from "./program.js";

export const num = (s) => { /* unchanged */ };
export const fmt = (n) => { /* unchanged */ };
export const roundTo = (x, inc) => (inc ? Math.round(x / inc) * inc : x);
export const blockOf = (w) => (w <= 6 ? "b1" : "b2");
export const phaseOf = (w) => { /* unchanged, note strings ride along */ };
export const setsFor = (n, w) => (w === 7 ? Math.ceil(n / 2) : n);

export function history(state, vid) { /* unchanged: iterates SESSIONS */ }
export function lastEntry(state, vid, week, si) { /* unchanged */ }
export function planned(state, slotId, week, si) { /* unchanged */ }
export function loadText(v, l) { /* unchanged */ }
```

```js
// src/App.jsx  (new import block, replacing the deleted definitions)
import { V, SLOTS, SESSIONS, CORE } from "./program.js";
import {
  num, fmt, blockOf, phaseOf, setsFor,
  history, lastEntry, planned, loadText,
} from "./progression.js";
```

Bodies are moved **unchanged** - character-for-character, so a diff shows only
"deleted here / added there". Per the spec, any change to a displayed load or
reason string is a regression. Q2, Q3 and Q5 are all pinned as-is (see spec
decisions): the week-7 line `next = roundTo(next * 0.85, v.incr)` stays, `carry`
keeps flowing through the kg path, `>= mx` / `< mn` stay.

**Test fixtures.** `state` is `{ logs, cardio, checkin }`; only `logs` matters.
`history()` reads `state.logs["w<week>_<sessionId>"] = { done: true, ex: { [vid]:
[{ w, r, rir }, ...] } }`, so a builder keeps cases readable:

```js
const S = (...entries) => ({
  logs: Object.fromEntries(entries.map(
    ({ week, sid, vid, sets }) => [`w${week}_${sid}`, { done: true, ex: { [vid]: sets }}]
  )),
  cardio: {}, checkin: {},
});
// week 2 sees a week-1 calibration of `dc` (hautA = session index 0):
const st = S({ week: 1, sid: "hautA", vid: "dc", sets: [
  { w: 72.5, r: 8, rir: 3 }, { w: 72.5, r: 8, rir: 3 }, { w: 72.5, r: 8, rir: 3 },
]});
assert.equal(planned(st, "dc", 2, 0).load, 76);   // 72.5 * 1.05 -> round 2.5
```

Session indices follow `SESSIONS` order: `hautA` 0, `basA` 1, `hautB` 2, `hautC`
3, `basB` 4 - the tests import `SESSIONS` and derive the index rather than
hard-coding it. Increments are read from `V[vid].incr`, never literal, so the
suite stays correct if a variant's increment changes.

**`netlify.toml`.**

```toml
[build]
  command = "npm test && npm run build"
  publish = "public"

[build.environment]
  NODE_VERSION = "20"
```

`command` overrides the dashboard build command; `npm test` exits non-zero on a
drift and short-circuits the `&&`. `publish = "public"` matches the repo layout
(`public/index.html`, `public/dist/`). `NODE_VERSION` pinned so `node --test`
(stable from 18.17 / 20) is guaranteed present.

## Sequencing

1. **`refactor(program): extract data constants into src/program.js (#2)`** -
   create `src/program.js`, move `V`/`SLOTS`/`SESSIONS`/`CORE`, import them back
   into `App.jsx`. `npm run build` passes, app visually unchanged. Safe to merge
   alone.
2. **`refactor(progression): extract the load engine into src/progression.js (#2)`**
   - move the helpers and `history`/`lastEntry`/`planned`/`loadText`;
   `progression.js` imports from `./program.js`, `App.jsx` imports from
   `./progression.js`. `npm run build` passes; manual click-through of the Séance
   tab (below) confirms identical output. Safe to merge alone. May be squashed
   with step 1 if preferred - both are pure `refactor` and land together.
3. **`test(progression): cover planned() across the 12-week cycle (#2)`** - add
   `test/progression.test.js` with the fixture builder and one case per
   acceptance criterion. `npm test` runs the schema suite and this one. Safe to
   merge alone.
4. **`chore(ci): run the test suite before the Netlify build (#2)`** - add
   `netlify.toml`. Effect shows on the next branch preview. Safe to merge alone.

Every step leaves `main` shippable. No step changes stored data or behaviour, so
none bumps the version on its own (`standard-version` ignores `refactor`, `test`,
`chore`); the work rides the 1.1.0 milestone release driven by #1. No commit mixes
refactor with tests or CI, per CONTRIBUTING.

## Tests

- **Unit, `node:test`, `test/progression.test.js`.** One `test()` per acceptance
  criterion in the spec: starting load / "Paliers" / time-target with no history;
  calibration +5% / −5% / hold (reference week 1 and 7); progression +increment;
  stall hold then −5% on the second; week-7 −15% off the computed next; week-8
  resume from pre-deload baseline; new block-2 variant in week 7 then calibrated
  in week 8; same variant twice in one week via `si`; pull-up bodyweight → +2,5;
  `sideplank` load stays `null` with the duration reason; plus the two edge cases
  the spec calls out (blank RIR ⇒ hold; percentage rounds to `incr`, flat
  increment does not). Assert on `.load`, `.text` and `.why`.
- **Manual click-through** (once, after step 2): Séance tab, `dc` and `latraise`
  at weeks 1, 2, 7, 8; `pullup` at weeks 6-8; `sideplank` any week. Confirm the
  "Prévu : …" text and the greyed set-input placeholder are unchanged from `main`.
- **Deploy gate** (after step 4): push a branch with a deliberately broken
  expected value, confirm the Netlify preview fails at `npm test`; revert.
- No rendering, storage, timer or import/export tests - out of scope per the spec.

## Risks & tradeoffs

- **Missed call site / import typo.** esbuild resolves imports statically and the
  build fails loudly on a missing export, so step 1-2 can't ship half-wired; the
  manual click-through is the backstop for a wrong-but-defined reference. Low risk
  given the call sites are enumerated above.
- **`phaseOf` note strings now live in `progression.js`.** Editorial text in an
  "engine" file is a smell; issue #4 (extract Plan tab content) relocates it.
  Noted as a follow-up, not fixed here.
- **`netlify.toml` vs the dashboard.** If the dashboard sets a different publish
  directory or Node version, the toml now wins - confirm the current dashboard
  values before merging step 4. `publish = "public"` is correct for this repo.
- **No cycle, no React in the engine** - the one hard requirement for headless
  tests - holds by construction: `program.js` imports nothing, `progression.js`
  imports only `program.js`.
- **Storage / compatibility.** Nothing reads or writes the journal differently;
  `planned()` is still pure over in-memory state. Confirms the spec's **PATCH**
  level - no migration, no format change.
- **`history()` re-scans 12×5 slots per call**, once per card via `useMemo`.
  Unchanged from today; not addressed here.
- **Alternative rejected:** inject the program as a parameter to
  `planned`/`history` (spec Q1 option C) - Simon chose option B, and it would
  churn every call site. **Also rejected:** a hand-built `V`/`SLOTS` fixture in
  the test - drifts from the real catalogue.

## Out of scope / follow-ups

- **`fix(progression)` issue** (from spec Q2 option A): reconsider whether the
  week-7 cut should be `roundTo(load * 0.85, incr)` off the last worked load
  rather than off the already-progressed `next`. Attach the failing case.
- **Annotate issue #3:** `src/program.js` now exists with
  `V`/`SLOTS`/`SESSIONS`/`CORE`; #3 continues by moving `WARM`, `CARDIO_ITEMS`,
  `MOB_DAYS`, `cardioPlan`, the starting loads and the `phaseOf` note text out of
  code and giving `program.js` its final shape.
- **Annotate issue #4:** the `phaseOf` phase-note strings temporarily sit in
  `src/progression.js`.
- Property-based / fuzz run of `planned()` over a full synthetic cycle.

## Open questions

1. **`blockOf` / `phaseOf` / `setsFor` placement.** The design puts them in
   `src/progression.js` (keeps `src/program.js` pure data, matching the literal Q1
   answer - "cut `V`, `SLOTS`, `SESSIONS`, `CORE`"). The alternative is
   `src/program.js` alongside the constants (all periodisation in one file). Both
   work; it is a one-line move either way. Default as written: `progression.js`.
