# Checklist: before opening a PR

---

## The gate

- [ ] `pnpm std:check` returns clean. Not "clean except for".
- [ ] Tests relevant to the change pass.
- [ ] Full suite run once, green.
- [ ] `pnpm build` succeeds.
- [ ] Any failure labelled "pre-existing" has actually been confirmed pre-existing on a clean
      checkout.

---

## The code

- [ ] Nothing I added already existed somewhere in the codebase.
- [ ] Every new unit has one reason to change. No name needs an "and".
- [ ] No layer violations: no mutation in a page, no axios in a component, no domain knowledge in
      `commons/components/`.
- [ ] Every new type is true. No cast that papers over a shape, no `any` without a one-line reason.
- [ ] Every `any`, every `eslint-disable`, every non-obvious dependency array has its justifying
      comment.
- [ ] Loading, empty and error states all handled on anything that renders data.
- [ ] No swallowed errors, no bare catch, no `// TODO: handle error`.
- [ ] Every disabled control has a tooltip that says why it is disabled.
- [ ] No `console.log` survived.
- [ ] No commented-out code.

---

## The conventions

- [ ] Suffixes correct, against the full suffix table (TV 02, typescript pack): `Type`, `Component`,
      `Feature`, `Page`, `System`, `Context`, `Controller`, `FnType`, `Definition`, `Handler`,
      `Layout`.
- [ ] `modules/` used for internals, entry file named `<FolderName><LayerSuffix>`.
- [ ] Imports grouped by origin, `.scss` last.
- [ ] `//-----------` separators in the right places.
- [ ] No em-dashes anywhere in code-adjacent text.
- [ ] No hex colours, no raw breakpoints, no `@import` in the SCSS.
- [ ] No new barrel file, no new path alias.
- [ ] No existing comment rewritten for taste.

---

## The diff

- [ ] One logical change per commit. No commit description joins two reasons with an "and".
- [ ] Refactors separated from behaviour changes.
- [ ] Commit messages conventional, or campaign-tagged if this is a migration.
- [ ] No generated files, no secrets, no `.env` values.
- [ ] `.gitignore` still correct for anything new the change introduced.
- [ ] Lock file diff read, if dependencies changed.

---

## The PR body

- [ ] **What** changed, two or three lines.
- [ ] **Why** it changed. The real reason, not the ticket title.
- [ ] **How** to verify it. Commands, screen, the case that used to fail.
- [ ] **What to look at closely.** The risky part, named by me.

---

## The honest questions

- [ ] Did I finish everything that was asked, or did the scope quietly shrink?
- [ ] Did I add anything that was not asked for?
- [ ] Is there anything here I would have to explain in a review? If so, is it commented?
