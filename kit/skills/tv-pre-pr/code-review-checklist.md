# Checklist: reviewing code

Read in this order. The order is the priority: a duplication problem matters more than a naming
problem, and both matter more than anything the formatter owns.

---

## 1. Does this already exist?

The first question, every time. A new utility, hook, type, component, constant or style that
duplicates something already in the tree is the one defect I treat as unconditional.

- [ ] Searched for the new utility's behaviour, not just its name.
- [ ] Checked whether an existing thing could have been extended.
- [ ] If two things now almost do the same job, said so. That is an abstraction problem, not a
      style note.

---

## 2. Are the layers respected?

- [ ] Pages orchestrate; they do not mutate or validate.
- [ ] Features own their operation end to end.
- [ ] Shared components have zero domain knowledge.
- [ ] Nothing bypasses the API layer to touch the network.
- [ ] Nothing imports across sibling `modules/` folders.

---

## 3. Do the types tell the truth?

- [ ] No cast standing in for a check.
- [ ] Type guards at the right depth for the payload they inspect.
- [ ] `any` only where the shape genuinely is not knowable, with a reason.
- [ ] A union type that arrived from outside has a coercion function, not an assertion.

---

## 4. Which paths are unhandled?

- [ ] Empty state.
- [ ] Loading state.
- [ ] Error state, and what the user actually sees.
- [ ] The rejected promise nobody caught.
- [ ] The array that could be length zero.
- [ ] The permission that was checked in the UI but not at the call.

---

## 5. Do the names still describe the code?

- [ ] The name says what it is, not what it did when it was written.
- [ ] Booleans are questions. Handlers say what they handle.
- [ ] Nothing is called `data`, `info`, `item`, `helper`, `manager` or `utils` as its whole name.
- [ ] Suffixes are correct and load-bearing.

---

## 6. Do the comments explain WHY?

- [ ] Comments explain decisions, not syntax.
- [ ] Anything surprising has a comment; anything obvious does not.
- [ ] No existing comment was reformatted for taste.
- [ ] `TODO`s that should be decisions have been flagged as decisions.

---

## What I do not comment on

Formatting. Line length. Quote style. Import order. Trailing commas. Whitespace.

The tooling owns all of it. A review that spends its attention there has spent its attention, and
the real problem in the diff goes out unnoticed.

---

## How I write the comment

**The concern, not the solution.** The implementer owns the fix. My job is to make sure they are
looking at the right thing, not to design it for them.

**Name the failure, not the rule.** "This breaks when the list is empty" beats "consider handling
the empty case". One is a bug report, the other is a preference.

**Say which ones are blocking.** A review where everything reads with the same weight is a review
that gets skimmed. Blocking, recommended, optional. Say which.

**If it is good, say that too, once, specifically.** Not as encouragement. Because a reviewer who
only ever appears when something is wrong is a reviewer people route around.
