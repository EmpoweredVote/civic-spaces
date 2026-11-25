# Geo-overlap cache expires hourly on static geometry, so most real members pay a 3–7s cold recompute

> **This is an ev-accounts finding, kept here because Civic Spaces is where it was measured and
> where it hurts.** Written 2026-11-24 and delivered to EmpoweredVote/ev-accounts the same day;
> they confirmed they are fixing it. The code citations are `ev-accounts` `origin/master` at
> `b59105c3f` and will drift once that fix lands — re-read the file before trusting a line
> number. Nothing in this repo changes as a result; see
> `project_overlap_cache_cold_path` in the session memory index for the short version.

**Where:** `backend/src/lib/essentialsBrowseService.ts` → `resolveOverlappingGeoPairs`
**Affects:** `POST /api/essentials/browse/elections-by-area` **and** `POST /api/essentials/browse/by-area` (they share the step)
**Measured against:** `api.empowered.vote`, 2026-11-23 / 2026-11-24, `origin/master` at `b59105c3f`
**Reported from:** Civic Spaces, where this is the single slowest call in a member's app boot

---

## What a member sees

A Civic Spaces member loaded the app and waited 20–30 seconds. The slowest server call in
that boot was `POST /api/essentials/browse/elections-by-area` at **7,199 ms** (production
request log, 2026-11-23 05:31:55 UTC, real Chrome on Windows).

It is not a payload problem and not a Cloudflare problem. It is a **cache miss on a key that
expires every hour**, holding a value that is a pure function of static geometry.

## Root cause

`resolveOverlappingGeoPairs` caches its result in Redis:

| | |
|---|---|
| key | `` `overlap:v2:${seeds…sorted.join(',')}` `` — `essentialsBrowseService.ts:163` |
| read | `essentialsBrowseService.ts:167` |
| write | `essentialsBrowseService.ts:234` |
| TTL | `OVERLAP_CACHE_TTL_SECONDS = 3600` — `essentialsBrowseService.ts:23` |

Two properties of that cache are what make this hurt:

1. **Nothing warms it.** The service is the only writer, so the first request for an area after
   expiry pays the full PostGIS recompute.
2. **Nothing invalidates it.** The only `cache.del` calls in the backend are
   `slug_reservation:${userId}` (`empowerService.ts:346`) and `roles:uid:${userId}`
   (`roleService.ts:138`). So the 1-hour expiry *is* the invalidation mechanism — which is
   exactly why it can't simply be raised. More on that below.

The overlap pairs are a deterministic function of `essentials.geofence_boundaries` geometry.
That geometry changes when a migration ingests boundaries — a handful of times a year, not
hourly. So the current design throws away, every hour, an answer that can only ever be
recomputed to the same value.

## Why the TTL almost never helps a real member

A 1-hour TTL only pays off if *someone* asked about your area in the last hour. At current
traffic, nobody has.

In a 39-hour window of production request logs (100 most recent calls to this path), **only 9
were from a real browser.** The rest were CI's HeadlessChrome and diagnostic `curl`:

| client | n | mean | max |
|---|---|---|---|
| real browser | 9 | 1,194 ms | **7,199 ms** |
| headless (CI) | 77 | 180 ms | 5,233 ms |
| curl (diagnostic) | 14 | 1,441 ms | 6,671 ms |

The distribution is **bimodal**, which is the signature of a cache rather than of load or
payload size — 85 of 100 calls under 250 ms, then a cliff straight to a 2.7–7.2 s tail with
almost nothing between:

```
  <250ms   85
  250-500   5
  0.5-1s    1
  1-2s      3
  2-4s      1
  >=4s      5
```

The fast 85% is largely automated traffic keeping keys warm for itself. Real arrivals are
sparse and land on cold keys.

## Evidence that the cost is in the overlap step, not the elections query

`elections-by-area` does two things: `getOverlappingGeoIdsForArea` (`essentialsBrowse.ts:129`)
then `getElectionsByGeoIds` (`essentialsBrowse.ts:136`). `by-area` shares only the first. So
warming one endpoint and then timing the *other* isolates which half costs:

