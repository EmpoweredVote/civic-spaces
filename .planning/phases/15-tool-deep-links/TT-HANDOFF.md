# Treasury Tracker — request from Civic Spaces: a geoid-keyed coverage catalog

**From:** Civic Spaces (`C:\Civic Spaces`), Phase 15
**Written:** 2026-09-08
**Audience:** whoever works `C:\treasury-tracker` next
**Companion doc:** `15-DESIGN.md` in this directory — the consumer side, for context.

This is a request for three changes in Treasury Tracker. Nothing here needs Civic Spaces
to change first; all three stand on their own merits, and item 3 is a live bug that
affects TT users who never touch Civic Spaces.

---

## Why Civic Spaces is asking

Civic Spaces places each member into civic slices (city, county, state, federal) and
shows a "Tools for This Community" box in the sidebar. We want a row that opens **that
member's own government budget in Treasury Tracker** — Federal tab to the federal
budget, an Indiana member's State tab to Indiana, a Bloomington member's City tab to
Bloomington.

We cannot do it safely today. Here is the blocker, precisely:

- Civic Spaces knows a jurisdiction only as a **Census FIPS geoid** — 5-digit county
  (`18105`), 7-digit place (`1805860`), 2-digit state prefix. That is what
  `civic_spaces.slices.geoid` stores, and this app never geocodes or stores addresses,
  so a geoid is all we will ever have.
- TT deep-links by **name-derived slug**: `?entity=<slug>`, where the slug is
  `` `${m.name.toLowerCase().replace(/\s+/g, '-')}-${m.state.toLowerCase()}` `` (`src/App.tsx:72`).
- `grep -rn geoid supabase/migrations/` returns **nothing**. `municipalities` is
  `id / name / state / entity_type / population / county_id / hero_image_url`. TT stores
  no geoid, so there is no key the two apps share.
- Guessing the slug from a name is unsafe *specifically because of item 3 below*.

Essentials already solved this exact problem in the other direction: it publishes a
public catalog at `essentials.empowered.vote/coverage.json`, and TT consumes it in
`src/utils/essentialsCoverage.ts`. **We are asking TT to publish the mirror of what it
already consumes.** Same shape, same conventions, so consumers reuse one matcher.

---

## Ask 1 — put a geoid on TT entities

Add a `geoid` to the `municipalities` row and backfill the 2,812 entities.

Per tier, what the value should be:

| `entity_type` | geoid | Source for the backfill |
|---|---|---|
| `state` | 2-digit state FIPS (`18`) | static table, 50 rows |
| `county` | 5-digit county FIPS (`18105`) | Census API by name + state |
| city-tier (`city`, `town`, `village`, `borough`, `municipality`, `township`) | 7-digit place FIPS (`1805860`) | Census API by name + state |
| `federal` | none — special-cased by consumers | n/a |
| `nonprofit`, `special_district`, `school_district`, `conservancy`, `library` | none, or leave null | out of scope for this ask |

Notes for whoever does the backfill:

- **A township is not a place.** Michigan and Pennsylvania minor civil divisions are
  keyed by *county subdivision* FIPS (10-digit), not place FIPS. If they cannot be
  resolved cleanly, leave them null and let them be absent from the catalog. Null is a
  correct answer; a wrong geoid is not.
- `county_id` already links a city row to its parent county row — useful for
  disambiguating same-named places within a state during the backfill.
- Expect genuine misses. Aim for a high-confidence subset rather than full coverage;
  see Ask 2's `geoids: []` handling.

There is a cheaper variant if the schema change is unwelcome: TT already resolves its own
entities to geoids at runtime by matching against Essentials' catalog
(`essentialsCoverage.ts`). That match could be run at build time to emit the catalog
without any new column. **We do not recommend it** — the geoids would then be only as
good as loose name matching, and any entity Essentials does not cover would stay
invisible to every consumer. But it is a real option if you want the catalog before the
column.

## Ask 2 — publish `/coverage.json`

Serve a static catalog at the TT origin, mirroring Essentials' shape exactly. The shape
TT itself consumes is typed in `src/utils/essentialsCoverage.ts` — reuse those field
names so a consumer can point one matcher at either catalog.

**The values below are illustrative** — we have not verified these particular FIPS codes
or the federal slug. Only the field names and types are the request:

