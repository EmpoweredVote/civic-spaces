# Phase 17 — found while executing, deliberately not fixed here

Out-of-scope discoveries, logged rather than fixed, so the plan that owns each can pick it
up. Nothing here is a blocker for the plan that found it.

---

## 1. 🔴 A storage-blocked boot dies in `@supabase/supabase-js`, before any of our code runs

**Found during:** 17-04 Task 3 Step 7, doing the plan's own hand-check — *"`?signedout=1` in
a window with site data blocked → the welcome screen renders and naming a place still works
for the session."*

**It does not render.** Nothing renders. With `window.sessionStorage` throwing — which is
what Chrome does with site data blocked, and what a locked-down private window does — the
page dies on an uncaught `SecurityError` and the body is empty. Stack, captured by logging
every `sessionStorage` access from an init script:

```
SS-ACCESS:: at resolveDevPlace (src/lib/devMockData.ts:44)          ← guarded, caught, fine
SS-ACCESS:: at new Socket (@supabase/supabase-js … :6653)
            at new SocketAdapter (… :8175)
            at new RealtimeClient (… :8402)
PAGEERROR:  SecurityError: blocked
```

`src/lib/supabase.ts` calls `createClient` at **module scope** — unconditionally, with
placeholder credentials when the env vars are absent — and `createClient` constructs a
`RealtimeClient`, whose `Socket` touches `sessionStorage` with no guard. So this fires on
**every route, in every environment, signed in or out**, and has nothing to do with Phase 17.
Reproduced identically on `?dev=1`.

**Three things follow, and the second is the one that matters:**

1. 17-04 Task 3 Step 7's storage-blocked hand-check **cannot pass**, and could not have
   passed before this plan either. Our own new code is clean: `viewedPlace.ts` survives a
   `window.sessionStorage` that throws on first touch (proved directly with
   `node --experimental-strip-types`: `readViewedPlace()` → null, `writeViewedPlace()` does
   not throw), and `check:place-resolve` 39–42 cover the round trip.
2. 🔴 **17-05's planned `check:place-entry` assertion 12 — "proves it by actually throwing" —
   would have gone red for this reason and not for ours.** `17-VALIDATION.md` claimed *"this
   phase adds no second instance — every new access is guarded and `check:place-entry` 12
   proves it by actually throwing."* The first half is true. The second half would have
   failed against a dependency.

   ✅ **Resolved in 17-05, by the first of the two shapes offered here.** The assertion
   overrides `Storage.prototype`'s three methods for real and throws a `SecurityError` for
   **`sessionStorage` keys beginning `cs_`** — `cs_viewed_place`, `cs_signed_out`,
   `cs_dev_place`, which is the whole of what this phase touches. Everything else passes
   through, so `@supabase/supabase-js` boots and our guards are the only thing under test.
   `17-VALIDATION.md`'s three claims about that assertion were corrected in the same commit
   as the script, to what it does rather than what it was first asked to do.

   ⚠️ **One thing found while doing it, and it belongs to this item's sibling.**
   `Storage.prototype` is SHARED between `sessionStorage` and `localStorage`, so the first
   draft's `cs_` throw also hit `cs_token` — and the page died on an uncaught `SecurityError`
   with nothing rendered, because `useAuth.ts` reads and removes that key unguarded. That is
   item 9 of `16-explore-by-slice/deferred-items.md`, reproduced exactly, by a check aimed at
   something else. Whoever picks up either item should know they are **two** unguarded-storage
   deaths and not one: fixing the Supabase client at module scope leaves `useAuth` still
   fatal to a storage-blocked boot. The check keeps them apart with a receiver test
   (`this === window.sessionStorage`).
3. It is a sibling of item 9 of `16-explore-by-slice/deferred-items.md`
   (`useAuth.ts:100` writes `localStorage` unguarded), but it is **worse**, because it is in
   a dependency and fires at import time.

**Who should own it:** its own small PR, not a phase plan. The fix is architectural in the
sense that matters — it touches the one module every query depends on. Two candidates:
construct the Supabase client lazily, or pass `realtime: { … }` / disable the realtime
transport (this app has no realtime subscriptions today — Phase 18's "Realtime gating" row is
the first mention of any). Either needs its own four-way pass and its own look at whether a
blocked-storage member can still read a feed, which is a question no plan in Phase 17 asks.

