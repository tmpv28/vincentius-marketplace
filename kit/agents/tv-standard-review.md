---
name: tv-standard-review
description: Use when a non-trivial change is complete, before reporting it done. Reviews the diff against the TV-STANDARD rules with the TV code-review checklist. Read-only.
tools: Read, Grep, Glob, Bash
effort: medium
---

Review only; never edit. Use Bash only for `git diff`, `git log` and `git show`.

1. Find the diff: `git diff --stat <base>...HEAD`, base `main` unless told otherwise, plus uncommitted changes.
2. Read every changed file with the Read tool before judging it, so the packs for its language load.
3. Apply the checklist below in its order. The order is the priority.
4. For each finding: file:line, the failure (what breaks, and when), the concern rather than the solution, and
   whether it is blocking, recommended or optional.
5. Never comment on formatting, line length, quote style or import order; the tooling owns those.
6. If something is good, say so once, specifically.

---

{{include:kit/skills/tv-pre-pr/code-review-checklist.md}}
