# Spec - End of cycle: « Continuer ce programme » as the default door (#77)

## Context

When `at.week > definition.weeks`, the Semaine screen shows one sentence —
"Les 12 semaines sont terminées : bilan et programme suivant." (`cycleNote`,
`src/App.jsx`) — and no door. The only way on is Plan → Programme → Nouveau
programme, where « Générer », « Composer », « Charger » and « Partir du programme
actif » weigh the same. The app itself pushes a program change every twelve
weeks. The direction settled on 2026-09-24 (philosophy study §6.7): twelve-week
chapters chained without a break — **continuing is the default path, changing
program is a decision.** #74 (merged) provides the carried loads and
`nextCycleFrom()`. [#77](https://github.com/Simon0687/programme-12-semaines/issues/77)

## Scope

- **In:** an end-of-cycle block on the Semaine screen, from the last week of the
  cycle onward: a short review, « Continuer ce programme » (primary), « Changer de
  programme » (secondary).
- **Out:** an endless cycle; changing week-1 calibration for continued cycles;
  realised volume per group (#73, parked); per-exercise record tables (the
  exercise sheet already has them).

## User-facing behaviour

**Semaine**, when today is in the last week of the cycle or after it, above the
session list:

- Title: `Dernière semaine du cycle` (week 12), or `Cycle terminé` (after).
- Review, three lines at most per exercise, key exercises only (`SLOTS[].key`):
  `Développé couché haltères : 22 → 30 kg / main` — first and last working load
  of the cycle. Plus one line: `41 séances sur 48`.
- **« Continuer ce programme »** — primary. Opens the editor with the same
  structure, carried loads with their provenance, start next Monday
  (`nextCycleFrom()`). Saving starts the new cycle at week 1 (calibration).
- **« Changer de programme »** — secondary. Opens Plan → Programme with the
  creation doors already unfolded.
- The old sentence is replaced by this block after the cycle; before the start,
  its "Le programme commence …" sentence is unchanged.

**Plan, Séance, Bilan** — unchanged.

## Acceptance criteria

- [ ] Given today is after week 12, then Semaine shows `Cycle terminé`, the
      review and both buttons; « Continuer ce programme » is the primary one.
- [ ] Given today is in week 12, then the same block shows under `Dernière
      semaine du cycle`.
- [ ] Given weeks 1–11, then no block.
- [ ] « Continuer ce programme » opens the editor on next Monday with carried
      loads; saving activates the new cycle at week 1.
- [ ] « Changer de programme » lands on Plan → Programme with the doors open.
- [ ] A key exercise never logged in the cycle shows no line; a cycle with no
      session at all shows `0 séance sur 48` and both buttons.
- [ ] The review is a pure, tested function; no calculation in the component.
- [ ] `npm test` green.

## Data & storage impact

None new. The review reads the active cycle; « Continuer » writes an ordinary new
cycle, exactly as « Partir du programme actif » does since #74. **MINOR.**

## Edge cases

- **Cycle ended months ago:** start date is still next Monday from today.
- **Week 12 is a deload (forced):** the block still shows; it is about the
  calendar, not the phase.
- **Substituted key exercise (#55):** the line follows the exercise actually
  logged (`history()` is keyed by exercise id).

## Out of scope / follow-ups

- Skipping calibration for exercises whose carried load is fresh (discussed
  2026-09-24): a change to `phaseFor` / `computeKind`, level A — only if the
  uniform calibration week proves too cautious in use.

## Open questions

None. Settled under Simon's delegation of 2026-09-24 ("spec, design, code et
merge"): calibration stays uniform in week 1; the block shows from week 12; the
review is limited to key exercises and the session count.