---

## 2. Explore's module copy addresses a visitor as if they lived there

**Found during:** 17-04 Task 5, reading the place view out loud at 1440×1000.

With a place on screen, the Explore modules keep their possessive copy. On Asheville's
Federal tab, a visitor from anywhere is told:

- **"Federal races where you live"** — *"The federal contests for your own area, with the
  candidates as they filed."*
- **"Questions for your community"**
- **"Candidate debates and forums … None of yours has one published yet."**
- The intro: *"Welcome to the national civic space / Discover what's happening at the
  national level."*

The **data** is right — those are Asheville's races, because `racesAreaFor` follows
`onScreenSlices` as of 17-04 Task 4. Only the second person is wrong, and it is wrong in
exactly the way **D-10** names: *never show someone a place as if it were already theirs.*

This is not new text and it is not a regression — the `geoid: null` screen 17-04 deleted had
the same problem, which is what `ROADMAP.md` § Phase 17 indicts when it quotes *"Nothing is
on the public calendar **for your area** right now"*. 17-04 replaced one instance of it with
another, better one: the place is real now, and only the pronoun is wrong.

**Who should own it:** **17-06**. That plan carries D-10, it already edits
`src/components/explore/registry.tsx`, and its Task 2 Step 2 is a sweep of every registry
entry asking *"does this offer an action a visitor cannot take?"* — the adjacent question,
*"does this address a visitor as a resident?"*, is the same walk over the same files.
17-04 deliberately did not touch module copy: three plans edit that area and a fourth
rewriting its sentences mid-phase is how a hunk gets dropped.

A cheap shape for it: the modules already receive `ctx.placeName`; a `ctx.isOwnPlace`
(or reusing `noWriteReason === null`) lets each heading pick between *"where you live"* and
*"in Asheville"* without new state.

✅ **Resolved in 17-06**, as an added step in Task 2 — the plan's own task list did not
mention it, and both this file and `17-VALIDATION.md` name 17-06 as its owner. What changed,
what did not, and why, is in the commit body of
`fix(explore): the page stops addressing a visitor as a resident` and summarised here:

| | |
|---|---|
| **Fixed by branching on a new `ctx.isOwnPlace`** | `IntroModule` (eyebrow + heading name the place; City/County/State only — Federal and Unified claim no place), `QuestionsModule` ("Questions for **this** community"), `RacesModule` (eyebrow, both titles and the lead) |
| **Fixed by rewriting the sentence true of both readers** | six static `emptyState` / `reserved()` strings in `registry.tsx` — `coming-up`, `races`, `debates`, `agenda`, `legislator-votes`, `ballot-measures` — because an `emptyState` has no `ctx` to branch on; plus `ExploreView`'s "No published meeting agendas were found **here** right now" |
| **Also fixed, same sweep, different rule** | every subhead in `IntroModule` ended in "and share your perspective", an invitation a view-only reader cannot take up. Keyed on `isViewOnly`, not `isOwnPlace`, so it covers a member on a sibling shard too |
| **Now watched** | `check:explore-rooms` **21** (new) over every rendered room, and `check:explore-gate` viewers 5 and 6 over the rendered Explore panel. Both were made to fail before being believed |

🔴 **`ctx.isOwnPlace` is NOT `!ctx.isViewOnly`.** It is true for `noWriteReason === null`
**and** for `'sibling-shard'` — a sibling shares `(slice_type, geoid)` with a slice the
member holds, so the place IS theirs and only the shard differs. Conflating the two would
have made Phase 16's sibling-shard presentation go cold for no reason.

---

## 3. The second person survives in the topic catalogue's QUESTIONS, and in one sidebar nudge

**Found during:** 17-06 Task 2 Step 2, doing item 2 above.

