# Design - Move the journal to a dated, append-only timeline (#16)

## Summary

Session logs move from `logs[logKey(week, sessionId)]` (a string key encoding
position in a fixed 12-week cycle) to `logs[id]`, an object keyed by a
client-generated `id`, where each record carries its own `date`, `slot`
(today's session id), `kind`, `updatedAt`, `deletedAt`, `schemaVersion`. The one
idea that makes the rest fall out cleanly: **`date` is not "when you clicked
validate," it's the nominal calendar date the browsed week/slot corresponds to**
(`startDate + 7 × (week − 1) + (session.day − 1)`) — exactly the formula the
issue's own migration criterion specifies. Computed this way, `date` is a pure
function of `(definition.startDate, week, slot)`, available *before*
validation (so in-progress edits can still be found and resumed), and two
different cycles of the same program produce different dates for "week 1"
automatically, because their `startDate` differs — which is what stops the
second run from overwriting the first. `kind` stays exactly as decided in
[spec.md](spec.md) (Decision 1): fully automatic from the browsed week's
position, using the same rule `phaseOf()` already encodes, just renamed
`computeKind()` and stored instead of re-derived from a key.

`history()`/`lastEntry()`/`planned()` (`src/progression.js`) switch from
scanning `for (w = 1; w <= 12)` to scanning `Object.values(state.logs)` sorted
by `date`, and from `week === 7`/`week === 1` branches to `kind === "deload"`/
`kind === "calibration"`. A new `MIGRATIONS[2]` step (`src/schema.js`) converts
every existing `w{week}_{slot}` entry to this shape in one pass, bumping
`schemaVersion` 2 → 3.

## Files touched

- `src/progression.js` — `history()`, `lastEntry()`, `planned()` rewritten to
  take/compare `date` instead of `week`; new `computeKind(week)` (co-located
  with `phaseOf`, same branching). Drops its `logKey` import (no longer needed).
- `src/schema.js` — `SCHEMA_VERSION` 2 → 3. New: `genId()`, `nowIso()`,
  `dateForSlot(startDate, week, day)`, `findLog(logs, date, slot)`,
  `writeLog(logs, date, slot, patch)`, `MIGRATIONS[2]`. `migrate()` gains a
  second parameter `ctx` (threaded to migration steps) and wraps `applyChain`
  in try/catch so a step that throws on unrecognised data becomes the existing
  `{ ok: false, invalid: true }` verdict instead of crashing the caller.
  `logKey` removed (dead: only session logs used it, and those are the thing
  being replaced; `weekKey` stays, unchanged — cardio/check-in keep it per
  spec Decision 2, tracked separately as #29).
- `src/storage.js` — `loadJournal(store, key, ctx)` forwards `ctx` to
  `migrate(parsed, ctx)`; no domain knowledge added here, `ctx` is opaque to
  this module.
- `src/import.js` — `parseJournalImport(text, ctx)` forwards `ctx` to
  `migrate(parsed, ctx)`, same reasoning.
- `src/App.jsx` — builds `ctx` once (`{ defaultDefinition: DEFAULT_DEFINITION,
  buildProgram }`, both already imported) and passes it to `loadJournal`
  (line 191) and `parseJournalImport` (line 362). Rewrites the session-log
  read/write plumbing: `doneMap` (249-253), the `wkey` helper and its
  call sites (274, 278, 282, 289, 292, 297, 306, 310), `bilanText`'s key-lift
  lookup (331), and the "Semaine" tab's per-session summary (505) — all move
  from `logs[logKey(...)]` to `findLog(logs, dateForSlot(...), slotId)` /
  `writeLog(...)`.
- `test/schema.test.js` — new tests for `dateForSlot`, `findLog`/`writeLog`,
  and `MIGRATIONS[2]`; existing `migrate(input)` calls gain a `ctx` argument
  (a v1 or v2 input now also runs through the new v2→v3 step).
- `test/storage.test.js`, `test/import.test.js` — same `ctx` argument added to
  existing `migrate`-driven calls; the `logs: { a: 1 }` sentinel fixture in
  `storage.test.js`'s v1-migration test is replaced with a realistic
  `w1_hautA` entry, since `{ a: 1 }` cannot survive a real key-format parse.
- `test/helpers/migration-ctx.js` — **new**, a `testCtx()` helper returning
  `{ defaultDefinition: DEFAULT_DEFINITION, buildProgram }` from the real
  `src/default-program.js` / `src/program.js`, shared by every test file above
  (mirrors the existing `test/helpers/fake-store.js` pattern) so migration
  tests exercise the real program shape, not a stub.
- `test/progression.test.js` — fixture builder `S()` and the `wk1`/`week: 7`
  helpers rebuilt to construct v3-shaped records (`date` + `kind`) directly,
  instead of `w{week}_{sid}` keys. **No assertion (expected value) changes.**

## Approach

**Record shape** (`programs[id].logs[recordId]`):

```js
{
  id,             // genId(), stable for the life of the record
  date,           // "AAAA-MM-JJ", dateForSlot(startDate, week, session.day)
  slot,           // session id, e.g. "hautA"
  kind,           // null until validated, then computeKind(week)
  ex, notes, done,// unchanged shape/meaning
  updatedAt,      // nowIso(), bumped on every write (onSet/setNotes/validate/reopen)
  deletedAt,      // always null in this issue (reserved for future sync)
  schemaVersion,  // SCHEMA_VERSION at last write
}
```

`date` is nominal, not a click-timestamp — this is deliberate (see Risks). The
existing "Validée le {log.date}" text (`src/App.jsx:468`) switches to
`log.updatedAt.slice(0, 10)`, which is the real edit date and reproduces
today's displayed value exactly for the common case (validating today's own
session); the spec's "no visible change" promise is kept via this field, not
`date`.

```js
// src/schema.js
export const genId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const nowIso = () => new Date().toISOString();

export const dateForSlot = (startDateIso, week, day) => {
  const [y, m, d] = startDateIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 7 * (week - 1) + (day - 1));
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};
// Self-contained (no import of definition.js's parseLocalDate) to keep
// schema.js a leaf module — see Risks, "why not reuse parseLocalDate".

export const findLog = (logs, date, slot) =>
  Object.values(logs).find((r) => r.date === date && r.slot === slot) || null;

export const writeLog = (logs, date, slot, patch) => {
  const existing = findLog(logs, date, slot);
  const id = existing ? existing.id : genId();
  const base = existing || { id, date, slot, kind: null, ex: {}, notes: "", done: false, deletedAt: null };
  return { ...logs, [id]: { ...base, ...patch, id, date, slot, updatedAt: nowIso(), schemaVersion: SCHEMA_VERSION } };
};
```

**`computeKind`, co-located with `phaseOf` in `src/progression.js`** (no new
import — same module already owns this branching):

```js
export const computeKind = (week) => (week === 1 ? "calibration" : week === 7 ? "deload" : "normal");
```

**Engine rewrite** — `date`/`si` replace `week`/`si` for ordering;
`kind` replaces the `week === 1|7` branches:

```js
export function history(prog, state, vid) {
  const out = [];
  for (const rec of Object.values(state.logs)) {
    if (!rec.done) continue;
    const sets = ((rec.ex && rec.ex[vid]) || []).map(...).filter(...);
    if (!sets.length) continue;
    const si = prog.SESSIONS.findIndex((s) => s.id === rec.slot);
    out.push({ date: rec.date, si, kind: rec.kind, session: prog.SESSIONS[si]?.name, sets });
  }
  out.sort((a, b) => (a.date === b.date ? a.si - b.si : a.date < b.date ? -1 : 1));
  return out;
}
export function lastEntry(prog, state, vid, date, si) {
  const h = history(prog, state, vid).filter((e) => e.date < date || (e.date === date && e.si < si));
  return h[h.length - 1] || null;
}
export function planned(prog, state, slotId, week, si, date) {
  // date: dateForSlot(...) for the slot being planned, supplied by the caller
  // (progression.js has no definition/startDate of its own).
  const kind = computeKind(week);
  ...
  const hist = history(prog, state, vid).filter((e) => e.date < date || (e.date === date && e.si < si));
  let base = hist[hist.length - 1], prev = hist[hist.length - 2];
  if (base && base.kind === "deload" && hist.some((e) => e.kind !== "deload")) {
    const nd = hist.filter((e) => e.kind !== "deload");
    base = nd[nd.length - 1]; prev = nd[nd.length - 2];
  }
  ...
  // every `week === 7` -> `kind === "deload"`, every `base.week === 7` -> `base.kind === "deload"`,
  // `base.week === 1 || base.week === 7` -> `base.kind === "calibration" || base.kind === "deload"`.
}
```

`week` stays a `planned()` parameter (still used for `phaseOf(week).rir` in the
"no history yet" text) — only its role in *filtering history* is replaced by
`date`.

**Migration** (`src/schema.js`), given `ctx = { defaultDefinition, buildProgram }`:

```js
MIGRATIONS[2] = (v2, ctx) => ({
  ...v2,
  programs: Object.fromEntries(Object.entries(v2.programs).map(([id, p]) => {
    const definition = p.definition || ctx.defaultDefinition;
    const dayBySlot = Object.fromEntries(ctx.buildProgram(definition).SESSIONS.map((s) => [s.id, s.day]));
    return [id, { ...p, logs: migrateLogsV2(p.logs, definition.startDate, dayBySlot) }];
  })),
});

function migrateLogsV2(logs, startDate, dayBySlot) {
  const out = {};
  for (const [key, entry] of Object.entries(logs || {})) {
    const m = /^w(\d+)_(.+)$/.exec(key);
    const day = m && dayBySlot[m[2]];
    if (!m || day == null) throw new Error(`unrecognised log key: ${key}`); // fail closed, per spec Edge cases
    const week = Number(m[1]);
    const id = genId();
    out[id] = {
      id, date: dateForSlot(startDate, week, day), slot: m[2],
      kind: entry.done ? computeKind(week) : null,
      ex: entry.ex || {}, notes: entry.notes || "", done: !!entry.done,
      updatedAt: nowIso(), deletedAt: null, schemaVersion: SCHEMA_VERSION,
    };
  }
  return out;
}
```

`migrate()` wraps its `applyChain` call in try/catch, turning the thrown error
above into the existing `{ ok: false, invalid: true, from, data }` verdict —
`loadJournal` and `parseJournalImport` already handle that shape without
changes beyond passing `ctx` through.

**`computeKind` duplication, deliberate.** `schema.js`'s migration inlines the
same three-line `week === 1 | 7` rule rather than importing `computeKind` from
`progression.js`. Importing it would work in the *final* state (once
`progression.js` drops its `logKey` import in step 3, `progression.js` has
zero imports and `schema.js → progression.js` can't cycle back) — but step 1
adds the migration before step 3 removes that import, so at that point in the
sequence `progression.js` still imports from `schema.js`, and the reverse
import would cycle. Rather than couple two commits' ordering together to make
a one-time historical-data rule reusable, the rule is inlined in the
migration; `progression.js`'s `computeKind` stays the one used everywhere a
*new* record's kind is decided (the engine, `App.jsx`'s `validate()`).

## Sequencing

1. `refactor(schema): add date/id helpers and MIGRATIONS[2] (#16)` — `genId`,
   `nowIso`, `dateForSlot`, `findLog`, `writeLog`, `computeKind` (in
   `progression.js`), `MIGRATIONS[2]`, `migrate(data, ctx)` + try/catch,
   `SCHEMA_VERSION` → 3. New `test/helpers/migration-ctx.js`. Unit tests for
   every new function, including the fail-closed path on an unrecognised key.
   Nothing calls the new write path yet — `logs` shape in storage is unchanged
   until step 3. Safe to merge alone; `npm test` covers only new code.
2. `refactor(storage): thread ctx through loadJournal and parseJournalImport (#16)`
   — signature changes in `storage.js`/`import.js`; `test/storage.test.js` and
   `test/import.test.js` updated to pass `ctx` (from the new test helper) and
   the `{a:1}` sentinel fixture replaced with a realistic key. Still no caller
   passes a real `ctx` — `App.jsx` is untouched until step 4, so this step
   alone would break the running app (`migrate()` called without `ctx`) if
   merged in isolation; verify with the full suite, not manually, and land it
   together with step 4 in the same PR (still separate commits, per
   CONTRIBUTING's one-concern-per-commit).
3. `refactor(progression): switch history/lastEntry/planned to date+kind (#16)`
   — rewrite the three functions per Approach; rebuild
   `test/progression.test.js`'s `S()`/`wk1`/week-7 fixtures to emit v3-shaped
   records with `date`+`kind` (using `dateForSlot`/`computeKind` from the
   already-merged step 1) instead of `w{week}_{sid}` keys. **Every existing
   assertion (expected value) stays byte-identical** — this is the commit that
   directly proves the spec's core acceptance criterion.
4. `refactor(app): route session logs through date/slot instead of week keys (#16)`
   — `App.jsx` builds `ctx`, passes it to `loadJournal`/`parseJournalImport`,
   and rewrites `doneMap`, `wkey` and its call sites, `bilanText`'s key-lift
   lookup, and the "Semaine" tab summary per Approach; "Validée le" switches to
   `updatedAt`. This is the first point at which the app is fully consistent
   end-to-end — land together with step 2 as noted above.
5. `chore(schema): drop logKey, its test, and the dead w{week} key format (#16)`
   — remove `logKey` from `schema.js` and its unit test now that nothing
   references it (`grep -rn 'logKey' src/ test/` returns nothing).
6. Manual verification against a real journal: export Simon's current journal
   (Plan tab → Données), seed it into a dev build pre-migration, confirm the
   migrated Séance/Semaine/Bilan views show identical numbers, and confirm
   `loadProgram()` with a bumped `startDate` appends a second cycle without
   touching the first (per spec Decision 3) — same Playwright-driven
   click-through approach used for #24.

## Tests

- **Unit** (`node --test`): `dateForSlot` against known week/day pairs
  (including week 1 and week 7, to pin the calibration/deload dates used
  elsewhere); `findLog`/`writeLog` round-trip (create, then update the same
  slot/date, confirm same `id` and bumped `updatedAt`); `MIGRATIONS[2]`
  against a realistic multi-week v2 fixture (via `testCtx()`), asserting
  `date`, `slot`, `kind`, and the fail-closed path on a garbage key; `migrate`
  chaining v1 → v2 → v3 end-to-end.
- **Existing suite** (`test/progression.test.js`): must pass with zero
  assertion changes once its fixtures build v3-shaped data — this is the
  acceptance bar from spec.md.
- **`test/storage.test.js` / `test/import.test.js`**: updated for the `ctx`
  parameter and the realistic key fixture; existing assertions about
  `ok`/`migrated`/`reason` stay meaningful, only the input shape and function
  arity change.
- **Manual** (`npm run dev`, Playwright click-through as in #24): verify a
  migrated real journal renders identically, and that resuming a program with
  a refreshed `startDate` appends rather than overwrites (per Decision 3's
  `loadProgram()` path).

## Risks & tradeoffs

- **`date` is nominal, not a click-timestamp.** Today, `log.date` (set only in
  `validate()`) records the real day you clicked "Valider," used solely for the
  "Validée le" text. This design repurposes `date` as the nominal
  cycle-position date so it can (a) exist *before* validation, letting
  in-progress edits be found by `(date, slot)`, and (b) preserve correct
  chronological order for `planned()` when a session is logged retroactively
  by browsing to a past week — exactly what made `week`-based ordering robust
  before. The real click time is not lost: it lives in `updatedAt`, which is
  what the display now reads. Net effect for on-time logging (the common
  case): no visible change. For retroactive catch-up logging (rare): the
  record's `date` reflects which week it belongs to, not the day it was
  typed — arguably more correct for a training log, but a genuine, deliberate
  semantic change from today's field. Flagged in Open questions below.
- **`schema.js` gaining a dependency on `progression.js`.** Unusual layering
  (schema.js is otherwise the most foundational module) but doesn't cycle, and
  avoids a second, drifting copy of the deload/calibration rule. Reversible:
  if this bothers Simon, `computeKind`'s three-line body can be duplicated
  into schema.js instead, at the cost of two places to keep in sync.
  Also reversible if it does not bother Simon.
- **Alternative rejected: array of records instead of an id-keyed object.**
  An array is more natural for "an append-only log," but an id-keyed object
  matches the issue's own sync design ("same id, latest updatedAt wins") and
  keeps `writeLog`'s find-or-create O(1) by id once found, versus re-indexing
  an array on every write.
- **Alternative rejected: keep `week` inside each record (a `cycleId` +
  `week` composite) instead of a real date.** This is the alternative the
  issue itself rejects (see spec.md Context) — it still makes "which week"
  the primary identity, which is exactly what blocks #14's non-calendar
  deloads later. A real date has no such ceiling.
- **Performance.** `findLog`/`history` are O(n) scans over `Object.values(logs)`.
  At the issue's own stated scale (~2 600 sessions over ten years), this is
  negligible; if it ever isn't, an index is an additive change, not a rework
  of this record shape (per the issue's own storage-backend note).
- **Version level.** MAJOR, as spec.md states — `schemaVersion` 2 → 3, migration
  required, pre-migration backup (`prog12_simon_v1_backup_pre2`) covers it via
  the existing #8 mechanism unchanged.

## Out of scope / follow-ups

- #29 (weekly cardio/check-in to dated records) — per spec Decision 2.
- #14 (deload-by-signal) and #17 (per-exercise history screen) — both now
  unblocked by this issue's `kind` field and date index, neither built here.
- Staleness fallback — per spec.md, needs a tuned threshold from real data.

## Decisions

Resolved 2026-09-12: `date` is the nominal cycle-position date (indexing,
ordering, cross-cycle collision avoidance); "Validée le" displays `updatedAt`
instead, keeping the visible text unchanged for on-time logging. One field,
matching the issue's own record sketch — no separate `loggedAt`.

## Open questions

None.
