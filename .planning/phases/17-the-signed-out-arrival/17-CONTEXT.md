# Phase 17: The Signed-Out Arrival - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Civic Spaces becomes observable without an account.

A visitor who is not signed in gets a dedicated welcome screen that introduces the Connect
Pillar, names what an account is for, and offers a way in: they type an address or a place,
and the City / County / State / Federal / Unified spaces for that location load — Explore
*and* conversations, read-only. They can observe anything. They can contribute nothing.

The phase delivers three things that do not exist today:

1. **A welcome screen.** Today a guest gets one grey sentence — "Log in to view your civic
   community." — above 580 words of Explore addressed to a community they are not in.
2. **Place entry without an account.** An address or a place name resolves to the five
   slices for that location. The address is never stored and never shown back.
3. **Public read.** Every one of the 32 `civic_spaces` grants is `TO authenticated` today,
   so an observer can currently read zero forum rows. This phase opens conversations to
   `anon`.

**Not in this phase:** anything that lets an observer write, vote, react or join. The write
paths stay closed exactly as they are.

</domain>

<decisions>
## Implementation Decisions

### The account model (Chris, 2026-10-26 — the governing frame for every decision below)

This is product policy, not a restatement of the database. Where the two disagree, §D-04
says which wins.

- **D-01 — Inform / Guest: observe only.** Not assumed to be authenticated. An Inform
  account needs only an email; identity authentication is explicitly *not* its goal, and
  **the healthy assumption is that an Inform account is a bot account**. It exists so
  someone on a public computer can calibrate their Compass and tie it to Essentials. It
  cannot vote and cannot impact others. When Empowered Vote is established, Inform stances
  are not to be leaned on or trusted as true.
- **D-02 — Connect: post, vote, contribute, from public anonymity.** Authenticated — "we
  believe we know who they are at EV". Identity is treated as private and members are
  encouraged to post under handles. This protects against a stalker finding you easily;
  it is **not** the kind of privacy that lets you be toxic without repercussion. There is
  a paper trail — a memory of what each account has said — which is how sources of mis- and
  disinformation get identified. **Each person gets one voice in the discussion**, which is
  also what stops the robust use of bots.
- **D-03 — Empowered: transparency instead of the handle.** A Connect account that has asked
  to use the Empower Pillar's features (not yet built). Trades Connect's handle-privacy for
  transparency: public Compass stances, sortable by other members, the way citizens already
  sort their leaders by stance. Closest analogue is a blue check — *we believe this is the
  person they say they are*. For elected leaders and people wanting broader impact.
  Connect stances default to private and may be shared with friends; Empowered stances are
  public.
- **D-04 — Treat Inform as untrusted, equal to a guest.** ⚠️ ev-accounts' own code says
  Inform is "the base tier of a **real, authenticated** account — not anonymous, not
  unauthenticated" (`accountMeService.ts`, correction recorded 2026-09-13). Chris's product
  rule says the opposite in intent: assume it is a bot. **Resolve in favour of the product
  rule.** An Inform account must receive exactly what an anonymous visitor receives and
  nothing more. Never grant a capability to Inform on the grounds that it is technically
  `authenticated`.
- **D-05 — The target feeling.** A public town square, not 4chan. Privacy and anonymity are
  not paramount; being a real single person is.

### What an observer sees

- **D-06 — A dedicated welcome screen.** The guest's first screen is the explainer, not
  today's thin strip above a full Explore. It introduces the Connect Pillar: it requires
  authentication, and **each person gets one voice in the discussion**.
- **D-07 — Observation covers Explore *and* conversations, read-only.** Chris chose this
  over Explore-only after the privacy consequence was put to him explicitly.
- **D-08 — Fully public, and scrapable.** Not "signed-in only". Conversations are to be
  readable by anyone with the URL, including crawlers, and treated as a public forum. ⚠️
  **This is a one-way door** — anything indexed is public permanently, and members wrote
  into these spaces while every grant was `TO authenticated`. Chris was shown this framing
  and chose it: *"it is after all, a public square."*
- **D-09 — The generic blank Explore goes.** Today an observer gets the `geoid: null`
  composition, which Chris called "an explore of a blank space which doesn't make a ton of
  sense". An observer looks at a **real place** or at the welcome screen — never a
  placeless shell.
- **D-10 — Neutral copy until it is theirs.** Nothing addresses an observer's place until
  they have named one. Inherited unchanged from #111: never show someone a place as if it
  were already theirs.
- **D-11 — Say what they cannot do, and that it is "yet".** An observer should know they
  can't go further than observing *for now* — not be left to discover it by pressing
  something.

### Place entry

- **D-12 — Both paths, address first.** Typing a **street address** loads the City, County,
  State, Federal and Unified slices for that address. Typing a **place name** (resolved
  offline against the committed gazetteer in `public/geo/`) is the compelling second path.
  Chris: *"1/2 sound good"*, with the address path carrying the requirement.
