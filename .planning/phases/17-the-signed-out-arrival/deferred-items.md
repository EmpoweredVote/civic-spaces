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

---

## 4. ✅ CLOSED — A member who enters a place they HOLD was told they were on a sibling shard

**Found during:** 17-07 Task 1, building `scripts/shoot-welcome.mjs`. The first draft of
presentation 6 — "a visited place, signed in" — booted on a bare `?dev=1` and resolved
Asheville. The bare dev guest **lives in Asheville**, so the cell was unintentionally a
member entering their own city, and it shot this.

**What happens.** `enterPlace` has no "you already hold this place" branch. `placeSlices()`
hands `whyNoWrite` the `place:<type>:<geoid>` sentinel, which is not in `ownedSliceIds`,
while `placeKey('city','3702140')` **is** in `ownedPlaceKeys` — so branch 4 fires and the
reason is `sibling-shard`. Reproduced deterministically with a Playwright probe; both
notices on the page carry it:

```
[data-read-only-notice="sibling-shard"] surface=explore  visible
   "You're exploring Slice — read-only. Starting a conversation — and the draft it
    begins with — stays in your own community, Slice 1."
[data-read-only-notice="sibling-shard"] surface=feed     hidden
   "You're browsing Slice — read-only. Switch back"
```

**Three things are wrong, in increasing order of how much they matter:**

1. **A literal hole in the copy.** `viewingSliceIndex` is undefined for a sentinel, so
   `ReadOnlyNotice` renders `Slice {viewingSliceIndex ?? '—'}` as *"Slice —"*.
2. **The reason is wrong.** A sentinel is not a shard. It is the place itself.
3. 🔴 **The conversations surface then tells a resident the conversations are not theirs.**
   `isVisitingPlace` guards the feed off and renders *"Conversations here belong to the
   people who live here"* and *"For most places nobody has joined yet"* — to someone who
   lives there and holds a writable slice two clicks away. That is **over-gating**, the
   D-18 anti-goal `17-VALIDATION.md` lists as *"another place's Explore as a dead page"*,
   and it is the one direction the fail-closed rewrite was not asked about.

**Why `check:explore-gate` never saw it.** Its `member-other-place` viewer boots on
`?dev=1&place=bloomington` and visits Asheville, so it is genuinely somewhere else and
takes branch 5. There is no viewer for "the member visits their own place", and before
17-05 there was no control that could produce one.

**Reachability.** High, and it is not an edge case: `PlaceStrip`'s own state reads *"Look at
another place"* and the picker accepts any name. A member typing the city they live in is a
plausible first thing to try.

**Why 17-07 did not fix it.** What SHOULD happen is a product decision, not a bug fix, and
the phase gate is the wrong place to guess it. Two shapes, both small:

- **(a) Do not enter.** `enterPlace` compares the resolved place's keys against the
  member's own `ownedPlaceKeys`; a full match is a no-op (or a `leavePlace`), because there
  is nothing different to show. Reads well with D-18 — "looking at your own place" IS your
  own spaces. Needs an answer for a PARTIAL match (same county, different city), where
  entering is right.
- **(b) Enter, but do not gate.** Keep the trip and let `whyNoWrite` answer `null` when the
  viewer holds the place, which means `AppShell` passing the member's REAL slice id rather
  than the sentinel once it knows there is one. Larger, and it re-opens the question the
  sentinel exists to close.

🔴 Whichever is chosen, `check-explore-gate.mjs` wants a **seventh** viewer for it —
"member visits their own place" — or the next change to `whyNoWrite` will re-introduce it.
`scripts/shoot-welcome.mjs` carries a note that fails the cell if presentation 6 ever shoots
`sibling-shard` again.

**CLOSED 2026-10-27, shape (b), and (a) was ruled out on evidence.**

🔴 **It was never the self-visit edge case this item described.** The overlap is per
LEVEL, so it fired on the common path: a member in Asheville looking at **Buncombe
County** got `sibling-shard` and the `Slice —` hole on the County tab AND the State tab,
and the state level overlaps on **every in-state visit**. Worse, in production the
federal level overlaps on *every visit anywhere* — `(federal, US)` on both sides — so the
Federal tab of every trip carried it. (a), refusing to enter a place you fully hold,
would not have touched any of that.

