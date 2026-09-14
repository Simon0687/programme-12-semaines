# Development process

This document describes how a change travels from idea to production. It is deliberately short: a process that demands more discipline than the work itself gets abandoned.

## Overview

```
idea → issue → branch → local dev → commit → push → Cloudflare preview → merge main → release
```

## 1. Open an issue

Every change starts with an issue, however small. That's what gives traceability: six months from now, `git log` explains *what* changed, the issue explains *why*.

- **Milestone** = epic. A milestone groups the issues of one body of work.
- **Labels**: type (`feat`, `fix`, `chore`, `refactor`, `test`, `docs`) and one priority.

  Priority says *when* an issue gets done, not how important it feels. It is
  re-evaluated at each merge into `dev`, alongside the Project status.

  | Label | Meaning |
  |---|---|
  | `priority: high` | Lands before the next release to `main`: data loss or corruption, a crash, or a regression on shipped behaviour. Worked first. |
  | `priority: medium` | Next up once `main` is current: it unblocks another planned issue, or removes a real risk without being a bug. Worked in the order the Project shows. |
  | `priority: low` | Useful, but nothing waits on it: taken at the end of a batch, or when a neighbouring change already touches the same code. |
  | `priority: later` | Not actionable yet: it needs unfinished major work (a storage migration, another issue) or a product decision first. Do not start it; re-label when the blocker lands. |
- Describe the problem before the solution. Acceptance criteria prevent a vague "done".

## 2. Work

One branch per issue, named `<type>/<number>-<description>`:

```bash
git checkout main
git pull
git checkout -b feat/12-dynamic-plan
```

Develop locally with the preview running:

```bash
npm run dev
```

Do all visual iteration here. Never deploy just to see a result: a build-and-publish round trip is a minute of waiting where the watch mode is instant, and you lose the browser state you were looking at.

## 3. Commit

Conventional Commits format:

```
<type>(<scope>): <imperative description> (#<issue>)
```

Types in use: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`.

Examples:

```
feat(plan): load sections from a data module (#14)
fix(progression): correct deload calculation in week 7 (#9)
chore(storage): add schemaVersion and migrations (#11)
```

These prefixes are not decoration: they determine the version number at release time. A `feat` bumps the minor, a `fix` bumps the patch.

For a breaking change, add `!` and a footer:

```
feat(storage)!: new multi-program journal format (#20)

BREAKING CHANGE: journals from before 2.0.0 are migrated on first load.
```

## 4. Check before pushing

```bash
npm test
npm run build
```

If tests fail, don't push. That's the one non-negotiable rule in this document.

## 5. Push and preview

```bash
git push -u origin feat/12-dynamic-plan
```

Cloudflare Pages builds a preview for the branch and gives you a URL. That's where you test on the phone, under real conditions.

## 6. Merge

Once the preview is validated:

```bash
git checkout main
git pull
git merge feat/12-dynamic-plan
git push origin main
```

Cloudflare Pages deploys to production. The issue closes automatically if a commit contains `closes #12`.

Delete the branch afterwards, locally and on GitHub.

## 7. Cut a release

Not on every merge — when a coherent set of changes is ready.

```bash
npm run release
git push --follow-tags origin main
```

The tool reads the commit history, computes the next number, updates `CHANGELOG.md` and `package.json`, and creates the tag.

## Versioning rules

This application's compatibility contract is not an API: it is **the journal format in localStorage**.

| Level | When | Example |
|-------|------|---------|
| **PATCH** (1.0.x) | Fix with no change to intended behaviour | wrong progression formula, wrong label |
| **MINOR** (1.x.0) | Compatible addition, existing journal intact | new screen, new exercise, new optional field |
| **MAJOR** (x.0.0) | Journal format changes, migration required | move to multi-program |

When torn between MINOR and MAJOR, ask: *does a journal saved by the previous version load without loss?* If not, it's a major.

### Safety copies

Before the app overwrites a journal, it copies the original, untouched, under a separate key. Three situations produce one:

```
prog12_simon_v1_backup_pre<N>      before a migration rewrites the journal
prog12_simon_v1_backup_dropped     before unreadable session rows are filtered out
prog12_simon_v1_backup_preimport   before an imported file replaces the journal
```

`<N>` is the `schemaVersion` the journal had *before* migrating — a journal migrated from v1 leaves its original at `prog12_simon_v1_backup_pre1`. All three are written once, never overwritten, never read automatically. That a second import does not overwrite the copy from before the first is the point, not an oversight: the state worth recovering is the one from before any of this started.

**To recover:** open the Plan tab's "Données" section — a button appears for each copy found and **downloads it as a file**, ready to keep or to feed back through "Importer un fichier". Without the app, the keys are readable directly from `localStorage` in devtools.

Beside these sits `prog12_simon_v1_last_export`, which is not a copy: it holds the date of the last successful export, and unlike the backups it is overwritten each time.

## What we don't do

- No direct commits on `main`, except an urgent production fix.
- No `git push --force` on `main`.
- No deploying to test: `npm run dev` first.
- No refactoring and feature work in the same commit — a regression couldn't be traced.
