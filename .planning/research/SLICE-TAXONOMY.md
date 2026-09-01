# Slice Taxonomy — design

**Date:** 2026-09-01
**Status:** approved in discussion, not yet implemented
**Supersedes:** the geographic mapping in `services/slice-assignment/src/services/sliceAssigner.ts`

---

## Why this exists

A member in Arden, North Carolina signed in with a correctly resolved address and saw
an empty page. Fixing that surfaced something larger: **the implemented slice model
contradicts both its own UI copy and the feature spec**, on three of five levels.

`src/lib/sliceCopy.ts` supplies the hero banner text. What it tells a member, against
what the assigner actually did:

| slice_type | Banner text | Assigner used |
|---|---|---|
| `neighborhood` | "verified residents in your **city or town**" | school district |
| `local` | "county-wide issues" | county ✓ |
| `state` | "**all state residents** … the entire state" | state senate district |
| `federal` | "**Americans nationwide** … all citizens across the country" | congressional district |
| `unified` | "members from around the **world**, cross-border" | global ✓ |

`9_Connect_Civil-Civics_Equal-Slices-detailed.md` agrees with the copy, not the code:
State Slice is "~30,000 scattered across your entire state", Federal Slice is "~30,000
scattered across all 50 states". Neither is a district.

So this is not a new model. It is the documented model, which the implementation drifted
away from.

---

## The decision

**A slice is a government you live under, not a constituency you vote in.**

Congressional and legislative districts stop being spaces. They remain in the resolved
jurisdiction, because they still decide *which representative* to show a member — they
just no longer fragment the conversation. Their content surfaces inside the Federal and
State spaces (see "Representatives", below).

### Levels

| slice_type | Tab | Fed by | Plano, TX | Coverage |
|---|---|---|---|---|
| `unified` | Unified | constant | `UNIFIED` | everyone |
| `federal` | Federal | nation | `US` | everyone |
| `state` | Texas | state, `G4000` | `48` | national (53) |
| `county` | Collin County | county, `G4020` | `48085` | national (3,222) |
| `city` | Plano | place, `G4110` | `4858016` | 18 states (6,008) |
| `volunteer` | Volunteer | role | `VOLUNTEER` | role-gated |

`city` and `county` replace `neighborhood` and `local`. The old names were actively
misleading: `neighborhood` was **labelled** "Local" and `local` was **labelled** "County",
and that gap is where the school-district mapping hid. Renaming is cheap now and never
gets cheaper.

No copy changes are needed. `sliceCopy.ts` already describes these levels correctly.

### Levels are optional, by design

A jurisdiction can legitimately lack a level, and the assigner must skip it rather than
fail. Two real cases, both measured 2026-09-01:

- **Arden, NC is unincorporated.** No `G4110` place covers the point, so there is no city
  space. The member gets Unified, Federal, North Carolina, Buncombe County.
- **North Carolina has no school districts in our boundary data** (`G5420` covers 11
  states), which is why the old `neighborhood` mapping produced nothing there.

---

## Capacity

**6,000 members per slice.** Beyond that, a sibling slice is created for the same geoid.

**A member's five spaces sum to ~30,000.** That is the ~30,000 principle from the feature
spec: it is the size of a member's whole civic world, not the size of one room. Five rooms
of six thousand. A member without a city has four rooms and roughly 24,000.

This reconciles three numbers that were all in play:

| Source | Number | Status |
|---|---|---|
| Feature spec | ~30,000 | correct, but describes the **aggregate** |
| Code (`.lt('current_member_count', 6000)`) | 6,000 | correct per slice, but an unnamed magic number |
| Early discussion | 3,000 | rejected |

Action: extract `SLICE_CAPACITY = 6000` as a named, exported constant. The value does not
change; the silence around it does.

### Prerequisite: the member counter is wrong

The capacity check reads `slices.current_member_count`, and that column does not match
reality. Measured 2026-09-01:

| slice | claimed | actual |
|---|---:|---:|
| `federal/0636` | 42 | 1 |
| `local/06037` | 36 | 1 |
| `state/06028` | 34 | 1 |
| `neighborhood/0622710` | 23 | 0 |

**Sharding is therefore being decided on fiction.** A slice holding three people can be
declared full and spawn a sibling, splitting a community that never needed splitting —
the exact opposite of the human-scale goal. The same column feeds the member counts shown
in the hero banner.

Reconciling the counter is a prerequisite of this work, not a follow-up.

---

## Representatives inside Federal and State

Districts stop being spaces, so the place a member meets their representatives is the
government space itself. `RepresentativesWidget` already filters by tab, so this extends
existing behaviour rather than adding a mechanism:

| Space | Shows |
|---|---|
| Federal | both US Senators, and the US Representative for the member's congressional district |
| State | Governor and statewide offices, plus the member's state senator and representative |
| County | commissioners, sheriff, district attorney |
| City | mayor, and the council member for the member's district |

This is why the jurisdiction must keep resolving congressional and legislative districts.
We stop **assigning** on them; we do not stop **storing** them.

---

## Migration

16 slices, 7 real members, 12 posts. Cheap now, expensive after the next community.

Posts must survive: 10 sit in `federal/1807`, 1 in `federal/0636`, 1 in `volunteer`.

1. `federal/1807` (the 10 posts) becomes `federal/US`, sibling 1. The other three federal
   slices merge into it — their post, members and any threads move — then retire. Merging
   is semantically safe: their banner already claimed to be nationwide.
2. `state/06028` and `state/06026` → `state/06`. `state/18040` and `state/18046` → `state/18`.
3. `local` → `county`. Geoids are already county FIPS and do not change.
4. `neighborhood` → `city`. `0622710` is already Los Angeles' place geoid. The two
   school-district geoids and `lausd-board-district-4` re-resolve to their members' actual
   place.
5. Re-run assignment for all 7 members.
6. Reconcile every `current_member_count` against `slice_members`.

Nothing is deleted before its content has moved.

---

## Out of scope, deliberately

- **School district spaces.** Ranked below Federal, and `G5420` covers 11 states. Revisit
  when the data is national.
- **District spaces.** Replaced by "Representatives inside Federal and State".
- **The radial "Civil Civics" circle.** The feature spec describes `city` as a ~30k circle
  expanding from the member's address rather than a place polygon. It is the better answer
  for rural and unincorporated members — Arden would get a local space instead of none —
  but it needs population data, clustering and boundary stability. `city` can be swapped
  to it later without touching any other level.

---

## Open questions

- **Does `federal` make `unified` redundant?** Not on paper: `unified` is documented as
  global and cross-border, `federal` as nationwide. In practice, until there are members
  outside the US, the two have identical membership.
- **Where does a member in an unincorporated area get a local conversation?** Today,
  nowhere below the county. This is the strongest argument for the radial model.
- **Should a `city` space split by council district once it exceeds 6,000?** Sibling slices
  currently split arbitrarily. Splitting along council lines would keep each room aligned
  to one representative.
