# Design - planned() treats a session's heaviest set as its working load (#31)

## Summary

One pure helper, `workingSets(sets, mn, mx)`, groups a session's sets by load and
returns the one the lifter actually worked at, together with that load's sets.
`planned()` then computes `allTop` and `lowCount` over those sets instead of over
the whole session. Everything else in the engine — the branches, the increments,
the deload cut — is untouched. See [spec.md](spec.md).

The idea that makes it small: the rule is a *selection*, not a new branch. A
uniform session yields a single group that both clauses select, so today's
behaviour falls out of the same code path rather than being preserved by a
special case.

## Files touched

| File | Change | Where |
|---|---|---|
| `src/progression.js` | New exported `topHalf()` and `workingSets()`. In `planned()`: the `time`/`reps` early return moves *above* the load computation; `load` / `allTop` / `lowCount` are derived from `workingSets`; `prevLow` reads `prev` through the same helper; `why` gains a suffix on a mixed session. | new helpers near `roundTo` (`:28`); `planned()` `:77-98` |
| `test/progression.test.js` | New `describe("working load")` for the helper, and new cases in `describe("progression")` / `describe("calibration")` for mixed sessions. The 32 existing tests are not edited. | appended |
| `src/plan.js` | One clause in the two paragraphs that describe the rule to the user — pending Open question 2. | `:125-126` |

No new file, no new module: `progression.js` is already the leaf that owns this
logic and imports nothing (`docs/ARCHITECTURE.md` §1).

## Approach

### The helper

```js
const loadOf = (s) => (s.w == null ? 0 : s.w);

/* Upper half of the rep range. Not rounded: reps are integers, so the 30-45
   carry's 37,5 means 38. */
export const topHalf = (mn, mx) => mn + (mx - mn) / 2;

/* The load a session actually worked at, and that load's sets.
   Invariant: `sets` is never empty — history() only emits a session with at
   least one set carrying reps (progression.js:46). */
export function workingSets(sets, mn, mx) {
  const byLoad = new Map();          // load -> sets, insertion order irrelevant
  for (const s of sets) {
    const l = loadOf(s);
    if (!byLoad.has(l)) byLoad.set(l, []);
    byLoad.get(l).push(s);
  }
  const t = topHalf(mn, mx);
  const reached = [...byLoad].filter(([, ss]) => ss.some((s) => s.r >= t)).map(([l]) => l);
  const load = reached.length ? Math.max(...reached) : Math.min(...byLoad.keys());
  return { load, sets: byLoad.get(load), mixed: byLoad.size > 1 };
}
```

Grouping is by the parsed number, which is what `num()` already produced from the
journal's strings (`"72,5"` → `72.5`). Exact equality is safe at the increments in
the registry — 1,25 / 2 / 2,5 / 5 / 10 are all exactly representable — and two
sets typed identically always parse identically.

`loadOf` keeps today's `null → 0` collapse, so a `bw` exercise at bodyweight
groups under `0` as a real load rather than being dropped.

### Wiring into `planned()`

Three edits inside the function, in this order:

1. **Move the `time` / `reps` early return above the load computation**
   (currently `:81-84`, after it). Those units have no load, so a grouping would
   be meaningless; the branch keeps computing `allTop` over every set, exactly as
   today. Pure restructuring, zero behaviour change — and it confines the new rule
   to the loaded units by construction rather than by a guard.

2. **Derive the verdict from the working load:**

   ```js
   const base_ = workingSets(base.sets, mn, mx);
   const load = base_.load;
   const allTop = base_.sets.every((s) => s.r >= mx);
   const lowCount = base_.sets.filter((s) => s.r < mn).length;
   ```

   `next`, the four branches and the deload override at `:97` are unchanged.

3. **`prevLow` through the same helper** (`:94`, pending Open question 1):

   ```js
   const prevLow = prev && workingSets(prev.sets, mn, mx).sets.filter((s) => s.r < mn).length >= 2;
   ```

### The `why` suffix

One line immediately before the `return`, after the deload override so it survives
it:

```js
if (base_.mixed) why = `${why} (jugé sur ${loadText(v, load)})`;
```

`loadText` is already in this module and renders the unit correctly — "105 kg",
"PDC + 10 kg". A uniform session leaves `why` byte-identical, which is what spec
criterion 3 requires.

## Sequencing

1. **`feat(progression): workingSets picks the load a session actually worked at (#31)`**
   The helper and `topHalf`, exported, plus their unit tests. Called from nowhere.
   **Safe to merge alone** — zero behaviour change, and it is the whole rule in one
   reviewable piece.
