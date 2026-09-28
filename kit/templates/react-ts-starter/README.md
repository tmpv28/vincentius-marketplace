# react-ts-starter

A React 19 + TypeScript + Vite starter that ships the TV-STANDARD conventions already applied.
It is not a blank Vite app with a linter bolted on: the API layer, the response object system,
the context split, the shared component vocabulary and the SCSS system are all present and
wired, with one neutral demo entity ("Note") running through every layer.

Copy the folder, rename it in `package.json`, point `VITE_API_BASE_URL` at a server, and the
shape of the codebase is already decided.

## Quick start

```bash
pnpm install
cp .env .env.local        # then fill in the real values in .env.local
pnpm dev
```

The committed `.env` is a schema with no values. Real values live in `.env.local`, which is
gitignored, always.

## Commands

```bash
pnpm dev              # Vite dev server on port 3000
pnpm build            # Production build to dist/
pnpm preview          # Serve the production build

pnpm std:check        # Format, auto-fix, type check and lint. Must be clean before anything ships.
pnpm lint:js          # ESLint, report only
pnpm lint:fix         # ESLint with --fix
pnpm lint:styles      # Stylelint over every SCSS file

pnpm test:no-watch    # Full test suite, single run
pnpm test:unit        # Unit tests in jsdom, single run
pnpm test:watch       # Test suite in watch mode
pnpm test:coverage    # Coverage report

pnpm storybook        # Storybook on port 6006
pnpm build-storybook  # Static Storybook build
```

`pnpm std:check` is the one that matters. It runs Prettier, ESLint `--fix`, `tsc --noEmit`, a
report-only ESLint pass and a report-only Stylelint pass, and it has to come back clean before
anything is called done.

## What is in the box

- The full API layer: services, CRUD controllers, response-action handling and a worked
  `notes` entity with create and read endpoints.
- `responseObjectSystem`: one vocabulary for "did this work and why not", with an overloaded
  factory and a runtime brand that survives serialisation.
- The hand-written type-check kernel: `isSpecificType`, `isNullOrEmpty`, `areEqual`.
- A split state/actions Toast context in the four-file layout.
- Shared components: Button, Input, Tooltip, GenericModal, DataViewer (which owns its own loading,
  error and empty states), LoadingSkeleton, EmptyState and the toasts controller.
- The SCSS system: callers with `@forward`, theme colours as RGB triplets on custom properties,
  mixins injected into every stylesheet with no import line.

## The demo page

With no backend configured the app still renders a working page. The notes list is local React
state seeded from `ManageNotes/modules/constants/demoNotesDefinition.ts`. Nothing fakes a
request: the API layer is built and typed, and it is the scaffold to switch to once a server
exists. `CLAUDE.md` says where the swap happens.

## Governing standard

The conventions in this template come from TV-STANDARD, installed as Claude Code rules in
`~/.claude/rules/tv/` (a core that always loads, plus packs that load by file type). Read the core
and the packs for the files you touch before changing anything here.