- **D-13 — Never store it, never show it back.** The address is used to resolve
  jurisdictions and is then gone. No persistence, no echo in the UI, no logging.
- **D-14 — This narrows a standing rule rather than ignoring it.** CLAUDE.md says in bold:
  *"This app **never geocodes and never stores a location.** If a member has no
  jurisdiction, the fix is always to send them to the accounts app — never to add address
  handling here."* `LocationPrompt.tsx` carries the same rule as a 🔴 comment. That rule was
  written about **members**, whose location belongs in their ev-accounts profile. An
  observer has no profile to put it in. **The "never stores" half survives intact and is
  load-bearing (D-13). The "never geocodes" half is what this phase changes, for observers
  only.** CLAUDE.md and `LocationPrompt.tsx`'s comment must both be updated in this phase to
  say so — leaving them as-is would make the next reader think the new code is a mistake.

### Privacy as part of the pitch

- **D-15 — In scope, chosen deliberately.** Of the three optional scope items offered
  (shared-link arrival, storage-blocked boot, privacy pitch), Chris picked privacy alone.
- **D-16 — What it says.** The honest answer to "why do you want my address?": it is
  geocoded once and never kept; Civic Spaces only ever learns which boundaries you are in.
  Grounded in the platform's own governing principle — *"A boundary geoid is a category, an
  address is not"* — and in `connect.resolve_user_jurisdiction`, which is `SECURITY DEFINER`
  and raises if the vault key is missing.
- **D-17 — Do not oversell.** D-02 is explicit that Connect privacy is not protection from
  consequence. The pitch says *private from other members and from stalkers*, never
  *anonymous*, and never *untraceable*.

### Claude's Discretion

- The shape, components and layout of the welcome screen, within the v3.0 standard (light
  and dark, desktop and mobile, all four judged).
- Which geocoder serves D-12, and whether it is a client call or an ev-accounts ask. The
  platform already uses Census + NAD and never Google; the Census **Geocoder** service is a
  different host from the keyless-blocked `api.census.gov` data API, so feasibility is a
  research question, not a product one. Constraint: whatever is chosen must satisfy D-13.
- How the observer's chosen place is held for the session, and what happens on reload.
- Whether place entry lives on the welcome screen, in the shell, or both.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The rules this phase changes — read before writing code
- `CLAUDE.md` § "Talking to the rest of the platform" — the bolded "never geocodes and never
  stores a location" rule. D-14 narrows it; this file must be edited in-phase.
- `CLAUDE.md` § "Getting it running" — "Forum content is members-only by design (every
  `civic_spaces` grant is `TO authenticated`)". D-08 reverses this for reads. Same obligation.
- `src/components/LocationPrompt.tsx` — the 🔴 "deliberately no address field here" comment,
  and the already-good copy for the second wall. Do not regress it.

### Identity and tiers
- `src/hooks/useAuth.ts` — `decodeUserId`, the two-issuer rule, `loginUrl`, and the
  unguarded `localStorage` write at :100 (out of scope, see Deferred).
- `supabase/migrations/20260902010000_resolve_workos_identity.sql` —
  `civic_spaces.current_user_id()`, which 21 RLS policies call.
- ev-accounts `backend/src/lib/tokenIdentity.ts` — `resolveInternalUserId`, issuer-aware.
- ev-accounts `docs/adr/0007-privacy-floors.md` — §3 location floor, §4 stance floor.

### Read access, and what this phase opens
- `supabase/migrations/20260917000000_sibling_slice_read_access.sql` — the two permissive
  SELECT policies keyed on `(slice_type, geoid)`. The model for a read-only grant, and the
  thing a new `anon` policy sits beside.
- `.planning/phases/16-explore-by-slice/16-CONTEXT.md` — locked decision 4 (Explore must not
  *offer* a write while view-only) and the view-only gate's shape.
- `scripts/check-explore-gate.mjs` — 21 assertions that already pin "no write is offered".
  An observer is a third case for this check, not a new check.

### Explore, which an observer now sees for a real place
- `src/lib/exploreComposition.ts` — `compositionKey(sliceType, geoid)`, `DEFAULT_MODULES`.
- `.planning/phases/16-explore-by-slice/EXPLORE-HANDOFF.md` — the ev-accounts asks.
- `.planning/phases/16-explore-by-slice/deferred-items.md` — items 4, 6 and 9 remain open.

### Place resolution
- `src/lib/geoNames.ts` + `public/geo/` — the committed Census gazetteer, 53 state shards,
  2.7 MB, keyed by geoid with name / lat / lon / 2020 population. `npm run geo:check` is the
  drift guard. This is the offline half of D-12 and it needs no network.
