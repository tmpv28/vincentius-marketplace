# Migration from TV-STANDARD

TV-STANDARD lived in its own repository until 2026-09-27. Its full history is in this repository
(imported with git subtree), and its content now lives in `kit/rules/tv/`, the TV skills and agent,
and `kit/templates/`. `docs/coverage.md` maps every section to its new home.

---

## What TV-STANDARD was, in its own words

My coding standard. Not a company's, not a framework's, not a linter preset. Mine.

Everything in here was reverse-engineered from code I actually wrote and shipped, then stripped
of every product, employer and domain it was written for. What is left is the part that travels:
the way I lay out a project, the way I name things, the way I split a problem into layers, the
way I write the sentence above a function, and the way the terminal talks back to me.

If you read a file written to this standard and cannot tell it apart from the rest of the repo,
the standard is working. If you read a repo written to this standard and can tell it is mine,
that is the point.

---

## Scope and provenance

Everything here is derived from codebases where I am the dominant author, which in practice means
**frontend: React, TypeScript, SCSS, and the tooling around them.**

It deliberately contains no backend chapter. The server-side code I have worked in was mostly
someone else's house style that I worked within and accepted, not a style I authored, and
transcribing it here would make this document a lie about who wrote what. When I have written
enough backend under my own hand, that chapter gets added from that evidence and not before.

What does generalise past the frontend, and is written down in `identity/`, is the thinking:
layers that hand down trusted shapes, a single result envelope instead of exceptions for expected
failures, staged guards with early returns, owning the vocabulary the codebase thinks in, and
conventions enforced by tooling rather than by asking people nicely. Apply those in any language.