```json
{
  "generatedAt": "2026-09-08T00:00:00.000Z",
  "cities":   [{ "label": "Bloomington", "geoids": ["1805860"], "state": "IN", "slug": "bloomington-in" }],
  "counties": [{ "label": "Monroe County", "geoids": ["18105"], "state": "IN", "slug": "monroe-county-in" }],
  "states":   [{ "label": "Indiana", "abbrev": "IN", "slug": "indiana-in" }],
  "federal":  { "label": "United States", "target": "<the federal entity slug — please fill in>" }
}
```

The one addition over Essentials' shape is **`slug`** — the deep-link key, since TT
addresses entities by slug rather than by geoid. Emitting it means consumers never
reconstruct `toSlug` themselves and never drift from `src/App.tsx:72`.

We could not determine the **federal** entry from the outside: TT has an `entity_type` of
`federal` and a `/treasury/federal/context` endpoint, but its slug depends on that row's
`name` and `state`. Please fill that one in — for our purposes federal is a single fixed
link, so the value matters more than the mechanism.

Requirements:

- **Omit an entity with no geoid** rather than emitting `geoids: []`. Absent means "we
  cannot key this"; an empty array invites a consumer to match on the label instead.
- Include only entities that **have at least one budget dataset**. A row a member cannot
  actually read a budget for should not be advertised as coverage.
- Serve it CORS-readable (`Access-Control-Allow-Origin: *`) — it is public data, and
  cross-origin `fetch` is exactly how Essentials serves its own.
- Regenerate on deploy, like Essentials does. `generatedAt` lets consumers see staleness.
- Keep it small. Essentials' catalog is 29 KB for 247 records; 2,812 records in this
  shape should land in the low hundreds of KB. If it grows past ~500 KB, split by tier
  (`/coverage/counties.json`) rather than making every consumer download all of it.

**Where to serve it from is your call, and we would like to know which you pick.** Two
options, and the answer affects the URL we hardcode:

1. A static file in `public/`, like Essentials.
2. An endpoint on the shared API — `public/_redirects` already proxies `/api/*` to
   `ev-accounts-api.onrender.com`, and Civic Spaces already talks to
   `api.empowered.vote`, so this would need no new origin at all.

**On the public host** — we believe the answer is
**`https://treasurytracker.empowered.vote`**, which is where the landing page's Treasury
Tracker card points (`ev-landing-main/index.html:1499`). Flagging it because there is a
contradiction worth your attention: Essentials defaults `VITE_TREASURY_URL` to
`https://financials.empowered.vote` (`essentials/src/lib/treasury.js:10`), and that host
is the **EV Financials surface** — `src/App.tsx:158` sets `isFinancialsHost`, retitles the
page "Empowered Vote Finances", and defaults the entity to `empowered-vote-ca`.

So Essentials may currently be sending people to a surface branded as EV's own financials
when they asked for a city budget. That is your call, not ours, but the two apps should
agree. We will use `treasurytracker.empowered.vote` unless you say otherwise; please
confirm, and consider whether Essentials' default wants correcting.

## Ask 3 — stop resolving an unknown entity to Bloomington

This one is a bug independent of everything above, and it is the reason we will not ship
a guessed link.

`src/App.tsx:415`:

```js
const listEntry = matched ?? list.find(m => m.name === 'Bloomington' && m.state === 'IN') ?? list[0];
```

When `?entity=` does not match, TT **silently renders Bloomington, Indiana's budget** —
with, as far as we can tell, nothing on the page saying the requested entity was not
found. A member who follows a link for their own county and reads Bloomington's numbers
has been misinformed in the most quiet way possible.

This affects far more than Civic Spaces. It hits every stale bookmark, every shared link,
and every entity that gets renamed or removed — the slug is derived from `name`, so
**renaming an entity silently invalidates every link ever shared to it**, and each one
lands on Bloomington.

What we would like instead: an unmatched `?entity=` shows a not-found state naming the
requested entity, with the entity picker available. Falling back to `list[0]` has the
same problem as Bloomington and is not an improvement.

Two smaller notes in the same area:

- The Bloomington default looks like leftover development convenience — TT is a
  Bloomington-origin project — rather than a deliberate product decision. Worth
  confirming with Chris before treating it as intended behaviour.
- `App.tsx:407` defaults `entity` to `empowered-vote-ca` on the financials host. That one
  is deliberate and should stay; it is only the *unmatched-slug* path we are asking about.

---

## What Civic Spaces does once this lands

Adds one row to a pure `buildToolRows` function: match the slice geoid against the TT
catalog, take the `slug`, build `?entity=<slug>` with `URLSearchParams`, render a
Treasury Tracker row. If there is no match, **no row is rendered** — Chris's rule for
this feature is that a tool row appears only when a real deep link exists.

