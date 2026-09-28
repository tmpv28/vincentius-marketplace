---
paths:
  - "**/package.json"
  - "**/pnpm-workspace.yaml"
  - "**/eslint.config.*"
  - "**/.prettierrc*"
  - "**/prettier.config.*"
  - "**/.stylelintrc*"
  - "**/stylelint.config.*"
  - "**/.lintstagedrc*"
  - "**/.husky/**"
  - "**/tsconfig*.json"
  - "**/vite.config.*"
  - "**/scripts/standardCheck.*"
  - "**/scripts/checkStagedSnapshot.*"
---

# TV-STANDARD: Node tooling

TV-PACK: node-tooling

Loaded in full because a Node project's tooling file was read. "TV NN" names the original chapter; the chapter map at the end of the core names the packs of each chapter.
Precedence: a pack beats the core where it is more specific. A collision means one side is stale: report it, do not work around it.

---

<!-- from standards/10-tooling-and-checks.md -->

## The check script is the gate (TV 10)

Every project gets a single command that is the answer to "is this ready". Not a list of four
commands to remember, not a CI job you find out about twenty minutes later. One command, local,
fast, and the output is designed to be read.

Three things in this chapter are decisions going forward rather than descriptions of the past: the
command is `std:check` rather than a per-project name, the package manager is pnpm, and the gate is
enforced by a hook rather than by remembering. The codebase this standard was reverse-engineered
from is on npm with a project-specific script name and nothing enforcing either. That is the thing
being corrected, not the thing being described.

```bash
pnpm std:check
```

It runs, in order:

| Step | Does |
| --- | --- |
| 0 | Merge conflict scan across `src/`. Hard exit if any marker is found. |
| 1 | `prettier --write`, then `eslint --fix`. Mutating. |
| 2 | `tsc --noEmit --skipLibCheck` |
| 3 | `eslint`, report only |
| — | Boxed summary, non-zero exit on anything fatal |

Step 0 exists because a merge conflict marker makes every other tool produce nonsense, and
watching a linter emit forty parse errors when the real problem is one `<<<<<<<` is a waste of a
minute and a bad mood.

## The gate is enforced, not remembered (TV 10)

IMPORTANT: `.husky/pre-commit` runs `std:check` and blocks the commit if it fails. The template
ships it and it is committed, so it installs for every clone through the `prepare` script.

**Why this chapter changed.** It used to say only that the check script is the gate, and said
nothing at all about hooks. Silence got read as a position: a project inferred that putting the
gate in `std:check` meant deliberately not putting it in a hook, and recorded that as a decision.
It was never a decision, it was an omission, and the two are indistinguishable to a reader.

**Why:** a gate that runs only when someone remembers to run it is a gate that eventually does
not, and the failure is quiet rather than loud. The specific incident: the gate, the build and the
commit were chained into one command, `tsc` failed, the build after it succeeded, the exit code
that got read was the last one, and the commit landed on three implicit `any` parameters. Nobody
was being careless. The shape of the command hid the failure.

**Where the gate lives and whether it can be walked past are different questions.** One command
that answers "is this ready" is still the rule. The hook only means nothing commits without asking
it.

### The mutating step is the part people get wrong

Step 1 writes: `prettier --write`, then `eslint --fix`. A hook that only checks the exit code lets
this through:

1. You stage a file.
2. The hook runs and Prettier reformats it.
3. The exit code is zero, so the commit proceeds.
4. **The commit contains the unformatted version.** Your working tree holds the corrected one.

Nothing failed, nothing was reported, and the two disagree. Turning a silent divergence into a loud
refusal is the whole point of the second half of that file.

**Check the staged content, not the files on disk, and the two obvious versions are both wrong.**

The first wrong version compares the staged list against what has unstaged changes after the run.
That intersection is non-empty for any file staged in part, which is legitimate and ordinary when
one commit carries one reason and one file carries two. It refuses correct commits while naming a
defect that does not exist, which is worse than the hole it closes: a gate that cries wolf gets
`--no-verify` by habit and then never catches the real case.

The second wrong version hashes each staged file on disk before the gate runs and again after, and
blocks on the ones that changed. That one is correct about the case above and still has a hole in
the other direction: stage an unformatted file, format the working tree without re-staging, and
nothing on disk changes while the gate runs. The hook passes and the commit carries the unformatted
version, which is the exact failure it exists to prevent.

Both are the same mistake, which is reaching for the signal that is easy to compute rather than the
one that answers the question. **Did the gate change this file on disk** is cheap and is not what
you need to know. **Would the gate change what I am about to commit** is the question.

So the hook runs the mutating tools against the staged content itself. Only the files whose index
copy differs byte for byte from the working tree need checking, because everything else is
identical to a tree the gate has just declared clean, so the cost is nothing on an ordinary commit:

```javascript
const source = stagedContent.toString("utf8");
return (await isPrettierClean(path, source)) && (await isEslintClean(path, source));
```

Import prettier and eslint as libraries rather than shelling out. `prettier.check` with a
`filepath` resolves the same config the gate used, and `new ESLint({ fix: true }).lintText` sets
`output` on its report only when `--fix` would have written something. Shelling out to a package
manager for this passes unescaped paths through a shell, and a project path containing a space is
enough to break it.

### What it does not do

**It does not run the tests.** TV 09 puts the full suite before finishing, not before every commit,
and a hook slow enough to resent is a hook that gets bypassed by habit. `--no-verify` exists for
the case you have actually decided on, and using it by reflex means you do not have a gate.

## Dev server branding (TV 10)

The dev server prints the project's name when it starts listening, via a small inline Vite
plugin.

