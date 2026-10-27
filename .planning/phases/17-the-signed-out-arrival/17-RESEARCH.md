# Phase 17: The Signed-Out Arrival — Research

**Researched:** 2026-10-26
**Domain:** Public read access (Postgres RLS + PostgREST grants), keyless geocoding, shell-level place navigation
**Confidence:** HIGH on Q1–Q3 (every endpoint claim was exercised live, every policy read from the migration that created it) · MEDIUM on Q4 (the *shape* of `display_name` is proven; the *contents* of production rows are not readable from here) · HIGH on Q5 · HIGH on Q6

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### The account model (Chris, 2026-10-26 — the governing frame for every decision below)

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

#### What an observer sees

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
- **D-18 — Observation is the expected default, for everyone.** "Anyone should be expected
  to observe a Civic Slice — they're public town squares." Looking at a place you do not
  live in is not an edge case to be tolerated; it is normal use.
- **D-19 — Slice hopping is NOT guest-only.** Observers *and* authenticated accounts need to
  move between slices and locations. A signed-in Connect member must be able to go and look
  at another city. ⚠️ **Scope consequence:** the place-entry mechanism (D-12) cannot be built
  only into the signed-out welcome screen — it is shell-level navigation available to a
  signed-in member too. Plan it as one mechanism with two entry points, not two features.
- **D-20 — Connect posts only in their own slices.** Read anywhere, write only where you
  belong. This is the existing sibling-shard rule generalised: the UI must not offer a write
  in a place that is not yours, and RLS already refuses it. `isViewOnly` is the existing
  carrier — a member viewing a non-member place is the same state as a member viewing a
  sibling shard, which Phase 16 already built and `check:explore-gate` already pins.
- **D-21 — Empowered reach is the exception, and it is a future phase.** An Empowered account
  has broader reach tied to their role as a civic leader: **their posts reveal their identity
  and can reach many slices at once.** This is the Empower Pillar, which is not built. ⚠️ Do
  not build it here — but do not design a write gate that assumes "one author, one slice"
  so hard that cross-slice authorship later requires tearing it out. Leave the seam.

#### Place entry

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

#### Privacy as part of the pitch

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

### Deferred Ideas (OUT OF SCOPE)

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

#### Flagged for planning — not a decision to re-open, a consequence to handle

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
</user_constraints>

---

## Summary

Three of this phase's four hard problems have a clean answer; the fourth is a genuine fork
that needs a decision before planning can finish.

**The read surface is smaller and more exact than it looks, and the gate is not where the
context assumes.** `isViewOnly` is computed at `AppShell.tsx:840` as
`!!activeSlice && !!activeViewing && activeViewing.id !== activeSlice.id` — it **requires the
member to hold a slice of that type**. An observer holds none; a member looking at another
city holds a slice of that type but with a *different geoid*, which `viewingSlices` cannot
represent at all (it stores a `SiblingSlice`, which is a shard index, not a place). So
D-19/D-20's "a member viewing a non-member place is the same state as a sibling shard" is
true as a *product* statement and **false as a code statement in two specific places**: the
`activeIsViewOnly` expression fails open when `activeSlice` is undefined, and the RLS policy
that makes sibling reads legal (`posts_select_sibling_slice`) is keyed on `geoid` equality,
so it does not cover another city for an `authenticated` caller any more than it covers an
observer. Both halves need work; neither is large, but shipping one without the other is
exactly the "gated the feed, not the thread" failure this repo already had once.

**The feed does not go through RLS alone.** `SliceFeedPanel` calls `useBoostedFeed` →
`civic_spaces.get_boosted_feed_filtered`, which is `SECURITY INVOKER` and reads
`friendships`, `follows` and `blocks` as the caller. `anon` has no table-level `GRANT` on
any of them, so the RPC will fail with *permission denied* before RLS is ever consulted —
and `civic_spaces` itself has no `GRANT USAGE ON SCHEMA … TO anon`, so PostgREST cannot even
resolve the schema. Opening reads is therefore a grants-and-a-new-RPC job, not a
policy-only job.

