---
description: Draft a technical design from a feature spec (Palier 2 - architect role)
argument-hint: <issue-number>
allowed-tools: Bash(gh issue view:*), Read, Grep, Glob, Write
---

You are acting as the **software architect** for this project. Turn the spec for
issue #$1 into a technical design a developer can implement directly, and that
Simon can review in five minutes.

## Steps

1. Find the spec. It lives in `docs/features/$1-<slug>/spec.md` (the folder
   `/spec $1` created). Use Glob on `docs/features/$1-*/spec.md`. If there is no
   spec, stop and tell Simon to run `/spec $1` first - do not invent one.
2. If the spec's **Open questions** section is not "None", stop and list them:
   design does not start on unresolved requirements. Carry forward only questions
   that are genuinely design-level (implementation choices), not product choices.
3. Read the issue and the real code before designing. Run
   `gh issue view $1 --json number,title,body,labels,milestone` (if `gh` is not on
   PATH, it is installed at `C:\Program Files\GitHub CLI\gh.exe`). Use Grep / Glob
   / Read on the files the spec names. Every file reference in the design must be a
   real path, and every claim about current behaviour must match the code as it is.
4. Read `CONTRIBUTING.md`: the versioning rules, "one concern per commit", and
   "tests pass before push". The sequencing you propose must respect them.
5. Write the design to `docs/features/$1-<slug>/design.md`, same folder as the spec.

## Design structure (use exactly these headings)

```
# Design - <title> (#$1)

## Summary
The approach in 2-4 sentences. What gets added, where, and the one idea that makes
it work. Link the spec.

## Files touched
Each file, what changes in it, and roughly where (function or line range). List new
files. No file appears here that the change does not actually touch.

## Approach
The core of the design. Data shapes, function signatures, control flow, where new
constants and modules live, how the pieces connect. Short code sketches are allowed
(signatures, object shapes, pseudo-code) - not the full implementation.

## Sequencing
Numbered implementation steps. Each step leaves the app working, is independently
committable, and names its Conventional Commit (`type(scope): description (#$1)`).
Call out which step is safe to merge alone.

## Tests
What to test and at what level (unit / integration / manual click-through), with
which tool. If a test runner or helper has to be set up, that is its own step in
Sequencing.

## Risks & tradeoffs
What could break, alternatives considered and why they were rejected, and any
performance or backward-compatibility notes. Tie the storage impact back to the
version level the spec set.

## Out of scope / follow-ups
Anything found while designing that deserves its own issue.

## Open questions
Numbered. Implementation choices for Simon to settle before coding. Write "None" if
there are none.
```

## Rules

- English, to match the existing issues, spec and docs.
- Short code sketches only: signatures, data shapes, pseudo-code. Do **not** write
  the implementation files. Do not create a branch. Do not commit. Do not touch the
  issue on GitHub.
- Design against the current code, not the spec's paraphrase of it - if the two
  disagree, say so in the design and flag it as an open question.
- Do not redesign beyond the issue. If a broader change would help, note it under
  Out of scope / follow-ups, do not fold it in.
- Keep the prose to about one page; code sketches on top of that are fine. A design
  nobody reads is worse than no design.

When done, print: the file path, the number of implementation steps, and the list
of open questions.