```typescript
function customServerMessagePlugin() {
  return {
    name: "custom-server-message",
    configureServer(server: ViteDevServer) {
      server.httpServer?.once("listening", () => setTimeout(() => printAppLogo(), 100));
    }
  };
}
```

With four terminals open, knowing which one is which at a glance is worth the twelve lines.

## Formatting and linting (TV 10)

Settled. Do not relitigate:

```json
{
  "bracketSpacing": true,
  "trailingComma": "none",
  "tabWidth": 2,
  "semi": true,
  "singleQuote": false,
  "jsxSingleQuote": false,
  "printWidth": 100,
  "endOfLine": "auto"
}
```

ESLint: flat config, in `eslint.config.js`. **Airbnb is gone and is not coming back.**

`eslint-config-airbnb` has had no release in four years, `eslint-config-airbnb-typescript` was
archived in 2025, and neither speaks flat config. ESLint 9 made flat config the default and ESLint
10 removed the core formatting rules outright, which Airbnb sets by the dozen, so a compatibility
shim does not rescue it either. The community flat forks that do exist are low-download packages in
a namespace that has already had a malicious publish, which is a worse trade than the dead but
clean config they would replace.

What replaces it is what this chapter always actually named: `@eslint/js` recommended,
`typescript-eslint` recommended, `eslint-plugin-react` recommended, `jsx-a11y` recommended,
`eslint-plugin-prettier` last, and then the explicit list below. Most of the old rules block existed
to switch Airbnb's opinions back off, and those lines left with it.

**Two of Airbnb's rules are re-added by hand**, because a rule with a recorded exception is a rule in
use: `no-use-before-define`, which a mutually recursive event handler documents a case against, and
`no-param-reassign`, carrying Airbnb's own `ignorePropertyModificationsFor` list verbatim. That list
includes `context`, which is why a Canvas 2D painting function passed before: every drawing call is a
property write on the context, and a painting function that may not mutate it cannot paint.

**The version is ESLint 9, and it is pinned there by one plugin.** ESLint 8 went end of life in
October 2024, so staying was not an option. ESLint 10 was tried and `eslint-plugin-react@7.37.5`
crashes on it with `contextOrFilename.getFilename is not a function`, which its peer range had
already said by capping at 9. `jsx-a11y` and `eslint-plugin-import` cap there too. npm marks the
ESLint 9 line as no longer supported, and that is the honest trade: a supported linter that cannot
lint React, or an unsupported one that can. **The trigger for moving to 10 is
`eslint-plugin-react` shipping ESLint 10 support**, not a calendar date.

**Kept strict**, because these catch real bugs:

- `eqeqeq: always`
- `no-empty: error`
- `@typescript-eslint/no-redeclare: error`
- `unused-imports/no-unused-imports: error` (needs `eslint-plugin-unused-imports`, which is a
  devDependency in its own right; Airbnb does not provide it)

**Restated after `eslint-config-prettier`, and formatting rather than bug-catching**:
`quotes: double`, `semi: always`, `comma-dangle: never`. `eslint-config-prettier` turns all three
off, and the `rules` block turns them back on set to exactly what Prettier produces. They are
there so a file that somehow bypasses Prettier still fails the lint step, not because they catch
anything Prettier would have left.

These three are core rules that ESLint deprecated in 8.53 and removed in 10. They survive on 9 and
they are the reason moving to 10 is a config change rather than a version bump: on 10 they either
go, since `eslint-plugin-prettier` already reports formatting as a lint error and covers the same
ground, or they move to `@stylistic`.

**Deliberately off**, because they cost more than they catch in this codebase:

- `react-hooks/exhaustive-deps` — dependency arrays express intent; a mechanical fix makes worse
  code. Off means "you are responsible", not "ignore it".
- `@typescript-eslint/no-explicit-any` — `any` is a decision, taken at boundaries, with a comment.
- `import/prefer-default-export` — named exports are the default here.
- `max-len` — Prettier owns line length.
- `react/require-default-props`, `react/prop-types` — TypeScript owns this.
- `jsx-a11y/no-autofocus`, `jsx-a11y/label-has-associated-control`,
  `jsx-a11y/no-static-element-interactions`, `jsx-a11y/click-events-have-key-events` — enforced by
  hand instead; the accessibility pack says what that means.

An `eslint-disable` is allowed and gets a one-line reason. A file-top stack of them means the
file needs splitting, not more disables.

## No path aliases (TV 10)

`resolve.alias` is empty, `tsconfig.paths` is empty. Imports are deep and relative.

Aliases hide how far away something is. `../../../../` is a design smell you can see from across
the room, and `@/commons/...` is the same smell with the smell removed.

## Commands (TV 10)

Every project exposes the same vocabulary, so muscle memory transfers:

```
pnpm dev             # dev server
pnpm build           # production build
pnpm preview         # serve the build
pnpm std:check       # THE gate
pnpm lint:js         # eslint, report
pnpm lint:fix        # eslint, fix
pnpm test:unit       # vitest + jsdom
pnpm test:coverage   # coverage
pnpm storybook       # component workshop
```

A project that declines one of these tools drops its command with it. A script that exists and
fails teaches people to stop running the list.

When a project accumulates more than a handful of repeated shell incantations, they go into a
`Makefile` or `justfile`. Not into a README the next person has to read.

---

<!-- from standards/03-typescript.md -->

## `strict`, always (TV 03)

`strict: true` from the first commit. Turning it on later is a project, turning it on now is a
setting.

Non-negotiable compiler options:

```json
{
  "strict": true,
  "forceConsistentCasingInFileNames": true,
  "noFallthroughCasesInSwitch": true,
  "isolatedModules": true
}
```
