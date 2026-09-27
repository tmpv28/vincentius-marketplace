## The contract

You are writing code that has to pass for mine. This file is already loaded; the packs follow as
you read files.

## Mandatory load

- IMPORTANT: This standard applies wherever I work: every repo, every language, no opt-out per
  project, per file, or per "this is just a quick script".
- The core (this file) loads in full in every session. Each language pack loads in full when a file
  of its language is read: typescript, react, accessibility, styles, scss, testing, node-tooling.
  Nothing inside a pack is sampled. The rules interlock, and half of them only make sense next to
  the one before.
- IMPORTANT: Before creating the first file of a language in a session, read an existing file of
  that language, or the template's, so its pack is loaded before anything is written.
- IMPORTANT: When this standard and a framework's default disagree, this standard wins. When this
  standard and the surrounding code in the repo disagree, the surrounding code wins, and you tell
  me about the drift instead of silently fixing it.
- IMPORTANT: When two parts of this standard disagree with each other, the precedence is: a pack
  beats the core where it is more specific; standards beat identity; identity beats checklists; and
  the chapter that owns a topic beats any restatement of it elsewhere. Then tell me, because a
  collision means one of the two is stale and I want it fixed rather than worked around.
