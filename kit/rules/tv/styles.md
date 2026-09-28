---
paths:
  - "**/*.scss"
  - "**/*.css"
---

# TV-STANDARD: Styles

TV-PACK: styles

Loaded in full because a stylesheet was read. "TV NN" names the original chapter; the chapter map at the end of the core names the packs of each chapter.
Precedence: a pack beats the core where it is more specific. A collision means one side is stale: report it, do not work around it.

---

<!-- from standards/07-styling-scss.md -->

## Class naming (TV 07)

BEM, with a **PascalCase block that is exactly the component name**.

```scss
.AddNoteFeature {
  &__content { }
  &__content--collapsed { }
}

.ButtonComponent {
  &--large { }
  &--transparent-with-border { }
}
```

A class in devtools tells you the file. That mapping is the whole reason for the convention and
it is worth more than scoping.

Utility classes are the opposite casing, deliberately: **snake_case**, global, composable.

```scss
.cursor_pointer { }
.width_100 { }
.background_color_accent { }
.disabledAction { }
```

PascalCase means "owned by one component". snake_case means "global, use anywhere". You can tell
which kind of class you are looking at before you read the name.

## Property order (TV 07)

Grouped by concern, blank line between groups. **Not alphabetical.**

```scss
.ButtonComponent {
  width: fit-content;
  min-width: fit-content;
  height: fit-content;

  position: relative;
  display: inline-block;
  overflow: hidden;

  color: $color_white;
  background-color: transparent;
  border-radius: 4px;

  font-family: $font_bold;
  font-size: 17px;
  letter-spacing: 0.2px;

  transition: all 0.2s linear;
  cursor: pointer;
}
```

The groups, in order: **size, layout/position, colour, typography, behaviour**. Alphabetical
ordering scatters `width` and `height` to opposite ends of a rule and tells you nothing. Grouping
means you can find the thing you want to change by knowing what kind of thing it is.

The stylelint `order/properties-alphabetical-order` rule is explicitly **off**. If the tooling
disagrees with the convention, the tooling is wrong and gets changed.

## Colour (TV 07)

Colours are declared **once**, as RGB triplets on CSS custom properties, and consumed through a
SCSS helper.

```scss
:root {
  --color-accent: 103, 187, 222;
  --color-white: 244, 246, 250;
}

[data-appTheme="light-theme"] {
  --color-white: 12, 14, 18;
}
```

```scss
$color_accent: themeRgba(--color-accent);
$color_white: themeRgba(--color-white);

.Thing {
  color: $color_white;
  border-color: themeRgba(--color-accent, 0.4);
}
```

Why triplets rather than full colours: opacity. `rgba(var(--color-accent), 0.4)` works, and
`rgba(var(--color-accent-as-hex), 0.4)` does not. Every colour becomes available at any alpha
without declaring a second variable.

Theming is then a variable swap on one attribute, never a second stylesheet and never a
`isDarkMode ? x : y` in a component.

A caveat the literal names create: under a light theme `--color-white` resolves to near-black,
so `color: $color_white` no longer describes what it paints. Keep the literal names in
`_colorStatics.scss`, where they describe the palette, and add semantic aliases
(`--color-text-primary`, `--color-surface`) for anything that flips between themes. Components
consume the semantic name.

Rules:

- No hex literals in a component stylesheet. Ever. If the colour does not exist as a variable,
  add it to `_colorStatics.scss` first.
- Every colour that exists gets a `.color_x` and `.background_color_x` utility class, so generic
  components can take a colour by name.
- CSS custom property names are `--kebab-case`. SCSS variable names are `$snake_case`. The two
  casings tell you which side of the boundary you are on.
- `_colorStatics.scss` is **loaded once**, forwarded from `allStylesCaller.scss`, and never through
  the injected tooling chain. It holds real CSS, the `:root` block and the utility classes, and
  anything in the injected chain is compiled into every component stylesheet: five components,
  five copies of the palette, one more per component. `colors.scss` holds only the `$color_x`
  variables, which emit nothing, so injecting it costs nothing.

## The action-state classes (TV 07)

Four global classes describe the interaction state of any control, and they are the most repeated
thing in the whole stylesheet layer. Every component folds the relevant ones into its `classNames`
object rather than styling its own disabled or error appearance.

```
resources/styles/actionStyles/
├── disabledAction.scss
├── readOnlyAction.scss
├── errorAction.scss
└── warningAction.scss
```

```typescript
const classNames = {
  rootContainer: `InputComponent ${disabled ? "disabledAction" : ""} ${readOnly ? "readOnlyAction" : ""} ${hasError ? "errorAction" : ""}`
};
```

They cascade, which is the point: a disabled composite greys its label, its icon and its border
without each of those knowing it is inside a disabled thing. It is also the reason for the opt-out
class, `ignoreErrorActionColors`, which a descendant carries when it must keep its own colour
inside an errored parent.

Rules:

- A component never writes its own `:disabled` colour rules. It applies the class.
- The four names are fixed. There is no fifth, and adding one is a decision about the design
  system, not about a component.
- They live in `@layer utilities` so a component's own rules win where it genuinely needs them to.

## What never appears (TV 07)

- A raw hex, rgb or hsl value in a component stylesheet.
- A raw pixel breakpoint in a media query.
- `@import`.
- A `.module.scss` file.
- Inline `style={{ }}` for anything that is not genuinely dynamic (a computed width, a transform).
- A class name that does not say which component owns it.
