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

---

## 7. The agenda section says the same date nine times, and the same 31 words eight times

**Found during:** 16-09 Task 4, acting on the note 16-06 left for the four-way pass.

Measured on `?dev=1&place=bloomington`, City, dark and light desktop. Bloomington's
agenda section renders a header lead plus eight cards, and every card carries a two-line
`SourceNote` footer:

| Where | Text |
|---|---|
| section lead (×1) | *"From the Common Council's agenda of October 14, 2026. **Read the agenda**"* |
| every card (×8) | *"From the October 14, 2026 agenda. **View the agenda item**"* |
| every card (×8) | *"The title and the reference above are the source's own. The summary was written automatically from that record, not by the source."* |

So **"October 14, 2026 agenda" appears nine times** in one section, and a 31-word
disclaimer appears **eight times verbatim**. In the rendered page the footer block under
each card is about as tall as the summary it qualifies, and it is the most repeated text
on the page by a wide margin.

**The judgement, since 16-06 asked for one.** Two halves, and they do not go the same way:

1. 🔴 **The date sentence on the card is pure duplication and should go.** The section
   lead establishes the agenda and its date one screen above, and each card already
   carries an `Ordinance 2026-29` chip. The card needs the **link** — "View the agenda
   item" is per-item and genuinely useful — and not the sentence restating the header.
2. **The generated-summary disclaimer must stay on the card.** That was 16-06's
   deliberate call and it is right: a reader who only ever sees the card must be able to
   tell the pipeline's words from the council's, and moving it behind a click would
   recreate exactly the failure it exists to prevent. But at 31 words × 8 it is
   qualifying text shouting louder than the content. It wants to be *shorter on the card*
   — "Summary written automatically from the record, not by the source." — or a small
   labelled tag rather than a paragraph, with the full sentence kept on the topic page.

**Whose it is: 16-10's, not 16-09's.** The text lives in `AgendaModule.tsx` (the lead) and
`provenance.tsx` (`SourceNote`), and 16-09's File Structure is `registry.tsx`,
`check-explore-rooms.mjs` and `EXPLORE-HANDOFF.md`. 16-06 deferred it to the four-way
pass, which is 16-10. It also reaches further than the agenda: `SourceNote` renders under
every provenance and on the topic page, so shortening it is a cross-module call and wants
a four-way look of its own.

---

## 8. The PR split for Phase 16 — written down, not executed

**Found during:** 16-09 Task 4, which asks for two PRs. Chris's instruction for this
session was explicit: do not create, switch or rename branches, do not push, do not open
a PR. So this is the recommendation and nothing more. Everything named below is already
committed on `feat/explore-composition-resolver`.

**Why split at all.** `.github/workflows/docs-auto-approve.yml` auto-approves a PR whose
files are **all** `.planning/**` or `*.md`. `EXPLORE-HANDOFF.md` qualifies on its own;
bundled with `registry.tsx` it does not, and a document whose only requirement is that
somebody reads it would then sit behind a code review. `build` is required either way and
passes on both, since one of them contains no code.

### PR A — docs only, auto-approves

One file: `.planning/phases/16-explore-by-slice/EXPLORE-HANDOFF.md` (commit `250a3c0`).
Title: `docs(explore): ev-accounts handoff for Phase 16`.

Body should say that it asks ev-accounts for one Explore route, five gaps and a bug; that
**nothing in Phase 16 is blocked on it**, which is the point of the frontend-only
decision; and that Ask 6 is a live elections bug Treasury Tracker is also exposed to, so
it is worth forwarding even if the rest waits.

🔴 Note it carries `.planning/**` only — one `src/` file and the auto-approval is gone.

### PR B — the rooms, a normal review

`src/components/explore/registry.tsx`, `src/components/explore/ExploreView.tsx`,
`scripts/check-explore-rooms.mjs` (commits `20a1e1e`, `58cc36c`) — alongside whatever
else `feat/explore-composition-resolver` carries from 16-01…16-08.

🔴 **The body must state the governing rule in one line, or the reviewer reads the empty
cards as unfinished work rather than as the deliverable:** *a module with no real source
ships as a reserved empty room, never as invented civic record.* It should link
`EXPLORE-HANDOFF.md` for where each room's ask went, and say that the thirteen rooms
render as one to three cards per level rather than three to nine, because the aggregate
was a wall of promises even when every sentence was right.

Under **"Data this needs from the API"** — the repo's convention for volunteer-visible
PRs — list: the per-`(sliceType, geoid)` composition; topic provenance; a flag for a
machine-written summary; ballot measures; a plain-language bill summary (or at minimum a
bill title on the federal vote row); upcoming debates; and an `eventKind` filter on
`/api/meetings`.

