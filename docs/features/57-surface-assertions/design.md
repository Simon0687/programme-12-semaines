# Design - Surface the six assertions where a program is composed or loaded (#57)

## Summary

Call `assess()` once from `App.jsx` on the bundle the app already builds, render
its findings as one collapsible block at the end of Plan > Programme, and land the
editor's save on Plan. The idea that makes it cheap: `buildProgram(definition)`
([program.js:49](../../../src/program.js#L49)) already returns an object carrying
`SLOTS`, `SESSIONS` and `CORE` - exactly what `resolveWeek()` reads - and it
already falls back to `LEGACY_DEFINITION.program` for a pre-#25 definition. So
`assess(prog)` judges *what the app actually executes*, with no second resolution
path and no new shape to keep in sync. Spec: [spec.md](spec.md); decisions:
[decisions-spec.md](decisions-spec.md).

## Files touched

| File | Change |
|---|---|
| [src/App.jsx](../../../src/App.jsx) | import `assess`; an `advice` memo beside `prog` (~L250); a `ProgramAdvice` component beside `Section`/`Btn` (~L72-100); render it at the end of the `Programme` section (~L1037); `saveDraft` ends on `goPlan()` instead of `goSemaine()` ([L715](../../../src/App.jsx#L715)) |
| [src/display.js](../../../src/display.js) | `adviceSummary(n)`, the count sentence, next to `KIND_LABELS` (~L106) |
| [test/display.test.js](../../../test/display.test.js) | the count sentence, singular and plural |
| [test/assertions.test.js](../../../test/assertions.test.js) | the wiring: a `buildProgram()` bundle is a valid `assess()` input, for both shipped definitions and for one with no `program` |
| [docs/ARCHITECTURE.md](../../ARCHITECTURE.md) | §2, L72-73: "no screen calls it yet, and its tests are its only caller" stops being true |

No new module. `assertions.js` is not touched, and the dependency table of §2 is
unchanged - `App.jsx` is not one of its rows, and `assertions` still imports only
`registry`.

## Approach

**One call, one memo.** Next to the existing `prog` memo:

```js
const advice = useMemo(() => assess(prog), [prog]);   // { ok, findings }
```

No `targets` argument (decision Q1): `hasTargets()` is false, assertions 3, 4 and
6 run, and `assess` appends the `no-declared-intent` finding that says the other
three were not checked. `prog` is memoised on `definition`, so the six assertions
re-run only when the active cycle changes - not on a set, not on a week arrow.

**The block knows nothing about codes.** `ProgramAdvice` receives `findings` and
renders `message` strings in the order `assess` returned them. It never reads
`code`, `muscle` or `block`, which is what makes "the module's messages,
unedited" hold by construction - including for the count, which is
`findings.length`, `no-declared-intent` included. Splitting "real findings" from
"not checked" would mean teaching the screen a vocabulary that belongs to the
module.

```jsx
function ProgramAdvice({ findings }) {
  const [open, setOpen] = useState(false);
  if (findings.length === 0) return null;          // no empty "tout est bon"
  return (
    <div>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="… text-notice">
        {adviceSummary(findings.length)}            {/* « 5 points à regarder sur ce programme » */}
        <ChevronDown className={open ? "rotate-180" : ""} />
      </button>
      {open && <ul>{findings.map((f, i) => <li key={i}>{f.message}</li>)}</ul>}
    </div>
  );
}
```

`useState` + `aria-expanded` rather than the `Section` accordion: `Section` is
already the outer shell here, and nesting one inside another gives a second
`border-b` row and a second title where this is a comment on the section's
subject, not a subject of its own. The chevron and the `rotate-180` come from
`Section` so the gesture reads the same.

**Distinct from the rejection line.** `programError` keeps its
`role="alert"` + `text-alert` at [App.jsx:1026](../../../src/App.jsx#L1026),
glued to the load button. `ProgramAdvice` renders last in the section, after the
cycle switcher and the `unusable` note, with `text-notice`, no `role`, and a
control you have to open. Three separations - place, role, gesture - because
`alert` and `notice` are literally the same amber today
([tailwind.config.js:41-42](../../../tailwind.config.js#L41-L42)). Both are never
on screen at once: a refused file never loads.

**The count sentence, in `display.js`:**

```js
export const adviceSummary = (n) =>
  `${n} point${n > 1 ? "s" : ""} à regarder sur ce programme`;
```

There so it is reachable by `node --test` (ARCHITECTURE §2.6), like
`setSummary()` and `lastEntryLabel()` - `App.jsx` composes no user-facing
sentence of its own.

**The landing screen.** In `saveDraft`, `goSemaine()` becomes `goPlan()`,
unconditionally (decision Q4). Nothing else in the handler moves: the
`validateDefinition` gate, its message and the "Programme enregistré." toast stay
exactly as they are. `resolveScreen` keeps `"plan"`
([screen-state.js:77](../../../src/screen-state.js#L77)) and the screen key is
`sessionStorage`, not the journal - the landing change stores nothing new.

## Sequencing

1. `test(assertions): pin a built bundle as a valid assess input (#57)` - tests
   only, no production change. Asserts `assess(buildProgram(DEFAULT_DEFINITION))`
   and `assess(buildProgram(LEGACY_DEFINITION))` return findings rather than
   `unreadable-program`, and that a definition with no `program` field resolves
   through the legacy fallback. **Safe to merge alone**, and it is the assumption
   the whole design rests on.
2. `feat(display): the advice summary line, singular and plural (#57)` - with its
   test. **Safe to merge alone**: an exported function nobody calls yet.
3. `feat(plan): surface the six assertions on the active program (#57)` - the
   import, the memo, `ProgramAdvice`, and its one render site. This is the step
   that changes what the app shows; after it, both doors are covered, because both
   end in `loadProgram()`.
4. `feat(editeur): saving a program lands on Plan (#57)` - the one-line change at
   L715. Kept separate: it is a navigation decision, not the advice feature, and a
   revert of one should not drag the other (CONTRIBUTING, "one concern per
   commit").
5. `docs(architecture): assertions.js now has a caller (#57)` - §2 L72-73.

## Tests

- **Unit, `node --test`** - `adviceSummary(1)` and `adviceSummary(5)` in
  `test/display.test.js`; the wiring assertions of step 1 in
  `test/assertions.test.js`. The six assertions themselves are already pinned by
  100+ tests and are not re-tested here.
- **No rendering test.** There is no DOM or JSX runner in the repo (`npm test` is
  bare `node --test`, no jsdom) and this issue is not where one gets introduced.
  `ProgramAdvice` is therefore kept to markup plus one boolean, with every
  sentence it shows coming from a tested module.
- **Manual click-through** (`npm run dev`, phone via the LAN URL):
  1. Compose a program, save → lands on Plan, block present, at least « Ce
     programme ne déclare ni cible de volume ni durée de séance… ».
  2. Load Simon's program file → block shows its three findings (duplicate
     horizontal press, abs 8 / rear delt 4, `hautC` at ~64 min).
  3. Load a malformed file → red `role="alert"` line, **no** block.
  4. Switch cycle with the selector → the block follows the active program.
  5. Open and close the disclosure; reload the page → the block is collapsed
     again and nothing was stored.

## Risks & tradeoffs

- **`ok: true` is unreachable in the app for now.** With no targets ever passed,
  `no-declared-intent` is always appended, so every program shows at least one
  item and the "nothing at all" branch of `ProgramAdvice` cannot be produced by
  clicking. It is still the right guard - it is what the intent issue will
  activate - but it is honest to say it is dead code today, and to expect a
  freshly composed program to read « 1 point à regarder ».
- **A count that includes "not checked" can read as one problem too many.** The
  alternative, a screen that filters on `code`, buys a nicer number with a
  vocabulary duplicated between module and view. Rejected: the module owns its
  messages, the view owns none.
- **Storage:** MINOR, as the spec sets. No journal field, no new key; the only
  thing written is the existing `sessionStorage` screen key, which already changes
  on every navigation.
- **Performance:** `assess` resolves two blocks over a week of sessions, memoised
  on `definition`. It is bounded by the program, not by the journal, and runs
  nowhere near a set entry.
- **Backward compatibility:** a journal from 2.0.0 loads unchanged and gains the
  block; a journal saved here loads in 2.0.0 unchanged.

## Out of scope / follow-ups

- **Declaring an intent** (frequency, duration, level, priorities) so assertions 1,
  2 and 5 stop skipping - the collection screens of `decisions-moteur.md` Q4. That
  issue is also what makes the empty state above reachable.
- **`alert` and `notice` being the same amber.** This design works around it with
  place, role and gesture. Giving `notice` a colour of its own is a design-token
  issue, next to the tokens of #51.
- **#23** would eventually pull `ProgramAdvice` out of `App.jsx` with the other
  view helpers. Not folded in here: one concern per commit, and the component is
  eleven lines.

## Open questions

None.
