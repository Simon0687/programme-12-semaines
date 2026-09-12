# Decisions - Persistent error message when a pasted JSON import is rejected (#7)

Source: spec.md
Scope: product / requirement choices only — which rejection states exist and what
the user reads. Implementation choices (module shape, state placement, rendering)
belong to the later `/design-tech` round and will be recorded in `decisions.md`.
Status: resolved 2026-09-08 — both questions Option A. Folded back into `spec.md`.

## Q1 - Dedicated reason for a migration failure

**Question.** `importData()` (`src/App.jsx:313`) wraps everything in one
`try/catch`, so any throw becomes "JSON invalide". `migrate()` (`src/schema.js:50`)
can throw through `applyChain()` (`src/schema.js:37`,
`Migration manquante depuis la vN`). Should a migration failure get its own
rejection reason and message, or keep falling into the malformed-JSON branch?

**The spec was wrong about this, and it changes the answer.** `spec.md` calls the
case "unreachable at v1". It is not. `versionOf()` (`src/schema.js:23`) accepts any
integer, including zero and negatives, so a pasted journal carrying
`"schemaVersion": 0` reaches `applyChain` with `from = 0`, finds no `MIGRATIONS[0]`,
and throws — today, with `MIGRATIONS` empty. Verified:

```
{ schemaVersion: 0,  logs: {} } -> versionOf=0  THROWS: Migration manquante depuis la v0
{ schemaVersion: -3, logs: {} } -> versionOf=-3 THROWS: Migration manquante depuis la v-3
{ schemaVersion: 1.5, logs: {} } -> versionOf=1  OK
```

So the app currently tells a user their file is "JSON invalide" when the JSON is
perfectly valid. Left unanswered, that misleading message ships as-is — and #6,
which introduces the first real `MIGRATIONS` step, widens the path.

**Option A - Add a fourth reason `migration-failed`**
- What it means: `parseJournalImport()` catches a throw from `migrate()`
  separately and returns its own message ("Ce journal n'a pas pu être mis à jour
  vers le format actuel.").
- Implications: one extra branch in `src/import.js`, one extra case in
  `test/import.test.js` (provable today with `schemaVersion: 0`, no fake
  migrations needed). Nothing in `src/schema.js` changes, so
  `test/schema.test.js` stays untouched. #6 inherits a reason that already fits
  its first migration.
- Pros: stops blaming the user's file for an app-side failure; the case is real
  now, not speculative; the test is cheap and honest.
- Cons: one more message to maintain and, later, to translate.

**Option B - Leave it in the malformed-JSON branch**
- What it means: a `migrate()` throw keeps producing "Le texte collé n'est pas du
  JSON valide."
- Implications: `src/import.js` stays at three reasons. When #6 ships
  `MIGRATIONS[1]`, any migration bug surfaces to the user as "invalid JSON", and
  to you as a misleading bug report.
- Pros: smaller surface; defers a decision until #6 forces it.
- Cons: knowingly ships a wrong message for a reachable input. Costs more later,
  when the same discovery has to be made again from a confusing report.

**Recommendation.** **A.** The case is reachable today, and the current message is
actively false. It is three lines and one test. Fully reversible — deleting a
reason is a local edit to `src/import.js` and its test.

**Simon's decision.** **Option A**, 2026-09-08. `parseJournalImport()` gets a
fourth reason `migration-failed`, proven in `test/import.test.js` with
`schemaVersion: 0`.

## Q2 - Wording of the three rejection messages

**Question.** `spec.md` proposes wording that no issue specified. The open point is
the register: "Ce JSON ne contient pas de journal (clé « logs » absente)" names an
internal field. Right for a developer reading his own export; possibly wrong for
the public audience the app is being aimed at.

**Option A - Keep the proposed, precise wording**
- What it means: messages name what actually failed, including `logs`.
- Implications: strings live in `src/import.js` next to each reason; changing them
  later is a one-line edit with no storage or test-fixture impact beyond the
  assertions in `test/import.test.js`.
- Pros: today the app has one user, and precision is what makes a failure
  diagnosable. Matches the existing register of the panel, which already says
  "exporte le JSON et colle-le" (`src/App.jsx:464`).
- Cons: "clé « logs »" means nothing to a stranger.

**Option B - Plain wording now, no internal names**
- What it means: e.g. "Ce fichier ne ressemble pas à un journal exporté par
  l'appli."
- Implications: same edit surface. Loses the detail that distinguishes a
  truncated export from an unrelated JSON file.
- Pros: ready for a public audience without a later pass.
- Cons: pays today for an audience that does not exist yet, and makes your own
  debugging vaguer in the meantime. The public-facing wording pass is its own
  piece of work (it also covers the panel prose, not just these three lines).

**Recommendation.** **A**, with the wording pass deferred to the public-readiness
work, where the whole panel gets reviewed together rather than three strings in
isolation. Reversible at any time: these are string literals with no persistence.

**Simon's decision.** **Option A**, 2026-09-08. The proposed wording ships as-is;
the plain-language pass happens with the public-readiness work, panel-wide.

## How to apply

Once each "Simon's decision" is filled in, the answers fold back into `spec.md`:

- the resolved points move out of `## Open questions`, which ends as "None";
- **Q1 additionally requires a correction, whatever the choice.** The
  `migrate() can throw` bullet under `## Edge cases` claims the case is
  "unreachable at v1 (`MIGRATIONS` is empty)". That is false — `schemaVersion: 0`
  reaches it today. Replace the claim, and add an acceptance criterion covering a
  pasted journal with a non-positive `schemaVersion`;
- if Q1 lands on A, add the fourth reason to the `## Scope` "In" list, which
  currently promises "three distinguishable rejection reasons".

## Follow-up found while deciding

Filed as [#10](https://github.com/Simon0687/programme-12-semaines/issues/10)
(`fix`, `priority: high`, milestone *Configurable program*).

`versionOf()` accepting `0` and negative integers is a `src/schema.js` weakness of
its own, and the import path is not where it bites hardest: at **load**, a stored
journal with `schemaVersion: 0` makes `migrate()` throw inside the `try` at
`src/App.jsx:167-189`, whose `catch` is commented "première utilisation : clé
absente" — a corrupt journal is silently treated as no journal, and the autosave
then overwrites it. That is a data-loss path, close in spirit to #8, and it
deserves its own issue rather than being smuggled into #7.
