# Spec - Name the design intentions (#51)

## Context

The app has no design layer. `input.css` is six lines — three Tailwind directives
and three resets — and `tailwind.config.js` carries `theme: { extend: {} }`. Every
colour is a literal utility class inline in the JSX: **220 colour utilities** across
`src/App.jsx` and `src/ExerciseSheet.jsx`, plus `bg-slate-900` on `<body>` in
`public/index.html`.

The cost is not that a colour is hard to change; it is that no intention has a
name, so intentions cannot be separated. `text-amber-400` means eleven different
things — the planned load, the set in progress, a load error with `role="alert"`,
a storage warning, the active tab, "à remplir", the volume counts, the curve…
Taking alerts out of the accent (triage finding C2) is therefore a find-and-replace
that hits ten unrelated places.
([#51](https://github.com/Simon0687/programme-12-semaines/issues/51), blocks
[#49](https://github.com/Simon0687/programme-12-semaines/issues/49))

## Scope

- **In:** a token vocabulary declared in `tailwind.config.js`, and the mechanical
  rewrite of `src/App.jsx`, `src/ExerciseSheet.jsx`, `src/LoadPicker.jsx` and
  `public/index.html` to use it. Each token resolves to the exact literal the code
  uses today.

  `src/LoadPicker.jsx` was missed when this spec was first written: it arrived with
  #46, after the triage whose inventory the issue quotes. The criterion is "no
  literal anywhere", so it is in — the point of the issue would be lost by leaving a
  third component naming its own colours.
- **Out:** re-assigning any meaning — including taking alerts out of the accent,
  which is C2 and is deliberately left visible-and-unfixed here. Typography and
  spacing tokens. The `design/` mockups and the archived Nocturne stylesheet, which
  are reference material and are not built.

## User-facing behaviour

**None, on any tab.** That is the requirement, not a side effect: `alert` and
`accent` both resolve to `amber-400` on the day this lands. Simon should be unable
to tell the branch from `main` by looking at Semaine, Séance, Fiche exo or Plan,
including their error, warning and empty states.

The property is what makes the change reviewable — the diff is mechanical, so any
visual difference is a mistake rather than a decision — and what makes #49 cheap
afterwards: separating two meanings becomes an edit to one config line.

## Acceptance criteria

- [ ] Given `tailwind.config.js`, when read, then `theme.extend.colors` declares the
      vocabulary, each entry naming the literal it replaces.
- [ ] Given `src/` and `public/index.html`, when grepped for `slate-`, `amber-` and
      `emerald-`, then there is no match — including the `accent-color` utility
      (`accent-amber-400`, `src/App.jsx:1085`, `:1105`), which no colour-utility
      inventory catches because `accent-` is not one of the usual prefixes.
- [ ] Given the eleven amber meanings, when mapped, then meanings that may later
      diverge carry different tokens, even where those tokens resolve to one value.
- [ ] Given each screen — Semaine, Séance, Fiche exo, Plan — when compared before
      and after, then the rendering is identical, states included: a load error, the
      storage-unavailable warning, an empty bilan, a set done / in progress / to come,
      the chart with and without bars.
- [ ] Given `npm run build:css`, when run, then it succeeds **and** every token class
      used in the source is present in `public/dist/app.css`: a token absent from the
      config emits no class and fails silently as an unstyled element, so a green
      exit code proves nothing on its own.
- [ ] Given the CSS rebuilt from the pre-change sources, when the emitted colour
      values of both builds are compared, then they are identical — same values, same
      number of elements carrying each. This is the machine-checkable half of "no
      pixel moves"; the screen-by-screen look above is the other half.
- [ ] `npm test` is green (458/458 at the time of writing).

## Data & storage impact

**None.** The journal `prog12_simon_v1` is neither read nor written by any file this
issue touches; `SCHEMA_VERSION` is untouched. Per CONTRIBUTING.md this is a **PATCH**:
no intended behaviour changes, and a journal saved by the previous version loads
identically — it is not even in the code path.

Workflow level per `.claude/WORKFLOW.md`: **B**. Q1 (does a stored journal read
differently?) no, Q2 (shape or persistence?) no, Q3 (architecture or new capability?)
no — a token vocabulary is a naming convention over existing presentation. Q4 yes:
two components, and a failure mode that is silent. None of the sensitive modules is
touched. Hence this short spec, then code and a visual pass.

## Edge cases

- **A token missing from the config.** Tailwind emits nothing; the element renders
  unstyled instead of erroring. This is the only real risk in the issue, and it is
  why the acceptance criteria demand a screen-by-screen look rather than a build.
- **Dynamic class strings.** Several classes are built by ternary inside template
  literals (`src/App.jsx:199`, `:212`, `:907`, `:1029-1030`). The full class name
  must stay literal in the source — Tailwind scans text, it does not evaluate —
  so no `text-${tone}` interpolation may be introduced while rewriting.
- **SVG utilities.** `fill-`, `stroke-` and `divide-` variants must be covered too
  (`src/ExerciseSheet.jsx:78-119`, `:274`), not just `text-` and `bg-`.
- **`public/index.html`.** In the Tailwind `content` globs and carrying one literal;
  easy to miss because it is not a component.

## Out of scope / follow-ups

- **Collapsing the slate ladder.** Twelve shades are in use, more than the screen
  distinguishes — but merging two of them moves pixels, which contradicts the
  guarantee above. Rename one-to-one now; propose the merges as their own issue,
  where each is a deliberate visual decision.
- **Typography and spacing tokens.** The hierarchy work lives in #49 and, later, on
  the Séance screen.
- **C2 proper** — one meaning per colour — which this issue exists to make possible.

## Open questions

Answered by Simon on 2026-09-15, by validating the spec with its recommendations.

1. **How fine is the amber family?** Grouped, not one token per meaning: `accent`
   (planned load, set in progress, active tab, volume counts, primary button, toast,
   "aujourd'hui"), `alert` (load and import errors, `role="alert"`), `notice`
   (storage warning, cycle note, "à remplir"), `badge` (échec OK, AMRAP), plus
   `focus` for the rings and `data-mark` for the curve and the dominant muscle. Six
   tokens, one value. C2 only needs `alert` to leave the family; the rest can travel
   together until something says otherwise.
2. **Naming style for the neutral ladder:** by role. One adjustment made while
   coding — the text roles are named `ink`, not `text`, because the role name is
   already inside the utility: `text-text-muted` is unreadable where `text-ink-muted`
   is not. Surfaces and rules keep the plain role words.
3. **`emerald-400` becomes `done`**, not `success`: it marks a validated set, session
   and week, never a generic success.
