# 07 — Styling

SCSS. Global, not CSS Modules. One stylesheet per component, named for the component, sitting
next to it.

CSS Modules solve a collision problem that a strict naming convention already solves, and they
cost you the ability to read a class in devtools and know which file to open. I take the
convention.

---

## The callers pattern

SCSS barrels are called **callers**, they use `@forward`, and they are the only files allowed to
know where anything lives.

```
resources/styles/
├── callers/
│   ├── allStylesCaller.scss              # everything, for the app entry
│   ├── toolingCaller.scss                # variables + mixins, injected into every file
│   ├── variablesCaller.scss
│   ├── mixinsCaller.scss
│   └── defaultComponentStylesCaller.scss
├── functions/
│   └── _themeRgba.scss                    # the colour helper, forwarded by variablesCaller
├── variables/
│   ├── colors/{colors.scss, _colorStatics.scss}
│   ├── _breakpoints.scss
│   └── _fontVariables.scss
├── mixins/{display,position,size,_responsive}.scss
├── defaultComponentStyles/{structure,text,scrollbar}.scss
├── _layerDeclaration.scss
├── global.scss
└── main.scss
```

`toolingCaller.scss` is injected into every SCSS file by the build:

```typescript
css: {
  preprocessorOptions: {
    scss: {
      additionalData: `@use "/src/resources/styles/callers/toolingCaller.scss" as *;`
    }
  }
}
```

So every component stylesheet has variables and mixins available with no import line. A component
`.scss` file starts with a class, never with plumbing.

`@use` and `@forward`, never `@import`. `@import` is deprecated and it re-evaluates a file at
every import site, so shared rules land in the output once per importer. The module system loads
each file once regardless of how many places pull it in.

`@use` consumes a module; `@forward` re-exports one, which is all a caller ever does. The
`as *` on the tooling caller is deliberate and is the one place it is justified: that file is
injected into every stylesheet by the build, and a namespace prefix on `$color_white` at several
thousand use sites would buy nothing.

---

## Class naming

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

---

## Property order

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

---

## Stylelint posture

`stylelint-config-standard-scss` is the base, then every rule that fights a convention in this
file is turned off, deliberately, with the reason recorded here rather than left as a mystery in
a JSON file:

| Rule | Off because |
| --- | --- |
| `order/properties-alphabetical-order` | Properties are grouped by concern, not alphabetised |
| `rule-empty-line-before`, `declaration-empty-line-before`, `custom-property-empty-line-before`, `at-rule-empty-line-before`, `scss/dollar-variable-empty-line-before` | Blank lines are the grouping device, and they land where the grouping is, not where a rule expects |
| `scss/load-partial-extension`, `scss/load-no-partial-leading-underscore` | `@forward` paths are written in full, same reason there are no barrels and no aliases: the path is the truth |
| `scss/dollar-variable-pattern`, `scss/at-mixin-pattern`, `scss/at-function-pattern`, `function-name-case` | `$color_snake_case`, `@mixin display_flex_column`, `themeRgba()` |
| `selector-class-pattern` | PascalCase blocks, snake_case utilities |
| `comment-whitespace-inside` | The `/*------| BANNER |------*/` form |
| `declaration-block-no-redundant-longhand-properties` | A layout mixin states each property explicitly so a consumer can override one of them |
| `no-descending-specificity` | Modifier nesting inside a block produces this constantly and it is never the actual problem |

The important half of this is that **the config passes clean.** A linter that is configured but
never run, or run but always failing, teaches everyone to ignore it. Either it reflects the
conventions and is enforced, or it is deleted.

---

## The `//-----------` separator, again

The same dash separator used inside components is used inside stylesheets, to split the base rule
from its modifiers.

```scss
.ButtonComponent {
  /* base */

  //-----------

  &--normal { }
  &--transparent-with-border { }
}
```

---

## Colour

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

---

## The action-state classes

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

---

## Mixins

snake_case, named for what they produce, and they are composable.

```scss
@mixin display_flex_column {
  display: flex !important;
  flex-direction: column !important;
  flex-wrap: nowrap !important;
}

@mixin display_flex_column_all_center {
  @include display_flex_column;
  justify-content: center !important;
  align-items: center !important;
}
```

Layout mixins carry `!important`. This is intentional and it is the one place I use it freely: a
layout mixin is asserting a structural fact, and it needs to win against whatever a UI library's
own stylesheet decided. Outside mixins, `!important` needs a reason.

Name the cost honestly, because it is larger than it sounds: a mature project written this way
carries over a thousand `!important` declarations. That is what wrapping a third-party component
library in your own styles actually costs. It is a trade I take, and it is the strongest argument
anyone has against this approach.

Breakpoints are consumed only through the responsive mixins, never as raw media queries:

```scss
.Thing {
  width: 400px;

  @include tablet_portrait_down {
    width: 100%;
  }
}
```

---

## What never appears

- A raw hex, rgb or hsl value in a component stylesheet.
- A raw pixel breakpoint in a media query.
- `@import`.
- A `.module.scss` file.
- Inline `style={{ }}` for anything that is not genuinely dynamic (a computed width, a transform).
- A class name that does not say which component owns it.
