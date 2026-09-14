# Design - Mark a session as deliberately light (#43)

## Summary

`planned()` learns to skip a base whose `kind` is `"allege"`, exactly as it
already skips a deload, and returns the load of the base it used so the screen can
compare against it. One pure helper, `loadDrops()`, turns that comparison into the
list of exercises that went down. `validate()` gains one argument. See
[spec.md](spec.md) and [decisions-spec.md](decisions-spec.md).

The idea that keeps it small: the engine already had the mechanism — a base it
refuses to read — and it already had the vocabulary — `kind`. Nothing new is
stored beyond one more value in a field the validator does not inspect.

## Files touched

| File | Change | Where |
|---|---|---|
| `src/progression.js` | `SKIPPED_AS_BASE` covers `deload` and `allege`; `planned()` returns `baseLoad`; new pure `loadDrops()`. | `planned()` `:139-146`, return `:173`; helper near `workingSets` |
| `src/App.jsx` | `validate(allege)`; `pendingLight` state and the panel; the drop list built in the loop `validate()` already runs. | `validate()` `:429-443`, the button `:754` |
| `src/display.js` | `KIND_LABELS.allege`; the hollow-dot rule covers `allege`. | `:103`, `:253` |
| `src/plan.js` | One sentence in "Progression et charges". | `:126` |
| `test/progression.test.js`, `test/display.test.js` | New cases; existing assertions untouched. | appended |

No new module: `progression.js` already owns what a base is, and `display.js`
already owns what a `kind` looks like.

## Approach

### The engine refuses one more kind of base

```js
/* Une séance dont on ne repart pas. La décharge y était déjà (#16) ; « allégée »
   est la même idée, décidée par l'utilisateur au lieu du calendrier. */
const SKIPPED_AS_BASE = new Set(["deload", "allege"]);

// dans planned(), en remplacement du test base.kind === "deload"
if (base && SKIPPED_AS_BASE.has(base.kind) && hist.some((e) => !SKIPPED_AS_BASE.has(e.kind))) {
  const nd = hist.filter((e) => !SKIPPED_AS_BASE.has(e.kind));
  base = nd[nd.length - 1]; prev = nd[nd.length - 2];
}
```

The calibration branch still tests `base.kind === "calibration" || base.kind ===
"deload"`, so an `"allege"` base — the case where every session is allégée and
there is nothing else to fall back to — takes the normal branch. That is right:
it carries no programmed cut to explain.

### The screen learns what the engine judged

`planned()` returns `baseLoad` beside `load` / `text` / `why`: the working load of
the base it used, `null` when there is no base or when the unit has no load. The
screen must not recompute it — the whole point is to compare against what the
engine actually read.

```js
planned(...) -> { load, text, why, baseLoad }
```

**Against the base, not against the previous session** (spec, Decision 3). With
"previous session", a second light session at 80 after an allégée 80 shows no drop
and is never offered the question, so it silently becomes the reference and undoes
the first one.

### The rule, pure

```js
/* Les exercices sur lesquels la séance est descendue sous la référence, de plus
   d'un incrément. En dessous, c'est un arrondi — 102,5 devenus 100 faute de
   disques — et ça remonte tout seul à la séance suivante. */
export function loadDrops(entries) {
  return (entries || []).filter(
    (e) => e.baseLoad != null && e.load != null && e.incr > 0 && e.baseLoad - e.load > e.incr
  );
}
```

`entries` are `{ vid, name, load, baseLoad, incr }`. `load` is the working load of
the sets **as they will be stored** — `validate()` fills a blank weight from
`planned()` first (`src/App.jsx:437-439`), so the list is built after that fill,
inside the same loop.

### The panel

```js
const [pendingLight, setPendingLight] = useState(null); // [{name, load, baseLoad}] | null

const validate = (allege = false) => {
  updateActive((st) => {
    /* …le remplissage des poids vides, inchangé… */
    const kind = log.done ? (cur.kind ?? computeKind(week)) : (allege ? "allege" : computeKind(week));
    return { ...st, logs: writeLog(st.logs, d, session.id, { ex, done: true, kind }) };
  });
  setPendingLight(null);
  showToast(`${session.name} validée`);
};

const askThenValidate = () => {
  const drops = log.done || computeKind(week) !== "normal" ? [] : loadDrops(entriesOfSession());
  drops.length ? setPendingLight(drops) : validate(false);
};
```

Three guards, each from a settled decision: `log.done` (Q1-A, ask once),
`computeKind(week) !== "normal"` (spec — weeks 1 and 7 carry a `kind` that drives
the engine and a light week 7 is the programme working), and a non-empty drop
list.

The panel replaces the button, markup copied from `pendingImport`
(`src/App.jsx:905-914`): one line per dropped exercise, the consequence sentence
(numbers when there is one exercise, generic beyond), then two 48 px buttons, both
`Btn` without `primary` — a choice with no right answer carries no default.

## Sequencing

1. **`feat(progression): a session marked allégée is never read as a base (#43)`**
   `SKIPPED_AS_BASE` and `baseLoad`. **Safe to merge alone** — no journal carries
   `"allege"` yet, so behaviour is unchanged and the tests prove it.
2. **`feat(progression): loadDrops names the exercises that went down (#43)`**
   The pure helper and its tests. Called from nowhere.
3. **`feat(seance): the question at validation, and the allégée flag (#43)`**
   `App.jsx`: the panel, `validate(allege)`, the `kind` preservation on update.
   The commit that changes what the user sees.
4. **`feat(fiche): an allégée session is marked like a deload (#43)`**
   `display.js`: the pill and the hollow point.
5. **`docs(plan): a session marked allégée does not move your references (#43)`**

Steps 1 and 2 change nothing observable; 3 to 5 must land together to satisfy the
acceptance criteria.

## Tests

**Unit, `node --test`** — `loadDrops` on: a drop worth more than the increment, a
drop of exactly one increment (no), a drop of less (no), a missing `baseLoad`
(first time on an exercise, no), several exercises dropping, and `incr`
absent/zero.

**Integration on `planned()`** — an allégée base is skipped and the suggestion
comes from the session before it (`102,5` after `8 @ 100` then an allégée
`8 @ 80`, never `82,5`); an allégée base with nothing before it takes the normal
branch; `baseLoad` carries the base's working load and is `null` with no history
and on `time` / `reps` units.

**Display** — `KIND_LABELS.allege` renders "allégée"; `chartGeometry` draws an
allégée point hollow.

**Regression** — the 417 existing tests pass **unmodified**.

**Manual** — the panel itself: it has no logic worth a test beyond `loadDrops`,
but its wording and the two-button layout are worth one look on the phone.

## Risks & tradeoffs

- **An old build reading a journal that carries `"allege"`.** It treats it as an
  unknown kind: `KIND_LABELS` renders no pill and `planned()` reads it as a normal
  base. Degraded, never broken — which is what keeps this MINOR.
- **`validate()` preserving `kind` on an update** changes one existing behaviour:
  today a session revalidated in a different week would be re-stamped. That cannot
  happen in practice — a log is keyed by its slot date — and the preservation is
  what Q1-A requires.
- **Rejected: a new boolean field** (`light: true`) rather than a `kind` value.
  It would need the validator, the migration question and a second concept where
  `kind` already means "what sort of session was this"; and `planned()` would
  grow a second reason to skip a base.
- **Rejected: comparing against `planned().load`.** Fires every session in a gym
  without small plates (`decisions-spec.md` Q2-A).

## Decisions

Settled 2026-09-14 with the spec round; nothing is left open at design level.

## Open questions

None.
