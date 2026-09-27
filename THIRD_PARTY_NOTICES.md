# Third-party notices

This repository redistributes the third-party work listed below, unmodified in `vendor/<name>/upstream/`
and with any changes recorded as separate patch files in `vendor/<name>/patches/`. The patch files are
the statement of changes that the Apache License 2.0, section 4(b), asks for. Each item keeps its own
licence; the MIT licence in `LICENSE` covers only this repository's original work.

`vendor/vendor.json` is the machine-readable version of this table: upstream, path, pinned commit,
licence, patches and review date. This file is generated from it by `node scripts/notices.mjs`; edit
vendor.json, then regenerate.

| Item | Upstream | Pinned | Licence | Licence file | Changes |
| --- | --- | --- | --- | --- | --- |
| impeccable (skill and agents) | https://github.com/pbakaus/impeccable | skill-v4.3.1 (cd12f86) | Apache-2.0 | `vendor/impeccable/LICENSE`, `vendor/impeccable/NOTICE.md` | `001-pnpm-consent-no-sandbox-evasion.patch`: `npx impeccable` and `${CLAUDE_PLUGIN_ROOT}` paths replaced by the vendored launcher (the file name says pnpm; the launcher is what replaced npx); doctor states what `--fix` will change and waits for consent; the advice to route around a sandboxed shell removed; each changed file carries a modification notice; `002-pin-engine-sha256.patch`: both launchers verify a downloaded engine against the sha256 pinned per version and asset from vendor.json (`impeccable-engine.assetSha256`), never the release's `.sha256` sidecar or `IMPECCABLE_DOWNLOAD_BASE`; an asset without a pinned value is refused |
| impeccable-engine (binary, not stored in this repo) | https://github.com/pbakaus/impeccable/releases/tag/engine-v0.1.5 | engine-v0.1.5 | Apache-2.0 | upstream | none |
| emil-design-eng | https://github.com/emilkowalski/skills | main (85e8e23) | MIT | `vendor/emil-design-eng/LICENSE` | `001-description-use-when.patch`: description rewritten to state when the skill applies |
| review-animations | https://github.com/emilkowalski/skills | main (85e8e23) | MIT | `vendor/review-animations/LICENSE` | none |
| apple-design | https://github.com/emilkowalski/skills | main (85e8e23) | MIT | `vendor/apple-design/LICENSE` | `001-manual-only.patch`: set to manual invocation (`disable-model-invocation: true`) |
| systematic-debugging | https://github.com/obra/superpowers | v6.4.1 (5bf4e78) | MIT | `vendor/systematic-debugging/LICENSE` | `001-tv-references.patch`: references to the uninstalled superpowers sibling skills replaced by TV 09 and the project gate; `npm test` replaced by `pnpm test` |
| grilling | https://github.com/mattpocock/skills | main (c55ee46) | MIT | `vendor/grilling/LICENSE` | `001-manual-only.patch`: set to manual invocation (`disable-model-invocation: true`) |
| swiftui-expert-skill | https://github.com/AvdLee/SwiftUI-Agent-Skill | 5.1.0 (b24e68a) | MIT | `vendor/swiftui-expert-skill/LICENSE` | `001-claude-skill-dir.patch`: `${SKILL_DIR}`, which Claude Code does not set, replaced by `${CLAUDE_SKILL_DIR}` |
| vercel-react-best-practices | https://github.com/vercel-labs/agent-skills | main (063bee9) | MIT (declared in SKILL.md frontmatter; the repository has no LICENSE file) | none upstream | `001-pnpm-dlx.patch`: `npx svgo` replaced by `pnpm dlx svgo` |
| design-taste-frontend | https://github.com/Leonxlnx/taste-skill | main (5217fb4) | MIT | `vendor/design-taste-frontend/LICENSE` | `001-manual-only.patch`: set to manual invocation (`disable-model-invocation: true`); `002-pnpm-and-tv-precedence.patch`: npm, yarn and `@latest` installs replaced by pnpm; an available image tool is preferred, no longer mandatory; a note that the TV styles and scss packs win over its Tailwind and shadcn defaults |
| chrome-devtools-mcp (configuration only; the package is fetched by pnpm) | https://github.com/ChromeDevTools/chrome-devtools-mcp | 1.9.0 | Apache-2.0 | upstream | none |
