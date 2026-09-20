# 10 — Tooling and checks

## The check script is the gate

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

---

## The gate is enforced, not remembered

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

**It does not run the tests.** `09` puts the full suite before finishing, not before every commit,
and a hook slow enough to resent is a hook that gets bypassed by habit. `--no-verify` exists for
the case you have actually decided on, and using it by reflex means you do not have a gate.

---

## The interesting part: deduplicate across tools

One syntax error will be reported by Prettier, by ESLint and by `tsc`. Three times, in three
formats, in one run. So the script harvests `file:line` locations from the earlier tools and
filters the later tools' output against them.

```javascript
const seenErrorLocations = extractErrorLocations(`${prettierOutput}\n${eslintFixOutput}`);
const tscOutput = filterTscOutput(tscRawOutput, seenErrorLocations);
```

And when `tsc` fails but every location was already reported, it says so rather than printing
nothing and looking like a pass:

```javascript
// A non-zero tsc exit always means broken types (or a crashed compiler); never let empty
// filtered output slip through as a pass.
```

That comment is the whole philosophy of the script: **a quality gate that can silently pass is
worse than no gate**, so every branch that could be mistaken for success is handled explicitly.

Related: the script distinguishes "the linter found problems" from "the linter failed to run".
A non-zero exit with no parseable findings means the tooling itself is broken, and that gets a
different, louder message.

---

## Output is designed

No reporter library. Hand-rolled, because the output is read dozens of times a day and it should
be pleasant.

- Accent-coloured step headers with a dim divider under each.
- `✔ / ✖ / ⚠` icons, indented consistently.
- ESLint's own output re-parsed and re-emitted: dim position, bold red `error`, white message,
  dim rule name.
- A hand-drawn summary box, width computed from the **plain** string length so ANSI codes do not
  skew it.

```
  ┌──────────────────────────────┐
  │ Total › 3 errors · 1 warning │
  └──────────────────────────────┘
```

---

## The messages have a voice

This is not a joke I tolerate in my tooling. It is a thing I do on purpose.

```
✔  Spotless. Not a single crumb out of place.
✔  Types check out. The compiler is pleased.
✔  All clear. Linter has nothing to complain about.
✖  Code health check? This code is already on life support.
🚀 Ship it. PR time!
```

Dry, confident, a little sardonic, never corporate and never cute. A tool you run fifty times a
day should not sound like a compliance form. The full guidance is in `identity/voice.md`.

The rule that keeps it from being annoying: **the joke is never at the cost of the information.**
The error text is exact, the file paths are complete, the counts are right. The personality lives
in the one-line verdict, nowhere else.

---

## Dev server branding

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

---

## Formatting and linting

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

ESLint: Airbnb + Airbnb hooks + TypeScript + Prettier, then a deliberate opt-out list.

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

**Deliberately off**, because they cost more than they catch in this codebase:

- `react-hooks/exhaustive-deps` — dependency arrays express intent; a mechanical fix makes worse
  code. Off means "you are responsible", not "ignore it".
- `@typescript-eslint/no-explicit-any` — `any` is a decision, taken at boundaries, with a comment.
- `import/prefer-default-export` — named exports are the default here.
- `max-len` — Prettier owns line length.
- `react/require-default-props`, `react/prop-types` — TypeScript owns this.

An `eslint-disable` is allowed and gets a one-line reason. A file-top stack of them means the
file needs splitting, not more disables.

---

## Project-level lint rules

When a convention matters enough that breaking it is a bug, it becomes a lint rule rather than a
paragraph in a doc. `no-restricted-syntax` selectors banning bare string literals where a typed
constant is required, banning a deprecated identifier from reappearing, and so on.

The general principle: **what the compiler can catch, let it. What it cannot, write a test that
does. What neither can, write down the failure mode.**

---

## The generators are the real enforcement

A written convention decays. A generator does not.

Alongside `CLAUDE.md`, `.claude/rules/` and `.claude/memory/`, a mature project gets a set of
scaffolding skills in `.claude/skills/`: `add-entity`, `add-feature`, `add-api-endpoint`,
`add-component`, `add-page`, `add-route`, `add-icon`. Each one names the exact reference files to
mirror and ends by running the check script.

The detail that makes them work: a skill **inlines the live reference source at invocation time**
rather than describing it. It reads the canonical feature as it exists today, so it can never
scaffold from a stale mental model of a convention that has since moved.

This is the layer that makes the rest of this standard hold at scale, and it is the highest-
leverage thing in the whole repository. A convention that is generated correctly by default is
followed; one that has to be remembered is followed for about a month.

---

## No path aliases

`resolve.alias` is empty, `tsconfig.paths` is empty. Imports are deep and relative.

Aliases hide how far away something is. `../../../../` is a design smell you can see from across
the room, and `@/commons/...` is the same smell with the smell removed.

---

## Commands

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

When a project accumulates more than a handful of repeated shell incantations, they go into a
`Makefile` or `justfile`. Not into a README the next person has to read.
