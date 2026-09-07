# Decisions - Extract the Plan tab content (#4)

Source: spec.md
Scope: product / requirement choices only - where the plan data module lives, how
structured the content is, and how far the extraction reaches into engine and
Séance-tab code. Implementation mechanics (renderer component name, block field
names, commit split) belong to the design round and land in a sibling
`decisions.md` after `/design-tech 4`.
Status: resolved 2026-09-07 - Simon accepted every recommendation (A / A / A / A).

---

## Q1 - Module path: `src/plan.js` or `src/data/plan.js`

**Question.** #3 explicitly deferred the directory convention to "when #4 starts"
(`docs/features/3-extract-program-data-module/spec.md`, Out of scope). The issue
bodies for #4-#6 all write `src/data/plan.js` / `src/data/profil.js`, but #2 and
#3 created and settled a flat layout: `src/program.js`, `src/progression.js`,
`src/schema.js`, all imported as `./program.js` etc. from `src/App.jsx:3-5` and
`test/progression.test.js:4-5`. #4 introduces the first new module since then and
sets the pattern #5 and #6 copy. Unanswered, the developer picks silently.

**Option A - `src/plan.js` (flat, matches #2/#3)**
- What it means: the new module is `src/plan.js`, imported as `./plan.js` from
  `src/App.jsx`. #5 later adds `src/profil.js`, #6 works from the same folder.
- Implications: no file moves, no import-path edits anywhere, the `src/data/`
  wording in issues #4-#6 is recorded as superseded. Consistent with the four
  modules already in `src/`.
- Pros: zero churn; one obvious convention; nothing in `test/` is touched;
  matches the reasoning #3 used to keep `src/program.js` where #2 put it.
- Cons: the issue body's literal path is not honoured; a reader comparing issue
  to code sees a discrepancy until the issues are updated.

**Option B - `src/data/plan.js`, and move the other three modules too**
- What it means: `mkdir src/data`, `git mv` `program.js`, `progression.js`,
  `schema.js` into it, add `src/data/plan.js`, update every import in
  `src/App.jsx`, `src/progression.js`, `src/main.jsx`, `test/progression.test.js`
  and `test/schema.test.js`.
- Implications: touches both test files' import lines for zero behaviour reason;
  larger diff mixed into a content-extraction issue; but the epic's stated layout
  is realised in one move.
- Pros: matches the issue wording; one folder for all data; #5/#6 unambiguous.
- Cons: churn unrelated to #4's purpose; CONTRIBUTING's "one concern per commit"
  pushes this into its own rename ticket anyway; more merge surface against `dev`.

**Option C - `src/data/plan.js` only, leave the other three in `src/`**
- What it means: just the new module goes under `src/data/`.
- Implications: data modules split across `src/` and `src/data/` with no rule for
  which is where; #5 inherits the confusion.
- Pros: literal issue path, small diff.
- Cons: the worst of both - an inconsistent layout that someone has to fix later.

**Recommendation. A.** `src/plan.js`. It is the only option that adds nothing but
the new file, keeps the test suite untouched, and gives #5/#6 a single rule.
Treat `src/data/*` in the issue text as pre-#2 wording. If Simon still wants the
folder, Option B as a standalone `refactor(modules): …` ticket before or after
#4 is cleaner than folding it in here. Reversible: a later `git mv` moves every
module together cheaply.

**Simon's decision.** A (2026-09-07).

---

## Q2 - How structured is the plan content

**Question.** The issue Notes: "Define one block type per rendering shape rather
than a single format that forces contortions." The Plan tab
(`src/App.jsx:459-524`) has four shapes: an intro line, rich paragraphs, a
2-column table (week structure, `src/App.jsx:461-467`), and a 3-column table
(volume, `src/App.jsx:471-490`, count cell styled `text-amber-400 text-right`).
How much of that structure moves into data?

**Option A - Typed block tree**
- What it means: `plan.js` exports an array of sections, each
  `{ id, title, open, blocks: [...] }`; a block is `{ type: "p", text }` or
  `{ type: "table", variant: "weeks" | "volume", rows }`. `App.jsx` gets a small
  `<PlanContent>` / `<Block>` renderer that switches on `type`; the existing
  `Section` component is reused for the wrapper.
- Implications: `App.jsx`'s `tab === "plan"` block shrinks to
  `PLAN.map(s => <Section …><Blocks blocks={s.blocks} /></Section>)` plus the
  untouched "Données" section. New ~25-line renderer. This is the shape #6 needs
  to accept a plan from a JSON file, and the shape #5 extends with interpolated
  personal values.
- Pros: matches the issue Notes exactly; each shape rendered by one code path;
  editing content never touches `.jsx`; forward-compatible with #5/#6.
- Cons: a renderer component to write and test; slightly more up-front design
  than a flat object.

**Option B - Strings and rows per section, JSX skeleton stays**
- What it means: `plan.js` exports `{ intro, structure: { rows, note },
  volume: { rows, note }, progression: [p1, p2, …], deload: […], … }`. `App.jsx`
  keeps one hand-written `<Section>` per key, still holds the `<table>`/`<p>`
  markup, just reads text from `plan.js`.
- Implications: smaller diff, no new renderer. But `App.jsx` still "contains" the
  Plan tab's structure (nine bespoke Section blocks), so the issue's "the
  `Section` component consumes that data instead of containing it" is only half
  met, and #6 still has JSX per section to convert.
- Pros: least code; low regression risk; each section's markup stays explicit.
- Cons: doesn't satisfy the issue's intent; #6 pays the rest of the cost;
  adding/reordering a section still edits `.jsx`.

**Option C - Generic rich text (markdown string per section)**
- What it means: store each section as a markdown blob, render with a parser.
- Implications: pulls in a dependency or a mini-parser; tables in markdown lose
  the amber-count styling; hard to target a value for #5's interpolation.
- Pros: content is very easy to edit.
- Cons: over-engineered for nine static sections; the volume table fights
  markdown; rejected.

**Recommendation. A.** Typed blocks with the smallest vocabulary that covers the
four shapes (`section`, `p`, `table` with `variant`). It is what the issue asks
for, it is the only option that fully moves the structure out of `App.jsx`, and
#5 and #6 both build directly on it. Reversible: the block shape is internal, a
later issue can reshape it.

**Simon's decision.** A (2026-09-07).

---

## Q3 - The `phaseOf()` editorial notes

**Question.** `phaseOf(w)` in `src/progression.js:23-28` returns
`{ id, label, rir, note }` for each of the five phases. `note` is a 1-2 sentence
editorial string ("Volume -50 %, charges -15 %, 3-4 RIR, cardio Z2 facile…"),
used only for display at `src/App.jsx:380` (Séance sub-header) and
`src/App.jsx:412` (Semaine lead line). `.rir` is used inside `planned()`
(`src/progression.js:63`); `.label`/`.id` are display-only. #3's spec lists
"relocate the `phaseOf()` editorial notes" as #4's job. Does #4 do it?

**Option A - Split `note` out into the plan module**
- What it means: `phaseOf()` returns `{ id, label, rir }`. `plan.js` exports
  `PHASE_NOTES = { calib: "…", b1: "…", deload: "…", b2: "…", bilan: "…" }`.
  `App.jsx:380` and `:412` render `PHASE_NOTES[phase.id]` instead of
  `phase.note`.
- Implications: `src/progression.js` header note about the notes "travelling
  here temporarily" (`src/progression.js:9-10`) is removed. No test change:
  `test/progression.test.js` asserts on `V.*.start`, `V.*.incr`, `SLOTS.*.reps`,
  `p.load`, `p.text`, `p.why` - never on `phaseOf().note` (checked line by line).
  The `import … phaseOf …` line in `App.jsx:5` stays; a new `PHASE_NOTES` name
  joins the `./plan.js` import.
- Pros: the engine module stops carrying editorial copy; all program prose ends
  up in one place; matches #3's stated plan; genuinely test-safe.
- Cons: one phase concept (`phaseOf`) now has its display text in a different
  file from its logic - a reader chasing the Séance sub-header text has one more
  hop.

**Option B - Leave `phaseOf()` whole**
- What it means: `note` stays on the object; #4 touches only the `tab === "plan"`
  JSX.
- Implications: `src/progression.js` keeps five editorial strings and its
  "temporary" header caveat becomes permanent. #4's spec drops the relocation
  bullet.
- Pros: `phaseOf` stays a single self-contained source of phase facts; smallest
  #4 diff.
- Cons: contradicts #3's handoff; the engine module keeps prose that has nothing
  to do with computing a load; #6 (plan-from-file) will want the phase notes to
  be data anyway.

**Recommendation. A.** Move the five strings to `PHASE_NOTES` in the plan module.
It is test-safe, it is what #3 planned, and it leaves `src/progression.js` as
pure engine. Keep `phaseOf()` returning `id`/`label`/`rir` so every current
caller keeps working. Reversible: re-inlining five strings is trivial.

**Simon's decision.** A (2026-09-07).

---

## Q4 - The `todayLine` cardio fragments

**Question.** `src/App.jsx:325-331` builds the "Aujourd'hui, …" line on the
Séance tab. Line 329 hardcodes four cardio phrases by weekday: `" puis rameur
Z2"` (Wed), `"rameur intervalles + mobilité"` (Thu), `"rameur Z2 + mobilité"`
(Sun), `" puis mobilité"` (Tue). #3 said to "fold [these] into #4". The rest of
`todayLine` is date/session logic (`dayIdx < 0`, `dayIdx >= 84`, `SESSIONS.find`
by weekday). How far does #4 reach here?

**Option A - Move the four strings into data, leave the rest**
- What it means: the phrases become e.g. `CARDIO_DAY_NOTES` in `program.js`
  (cardio structure already lives there since #3) or a small map in `plan.js`,
  keyed by weekday or by a semantic key; `todayLine` reads them.
- Implications: `src/App.jsx:329`'s inline ternary chain is replaced by a lookup;
  no change to the `dayIdx`/session branches. `program.js` already exports
  `CARDIO_ITEMS` / `MOB_DAYS`, so the phrases sit with kin.
- Pros: removes the last hardcoded cardio copy from `App.jsx`; small, contained;
  honours #3's handoff.
- Cons: `todayLine` still composes the sentence in `App.jsx` - a mixed concern,
  though the editorial pieces are now external.

**Option B - Leave `todayLine` fully intact**
- What it means: #4 stays strictly inside the `tab === "plan"` block; the
  `todayLine` cleanup becomes a separate follow-up.
- Implications: `App.jsx` keeps four cardio phrases after #4; a "no cardio copy
  in App.jsx" reader finds them.
- Pros: tightest possible #4 scope; `todayLine` is Séance-tab glue, not Plan
  content.
- Cons: leaves a known thread hanging that #3 explicitly assigned to #4; someone
  has to open another issue for four strings.

**Recommendation. A**, with a hard boundary: only the four quoted phrases move,
and `todayLine`'s date/session logic is not otherwise touched. It clears #3's
handoff in a few lines. If it turns out to entangle with the sentence assembly
more than expected, fall back to B and open a follow-up. Reversible: trivially.

**Simon's decision.** A (2026-09-07).

---

## How to apply

Once Simon fills in each "Simon's decision", fold the answers into `spec.md`:
resolved points move out of **## Open questions** (which then ends as "None") into
Scope / Acceptance criteria. Q1 → the design's **Files touched** names the chosen
path; if Option B, add the `git mv` + import edits as a *separate* preceding
ticket, not part of #4. Q2 → Option A is assumed by the design; Option B would
cut the renderer step and enlarge the `App.jsx` diff. Q3 Option B → drop the
`phaseOf()` bullet from Scope and the matching acceptance criterion. Q4 Option B
→ move that bullet to Out of scope / follow-ups and open a new issue. The design
(`design.md`) will be written assuming A / A / A / A; revisit it only if a
decision differs.
