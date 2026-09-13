# ev-accounts — from Civic Spaces: township geoids, and the goals behind `city_geo_id`

**From:** Civic Spaces (`C:\Civic Spaces`), Phase 15 — tab-aware tool deep links
**Written:** 2026-09-12
**Audience:** whoever owns `connect.resolve_user_jurisdiction` and the boundary ingest
**Companion docs:** `TT-HANDOFF.md` (the Treasury Tracker exchange that raised this),
`15-DESIGN.md` (the consumer side)

**This note asks questions. It does not ask for work, and nothing in Civic Spaces is
blocked on the answers** — we have already decided to ship without township coverage. We
are asking because we are about to write down "townships are out of scope" as settled
platform behaviour, and we would rather record *your* reasoning than our inference.

---

## Context in one paragraph

Civic Spaces places a member into civic slices keyed on Census FIPS geoids, and Phase 15
adds sidebar rows that deep-link a member's own city/county/state into Essentials and
Treasury Tracker. The governing rule is **no real deep link, no row** — never a link to a
someone else's jurisdiction. Treasury Tracker is adding a geoid-keyed coverage catalog so
we can match. While specifying it, TT raised townships, and the trail led here.

## What we have already established — please don't re-derive this

We read the source rather than guessing, and TT queried the boundary table. Recorded so
you can skip straight to the questions:

- **`city_geo_id` is never a 10-digit MCD.** `connect.resolve_user_jurisdiction` fills the
  `city` slot from `mtfcc = 'G4110'` exclusively
  (`CC_0038_jurisdiction_city_state_nation.sql:131`), and all 6,008 G4110 boundaries are
  7-digit place FIPS. `CC_0039`'s column comment says so explicitly, including that NULL
  for an unincorporated address is *"a valid answer, not a failure."* We agree, and Civic
  Spaces already treats it that way — `sliceAssigner` skips the city level rather than
  failing the request (that guard exists because of Arden, NC).
- **The G4040 layer exists and is already queried** — 2,952 county-subdivision boundaries,
  all 10-digit, consulted for the `city_council` and `municipality` slots (`CC_0038:89`,
  `:105`) and for LOCAL/LOCAL_EXEC in `046_resolve_user_local_officials.sql:105`. The
  `city` slot's filter is simply narrower than the data.
- **G4040 covers four states: WI, IN, CA, MA. Michigan and Pennsylvania have zero rows** —
  and 99.6% of Treasury Tracker's 2,798 township entities are in exactly those two.
- **`municipality_geo_id` is not a substitute.** It resolves through a join to
  `essentials.districts` and returns `d.geo_id`, which is a composite districts-namespace
  id (`…/place:…`, `…/county:…`), not a bare Census FIPS. So it cannot key a FIPS-based
  coverage catalog the way `city_geo_id` can. We mention it only to head off the obvious
  suggestion.

The practical consequence: widening our side to accept 10-digit geoids today would surface
**11 Indiana townships and nothing else.** That is why we are not doing it.

## What we would like to understand

### 1. Is `city` = G4110-only a deliberate semantic, or the narrowest thing that worked?

There is a real argument that **a township is not a city**, and that a member in Perry
Township, Michigan should not be told they live in a "city" slice. If that is the
intended meaning, we will document townships as *correctly* having no city slice and stop
treating it as a gap. If it is instead incidental — G4110 was what the ingest had — then
it is a coverage question with a different shape.

`CC_0039`'s comment reads as deliberate to us, but it documents *what* the column is, not
*why* that boundary was chosen.

### 2. Is G4040 ingest for MI and PA planned, and why those four states today?

WI, IN, CA and MA is an unusual set — it does not look like "the first four alphabetically"
or "the biggest four". Knowing whether that reflects a pilot, a data-licensing constraint,
or just where the work stopped would tell us whether township coverage is months away or
years away. We are not requesting it; we are trying to decide whether to write "not
supported" or "not supported yet".

### 3. If MCDs are ever ingested, where would a township geoid live?

Two shapes, with quite different consequences for us:

- **`city_geo_id` widens** to hold a 7-digit place FIPS *or* a 10-digit MCD. Cheap for us —
  lengths are self-describing, so we branch on length. But it makes "city" mean two things.
- **A new key** (`subdivision_geo_id`, or similar) carrying the bare MCD. Cleaner
  semantically; costs us a new slice tier and a tab, which is a much larger piece of work.

Knowing which direction you would take means Phase 15's matcher can be structured now so
that day is additive rather than a rewrite.

### 4. The one Chris specifically wants you to answer: the goals behind the privacy posture

Chris's understanding, in his words, is that **we are protective of addresses with Connect
and Empowered accounts — preferring to give them a category rather than re-use their
address — and that this is not the case for an Inform account.** He also said, plainly,
that Accounts can explain the goals and aim behind that decision more fully than he can
right now. So this is an invitation to put the reasoning on the record, not a challenge to
it.

Specifically:

- **Is "a boundary geoid is a category, an address is not" the actual principle?** That is
  how `CC_0039` reads to us — *"The geocoded pair labels an address; the geoid pair
  addresses a boundary, and only the geoid pair can key a Civic Spaces slice."* If so, it
  is the cleanest statement of the rule we have found anywhere, and it deserves to live
  somewhere more discoverable than a migration header.
- **Does a finer boundary layer erode that?** A township is a smaller category than a
  county and often smaller than a place. At what point does "which boundary contains you"
  start to approximate "where you live"? If there is a floor below which you will not
  publish a slice, Civic Spaces should know it — we would rather design to the floor than
  discover it.
- **Please correct our model of the Inform tier.** Our note on the tiers is ~5 months old
  and says Inform is anonymous/unauthenticated with no identity and no contribution
  rights. Chris's framing suggests Inform accounts have addresses handled differently
  rather than absent. One of those is out of date and we do not know which.

## What Civic Spaces does regardless of the answers

Ships Phase 15 with Essentials rows, and Treasury rows once TT's catalog lands. Township
residents get no city row. Under "no match, no row" that is a missing row, never a wrong
link — which is the failure mode we care about and the one we have designed against.

Nothing here needs to be answered before we ship. Answers change what we *write down as
settled*, and whether §3 makes us structure the matcher differently now.

Questions back to Chris, or straight into this file.