**Ordering.** PR A can go at any time and depends on nothing. PR B is the branch as it
stands; if it ships first, PR A rebases cleanly because they share no files.

---

## 9. With `localStorage` blocked, the app never boots — so Explore's own guards cannot be reached

> **Correction, 2026-10-26 (traced during Phase 17-01).** This item names `useAuth.ts:100`,
> an unguarded `setItem`. That is not where the boot actually dies. `AppShell` renders
> `useRepresentatives`, whose **`localStorage.getItem('cs_token')` at
> `src/hooks/useRepresentatives.ts:54` is unguarded and throws first** — before `useAuth`'s
> effect ever runs. The other unguarded sites on the way are `src/lib/supabase.ts:33` and
> `:47` and `src/lib/exploreStorage.ts:9`; `index.html`'s colour-scheme bootstrap is already
> `try`-wrapped. So the fix is a read-path problem in a hoisted hook, not only a write-path
> problem in `useAuth` — and anyone scoping this from the paragraph below would fix the
> wrong line and still not boot. Still out of scope; offered for Phase 17 and not chosen.

**Found during:** 16-10 Task 4 Step 3, the "nobody's happy path" walk. That table has a
row reading *"`localStorage` blocked (private window) → Explore still works and forgets on
reload; nothing claims it saved."* **That row is not reachable as written.**

With `window.localStorage` replaced by an object whose `setItem` throws a `SecurityError`
— the Safari-private-mode shape — the app stops at "Civic Spaces Loading…" and Explore
never mounts at all. Zero `[data-explore-module]`, uncaught page errors, nothing to judge.
Traced to one unguarded call:

```
STORAGE-TRACE setItem cs_token ::
    at storeToken (src/hooks/useAuth.ts:100)
    at resolveAuth (src/hooks/useAuth.ts:120)
```

Supabase's own client survives it — `supportsLocalStorage` probes with a throwaway key
inside a try/catch, which is exactly the right shape. Ours does not.

It is **app-wide and pre-existing**, and the unguarded calls are spread across six files
this phase never opens: `useAuth.ts`, `supabase.ts`, `useEnsureSlices.ts`,
`useRepresentatives.ts`, `useHeroBanner.ts`, `HeroBanner.tsx`, `colorScheme.ts` and
`AppShell.tsx` (`cs_active_tab`, `cs_pending_post`). `PanelToggle.tsx` is the one that
already does it properly, and its comment says why.

🔴 **Phase 16's own storage layer is clean, and that is worth stating because it is the
half the row was really asking about.** `src/components/explore/exploreStorage.ts` wraps
all three paths — the legacy-key cleanup, `read()` and `write()` — in try/catch, and
`write()` returns a boolean so a caller can tell. Verified by reading all three. So the
moment the shell stops throwing, this row will pass for free; nothing in Explore needs to
change for it.

**Who should own it:** not 16-10, which is Explore-scoped and whose own files are already
correct. This wants its own small change: a `safeStorage` wrapper in `src/lib/`, every
call site moved onto it, and a four-way look at the shell in a storage-blocked context.
The highest-value single line is `storeToken` — the app at least *renders* once auth
stops throwing.

---

## Addendum to item 6 (every button computes `cursor: default`) — 16-10's judgement

**Measured again in 16-10 Task 3**, across ten presentations (Bloomington City, Federal,
Asheville City, Asheville State and Unified; light and dark; 1440px and 390px):
**196 of 416 probed controls are `<button>` elements computing `cursor: default`.** Item 6
is reproduced exactly and at scale.

**16-10 is NOT fixing it, deliberately.** Three reasons, and the first is the real one:

1. **It is not an Explore defect.** Tailwind v4's Preflight sets `button { cursor: default }`
   app-wide and this repo has no config file and no override. The feed, the composer, the
   nav rail and the top bar are all equally affected. Fixing it only inside Explore — a
   `cursor-pointer` on `PrimaryButton` and `SecondaryButton` — would make Explore's controls
   behave differently from the rest of the app, which is worse than consistent-and-wrong.
2. **The right fix has a blast radius this phase cannot see.** One line in the global
   stylesheet, `@layer base { button:not(:disabled) { cursor: pointer } }`, changes every
   control in the product. 16-10 shot 48 presentations and every one of them is Explore;
   none covers the feed, the composer or the nav rail, so this phase cannot honour the
   four-way standard for the change it would be making.
3. 16-10's own **Out of Scope** says a finding needing a new pattern is a new plan, and
   item 6 already names 16-10 as the wrong owner.

**Recommendation, unchanged from item 6:** its own small PR — the one global line, plus a
four-way look at the feed, the composer and the nav rail. It is a genuine
"looks right, feels broken" defect and it is cheap; it is just not this phase's.
