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