**What shipped:** `placeSlices` now takes the viewer’s own slices and returns their REAL
row for any level where `isSameJurisdiction` holds, a sentinel otherwise. `whyNoWrite`
reaches branch 3 and answers null; the dash disappears because a real row has a
`siblingIndex`; `memberCount` becomes the true count. No new branch in `whyNoWrite`.

The conversations surface stopped gating on `isVisitingPlace` — a NAVIGATION state — and
now decides per slice: a level carrying the viewer’s real row gets its feed and composer,
a level still carrying a sentinel gets the honest card.

**The seventh viewer exists:** `check:explore-gate` → `member-own-place`, 8 assertions,
with its own control case and a control for the opposite failure (a level the viewer does
NOT hold must still be gated — otherwise 5 and 6 are satisfied by ungating everything).
`check:write-access` 19–24 cover `isSameJurisdiction` as a pure function, including the
**production federal case no browser run can reach**, because `devMockData.ts` gives the
dev id `federal.geoid = ‘3711’` on purpose.

**Falsified:** removing the substitution turns `member-own-place` 3, 4, 5 and 6 red, with
assertion 4 printing the original symptom verbatim — *“You’re exploring Slice —
read-only.”*

⚠️ **One consequence, deliberate:** the strip still reads “Looking at Asheville — Back to
my spaces” while the member is on a tab that is their own. That is the navigation state
and it is honest — they did travel there — but it is the thing (a) would have removed.
If it reads oddly in use, the fix is in `PlaceStrip`’s copy, not in the gate.


---

## 5. Observations from 17-07's four-way pass that are NOT defects, recorded so they are not re-found

Each of these was looked at, judged, and deliberately left. None is a blocker and none is a
bug; they are the things a reader of the 24 shots will notice and wonder about.

| What | Where | Judgement |
|---|---|---|
| **The nav rail names City and County but not State, Federal or Unified** — a visited place reads "Asheville / Buncombe County / State / Federal / Unified" | `NavSidebar`, at a visited place | Mixed specificity in one list. "North Carolina" is derivable from the geoid through the same `useJurisdictionName` the first two rows use. A small consistency win, not a correctness one, and it touches a file no plan in this phase owns |
| **The mobile slice tab bar never names the place** — City / County / State / … at every width below `lg` | `SliceTabBar` | Pre-existing and consistent with the member's own spaces, where the same bar shows level labels. The place IS on screen twice at that width (the banner and the strip), so nothing is unlabelled |
| **"What happens to an address" ships while no address input renders** | `WelcomeScreen`, with `PLACE_RESOLVE_ENABLED` false | Correct as written: the block follows "an Empowered Vote account with an address set", so it is about the address given to the ACCOUNT, which is the only one Phase 17 asks for. It becomes exactly right the day `VITE_PLACE_RESOLVE_URL` is set. Flagged only because a reader may expect a field |
| **The native `type="search"` clear glyph is the one control on the welcome screen outside the EV palette** | `PlacePicker`'s input, both themes | A UA widget. Suppressing it costs a real affordance; restyling it is `::-webkit-search-cancel-button`, which is one browser's private pseudo-element |
| **In dark mode the picker's listbox (`bg-gray-900`) sits on a card that is also near-`gray-900`**, so it is separated by its border alone — `shadow-lg` does nothing on a dark surface | `PlacePicker` | Legible, and the border does delimit it. Worth a look if the dark card palette is ever revisited |
| **`check:banners` covers 232 assets, not the 227** `CLAUDE.md` and `17-07-PLAN.md` both state | `src/lib/banners.manifest.json` | The shared library grew. The check is green and derives its own count; only the prose is stale |
| 🔴 **`scripts/shoot-explore.mjs`'s header says its frames are shot "at scale 2"**; both of its contexts are created with `deviceScaleFactor: 1` | `scripts/shoot-explore.mjs:60`, `:284`, `:509` | A stale comment in a Phase 16 script, not a behaviour bug — but it is the kind of sentence someone reads instead of checking, so it is written down here rather than fixed in a phase-gate commit |
