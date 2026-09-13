# Spec - Semaine becomes the entry point: Séance is a screen, not a tab (#41)

## Context

The app opens on Séance and guesses which session to show (`App.jsx:279-288`).
Because Séance can be entered without choosing, it must carry its own choosers —
week arrows (`App.jsx:465-474`) and a session chip rail (`App.jsx:487-497`) —
which, with the "Aujourd'hui, …" line and a redundant session title, put roughly
262 px of chrome above the first exercise on a 390 px screen. The Semaine tab
already lists the sessions with their state and navigates on tap
(`App.jsx:541-552`), so the rail duplicates it with less information.

Issue: [#41](https://github.com/Simon0687/programme-12-semaines/issues/41).
Level A per `.claude/WORKFLOW.md` (Q3 architecture change; `import.js` on the
path triggers the sensitive-module override).

## Scope

- **In:** Semaine as the landing screen; Séance as a pushed screen without week
  or session selector; two-entry bottom bar; deletion of the auto-selection
  effect; Bilan moved into a collapsible section of Semaine with seven edited
  fields; session notes aggregated into `bilanText()`; removal of `copy()`,
  whose last caller becomes a download here.
- **Out:** what the bilan *contains* (#35); the set-entry mechanic inside an
  exercise card; safe-area insets and sub-44 px touch targets; the file
  export/import mechanism itself, which is #15 and a hard dependency of the
  Données part.

## User-facing behaviour

**Séance.** Reached only by tapping a session in the Semaine list. The week
arrows, the chip rail, the "Aujourd'hui, …" line and the standalone title block
are gone. In their place, a header: session name on one line, then
`Semaine N · <jour> <date> · <sous-titre>`. No back arrow. Everything below —
warm-up, exercise cards, session notes, "Valider la séance" — is unchanged. The
storage warning that today reads "Exporte le JSON (onglet Plan)" must be
reworded: there is no JSON display and no Plan tab wording to point at.

**Semaine.** The landing screen. Header keeps the week arrows and the phase
line. Below: the phase note, then a section "Séances de la semaine" with a
`N sur 4 validées` counter, then the existing session rows — done marker, name,
day, key-exercise result, chevron — with an **"aujourd'hui" marker** on the row
matching today. Below that, the Bilan section.

**Bilan.** No longer a tab. A collapsible section at the bottom of Semaine,
closed by default, whose header row carries a state counter: `à remplir` when
empty, `N sur 7` when partial, `complet` when full. Unfolded: seven fields —
poids, tour de taille, sommeil, énergie, RIR global, écarts nutrition,
remarques. **`douleurs` is no longer offered.** Séances and exos clés stay
computed. One button, **"Télécharger le bilan"**, producing a `.txt`; the
generated filename is shown next to it. The always-on `<pre>` preview is
removed (the "Afficher" button beside it went in #15).

**Plan.** Reachable from the bottom bar. Section "Données" loses the JSON
preview and the paste area; it gains "Télécharger le journal" and "Importer un
fichier", and pre-migration backups download instead of being dumped into a
textarea.

**Bottom bar.** Two entries, Semaine and Plan. "Semaine" stays highlighted while
Séance is open.

## Acceptance criteria

- [ ] Given a cold start, when the app finishes loading, then Semaine is
      displayed and no session has been auto-selected.
- [ ] Given Semaine, when a session row is tapped, then Séance opens on that
      session, for the week currently shown in the Semaine header.
- [ ] Given Séance, then no week arrow and no session chip is rendered anywhere
      on the screen.
- [ ] Given Séance, when "Semaine" is tapped in the bottom bar, then Semaine is
      shown; "Semaine" is the highlighted entry for the whole time Séance is open.
- [ ] Given today matches a session's day and the week shown is the current one,
      then that row carries the "aujourd'hui" marker — and only that row.
- [ ] Given a week with no session validated, then the Bilan header reads
      `à remplir`; with three fields filled, `3 sur 7`; with all seven, `complet`.
- [ ] Given a session whose notes field is non-empty, when the bilan is
      generated, then those notes appear in it, attributed to their session.
- [ ] Given a bilan already generated, when a session note is corrected via
      "Rouvrir" and the bilan is generated again, then the new text carries the
      corrected note.
- [ ] Given the Bilan section, then no `<pre>` preview is rendered.
- [ ] Given the whole app, then `grep -n "copy(" src/App.jsx` returns nothing.
      (`ioText`, the paste `<textarea>` and the Bilan's "Afficher" button went
      in #15 — removing the textarea is what broke them, so they could not wait
      for this issue. See `docs/features/15-durable-local-data/design.md`,
      "Correction found during implementation".)
- [ ] `npm test` passes in full.

## Data & storage impact

**MINOR.** The journal in `prog12_simon_v1` does not change shape: no field is
added, renamed or removed. `checkin.wN.douleurs` written by earlier versions
stays in storage and in the export; it simply stops being rendered and stops
feeding `bilanText()`. `logs[].notes` already exists (`schema.js:95`) and gains
a second reader. A journal saved by 2.0.0 loads without loss, so no migration
and no `SCHEMA_VERSION` bump.

**One documented procedure breaks and must be updated in the same change.**
`CONTRIBUTING.md` §"Pre-migration backups" tells the reader to recover a backup
by opening Plan → Données, where "a button appears for each backup found …
dumping the raw original into the visible textarea". Removing the textarea
invalidates that sentence; the recovery path becomes a file download.

## Edge cases

- **Fresh install, nothing entered.** Semaine lists four sessions with empty
  markers and `—` as key line; the Bilan counter reads `à remplir`.
- **Storage unavailable or journal unreadable.** `loadError` renders today
  outside any tab (`App.jsx:481`) and `!storageOk` renders inside Séance
  (`App.jsx:486`). Both must remain visible on the landing screen, which is no
  longer Séance.
- **Session reopened after the bilan was generated.** Covered by the computed
  aggregation; this is the case that decides Open question 1.
- **Week 7.** `setsFor()` halves the sets. Nothing here depends on it, but the
  Semaine list must not mistake a half-volume session for an incomplete one.
- **A program with no cardio.** The bundled default carries none, the legacy one
  does. The hub must not render an empty cardio section.
- **A program this version cannot execute** (#32). Its sessions must not be
  openable from the list.

## Out of scope / follow-ups

- The `weekDoneCount` badge currently sits on the "Semaine" nav entry
  (`App.jsx:647-651`). With Semaine as the landing screen showing the same
  count in its section header, the badge is redundant — confirm removal.
- Safe-area insets: `viewport-fit=cover` is declared in `public/index.html` but
  no `env(safe-area-inset-*)` exists anywhere in the project, so the fixed
  bottom bar sits under the iPhone home indicator. Separate issue.
- Touch targets under 44 px (week chevrons are `h-9`). Separate issue.
- What the bilan contains: 6 of 19 exercises today, with neither rep range nor
  planned load. #35.

## Decisions

Settled 2026-09-13 via `decisions-spec.md`. Product choices only; implementation
choices follow `/design-tech 41`.

1. **The aggregated session notes are computed at generation, never stored.**
   `checkin` entries carry no `updatedAt` — `setCheck` writes none, unlike
   `writeLog` (`schema.js:96`) — so a stored aggregate that goes stale after a
   "Rouvrir" correction could not be arbitrated against its source, and any
   correct stored version ends up recomputing anyway. Consistent with
   `docs/ARCHITECTURE.md` §2.2.
2. **The open screen is kept in `sessionStorage`**, not `localStorage`: it must
   survive the iOS web view being reclaimed mid-session, and must not resume a
   session three days later.
3. **The bottom bar stays at two entries**, Semaine and Plan, with Semaine
   highlighted while Séance is open. Removing it would force a back affordance
   back onto Séance, which is the trade this issue made in the other direction.
4. **Cardio and mobility are handled here, minimally:** the existing
   `CardioView … compact` gets its own section in the new Semaine layout, behind
   the `hasCardioContent(prog)` guard. `compact` only hides a heading
   (`App.jsx:696`), so nothing becomes unreachable. The point is that
   `sessionId` stops ever holding `"cardio"`, so `session` is never `undefined`
   and `si` never `-1` in `planned()` / `lastEntry()`. #34 stays about content.
5. **No "Bilan" row in the session list.** The Bilan section header sits
   directly below with its own counter; a second entry point would add ambiguity,
   not information.
6. **#15 first, in full, then this issue complete.** Done: #15 is implemented on
   `feat/15-durable-local-data`. Note that #15 also absorbed `ioText`, the paste
   `<textarea>` and the Bilan's "Afficher" button — removing the textarea is
   what broke them, so they could not wait. `copy()` is left with its single
   caller for this issue to finish.

## Open questions

None.
