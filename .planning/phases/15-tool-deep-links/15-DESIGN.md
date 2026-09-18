# Phase 15 — Tab-aware tool deep links

**Status:** design approved 2026-09-08, not yet planned
**Depends on:** nothing for the Essentials half. The Treasury half is blocked on
`TT-HANDOFF.md` (this directory) landing in `C:\treasury-tracker`.

## Goal

The sidebar's "Tools for This Community" box currently shows two fixed home-page links
that are identical on every tab. Make it **jurisdiction-aware**: on the County tab the
Essentials row opens Essentials already scoped to that county; on State, to that state's
officials; on Federal, to the federal officials view. Treasury Tracker joins the list
with the same behaviour once its side ships.

Compass stays a plain home-page link on every tab — it has no per-jurisdiction view.

## The governing rule

> **A row appears only when a real deep link exists for the active slice.
> No deep link, no row. Never a link to a different jurisdiction.**

Decided by Chris, 2026-09-08. Two rejected alternatives, recorded so they are not
re-proposed:

- *Fall back to the tool's home page when uncovered* — rejected. A row that sometimes
  means "your county's budget" and sometimes means "our front page" teaches members the
  link is unreliable.
- *Guess the deep link and let the tool sort it out* — rejected, and it is the
  motivating bug. Treasury Tracker resolves an unrecognised `?entity=` slug by
  **silently loading Bloomington, IN** (`treasury-tracker/src/App.tsx:415`). A wrong
  budget for a real place is worse than no link, because nothing on the page tells the
  member it is not theirs.

## What coverage actually looks like

Measured against the live catalog on 2026-09-08 (`generatedAt: 2026-09-02T19:53:00Z`,
29 KB):

| Tier | Essentials records | Civic Spaces geoid we hold | Match rate to expect |
|---|---|---|---|
| City | 170 | 7-digit place FIPS | low — ~19,000 US places exist |
| County | 26 | 5-digit county FIPS | very low — 3,143 US counties exist |
| State | 50 | derive from `geoid.slice(0,2)` | complete |
| Federal | 1 (`target` prebuilt) | n/a | complete |

**Read this before calling a missing row a bug.** On the City and County tabs most
members will correctly see no Essentials row at launch. The State and Federal tabs will
always have one. Treasury Tracker is wider (2,812 entities) but has the same shape of
gap. Coverage grows through the Knight cities programme, not through this repo.

## Matching: geoid-exact, no Census dependency

The catalog keys cities by 7-digit place FIPS and counties by 5-digit county FIPS —
**exactly the geoids `civic_spaces.slices` already stores.** So we match on geoid and
read `label` back *out* of the catalog for the link text.

That is worth stating plainly because it removes a dependency the obvious design would
have carried: **we never call the Census API and never touch `useJurisdictionName`.** No
name normalisation, no loose matching, no async race between the row and its label.

Per tier, from the active slice's `sliceType` + `geoid`:

| Tab | Match | Resulting Essentials href |
|---|---|---|
| `city` | `cities[].geoids` contains geoid | `/results?browse_government_list=<geoid>&browse_state=<abbrev>&browse_label=<label>` |
| `county` | `counties[].geoids` contains geoid | same as city |
| `state` | `states[].abbrev` === abbrev for `geoid.slice(0,2)` | `/results?browse_state_officials=<abbrev>&browse_label=<label>` |
| `federal` | `federal` record present | its `target`, used verbatim |
| `unified`, `volunteer` | never | none — no jurisdiction to scope to |

Formats mirror `treasury-tracker/src/utils/featureIcons.ts` (`buildEssentialsHref`), the
reciprocal matcher, so the two apps agree on one contract rather than each inventing its
own.

### One new lookup table

`geoidToWiki.ts` maps state FIPS to state *name* (`'18'` to `'Indiana'`). The catalog
keys states by *abbrev*. So Phase 15 adds a FIPS to abbrev map (`'18'` to `'IN'`). Put it
beside the existing `STATE_FIPS` table so the two stay in step.

### Geoids that will not match, by design

- City slices carry "place FIPS (7-digit) **or** census tract (11-digit)"
  (`geoidToDisplayName`). A tract geoid cannot match a place-keyed catalog. No row.
- The catalog itself holds 4 ten-digit and 2 five-digit entries under `cities`. Match by
  exact string containment and let them simply not match a 7-digit slice geoid; do not
  write special cases for them.

🔴 **The 10-digit case is not "by design" for Treasury — and the reason is upstream of
this repo.** Those ten-digit entries are **county-subdivision (MCD)** codes: townships.
For Essentials' handful of them, shrugging is fine. For Treasury it is not: TT carries
2,798 township entities, so silently not-matching them makes Michigan read as uncovered
while being complete on TT's side.