2. **`fix(progression): planned judges the working load, not the heaviest set (#31)`**
   Steps 1 and 2 of the wiring above (the early-return move and the verdict), with
   the four scenario tests. This is the commit that changes prescriptions.
3. **`fix(progression): the previous session is read through the same rule (#31)`**
   `prevLow`. Separate because it is a second read with its own regression risk,
   and because Open question 1 may cancel it.
4. **`feat(progression): why names the load it judged on a mixed session (#31)`**
   The suffix. A wording concern, not a load concern — its own commit per
   CONTRIBUTING's "one concern per commit".
5. **`docs(plan): the rule reads on the working load, not on every set (#31)`**
   `plan.js:125-126`, pending Open question 2.

Steps 2 to 4 must land together to satisfy the spec's acceptance criteria; each
still leaves the app working and the suite green on its own.

## Tests

**Unit, `node --test`, on `workingSets`** — the nine cases already verified while
settling the spec: Simon's `8 @ 100`, `4 @ 120` → 100; the follow-up `8 @ 120` →
120; `7 @ 100`, `7 @ 105`, `8 @ 90` → 105; `5 @ 110`, `5 @ 110`, `3 @ 120` → 110;
`3 @ 120`, `2 @ 130` → 120 by the fallback; the three pinned uniform sessions →
their single load; and an 8–12 range to check the threshold is not hard-coded to
6. Plus `mixed` true/false, and a `bw` session at bodyweight grouping under 0.

**Integration, `node --test`, on `planned()`** — the same scenarios through the
real engine, asserting `load`, `text` and `why`: 102,5 then 122,5 for Simon's
pair, 110 with no "viser plus de reps at 120", 105 in a calibration week, and the
`why` suffix present on a mixed session and absent on a uniform one.

**Regression** — the 32 existing tests in `test/progression.test.js` must pass
**unmodified**. If any assertion moves, the change is wrong, not the test
(`test/progression.test.js:9-22` says so explicitly).

**Manual** — none required. No new control, and the only visible surface is a line
of text on the session card.

## Risks & tradeoffs

- **Every past mixed session is now read differently.** No byte of the journal
  changes, but the same history yields different prescriptions — which is why the
  spec set **workflow Level A** while the semver level stays **PATCH**
  (`CONTRIBUTING.md`: "wrong progression formula"). Nothing to migrate,
  `SCHEMA_VERSION` untouched.
- **The correction reaches stored data on the next validation.** `App.jsx:438`
  fills a blank weight with `p.load` at validation time, so from the next session
  the corrected load is what gets written. Existing rows are not rewritten.
- **Rejected: most-frequent load** (the issue's first candidate). It has no answer
  for a pure ramp, where every load appears once, and it would elect a light
  back-off set over the working one whenever two of three sets were lightened.
- **Rejected: judging per-load and merging the verdicts.** Several verdicts have
  to collapse into one number anyway, so the merge rule would be a second
  progression rule — the thing `.claude/WORKFLOW.md` warns about for this module.
- **Threshold, not "in range".** Settled in `decisions-spec.md` Q1: excluding only
  sets below `mn` still lets a one-off `4 @ 120` in a 4–8 range become the next
  prescription.

## Out of scope / follow-ups

- **`planned()` writes a suggestion into the journal** (`App.jsx:438`). An engine
  opinion becoming stored data deserves its own issue, whichever way it is
  settled.
- **The `lowCount >= 2` threshold** in the normal branch means a session where
  every set failed may still get "même charge" rather than a reduction
  (`decisions-spec.md` Q5). Pre-existing, and a question about *when* the load
  drops — #28's subject, not this one.
- **`plank_weighted` carries `unit: "bw"`** while its `r` is a hold in seconds
  (`src/registry.js:170`). It reaches the loaded path and will be grouped like a
  rep exercise, with a rep range read as seconds. Wrong before this change and
  wrong after, in the same way.

## Decisions

Settled 2026-09-14, both as recommended.

1. **`prev` goes through `workingSets` too.** `prevLow`
   (`src/progression.js:94`) counted low sets across the whole previous session
   and carried the identical defect. Leaving one of the two reads on the old rule
   would plant the same bug where nobody would look for it again. Sequencing
   step 3 stands.
2. **`plan.js:125-126` is corrected in this issue.** Its user-visible prose says
   "quand **toutes les séries** d'un exercice atteignent le haut de la
   fourchette", which stops being true: it is now all the sets *at the working
   load*. The spec's "Plan unchanged" meant no new control; this is a sentence.
   Sequencing step 5 stands.

## Open questions

None.