| state | first call | then the other endpoint, **first ever** |
|---|---|---|
| NY (36) | `by-area` **4.14 s** | `elections-by-area` **0.33 s** |
| OH (39) | `elections-by-area` **2.95 s** | `by-area` **0.63 s** |

Whichever endpoint touches an area first pays, and the second is fast in **both directions**.
That places the cost in the shared overlap resolution.

**Payload size is a red herring:**

- CA state returned a byte-identical 458,626 B in **6.83 s**, then **0.40 s**.
- TX state cold (123,464 B) took **5.28 s** — slower than CA *warm* at 4× the payload.
- `cf-cache-status: DYNAMIC` on every response, so none of the warmth is CDN.

## Cold cost tracks seed polygon size

| state | city | county | state |
|---|---|---|---|
| WA | Seattle 0.67 s | King 1.42 s | **1.54 s** |
| MD | Baltimore 0.46 s | Baltimore Co. 0.64 s | **2.46 s** |

Large states are worse: **CA 6.83 s**, **TX 5.28 s**, **NC 4.22 s**, **OH 2.95 s**.

This matters to Civic Spaces specifically, because it asks for **state** areas by design: the
State tab asks directly, and `electionAreaFor` falls back to the member's state for the
Federal, Unified and Volunteer tabs. There is no mitigation available on the client side —
the expensive shape is the one the product needs.

## One claim NOT confirmed

My reading is that **branch 3** of the UNION (`essentialsBrowseService.ts:208`) is the
expensive one. It is the only branch running `ST_Intersects` + `NOT ST_Touches` +
`ST_Area(ST_Intersection(...))` (`:227`), none of which an index can accelerate, and the `&&`
bounding-box pre-filter that makes the query fast for a city does nothing for a state — a
state's bbox overlaps essentially every county and school district inside it, so the
pre-filter discards almost nothing.

That hypothesis predicts the city < county < state gradient exactly, **but it is inference
from the SQL, not a measurement.** Confirming it needs `EXPLAIN ANALYZE` on a state seed,
which I had no database access to run. Please verify before optimising on it — the
code comment at `:173-174` records that a previous version of this query took "~4s for a
single area" from a sequential scan, so the branch structure here has already been tuned once
and deserves a profile rather than a guess.

## Why "just raise the TTL" is a trap

Since nothing invalidates `overlap:v2:*`, the 1-hour expiry is the only thing that ever
refreshes it. Raise it to a week and a boundary-ingest migration's effect would not reach
readers for a week. The TTL is currently doing two jobs — cache lifetime *and* correctness —
and any fix has to keep the second.

## Suggested fixes, in order of preference

1. **Precompute the pairs into a table**, maintained by whatever writes `geofence_boundaries`.
   The value is a pure function of that geometry, so it belongs beside it rather than in a
   cache with a timeout. Reads become an index lookup, the cold path disappears entirely, and
   the invalidation question stops existing. Correct shape, largest change.
2. **Raise the TTL *and* add an explicit bust** on geofence writes. Much smaller, but now two
   things must stay in sync, and a missed bust is a silent correctness bug rather than a slow
   page.
3. **Stopgap: warm the 50 state keys on a cron.** One job, covers the worst-measured shape,
   buys time for (1). Does nothing for city/county keys, which are cheap anyway (0.5–1.4 s).

## Reproduce it

Any area not requested in the last hour. Run twice — the second call is the cache hit:

```bash
for i in 1 2; do
  curl -s -o /dev/null -w "run$i %{time_total}s %{size_download}B\n" \
    -X POST 'https://api.empowered.vote/api/essentials/browse/elections-by-area' \
    -H 'Content-Type: application/json' \
    --data '{"geo_id":"06","mtfcc":"G4000"}'
done
```

To confirm the cost is the shared step rather than the elections lookup, call `by-area` first
with the same body and then `elections-by-area` — the second is fast on its first ever call.

> **Caveat on re-measuring:** the diagnostic runs above warmed roughly a dozen state keys on
> 2026-11-24 around 14:00–15:00 UTC. Pick a state not listed in this report, or wait out the
> hour, or you will measure my cache entry rather than a cold path.
