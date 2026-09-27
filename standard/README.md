# TV-STANDARD

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

---

## Who this is for

- **Me**, when starting anything personal and not wanting to re-decide settled questions.
- **An agent working in `PersonalProjects/`**, which must load this in full before writing a line.

---

## How to use it

### Starting a new project

1. Read `AGENTS.md`. It is the contract, and it is short on purpose.
2. Copy `templates/react-ts-starter/` and rename it. It already encodes everything below.
3. Work through `checklists/new-project.md`.

### Working in an existing project

Read `standards/` end to end once, then keep `checklists/pre-pr.md` open.

### Load order

```
AGENTS.md            -> the non-negotiables and the contract
identity/            -> why the standards are what they are
standards/           -> the rules themselves, in dependency order
checklists/          -> the gates
templates/           -> the rules, already applied
```

`identity/` is not decoration. A rule you follow without knowing why becomes a rule you break
the first time it is inconvenient.

---

## Layout

```
TV-STANDARD/
├── AGENTS.md                 # The contract. Mandatory load for any agent in PersonalProjects.
├── identity/
│   ├── who-i-am.md           # How I think about building software
│   ├── voice.md              # How I write: prose, comments, commits, CLI copy
│   └── instincts.md          # My default moves, and what makes me deviate
├── standards/
│   ├── 00-non-negotiables.md # The short list that is never traded away
│   ├── 01-project-anatomy.md # Folder layout, the modules/ convention, layer hierarchy
│   ├── 02-naming.md          # Every naming rule, in one place
│   ├── 03-typescript.md      # Types, generics, guards, the Type suffix
│   ├── 04-react-components.md# Component file anatomy, top to bottom
│   ├── 05-state-and-contexts.md
│   ├── 06-api-layer.md       # The 3-layer API and the response object
│   ├── 07-styling-scss.md    # Callers, mixins, colors, the class naming
│   ├── 08-comments-and-docs.md
│   ├── 09-testing.md
│   ├── 10-tooling-and-checks.md
│   └── 11-git-and-delivery.md
├── checklists/
│   ├── new-project.md
│   ├── pre-pr.md
│   └── code-review.md
└── templates/
    └── react-ts-starter/     # React 19 + TS + Vite + SCSS, wired to this standard
```

---

## The one-paragraph version

Structure beats cleverness. Every layer has one job and hands the next layer a shape it can
trust. Nothing is duplicated: if it exists, extend it; if it does not, build it once, in the
place the next person would look. Types describe reality, not aspirations. Comments explain the
decision, never the syntax. The tooling enforces the boring rules so code review can spend its
time on the interesting ones. And the terminal is allowed to have a sense of humour.
