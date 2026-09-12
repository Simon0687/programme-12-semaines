# Decisions - Sauvegarder le journal avant la première écriture post-migration (#8)

Source: spec.md
Scope: product / requirement choices only - what is copied, when, what happens when
the copy fails, and whether the copy is reachable from the app. Implementation
mechanics (where in the hydration effect the write goes, how `STORE` is faked in
tests, the exact toast wording) belong to the design round and land in a sibling
`decisions.md` after `/design-tech 8`.
Status: resolved 2026-09-08 - Simon accepted every recommendation (A / A / A / A).

---

## Q1 - Key naming, and Q3 - how many copies

*Asked together, since both answer "what exactly gets stored".*

**Question.** The issue proposes `prog12_simon_v1_backup_pre<N>`. Is that the shape,
and on a multi-step migration (v1 → v3, once #6 and a later issue exist) do we keep
only the original or every intermediate state?

**Option A - One copy per source version, original only**
- What it means: the key is `prog12_simon_v1_backup_pre<N>` where `N` is
  `versionOf(stored)` before migrating - so an unversioned v1.0.0 journal yields
  `…_backup_pre1` (`src/schema.js:23-26`). It is written once and never overwritten.
  A v1 → v3 migration stores the v1 original and nothing else.
- Implications: at most one key per major the journal has lived through. The
  intermediate v2 state is not stored because it is reproducible - re-running
  `applyChain(original, 2)` regenerates it exactly.
- Pros: matches the issue's own wording; bounded number of keys; "never overwrite" is
  meaningful because the key identifies a unique event.
- Cons: if two different bugs corrupt from the same source version on two occasions,
  the second is not captured - but the first copy is the valuable one, since it is
  the untouched original.

**Option B - Timestamped key, several copies per version**
- Implications: unbounded growth with no pruning strategy, and no scenario where the
  second copy from the same source version is the one you want.
- Cons: accumulation for no benefit.

**Option C - One copy per migration step**
- Implications: stores intermediates that `applyChain` can recompute from the
  original.
- Cons: pays storage for derivable data; no long chain exists yet to justify it.

**Recommendation. A.**

**Simon's decision.** A (2026-09-08).

---

## Q2 - What happens when the backup write fails

**Question.** The migrated shape reaches storage through the debounced save
(`src/App.jsx:192-204`), enabled by `skipSave.current = false` at `:177`. If the
backup write throws, do we still let that save run?

**Option A - Block saving for the session**
- What it means: `storageOk` goes false, which the save effect already honours
  (`src/App.jsx:194`), and a toast explains that the journal could not be secured. The
  migrated data stays usable in memory; the stored original is untouched.
- Implications: identical posture to the existing `tooNew` branch
  (`src/App.jsx:180-185`), so there is one consistent rule - when we cannot guarantee
  safety, we stop writing. Simon can still export the JSON by hand from the Plan tab.
- Pros: the original journal is never overwritten without a copy; consistent with
  existing behaviour; the practical loss is small, since a storage layer that just
  refused a write would very likely refuse the save too.
- Cons: a session's entries are not persisted if the failure is transient and
  specific to that one write.

**Option B - Proceed with a warning**
- Implications: the app saves the migrated shape over the original with no copy -
  exactly the scenario #8 exists to prevent, now happening with a toast attached.
- Pros: the user keeps saving.
- Cons: converts the feature into a formality precisely when it is needed.

**Recommendation. A.** A net that failed to deploy should stop the jump.

**Simon's decision.** A (2026-09-08).

---

## Q4 - Is the backup reachable from the app?

**Question.** The issue's acceptance criterion asks only that the key be
*documented*, "pour permettre la récupération sans lire le code". But the app runs on
a phone, where inspecting localStorage by hand is not realistic.

**Option A - A button in the Plan "Données" section**
- What it means: shown only when a backup key exists, it dumps the copy into the
  existing `ioText` textarea, reusing the "Afficher le JSON" pattern
  (`src/App.jsx:467`). From there it is copied out with the existing clipboard
  helper.
- Implications: a few lines and no new component. Goes beyond the issue's literal
  criteria, which is why it was raised rather than assumed. Also means the copy is
  *reachable* precisely during #6, when the first real migration runs.
- Pros: makes the safety net usable on the device where the data lives; the recovery
  path is then verifiable by clicking, not just describable in a document.
- Cons: adds a control to the Plan tab for a case that should never happen; makes
  #8 a `feat` rather than a pure `chore`.

**Option B - Documentation only**
- Implications: recovery requires a desktop browser, a cable or a synced profile, and
  devtools. In the moment it is needed - a bad migration on a phone, mid-cycle - that
  is not a procedure anyone will execute.
- Pros: minimal scope, matches the issue exactly.
- Cons: a backup that cannot be reached from where it is stored is closer to
  reassurance than to insurance.

**Option C - Button in a follow-up issue**
- Implications: leaves a window where the copy exists but is unreachable - and that
  window is #6, the highest-risk moment.
- Cons: defers the part that makes the rest useful.

**Recommendation. A.** Storing a copy nobody can retrieve is only half the feature.

**Simon's decision.** A (2026-09-08).

---

## How to apply

The answers are folded into `spec.md`: **## Open questions** now reads as resolved,
Scope keeps the blocking-save rule from Q2 and the recovery button from Q4, and the
User-facing behaviour section describes the button's empty and populated states. The
version note stands: `chore` does not bump on its own, but Q4's button is a small
`feat` that rides the batch's minor. `design.md` is written assuming A / A / A / A.
