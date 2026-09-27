# 08 — Comments and documentation

## The rule

**One line, above the thing, explaining WHY.**

If the function name plus its signature already tells you what it does, there is no comment.
Writing one and then deleting it once the name is right is a normal part of writing the function.

```typescript
// Ref keeps createToast identity stable across auth flips while still
// reading the latest auth value at call time.
const isAuthenticatedRef = useRef(isAuthenticated);

// Strips empty strings and nullish values so the BE never has to distinguish
// "not sent" from "sent blank".
export const removeEmptyPayloadProperties = ...

// Pinned explicitly so the JS syntax floor is deterministic and does not shift with Vite's
// floating default (safe: browserslist targets last-2 evergreen).
target: "es2022"
```

Every one of those explains a decision. None of them explains syntax.

---

## What gets a comment

| Situation | Comment |
| --- | --- |
| A trade-off was made | Yes. Say what was traded. |
| A constraint from outside forced this | Yes. Name the constraint. |
| A workaround for a library or browser bug | Yes, with the reason it is needed. |
| The obvious implementation would be wrong here | Yes. This is the most valuable comment there is. |
| A business rule the code cannot express | Yes. |
| The code does what it says | No. |
| A `// eslint-disable` | Yes, one line saying why. |
| An `any` | Yes, one line saying why the shape is not knowable. |

---

## What never gets a comment

- Anything restating the line below it.
- A section header inside a function that has one job.
- A commented-out block of code. Delete it. Git remembers.
- `// TODO: handle error`. That is a defect, not a note.
- A comment added to code that was not changed in this diff.

---

## Never rewrite an existing comment for style

Update it with new information. Leave its shape alone. If someone wrote a five-line JSDoc block
there, they had a reason, and "I prefer one-liners" is not new information.

This applies with full force to agents: reformatting existing comments to match a preference is
one of the fastest ways to make a diff unreviewable.

---

## No em-dashes

The rule and its one exception are stated in `00-non-negotiables.md`. In short: not in comments,
commit messages, UI strings, CLI output, JSDoc or type descriptions; allowed in long-form prose
documentation like this file.

---

## JSDoc

Reserved for things that are shared and load-bearing: exported utilities, factory functions,
system entry points, anything whose parameters are not self-evident.

Terse. `@param` and `@returns`, no prose essay.

```typescript
/**
 * Creates a generic response object for process flow handling.
 * @param opts - See {@link BaseResponseObjectType}.
 * @returns The response object, with `isResponseObjectType` set so guards can recognise it.
 */
```

A one-line `//` above a prop beats a `/** */` block, unless the prop's behaviour is genuinely
non-obvious.

### Object arguments document their shape, not their fields

Read the example above again. It documents one `@param` for an argument with seven fields, and
that is deliberate.

Every function here takes an object once it has two or more parameters, so this is the normal case
and not an edge one. A documentation generator binds only the **first** `@param` to a destructured
object argument. The rest are dropped silently, and the survivor is rendered as the name of the
whole object. Verified with TypeDoc.

```typescript
// Wrong. Only status survives, mislabelled as the entire argument.
/**
 * @param status - Indicates whether the process was successful (default: false).
 * @param statusCodeMsg - Specific status code message for further inspection.
 * @param msg - Description of the process status.
 * @param data - Optional data payload associated with the response.
 */
```

That block generates a reference page listing a single parameter, named `status`, typed as the
entire interface. The three descriptions below it are gone, and nothing warns you.

So field descriptions go on the interface, one line of TSDoc per property. The function keeps its
intent line, one `@param` naming the object and pointing at the shape with `{@link}`, and
`@returns`.

This is not a preference. Written the other way the generated reference is quietly wrong, and it is
wrong in the same way on every function in the codebase.

---

## Numbered steps

When a function is a genuine algorithm with distinct phases, number them. This is the one place
where comments narrate structure, because the structure is the thing worth reading.

```typescript
// 1. Strict equality covers primitives and identical references.
if (normalizedA === normalizedB) return true;

// 2. Two empty-ish values are equal regardless of which flavour of empty they are.
if (isNullOrEmpty(normalizedA) && isNullOrEmpty(normalizedB)) return true;

// 3. Anything not a container cannot be deeply equal past this point.
```

Use it sparingly. If every function needs numbered steps, the functions are too long.

---

## Banners

Three levels, and they are not interchangeable.

**Bare dashes** separate the regions of a component, a hook, a types file, or a stylesheet. No
label, no space between `//` and the dashes, a blank line either side.

```typescript
  //-----------
```

The dash count is arbitrary and varies within the same file. That is not sloppiness, it is the
actual convention: **the shape is the signal, not the length.** A longer run does not mean a
bigger break, and standardising the count would add a rule that carries no information.

Placement is formulaic: one before the handler block, one immediately before `return (`. Larger
files add one after the state block and one after the API hooks.

**Box-drawing banners** label genuine sections in a script or a registry file, where the sections
have real names.

```javascript
// ─── Constants ─────────────────────────────────────────────
// ─── Helpers ───────────────────────────────────────────────
// ─── Main ──────────────────────────────────────────────────
```

**Pipe banners** label categories in a long registry or definition file, and label real sections
inside a component that has genuinely outgrown bare dashes.

```typescript
// ------| Arrows |------
// ------| Status |------

// -----| HANDLE ROWS SELECTION |---------
// -----| LOAD ROW'S DATA |---------
```

Caps inside the pipes when it is a section of behaviour; title case when it is a category of
things. A component that needs four of these is a component that should have been split, and the
banners are the warning, not the solution.

---

## Trailing comments on dependency arrays

When a dependency array is non-obvious, it is justified on the same line. This is the one place a
trailing comment beats a comment above.

```typescript
}, [location.key, navigate]); // location.key as a dependency for guaranteed execution on every navigation.
```

Since `react-hooks/exhaustive-deps` is off, a dependency array is a claim about intent. A
deliberately incomplete one without a note is indistinguishable from a mistake.

---

## The architecture docblock

When a module encodes a **pattern** rather than a function, it gets a block comment at the top
that explains the pattern, in numbered parts. This is the exception to "one line, above the
thing", and it earns it: the reader needs the model before the code means anything.

```typescript
/**
 * --------------------------------------
 * GLOBAL WINDOW GATEKEEPER SYSTEM
 * --------------------------------------
 * This module implements the "Secure Gatekeeper Pattern".
 *
 * ARCHITECTURE:
 *  1. Obscurity: the API is attached to a Symbol on the window object.
 *  2. Immutability: the exposed object is frozen.
 *  3. Authentication: access is granted via a connect(key) handshake.
 */
```

If you find yourself writing one of these for something that is not a pattern, the module is
doing too much.

---

## Project documentation

Every project gets a `CLAUDE.md` at the root, and it contains, in this order:

1. What the project is, in three lines.
2. The stack, as a list.
3. Quick start commands, as a code block.
4. The architecture tree.
5. The layer hierarchy.
6. The context provider order.
7. Key principles, each prefixed `IMPORTANT:` when it is a rule and not a preference.
8. Comment and writing style.
9. Where to look before asking.

It is a working document, not a brochure. No badges, no emoji headings, no table of contents, no
`_(WIP)_` sections that stay WIP for a year. If a section is not true any more, fix it in the
same commit that made it untrue.

Rules that are too detailed for `CLAUDE.md` go in `.claude/rules/<topic>.md`, scoped by path.
Things I have corrected more than once go in `.claude/memory/`.
