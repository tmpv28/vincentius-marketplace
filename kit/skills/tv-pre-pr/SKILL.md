---
name: tv-pre-pr
description: Run the TV-STANDARD pre-PR checklist against the current branch and report every box with its evidence.
disable-model-invocation: true
---

# Pre-PR

Works through `checklist.md` (in this skill's folder) against the current branch's diff. The checklist
is the authority; this file only says how to run it.

## Steps

1. Read `checklist.md` in full.
2. Find the diff: `git diff --stat <base>...HEAD` where base is `main` unless I name another.
3. Read every changed file with the Read tool, so the packs for their languages load.
4. The gate: run `pnpm std:check`, the tests relevant to the change, the full suite once, and `pnpm build`.
   A failure is "pre-existing" only after you confirm it on a clean checkout of the base.
5. The code, the conventions and the diff sections: check each box against the changed files. For the
   review-style boxes, apply `code-review-checklist.md` from this folder in its order, or hand the diff to the
   `tv-standard-review` agent and fold its findings in.
6. Draft the PR body in the four parts: what, why, how to verify, what to look at closely.
7. Answer the honest questions last.

## Output

One line per box: pass, fail or not applicable, each with the command output, file:line or reason that
proves it. Then the PR body. No summary paragraph.
