# Third-party notices

This repository redistributes the third-party work listed below, unmodified in `vendor/<name>/upstream/`
and with any changes recorded as separate patch files in `vendor/<name>/patches/`. The patch files are
the statement of changes that the Apache License 2.0, section 4(b), asks for. Each item keeps its own
licence; the MIT licence in `LICENSE` covers only this repository's original work.

`vendor/vendor.json` is the machine-readable version of this table: upstream, path, pinned commit,
licence, patches and review date.

| Item | Upstream | Pinned | Licence | Licence file | Changes |
| --- | --- | --- | --- | --- | --- |
| impeccable (skill and 4 agents) | https://github.com/pbakaus/impeccable | skill-v4.3.1 (cd12f86) | Apache-2.0 | `vendor/impeccable/LICENSE`, `vendor/impeccable/NOTICE.md` | none |
| impeccable engine (Windows binary, not stored in this repo) | https://github.com/pbakaus/impeccable/releases/tag/engine-v0.1.5 | engine-v0.1.5 | Apache-2.0 | as above | none |
| emil-design-eng | https://github.com/emilkowalski/skills | 85e8e23 | MIT | `vendor/emil-design-eng/LICENSE` | description rewritten to state when it applies |
| review-animations | https://github.com/emilkowalski/skills | 85e8e23 | MIT | `vendor/review-animations/LICENSE` | none |
| apple-design | https://github.com/emilkowalski/skills | 85e8e23 | MIT | `vendor/apple-design/LICENSE` | set to manual invocation |
| systematic-debugging | https://github.com/obra/superpowers | v6.4.1 (5bf4e78) | MIT | `vendor/systematic-debugging/LICENSE` | references to uninstalled sibling skills replaced; npm replaced by pnpm |
| grilling | https://github.com/mattpocock/skills | c55ee46 | MIT | `vendor/grilling/LICENSE` | set to manual invocation |
| swiftui-expert-skill | https://github.com/AvdLee/SwiftUI-Agent-Skill | 5.1.0 (b24e68a) | MIT | `vendor/swiftui-expert-skill/LICENSE` | none |
| vercel-react-best-practices | https://github.com/vercel-labs/agent-skills | 063bee9 | MIT, declared in the skill's frontmatter; the upstream repository has no licence file | none upstream | none |
| design-taste-frontend | https://github.com/Leonxlnx/taste-skill | 5217fb4 | MIT | `vendor/design-taste-frontend/LICENSE` | set to manual invocation |
| chrome-devtools-mcp (configuration only; the package is fetched by pnpm) | https://github.com/ChromeDevTools/chrome-devtools-mcp | 1.9.0 | Apache-2.0 | upstream | none |