**Geocoding is the one real unknown and it resolved badly for the simplest option.** The
Census Geocoder (`geocoding.geo.census.gov`) is keyless, fast (148–420 ms) and returns
State + County + Incorporated Place GEOIDs in one call — exactly the three the slice table is
keyed on. It emits **no `Access-Control-Allow-Origin` header**, verified both by header dump
and by a real Chromium navigation from `https://civicspaces.empowered.vote`, which logged
*"blocked by CORS policy: No 'Access-Control-Allow-Origin' header"*. A browser `fetch()`
cannot use it. JSONP (`format=jsonp&callback=`) does work from the browser (442 ms,
`application/javascript`). ev-accounts has **no anonymous address→geoid route**: `/assign`
is `requireAuth` + Connect-tier-gated + writes memberships (probed live: `401`);
`/api/essentials/address-search` is anonymous and CORS-allowed but puts the address in the
**query string** and echoes `matchedAddress` back in the response — two direct D-13
violations. The privacy-correct pattern already exists next door
(`POST /api/essentials/coordinate-lookup`, body-only, explicitly "never logged, never
echoed") but it takes a *coordinate*, not an address, and returns officials, not the place
geoid.

**Primary recommendation:** Split the phase at the one-way door. Ship the welcome screen,
shell-level place navigation, and Explore-for-a-real-place first — all of which work against
`anon`-safe public endpoints that already exist. Open conversations to `anon` as a second,
separately-gated phase whose first task is the `display_name` answer. For the address path,
ask ev-accounts for one new anonymous body-only endpoint modelled line-for-line on
`essentialsCoordinateLookup.ts`; use JSONP only as the documented in-repo fallback if that
handoff cannot land, and never `address-search`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Welcome screen / explainer copy | Browser (React) | — | Pure presentation; no data |
| Place entry UI (address + name) | Browser (React) | — | Input and state only |
| Address → (state, county, place) geoids | **ev-accounts API** | Browser (JSONP fallback) | Census Geocoder has no CORS; ev-accounts already owns the Census+NAD stack and the body-only privacy pattern |
| Place-name → place geoid | Browser (offline `public/geo/`) | ev-accounts `/essentials/location-search` | Gazetteer is committed, keyless, no network; the API gives ranked disambiguation the gazetteer cannot |
| Place centroid → county geoid | ev-accounts `/essentials/coordinate-lookup` | — | Gazetteer has no place→county link; this endpoint is anonymous and CORS-allowed today |
| Slice rows for a place | **Database** (`civic_spaces.slices`) | — | New `anon` grant + policy; `(slice_type, geoid)` is the key |
| Post / reply read for a non-member | **Database** (RLS + grants + new RPC) | — | PostgREST is the only data path; the RPC is the real gate |
| "Representing this community" for a visited place | ev-accounts `/essentials/browse/by-area` | — | Already anonymous, already used by the dev path |
| Write gating (`isViewOnly`) | Browser | Database (RLS backstop) | UI must not *offer* what RLS refuses — 16-CONTEXT decision 4 |
| Session memory of the viewed place | Browser (`sessionStorage`) | — | D-13 forbids persisting the address; a geoid is a category, not an address |

---

## Project Constraints (from CLAUDE.md)

Directives the planner must verify compliance against. These carry the same authority as
locked decisions.

| Directive | Where it bites in this phase |
|---|---|
| `npm run build` (`tsc -b && vite build`) is the frontend's only real check; **no test framework** | Every new guarantee needs a purpose-built `.mjs` check or it is unverified |
| The root `tsconfig.json` is a solution file — a new `tsconfig.*.json` must be added to `references` | Only if a new project is added; unlikely here |
| **Every Supabase call is `.schema('civic_spaces')`** (51 call sites) | An anonymous client must still be — the default `public` schema is not this app's data |
| **Gate the feed AND the thread** | `isViewOnly` must reach `SliceFeedPanel` *and* `ThreadView` *and* `ReplyCard` for the new observer/visitor states |
| `services/slice-assignment` is **FROZEN** | Do not touch it; `POST /api/civic-spaces/assign` in ev-accounts is canonical and is irrelevant to observers anyway |
| **This app never geocodes and never stores a location** | D-14 narrows the first half for observers only; CLAUDE.md and `LocationPrompt.tsx:5-11` must both be edited in-phase |
| Every feed panel is mounted at once — a hook inside `SliceFeedPanel` fires 6× | Place-resolution hooks hoist to `AppShell`, like `useRepresentatives` (`AppShell.tsx:544`) |
| Dark is class-based and default; never define a colour only inside a `dark:` variant | The whole welcome screen |
| `gray-400` is decoration only in light mode; `gray-500` fails AA on dark | Welcome-screen body copy |
| Tailwind v4 emits `oklch()` — contrast probes must `fillRect` + `getImageData`, not read `fillStyle` | Any contrast check written for this phase |
| Playwright's `colorScheme` option does nothing — set the `ev_color_scheme` cookie and assert `documentElement.classList` | Any screenshot or DOM check written for this phase |
| Playwright is a **global** install — resolve via `npm root -g`, import as `mod.chromium ?? mod.default?.chromium` | Same |
| Use EV brand tokens; reuse `WidgetCard`, `react-loading-skeleton`, `motion/react` | Welcome screen components |
| Branch from `origin/main` after `git fetch`; `main` needs a passing `build` + one approving review | Already on `feat/signed-out-arrival` |
| Volunteers/designers: never invent data; if a request fails, say so and stop | The "address not found" state must say so, not fall back to a made-up place |

---

## Q1 — Address → five jurisdictions, with no account

### Q1.1 The Census Geocoder: keyless YES, CORS **NO**

All results below are from live requests made 2026-10-26 from this machine.
`geocoding.geo.census.gov` is a **different host** from `api.census.gov`; the two behave
completely differently and must not be conflated. [VERIFIED: live HTTP]

| Probe | Result |
|---|---|
| `GET /geocoder/geographies/onelineaddress?...&format=json` (no key) | **200**, 4,931 B, `content-type: application/json` |
| Same request, `Origin: https://civicspaces.empowered.vote` | **200** — and **no `access-control-allow-origin` header at all** (full header dump: `cache-control`, `connection`, `content-length`, `content-type`, `date`, `set-cookie`, `strict-transport-security`, `vary: Origin`, `x-content-type-options`, `x-frame-options`, `x-xss-protection`) |
| `OPTIONS` preflight with `Access-Control-Request-Method: GET` | **200** with `allow: GET,POST,HEAD,OPTIONS` — and **no `access-control-*` headers** |
| Real Chromium, page served at `https://civicspaces.empowered.vote`, `fetch(url)` | **Blocked.** Console: *"Access to fetch at '…' from origin 'https://civicspaces.empowered.vote' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource."* → `TypeError: Failed to fetch` |
| Same page, JSONP via `<script src="…&format=jsonp&callback=cb">` | **Works.** 442 ms, 1 match, all 10 geography layers present |
| `api.census.gov/data/2020/dec/pl?...` keyless (the contrast) | **302 → `https://api.census.gov/data/missing_key.html`** — confirms the two hosts differ |

**Verdict: the Census Geocoder cannot be called with `fetch()` from the browser.**
`vary: Origin` is present without `access-control-allow-origin`, which is the signature of a
server that *looks at* Origin (likely to reject some) but never grants any. The `OPTIONS`
200 is an Apache `Allow:` response, not a CORS preflight — a browser reads it as a failed
preflight. [VERIFIED: live HTTP + Chromium console]

### Q1.2 What it returns, and whether it is enough

It is exactly enough. The slice geoid mapping, read from the canonical engine
(`ev-accounts backend/src/civic_spaces/services/sliceAssigner.ts`, `SLICE_ASSIGNMENTS`):
[VERIFIED: ev-accounts origin/master]

| Slice type | geoid source | Census Geocoder layer |
|---|---|---|
| `city` | `jurisdiction.city_geoid` | **Incorporated Places** (7-digit, MTFCC `G4110`) |
| `county` | `jurisdiction.county` | **Counties** (5-digit, `G4020`) |
| `state` | `jurisdiction.state_geoid` | **States** (2-digit, `G4000`) |
| `federal` | `jurisdiction.nation_geoid` | literal `'US'` — no lookup needed |
| `unified` | — | literal `'UNIFIED'` — no lookup, assigned to every Connected user |
| `volunteer` | — | literal `'VOLUNTEER'` — role-gated, never an observer's |

Live samples, one call each, `benchmark=Public_AR_Current&vintage=Current_Current`:

```
2 S Pack Sq, Asheville, NC 28801   → state 37  county 37021  place 3702140   272ms 5150B
600 4th Ave, Seattle, WA 98104     → state 53  county 53033  place 5363000   219ms 5145B
1600 Pennsylvania Ave NW, DC 20500 → state 11  county 11001  place 1150000   361ms 4931B
525 Citrine Ln, Arden, NC 28704    → state 37  county 37021  place (ABSENT)  356ms 4677B
```

`3702140` / `37021` / `37` are byte-identical to the geoids `public/geo/37.json` and
`devMockData.ts`'s `DEV_PLACES.asheville` already carry. The formats match with no
translation. [VERIFIED: live HTTP + `public/geo/37.json`]

**The `layers` parameter works and roughly halves the payload** — but only with *named*
layers, not ids: `layers=States,Counties,Incorporated Places` → 2,102 B / 3 layers (vs.
4,931 B / 10). Numeric ids silently resolve to different layers (`layers=2,86,14` returned
*ZCTAs* and *Unified School Districts*). Use the names. [VERIFIED: live HTTP]

### Q1.3 Failure modes — every one of them is a `200`

This is the trap. The geocoder **never returns a non-2xx for a bad address**. Every failure
is `200 OK` with `result.addressMatches: []`. [VERIFIED: live HTTP]

| Input | Status | matches |
|---|---|---|
| `123 Nowhere Street, Nowhereville, ZZ 00000` | 200 | 0 |
| `PO Box 1234, Asheville, NC 28802` | 200 | 0 |
| `Asheville, NC` (no street) | 200 | 0 |
| `28801` (ZIP only) | 200 | 0 |
| `70 Cort Plza, Asheville, NC 28801` (typo) | 200 | 0 |
| **`70 Court Plaza, Asheville, NC 28801` (a real address)** | **200** | **0** |
| `600 4th Ave, Seattle` (state omitted) | 200 | 1 ✓ |

That last pair is the important one: **a correctly-typed real address can return zero
matches**, because TIGER's address ranges are incomplete. This is precisely why ev-accounts
built a NAD + county-locator fallback chain (`backend/src/lib/geocodingService.ts`) rather
than trusting Census alone. A client-side JSONP implementation in this repo would reproduce
the *first* geocoder and none of the fallbacks, so a user whose address TIGER does not carry
would be told "we couldn't find that address" where the member path would have found it.
[VERIFIED: ev-accounts `geocodingService.ts` + live HTTP]

**What an unresolvable address should produce:** the honest empty state, never a guess and
never a fallback place. CLAUDE.md's volunteer rule — *"If a request fails, say so and stop;
do not swap in invented data"* — governs. The recovery offered should be the place-name
path (D-12's second path), which needs no street and is the right escape hatch for a PO Box,
a rural route or an unmapped new build.

**Unincorporated addresses are a normal answer, not a failure.** Arden NC returned no
`Incorporated Places` layer at all — the key was absent, not null. ev-accounts states the
rule explicitly: *"`city` is null for unincorporated addresses. That is an answer, not a
failure."* (`jurisdictionPayload.ts`). An observer at such an address gets four tabs, not
five. The shell must already handle this — a member in the same position does too. [VERIFIED:
live HTTP + ev-accounts `jurisdictionPayload.ts`]

### Q1.4 Latency

Six paced samples, warm, full layers, from this machine:
`151 · 148 · 150 · 151 · 151 · 149 ms` — max 151 ms. Cold/first-call samples ran 219–420 ms.
No tail observed in ~25 calls. This is markedly better behaved than the NAD fallback
ev-accounts measured from Render (`1143 · 1945 · 2533 · 4830 · 16029 · 16868 ms`), which is
a different service. Budget ~500 ms p95 for the Census leg alone; add a hop if it goes
through ev-accounts. [VERIFIED: live HTTP]

### Q1.5 Does ev-accounts expose an anonymous address→jurisdiction route?

**No.** Four candidates were examined and three probed live from
`Origin: https://civicspaces.empowered.vote`. [VERIFIED: live HTTP + ev-accounts origin/master]

| Endpoint | Auth | CORS for civicspaces | Returns the geoids? | D-13 safe? |
|---|---|---|---|---|
| `POST /api/civic-spaces/assign` | `requireAuth`; `tier === 'inform'` → **403**; **writes `slice_members`** | yes | n/a | **No** — unusable. Probed unauthenticated: **401** |
| `GET /api/essentials/address-search?address=…` | `optionalAuth` — **public** | yes (`ACAO: https://civicspaces.empowered.vote`) | county ✓, state ✗, **place ✗** | **No.** Address is in the **query string** (→ Render/proxy access logs, which record the request line) and `matchedAddress` is **echoed back** in the response |
| `POST /api/essentials/coordinate-lookup` | `optionalAuth` — **public**, rate-limited 30/min/IP, zero DB writes | yes; `OPTIONS` → **204** with `access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE` and `access-control-allow-headers: content-type` | county ✓, state ✗ (derivable), **place ✗** | **Yes** — body-only by design, "never logged, never echoed, never in telemetry" |
| `GET /api/essentials/location-search?q=` | `optionalAuth` — **public** | yes | place geoid ✓ + `mtfcc` + `state` + `has_local_data`; **county ✗** | Yes — a place name is not an address |

Live response shapes (Asheville):

```
POST /api/essentials/coordinate-lookup   {lat:35.571129, lng:-82.551629}
  200, 1160ms, 100,023 B, ACAO: https://civicspaces.empowered.vote
  keys: politicians(57) jurisdiction matchedAddress tribal_land county jurisdictionGeoIds locality
  county:            {"geoid":"37021","name":"Buncombe County"}
  jurisdictionGeoIds:{"congressional":"3711","state_senate":"37049","state_house":"37116",
                      "county":"37021","school_district":null}
  locality:          {"incorporated":null,"place_name":null,"county_name":"Buncombe County"}
  matchedAddress:    ""            ← deliberately blank, D-06 of ev-accounts Phase 213

GET /api/essentials/address-search?address=67%20Haywood%20St%2C%20Asheville…
  200, 714ms, 100,080 B
  matchedAddress:    "67 HAYWOOD ST, ASHEVILLE, NC, 28801"   ← echoed; D-13 violation
  data_level:        "inform"
  …otherwise identical to the above

GET /api/essentials/location-search?q=asheville&limit=5
  200, 136ms, 622 B
  [{"geo_id":"3702140","mtfcc":"G4110","label":"Asheville, NC · City","state":"NC",
    "area_type":"City","has_local_data":true}, …]
```

Three things to take from this: [VERIFIED: live HTTP]

1. **Neither public endpoint returns the city geoid Civic Spaces needs.**
   `locality.incorporated` is `null` for Asheville because ev-accounts' place geofences are
   loaded only for `PLACE_LOADED_STATES` (`essentialsService.ts` comments the gate
   explicitly; NC is not in it). Counties are nationwide; places are not. The Census
   Geocoder *is* nationwide for places. This is a real coverage gap, not a quirk of one
   address.
2. The **state** geoid is the first two characters of the county geoid (`37021` → `37`),
   always, by FIPS construction — so state is free once county is known.
3. The payload is **~100 KB** (57 politician records with `finance_summary`, `committees`,
   `images`…). That is heavy for a question whose answer is three numbers.

`connect.resolve_user_jurisdiction` — the RPC D-16 cites, and the one that *does* return
`city` / `county` / `state` / `nation` — is keyed on `p_user_id` and reads the member's
encrypted coordinates out of the vault (`routes/connect.ts:640`, `adminRpc(… , 'connect')`).
It cannot answer for a point that was never stored, which is the whole point of D-13. A
point-keyed variant would be a **new ev-accounts RPC**, not a reuse. [VERIFIED: ev-accounts
origin/master]

### Q1.6 The place-name path is already fully solvable today, CORS-clean

Combining what exists:

```
place name typed
  → GET /api/essentials/location-search?q=…        (public, CORS-OK, 136 ms, ranked + disambiguated)
      → place geo_id (7-digit) + state abbrev
  → public/geo/<state FIPS>.json                   (committed, offline, no key)
      → the place's name AND its Census internal point (lat, lon)
  → POST /api/essentials/coordinate-lookup {lat,lng}  (public, CORS-OK, body-only)
      → county.geoid  → state = county.geoid.slice(0,2)
  → federal = 'US', unified = 'UNIFIED'
```

Every leg is anonymous, already deployed, and already allow-listed for
`civicspaces.empowered.vote`. No new backend, no JSONP, and **no address is ever handled at
all** — a place centroid is not a residence. [VERIFIED: live HTTP]

Two caveats:
- The 100 KB `coordinate-lookup` payload buys one 5-digit number. Acceptable for one
  lookup per place-change; not acceptable inside a typeahead.
- `public/geo/` is a geoid→name map with **no reverse index** (NC shard: 877 rows, 776
  seven-digit places, 100 counties, 1 state; whole set 53 files / 2.7 MB). Searching by
  name offline means either loading all 2.7 MB or asking for a state first.
  `location-search` is strictly better for the typeahead; the gazetteer is the right source
  for *naming* a geoid you already have, which is what `geoNames.ts` already does.
  [VERIFIED: `public/geo/37.json`, `ls public/geo`]

### Q1.7 Recommendation for the address path

**Preferred — one new anonymous endpoint in ev-accounts.**
`POST /api/civic-spaces/resolve`, body `{ address: string }`, returning
`{ city: string|null, county: string|null, state: string|null, nation: "US" }` and nothing
else. Copy `backend/src/routes/essentialsCoordinateLookup.ts` wholesale: `optionalAuth`,
body-only transport with the "coordinates/address are never in a query string" comment
intact, `express-rate-limit` 30/min, zero DB writes, `console.error((err as Error).message)`
only. Reuse `geocodeAddress()` so the NAD and county-locator fallbacks come for free, then
resolve the three geoids from the point via the existing `G4110/G4120`, `G4020` and `G4000`
`ST_Covers` queries in `essentialsService.ts` — with a Census `geographies/coordinates`
backstop for the states where place geofences are not loaded.

Why this and not JSONP:
- It satisfies D-13's "no logging" as well as anything can: the address is in a POST body,
  which Render's access log does not record. `address-search` would log it.
- It inherits the fallback chain, so "a real address returns zero matches" stops being a
  user-visible failure.
- It returns ~120 bytes instead of 100 KB.
- It keeps Census+NAD on the server, where the platform's geocoding stack already lives, and
  keeps this repo's "never geocodes" rule narrowed only in the frontend-navigation sense.

Cost: a cross-repo handoff with its own review and deploy. That is the argument for the
phase split in Q6.

**Fallback if the handoff cannot land in-phase — JSONP, explicitly scoped.**
`format=jsonp&callback=` works from the browser (verified in Chromium). Honest accounting:
it executes third-party script from `geocoding.geo.census.gov` in the app's origin (a `.gov`
host, but still arbitrary JS); it reproduces only the first geocoder with none of
ev-accounts' fallbacks; and the address still travels in a URL query string — to census.gov,
not to EV. **Do not ship JSONP silently.** If it ships, it needs a comment naming the CORS
header that is missing and the day it was checked, and the privacy copy (D-16) must not
claim the address never leaves the browser, because it does.

**Never — `GET /api/essentials/address-search`.** It is the convenient option and it
violates D-13 twice (query-string logging, `matchedAddress` echoed). Name it in the plan as
rejected, with the reason, or someone will find it and use it.

### Q1.8 D-13 compliance, stated honestly

D-13 says *"No persistence, no echo in the UI, no logging."* Two of three are achievable in
full; the third needs a caveat the privacy copy must respect.

| Clause | Achievable | How / caveat |
|---|---|---|
| No persistence | **Yes, fully** | Hold the resolved **geoids** in React state + `sessionStorage`; never the address string. A geoid is a category (the platform's own principle); the address never leaves the input |
| No echo in the UI | **Yes, fully** | Render the *place name* resolved from the geoid via `geoNames.ts`, never `matchedAddress`. `coordinate-lookup` already blanks `matchedAddress` for exactly this reason |
| No logging | **Partly** | EV's own logs: yes, with a body-only POST. **census.gov's logs: no** — `onelineaddress` is a GET and the address is the query string, on every path including JSONP. ev-accounts' member path has the same property |

D-16's pitch is still true as written — *"geocoded once and never kept; Civic Spaces only
ever learns which boundaries you are in"* — and should stay exactly that. It must not grow
into *"your address is never sent anywhere"*, which would be false. D-17 already forbids
overselling; this is the same rule applied to the geocoder.

---

## Q2 — The read surface: `anon` **and** the authenticated non-member

D-19 widened this. There are now **three** caller shapes, not two:

| Caller | Today | After this phase |
|---|---|---|
| `anon` (no JWT, or an expired one — `supabase.ts` drops it and sends no bearer) | Zero rows. No schema grant | Read posts/replies/slices/author-names in any slice |
| `authenticated`, **member of a sibling shard** of this `(slice_type, geoid)` | Reads, via `posts_select_sibling_slice` | Unchanged |
| `authenticated`, **no membership of this geoid at all** (a member looking at another city; an Inform-tier account) | **Zero rows** — the sibling policy requires `geoid` equality | Reads, same as `anon` |

### Q2.1 What a post list and a thread actually touch

From `useBoostedFeed.ts`, `useThread.ts`, `useFeed.ts`, `useAllSlices.ts`,
`useSiblingSlices.ts` — every one of the 51 `.schema('civic_spaces')` call sites was listed;
these five are the ones on an observer's path. [VERIFIED: codebase]

| Path | Object | Exact columns |
|---|---|---|
| Feed (the live one) | RPC `get_boosted_feed_filtered(uuid,int,timestamptz,uuid)` | returns `id, slice_id, author_id, body, is_deleted, created_at, updated_at, reply_count, boosted_at` |
| Feed | `connected_profiles` | `user_id, display_name, avatar_url, tier` |
| Feed (dead path, `useFeed`, import commented out at `SliceFeedPanel.tsx:3`) | RPC `get_feed_filtered` | `… title, edit_history …` |
| Thread — post | `posts` | **`select('*')`** → `id, slice_id, user_id, title, body, created_at, updated_at, is_deleted, edit_history, reply_count` |
| Thread — post author | `connected_profiles` | `user_id, display_name, avatar_url` |
| Thread — replies | `replies` | **`select('*')`** → `id, post_id, parent_reply_id, user_id, body, created_at, updated_at, is_deleted` |
| Thread — reply authors | `connected_profiles` | `user_id, display_name, avatar_url` |
| Shell | `slices` | `id, slice_type, geoid, current_member_count, sibling_index, photo_url` |
| Shard switcher | `slices` | `id, sibling_index, current_member_count` |
| Realtime | `postgres_changes` on `civic_spaces.posts`, filter `slice_id=eq.…` | — |

🔴 **`select('*')` on `posts` pulls `edit_history`** — a JSONB array of every previous body
of an edited post. Opening the table to `anon` with a bare `SELECT` grant makes a member's
retracted wording world-readable. That is strictly more than D-08 asks for. **Column-level
grants are the fix**, and they are the reason not to write `GRANT SELECT ON posts TO anon`.

### Q2.2 The two gates, in order — and the schema gate is first

```
GRANT USAGE ON SCHEMA civic_spaces TO authenticated;   -- migration 20260327000000, line 14
```

There is **no equivalent for `anon`**. Without it, PostgREST cannot resolve
`Accept-Profile: civic_spaces` at all and every anonymous request fails before any policy is
evaluated. Then, table by table, all 32 grants in the schema are `TO authenticated` (15
`GRANT` statements across 8 migrations, covering `slices`, `slice_members`,
`connected_profiles`, `posts`, `replies`, `friendships`, `follows`, `notifications`,
`flags`, `blocks`, `moderators`, `action_log`, the `public.*` forwarding views, and 9
functions). `anon` holds none. [VERIFIED: `grep -rn "GRANT" supabase/migrations/`]

So the ordering is: **schema USAGE → column-level table grants → function EXECUTE grants →
RLS policies.** A policy-only migration does nothing.

### Q2.3 🔴 The feed RPC is the real gate, and it will break two different ways

`SliceFeedPanel.tsx:4` imports `useBoostedFeed`; `useFeed` is commented out on line 3. So
the live feed is `civic_spaces.get_boosted_feed_filtered`, which is **`SECURITY INVOKER`**
and whose body reads `civic_spaces.friendships`, `civic_spaces.follows`,
`civic_spaces.blocks` and `civic_spaces.posts` **as the caller**. [VERIFIED: migration
`20260328200000_phase5_moderation.sql:273-340`]

Consequence: granting `anon` a SELECT on `posts` is not enough. The invoker also needs
privileges on `friendships`, `follows` and `blocks`, or Postgres raises *permission denied
for table friendships* before RLS is consulted. An observer has no friends and no blocks, so
the *data* those joins need is empty — but the *privilege* is still required.

Two clean answers; take the second.

1. Grant `anon` SELECT on `friendships`/`follows`/`blocks` and add no permissive policy, so
   RLS returns zero rows. Correct, but it widens the grant surface for three tables that
   should never appear in an anonymous request, and leaves a future permissive policy one
   mistake away from exposing the social graph.
2. **Add a new, narrow `civic_spaces.get_public_feed(p_slice_id uuid, p_limit int,
   p_cursor_at timestamptz, p_cursor_id uuid)`** that touches `posts` only, returns the same
   column shape as `get_boosted_feed_filtered` with `p.created_at AS boosted_at` (so the
   client's `BoostedFeedCursor` and `useBoostedFeed` merge logic are unchanged), stays
   `SECURITY INVOKER` so RLS on `posts` still governs, and is `GRANT EXECUTE … TO anon,
   authenticated`. Boosting is meaningless without friendships anyway — an observer's feed
   is chronological by definition — so nothing is lost.

⚠️ **`get_feed_filtered` is a different animal and must not be reused.** Its body hard-codes
`AND p.slice_id IN (SELECT sm.slice_id FROM slice_members WHERE sm.user_id =
current_user_id())`. That membership check is *inside the function*, not in RLS, so it
returns zero rows for an observer **and for a member on a sibling shard**, regardless of any
policy. It is currently unused; leave it unused, and do not pattern-match on it.

### Q2.4 Policies: one policy or two?

**Recommendation: one `TO anon, authenticated` policy, not two.** Postgres permits a policy
to name multiple roles, permissive policies are OR'd, and D-18 makes the rule identical for
both callers — *anyone may read any slice*. Writing it twice would be two things that must
be kept in agreement, which is the shape the `current_user_id()` incident already punished
this codebase for.

The policy to write, modelled on `20260917000000_sibling_slice_read_access.sql` but with the
`(slice_type, geoid)` join deleted rather than generalised:

```sql
CREATE POLICY "posts_select_public"
    ON civic_spaces.posts
    FOR SELECT
    TO anon, authenticated
    USING (is_deleted = false);

CREATE POLICY "replies_select_public"
    ON civic_spaces.replies
    FOR SELECT
    TO anon, authenticated
    USING (
        is_deleted = false
        AND post_id IN (
            SELECT p.id FROM civic_spaces.posts p WHERE p.is_deleted = false
        )
    );

CREATE POLICY "slices_select_public"
    ON civic_spaces.slices
    FOR SELECT
    TO anon
    USING (true);      -- authenticated already has slices_select_authenticated
```

Two notes on that:

- `posts_select_sibling_slice` and `posts_select_slice_member` become **redundant** once
  `posts_select_public` exists (permissive policies OR together; `USING (is_deleted =
  false)` subsumes both). Leaving them in place is harmless and is the safer migration —
  but say so in the migration comment, or the next reader will spend an hour working out
  why the sibling join is still there.
- ⚠️ **Suspended authors.** Neither the existing policies nor the proposed one filter
  `connected_profiles.account_standing = 'suspended'`. The schema comment says *"Suspended
  users are hidden from feeds but not deleted"*, but no policy enforces it and
  `get_boosted_feed_filtered` does not join profiles. That is a pre-existing gap; D-08 turns
  it from "members can see a suspended member's old posts" into "the open internet can".
  The plan should decide explicitly — filter it in the new RPC is the cheap answer.

### Q2.5 `connected_profiles` — and the member-roster leak

Opening author names is unavoidable (D-07/D-08 require it), but the **obvious** policy is
too wide.

`GRANT SELECT (user_id, display_name, avatar_url, tier) ON connected_profiles TO anon`
plus `USING (true)` would make the **entire member roster** enumerable: PostgREST happily
serves `?select=user_id,display_name&limit=10000` with no slice filter.
`useMemberDirectory.ts` and `useMemberSearch.ts` (which runs
`.ilike('display_name', '%term%').limit(50)`) prove the query shape is a single request
away. That is a membership list of a civic forum, published, and it is well beyond "read the
conversations".

**Scope the anon policy to authors of visible content:**

```sql
CREATE POLICY "connected_profiles_select_public_authors"
    ON civic_spaces.connected_profiles
    FOR SELECT
    TO anon
    USING (
        EXISTS (SELECT 1 FROM civic_spaces.posts   p WHERE p.user_id = user_id AND p.is_deleted = false)
     OR EXISTS (SELECT 1 FROM civic_spaces.replies r WHERE r.user_id = user_id AND r.is_deleted = false)
    );
```

A lurker who has never posted stays invisible to the public internet, which is both the
right default and the one most consistent with D-02. Index support exists
(`posts.user_id` has no dedicated index today — check the plan; `idx_posts_slice_created` is
on `(slice_id, created_at)`, so this `EXISTS` may want
`CREATE INDEX … ON civic_spaces.posts (user_id)`).

For the **authenticated non-member**, `connected_profiles_select_authenticated` already
grants `USING (true)` — no change needed, and no change wanted. A signed-in member seeing
the directory is the status quo.

Column grants, not table grants: `user_id, display_name, avatar_url, tier` only.
**Excluded deliberately:** `account_standing`, `is_suspended` (a generated column — publishing
moderation state), `ui_theme` (a UI preference, nobody's business), `created_at`,
`updated_at` (join-date fingerprinting).

### Q2.6 What must stay closed to `anon` — named, as asked

| Object | Why it stays closed |
|---|---|
| `civic_spaces.slice_members` | **The roster.** `user_id × slice_id` is "which person lives in which jurisdiction" — the single most sensitive join in the schema, and the one ADR 0007's location floor exists to protect. Already has no INSERT/UPDATE/DELETE policy at all; it must also get no `anon` SELECT. 🔴 Note `useMemberDirectory.ts` reads it — that hook must be gated off for non-members, not merely expected to fail |
| `civic_spaces.notifications` / `public.civic_notifications` | Per-person |
| `civic_spaces.friendships` | The social graph |
| `civic_spaces.follows` | Ditto |
| `civic_spaces.blocks` | Who blocked whom — publishing it is an attack surface in itself |
| `civic_spaces.flags` | Who reported what. Publishing reporter identity would end reporting |
| `civic_spaces.moderators` | A target list |
| `civic_spaces.action_log` | Moderation history |
| `posts.edit_history` | Retracted wording. Excluded by **column** grant |
| `connected_profiles.account_standing` / `is_suspended` / `ui_theme` / `created_at` / `updated_at` | Moderation state and preferences |
| RPCs `get_feed_filtered`, `get_boosted_feed_filtered`, `get_mod_queue`, `mod_action`, `send_warn_notification`, `get_profile_stats`, `get_mutual_friends`, `is_moderator`, `is_blocked_by` | None get an `anon` EXECUTE grant |
| The `public.*` forwarding views (`public.friendships`, `public.follows`, `public.civic_notifications`, `public.flags`, `public.blocks`, `public.moderators`, `public.action_log`) | 🔴 **Easy to miss.** They are in the `public` schema, which PostgREST exposes by default. They are `TO authenticated` today; the migration must not touch them, and the plan should assert they were not touched |
| Supabase Realtime on `civic_spaces.posts` | `useBoostedFeed` opens a `postgres_changes` channel. Realtime authorises through RLS *and* the publication; an anonymous subscription is a long-lived connection per observer. **Recommend: do not subscribe when there is no session.** Gate the `useEffect` on a real `userId` |

### Q2.7 ⚠️ `ev_api` bypasses RLS — reason about the role, not the policy

`.planning/phases/15-tool-deep-links/ACCOUNTS-HANDOFF.md:460-472` records it: production
authenticates as **`ev_api`**, which has `rolbypassrls = true` (the `postgres` superuser was
switched off 2026-09-09). Two consequences for this phase:

1. Anything reached through the ev-accounts Express API is governed by **grants only** —
   these policies do not constrain it. The policies written here constrain the
   **PostgREST/supabase-js** path, which is the one this frontend uses, and that is the
   right scope. Say so in the migration header so nobody reads these policies as a
   platform-wide guarantee.
2. Verification must be done **as `anon`**, through PostgREST with the anon key and no
   bearer — not by `SET ROLE` in a psql session as a superuser-adjacent role, which would
   bypass the very thing being tested.

### Q2.8 Verification, given there is no test framework

A `scripts/check-anon-read.mjs` that drives the real PostgREST endpoint with
`VITE_SUPABASE_ANON_KEY` and **no** `Authorization` header, asserting both directions:

- **Must succeed:** `GET /rest/v1/rpc/get_public_feed` (Accept-Profile `civic_spaces`) for a
  known slice; `slices?select=id,slice_type,geoid&slice_type=eq.city&geoid=eq.3702140`;
  `replies?post_id=eq.<id>`; `connected_profiles?user_id=eq.<a known author>`.
- **Must fail (403/permission denied, or zero rows for a known-nonzero table):**
  `slice_members`, `notifications`, `friendships`, `follows`, `blocks`, `flags`,
  `moderators`, `action_log`, `posts?select=edit_history`,
  `connected_profiles?select=account_standing`,
  `connected_profiles?user_id=eq.<a known lurker with no posts>`,
  `rpc/get_boosted_feed_filtered`, and every `public.*` forwarding view.

The "must fail" list is the half that will be skipped if it is not written down as a
checklist. It is also the half that is irreversible once crawled.

🔴 **After the migration, `NOTIFY pgrst, 'reload schema'` and wait 1–2 minutes before
deploying any frontend that selects a new object.** (Established project rule; the sibling
migration already ends with that `NOTIFY`.)

---

## Q3 — Five slices for someone who is a member of none

### Q3.1 Where the slices come from today, and why it does not generalise

`useAllSlices(userId)` is membership-first: `slice_members` → `slice_ids` → `slices`, keyed
into `Partial<Record<SliceType, SliceInfo>>`. An observer has no `slice_members` rows and
`useAllSlices` is `enabled: !!userId`, so it never runs. [VERIFIED: `useAllSlices.ts`]

The slices-by-geoid read path **already exists and is already anon-shaped**:
`useSiblingSlices` runs `slices.select('id, sibling_index, current_member_count')
.eq('slice_type', …).eq('geoid', …).order('sibling_index')`. That is exactly the query a
place lookup needs; it is only missing a geoid it did not choose. A new
`useSlicesForPlace(geoids)` is a near-copy that selects the same five columns for the four
or five `(slice_type, geoid)` pairs in one `.or()` — and it is anon-reachable the moment
`slices_select_public` + the `anon` grant land. [VERIFIED: `useSiblingSlices.ts`]

**Sibling shards for an observer.** Where several siblings exist for a `(slice_type, geoid)`,
a member lands on their own. An observer has none, so the plan must pick a rule. Lowest
`sibling_index` is the obvious default (it is the oldest and largest), and `SliceSelector`
can then offer the rest — its existing "View Only" amber state is already exactly right for
someone who owns none of them. ⚠️ Its labels are not: `"Your Community · Slice N"` and the
`isMine` badge assume an `ownSliceId` that an observer does not have.

### Q3.2 `federal` and `unified` are free

`federal` is geoid `'US'`; `unified` is geoid `'UNIFIED'` — literals in `SLICE_ASSIGNMENTS`
and `assignUnifiedIfNotAssigned`, not looked-up values. `exploreComposition.ts`'s `PLACELESS`
set keys their Explore composition on the slice type alone and deliberately ignores the
geoid, so an observer's federal and unified Explore is byte-identical to a member's with no
new code. Both slices certainly exist in production (every Connected member is in them).
`volunteer` is role-gated and is never an observer's tab. [VERIFIED: ev-accounts
`sliceAssigner.ts` + `src/lib/exploreComposition.ts:37`]

So an observer gets **four looked-up tabs at most** (city, county, state — city absent for an
unincorporated address) plus two constants.

### Q3.3 🔴 The unseeded place is the *common* case, not the edge case

`slices` rows are created **on demand by `/assign`**, which only runs for a signed-in
Connected member. Therefore a `(city, <geoid>)` slice exists **only where a member already
lives.** Most places an observer types will have **no slice rows at all.** The phase must
treat that as the default experience, not an error branch.

This is a different condition from Phase 16's `isUnseeded`, and the two must not be
conflated:

| Condition | Meaning | Existing handling |
|---|---|---|
| `composition.isUnseeded` (`exploreComposition.ts:579`) | `!!geoid && bespoke.length === 0` — a slice exists, but Explore has no bespoke topic layer | `seed-invitation` module, gated `ctx.composition.isUnseeded && !!ctx.placeName` (`registry.tsx:319`). **Member-facing: seeding is a vote** |
| **No slice row** (new) | Nobody from that place has ever joined | **Nothing exists** |

The observer-facing answer should be the honest one, and it is a *better* pitch than an
error: **Explore still works.** Explore's composition is a pure function of
`(sliceType, geoid)` and needs no slice row — `compositionKey()` takes the geoid, not a slice
id, and the public data (officials via `/essentials/browse/by-area`, meetings, elections,
compass topics) comes from the ev-accounts API, not from Supabase. So an observer looking at
an unseeded place sees a complete Explore for a real place, and where the conversations
would be, a true statement: *nobody from here has joined yet — be the first.* That is the
sign-up pitch the welcome screen wants, arriving at exactly the right moment.

⚠️ The `seed-invitation` module must **not** render for an observer. It invites a vote, and
D-11/D-20 say an observer is never offered an action they cannot take. Its guard is
`isUnseeded && !!placeName`, with no authentication term — adding one is a one-line change
and a `check:explore-gate` assertion.

### Q3.4 Is a member viewing a non-member place the same state as a sibling shard?

**Product answer: yes. Code answer: no, in four places that matter.** D-20 is right about
the intent and `isViewOnly` is the right carrier — but it does not reach this case today.

| # | What differs | Evidence | Consequence |
|---|---|---|---|
| 1 | 🔴 **`activeIsViewOnly` fails open** | `AppShell.tsx:838-840`: `const activeSlice = slices[activeTab]; const activeViewing = viewingSlices[activeTab]; const activeIsViewOnly = !!activeSlice && !!activeViewing && activeViewing.id !== activeSlice.id` | With no `activeSlice` (observer, or a member on a tab they have no slice for), `activeIsViewOnly` is **`false`** — "not gated". The composer, the FAB and the reply box would all be offered. This is the single highest-risk line in the phase |
| 2 | 🔴 **RLS does not cover it** | `20260917000000_sibling_slice_read_access.sql` joins `sib.slice_type = mine_slice.slice_type AND sib.geoid = mine_slice.geoid` | A different geoid is not a sibling. An `authenticated` member gets **zero rows** for another city today, exactly like `anon`. This is why Q2's policy must be `TO anon, authenticated`, not `TO anon` |
| 3 | **`viewingSlices` cannot hold a place** | `AppShell.tsx:597`: `useState<Record<TabKey, SiblingSlice | null>>`; `SiblingSlice` is `{id, siblingIndex, memberCount}` | It is a shard index within the member's own geoid. A visited place needs `(sliceType, geoid, sliceId)`. Either widen this type or add a separate `viewedPlace` — do not overload it |
| 4 | **The shell conflates "on screen" with "mine"** | `homeSlice` (`:923`), `photoSliceFor` (`:304`), `canPostDraft(key, slices)` (`:879`), `racesAreaFor(slices)` (`:405`), `electionAreaFor` (`:606`), `useRepresentatives(userId)` (`:544`), `useCompassData(userId)` (`:555`) all read the member's `slices` map | For a sibling shard that is harmless — same place. For another city it is wrong in both directions: "Representing this community" would show *your* reps beside *their* conversations, and `canPostDraft` would compare a draft against the wrong geoid |

Item 4 has a clean answer that is already in the codebase: **`useRepresentatives(userId)`
cannot follow a visited place** (it calls `/api/essentials/representatives/me` with a bearer
and 401s without one), but the dev path next to it already shows the right substitute —
`POST /api/essentials/browse/by-area` with `{ geo_id, mtfcc }`, **no auth**, used today to
fetch Asheville's real officials for the dev id (`useRepresentatives.ts:15-27`). That is the
observer's and the visitor's representatives source, and `src/lib/toolCoverage.ts` already
carries the `geo_id` + `mtfcc` request shape.

**Recommended invariant, to be pinned by a check:** derive the gate from the *viewed* slice
and the member's memberships, with the safe default at the top:

```ts
// Fails CLOSED: no slice on screen, or no membership of exactly that slice, ⇒ view-only.
const isViewOnly = !viewedSlice || !ownedSliceIds.has(viewedSlice.id)
```

That single expression covers all four cases — signed out, Inform tier, another city,
another shard — and makes D-04 true by construction (an Inform account has no
`slice_members` rows, so it lands in exactly the same branch as a guest, without anyone
having to remember to check `tier`).

### Q3.5 Where place entry lives (D-19)

**`SliceSelector` is the wrong home, and putting it there would conflate two axes.** It
switches `sibling_index` *within* one `(slice_type, geoid)`; place entry switches `geoid`
*across* every tab at once. Its copy ("Your Community · Slice 3", "This is the only slice in
Asheville so far. A new slice opens when one reaches 6,000 members") is entirely about
shards. Merging them produces a control where two adjacent items mean different kinds of
thing.

**Recommended:** a shell-level place control — one per app, not one per tab — that sets the
viewed place for *all* tabs simultaneously, living in the header or at the top of
`NavSidebar`. `SliceSelector` stays exactly as it is and nests logically beneath it: *which
place* → *which shard of it*. The welcome screen's place entry and the shell control are then
the same component in two positions, which is what D-19 asks for ("one mechanism, two entry
points").

**Session memory (Claude's discretion).** `sessionStorage`, keyed like
`cs_viewed_place` → `{city, county, state}` geoids — never the address. Session, not local,
matching `devMockData.ts`'s `cs_dev_place` precedent and its stated reason: the choice should
not outlive the window, and the query string is lost the moment wouter navigates to
`/post/:postId`. 🔴 Every access must be `try`/`catch`-wrapped — a private window throws on
`sessionStorage`, and the one visitor this phase is written for is the one most likely to be
in one. (That is also deferred item 9's unguarded `localStorage` write at `useAuth.ts:100`,
still open — do not add a second instance of the same bug.)

### Q3.6 D-21 — where "one author, one slice" is baked in

Three places. Only the third is this phase's business.

1. **The schema.** `posts.slice_id uuid NOT NULL REFERENCES slices(id)` — one post, one
   slice, by column. Cross-slice authorship would need a `post_slices` join or a broadcast
   fan-out. **Not this phase's problem, and this phase must not make it worse:** do not
   denormalise `geoid` onto `posts` for the new policy. `posts_select_public` as written
   above does not join `slices` at all, so it leaves the schema exactly as flexible as it is
   now.
2. **RLS.** `posts_insert_slice_member` requires `slice_id ∈ (my memberships)`. An Empowered
   cross-slice post would need an additional permissive INSERT policy — permissive policies
   OR, so it is additive and nothing here blocks it. ✓ seam preserved.
3. 🔴 **The UI gate.** This is where the seam can be lost. If the gate is written as
   `canWrite = isMemberOfThisSlice` **inline at each call site**, cross-slice authorship
   later means finding every call site again. If it is written as **one exported predicate**
   — `canWriteIn(slice, viewer)` in a pure module, the way `canPostDraft` already is in
   `exploreComposition.ts` — then Empowered reach is one function body, and
   `check-composition.mjs`'s `node --experimental-strip-types` pattern can run the *shipped*
   predicate rather than a transcription of it. **Recommend: the gate is a pure exported
   function from day one, consumed by `AppShell`, `SliceFeedPanel`, `ThreadView`,
   `ReplyCard` and `ExploreView`.** That is the seam D-21 asks for, it costs nothing now,
   and it is strictly better engineering regardless of whether Empower ever ships.

Similarly, name the prop for what it means. `isViewOnly` currently reads "this is a sibling
shard"; after this phase it means "you may not write here, for any of four reasons". Its
doc comment at `ExploreView.tsx:86-96` must be rewritten or it will mislead.

---

## Q4 — The display-name exposure

### Q4.1 What `display_name` actually is, architecturally

The answer is better than the context feared, and it is documented in ev-accounts' own code.
[VERIFIED: ev-accounts origin/master]

`backend/src/lib/displayName.ts`, module header:

> *"For Inform/Connected accounts **display_name IS the pseudonym — there is no separate real
> name** — so an auto-generated one is a valid identity."*

The platform separates the two concepts across three tables:

| Field | Table | Meaning |
|---|---|---|
| `display_name` | `public.users`, `connect.connected_profiles` | The **pseudonym**. Surfaced as `username` by `profileService.ts:197-201` |
| `legal_name` | `empower.empowered_profiles` | The **real name** — Empowered tier only, exactly D-03's trade |
| `candidate_page_slug` | `empower.empowered_profiles` | Takes precedence over `display_name` for Empowered accounts |

When an account has no name anywhere, `deterministicAutoName(userId)` mints a stable
`AdjectiveAnimal` (e.g. `RapidWolverine`) from a curated 56×42 word list — *"Curated so no
AdjectiveAnimal pair reads as an insult… decision 2026-09-13, Chris Andrews"*. The signup
path uses `generateUniqueAutoName`, which checks `public.users` case-insensitively and
appends a digit on collision.

`civic_spaces.connected_profiles.display_name` is a **copy** of that value, written by
`upsertConnectedProfile` in `sliceAssigner.ts:183-202` from `getAccountMe`'s resolved name,
with `firstNonBlank(displayName) ?? deterministicAutoName(userId)` as a second guard. It is
not independently editable from Civic Spaces.

### Q4.2 The gap: nothing *enforces* a pseudonym

`backend/src/routes/account.ts:178`:

```ts
display_name: z.string().min(1).max(100).optional(),
```

Free text. 1 to 100 characters. **No handle grammar, no "looks like a real name" rejection,
no reserved-word list, no uniqueness constraint.** A member who typed "Jane Smith" into their
profile has "Jane Smith" in `civic_spaces.connected_profiles.display_name` today. The
*architecture* says pseudonym; the *validation* permits anything. [VERIFIED: ev-accounts
origin/master]

So the context's framing is right but the risk is narrower than "these are probably real
names": the default is a generated animal handle, the product intent is unambiguous and
written down, and only members who went out of their way to type a real name are exposed.

### Q4.3 What is not knowable from here

**The actual contents of production `civic_spaces.connected_profiles.display_name`.** Reading
them needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (or database access); `.env.local`
is not readable in this session. **This is the one fact that turns the decision from a guess
into a judgement, and it is a single query:**

```sql
SELECT count(*)                                              AS total,
       count(*) FILTER (WHERE display_name ~ '^[A-Z][a-z]+[A-Z][a-z]+[0-9]*$')
                                                             AS looks_auto_generated,
       count(*) FILTER (WHERE display_name ~ '^\S+\s+\S+')   AS has_a_space_two_words,
       count(*) FILTER (WHERE display_name ~* '^[A-Z][a-z]+ [A-Z][a-z]+$')
                                                             AS looks_like_a_real_name
FROM   civic_spaces.connected_profiles;
```

Aggregates only — nobody needs to read the names to size the problem. The forum's member
count is small (the schema's cap is 6,000 per slice and the repo describes a pre-launch
product), so this will very likely resolve to a handful of rows or none.

### Q4.4 The options, costed

| Option | What it costs | What it leaves |
|---|---|---|
| **A. Audit first, decide second** *(recommended as the gating task)* | One SQL aggregate. Minutes | The real number. If `looks_like_a_real_name` is 0, every option below becomes unnecessary and the decision is free |
| **B. Accepted risk, documented** | Nothing to build | Correct **only if** A returns 0 or near-0. Needs Chris's sign-off with the number in front of him, per the context's own standard |
| **C. Notify-and-offer before the policy ships** | An email/in-app notice to affected members with a link to `app.empowered.vote` profile settings, plus a waiting period | The honest option when A returns a non-trivial number. Members wrote under one contract; changing it without telling them is the part that is hard to defend |
| **D. Auto-rename to a generated handle** | `UPDATE … SET display_name = deterministicAutoName(user_id)` for affected rows, in ev-accounts | Breaks continuity of an identity other members already know. ⚠️ Also the wrong repo — `display_name` is owned by ev-accounts and Civic Spaces holds a copy |
| **E. Publish a handle, keep the name for members** | A `public_handle` column + a second author field + every render path branching | Real work, real complexity, a new ev-accounts concept, and it arguably fights D-05 ("being a real single person is what matters") |
| **F. Add handle validation going forward** | A zod refinement in ev-accounts | Prevents the *next* real name. Does nothing about existing rows. A good follow-up, not an answer |

**Recommendation: A as a blocking task, then B or C depending on the number.** Put the audit
in the plan as a `checkpoint:human-verify` before the migration, not after it. The migration
is the one-way door; the audit costs minutes and is the only thing that makes the door safe
to walk through.

### Q4.5 Three smaller exposures in the same family

- **`avatar_url`.** Becomes world-readable alongside the name. If any member set a photo of
  themselves, D-08 publishes a face next to political speech. Same audit, one more column.
- **`tier`.** Published by the feed query. `'inform' | 'connected' | 'empowered'` is
  low-sensitivity and arguably *should* be public (D-03 makes Empowered public by design),
  but it is a new public fact and should be a deliberate one.
- 🔴 **Crawl ≠ index, and the welcome screen must not promise otherwise.** D-08 says
  "scrapable… including crawlers". Civic Spaces is a client-rendered Vite SPA with **no SSR
  and no prerender**; `public/` has **no `robots.txt`**; `index.html` carries one static set
  of `og:` tags (`og:title: "Civic Spaces"`). So after this phase: the **PostgREST endpoint**
  becomes publicly queryable (a real, permanent, scriptable exposure — this is the one-way
  door), but Google-style indexing requires JS execution and most crawlers and *all* social
  unfurlers will see the static shell. A shared `/post/:postId` link will not unfurl with
  the post's text. Search-engine visibility is a separate piece of work (SSR/prerender,
  per-post `og:` tags, a `robots.txt`) and is **not** in this phase. The plan should say so,
  and the copy should not imply a post will show up in search results.

---

## Q5 — Connect Pillar language

**There is no shipped component-library or product copy for the three pillars.** Searched
`@empoweredvote/ev-ui` (`C:/ev-ui`), the live landing site source
(`C:/ev-landing/ev-landing-main`), and the accounts app: zero matches for pillar copy in
`ev-ui`, and the public `index.html` at `empowered.vote` is currently a newsletter/launch
page that does not market the pillars at all. [VERIFIED: codebase grep]

**The canonical written source exists and is already committed to this repo:**
`empowered-vote-primer.md` § "The Three Pillars" (lines 63–110). The welcome screen should
stay consistent with it rather than inventing. Verbatim, the Connect entry:

> ### Connect — Unpacking Shared Values
> **Problem:** Political Polarization
> **Audience:** Smaller subset — users willing to participate, not just consume.
> **Core beliefs:** Protect citizen conversations. Difficult discussions are guided by shared values. Only focus on shareable problems.
> **Philosophy:** Authenticated, pseudonymous community. **We don't need to know who users are — we need to ensure each person has exactly one voice and lives where they claim.** Design cues come from mediation and counseling, not anonymous internet forums.
>
> **Key Connect design rules:**
> - Connected users use pseudonyms. Never expose legal identity.
> - Civic conversations require iterative community (where your actions affect the people who know you) to breed trust.

That bolded sentence is Chris's "each person only gets one voice in the discussion" already
written down, with the *lives where they claim* half that explains why an address is asked
for at all — which is exactly the bridge D-16's privacy pitch needs.

The one other framing, from `ev-landing/briefing/2026-09-11/index.html`, written for a public
audience and therefore closer to welcome-screen register:

> **Inform Pillar: Shared Facts** — Open to everyone, no login. Evidence-based, engaging, anti-partisan.
> **Connect Pillar: Shared Values** — Connected accounts, one human one voice.

"Shared Facts / Shared Values / Shared Solutions" is the pillar triad in its shortest form
and is the phrasing to reuse. ⚠️ That same briefing says the Connect pillar is *"parked
during the election push; resumes after November"* — consistent with the repo-map memory;
worth a sanity check with Chris that a public-facing Connect welcome screen is wanted now.

Also committed here and worth the planner's time:
`9_Connect_Civil-Civics_Equal-Slices-detailed.md` line 6 — *"**Pillar**: Connect Pillar
(Social, deliberative, requires authentication)"* — and its § "Phase 0: Inform Lurker",
which is a written portrait of exactly the visitor this phase serves, including the
instruction *"We don't create artificial friction ('You must create account to see more!')"*.
That is a direct constraint on the welcome screen's tone and is consistent with D-18.

**Terminology to get right:** the tier is **"Connected"** in ev-accounts' data
(`tier: 'connected'`) and **"Connect"** is the pillar. The primer uses "Connected users".
`database.ts` uses `'connected'`. Do not write "Connect account" where "Connected account"
is meant.

---

## Q6 — Phase size

**Split it. One seam, and it is the one-way door.**

The work decomposes into four blocks with sharply different risk and different external
dependencies:

| Block | Depends on | Reversible? |
|---|---|---|
| **A. Welcome screen** — explainer, pillar copy, privacy pitch, four-way judged | Nothing | Yes |
| **B. Place navigation** — place entry (both paths), shell-level place switcher, `isViewOnly` rewritten to fail closed, Explore + sidebar + reps for a visited place, `CLAUDE.md` and `LocationPrompt.tsx` rule updates | ev-accounts handoff **only for the address path**; the place-name path needs nothing new | Yes |
| **C. Public conversations** — schema `USAGE`, column grants, `get_public_feed`, the four policies, realtime gating, `check-anon-read.mjs` | DDL access (supabase-local MCP is the only path, per project memory), `NOTIFY pgrst` + 1–2 min wait | 🔴 **No.** Once crawled, permanently public |
| **D. The display-name answer** | One SQL aggregate, then a product decision | Decision only |

**The seam is between B and C.** Arguments, in order of weight:

1. **A + B ship a complete, coherent product without touching the one-way door.** An
   observer gets the welcome screen, types a place, and sees a real Explore for it — six
   modules and eight reserved rooms of real public data from endpoints that are *already*
   anonymous (`/essentials/browse/by-area`, `/location-search`, `/coordinate-lookup`,
   meetings, elections, compass topics). Conversations stay members-only. That is already
   the fix for everything the ROADMAP measured at `1096e7a`: the grey sentence, the blank
   `geoid: null` Explore, "for your area" addressed to nobody, and no account explanation.
2. **C is gated on D, and D is gated on a fact nobody has yet.** Q4.3's query takes minutes
   but needs credentials. Binding an irreversible migration to a decision that has not been
   made, inside a phase whose other three-quarters are ready, is how the decision gets made
   under deadline pressure. The context itself says *"a plan that opens `anon` reads without
   answering it is not finished."*
3. **They fail differently.** A/B failures are visible on a screenshot. C's failures are
   silent and permanent — an over-wide grant publishes the member roster and nothing goes
   red. C deserves its own plan, its own `check-anon-read.mjs`, and its own review.
4. **The address-path handoff has its own lead time.** B can ship with the place-name path
   complete and the address path landing when ev-accounts does, without that schedule
   touching the DDL.

**Concretely:**

- **Phase 17 — The Signed-Out Arrival (A + B).** Welcome screen; place entry; shell-level
  place navigation for observers *and* members (D-19); `isViewOnly` rewritten to fail closed
  and extended to `check:explore-gate` as a third and fourth case; the `canWriteIn()` pure
  predicate (D-21's seam); Explore, banner, sidebar and representatives for a visited place;
  the `seed-invitation` authentication guard; `CLAUDE.md` and `LocationPrompt.tsx` updated
  per D-14. Plus the ev-accounts handoff document for `POST /api/civic-spaces/resolve`.
- **Phase 18 — The Public Square (C + D).** The `display_name` audit as task 1 and a
  `checkpoint:human-verify` as task 2; then schema `USAGE`, column grants, `get_public_feed`,
  the four policies, realtime gating; `scripts/check-anon-read.mjs` with its must-fail list;
  the `CLAUDE.md` "members-only by design" correction.

If Chris wants one phase: the same boundary becomes a hard wave gate, with D's checkpoint
blocking every task in C. The boundary itself is not optional.

**Also reconsider in planning, per the context's own flag:** once conversations are public,
the deferred "shared-link arrival" partly evaporates — a signed-out visitor on
`/post/:postId` can simply be shown the post. `locatePost`'s `own` / `sibling` /
`unavailable` resolver gains a fourth outcome, and `unavailable` stops needing to conflate
not-found with not-yours for most posts. That belongs in **Phase 18**, with C, because it
only becomes true once C ships. Note that `unavailable`'s deliberate conflation still earns
its keep for deleted posts and for suspended authors.

---

## Standard Stack

**This phase adds no packages.** Everything it needs is already a dependency or an existing
public endpoint. [VERIFIED: `package.json`]

### Core — already present

| Library | Version (lockfile) | Purpose here |
|---|---|---|
| `@supabase/supabase-js` | per `package-lock.json` | The anonymous client — already anon-capable: `supabase.ts`'s `currentAccessToken()` returns `''` when there is no valid token, so it sends no bearer |
| `@tanstack/react-query` | — | `useSlicesForPlace`, the new feed query |
| `wouter` | — | Unchanged; `/post/:postId` and `/profile/:userId` |
| `motion/react` | — | Welcome-screen animation, matching `NotificationBell` / `SidebarMobile` |
| `react-loading-skeleton` | — | Loading states; match `FeedSkeleton`, do not invent a third style |
| `@empoweredvote/ev-ui` | — | Use its components rather than copies |
| `sonner` | — | Error toasts for an unresolvable address |

### Services — already deployed, already CORS-allowed for `civicspaces.empowered.vote`

| Endpoint | Auth | Use |
|---|---|---|
| `GET api.empowered.vote/api/essentials/location-search?q=&limit=` | none | Place-name typeahead (136 ms, 622 B for 5) |
| `POST api.empowered.vote/api/essentials/coordinate-lookup` | none | Place centroid → `county.geoid` |
| `POST api.empowered.vote/api/essentials/browse/by-area` `{geo_id, mtfcc}` | none | Officials for a visited place |
| `public/geo/<FIPS>.json` | none, offline | geoid → `{name, lat, lon, pop}` |
| `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress` | none, **no CORS** | Address → geoids. Server-side, or JSONP |

### Alternatives considered

| Instead of | Could use | Why not |
|---|---|---|
| New `POST /api/civic-spaces/resolve` | `GET /api/essentials/address-search` | D-13: address in the query string (logged) and `matchedAddress` echoed back. Also returns no place geoid outside place-loaded states |
| New `POST /api/civic-spaces/resolve` | Client JSONP to Census | Executes third-party script; no NAD fallback, so TIGER gaps become user-visible failures. Acceptable only as a documented fallback |
| New `get_public_feed` RPC | Grant `anon` SELECT on `friendships`/`follows`/`blocks` | Widens three tables that should never appear in an anonymous request, to satisfy a boosting join that is meaningless without friends |
| New `get_public_feed` RPC | `get_feed_filtered` | Its body hard-codes a `slice_members` membership check — returns zero rows for observers **and** for sibling shards |
| Shell-level place control | Extend `SliceSelector` | Conflates `geoid` (which place) with `sibling_index` (which shard of it) in one menu |
| `sessionStorage` for the viewed place | `localStorage` | Should not outlive the window; `cs_dev_place` sets the precedent and states the reason |

**Installation:** none.

---

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** The recommended approach uses
only existing dependencies and already-deployed first-party endpoints, plus one keyless
`.gov` HTTP service called by URL (no package involved). No `[SLOP]`, no `[SUS]`, nothing
removed.

If the plan later reaches for an address-autocomplete or geocoding **package**, that is a
signal it has drifted off this research: the platform's rule is Census + NAD, never Google,
and both are HTTP services, not libraries.

---

## Architecture Patterns

### Data flow — an observer typing a place

```
                    ┌─────────────────────────────────────────┐
  visitor types ───▶│  PlaceEntry  (welcome screen OR shell)  │
                    └────────────┬───────────────┬────────────┘
                       address   │               │  place name
                                 ▼               ▼
            POST /api/civic-spaces/resolve   GET /essentials/location-search?q=
             (NEW, anonymous, body-only)       (public, 136ms, ranked)
                                 │               │ place geo_id + state
                                 │               ▼
                                 │        public/geo/<FIPS>.json  (offline)
                                 │               │ name + lat/lon
                                 │               ▼
                                 │        POST /essentials/coordinate-lookup
                                 │          (public, body-only)  │ county.geoid
                                 ▼               ▼
                    ┌─────────────────────────────────────────┐
                    │  { city?, county, state, nation:'US',   │
                    │    unified:'UNIFIED' }                  │   ← geoids only.
                    │  sessionStorage['cs_viewed_place']      │     Never the address.
                    └────────────┬───────────────┬────────────┘
                                 │               │
         ┌───────────────────────┘               └──────────────────────┐
         ▼                                                              ▼
  useSlicesForPlace(geoids)                              ExploreView(sliceType, geoid)
  supabase.schema('civic_spaces')                        ├─ compositionKey() — pure, no slice row needed
    .from('slices')                                      ├─ /essentials/browse/by-area  → officials
    .select(id, slice_type, geoid,                       ├─ meetings / elections / compass (public API)
            sibling_index, member_count)                 └─ seed-invitation  ⟵ MUST be auth-gated
         │                                                     (D-11: never offer an unavailable action)
         ├── rows found ──▶ feed: rpc('get_public_feed', {slice_id})   [PHASE 18]
         │                   └─ RLS posts_select_public  (TO anon, authenticated)
         │                   └─ connected_profiles  (authors of visible content only)
         │
         └── NO rows  ────▶ "nobody from here has joined yet"   ⟵ the COMMON case
                             (slices are created on demand by /assign)

  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  canWriteIn(viewedSlice, viewer)   — ONE pure exported predicate          ║
  ║    = !!viewedSlice && ownedSliceIds.has(viewedSlice.id)                   ║
  ║  Fails CLOSED. Consumed by AppShell · SliceFeedPanel · ThreadView ·       ║
  ║  ReplyCard · ExploreView.  Covers: signed out · Inform · other city ·     ║
  ║  sibling shard.  D-21's seam: Empowered reach is this function's body.    ║
  ╚══════════════════════════════════════════════════════════════════════════╝
```

### Pattern 1 — Derive the write gate once, fail closed

**What:** a single pure predicate, exported from a module with no runtime imports, consumed
everywhere. **When:** always; it replaces `activeIsViewOnly`.
**Why:** `AppShell.tsx:840`'s current expression fails *open* when `activeSlice` is
undefined, and that is the phase's highest-risk line. A pure module can also be executed by
`node --experimental-strip-types` from a check script, so the check runs the **shipped**
function rather than a copy — the pattern `exploreComposition.ts` already establishes and
documents (`🔴 This module has no runtime imports, deliberately`).

```ts
// src/lib/writeAccess.ts — no runtime imports, so check scripts can load the real thing.
export interface ViewedSlice { id: string; sliceType: string; geoid: string }

/**
 * May this viewer write in the slice on screen?
 *
 * 🔴 Fails CLOSED. Four cases collapse into one expression:
 *   signed out  → ownedSliceIds empty      → false
 *   Inform tier → no slice_members rows    → false   (D-04 by construction, no tier check)
 *   other city  → id not owned             → false
 *   sibling shard → id not owned           → false   (the Phase 16 case, unchanged)
 *
 * 🔴 D-21 seam: Empowered cross-slice reach belongs HERE, in this body, and nowhere else.
 */
export function canWriteIn(viewed: ViewedSlice | null, ownedSliceIds: ReadonlySet<string>): boolean {
  if (!viewed) return false
  return ownedSliceIds.has(viewed.id)
}
```

### Pattern 2 — Column grants, not table grants

**What:** name the columns in the `GRANT`; let the policy handle the rows.
**When:** every `anon` grant in this phase.
**Why:** `useThread` does `select('*')` on `posts`, so a table-level grant publishes
`edit_history`. A column grant makes the exclusion structural rather than remembered.

```sql
-- The schema gate comes FIRST. Without it PostgREST cannot resolve Accept-Profile at all.
GRANT USAGE ON SCHEMA civic_spaces TO anon;

-- edit_history is deliberately absent: it is every previous body of an edited post.
GRANT SELECT (id, slice_id, user_id, title, body, reply_count, created_at, updated_at, is_deleted)
  ON civic_spaces.posts TO anon;

GRANT SELECT (id, post_id, parent_reply_id, user_id, body, created_at, updated_at, is_deleted)
  ON civic_spaces.replies TO anon;

-- account_standing / is_suspended / ui_theme / created_at / updated_at deliberately absent.
GRANT SELECT (user_id, display_name, avatar_url, tier)
  ON civic_spaces.connected_profiles TO anon;

GRANT SELECT (id, slice_type, geoid, sibling_index, current_member_count, photo_url)
  ON civic_spaces.slices TO anon;

-- slice_members, notifications, friendships, follows, blocks, flags, moderators,
-- action_log and every public.* forwarding view get NOTHING. That omission is the policy.

NOTIFY pgrst, 'reload schema';
```

### Pattern 3 — A narrow public RPC instead of widening grants

**What:** `get_public_feed` touches `posts` only; `SECURITY INVOKER` so RLS still governs.
**When:** the observer and visited-place feed.
**Why:** `get_boosted_feed_filtered` is `SECURITY INVOKER` and reads three social tables as
the caller. Matching its *output* shape while narrowing its *input* surface keeps
`useBoostedFeed`'s cursor logic untouched.

```sql
CREATE OR REPLACE FUNCTION civic_spaces.get_public_feed(
  p_slice_id uuid, p_limit integer DEFAULT 20,
  p_cursor_at timestamptz DEFAULT NULL, p_cursor_id uuid DEFAULT NULL)
RETURNS TABLE (id uuid, slice_id uuid, author_id text, body text, is_deleted boolean,
               created_at timestamptz, updated_at timestamptz, reply_count integer,
               boosted_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER        -- ← INVOKER: RLS on posts still governs
AS $$
  -- Deliberately touches NO social table. An observer has no friends to boost by, so
  -- boosted_at is simply created_at — same column shape, so BoostedFeedCursor is unchanged.
  SELECT p.id, p.slice_id, p.user_id, p.body, p.is_deleted, p.created_at, p.updated_at,
         p.reply_count, p.created_at AS boosted_at
  FROM civic_spaces.posts p
  WHERE p.slice_id = p_slice_id
    AND p.is_deleted = false
    AND (p_cursor_at IS NULL OR (p.created_at, p.id) < (p_cursor_at, p_cursor_id))
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION civic_spaces.get_public_feed(uuid,integer,timestamptz,uuid)
  TO anon, authenticated;
```

### Pattern 4 — The place resolver, exactly mirroring an existing privacy contract

**Where:** ev-accounts, new file, copied from
`backend/src/routes/essentialsCoordinateLookup.ts`. Keep its comment block; it is the
specification.

```ts
// POST /api/civic-spaces/resolve — anonymous, body-only, zero DB writes.
// Body-only transport: the address is read ONLY from the JSON body, NEVER from a query
// string — Render/proxy access logs record the request line, not the POST body.
// PRIVACY: the address is never logged, never echoed in a response, never in telemetry.
// Only (err as Error).message ever reaches console.error.
router.post('/resolve', optionalAuth, resolveLimiter, async (req, res) => {
  const address = typeof req.body?.address === 'string' ? req.body.address.trim() : ''
  if (!address) { res.status(422).json({ code: 'VALIDATION_ERROR' }); return }
  try {
    const { lat, lng } = await geocodeAddress(address)       // Census + NAD + county locators
    const geoids = await resolvePlaceGeoidsAtPoint(lat, lng) // G4110/G4120, G4020, G4000
    res.status(200).json({ ...geoids, nation: 'US' })        // ~120 bytes. No matchedAddress.
  } catch (err) { /* PO_BOX_REJECTED / ADDRESS_NOT_FOUND → 422; GEOCODER_UNAVAILABLE → 503 */ }
})
```

### Anti-patterns to avoid

- **Granting `anon` SELECT on a whole table.** `posts` publishes `edit_history`;
  `connected_profiles` publishes moderation state. Columns, always.
- **`connected_profiles … USING (true)` for `anon`.** Publishes the full member roster via
  one PostgREST query. Scope to authors of visible content.
- **Reusing `SliceSelector` for place entry.** Two axes, one menu.
- **Writing the write gate inline at each call site.** Loses D-21's seam and repeats the
  "gated the feed, not the thread" failure mode.
- **Calling `/essentials/address-search` because it is already there.** Two D-13 violations.
- **Adding a hook to `SliceFeedPanel`.** It fires six times. Hoist to `AppShell`.
- **Letting `seed-invitation` render for an observer.** Offers a vote they cannot cast.
- **Treating "no slice row" as an error state.** It is the common case and the best pitch.
- **Unguarded `sessionStorage`.** Private windows throw; that is deferred item 9's bug again.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Address → coordinates | A geocoder, or a Census client with retries | ev-accounts `geocodeAddress()` | It already chains Census → county ArcGIS locators → NC OneMap → NAD, with measured latency profiles per service and a documented reason for the order. A fresh Census-only client silently loses all of that |
| Point → place/county/state geoid | PostGIS queries, a boundary dataset | `resolveOfficialsAtPoint`'s existing `ST_Covers` queries (`G4110/G4120`, `G4020`, `G4000`) | Already written, already indexed, already handles the enclave-centroid substitution |
| Place-name disambiguation | Fuzzy search over `public/geo/` | `GET /essentials/location-search` | Ranked, deduplicated, state-qualified, and it already knows that Portland OR and Portland ME are different. 136 ms |
| geoid → display name | A names table, an `api.census.gov` call | `src/lib/geoNames.ts` + `public/geo/` | Committed, offline, keyless, drift-guarded by `npm run geo:check`. `api.census.gov` 302s keyless requests — that is why this exists |
| Officials for a visited place | A new endpoint | `POST /essentials/browse/by-area {geo_id, mtfcc}` | Anonymous, already used by `useRepresentatives`'s dev path, request shape already in `toolCoverage.ts` |
| Block/boost filtering for observers | A client-side filter | Nothing — omit it | An observer has no friends and no blocks. Filtering nothing is not a feature |
| Cursor pagination for the public feed | A new cursor format | `BoostedFeedCursor` + `get_public_feed` returning `created_at AS boosted_at` | Keeps `useBoostedFeed`'s `getNextPageParam` untouched. Its comment already warns: *"CRITICAL: cursor must use boosted_at"* |
| Headless browser checks | `node_modules` Playwright | `npm root -g` + `mod.chromium ?? mod.default?.chromium` | Playwright is a global install here; `scripts/check-explore-gate.mjs:106-113` is the pattern |

**Key insight:** every piece of this phase's data layer already exists somewhere in the
platform, anonymous and CORS-allowed. The only genuinely new things are *one* geoid-returning
endpoint and *one* narrow RPC. Anything else being written from scratch is a sign the plan
has missed an existing path.

---

## Common Pitfalls

### Pitfall 1 — The gate fails open for exactly the new case
**What goes wrong:** `activeIsViewOnly` is `!!activeSlice && …`. An observer has no
`activeSlice`, so it is `false` — "not view-only" — and the composer, FAB and reply box are
offered to someone RLS will refuse.
**Why:** the expression was written when the only non-writable state was *a sibling of a
slice you hold*. Absence of a slice meant "no tab", not "a tab you cannot write in".
**Avoid:** replace it with `canWriteIn()` (Pattern 1), which fails closed.
**Warning signs:** a composer visible while signed out; an insert returning a PostgREST 403.

### Pitfall 2 — Shipping half the gate, again
**What goes wrong:** the feed is gated, the thread is not. CLAUDE.md records this shipping
once already.
**Why:** the feed is where you look while testing.
**Avoid:** `check:explore-gate` already runs 11 assertions × 2 tabs on the list view **and**
inside an opened topic. Add the observer and the other-city visitor as **third and fourth
cases of the same check**, not as a new check — and keep the control case (affordances
PRESENT on the member's own shard), or a build that hid everything everywhere would pass.
**Warning signs:** one tab red and the other green.

### Pitfall 3 — `get_feed_filtered` looks like the right RPC
**What goes wrong:** its body hard-codes a `slice_members` membership check, so it returns
zero rows for an observer *and* for a sibling shard, no matter what the policies say.
**Why:** it is named like the general feed function and sits next to the one actually used.
`SliceFeedPanel.tsx:3` has `useFeed` commented out; line 4 imports `useBoostedFeed`.
**Avoid:** read `SliceFeedPanel`'s imports before touching a feed RPC.
**Warning signs:** an empty feed with a 200 and no error.

### Pitfall 4 — Granting `anon` SELECT on `connected_profiles` with `USING (true)`
**What goes wrong:** the full member roster becomes enumerable with one PostgREST query.
**Why:** it is the obvious mirror of `connected_profiles_select_authenticated`, and it works,
and nothing complains.
**Avoid:** scope the `anon` policy to authors of non-deleted posts or replies (Q2.5).
**Warning signs:** `curl 'https://…/rest/v1/connected_profiles?select=display_name&limit=5000'`
with no bearer returns rows for people who have never posted.

### Pitfall 5 — Forgetting the `public.*` forwarding views
**What goes wrong:** `public.friendships`, `public.follows`, `public.civic_notifications`,
`public.flags`, `public.blocks`, `public.moderators`, `public.action_log` live in the schema
PostgREST exposes by default.
**Why:** all the attention goes to `civic_spaces`, and these are in `public`.
**Avoid:** assert in `check-anon-read.mjs` that every one of them is unreachable without a
bearer — *before* the migration as well as after, so the baseline is recorded.

### Pitfall 6 — Treating the Census Geocoder's `200` as success
**What goes wrong:** `res.ok` is true for every failure. `result.addressMatches` is `[]`.
**Why:** the service never 4xxs for a bad address.
**Avoid:** branch on `addressMatches.length`, never on status. Remember a *real* address can
return zero matches (`70 Court Plaza, Asheville NC` does).
**Warning signs:** "resolved" with every geoid `undefined`.

### Pitfall 7 — Testing the geocoder in Node and concluding it works
**What goes wrong:** Node's `fetch` does not enforce CORS. Every probe passes; the browser
fails.
**Why:** the missing header is invisible unless you dump headers or use a real browser.
**Avoid:** any claim about a cross-origin endpoint is verified in Chromium from the real
origin. (`scripts/` already has four scripts that load Playwright for exactly this reason.)
**Warning signs:** `TypeError: Failed to fetch` in production and nowhere else.

### Pitfall 8 — "No slice row" handled as an error
**What goes wrong:** the most common observer outcome renders as a failure.
**Why:** slices are created on demand by `/assign`, so only places where a member already
lives have rows.
**Avoid:** design the empty state first; it is the sign-up pitch. And keep it distinct from
`composition.isUnseeded`, which means something else.

### Pitfall 9 — `useRepresentatives` silently following the viewed place
**What goes wrong:** *your* representatives render beside *their* conversations.
**Why:** `useRepresentatives(userId)` is hoisted in `AppShell` and keyed on the account, and
its name does not say so.
**Avoid:** a visited place's officials come from `POST /essentials/browse/by-area`. Same for
`useCompassData` — *"Nothing aggregates… These are one member's own answers"*
(`ExploreView.tsx:128`), which stays true and must not start following a place.

### Pitfall 10 — Unguarded storage
**What goes wrong:** the app does not boot in a private window or with site data blocked —
for precisely the privacy-minded visitor this phase is written for.
**Why:** `useAuth.ts:100` already does this (deferred item 9, still open).
**Avoid:** `try`/`catch` every `sessionStorage` access, the way `devMockData.ts`'s
`resolveDevPlace()` does. Do not add a second instance.

### Pitfall 11 — Promising search-engine visibility
**What goes wrong:** copy implies posts will be findable on Google; they will not be, because
there is no SSR, no prerender and no `robots.txt`.
**Why:** D-08 says "scrapable… including crawlers", which is true of the **API** and not yet
of the **pages**.
**Avoid:** say what is true — conversations are public and readable by anyone with the link.

### Pitfall 12 — Forgetting the schema cache reload
**What goes wrong:** the frontend deploys, selects the new RPC, and PostgREST 404s it for a
minute or two.
**Avoid:** `NOTIFY pgrst, 'reload schema'` at the end of the migration (the sibling migration
already does), then wait 1–2 minutes before deploying the frontend. Deploy here is automatic
on merge to `main` (~3 min), so sequence the merges.

---

## Runtime State Inventory

**Not applicable.** This is a feature phase, not a rename, refactor or migration. No stored
string is being renamed; no OS-registered state, secret name, or build artifact carries a
value this phase changes.

One adjacent item, recorded because it is the same *class* of thing: the new `anon` grants
are **live database state**, not just files in `supabase/migrations/`. They do not take
effect from a merge, and they are not reverted by a revert. Rolling back this phase means
writing and applying a `REVOKE` migration — and, for the crawl-exposure half, cannot undo
what was already read. That is the one-way door Q6 splits the phase around.

---

## Environment Availability

| Dependency | Required by | Available | Version / status | Fallback |
|---|---|---|---|---|
| Node | all checks, build | ✓ | v24.13.0 | — |
| Playwright (global) | `check:explore-gate` and any new browser check | ✓ | `C:/Users/Chris/AppData/Roaming/npm/node_modules/playwright`, Chromium cached, launched successfully this session | — |
| `geocoding.geo.census.gov` | address path | ✓ | 200, keyless, 148–420 ms | ev-accounts NAD/county-locator chain (server-side only) |
| `api.empowered.vote` public endpoints | place-name path, officials | ✓ | `location-search` 136 ms · `coordinate-lookup` 1160 ms · `browse/by-area` in use today. `ACAO: https://civicspaces.empowered.vote` on all | — |
| `public/geo/` gazetteer | geoid → name | ✓ | 53 shards, 2.7 MB, committed; `npm run geo:check` is the drift guard | — |
| `POST /api/civic-spaces/resolve` | address path (recommended) | ✗ | **Does not exist.** Cross-repo handoff to ev-accounts | JSONP to Census, documented as a fallback (Q1.7) |
| **DDL path to the production database** | every `anon` grant and policy | **✗ in this session** | Project memory: *supabase-local MCP is the only DDL path*. Not exercisable from here | None — Phase 18 is blocked without it |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | the `display_name` audit; `check-anon-read.mjs` | **✗ in this session** | `.env.local` exists but is not readable here | None — see Open Question 1 |

**Missing with no fallback:** DDL access and Supabase credentials. Both are needed only for
the Phase-18 half (C + D). Neither blocks A + B. This is additional evidence for the Q6
split.

---

## Validation Architecture

### Test framework

| Property | Value |
|---|---|
| Framework | **None.** No test script, no test files, no runner in `package.json` |
| Config file | none — and none should be added here; that is its own decision |
| Quick run command | `npm run build` (`tsc -b && vite build`) |
| Full suite command | `npm run build && npm run check:composition && npm run check:explore-gate && npm run check:explore-rooms && npm run check:agenda-topics` (the last three need `npm run dev` running) |

The repo's actual safety net is `npm run build` plus seven purpose-built `.mjs` checks. Two
patterns are worth copying exactly:

- `check:composition` runs with `node --experimental-strip-types` against
  `src/lib/exploreComposition.ts` directly, so it executes the **shipped** function. That
  module's header states the constraint: *"🔴 This module has no runtime imports,
  deliberately… A copy-test passes while the shipped code is wrong."* A new
  `src/lib/writeAccess.ts` should obey the same rule, and its check should load it the same
  way.
- `check:explore-gate` drives `?dev=1` in Playwright, states its **control case first**
  (the affordances are PRESENT on the member's own shard), asserts on the **list view and
  inside an opened topic**, and asserts `documentElement.classList` matches the theme it
  asked for rather than trusting Playwright's `colorScheme`.

### Requirements → test map

| Req | Behaviour | Type | Command | Exists? |
|---|---|---|---|---|
| D-06/D-11 | Welcome screen renders signed out, correct in light+dark × desktop+mobile | visual | extend `npm run shoot:app` | ❌ Wave 0 |
| D-09 | No `geoid: null` Explore anywhere | unit | `check:composition` — assert no caller passes `geoid: null` with `isAuthenticated: false` | ❌ Wave 0 |
| **D-20** | **No write offered: signed out** | browser | `check:explore-gate`, **third case** | ❌ Wave 0 |
| **D-20** | **No write offered: member viewing another city** | browser | `check:explore-gate`, **fourth case** | ❌ Wave 0 |
| D-20/D-21 | `canWriteIn()` fails closed on all four inputs | unit | `node --experimental-strip-types scripts/check-write-access.mjs` | ❌ Wave 0 |
| D-12 | Address resolves to the three geoids; unresolvable says so | unit | `scripts/check-place-resolve.mjs` (live, network) | ❌ Wave 0 |
| D-13 | No address in any persisted storage | browser | `check:explore-gate` extension — dump `localStorage`/`sessionStorage` after a lookup, assert no substring of the input | ❌ Wave 0 |
| D-07/D-08 | `anon` reads posts, replies, slices, author names | integration | `scripts/check-anon-read.mjs` (must-succeed half) | ❌ **Phase 18** |
| D-08 | `anon` reaches **nothing** on the closed list | integration | `scripts/check-anon-read.mjs` (must-fail half) | ❌ **Phase 18** |
| Q3.3 | Unseeded place renders Explore + the honest empty state, no `seed-invitation` | browser | `check:explore-rooms` extension | ❌ Wave 0 |

### Sampling rate

- **Per task commit:** `npm run build`
- **Per wave merge:** `npm run build` + every `check:*` (dev server running)
- **Phase gate:** full suite green, plus the four-way visual judgement, plus — for Phase 18 —
  `check-anon-read.mjs` green on **both** halves, run against production as `anon`

### Wave 0 gaps

- [ ] `scripts/check-write-access.mjs` — loads `src/lib/writeAccess.ts` with
      `--experimental-strip-types`; covers D-20 and D-21's seam
- [ ] `scripts/check-place-resolve.mjs` — network; the Census failure table from Q1.3 as
      fixtures, including the "real address, zero matches" case
- [ ] `scripts/check-explore-gate.mjs` — **extend**, do not fork: two new viewer cases,
      control case preserved
- [ ] `scripts/check-anon-read.mjs` — **Phase 18**; needs the Supabase anon key
- [ ] `npm run shoot:app` — welcome screen, four ways, with the `ev_color_scheme` cookie set
      and `documentElement.classList` asserted
- [ ] No framework install. `npm run build` plus `.mjs` checks is the project's chosen net —
      changing that is not this phase's call

---

## Security Domain

### Applicable ASVS categories

| Category | Applies | Standard control here |
|---|---|---|
| V2 Authentication | yes | Unchanged. `decodeUserId` / `resolveInternalUserId` / `current_user_id()` must still agree; **this phase must not touch any of the three** |
| V3 Session Management | yes | `supabase.ts` already drops an expired `cs_token` and falls back to no bearer — which is exactly the anon path this phase widens. Verify an expired session degrades to *observer*, not to an error loop |
| **V4 Access Control** | **yes — the core of the phase** | Postgres RLS + column-level grants + `GRANT USAGE ON SCHEMA`. Deny by default: the closed list in Q2.6 is enforced by the **absence** of a grant, not by a policy |
| V5 Input Validation | yes | The address/place input: length cap, trim, no HTML. Server side, `zod` in ev-accounts (`z.string().min(1).max(…)`, the existing pattern). PostgREST parameterises; no SQL is built from input |
| V6 Cryptography | no | None added. The member path's vault stays untouched because no observer location is ever stored |
| V7 Error Handling & Logging | **yes** | D-13's "no logging" clause. The resolver must log `(err as Error).message` only — never `req.body` — exactly as `essentialsCoordinateLookup.ts` does |
| V8 Data Protection | **yes** | D-08 is a deliberate data-classification change. The `display_name` audit (Q4) is the control; column grants are the mechanism |
| V13 API | yes | Rate-limit the new anonymous endpoint (`express-rate-limit`, 30/min/IP, mirroring `coordinateLookupLimiter`). PostgREST's anonymous read surface is newly reachable — Supabase's own rate limits apply, but the exposure should be acknowledged |

### Known threat patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Member-roster enumeration via `connected_profiles` | **Information disclosure** | Scope the `anon` policy to authors of non-deleted content (Q2.5). The lurker stays invisible |
| `slice_members` exposure — "who lives where" | **Information disclosure** | No `anon` grant at all. The single most sensitive join in the schema; ADR 0007's location floor exists for it |
| `edit_history` exposure — retracted wording | **Information disclosure** | Column-level grant excludes it. `useThread` does `select('*')`, so a table grant would publish it |
| Social-graph exposure via the feed RPC's invoker privileges | **Information disclosure** | A new RPC that touches `posts` only, rather than granting `anon` three social tables |
| Doxxing by correlation: real `display_name` + political speech + inferable jurisdiction | **Information disclosure** | The Q4 audit and decision, **before** the migration. This is the one D-02 explicitly guards against ("protects against a stalker finding you easily") |
| Deanonymisation of an observer by address logging | **Information disclosure** | Body-only POST; no persistence; no echo; `message`-only error logs. Honest caveat: census.gov sees the address regardless |
| Anonymous scraping / cost amplification on PostgREST | **Denial of service** | Accepted consequence of D-08. Keep `LIMIT` on every public RPC; Supabase platform limits apply |
| Abuse of the anonymous resolver as a free geocoder | **Denial of service** | `express-rate-limit` 30/min/IP with the shared store, as `coordinateLookupLimiter` already does |
| Write offered where RLS refuses | **Elevation of privilege** (attempted) | `canWriteIn()` failing closed, plus the unchanged INSERT policies as the backstop. RLS already refuses; the bug is the UI offering it |
| Third-party script execution via JSONP | **Tampering** | Avoid by using the server-side resolver. If JSONP ships, it is a `.gov` host and must be documented as a deliberate, scoped exception |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Production `civic_spaces.connected_profiles.display_name` values are mostly pseudonyms | Q4 | **High.** The whole Q4 recommendation. The architecture and defaults support it; the validation does not enforce it. Resolved by one SQL aggregate (Q4.3) |
| A2 | `slices` rows exist for `('federal','US')` and `('unified','UNIFIED')` in production | Q3.2 | Low — every Connected member is assigned both. If wrong, an observer sees no Federal/Unified tab |
| A3 | Production is running the migrations exactly as committed in `supabase/migrations/` | Q2 | Medium. Every policy, grant and function body here was read from the committed migration, not from the live catalog. A live `pg_policies` / `information_schema.role_table_grants` dump would confirm |
| A4 | The Census Geocoder's lack of CORS is stable policy, not a transient config | Q1.1 | Low. Confirmed from three origins and a real browser on 2026-10-26. If it changed in our favour, the client path becomes simpler — fail-safe direction |
| A5 | Render's access log records the request line but not POST bodies | Q1.5, Pattern 4 | Low. It is ev-accounts' own documented reasoning in `essentialsCoordinateLookup.ts`; this research did not independently verify Render's log format |
| A6 | `check:explore-gate` can be extended to new viewer cases rather than forked | Q6, Validation | Low. Its structure is parameterised by tab; viewer is a new axis. Worst case it is a sibling script sharing the assertion list |
| A7 | Supabase Realtime authorises `postgres_changes` through RLS + table privileges for `anon` | Q2.6 | Medium. The recommendation (don't subscribe without a session) is correct regardless, so the risk is contained |
| A8 | A public-facing Connect welcome screen is wanted now | Q5 | Low–medium. The 2026-09-11 briefing says the Connect pillar is *"parked during the election push; resumes after November"*, and project memory agrees. Today is 2026-10-26; the election is imminent. A one-line confirmation from Chris resolves it |
| A9 | ev-accounts `origin/master` as fetched today is what production runs | Q1.5, Q4 | Low. The live probes in Q1.5 matched the code's documented shapes exactly, which is strong corroboration |

---

## Open Questions

1. **What is actually in production's `display_name` column?**
   - Known: it is architecturally a pseudonym; the default is a generated `AdjectiveAnimal`;
     `legal_name` is a separate Empowered-only field.
   - Unclear: how many rows a member typed a real name into. Validation permits it.
   - **Recommendation:** run the Q4.3 aggregate as the first task of the public-read phase,
     gated by a `checkpoint:human-verify`. It costs minutes and it is the difference between
     an informed decision and a guess on an irreversible change.

2. **Will ev-accounts take `POST /api/civic-spaces/resolve`, and on what timeline?**
   - Known: the endpoint is ~40 lines against existing helpers, and the privacy pattern is
     already written next door.
   - Unclear: ev-accounts' capacity and review cadence.
   - **Recommendation:** write the handoff document in this phase and ship the place-name
     path (which needs nothing new) first. The address path lands when the endpoint does.
     Keep JSONP as the written fallback, not the plan of record.

3. **Does the Connect pillar's "parked until after November" posture still hold?**
   - Known: the 2026-09-11 briefing and project memory both say the pillar is paused;
     today is 2026-10-26.
   - Unclear: whether a public Connect welcome screen is wanted before the election.
   - **Recommendation:** a one-line confirmation. This is a product-timing question, not a
     technical one, and it does not change any finding above.

4. **What is the live policy and grant state, as opposed to the committed migrations?**
   - **Recommendation:** before writing the migration, dump `pg_policies` for
     `schemaname = 'civic_spaces'` and `information_schema.role_table_grants` for
     `grantee IN ('anon','authenticated')`. Five minutes, and it eliminates A3.

5. **Should suspended authors' posts be publicly readable?**
   - Known: the schema comment says suspended users are "hidden from feeds", but no policy
     or RPC enforces it today.
   - **Recommendation:** filter it in `get_public_feed`. It is a one-line `NOT EXISTS` and a
     cheaper answer than discovering it after the crawl.

---

## Sources

### Primary — HIGH confidence

- **Live HTTP, executed 2026-10-26 from this machine** — `geocoding.geo.census.gov`
  (`/geocoder/geographies/onelineaddress`, `/coordinates`, `/benchmarks`, `/vintages`; CORS
  header dumps from three Origins; `OPTIONS` preflight; six-sample latency run; seven-case
  failure matrix; `layers` parameter), `api.census.gov` (302 contrast),
  `api.empowered.vote` (`/essentials/coordinate-lookup`, `/essentials/address-search`,
  `/essentials/location-search`, `/civic-spaces/assign`, `OPTIONS` preflight). Scripts in
  `C:\Users\Chris\AppData\Local\Temp\claude\C--Civic-Spaces\d10accef-fec7-4b9c-b04d-f88d75045fda\scratchpad\`
- **Real Chromium** (global Playwright, `C:/Users/Chris/AppData/Roaming/npm/node_modules/playwright`)
  navigating `https://civicspaces.empowered.vote` — CORS block reproduced with the console
  message; JSONP success confirmed with all 10 geography layers
- **Civic Spaces codebase at `a3d3452`** — `supabase/migrations/` (all 20), `src/hooks/`
  (`useFeed`, `useBoostedFeed`, `useThread`, `useAllSlices`, `useSiblingSlices`,
  `useMemberDirectory`, `useMemberSearch`, `useRepresentatives`), `src/components/AppShell.tsx`,
  `SliceSelector.tsx`, `SliceFeedPanel.tsx`, `LocationPrompt.tsx`, `PostCard.tsx`,
  `explore/ExploreView.tsx`, `explore/registry.tsx`, `src/lib/` (`supabase`,
  `sliceAssignment`, `geoNames`, `exploreComposition`, `devMockData`, `evApi`),
  `scripts/check-explore-gate.mjs`, `public/geo/`, `package.json`, `index.html`, `vite.config.ts`
- **ev-accounts `origin/master`** (fetched 2026-10-26) — `backend/src/civic_spaces/routes/assignment.ts`,
  `services/sliceAssigner.ts`, `lib/geocodingService.ts`, `lib/jurisdictionPayload.ts`,
  `lib/displayName.ts`, `lib/profileService.ts`, `lib/accountMeService.ts`,
  `lib/essentialsService.ts`, `routes/essentials.ts`, `routes/essentialsCoordinateLookup.ts`,
  `routes/essentialsLocationSearch.ts`, `routes/account.ts`, `routes/connect.ts`,
  `src/index.ts`
- `empowered-vote-primer.md` § "The Three Pillars" (committed in this repo)
- `9_Connect_Civil-Civics_Equal-Slices-detailed.md` (committed in this repo)
- `.planning/phases/15-tool-deep-links/ACCOUNTS-HANDOFF.md:460-472` — the `ev_api`
  `rolbypassrls` finding
- `CLAUDE.md`, `.planning/ROADMAP.md` § Phase 17, `17-CONTEXT.md`

### Secondary — MEDIUM confidence

- `C:/ev-landing/ev-landing-main/briefing/2026-09-11/index.html` — public-register pillar
  copy; also the "Connect pillar parked until after November" statement
- Project memory (`MEMORY.md` index) — DDL path, PostgREST schema-cache reload, geocoding
  stack, cross-app coverage contract, deploy-on-merge

### Tertiary — LOW confidence

- None. Every claim above traces to a live request, a file read this session, or is tagged in
  the Assumptions Log.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Q1 geocoding | **HIGH** | Every claim exercised live, including the CORS block reproduced in a real browser from the real origin |
| Q2 read surface | **HIGH** on the shape, **MEDIUM** on live state | Every grant, policy and function body read from the migration that created it; A3 notes the live catalog was not dumped |
| Q3 slices for a non-member | **HIGH** | Code-level, with exact line numbers; the `activeIsViewOnly` fail-open was read directly |
| Q4 display name | **HIGH** on architecture, **LOW** on production contents | ev-accounts states the intent in its own code; the validation gap is in `account.ts:178`; the row contents need one query (A1) |
| Q5 pillar language | **HIGH** | Exhaustive grep across `ev-ui`, `ev-landing`, `EV-Accounts` and this repo; canonical source located and quoted verbatim |
| Q6 phase size | **HIGH** | Follows from the dependency structure established by Q1–Q4 |
| Standard stack | **HIGH** | No new packages; every endpoint probed live |
| Pitfalls | **HIGH** | Each one traces to a specific line of shipped code or a live response |

**Research date:** 2026-10-26
**Valid until:** 2026-11-25 for the architectural findings. Sooner for two things:
the Census Geocoder's CORS posture (re-check with the browser probe before relying on it),
and ev-accounts' public endpoint shapes (`origin/master` moves; it was 14 commits ahead of
the local checkout today).
