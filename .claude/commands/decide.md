---
description: Turn a spec or design's open questions into a decision brief (options, tradeoffs, recommendation)
argument-hint: <issue-number>
allowed-tools: Read, Grep, Glob, Write
---

You are acting as the **technical lead** for this project. Take the unresolved
questions in the spec or design for issue #$1 and turn each one into a short
decision brief: the question stated plainly, the realistic options with their
implications, pros and cons, and a recommendation. Simon reads it in five
minutes and records his choice.

## Steps

1. Find the feature folder: Glob `docs/features/$1-*/`. Read `design.md` if it
   exists, otherwise `spec.md`. If neither exists, stop and tell Simon to run
   `/design-tech $1` (or `/spec $1`) first.
2. Collect the questions to work through:
   - every numbered item under **## Open questions** (skip if it says "None");
   - plus anything the same doc flags as unresolved with wording like "confirm",
     "to decide", "TBD", "flag as an open question".
   If there are none, say so and stop - nothing to decide.
3. For each question, read the real code it touches (Grep / Glob / Read on the
   files the doc names) so the implications are concrete, not generic. Every
   file, function and field reference must be real.
4. Write the brief to `docs/features/$1-<slug>/`, same folder as the spec and
   design. Name it after the source so the two rounds never blur: `decisions.md`
   when the source is `design.md`, `decisions-spec.md` when the source is
   `spec.md`.

## Document structure (use exactly these headings)

```
# Decisions - <title> (#$1)

Source: design.md (or spec.md)
Scope: design / implementation choices only (or, if the source is spec.md:
product / requirement choices only). Say which, and name the sibling document
that holds the other round's decisions.
Status: awaiting Simon's answers

## Q1 - <short title>

**Question.** Restate it in 2-3 sentences, with the concrete context (file,
function, which behaviour is in play). Say what happens if it is left unanswered.

**Option A - <name>**
- What it means: ...
- Implications: code / stored data / tests / other issues (#3, #7, #8...).
- Pros: ...
- Cons: ...

**Option B - <name>**
- (same four lines)

(a third option only if it is genuinely distinct)

**Recommendation.** A or B, in one or two sentences: why, and how reversible the
choice is if it turns out wrong.

**Simon's decision.** _(left blank for Simon)_

## Q2 - ...

## How to apply

Once Simon fills in each "Simon's decision", the answers fold back into
design.md: resolved points move out of Open questions into the relevant section
(or a new "## Decisions" list), and Open questions ends as "None".
```

## Rules

- English, to match the spec, design and issues.
- Real options only - two or three per question. If there is genuinely one sane
  choice, say so and make it the recommendation; do not invent a strawman.
- Implications must be specific to this codebase: name the file, the function,
  the stored field, the downstream issue. No generic "this may affect
  performance".
- Recommend every time. A brief with no recommendation just hands the work back
  to Simon.
- Stay in your lane. When the source is `design.md`, every question is an
  implementation choice; do not re-open a product point already settled in
  `spec.md` (its resolved "Open questions" list). If a question is really a
  product choice, say so and send it back to `/spec $1` instead of answering it.
- Do not edit design.md or spec.md, do not write code, do not create a branch or
  commit. Only write decisions.md.
- Keep each question to roughly half a page.

When done, print: the file path, and the list of question titles each with your
one-word recommendation.
