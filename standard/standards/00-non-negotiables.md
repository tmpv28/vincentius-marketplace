# 00 — Non-negotiables

Everything else in `standards/` is a rule. This file is the set of rules I do not trade away for
a deadline, a spike, a prototype, or "we will clean it up later". There has never been a later.

---

## 1. Reuse before creation

Before writing a utility, hook, type, constant, component or style: search for it. If something
close exists, extend it. If two things almost do the job, that is a sign the abstraction is
wrong, and the fix is to correct the abstraction, not to add a third.

Duplication is the only defect in this standard that I treat as unconditional. Everything else
has a case where it is acceptable. This does not.

---

## 2. One reason to change

Every file, function, hook, component and layer has exactly one reason to change. Test it by
naming it. If the honest name needs an "and", it is two units.

The split happens while writing, not in a follow-up pass. A second responsibility appearing
mid-function is the signal to stop and split, immediately.

Common splits I make by reflex:

- Business logic and I/O never share a unit.
- Validation and submission never share a unit.
- Layout and data-fetching never share a unit.
- Rendering and formatting never share a unit.

---

## 3. Layers hand down trusted shapes

A layer's job is to take an untrusted shape from below and hand a trusted shape upward. That is
the whole reason the layers exist. A layer that passes an unknown through is not a layer, it is
a file.

This is why the API layer has a response object, a type guard and a validation stage. It is not
ceremony. It is the point where `any` stops.

---

## 4. Comments explain WHY

One line, above the thing, explaining the decision, the constraint, or the trade-off. If the
name plus the signature already explains the behaviour, delete the comment.

Multi-line comments are for logic that would genuinely surprise a careful reader. That is rare.

**Never rewrite an existing comment for style.** Update it with the new information and leave
its shape alone. The shape was a decision.

---

## 5. No em-dashes in code-adjacent text

Comments, commit messages, UI strings, CLI output, JSDoc, type descriptions, PR titles. Use a
period, a semicolon, a colon, or delete the clause. Hyphens in compound words and section headers
are fine.

Long-form prose documentation is the exception; this file uses them. The rule is about text that
sits inside or next to code, where the em-dash is almost always a sentence that should have been
two.

This is a house rule with no technical justification and I enforce it anyway.

---

## 6. The check passes before it is done

`pnpm std:check` runs format, auto-fix, type check and lint, and it has to come back clean
before anything is reported as finished, reviewed, or ready. Not "passes except for". Clean.

Tests relevant to the change run during development. The full suite runs once before finishing.

---

## 7. Secrets never enter the repo

The committed `.env` is a **schema**: variable names, no values, ever. Real values live in
`.env.local`, which is gitignored. Deployed environments inject at runtime.

I do not read secret files, print secret values, or hardcode them "temporarily".

---

## 8. Types describe reality

A type is a claim about what the code actually does. If the claim is false, the type is worse
than no type, because it stops people checking.

`any` is allowed as a deliberate decision with a one-line comment saying why the shape is not
knowable there. `any` that arrived because typing it was annoying is a defect.

---

## 9. Errors are handled or they propagate

No bare `catch`. No swallowed rejections. No ignored return values. No `// TODO: handle error`.

Either the error is handled at that point, with a decision about what the user sees, or it goes
up to a layer that can make that decision.

---

## 10. Nothing is added that was not asked for

No dependency, no abstraction, no observability stack, no state manager, no config system, no
"while I was in there" refactor. If I think something is needed, I say so and let the decision
be made explicitly.

The corollary: nothing asked for is quietly dropped either.
