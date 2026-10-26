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
