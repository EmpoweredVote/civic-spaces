# Phase 16 — found while executing, deliberately not fixed here

Out-of-scope discoveries, logged rather than fixed, so the plan that owns each can pick it
up. Nothing here is a blocker for the plan that found it.

---

## 1. `PostComposer.tsx` has no dark mode at all

**Found during:** 16-04 Task 6, driving Join from Explore on every tab.

The composer sheet — the thing every Explore "Join the conversation" opens — is rendered
light-on-white while the rest of the app is in dark mode, which is the default. `grep -c
'dark:' src/components/PostComposer.tsx` is **0**: the heading is `text-gray-900`, the
fields are `border-gray-300 ... text-gray-900 placeholder-gray-400`, the error block is
`bg-red-50`. None of them has a `dark:` counterpart, which is the one colour rule
`CLAUDE.md` states without exception.

It is **pre-existing** and has nothing to do with Phase 16: the file was last touched by
`01abf06` (Explore / Conversations views) and `9327cee` (the light-mode AA shift), both
before this phase. It is only visible now because Explore is wall-to-wall invitations to
open it.

Note also `placeholder-gray-400` in light mode: 2.54:1 on white, under the 4.5:1 AA wants
for text.

**Who should own it:** 16-10 is the four-way visual pass and the phase gate, and this will
fail that gate on two of the four. It is a handful of class pairs, not a redesign.

---

## 2. The featured card borrows a city photo on Federal and Unified

**Found during:** 16-04 Task 6, the five-tab walk.

`photoSliceFor` walks `['city', 'county', 'state', 'federal']` for a place slice that is
not the active tab, so on the **Federal** tab the featured card carries an Asheville
photograph beside "Where should the United States be involved abroad?". It is correctly
credited, and it is doing exactly what it was built to do — never repeat the hero directly
above it — but the pairing reads oddly at the two levels that are not places.

Deliberately not changed in 16-04: the plan says that logic is still right and only its
input changes, and the alternative (no photo on Federal/Unified) is a design call, not a
bug fix.

**Who should own it:** 16-10, as part of looking at all five tabs in all four modes.

## The Imagine textarea is double-gated, and the check cannot see one guard go

Found while independently falsifying 16-05's revert matrix (2026-10-25).

`ImagineActivity` renders the textarea behind `{!isViewOnly && onIdeaChange && (…)}`
(`ExploreActivities.tsx:124`), and `ImagineModule` separately passes `onIdeaChange={undefined}`
while view-only (`ImagineModule.tsx:38-44`). Two independent guards on one affordance.

Verified by experiment:

| Reverted | `check:explore-gate` |
|---|---|
| `isViewOnly={ctx.isViewOnly}` prop alone | 21 PASS — green |
| the `onIdeaChange` ternary alone | 21 PASS — green |
| the `!isViewOnly &&` in the render alone | 21 PASS — green |
| **both the ternary and the render guard** | **FAIL 3, City only; Federal green** |

So the gate is correctly belt-and-braces, and the check does catch the affordance when it is
genuinely exposed — the City-only failure is the half-a-gate shape working exactly as designed.
But **a refactor that deletes either guard alone leaves the suite green** while the gate rests on
one remaining condition, and nobody is told.

16-05's report lists a matrix row "revert the `isViewOnly` guard on Imagine's textarea → 3 red,
City only". That is not reproducible as a single-guard revert; it needs both.

Not fixed, because the redundancy is worth more than the sensitivity on a gate this repo has
already shipped half of once. For 16-10: either collapse to one guard so the check is sensitive
to its loss, or add a source-level assertion that both guards are still present — the browser
check can only ever see rendered output, so it can never distinguish one guard from two.

---

## 4. The debates join costs a 234 KB download for a 45-row answer

**Found during:** 16-07 Task 6, counting requests on the Federal tab.

`useRaceMedia` fetches the whole published `/api/meetings` list — **234 KB, 171 rows** —
and keeps the 45 `debate`/`forum` rows that carry `raceIds`. That is the plan's own
choice and it is the right one of the two available: the alternative, `GET
/api/meetings?raceId=<uuid>`, is one request per race and a member has 10–20 races.

There is no third option **in the API today**. `/api/meetings` takes `city`, `state`,
`status` and `raceId`; it has no `eventKind` filter and no multi-race form. So the fix is
an ev-accounts ask, not a frontend change:

- `GET /api/meetings?eventKind=debate,forum` (45 rows, ~8 KB), or
- `GET /api/meetings?raceIds=<uuid>,<uuid>,…`

**Who should own it:** 16-09, which writes the handoff document. It belongs beside Asks
1–4 as a small, concrete, and cheap request — and it is the only one of them that is a
performance ask rather than a missing-data ask.

---

## 5. Research's "LA matches ~8 rows" is ~3 against the area we actually query

**Found during:** 16-07 Task 3, checking the join.

`16-RESEARCH.md` Finding 2 reports that LA city races matched **8** meeting rows. Joined
against the response `racesAreaFor` actually produces for an LA member — the **city**
area, 47 races across two elections — it is **3**: the two Bass/Raman mayoral debates and
the CNN California Governor debate. The research's larger number came from a wider race
set (the state area's 493 races), which is the set this phase deliberately never asks for.

Nothing is wrong and nothing needs fixing: all three named rows are present, and the
difference is an artefact of which area was asked. Logged so that a later reader comparing
the two documents does not go looking for five missing recordings.

---

## 6. Every button in Explore computes `cursor: default`, app-wide

**Found during:** 16-08 Task 4, the `ui-ux-pro-max` pass over the seed invitation.

Measured through the live page at 375px, light and dark: **every** `<button>` inside the
Explore panel reports `getComputedStyle(el).cursor === 'default'`. Not just the
invitation's — "Explore this topic", the four question cards, "See the details", "Save on
this device", "Back to Explore", the Imagine radio labels. Fourteen of fourteen probed on
City, thirteen of thirteen on County.

**Why:** Tailwind v4's Preflight sets `button { cursor: default }`, following the CSS
spec's default rather than v3's `cursor: pointer`. This repo has no Tailwind config file
and no global override, so nothing puts it back. It arrived with the v4 upgrade, not with
any of Phase 16's work.

**Why it was not fixed in 16-08:** it is app-wide and lives in
`src/components/explore/exploreUi.tsx` (`PrimaryButton`, `SecondaryButton`) and in the
shared `SECONDARY` token in `FeedTabs.tsx` — all of them files 16-08 was told to read and
not edit. Fixing it inside this plan would have been a one-line change with a blast radius
across every Explore control and the feed's tab bar, which is exactly the out-of-scope
shape the executor's scope boundary names.

**What a fix looks like:** one line in the global stylesheet —
`@layer base { button:not(:disabled) { cursor: pointer } }` — or `cursor-pointer` on the
two shared button components. The first is probably right, because the problem is not
confined to Explore.

**Who should own it:** not 16-09 or 16-10, which are Explore-scoped. This wants its own
small change with a four-way look at the feed, the composer and the nav rail, since it
touches every control in the app.
