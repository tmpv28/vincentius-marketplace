# 11 — Git and delivery

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), lowercase type, imperative
mood, no period.

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `perf`, `chore`,
`revert`.

- Subject line, 100 characters maximum, and shorter is better. The same width as the code. If it
  does not fit in 100, the commit is too big or the description is explaining WHAT instead of WHY.
  A campaign tag counts against the limit.
- Scope names are consistent. Pick `auth` or `authentication`, never both.
- Body separated by a blank line, wrapped at 80. The body explains motivation, context and
  trade-offs. The diff already shows what changed.
- Breaking changes get a `BREAKING CHANGE:` footer with the migration path, or `!` after the scope.
- Issue references in the footer: `Closes #42`.
- No em-dashes.

---

## Campaign tags

When a single piece of work is a **campaign** rather than a change, every commit in it carries a
bracketed tag instead of a conventional-commit type:

```
[context-split] create ToastContext with inlined toast system logic
[context-split] migrate useGlobalContext consumers to split hooks
[context-split] swap GlobalContextProvider for 3 split providers in router
[context-split] delete GlobalContext and toastsSystem

[utils-reorg] rename renderCellValue → renderDataviewerCellContent, delete orphan stub
[utils-reorg] collapse DataViewer text-type cases into default → renderCellContent

[docs] mandate empty committed .env; secrets only in .env.local
```

The tag is the campaign's name, lowercase, hyphenated. Every commit under it is one reviewable
step of the migration, in the order a reader would need to follow it: build the new thing,
migrate the consumers, delete the old thing.

Why a tag and not a scope: a campaign spans scopes by definition. `refactor(commons)` on eleven
consecutive commits tells you nothing; `[context-split]` tells you they are one story and which
one. `git log --oneline | grep context-split` then reads as the migration's changelog.

Use it for migrations, reorganisations, and doc sweeps. Use conventional commits for everything
else.

---

## Commit discipline

- **One reason to change per commit**, which is not the same as one edit. A commit may touch
  several files and list several edits separated by semicolons, as long as they all exist for the
  same reason and reverting the commit is coherent. If the description needs an "and" that joins
  two *reasons*, split it.
- **Refactors and behaviour changes are separate commits.** A refactor commit does not change
  observable behaviour. A feature commit does not include unrelated cleanup.
- **Write the message before committing.** If you cannot summarise the change clearly, the scope
  is wrong and no amount of message-wordsmithing will fix that.
- Never commit generated output, secrets, or `.env` files.
- `.gitignore` is checked and updated **before** the first commit of a project, and again in the
  same PR whenever new tooling is added.

---

## Branches

```
<type>/<short-description>
```

`feat/note-editing`, `fix/null-title-validation`.

Short-lived. Rebase onto the base branch often. Delete after merge.

---

## History

- **Never force-push a shared branch.** `main`, `master`, `develop` are never force-pushed, under
  any circumstance, for any reason.
- Rebase a feature branch for linear history. Never rebase commits already pushed to a shared
  branch.
- `git commit --fixup` plus `git rebase --autosquash` to tidy work-in-progress commits before
  merging. The branch history is a draft; the merged history is the published version.

---

## Pull requests

A PR body answers four questions, in this order:

1. **What** changed, in two or three lines.
2. **Why** it changed. The actual reason, not the ticket title restated.
3. **How** to verify it. The commands, the screen, the case that used to fail.
4. **What to look at closely.** Name the risky part yourself. A reviewer who has to find it is a
   reviewer who will miss it.

No screenshots of green test output. No essays. No apology for the diff size; if it needs an
apology, split it.

---

## Reviewing

What I look for, in priority order:

1. **Duplication.** Does this already exist somewhere in the codebase?
2. **Layer violations.** Is a page doing a feature's job? Is a component reaching for axios?
3. **Types that lie.** A cast, an `any` with no reason, a guard at the wrong depth.
4. **Unhandled paths.** Missing empty state, missing error state, a swallowed rejection.
5. **Naming.** Does the name say what it is, or does it say what it did when it was written?
6. **Comments.** Explaining WHY, or narrating the syntax?

What I do not comment on: formatting, line length, quote style, import order. The tooling owns
those, and a review that spends its attention there has spent its attention.

I give the concern, not the solution. The implementer owns the fix; my job is to make sure they
are looking at the right thing.

---

## Dependencies

- `pnpm`, always. `pnpm-lock.yaml` committed, `pnpm install --frozen-lockfile` in CI.
- **Nothing released in the last 7 days.** A package that has been live for a week has had time
  for a yanked release or a compromise to surface.
- **Search for active advisories before installing.** Every package, every version, every time.
  This is not paranoia; the ecosystem has earned it.
- Ranges in the manifest (`^`), exact resolution in the lock file.
- Lock file diffs get read in review. That is where a supply chain attack shows up.
- No `alpha` in production. No `beta` unless pinned exactly, documented, and tracked.
- Automated update tooling on anything that matters. Patch and minor may auto-merge **only** when
  the bot enforces the same rules a human would: a `minimumReleaseAge` of at least 7 days, an
  advisory check in CI, and a lock-file diff that a human still reads before the next release.
  Without those three, auto-merge quietly repeals the two rules above it. Majors are reviewed by
  hand, always.

---

## Planning

- **No time estimates.** No hours, no days, no sprints, no story points, no t-shirt sizes.
  Sequence by dependency: what has to exist before the next thing can be built. That is the only
  ordering that is actually true.
- Phases are cut so each one is independently verifiable. A phase that cannot be checked when it
  finishes is not a phase, it is a hope.
- Optional or heavyweight components are called out explicitly as optional, so they can be
  declined before they are built.
- Before a refactor or a complex feature: **draw the map first.** An ASCII diagram of the
  components, the data flow, or the module relationships, shared before any code is written. It
  costs ten minutes and it is where scope disagreements surface, while they are still free.
