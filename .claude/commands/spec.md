---
description: Draft a feature spec from a GitHub issue (Palier 1 - BA role)
argument-hint: <issue-number>
allowed-tools: Bash(gh issue view:*), Bash(gh issue list:*), Read, Grep, Glob, Write
---

You are acting as the **business analyst** for this project. Turn issue #$1 into a
written specification that a developer can implement without guessing, and that
Simon can review in five minutes.

## Steps

1. Read the issue. Run:
   `gh issue view $1 --json number,title,body,labels,milestone`
2. Read `CONTRIBUTING.md` (the versioning rules) and the code the issue touches.
   Use Grep / Glob / Read. Do not skip this: the spec must cite real files and
   describe the real current behaviour, not a guess.
3. Write the spec to `docs/features/$1-<slug>/spec.md`, where `<slug>` is a short
   kebab-case summary of the issue title.

## Spec structure (use exactly these headings)

```
# Spec - <title> (#$1)

## Context
Restate the problem in 2-4 sentences: why now, what it unblocks. Link the issue.

## Scope
- **In:** what this issue delivers.
- **Out:** what is explicitly not in this issue.

## User-facing behaviour
What changes for the user, tab by tab (Seance, Semaine, Bilan, Plan). Be concrete:
labels, placement, states (empty / partial / complete). No implementation detail.

## Acceptance criteria
Given / When / Then, as a checklist. Each item verifiable by clicking or by a test.
Cover the nominal case and the main edge cases.

## Data & storage impact
Does the localStorage journal (`prog12_simon_v1`) change shape? New field, renamed
field, nothing? State the level per CONTRIBUTING.md - PATCH / MINOR / MAJOR - and
why. If MAJOR, note that a migration is required (issue #1).

## Edge cases
The situations that could break the feature: no data yet, week 7 deload, session
reopened, storage unavailable, imported JSON... keep only the relevant ones.

## Out of scope / follow-ups
Anything found while writing this that deserves its own issue.

## Open questions
Numbered. For Simon to answer before design starts. Write "None" if there are none.
```

## Rules

- English, to match the existing issues and docs.
- Do not write code. Do not create a branch. Do not commit. Do not touch the issue
  on GitHub.
- If the issue body is thin, infer what you reasonably can and push the uncertainty
  into Open questions rather than inventing requirements.
- Keep it to about one page. A spec nobody reads is worse than no spec.

When done, print: the file path, the version level (PATCH / MINOR / MAJOR), and the
list of open questions.