- `src/lib/toolCoverage.ts`, `src/hooks/useRepresentatives.ts` — the `geo_id` + `mtfcc`
  request shape the public by-area endpoints take.
- Memory: *Geocoding stack: Census + NAD, never Google* — the platform's existing stack and
  its latency tail.

### Design
- `CLAUDE.md` § "Design rules" — four-way judgement, the `oklch()` contrast trap, the
  `ev_color_scheme` cookie (Playwright's `colorScheme` option does nothing here).
- `.claude/skills/ui-ux-pro-max` — to be invoked while planning the welcome screen.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ExploreView` already runs signed out and takes `(sliceType, geoid)`.** Pointing it at a
  real geoid instead of `null` is a prop change, not a rewrite. Measured at `1096e7a`: six
  modules and eight reserved rooms render for a guest today.
- **`isViewOnly` exists and is enforced in three places** — feed, thread and Explore — with
  `check:explore-gate` pinning it. An observer is close to an existing, tested state.
- **`public/geo/` is already shipped and verified.** No new data, no key, no network.
- **`LocationPrompt.tsx`** is the tone to match for the welcome screen: it explains the
  address relationship and the privacy guarantee in four short sentences.
- **`cs_pending_post`** already stashes a deep-linked post across sign-in.

### Established Patterns
- **Every feed panel is mounted at once** — a hook added inside `SliceFeedPanel` runs six
  times. Observer data hooks hoist to `AppShell`, like `useRepresentatives`.
- **Gate the feed AND the thread.** Shipping only the first half has happened once already.
- **Dark is the default and is class-based**, read from the `ev_color_scheme` cookie before
  first paint.
- **No test framework.** `npm run build` plus purpose-built `.mjs` checks is the whole net.

### Integration Points
- `AppShell.tsx:1063` — the signed-out branch the welcome screen replaces.
- `AppShell.tsx:921` — `showFeed`, which currently requires `isAuthenticated`.
- `AppShell.tsx:309` — `PLACELESS_TABS`, and `photoSliceFor`, for an observer's banner.
- `supabase/migrations/` — the new `anon` SELECT policies.
- `src/lib/supabase.ts` — every call is `.schema('civic_spaces')`; an anonymous client must
  still be.

</code_context>

<specifics>
## Specific Ideas

- **"Each person only gets one voice in the discussion."** Chris's line, twice. It is the
  Connect Pillar introduction in one sentence and should appear close to verbatim.
- **"A public town square as opposed to a 4chan forum."** The feeling to aim at.
- **"It is after all, a public square."** The reason conversations open to anyone.
- **"An explore of a blank space which doesn't make a ton of sense"** — the specific thing
  wrong with today's guest screen.
- **"They should know they can't do more beyond that, yet."** The word *yet* is doing work.
- Empowered as **"closer to a blue check mark"** — useful if the welcome screen explains
  tiers at all, though D-03's features are not built.

</specifics>

<deferred>
## Deferred Ideas

- **The shared-link arrival.** A visitor landing on `/post/:postId` signed out is stashed to
  `cs_pending_post` and shown the generic Explore, never told their link is being held.
  Offered and not chosen. ⚠️ Re-examine during planning only because D-08 may change the
  answer outright — once conversations are public, a shared link may simply *open*.
- **The storage-blocked boot failure.** `useAuth.ts:100` writes `localStorage` unguarded, so
  with site data blocked the app never boots and the welcome screen never renders — for
  exactly the privacy-minded visitor this phase is written for. Offered, not chosen. Stays
  as item 9 of `16-explore-by-slice/deferred-items.md`.
- **`cursor: default` on 196 of 416 controls** — item 6, app-wide, still unowned.
- **Handles.** D-02 says members are *encouraged* to use handles. ⚠️ **See the risk below —
  this may not be deferrable.**
- **Counts-only observation** (members and conversations as numbers, no words) — rejected in
  favour of D-07.

### Flagged for planning — not a decision to re-open, a consequence to handle

**Opening conversations to `anon` publishes every poster's `display_name` and `avatar_url`.**
`PostCard.tsx:115` renders `post.author.display_name`; `database.ts:71` carries it on every
post and reply. D-02 says Connect identity should be private and handle-based — but a
member's `display_name` today is whatever they chose when handles were not yet a thing and
the forum was members-only. If those are real names, D-08 makes them world-readable and
crawlable alongside what the person wrote, permanently.

This is not a reason to revisit D-08. It is a thing the plan must answer before the policy
lands — whether that is a handle prompt, a display-name audit, a default, or an accepted
risk Chris signs off on with the facts in front of him. **A plan that opens `anon` reads
without answering it is not finished.**

</deferred>

---

*Phase: 17-the-signed-out-arrival*
*Context gathered: 2026-10-26*
