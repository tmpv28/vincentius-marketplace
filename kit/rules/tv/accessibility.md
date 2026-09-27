---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.html"
  - "**/*.htm"
  - "**/*.vue"
  - "**/*.svelte"
---

# TV-STANDARD: Accessibility

TV-PACK: accessibility

Loaded in full because a UI file was read. "TV NN" names the original chapter; docs/rules.md maps each chapter to its packs.
Precedence: a pack beats the core where it is more specific. A collision means one side is stale: report it, do not work around it.

---

<!-- from standards/04-react-components.md -->

## Accessibility (TV 04)

Short, because most of it falls out of conventions already in this file, and non-negotiable
because the rest of the standard actively creates the risk: mandated tooltips on disabled
controls, modals, icon-only buttons, and an `!important`-heavy layer sitting on top of a
third-party library's own styles.

- **Everything interactive is reachable by keyboard and shows focus.** If a `div` has an
  `onClick`, it is a `button`. The `!important` layer must not remove the focus ring; if a design
  dislikes the default, replace it, do not delete it.
- **Every control has an accessible name.** An icon-only button gets `aria-label`; an input gets
  a `label` tied by `htmlFor`, not a placeholder standing in for one.
- **A tooltip is not an accessible name.** The disabled-control rule from the validation section
  says the reason must be visible; it must also be reachable, which means the reason goes on the
  control via `aria-describedby` or `title`, not only in a hover-only layer.
- **A modal traps focus while open and returns it to the trigger on close.** This is the one
  thing a shared `GenericModalComponent` must get right, because every feature inherits it.
- **Disabled versus `aria-disabled`.** A truly unavailable control is `disabled`. A control that
  is blocked by validation the user can fix stays focusable with `aria-disabled`, so a keyboard
  user can reach it and read why.
- Airbnb ships `jsx-a11y` and this standard turns off four of its rules
  (`no-autofocus`, `label-has-associated-control`, `no-static-element-interactions`,
  `click-events-have-key-events`). Each of those is a rule you are now enforcing by hand. Turning
  one off is a decision to do its job yourself, not a decision that its job does not matter.