Settled 2026-09-12 (`TT-HANDOFF.md`, TT round 2 — verified against `C:\EV-Accounts`):

- `city_geoid` is **never** a 10-digit MCD. `connect.resolve_user_jurisdiction` fills the
  `city` slot from `mtfcc = 'G4110'` only, and all 6,008 of those are 7-digit place FIPS.
  A township resident with no covering incorporated place gets `city_geoid = null`, and
  the slice assigner then **skips the city level entirely** — no city slice, so no tab to
  hang a row on. (Canonical: `ev-accounts/backend/src/civic_spaces/`. The frozen copy here
  is `services/slice-assignment/src/services/sliceAssigner.ts:259-271` — read, don't edit.)
- The G4040 layer exists and is already queried for `city_council`, `municipality` and
  LOCAL/LOCAL\_EXEC.

⚠ **Superseded 2026-09-18 — the boundary numbers above and below have moved.** This section
originally said G4040 held 2,952 rows across WI, IN, CA and MA only, with MI and PA at zero.
Treasury Tracker loaded TIGER/Line 2024 subdivisions and places for **MI, PA and OH** on
2026-09-18. Re-measured against production the same day:

| Layer | Was | TT's load (2026-09-18) | Now | States |
|---|---|---|---|---|
| G4040 (MCD) | 2,952 | +5,760 | **8,712** | 4 → **7** |
| G4110 (place) | **6,863** | +2,471 | **9,334** | → **22** |

⚠ **The G4110 "was" figure is 6,863, not the 6,008 quoted earlier in this doc** — corrected by
TT 2026-09-18 and verified here against `imported_at`. The 6,008 baseline was measured on
2026-09-13, and a **different writer** added 855 G4110 rows later that same day. Attributing
`6,008 → 9,334` to TT's load credits it with 3,326 rows when it added 2,471. Their G4040 line
reconciles exactly.

🔴 **The lesson generalises, and it is the more useful half.**
`essentials.geofence_boundaries` has **multiple writers across ~19 import days** (visible in
`imported_at`: 06-08, 06-23, 07-08, 07-25, 08-14, 08-21, 08-22, 08-28, 09-01, 09-13, 09-18 …).
**Never explain a change in its totals by one team's load — including ours.** If you need to
attribute rows, group by `imported_at`; a before/after subtraction will silently absorb
somebody else's import. One row also carries a NULL `imported_at`.

**The conclusion is unchanged, and in one respect strengthened.** MI, PA and OH were loaded
**without a FUNCSTAT filter**, so they belong in the "probably governments, unaudited" row
alongside IN — not with WI/MA. More 10-digit rows of mixed quality makes keying on *length*
worse, not better.

**So still do not "fix" this in the matcher.** But update the *reason*: township rows are now
absent because of our **slice rule** — `city_geoid` is never a 10-digit MCD, so a township
resident has no city slice — and no longer because the boundaries are missing. That remains
an ev-accounts question, not a Phase 15 one. Ship Treasury without township coverage; a
missing row is the correct behaviour here.

✅ **Ohio is a clean win.** All 253 OH entities in TT's catalog are 7-digit places, so they
match the existing `G4110` rule with **no change on our side**.

### 🔴 Never key on geoid *length*. Key on `(geoid, layer)`.

ev-accounts' reply of 2026-09-13 (`ACCOUNTS-HANDOFF.md`) killed the "lengths are
self-describing, so branch on length" idea this design previously floated. **A 10-digit
geoid does not mean one thing.** Of the G4040 boundaries (2,952 when measured; **8,712** as
of 2026-09-18 — the three states added that day are unaudited, see above):

| State | Rows | What they actually are |
|---|---|---|
| WI | 1,243 | active governments — FUNCSTAT-filtered |
| MA | 293 | active governments (MCDs) — FUNCSTAT-filtered |
| IN | 1,012 | probably governments, **unaudited** — no FUNCSTAT filter, no comment |
| CA | 404 | 🔴 **Census County Divisions — statistical areas. No officials, no budget, no board.** |

So a length branch would hand a Californian a city row pointing at a statistical Census
division that Essentials and Treasury have nothing to show for. **That is a wrong link,
not a missing row** — the one outcome the governing rule exists to prevent.

**The rule for this phase:** match on **`(geoid, layer)`**, where `layer` is the MTFCC or
an equivalent tag — today always `G4110` for the city row. It costs nearly nothing now,
and if `subdivision_geo_id` ever lands it becomes a new *value* of an existing field
rather than a new branch. A length test would also silently accept
`municipality_geo_id`'s composite districts-namespace ids, which are 10+ characters and
are not FIPS at all.

**No live bug today.** Our Essentials matching is exact string containment against a
7-digit slice geoid, so it already cannot mis-hit a 10-digit entry. This rule is about
keeping it that way when Treasury is added.

### "A city slice means an incorporated place" — a deliberate rule, as of now

ev-accounts confirmed G4110-only was chosen to make the city slot *reliable* (Plano has no
`LOCAL_EXEC`; Austin's `city_council` returns a council district rather than the city), and
that **townships were never considered and rejected — they simply did not come up.** Under
`CC_0038`'s own stated model, "a slice is a government you live under", a Michigan township
*is* such a government, so excluding it is a coverage consequence rather than a principle.

We adopt it as a principle anyway, and the California CCD rows above are the reason: a rule
that the city slice means *an incorporated place* is defensible, and it is what protects us
from the widening trap. Recorded as deliberate **now**, not backdated.

## Security — the catalog is untrusted remote data

Standing platform rule **T-125-01**, carried over from `essentialsCoverage.ts`: the
catalog is fetched from an origin this repo does not control, so `label`, `geoids` and
`target` are attacker-shaped strings for our purposes.

- Build every href with `URLSearchParams`. Never string-concatenate or template a catalog
  value into a URL.
- Treat `federal.target` as an **opaque root-relative path**. Reject it unless it starts
  with `/` and does not start with `//`, then resolve against the Essentials origin and
  confirm `resolved.origin` matches. `buildEssentialsHref` already does exactly this —
  copy its guard rather than reasoning it out again.
- `label` is rendered as text, never as HTML.

## Architecture

Follows the documented hoisting pattern in `CLAUDE.md`: shared data hooks live in
`AppShell`, never inside a panel.

| Unit | Responsibility |
|---|---|
| `src/lib/toolCoverage.ts` | Catalog types plus a **pure** `buildToolRows({ sliceType, geoid, catalog })` returning the rows to render. All matching and href construction lives here. |
| `src/hooks/useToolCoverage.ts` | React Query fetch of **Essentials'** `/coverage.json` (`https://essentials.empowered.vote/coverage.json`), long `staleTime` (the catalog regenerates on Essentials deploys, not per session). It **throws** on a bad response so React Query records the error; callers treat an absent catalog as "no deep links", which degrades the widget to the Compass row. |

🔴 **The Treasury catalog is a different URL, and this table's `/coverage.json` is NOT it.**
When the Treasury half is built it fetches
**`https://api.empowered.vote/api/treasury/coverage`** — verified 2026-09-18: HTTP 200,
791,491 bytes, 8,136 entities. The same payload is served from
`ev-accounts-api.onrender.com`, but **use the branded origin** `api.empowered.vote`, which
`CLAUDE.md` already names for platform API calls; hardcoding the Render hostname pins us to a
provider. `/coverage.json` on the API origin is a 404 — it never existed there.

Catalog shape, verified against the live payload on 2026-09-18, because two of these will
break a naive consumer:

- **`federal` is an OBJECT, not an array** — `.length` is `undefined`. Its slug is
  `united-states-us`.
- **`states` entries carry `abbrev` and no `geoids` key**, so a "rows missing geoids" count
  correctly returns 51 (50 states + federal).
- An entity with no geoid is **omitted entirely**, never `geoids: []`.
- Every city carries `slug`, so no consumer reconstructs `toSlug`.
| `src/components/AppShell.tsx` | Calls `useToolCoverage()` once beside `useRepresentatives`; passes `coverage` plus the active slice's `geoid` and `sliceType` into both sidebars. |
| `src/components/widgets/ToolsWidget.tsx` | Gains props; renders `buildToolRows(...)` output. Keeps its existing `if (rows.length === 0) return null` guard — Compass is always present, so the box never actually empties. |

`Sidebar` and `SidebarMobile` already receive `activeTab` and thread props through, and
each renders `ToolsWidget` once — so this adds one fetch, not six.

`buildToolRows` is pure, and is where every interesting decision lives. That is the
deliberate shape, given the constraint below.

## Verification

**The frontend has no test framework** (`CLAUDE.md`), so `buildToolRows` being pure buys
reviewability, not automated coverage. Verification is:

1. `npm run build` — `tsc -b`, the only real check. Must pass.
2. By hand, per tab (City / County / State / Federal / Unified), in **light and dark, on
   desktop and mobile** — the four-way standard from `CLAUDE.md`. Confirm:
   - State and Federal show a scoped Essentials row.
   - Unified shows no Essentials row at all.
   - An uncovered county shows Compass only, with no gap or stray divider where the row
     would have been.
3. Point one tab's geoid at a known-covered jurisdiction (verify it is in the live
   catalog first) and confirm the href carries the right geoid, abbrev and label.
4. Simulate a failed catalog fetch (offline, or a bad `VITE_ESSENTIALS_URL`) and confirm
   the box degrades to Compass alone rather than erroring or hanging.

## Logos

Source: `C:\ev-landing\ev-landing-main`. **Use the tuned copies in `icons/`, not the
pristine ones in `brand/`.** Its `brand/README.md` is explicit: the `icons/` files are
"hand-tuned symbol copies ... cropped so the marks align consistently in the card grid"
and are "the live glyphs", while `brand/` is untouched source of truth. Our Tools box is
that same aligned-marks problem, so the cropped versions are the right ones here.

Vendor local copies into this repo rather than hotlinking `empowered.vote/brand/...` — no
cross-origin dependency for a sidebar icon.

| File | viewBox | Notes |
|---|---|---|
| `compass-symbol-light.svg` / `-dark.svg` | 167x167 | pair |
| `essentials-symbol-light.svg` / `-dark.svg` | 142x167 | pair, non-square |
| `treasury-symbol.svg` / `-dark.svg` | 214x162 | pair as of 2026-09-08 — see below |

Two consequences:

- **Three different aspect ratios.** Render each in a fixed square box with
  `object-contain`, not at a raw height, or the marks will not align — the exact problem
  the `icons/` crops exist to solve.
- **Treasury's dark variant now exists upstream — do not derive another one.** Treasury
  was the only product in the pack with a single-colour symbol. A dark variant was
  derived and synced back to `ev-landing` on 2026-09-08 (branch
  `feat/treasury-dark-symbol`): `icons/treasury-symbol-dark.svg`, with the source-of-truth
  copy at `brand/treasury-tracker/Symbol/SVG/treasury-tracker-symbol-dark.svg`. Vendor
  that file like the other two.

  It is a **selective** recolor, and the reason is recorded here because a future
  regeneration will otherwise "fix" it into a blanket swap. Measured against `#111827`
  (`gray-900`, the `WidgetCard` dark ground): the three stacked rects go 2.66:1 → 6.31:1
  when brightened to `#1DA8C6`, so they must be. But the `$` glyph sits on its own yellow
  circle, where the same swap takes it 4.66:1 → **1.97:1** — it mushes at a 24px icon in
  either direction. So the `$` path keeps
  `#00657C`. The file is 5 × `#1DA8C6` + 1 × `#00657C` deliberately. The rule:
  **brighten teal that meets the page ground; leave teal that sits on brand yellow.**

  Symbol PNGs are still light-only upstream (no rasteriser was available), which does not
  affect us — we use the SVGs.

Dark-mode switching is **class-based** here (`CLAUDE.md`) — `index.html` sets `.dark`
before first paint. So pick the variant with `block dark:hidden` / `hidden dark:block` on
two `<img>` tags, or via `useTheme()`. A `prefers-color-scheme` media query inside the SVG
will **not** follow the in-app toggle.

## Scope

**In:** Essentials rows for city / county / state / federal; Compass unchanged as a home
link; the three logos; the coverage hook and pure builder; the FIPS to abbrev table.

**Out:**

- The Treasury Tracker row. Structure this phase so Treasury is a row added to
  `buildToolRows`, but do not ship a Treasury link until TT publishes a geoid catalog and
  drops the Bloomington fallback. See `TT-HANDOFF.md`; its 2026-09-12 exchange settles two
  things. The Treasury **catalog** is fetched from the API origin while the Treasury
  **deep link** still points at `treasurytracker.empowered.vote` — deliberate (data vs.
  user-facing page), and **both call sites must say so** or someone will "fix" it. And
  township coverage is **not** a gate: ship without it, because the blocker is MI/PA
  boundary ingest in ev-accounts, not anything this phase can reach.

- Township/MCD support. Tracked as an ev-accounts question in `ACCOUNTS-HANDOFF.md`.
- Any change to what Essentials or TT *cover*. Coverage is the Knight cities programme.
- Address handling of any kind. This app never geocodes (`CLAUDE.md`).

## Risks

| Risk | Mitigation |
|---|---|
| Catalog shape changes under us | Validate defensively; a record missing `label` or `geoids` is skipped, not rendered. Same posture as `hasSlug` in `triviaCoverage.ts`. |
| Sparse coverage reads as a broken feature | Documented above; say it in the PR so a reviewer sitting on an uncovered county does not file a bug. |
| Members read a missing row as "my county has no budget" | Accepted for now. Revisit with a copy change, never by linking somewhere wrong. |
