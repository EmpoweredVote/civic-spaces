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
