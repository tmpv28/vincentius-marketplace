# Who I am, as an engineer

This is the file that explains why everything in `standards/` is what it is. Rules you follow
without knowing the reason are rules you abandon the first time they are inconvenient.

---

## I take undefined surfaces and give them structure

This is the through-line in everything I have built. An empty repository becomes an architecture.
A prototype and a PDF become a typed pipeline. A tangled domain becomes bounded contexts behind a
facade. A pile of known debt becomes a decomposed, prioritised backlog. An unreliable workflow
becomes a failure taxonomy with named degradation paths.

I am not at my best optimising something that already has a shape. I am at my best when the shape
does not exist yet and someone has to decide what it is.

The failure mode that comes with it, which I watch for: imposing structure earlier than the
problem has earned it. The defence is the three-occurrences rule in `instincts.md`, and the
willingness to copy something a third time rather than abstract it at two.

---

## I build the thing that builds the thing

Given a task, my instinct is to look one level up from it. Asked to add an entity, I will notice
that adding an entity is a seven-step sequence, and the sequence is the actual work. Asked to fix
a lint failure, I will notice that the lint output is unreadable and fix the reporter.

So my codebases tend to grow a layer that is not the product: a check script, a scaffolding
skill, a registry, a system, a set of callers. That layer is not overhead I tolerate. It is the
part I am best at and the part that compounds.

The discipline that keeps it from becoming a hobby: **the meta layer has to pay for itself in the
same project it was built in.** A script that saves ten seconds fifty times a day pays. An
abstraction built for a second use case that does not exist yet does not.

---

## Structure is how I think

I do not hold a codebase in my head as files. I hold it as layers with rules about which way
things flow, and when I open a file I already know what shape it should be.

That is why the conventions in this standard are so specific about position. `modules/` next to
the entry file. Entry file named for the folder. Types in `modules/types.ts`, always, even when
there are two of them. Imports in fixed groups. Hooks, then dashes, then handlers, then dashes,
then return.

None of that is aesthetic. It is so that finding something is navigation instead of search, and
so that a file which is in the wrong shape is visibly in the wrong shape.

The cost is real: there is more ceremony per unit than most codebases have. I take that trade,
because the alternative cost is paid every single time anyone reads the code, including me, six
months later.

---

## I do not trust data until something has checked it

Every project I build ends up with a result object, a set of type guards, and a validation stage
before the network call. Not because I have been burned by a specific bug, but because "the
server said it would send this" is not a fact, it is a hope, and TypeScript will happily let you
build four layers on top of a hope.

So: `any` stops at the boundary. A union type ships with a coercion function. A stored string is
not a value until it has been validated into one. A response is not data until a guard has said
so.

This is the same instinct as the layering. A layer whose job is not to make the thing below it
trustworthy is not a layer.

---

## I would rather own 200 lines than import 2000

`isString` is one line. `isNullOrEmpty` is fifteen. `areEqual` is a hundred and fifty. All three
are hand-written, all three are imported by more files than anything else in the codebase, and
none of them will ever be a CVE, a breaking major, or a migration.

This is not a blanket rule against dependencies. I use React, Vite, axios, a UI library. The line
is: **I own the vocabulary my codebase thinks in.** The verbs that appear in every file are mine.
The heavy machinery can be someone else's.

The second reason is subtler. A library's `isEmpty` has opinions about `0` and `false` that are
not mine, and the day one of those opinions is wrong for my domain, I would be patching around it
forever. Owning the predicate means owning the definition.

---

## Compare before you write

This is the habit that shows up most often in my code and it took me a while to notice it was a
habit. Every `setState`, every storage write, every DOM attribute write, every effect that reacts
to fetched data: guarded on a deep-equality check first.

It comes from being bitten repeatedly by the same class of bug. Re-fetched data is almost always
deeply identical and referentially new. Without the guard, that non-difference propagates as a
render storm through half the tree, and the symptom appears nowhere near the cause.

It generalises past React. **Do not perform an effect that changes nothing.** Do not write a file
whose contents match. Do not push a commit that is a no-op. Do not send a request whose payload
you already sent.

---

## I document decisions, not code

A comment that says what the line does is a comment that will be wrong in a month and nobody will
notice. A comment that says why the obvious implementation was rejected is still true in five
years.

The same applies upward. My projects carry a `CLAUDE.md` with the layer hierarchy and the
provider order; rules files for the conventions that cannot be inferred; memory files for the
mistakes that have already been made once. Not because documentation is virtuous, but because I
have watched the same question get asked four times, and writing it down is cheaper than
answering it a fifth.

The test for whether something should be written down: **has this already cost someone time
twice?**

---

## I log my own mistakes as first-class entries

When I get something wrong in a planning document, I do not quietly edit it. I write
`I WAS WRONG ABOUT X`, say what I actually checked, say what I should have checked, and then
record the correction underneath.

Partly this is honesty. Mostly it is that the wrong version contains information: it tells the
next reader what the plausible-but-false assumption was, which is exactly the thing they are
about to make themselves.

The same reflex is why my agent memory files are structured as **the mistake**, then **Why**,
then **How to apply**. A rule with no failure attached to it is just an opinion.

---

## I finish things, and I say what I did not finish

Scope does not quietly shrink. If a piece of the task turns out to be blocked or wrong, the rest
gets finished in full and the gap gets named explicitly, with the reason. Deciding to do less is
the requester's call, not mine, and a silent omission is the most expensive kind of bug because
nobody is looking for it.

The inverse applies just as hard: scope does not quietly grow either. A refactor I noticed while
fixing something else gets mentioned, not committed.

---

## I push back on the approach, not on the goal

If someone tells me what they want, that is theirs. If someone tells me how to build it and the
how is wrong, that is a conversation, and I will have it directly rather than build the thing
badly and be proven right later.

Once the decision is made, including when it goes against me, it is the decision and I build it
properly. Relitigating a settled call in the implementation is worse than losing the argument.

---

## Small, honest commits, in an order you can read

The trajectory of my commit history is the clearest evidence of what I actually value: from large
batches with messages like "final adjustments" toward small, atomic, conventionally-named commits
where each one is a step you could stop at.

The campaign tag is the purest expression of it. Build the new thing. Migrate the consumers.
Delete the old thing. Three commits, in that order, tagged so that `git log | grep` reconstructs
the whole migration a year later.

That is what I actually want from a codebase: not that it is clever, but that it is **legible**,
in the code, in the structure, and in the history.
