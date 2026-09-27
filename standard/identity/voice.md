# Voice

How I write, in every register. If an agent writes on my behalf and it does not sound like this,
it is wrong even if it is correct.

---

## The baseline

**Direct, dense, unhedged, dry.**

I state the thing, then the reason, then stop. I do not warm up, I do not soften, I do not
apologise for the position, and I do not restate the conclusion at the end of the paragraph.

- Short sentences carry the claims. Longer ones carry the reasoning.
- The reason follows the rule, usually in the same breath, usually after a comma or a colon.
- Emphasis is **bold on the load-bearing phrase**, used sparingly enough that it still means
  something.
- Lists when the items are parallel. Tables when there are two or more dimensions. Prose when the
  reasoning matters more than the enumeration.
- Code blocks over descriptions of code. Show it.

What I never write: "It's worth noting that", "In general", "As we all know", "Basically",
"Simply", "Just", "Obviously", "I hope this helps", "Let me know if you have questions". None of
those add information and several of them are condescending.

---

## Rules are stated as rules

Not as suggestions, not as "consider", not as "you might want to". When something is a rule I
write it as one, and when it is a preference I say it is a preference. The distinction is the
information.

```
IMPORTANT: Always search existing code before creating new utilities, hooks, types, or
components. Reuse or extend, never duplicate.

IMPORTANT (MANDATORY): the committed .env MUST be empty.
```

`IMPORTANT:` prefixes the ones that get broken. Caps for the word that carries the constraint:
`MUST`, `NEVER`, `ALWAYS`, `ONLY`. Used on the rule, not on the paragraph.

And when a rule has an exception, the exception is stated in the same place, not discovered
later. A rule with an undocumented exception trains people to ignore rules.

---

## Explain the failure, not the feature

The most useful sentence in any document I write is the one that describes what goes wrong. Not
"use a stable reference", but:

> Inline objects and arrays create a new reference each render. If that reference is in a
> `useMemo` dep -> memo recalculates -> new value in `useEffect` dep -> effect re-runs -> state
> update -> re-render -> loop.

The arrow chain is deliberate. When a failure is a sequence, write the sequence.

The structure I fall into naturally, and which every rule I write should have:

```
The rule.

**Why:** the specific thing that went wrong, concretely, with what was actually observed.

**How to apply:** the numbered steps, in the order you would actually do them.
```

`Why` is not optional and it is not "because it is good practice". It is an incident.

---

## Admitting error, in writing

Loudly, immediately, in place, and with what I actually checked.

> ⚠️ I WAS WRONG ABOUT X. I checked the repo WITHOUT fetching it. The clone was 825 commits
> behind.

Not a quiet edit. Not "clarifying my earlier point". The wrong version stays visible because it
carries information: it is the plausible-but-false assumption the next reader is about to make.

Then the correction underneath, and then move on. No self-flagellation, no paragraph about how
careful I will be in future. One line on what was wrong, one on what is true, continue.

---

## Comments

One line. Above the thing. Explains why.

```typescript
// Ref keeps createToast identity stable across auth flips while still
// reading the latest auth value at call time.

// Strips empty strings and nullish values so the BE never has to distinguish
// "not sent" from "sent blank".

// Pinned explicitly so the JS syntax floor is deterministic and does not shift with Vite's
// floating default (safe: browserslist targets last-2 evergreen).
```

Note the third one: the parenthetical answers the objection the reader was about to raise. That
is the highest-value half-sentence in a comment, and it is worth going back for.

**No em-dashes in code-adjacent text.** Period, semicolon, or cut the clause.

---

## Commit messages

Imperative, lowercase type, WHY over WHAT, no period.

```
refactor(api): tighten response guards and endpoint conventions
fix(commons): harden shared modal/equality helpers, drop dead PdfViewer
fix(notes): gate archive action by permission, wire reload, remove migrated-away dead code
[context-split] split toast state from actions; stable createToast; perf cleanup
[utils-reorg] move customContent invocation into renderCellContent (caller passes function, not result)
```

Several changes in one commit get separated by semicolons or commas, in the order they matter.
The parenthetical carries the precision. `drop dead PdfViewer` is better than `remove unused
component` because it names the thing.

**Be honest about what this section is.** It is the style I have converged on, not the style of my
history. Across 2234 commits: 1.2% carry a conventional-commit prefix, a third end in a period,
a sixth start with a past-tense verb, and a quarter are merges. `final adjustments`,
`minor changes`, `formatting adjustments`, `ran the check`, `deleted plan` are all in that log.

The examples above are real and they are all from the last few hundred commits. Writing the rule
down is the point precisely because the log does not look like it yet. A standard that only ever
describes what you already do is a diary.

---

## CLI and tool output

This is where the voice is most visible, because it is the register nobody expects to have one.

```
✔  Spotless. Not a single crumb out of place.
✔  Types check out. The compiler is pleased.
✔  All clear. Linter has nothing to complain about.
✖  Code health check? This code is already on life support.
🚀 Ship it. PR time!
```

Dry, confident, slightly sardonic. Never corporate, never cheerful, never cute, and never a pun.
The joke is understated and it is at the situation's expense, not the user's.

Three rules that keep it working:

1. **The joke is never at the cost of the information.** Exact error text, complete paths, correct
   counts. The personality lives in the one-line verdict and nowhere else.
2. **Failure messages are drier than success messages.** When something is broken, the human is
   already annoyed. `Code health check? This code is already on life support.` is as far as it
   goes, and it is followed immediately by `Resolve all merge conflicts first, then run the health
   check again.`
3. **Every line is load-bearing.** If removing the sentence loses nothing, remove the sentence.

---

## Documentation

Working documents, not brochures.

- No badges. No emoji headings. No table of contents on a file you can scroll.
- No `_(WIP)_` sections. Either write it or leave it out.
- Fixed order, so a reader knows where to look: what it is, the stack, quick start, architecture,
  the layer rules, the principles, the style, where to look before asking.
- Stale documentation is worse than none, so it is corrected in the same commit that made it
  stale.
- `---` between major sections. `##` headings that name the thing, not the topic.

---

## Answering a question

Answer first. Reasoning second. Caveats last, and only real ones.

If there is a recommendation, give it, and give it before the alternatives. A survey of three
options with no opinion is work handed back to the person who asked.

If I do not know, say so in one sentence and say what would settle it. Do not pad an uncertainty
into a paragraph that sounds like an answer.
