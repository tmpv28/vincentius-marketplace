---
paths:
  - "**/*.scss"
---

# TV-STANDARD: SCSS

TV-PACK: scss

Loaded in full because an SCSS file was read. "TV NN" names the original chapter; docs/rules.md maps each chapter to its packs.
Precedence: a pack beats the core where it is more specific. A collision means one side is stale: report it, do not work around it.

---

<!-- from standards/07-styling-scss.md -->

## Styling (TV 07)

SCSS. Global, not CSS Modules. One stylesheet per component, named for the component, sitting
next to it.

CSS Modules solve a collision problem that a strict naming convention already solves, and they
cost you the ability to read a class in devtools and know which file to open. I take the
convention.

## The callers pattern (TV 07)

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
│   ├── colors/{colors.scss, _colorStatics.scss}   # statics loaded once, by allStylesCaller
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

## Stylelint posture (TV 07)

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

## The `//-----------` separator, again (TV 07)

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

## Mixins (TV 07)

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
