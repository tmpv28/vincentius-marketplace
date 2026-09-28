---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/vite.config.*"
  - "**/vitest.config.*"
  - "**/vitest.setup.*"
---

# TV-STANDARD: Testing

TV-PACK: testing

Loaded in full because a test file or test config was read. "TV NN" names the original chapter; the chapter map at the end of the core names the packs of each chapter.
Precedence: a pack beats the core where it is more specific. A collision means one side is stale: report it, do not work around it.

---

<!-- from standards/09-testing.md -->

## The position (TV 09)

**Test the logic, not the render.** Precisely: pure modules by default; pure render-mappers and
DOM utilities under jsdom when that is what the unit is; never a component or hook driven through
a rendered tree.

The jsdom shims in `vitest.setup.ts` exist for that middle category, not as the first step toward
render tests.

**No `@testing-library/react`.** No `render()`, no `screen.getByRole`, no fireEvent cascades. Not
because they are worthless, but because that style of test costs more to maintain than it catches:
it breaks on markup changes and passes through broken business rules.

The first move is always to take the logic **out** of React and into pure modules, and test those
properly. If a rule is hard to test without rendering, the rule is in the wrong place, and moving
it is the fix.

**Where something genuinely has to be mounted, it goes through a local harness**, not a library.
Re-render identity, tri-state transitions, controlled-input round-trips: these are real behaviours
that do not decompose into a pure function, and about a third of my test files do mount for them.
The harness is thirty lines; create it as `commons/testUtils/renderIntoContainer.tsx` the first time a test
needs it:

```typescript
// Shared harness for the hand-rolled component and hook tests in this repo:
// createRoot -> appendChild -> act(render). Stands in for @testing-library/react's render(),
// which is deliberately not a dependency here.
export const renderIntoContainer = (element: ReactNode) => { ... };
```

Owning those thirty lines instead of taking the dependency is the same trade as the type-check
kernel: my vocabulary, no major version to migrate, and no library opinion about what a query
should match.

The distinction that matters is not "never mount" but **what the assertion is about**. Asserting
on a rendered DOM shape is brittle. Asserting that a re-render with equal props produced the same
node, or that a controlled input round-trips its value, is a contract worth pinning.

## What is tested (TV 09)

| Kind | Tested | Why |
| --- | --- | --- |
| Pure utils | Always | Cheap, stable, high leverage |
| Extracted feature logic (`modules/*.ts` reducers, calculators, mappers) | Always | This is where the bugs are |
| Type guards and validators | Always | They are the boundary |
| Pure render-mappers (data in, element out, no hooks) | Yes | They are pure functions wearing JSX |
| Components | No | Extract the logic instead |
| Hooks | No | Extract the logic instead |
| Contexts, systems | No | Their pure parts live in `modules/` and those are tested |

**The corollary is the actual rule:** when a feature has real logic, extract it to
`modules/<name>.ts` as pure functions, and write the test file next to it. A feature folder with
a 400-line component and no `modules/` is the smell.

## Location and naming (TV 09)

Colocated. `<sourceFile>.test.ts` next to `<sourceFile>.ts`. No mirrored `test/` tree. If the file
moves, its test moves with it because it is right there.

A `__tests__/` folder inside a `modules/` is tolerable when one module has several test files that
would otherwise bury the source, and it is the only shape allowed to break colocation. One per
project is about right; more than that and the colocation rule has quietly been abandoned.

## Phrasing (TV 09)

`describe` takes the **exported symbol name**, not a sentence. `it` takes a present-tense,
third-person verb phrase.

```typescript
describe("checkIfElementIsVisible", () => {
  it("returns false when element is null", ...);
  it("returns true when element is fully inside the viewport", ...);
  it("uses container bounds when a container is provided", ...);
});

describe("reduceChangeSet", () => {
  it("merges partial edits for the same component (last-write-wins per field)", ...);
});
```

The parenthetical is where the rule being asserted goes. A failing test name should be a complete
sentence about what is broken, with no need to open the file.

A **nested** `describe` takes a prose scenario clause rather than a symbol, so the full path reads
as a sentence:

```typescript
describe("computeNextSelection", () => {
  describe("when the parent row is already selected", () => {
    it("leaves the child rows untouched", ...);
  });
});
```

Outer describe: the symbol. Inner describes: the condition. `it`: the behaviour.

## Shape (TV 09)

Compressed. Arrange, act and assert frequently collapse into one or two lines. No blank-line AAA
sections, no `// Arrange` comments.

```typescript
it("collects field edits by component id", () => {
  const ops: ChangeOpType[] = [{ type: "editNode", componentId: "c1", fields: { serial: "SN-1" } }];
  expect(reduceChangeSet(ops).editsById.get("c1")).toEqual({ serial: "SN-1" });
});
```

Every test file starts with local factory helpers, arrow functions, `Partial<T>`-override shaped:

```typescript
const makeElement = (rect: Partial<DOMRect>): HTMLElement => { ... };
const baseArgs: RenderViewerContentArgsType = { ... };
const render = (overrides: Partial<RenderViewerContentArgsType>) =>
  renderViewerContent({ ...baseArgs, ...overrides });
```

The override-factory is what keeps tests readable: each test states only the thing that makes it
different, and the difference is the test.

## Mocking (TV 09)

Minimal, and always with a one-line reason.

```typescript
// react-pdf pulls in a worker/DOM pipeline that does not import cleanly under the test env.
vi.mock("react-pdf", () => ({ Document: () => null, Page: () => null }));
```

Mock only what the environment genuinely cannot load. Do not mock your own modules: if a test
needs your module faked, the unit under test has a dependency it should not have.

`vi.fn()` for callback props. Prefer a fake over a mock for anything internal.

## Setup (TV 09)

Vitest configured **inside `vite.config.ts`**, not in a separate `vitest.config.ts`. One config
file, one place to look.

```typescript
// The config has to come from "vitest/config"; the `test` key is not on Vite's own defineConfig.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts"
  }
});
```

`globals: true` is on, and imports are still written explicitly at the top of every test file:

```typescript
import { describe, it, expect, vi } from "vitest";
```

The globals are there so a config change does not break everything. The imports are there so a
reader knows where `expect` came from.

`vitest.setup.ts` fills jsdom gaps only: `matchMedia`, `ResizeObserver`, portals flattened to
identity. Nothing about the app goes in there.

---

<!-- from standards/09-testing.md -->

## Dates (TV 09)

Always `Date.UTC(...)`-constructed, always asserted against a literal. Never `new Date()` in a
test, never a local-timezone constructor. A test that passes in Lisbon and fails in Denver is not
a test.