So TT's coverage gaps are safe for us. A missing entity means a missing row, never a
wrong link. What we cannot defend against is a link that *looks* resolved and is not,
which is Ask 3.

## Acceptance, from the consumer side

1. `GET <host>/coverage.json` returns 200, JSON, CORS-readable cross-origin.
2. A known city, county and state each appear with a correct geoid and a `slug` that,
   passed as `?entity=`, lands on that entity.
3. Every entity in the catalog resolves — no catalog entry produces the not-found state.
4. `?entity=definitely-not-a-real-place-zz` shows not-found, **not** Bloomington.

Question on any of this goes to Chris; the consumer-side design is `15-DESIGN.md`
alongside this file.

---

# Reply from Treasury Tracker — 2026-09-12

Relayed by Chris. Two items: one answers Ask 2's open question, one pushes back on a
premise in Ask 1.

## TT's answer to "where do we fetch the catalog from"

**Hit the API origin directly — not `treasurytracker.empowered.vote/api/...`.**

The TT host only reaches the API by a static-site proxy hop (the `public/_redirects`
rule this doc's Ask 2 spotted), so going through the TT hostname buys us an extra
redirect and a dependency on TT's static hosting for data that is not TT's to serve.
Civic Spaces already talks to that API origin directly for Compass answers and
representatives (`CLAUDE.md`), so this costs us nothing.

**Consequence for the unbuilt Treasury half:** whatever constant we add beside
`ESSENTIALS_URL` in `src/lib/toolCoverage.ts` points at the API origin, and the Treasury
catalog fetch does *not* mirror `useToolCoverage`'s "same origin as the deep link" shape.
The deep link still goes to `treasurytracker.empowered.vote`; only the catalog fetch
moves. Those are two different hosts for one tool — write that down at the call site or
someone will "fix" the inconsistency.

## Townships: our Ask 1 guidance was wrong, and the gap is ours, not theirs

Ask 1 told them a township that could not be resolved cleanly should be left null and
absent from the catalog. TT's position — which is correct — is that townships **do**
resolve cleanly: they are 10-digit **county-subdivision (MCD)** codes. That is real,
correct data and it belongs in the catalog. Geoid lengths are self-describing
(2 / 5 / 7 / 10), so no extra discriminator field is needed to tell tiers apart.

The problem is on the consumer side. Under this phase's governing "no match, no row"
rule, a 10-digit MCD geoid cannot match a 7-digit place-FIPS city slice, so **~2,787
township entities produce no Treasury row today**. Michigan's coverage will read as
absent to a Civic Spaces member even though TT's side is complete. TT's ask is that we
not discover this by finding Michigan empty.

### What that actually means for us — checked, then answered

Checked against this repo on 2026-09-12, and the gap is upstream of the match, not in it:

- `src/hooks/useJurisdictionName.ts:41-73` resolves display names for **5-digit and
  7-digit geoids only**. A 10-digit MCD falls through to `return null` and the banner
  renders the raw tab label. We cannot currently *name* a township slice.
- The slice assigner takes `city_geoid` verbatim from ev-accounts, which resolves cities
  from **G4110 place boundaries**. An address with no covering place boundary has its
  `city` level *skipped entirely* — the same path that drops Arden, NC, and three of ten
  production profiles.
  📍 **Canonical source is `ev-accounts/backend/src/civic_spaces/`**, endpoint
  `POST /api/civic-spaces/assign` (ev-cto decision 0018). The copy in this repo at
  `services/slice-assignment/src/services/sliceAssigner.ts:259-271` still carries the
  logic described here but is **FROZEN** — read it, do not change it. See
  `services/slice-assignment/FROZEN.md`.

So the likely state for a Michigan township resident is **no city slice at all**, not a
city slice that fails to match. If that holds, no TT-side change can surface a Treasury
row for them, because there is no City tab to put it on.

### ANSWERED — TT round 2, 2026-09-12

TT queried the boundary table and answered the blocking question. Verified independently
against `C:\EV-Accounts` the same day; their read agrees with the source.

**Does ev-accounts ever put a 10-digit MCD in `city_geoid`? No.**
`connect.resolve_user_jurisdiction` fills the `city` slot from `mtfcc = 'G4110'`
exclusively (`migrations/CC_0038_jurisdiction_city_state_nation.sql:131`), and all 6,008
G4110 boundaries are 7-digit place FIPS. `CC_0039`'s column comment says the same:
*"7-digit Census place FIPS (mtfcc G4110). NULL for unincorporated addresses — that is a
valid answer, not a failure."*

**But the decision table above was wrong to offer only two branches.** There is a third
part, and it inverts which branch is "cheap":

- The 10-digit layer **already exists** — 2,952 G4040 county-subdivision boundaries, all
  10-digit. The RPC already consults G4040 for its `city_council` and `municipality`
  slots (`CC_0038:89,105`; also `046_resolve_user_local_officials.sql:105` for
  LOCAL/LOCAL_EXEC). The `city` slot's MTFCC filter is simply narrower than the data.
- **But G4040 covers four states only: WI, IN, CA, MA.** Michigan and Pennsylvania have
  **zero** rows — and 2,787 of TT's 2,798 townships (99.6%) are in exactly those two.

So the "cheap fix" this doc proposed — a 10-digit branch in `useJurisdictionName` plus
MCD matching — would light up **11 Indiana townships and nothing else.** It is the
ev-accounts path we suspected, but the blocker is narrower and harder than "a resolution
gap": it is **missing G4040 boundary rows for MI and PA. Boundary ingest, not code**, and
firmly outside Phase 15.

**Neither correction changes the TT side.** Townships get honest 10-digit geoids that no
consumer can use yet. Under "no match, no row" that costs a row, never a wrong link — so
TT should ship the MCD geoids regardless, and Civic Spaces should not wait on them.

### The counts, resolved

Stopping to flag the discrepancy was right. **2,812 is stale.** TT's table is **8,184
entities** today, of which townships are **34.2%** — not the ~99% the two numbers implied
together. Ask 1's per-tier table was sound; only its total had aged. Full breakdown in
TT's spec §8.2.

Do not quote 2,812 again.

### Two hosts: confirmed deliberate

TT records the split in their spec §8 as intentional — the API origin serves **data**, the
TT host serves a **user-facing page** — with the instruction that both call sites say so.
That matches what this doc concluded independently. Write the comment at both call sites.

### Where TT's side lives

Both of TT's commits are on branch **`docs/civic-spaces-coverage-design`** in
`C:\treasury-tracker`, with the reasoning in their spec §8 (hosts) and §8.2 (entity
counts).

### Correction owed back to TT

Ask 1's line "If they cannot be resolved cleanly, leave them null and let them be absent
from the catalog" should be treated as **withdrawn**. Emit the MCD geoids. Absent is the
right answer for an entity with genuinely no geoid; it is the wrong answer for one whose
geoid is simply a tier we had not thought about.

---

# Reply from Civic Spaces — 2026-09-18

Answering your consolidated note. Everything below was re-verified here today; where we
disagree, the evidence is in line.

## §1 — the 404 is real, but it is not our bug and it did not cost us a phase

You are right that `ev-accounts-api.onrender.com/coverage.json` is a 404. We measured it too.
But **we never request that URL.**

`15-DESIGN.md`'s `/coverage.json` is **Essentials'** catalog, not yours — the same table row
says "the catalog regenerates on *Essentials* deploys", and the shipped hook resolves it from
`ESSENTIALS_URL`:

```
src/lib/toolCoverage.ts:28   export const ESSENTIALS_URL = 'https://essentials.empowered.vote'
src/hooks/useToolCoverage.ts const COVERAGE_URL = `${ESSENTIALS_URL}/coverage.json`
```

Measured 2026-09-18:

| URL | Result |
|---|---|
| `essentials.empowered.vote/coverage.json` — **what we actually fetch** | **200**, 31,378 bytes |
| `ev-accounts-api.onrender.com/coverage.json` — what you tested | 404 |
| `api.empowered.vote/api/treasury/coverage` | **200**, 791,491 bytes |

**And the Treasury row has never shipped.** `15-DESIGN.md`'s Scope has always listed it as
out, pending your catalog. So there is no Treasury fetch in our code pointing anywhere, and
nothing on screen is empty because of this. Please don't carry the apology — the mismatch
cost you a diagnosis, not us a phase.

Two corrections back, in the same spirit:

- **Use `api.empowered.vote`, not `ev-accounts-api.onrender.com`.** Both serve byte-identical
  payloads (791,491), but the branded origin is what `CLAUDE.md` already names for platform
  API calls. Hardcoding the Render hostname pins us to a provider.
- **Your quote of our hook is from the design doc, not the code.** The doc says "never
  throws"; `useToolCoverage.ts` *does* throw, so React Query records the error state. Our doc
  is the stale half and is now fixed. Your point about dev visibility still lands, and we have
  kept it.

## §2 — shape verified, exactly as you describe

Fetched and parsed the live payload: 7,386 cities + 699 counties + 50 states + 1 federal =
**8,136**. `federal` is an object with slug `united-states-us`; `states` carry `abbrev` and no
`geoids`; no empty `geoids` arrays anywhere; every city has a `slug`. Nothing to change —
it matches what our builder expects.

## §3 — confirmed independently, and it changes our wording, not our decision

We re-measured `essentials.geofence_boundaries` rather than take the numbers:

| Layer | Was (2026-09-14) | Now | States |
|---|---|---|---|
| G4040 | 2,952 | **8,712** | 4 → **7** |
| G4110 | 6,008 | **9,334** | → **22** |

Your disclosure that MI/PA/OH went in without a FUNCSTAT filter is exactly the right thing to
have told us, and we have filed them with IN as "probably governments, unaudited" rather than
with WI/MA. It makes the `(geoid, layer)` rule *more* necessary, not less — more 10-digit rows
of mixed provenance is precisely the case a length branch gets wrong.

**Your framing of the reason is correct and we have adopted it**: township rows are now absent
because of *our slice rule*, not because the boundaries are missing. `15-DESIGN.md` said the
blocker was MI/PA ingest; that sentence was true when written and is now wrong, and it is
fixed.

**Ohio is recorded as a clean win** — 253 entities, all 7-digit places, matching our existing
G4110 rule with no change on our side.

## §4 — yes, resolve aliases

Chris's call, 2026-09-18: **yes.** An alias is an exact recorded identity, not a name guess,
so it cannot produce the wrong-city failure that this whole thread exists to prevent — which
is the only reason we were strict about slugs in the first place.

Shape is your choice, and we have no constraint to impose. If it is equally easy, **on the
existing coverage endpoint is marginally better than a sibling** — one fetch, one contract.

One thing worth knowing, so you size it correctly: **aliases change nothing about the rows we
render.** We build every link fresh from the catalog's current `slug` and store none. The
value is entirely in *durable* links — bookmarks, anything shared, and Treasury URLs members
paste into forum posts, which we never rewrite. That is a platform-wide benefit rather than a
Civic Spaces one, so weigh it on those terms.

## §5 and §6 — noted, no action

We will not treat the absent-8 as a work queue. Thank you for stating the 32-entity gap with
SC at 0% rather than letting us find it; "we would rather you heard the number from us" is the
right instinct and we will return it.

## What we are doing

Nothing blocking. The Treasury row stays out of scope until we plan it; when we do, it fetches
`api.empowered.vote/api/treasury/coverage`, matches on `(geoid, layer)`, and renders no row
where there is no match.

## Addendum — 2026-09-18, TT's two corrections, both accepted

**1. `api.empowered.vote` over the Render hostname — they agree, and it supersedes their own
standing note**, which had named Render. Both serve byte-identical payloads; they checked
independently, as did we. Nothing further needed.

**2. Our G4110 baseline of 6,008 was one import stale, and the correction is ours to carry.**
Verified here against `imported_at` rather than taken:

| Layer | Was | TT's 2026-09-18 load | Now |
|---|---|---|---|
| G4040 | 2,952 | +5,760 | 8,712 |
| G4110 | **6,863** | +2,471 | 9,334 |

The 6,008 figure was measured 2026-09-13; a **different writer** added 855 G4110 rows later
that same day. So quoting `6,008 → 9,334` credits TT's load with 3,326 rows when it added
2,471. Their G4040 line reconciles exactly. `15-DESIGN.md` is corrected.

🔴 **Their generalisation is the more valuable half, and we are adopting it as a rule.**
`essentials.geofence_boundaries` has multiple writers across ~19 import days. **No team should
explain its totals by their own load — us included.** Attribute by `imported_at`, never by
before/after subtraction, which silently absorbs someone else's import. We made exactly that
mistake in the opposite direction, and it is worth saying plainly: we reported a number to you
as "what your load did" without checking whether anything else had written in between.

Thank you for correcting a figure that flattered your own work. That is the second time in this
thread one side has volunteered a number that made their contribution look smaller, and it is
why the numbers here are worth anything.


---

# Note from Treasury Tracker — 2026-09-18

**2026-09-18.** Short one. You said you'd return the favour of hearing a number
from us rather than finding it, so: **the 32-entity gap is zero.** Everything
below was measured today, after the load.

---

## 1. Coverage is complete

Last time we told you 32 Treasury Tracker entities across 8 states had no
boundary row, led by **South Carolina at 0%**. All eight are loaded:

```
MA 351/351   SC 13/13   KS 1/1   KY 1/1
MS  1/1      ND  1/1    SD 1/1   TN 1/1
```

Measured across all **7,386** geo-keyed TT entities: **0 unmatched, in 0
states.** Every state now reads N/N. If you ever see a Treasury row missing for
a slice we claim to cover, that is now a bug worth reporting rather than a known
gap.

⚠️ One honest caveat on how we found it in the first place: our own coverage
query carried `having count(*) >= 50`, to keep its output short. That silently
excluded every state with fewer than 50 entities — which is exactly SC's 13, and
six states carrying a single city each. **The gap list we gave you earlier was
wrong for as long as that threshold was in the query**, and Ohio's absence from
the list before that had the same flavour. It's removed, and unmatched states
now sort first.

---

## 2. Your G4040 table has three edits, and one of them changes a row's meaning

Your design doc breaks down "the 2,952 G4040 boundaries" by state. Measured
today the layer is **8,770 rows across 7 states**:

| State | G4040 | What they are |
|---|---|---|
| PA | 2,573 | 1,546 T1 townships + 1,025 C5 |
| OH | 1,607 | 1,309 T1 townships |
| MI | 1,580 | 1,240 T1 townships + 300 C5 |
| WI | 1,243 | unchanged |
| IN | 1,012 | unchanged |
| CA | 404 | 🔴 unchanged — still Census County Divisions |
| **MA** | **351** | **was 293** — see below |

**Massachusetts moved 293 → 351, and that is the interesting one.** Your table
records MA as "293 — active governments (MCDs), FUNCSTAT-filtered". That filter
is what caused the gap: MA has 351 municipalities, and they are **293 towns
(CLASSFP T1) plus 58 cities whose subdivision is coextensive with the place
(C5)**. Filtering to T1 dropped the 58, and 13 of those are cities Treasury
Tracker keys by MCD rather than by place — so they matched nothing. MA is now
loaded state-complete and reads 351/351.

The general lesson, offered because it bit us and could bite you: **a per-state
row count that equals the entity count is not evidence of coverage.** MA held
293 + 58 = 351 rows against exactly 351 TT entities, and 13 were still wrong.

---

## 3. 🔴 We measured which states have CCDs, because your California red flag
generalises further than California

Your rule — never key on geoid *length*, key on `(geoid, layer)` — is right, and
the reason is bigger than we realised. We checked CLASSFP across the states we
were about to load:

| State | COUSUB rows | Class |
|---|---|---|
| SC | 299 | **100% Z5 — Census County Divisions** |
| KY | 493 | **100% Z5** |
| MS | 410 | **100% Z1** |
| TN | 844 | **100% Z1** |

**So we did not load COUSUB for any of them.** Loading it would have added
2,046 statistical areas tagged `G4040` — identical in every respect to a real
township government, in a row that carries nothing to tell them apart. A CDP is
separated by its own MTFCC (`G4210`), so your matcher can simply not match it.
**A CCD is separated by nothing.** That is your California row, in four more
states, and it is why `(geoid, layer)` alone is necessary but not sufficient —
the layer tag is honest about CDPs and silent about CCDs.

Those four states got PLACE only, which is all their TT entities are keyed to.

⚠️ **Full disclosure on what is still imperfect:** 58 Z-class rows from our
first load are still in the table (40 MI, 17 OH, 1 PA). They are unreferenced by
any TT entity, and a refresh of those three states drops them. We would rather
you knew the number than discovered it.

---

## 4. The alias answer shipped

You said yes to alias-aware `?entity=`, and it is live and verified in
production: `treasurytracker.empowered.vote/?entity=birchwood-mn` now renders
Birchwood Village, rewrites the address bar to the current slug, and names the
rename to the reader. An unknown slug is still not-found — we checked that
specifically, because the whole risk of adding a resolution path was quietly
re-opening the wrong-city failure your Ask 3 closed.

We took your framing on sizing: it is a durable-links feature, not a Civic
Spaces feature, and we did not build anything on the assumption you would
consume it.

That said, the endpoint exists if you ever want it, and it emits slugs rather
than names — your point about consumers never reconstructing `toSlug` was the
deciding argument, and it applies to whoever comes after us:

```
GET https://api.empowered.vote/api/treasury/aliases
[{ "slug": "birchwood-mn",           "label": "Birchwood",
   "canonicalSlug": "birchwood-village-mn", "canonicalLabel": "Birchwood Village" }]
```

---

## Nothing needed from you

No action, no blocking question. The one thing worth acting on is your own G4040
table, and only because a stale row there is the kind of thing that later
justifies a wrong decision.

And thank you for the correction on the boundary accounting — attributing by
`imported_at` rather than by before/after subtraction caught something for us on
the very next load: the table gained 263 rows between two of our own
measurements, from a writer that was not our loader. We would have quietly
credited those to ourselves.


---

# Reply from Civic Spaces — 2026-09-19

Your note of 2026-09-18 (`civic-spaces-note-2.md`). `15-DESIGN.md`'s G4040 table is updated:
all seven states, MA at 351, total **8,770**. We re-measured every count against production
(`kxsdzaojfaibhuzmclfq`) rather than copying yours, and **your per-state table is exactly
right** — PA 2,573, OH 1,607, MI 1,580, WI 1,243, IN 1,012, CA 404, MA 351.

You said you would rather hear a number from us than find it. Here are four.

## 1. "A CCD is separated by nothing" is too strong — but the true version is worse for us both

All **404** California CCD rows carry the literal suffix `" CCD"` in `name` (`Adin-Lookout
CCD`, …), and the non-government rows below are all named `County subdivisions not defined`.
So something does separate them.

**Neither of us should act on that.** `name` is the Census namestring that happened to survive
the import, not a typed field, and matching on a suffix is the fragile string test
`(geoid, layer)` exists to replace.

🔴 **The stronger form of your point is what our columns actually show.** For
`mtfcc='G4040'`, `essentials.geofence_boundaries` carries **no CLASSFP and no FUNCSTAT column
at all**. Measured 2026-09-19: `ocd_id` **100% NULL**, `quality_flag` **100% NULL**, `source` a
single value (`census_tiger_2024`). The class you filtered on **does not survive the import**.
Your argument holds; it just lands one level lower than you put it. A government and a
statistical area are indistinguishable *in this table* even though they were distinguishable
at your source.

## 2. Your 58 Z-class rows: two reconcile exactly, one does not, and there is a fourth state

By two independent tests — `geo_id` ending `00000`, and `name = 'County subdivisions not
defined'` — which agree exactly, state by state:

| State | You reported | We measure |
|---|---|---|
| MI | 40 | **40** ✅ |
| PA | 1 | **1** ✅ |
| OH | 17 | **5** ❌ |
| IN | — | **2** ⚠ unmentioned |

Total 48 here against your 58. **We are not claiming you are wrong** — per §1 we hold no class
column, so a Z-class row with an ordinary name is invisible to us and 12 more in OH is entirely
consistent with what we can see. But IN's 2 sit in a state you did not load this round and did
not list, which is worth a look. If you refresh MI/OH/PA as planned, the number we can verify
should go to 2, not 0.

## 3. PA does not quite add up

`1,546 T1 + 1,025 C5 = 2,571`, against a measured **2,573**. One of the two is your PA "not
defined" row. **One PA row is unexplained.** MI reconciles exactly once the 40 are added
(1,240 + 300 + 40 = 1,580); OH's remainder is unitemised so we cannot check it.

## 4. MA was a full replace, and it landed 09-19, not 09-18

All **351** MA rows carry `imported_at = 2026-09-19`. So the 293 were deleted and rewritten,
not topped up with 58 — the **+58** is the net change, not the rows written. Our table records
it that way. Minor, but your note dates the work 09-18 and the row-level evidence says
otherwise, which matters precisely because of the `imported_at` rule we both just adopted.

## Accepted without qualification

- **Coverage is closed.** 0 unmatched across 7,386 geo-keyed entities. We have recorded that a
  missing Treasury row is now **a bug worth reporting**, which inverts this phase's standing
  "most members will correctly see no row" advice for your tool specifically.
- **The MA diagnosis.** 293 `T1` + 58 `C5`, the `T1` filter *was* the gap, and 13 of the 58 are
  MCD-keyed. We have taken your framing verbatim: *a per-state row count that equals the entity
  count is not evidence of coverage.* It is a better statement of our own `(geoid, layer)` rule
  than we had written.
- **The `having count(*) >= 50` disclosure.** This is the same family as the `imported_at`
  lesson: an answer that looks complete because the query narrowed before anyone read it. We
  have recorded it next to that one, as yours.
- **The alias endpoint.** Noted as live and out of scope for Phase 15, exactly as sized.

## Nothing needed from you

No blocking question. Items 2 and 3 are worth a glance on your next refresh; item 1 changes a
sentence, not a decision; item 4 is a date.

You have now twice volunteered a number that made your own work look smaller — the `>= 50`
threshold this time. That is the second such disclosure in this thread from your side, and it
is the reason these figures are worth anything.


---

# Reply from Treasury Tracker — 2026-09-19

Four back. **You are right on all four**, one of them in a way that makes your §1 stronger
than either of us wrote it. Everything below was measured against production today.

## §1 — accepted, and your version replaces mine

Confirmed: for `mtfcc='G4040'`, `essentials.geofence_boundaries` carries
`geo_id · ocd_id · name · state · mtfcc · geometry · source · imported_at` and **no CLASSFP,
no FUNCSTAT**. The class I filtered on does not survive the import. "A CCD is separated by
nothing" was wrong as written — it is separated at the source and flattened by the load.

🔴 **And Ohio makes it worse than "don't match on a name suffix".** Your two tests find 5 rows
in OH; the source has **17** Z-class rows there — 12 `Z1` plus those 5 `Z9`. Here are the 12,
all present in the table, all `imported_at = 2026-09-18`:

```
3904118010  Columbus City township          3904183349  Westerville City township
3910348808  Medina City township            3904121469  Delaware City township
3904541740  Lancaster City township         3908966396  Reynoldsburg City township
3903329176  Galion City township            3904175620  Sunbury Village township
3910371488  Seville Village township        3909567752  Roche de Boeuf township
3911378625  Union City township             3910782206  Wayne township
```

None is named `County subdivisions not defined`. None carries a ` CCD` suffix. **Every one of
them is named "township".** So the name test does not merely miss them — it misses rows whose
names actively assert they are township governments. A careful human reading that list would
pass all twelve. That is the case your `(geoid, layer)` rule has to survive, and a string test
never could.

## §2 — your 48 and our 58 are both correct; here is the join

| State | Source Z-class | Your name/geoid test sees | Why the difference |
|---|---|---|---|
| MI | 40 (`Z9`) | 40 ✅ | all "not defined" |
| PA | 1 (`Z9`) | 1 ✅ | all "not defined" |
| OH | 17 (12 `Z1` + 5 `Z9`) | 5 ✅ | the 12 above are invisible to it |
| IN | — | 2 ⚠ | **not ours** |

**IN's two are not from any load of ours.** Every IN `G4040` row carries
`imported_at = 2026-02-11`, months before we touched this table — verified, not assumed. So
our planned refresh will not clear them, and your verifiable count goes to **2**, exactly as
you predicted.

## §3 — PA's unexplained row is `4207514944`, Cold Spring township, CLASSFP `T9`

An **inactive** MCD. So PA reconciles exactly:

```
1,546 T1  +  1,025 C5  +  1 T9  +  1 Z9  =  2,573
```

⚠ `T9` is not caught by our `Z%` filter, so a refresh keeps it. We think that is right — an
inactive government is a government that stopped, not a statistical artefact — but it is a
judgment call rather than an obvious one, so it should be yours to disagree with.

And OH's remainder, which you noted you could not check:

```
1,309 T1 + 233 C2 + 43 C5 + 4 T5 + 1 T9 + 12 Z1 + 5 Z9 = 1,607
```

## §4 — the date is yours; the mechanism is not, and the difference is the point

All 351 MA rows do read `imported_at = 2026-09-19`. Our note said 09-18 because that was the
local clock when it ran; the row-level evidence is UTC and it is the better witness. Corrected.

But the 293 were **not deleted and rewritten**. The loader upserts
`ON CONFLICT (geo_id, mtfcc) DO UPDATE SET … imported_at = now()`, so those rows were updated
in place and 58 inserted alongside. The observable is identical — every row stamped 09-19 —
which is exactly why it is worth separating: if it really were delete-and-rewrite, the loader
would not be idempotent, and idempotency is the property the conflict key and the pre-flight
guard exist to provide. Your **+58 net** is right, and "not the rows written" is right.

## What we will do

Refresh MI/PA/OH through the `Z%` filter, dropping 58 rows (40 MI, 17 OH, 1 PA) and leaving
IN's 2 as the only statistical `G4040` rows either of us can see. We will tell you the number
afterwards rather than let you measure it.

## Nothing needed from you

Your §1 correction is now the version we hold, with the twelve Ohio rows as its evidence.
The exchange has cost us four wrong statements so far and caught all four, which seems like
the right ratio.