🔴 **The boundary that was finally drawn, after a first attempt at a worse one.** The first
pass scoped item 2 to Explore's *chrome* and deferred whole FILES — "a file fixed in part
reads as a file that was checked". Then the new `check:explore-gate` D-10 assertion went red
on its first run against `"calendar for your area"`, from one of the deferred files. The
file boundary was the wrong one, and the check said so before a human did.

The line that replaced it, and it is the one to keep:

- **A STATEMENT the page makes about the place is fixed.** "A real date from the public
  calendar for your area", "From your area's election calendar", "An evening with your
  ballot". None of these needs a `ctx` to branch on — the sentence is simply rewritten so it
  is true of both readers. All of `ExploreActivities.tsx`'s statements were fixed in 17-06
  on that basis, and `CLAIMS_THE_PLACE` in `check-explore-gate.mjs` now covers them.
- **A QUESTION put to the reader is deferred**, because the second person is what makes it
  an invitation rather than a survey item, and changing that is a decision about the
  product's voice rather than a pronoun swap.

What is left is therefore two things, not three.

**1. 🔴 The generic topic catalogue — `src/mocks/civicSpacesExplore.ts`, ~40 strings — and
the one question in `ExploreActivities.tsx:64`** ("What would make your neighborhood feel
better?", the Imagine module's heading, which is the same class of string).
This is the most VISIBLE one left: the featured topic is the second-largest text on the
page, and on Asheville's City tab it reads *"What should get built in **your** city, and
where?"* to a visitor from anywhere. Also "What would make your neighborhood feel better?",
"Where should your county spend first?", "What should your state do about the cost of
housing?", "What does feeling safe look like where you live?" and ~35 more.

⚠️ **Not a mechanical fix, and that is why it is not done here.** These are the
conversation-starter QUESTIONS, and the second person is what makes them an invitation
rather than a survey item. Rewriting them is a decision about the product's voice, not a
pronoun swap — and `check-composition.mjs` imports this module and keys fixtures off it, so
the titles are not free to move. 🔴 There is also no `ctx` at the point they are authored:
they are data, so a branch would have to be applied where they are RENDERED, which means
`FeaturedModule`, `QuestionsModule` and `TopicDetail` would each need a rule for picking
between two phrasings — i.e. the catalogue needs a second field, not a rewrite.

⚠️ **`check-composition.mjs` imports this module and keys fixtures off it**, so the titles
are not free to move. 🔴 And there is no `ctx` where they are authored — they are DATA — so
a branch would have to live where they are RENDERED, which means `FeaturedModule`,
`QuestionsModule` and `TopicDetail` each needing a rule for picking between two phrasings.
The catalogue needs a second field, not a rewrite. 🔴 `ExploreActivities.tsx` receives no
`ctx` at all either (grep it: not one `ctx.` read), which is why its statements were
rewritten rather than branched, and why its one question cannot be branched at all today.

**2. `Sidebar.tsx` / `SidebarMobile.tsx` — the empty-roster nudge.** When `repsData.data` is
an empty array the sidebar offers *"**Set your location** to see representatives for **your
area**"*, linking to the accounts app's address settings. Beside another city's feed that is
the same mistake `ActiveLocationCard` was hidden for in 17-04: an invitation to change the
wrong thing. Reachable from 17-06 onward, because `usePlaceRepresentatives` can legitimately
answer `[]` for a small place. 🔴 **17-06 could not fix it:** its own plan makes "`Sidebar.tsx`
and `SidebarMobile.tsx` must not need editing" the test of whether Task 1 was done right, so
touching either for a copy reason would have destroyed that signal. It needs the same
`isVisitingPlace` the location card already gets, passed as a prop.

**Who should own it:** 🔴 **not a phase plan — its own PR, with a human reading the result.**
Both are prose, both want a judgement about voice, and neither is a gate. The mechanical
half is already in place for whoever takes it: `ctx.isOwnPlace` exists, `check:explore-gate`
viewers `signed-out` and `member-other-place` have a `CLAIMS_THE_PLACE` regex that is the
list of shapes to look for, and `check:explore-rooms` 21 is the same rule over the static
room copy. 🔴 **Widen `CLAIMS_THE_PLACE` in the SAME commit that fixes these**, never
before: a check that is red on purpose is a check nobody reads.
