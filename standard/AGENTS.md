# AGENTS.md — the contract

You are writing code that has to pass for mine. Read this file completely, then read
`standards/` completely, before you write anything.

---

## Mandatory load

- IMPORTANT: Working anywhere under `C:\Users\vince\Documents\VINCENTIUS\Projects\` means this standard applies. There is
  no
  opt-out per project, per file, or per "this is just a quick script".
- IMPORTANT: Load `AGENTS.md`, `identity/`, and `standards/` in full. Do not sample. Do not grep
  for the one rule you think you need. The rules interlock, and half of them only make sense
  next to the one before.
- IMPORTANT: When this standard and a framework's default disagree, this standard wins. When
  this standard and the surrounding code in the repo disagree, the surrounding code wins, and
  you tell me about the drift instead of silently fixing it.
- IMPORTANT: When two parts of this standard disagree with each other, the precedence is:
  **`standards/` beats `identity/` beats `checklists/`**, and within `standards/` the numbered
  chapter that owns the topic beats any restatement of it elsewhere. Then tell me, because a
  collision means one of the two is stale and I want it fixed rather than worked around.

---

## The non-negotiables

The full list lives in `standards/00-non-negotiables.md`. These are the ones that get violated
most, so they are repeated here:

1. **Search before you create.** Every utility, hook, type, component, constant. If something
   close already exists, extend it. Duplication is the only real defect in this standard.
2. **One reason to change per unit.** If the name needs an "and", split it before you write it,
   not in a cleanup pass that never comes.
3. **Comments explain WHY.** One line, above the thing. If the name and signature already say
   it, delete the comment.
4. **No em-dashes in code-adjacent text.** Comments, commit messages, UI strings, CLI output,
   type descriptions, JSDoc. Use a period, a semicolon, or cut the clause. Hyphens in headers and
   compound words are fine. Long-form prose documentation is the one place they are allowed.
5. **Never rewrite an existing comment for taste.** Update it with new information. The style it
   is in reflects a decision that was made once.
6. **The check script must pass before you report anything as done.** Not "should pass". Pass.
7. **Committed `.env` is a schema with no values.** Real values live in `.env.local`, gitignored,
   always.
8. **Types describe what the code actually returns.** `any` is a decision, not an accident, and
   it gets a comment when it is used deliberately.

---

## What to do when you are unsure

Exhaust, in this order, before asking me:

1. The code around the thing you are changing.
2. `standards/` and `identity/`.
3. The reference implementation the standard points at.
4. The template in `templates/react-ts-starter/`.

Then ask. One question, specific, with the options you already considered and the one you would
pick. Do not ask me to choose between things you can verify yourself.

---

## What I will notice immediately

These are the tells. Get them wrong and the code reads as someone else's, even if it works:

| Tell | Right | Wrong |
| --- | --- | --- |
| Type naming | `AddNoteFeatureType` | `IAddNoteFeature`, `AddNoteProps` |
| Folder for a unit's internals | `modules/` | `helpers/`, `lib/`, `internal/` |
| Component name | `ButtonComponent` | `Button`, `AppButton` |
| Feature name | `AddNoteFeature` | `AddNote`, `NoteCreator` |
| Shared abstraction | `xSystem/` | `xManager/`, `xService/`, `xEngine/` |
| SCSS barrel | `xCaller.scss` with `@forward` | `_index.scss`, `@import` |
| String quotes | `"double"` | `'single'` |
| Trailing comma | none | any |
| Separator inside a component | `//-----------` | nothing, or a paragraph of prose |
| Empty check | `isNullOrEmpty(value)` | `!value`, `value === ""` |
| Entry file in a unit folder | `AddNote/AddNoteFeature.tsx` | `AddNote/index.tsx`, `AddNote/AddNote.tsx` |
| Equality on objects | `areEqual(a, b)` | `JSON.stringify(a) === JSON.stringify(b)` |

---

## Process rules

- **Do not present work you have not run.** Type-check, lint and test it first.
- **Do not leave a TODO where a decision belongs.** Either handle it or surface it to me as a
  question. `// TODO: handle error` is a defect, not a note.
- **Do not add infrastructure I did not ask for.** No telemetry, no analytics, no logging
  framework, no state manager, no extra dependency, unless the task named it.
- **Do not narrow the task.** If part of it is blocked, finish the rest in full and tell me
  exactly what you left and why.
- **Plans have no time estimates.** No hours, no days, no sprints, no t-shirt sizes. Order work
  by dependency, nothing else.

---

## Dependencies

- `pnpm`. Always. `pnpm-lock.yaml` committed, `pnpm install --frozen-lockfile` in CI.
- Nothing released in the last 7 days.
- Check for active advisories on the exact package and version before installing. Every time.
- Ranges in the manifest (`^`), exact pins in the lock file.
