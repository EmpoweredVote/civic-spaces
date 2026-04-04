# Phase 7: New Slice Types - Research

**Researched:** 2026-04-03
**Domain:** Supabase schema extension, Express slice assignment service, React tab visibility gating
**Confidence:** HIGH (all findings derived from live codebase)

---

## Summary

Phase 7 has four distinct sub-problems: (1) schema migration to add 'unified' and 'volunteer' slice_types, (2) extending the Express slice assignment service to handle Unified auto-assignment and Volunteer role-gated assignment, (3) activating the Unified tab feed, and (4) activating the Volunteer tab with role-gated visibility. All work stays within the existing stack — no new npm packages are required on either frontend or backend.

The key constraint is the CHECK constraint on `civic_spaces.slices.slice_type`, which currently only allows `('federal', 'state', 'local', 'neighborhood')`. This must be updated in a migration via `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT`. The RLS analysis shows that `get_boosted_feed_filtered` uses SECURITY INVOKER and the `posts_select_slice_member` policy gates reads by membership — so as long as a user IS assigned to a unified/volunteer slice, the feed RPC will work correctly for those slice types without any RLS modification. No new RLS policies are needed for the new types.

The Unified assignment follows a "check before insert" pattern (not the geo upsert pattern) because users must stay in the same Unified cohort. The Volunteer assignment is stubbed as always-false this phase but the full infrastructure (role check function, delete-on-revocation logic) must be built with a single clearly-marked TODO. The Volunteer tab is entirely hidden for non-Volunteer users — not disabled, not greyed, not present in the DOM — which requires conditional tab rendering in `SliceTabBar` (not just `disabledTabs`).

**Primary recommendation:** Plan as 4 sequential tasks matching the roadmap: 07-01 (schema migration), 07-02 (assignment service extension), 07-03 (Unified tab activation), 07-04 (Volunteer tab activation + role gating). 07-01 and 07-02 must complete before 07-03/07-04 since the frontend needs real slice IDs.

---

## Standard Stack

No new packages required on frontend or backend. All existing dependencies handle the full scope.

### Core (Already Installed)

| Library | Version | Phase 7 Use |
|---------|---------|-------------|
| `@supabase/supabase-js` | ^2.100.1 | Schema migration (service_role), frontend slice fetch |
| `react` | ^19.2.4 | Conditional tab rendering, slice feed panel wiring |
| `@tanstack/react-query` | ^5.95.2 | `useAllSlices` extended for unified/volunteer slice_ids |
| `tailwindcss` | ^4.2.2 | No layout changes needed (tab bar structure unchanged) |
| `express` | (backend) | Assignment route extension for unified/volunteer |

### No New Packages

Volunteer role check stub requires no new libraries — it's a boolean flag in the assignment service. The "check before insert" membership pattern for Unified uses the existing Supabase client.

---

## Architecture Patterns

### Recommended Project Structure

Changes are concentrated in:

```
supabase/migrations/
└── [timestamp]_phase7_unified_volunteer.sql   # NEW: CHECK constraint + sentinel rows

services/slice-assignment/src/services/
└── sliceAssigner.ts                           # MODIFY: add unified/volunteer assignment logic

src/
├── types/
│   └── database.ts                           # MODIFY: add 'volunteer' to SliceType, sibling_index to SliceInfo
├── hooks/
│   └── useAllSlices.ts                       # MODIFY: include unified/volunteer in returned map
└── components/
    ├── AppShell.tsx                          # MODIFY: activate unified/volunteer feeds, pass hasVolunteerRole
    └── SliceTabBar.tsx                       # MODIFY: conditional rendering for volunteer tab
```

`SliceFeedPanel.tsx` requires no changes — it already accepts any `sliceId`.
`get_boosted_feed_filtered` RPC requires no changes — it is slice-type-agnostic.

### Pattern 1: Schema CHECK Constraint Extension

**What:** ALTER the existing CHECK constraint to allow 'unified' and 'volunteer' as valid slice_type values.
**When to use:** Any time a new slice_type is added.

```sql
-- Source: supabase/migrations/20260327000001_schema.sql (existing constraint pattern)
ALTER TABLE civic_spaces.slices
  DROP CONSTRAINT slices_slice_type_check;

ALTER TABLE civic_spaces.slices
  ADD CONSTRAINT slices_slice_type_check
  CHECK (slice_type IN ('federal', 'state', 'local', 'neighborhood', 'unified', 'volunteer'));
```

After extending the constraint, insert sentinel rows to bootstrap the first sibling of each new type. The assignment service's `findActiveSliceForGeoid` handles creating slices on demand, but having the sentinel row means the very first login doesn't trigger creation during an assign call:

```sql
-- Sentinel rows are NOT strictly required by the service (it creates on demand),
-- but confirm behavior: the service inserts slices if none exist (initial path in findActiveSliceForGeoid).
-- No INSERT needed in the migration unless bootstrapping for tests.
```

**Important:** The existing UNIQUE constraint `slices_geoid_type_sibling_key UNIQUE (geoid, slice_type, sibling_index)` handles both new types automatically — no change needed.

### Pattern 2: TypeScript Type Extension

**What:** Add 'volunteer' to `SliceType` union and `sibling_index` to `SliceInfo` for the slice number display requirement.
**Current state:**
- `SliceType = 'federal' | 'state' | 'local' | 'neighborhood' | 'unified'` — 'unified' already present, 'volunteer' missing
- `SliceInfo` has `{ id, sliceType, geoid, memberCount }` — no `sibling_index`

**Required changes:**

```typescript
// Source: src/types/database.ts (live codebase)
export type SliceType = 'federal' | 'state' | 'local' | 'neighborhood' | 'unified' | 'volunteer'

export interface SliceInfo {
  id: string
  sliceType: SliceType
  geoid: string
  memberCount: number
  siblingIndex: number   // NEW: needed for "Name #N" feed header display
}
```

**Note on `TabKey`:** `TabKey = 'neighborhood' | 'local' | 'state' | 'federal' | 'unified' | 'volunteer'` is already correct — no change.

### Pattern 3: useAllSlices Extension

**What:** Extend `useAllSlices` to include unified and volunteer slices in the returned map.
**Current state:** `useAllSlices` filters to only `GEO_SLICE_TYPES = ['neighborhood', 'local', 'state', 'federal']`. Unified and volunteer are ignored.

**Required changes:**

```typescript
// Source: src/hooks/useAllSlices.ts (live codebase)

// Remove the GEO_SLICE_TYPES filter — include all slice types
// Add sibling_index to the select query
const { data: sliceRows } = await supabase
  .from('slices')
  .select('id, slice_type, geoid, current_member_count, sibling_index')
  .in('id', sliceIds)

// In the reducer, include all types (not just geo):
for (const row of sliceRows ?? []) {
  const sliceType = row.slice_type as SliceType
  slices[sliceType] = {
    id: row.id,
    sliceType,
    geoid: row.geoid,
    memberCount: row.current_member_count,
    siblingIndex: row.sibling_index,   // NEW
  }
}
```

**Note:** `hasJurisdiction` currently returns `true` if any memberships exist. After this change, a user with only a Unified slice (no geo) would get `hasJurisdiction: true`. This is the correct behavior — `hasJurisdiction` guards the "no slices at all" state. Consider whether to rename it to `hasAnySlice` for clarity (Claude's discretion).

### Pattern 4: Unified Assignment — "Check Before Insert"

**What:** Assign user to Unified slice only if not already assigned. Do NOT use the existing `upsertSliceMember` (which uses upsert with `ignoreDuplicates: true` — safe but re-runs the find-active-slice logic every login). Instead: check for existing membership first, skip if found.

**Why different from geo assignment:** Geo assignment upserts on every login because jurisdiction can change (address change). Unified assignment must be stable for 2 years — upsert is safe against duplicates but the `findActiveSliceForGeoid` call on every login could theoretically route to a different sibling if the first one fills up after the user is already assigned. The "check before insert" pattern prevents this.

**Implementation in `sliceAssigner.ts`:**

```typescript
// Source: derived from existing sliceAssigner.ts patterns
async function assignUnifiedIfNotAssigned(userId: string): Promise<string | null> {
  const UNIFIED_GEOID = 'UNIFIED'

  // Check if user already has a unified slice assignment
  const { data: existing } = await supabase
    .schema('civic_spaces')
    .from('slice_members')
    .select('slice_id')
    .eq('user_id', userId)
    .in('slice_id',
      // subquery: get all unified slice IDs
      supabase
        .schema('civic_spaces')
        .from('slices')
        .select('id')
        .eq('slice_type', 'unified')
        .eq('geoid', UNIFIED_GEOID)
    )
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0].slice_id  // Already assigned — skip
  }

  // Not assigned — find active slice and insert
  const sliceId = await findActiveSliceForGeoid('unified', UNIFIED_GEOID)
  await upsertSliceMember(userId, sliceId)
  return sliceId
}
```

**Simpler alternative** (equally correct, avoids subquery):

```typescript
async function assignUnifiedIfNotAssigned(userId: string): Promise<string | null> {
  const UNIFIED_GEOID = 'UNIFIED'

  // Find the unified slice(s) by geoid
  const { data: unifiedSlices } = await supabase
    .schema('civic_spaces')
    .from('slices')
    .select('id')
    .eq('slice_type', 'unified')
    .eq('geoid', UNIFIED_GEOID)

  if (unifiedSlices && unifiedSlices.length > 0) {
    const sliceIds = unifiedSlices.map(s => s.id)
    const { data: membership } = await supabase
      .schema('civic_spaces')
      .from('slice_members')
      .select('slice_id')
      .eq('user_id', userId)
      .in('slice_id', sliceIds)
      .limit(1)

    if (membership && membership.length > 0) {
      return membership[0].slice_id  // Already assigned
    }
  }

  // Not assigned — assign to active slice
  const sliceId = await findActiveSliceForGeoid('unified', UNIFIED_GEOID)
  await upsertSliceMember(userId, sliceId)
  return sliceId
}
```

**Recommended:** Use the two-step approach (simpler, easier to test, no subquery syntax issues with Supabase JS client).

### Pattern 5: Volunteer Assignment — Stubbed with Clear TODO

**What:** Build the full volunteer assignment infrastructure but stub the role check as always-false. The stub must be easy to find and replace with one line.

```typescript
// Source: derived from sliceAssigner.ts and CONTEXT.md decision
const VOLUNTEER_GEOID = 'VOLUNTEER'

// TODO(volunteer-role): Replace this stub with the real accounts API check.
// The accounts team is finalizing the role field name. When confirmed:
//   1. Add the role field to AccountData in accountsApi.ts
//   2. Replace `return false` with `return accountData.roleFieldName === 'volunteer'` (or equivalent)
function hasVolunteerRole(accountData: AccountData): boolean {
  return false  // STUB: Phase 7 — always false until accounts API field is confirmed
}

async function assignVolunteerIfEligible(
  userId: string,
  accountData: AccountData
): Promise<string | null> {
  const isVolunteer = hasVolunteerRole(accountData)

  if (!isVolunteer) {
    // Role revocation: remove from volunteer slice membership if assigned
    await removeVolunteerMembership(userId)
    return null
  }

  // Assign if not already assigned (same check-before-insert pattern as unified)
  return assignVolunteerIfNotAssigned(userId)
}

async function removeVolunteerMembership(userId: string): Promise<void> {
  // Get all volunteer slice IDs
  const { data: volunteerSlices } = await supabase
    .schema('civic_spaces')
    .from('slices')
    .select('id')
    .eq('slice_type', 'volunteer')
    .eq('geoid', VOLUNTEER_GEOID)

  if (!volunteerSlices || volunteerSlices.length === 0) return

  const sliceIds = volunteerSlices.map(s => s.id)

  // Delete membership rows — decrement_slice_count trigger fires automatically
  await supabase
    .schema('civic_spaces')
    .from('slice_members')
    .delete()
    .eq('user_id', userId)
    .in('slice_id', sliceIds)
}
```

**Revocation mechanism decision:** Hard DELETE from `slice_members` (not soft delete). Rationale: the `slice_members` table has no `is_active` or `deleted_at` column and there is no soft-delete pattern in this table. The `decrement_slice_count` trigger on DELETE keeps `current_member_count` accurate. This is consistent with how address-change geo reassignment would work — the old slice membership is removed. If the user regains the role, they are simply re-assigned on next login.

### Pattern 6: Volunteer Tab Conditional Rendering

**What:** Volunteer tab must be completely absent from the DOM for non-Volunteer users. The current `disabledTabs` approach renders the tab but makes it unclickable — this is NOT sufficient.

**Current state:** `SliceTabBar` renders `RIGHT_TABS` (which contains `volunteer`) always, and `AppShell` passes `disabledTabs={['unified', 'volunteer']}`. The tab appears greyed with "Coming soon" text.

**Required change:** `SliceTabBar` needs to accept a `visibleTabs?: TabKey[]` prop (or `hiddenTabs?: TabKey[]`), or AppShell should pass a filtered `rightTabs` array that excludes `volunteer` when the user is not a Volunteer. The simplest approach: pass `showVolunteerTab: boolean` to `SliceTabBar` and filter `RIGHT_TABS` based on it.

```typescript
// In SliceTabBar.tsx
interface SliceTabBarProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  slices: Partial<Record<SliceType, SliceInfo>>
  disabledTabs?: TabKey[]
  showVolunteerTab?: boolean   // NEW: false = volunteer tab not rendered at all
}

// In render:
const visibleRightTabs = showVolunteerTab ? RIGHT_TABS : []
```

**In AppShell:** The `hasVolunteerRole` state comes from `useAllSlices` (user has a volunteer slice assigned) OR from a dedicated check. Since the role check is stubbed as always-false, `hasVolunteerRole` will always be false in Phase 7, so the Volunteer tab will never appear. But the infrastructure must be wired for the one-line change later.

**Recommended approach:** Derive `showVolunteerTab` from whether `slices['volunteer']` exists in the `useAllSlices` result. If the user has a volunteer slice assignment, they have the role — the assignment is the gate. This avoids a separate role-check fetch.

```typescript
// In AppShell
const showVolunteerTab = !!slices['volunteer']
```

This is the cleanest approach: the assignment service is the role-check gate; the frontend just reads the membership result.

### Pattern 7: Feed Header Slice Number Display

**What:** Each SliceFeedPanel's header shows "Name #N" (e.g. "Unified #3"). The slice number is `siblingIndex` from `SliceInfo`.
**UX decision (Claude's discretion):** Show `#1` always, not only when N > 1. Rationale: Users in Unified are assigned to a specific cohort — knowing you're in "Unified #1" vs. "Unified #3" is meaningful identity information even if you don't know others are in different cohorts. Consistency also avoids the layout shift when a second sibling is created. This applies uniformly to all slice types.

**Where to implement:** SliceFeedPanel needs to receive the slice name and sibling index to render the header. Currently `SliceFeedPanel` only takes `sliceId` — it has no slice name or number. The cleanest approach is to pass these as optional props:

```typescript
// In SliceFeedPanel.tsx (or a new FeedHeader subcomponent)
interface SliceFeedPanelProps {
  sliceId: string
  sliceName?: string      // e.g. "Unified", "Volunteer", "Federal"
  siblingIndex?: number   // e.g. 1, 2, 3
  // ...existing props
}
// If provided, renders: "Unified #3" above the feed
```

Alternatively: AppShell passes these down as part of the `SliceInfo` it already has. The tab label map (e.g. `{ unified: 'Unified', volunteer: 'Volunteer', federal: 'Federal', ... }`) translates `SliceType` to display name.

### Anti-Patterns to Avoid

- **Blind upsert for Unified assignment:** Do NOT call `upsertSliceMember` for Unified on every login the same way geo slices do. The geo upsert uses `ignoreDuplicates: true` which prevents duplicate rows, but the `findActiveSliceForGeoid` call before it still runs — if Unified #1 filled up between first assignment and current login, the user would be routed to Unified #2. Check for existing membership first.
- **Soft-deleting `slice_members` for role revocation:** There's no soft-delete column in `slice_members`. Use hard DELETE. The trigger handles count decrement automatically.
- **Adding slice_type filter to RLS policies:** The existing `posts_select_slice_member` policy already gates reads by membership. Do NOT add a separate `slice_type IN ('federal', ...)` filter — it would break for new slice types.
- **Showing Volunteer tab as disabled/greyed for non-Volunteers:** The requirement is "completely hidden — no hint, no lock, no tease." Use conditional rendering (don't include in DOM), not `opacity-40 cursor-not-allowed`.
- **Checking `activeTab === 'unified' || activeTab === 'volunteer'` for the Coming Soon placeholder:** This check currently exists in AppShell. Remove it when activating those tabs — replace with `SliceFeedPanel` renders like the geo tabs.
- **Adding 'volunteer' to the RIGHT_TABS constant without a visibility gate:** RIGHT_TABS always renders all its items. Either filter before rendering or use the `showVolunteerTab` prop pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feed for unified/volunteer slices | New RPC or hook | Existing `useBoostedFeed(sliceId)` | RPC is already slice-type-agnostic (only filters by `p_slice_id`); confirmed SECURITY INVOKER with RLS by membership |
| Overflow sibling creation | Custom concurrent-safe logic | Existing `findActiveSliceForGeoid` + `findOrCreateSiblingSlice` | Already handles race conditions (P0001 retry logic), initial creation, and sibling numbering |
| Member count decrement on volunteer revocation | Manual count update | Existing `decrement_slice_count` trigger on DELETE | Trigger fires automatically on every `slice_members` DELETE — no app logic needed |
| Tab route/URL management | React Router | `useState<TabKey>` in AppShell | No URL-based routing in this app — tabs are local state; already established pattern |

**Key insight:** The backend (Supabase) work for Phase 7 is almost entirely contained in a single migration file and additions to `sliceAssigner.ts`. The frontend work is primarily wiring — connecting `useAllSlices`'s extended result to the existing `SliceFeedPanel` component.

---

## Common Pitfalls

### Pitfall 1: CHECK Constraint Rejects Slice Inserts Before Migration Runs

**What goes wrong:** The assignment service attempts to insert a slice row with `slice_type = 'unified'` but the DB CHECK constraint rejects it with a constraint violation.
**Why it happens:** The existing constraint is `CHECK (slice_type IN ('federal', 'state', 'local', 'neighborhood'))`. The migration must run (and PostgREST must be reloaded) before the assignment service attempts any unified/volunteer inserts.
**How to avoid:** Plan 07-01 deploys the schema migration before Plan 07-02 modifies the assignment service. Test the migration ran by querying `information_schema.constraint_column_usage`.
**Warning signs:** Assignment service 500 errors with `ERROR: new row for relation "slices" violates check constraint "slices_slice_type_check"`.

### Pitfall 2: get_boosted_feed_filtered RLS Analysis — Not Actually Blocked

**What might be assumed:** That new slice types need new RLS policies for the feed RPC.
**Why it's NOT a problem:** `get_boosted_feed_filtered` uses `SECURITY INVOKER` — it runs under the calling user's permissions. The `posts_select_slice_member` policy gates SELECT on posts by `slice_id IN (user's slice_ids)`. If the user is a member of a unified or volunteer slice, their JWT gives them read access to those posts. The policy is membership-based, not type-based. **No new RLS policies are needed for the new slice types.**
**Verify:** Confirm by reading `20260327000002_rls.sql` policy `posts_select_slice_member` — it uses `slice_id IN (SELECT slice_id FROM civic_spaces.slice_members WHERE user_id = ...)`. This is correct and type-agnostic.

### Pitfall 3: Volunteer Tab Still in DOM as Hidden Element

**What goes wrong:** If `SliceTabBar` continues to render volunteer in `RIGHT_TABS` but with `disabledTabs` containing it, the tab still exists in the DOM. A savvy user can remove the CSS class in DevTools and see/click the tab.
**Why it happens:** The existing architecture uses `disabledTabs` for "coming soon" state, not true hiding.
**How to avoid:** Use conditional rendering based on `showVolunteerTab` prop. When false, the volunteer tab is not in the JSX output at all.

### Pitfall 4: useAllSlices Still Filters to GEO_SLICE_TYPES

**What goes wrong:** After the schema migration and assignment service changes, users are assigned to unified/volunteer slices, but `useAllSlices` still returns only the 4 geo slices. `AppShell` gets `slices.unified === undefined` and `slices.volunteer === undefined`. The feeds never activate.
**Why it happens:** The `GEO_SLICE_TYPES` filter is explicit in `useAllSlices.ts` at line 6 and line 45.
**How to avoid:** Remove the `GEO_SLICE_TYPES.includes(sliceType)` filter in `useAllSlices` and include all returned slice types.

### Pitfall 5: AppShell Coming-Soon Placeholder Blocks Unified/Volunteer Feeds

**What goes wrong:** Even with `useAllSlices` returning unified data and `SliceTabBar` routing to the unified tab, AppShell has an explicit check `{(activeTab === 'unified' || activeTab === 'volunteer') && <div>Coming soon</div>}` that renders instead of the feed.
**Why it happens:** This guard was added in Phase 6 as a defensive fallback (AppShell line 237-241).
**How to avoid:** Remove the `Coming soon` guard for 'unified' and 'volunteer' in Phase 7. Add unified and volunteer to the CSS-hidden panel rendering pattern (the `GEO_TABS.map` loop at line 213), or render their panels separately after the geo loop.

### Pitfall 6: Unified Assignment Race Condition at Scale

**What goes wrong:** Two users log in simultaneously, both see the Unified #1 slice as available (< 6000), both are inserted. The `enforce_slice_cap` trigger handles the last one by raising `slice_full (P0001)`.
**Why it matters:** The `upsertSliceMember` function already handles `P0001` with retry logic that finds a sibling. The "check before insert" pattern for Unified adds one DB roundtrip before the insert, but the cap enforcement still applies. This is correct — if the check passes but the insert fails with `P0001`, the retry will find/create the sibling.
**How to avoid:** Rely on the existing `upsertSliceMember` retry logic — it already handles the `P0001` case. The "check before insert" is for the "already assigned" case (idempotency), not the "race" case.

### Pitfall 7: sibling_index Not in SliceInfo Causes Feed Header to Show Wrong Number

**What goes wrong:** SliceFeedPanel renders "Unified #undefined" or "#NaN" in the feed header.
**Why it happens:** `useAllSlices` select query doesn't include `sibling_index` and `SliceInfo` interface doesn't have `siblingIndex`.
**How to avoid:** Add `sibling_index` to the select in `useAllSlices` and add `siblingIndex: number` to `SliceInfo`. This is a Plan 07-03 concern but the column must be selected starting from Plan 07-01 when the type is extended.

---

## Code Examples

Verified patterns from the live codebase:

### Schema Migration — Extending CHECK Constraint

```sql
-- Source: pattern from 20260327000001_schema.sql
-- Drop old CHECK, recreate with new values
ALTER TABLE civic_spaces.slices
  DROP CONSTRAINT slices_slice_type_check;  -- exact name from schema.sql

ALTER TABLE civic_spaces.slices
  ADD CONSTRAINT slices_slice_type_check
  CHECK (slice_type IN ('federal', 'state', 'local', 'neighborhood', 'unified', 'volunteer'));

-- Notify PostgREST to reload schema after structural changes
-- IMPORTANT: required per project constraint (known from bug fix 2026-04-01)
NOTIFY pgrst, 'reload schema';
```

### Assignment Service — Full Extension Pattern

```typescript
// Source: services/slice-assignment/src/services/sliceAssigner.ts (live codebase)

const UNIFIED_GEOID = 'UNIFIED'
const VOLUNTEER_GEOID = 'VOLUNTEER'

// TODO(volunteer-role): Replace stub with real accounts API check once field name is confirmed.
// Change: add the role field to AccountData in accountsApi.ts, then:
//   return accountData.[fieldName] === true  (or equivalent)
function hasVolunteerRole(_accountData: AccountData): boolean {
  return false
}

async function isAlreadyAssignedToType(userId: string, sliceType: string, geoid: string): Promise<boolean> {
  const { data: existingSlices } = await supabase
    .schema('civic_spaces')
    .from('slices')
    .select('id')
    .eq('slice_type', sliceType)
    .eq('geoid', geoid)

  if (!existingSlices || existingSlices.length === 0) return false

  const sliceIds = existingSlices.map(s => s.id)
  const { data: membership } = await supabase
    .schema('civic_spaces')
    .from('slice_members')
    .select('slice_id')
    .eq('user_id', userId)
    .in('slice_id', sliceIds)
    .limit(1)

  return !!(membership && membership.length > 0)
}

async function removeMembershipByType(userId: string, sliceType: string, geoid: string): Promise<void> {
  const { data: slices } = await supabase
    .schema('civic_spaces')
    .from('slices')
    .select('id')
    .eq('slice_type', sliceType)
    .eq('geoid', geoid)

  if (!slices || slices.length === 0) return

  const sliceIds = slices.map(s => s.id)
  await supabase
    .schema('civic_spaces')
    .from('slice_members')
    .delete()
    .eq('user_id', userId)
    .in('slice_id', sliceIds)
  // decrement_slice_count trigger fires automatically on DELETE
}
```

### Frontend — AppShell Unified/Volunteer Feed Activation

```typescript
// Source: src/components/AppShell.tsx (live codebase — extension pattern)
// After Phase 7: extend the geo panel map to include unified and volunteer

const ACTIVE_FEED_TABS = ['neighborhood', 'local', 'state', 'federal', 'unified'] as const
// volunteer is separate because it's conditionally rendered

// In render — unified added to the CSS-hidden panel pattern:
{ACTIVE_FEED_TABS.map((tabKey) => {
  const slice = slices[tabKey]
  if (!slice) return null
  return (
    <div
      key={tabKey}
      className={activeTab === tabKey ? 'flex flex-col flex-1 overflow-hidden' : 'hidden'}
    >
      <SliceFeedPanel
        sliceId={slice.id}
        sliceName={TAB_LABELS[tabKey]}
        siblingIndex={slice.siblingIndex}
        onAuthorTap={setProfileUserId}
        activePostId={activePostIds[tabKey]}
        onNavigateToThread={(postId) => {
          setScrollToLatestMap(prev => ({ ...prev, [tabKey]: false }))
          setActivePostIds(prev => ({ ...prev, [tabKey]: postId }))
        }}
        scrollToLatest={scrollToLatestMap[tabKey]}
        scrollRef={scrollRefs.current[tabKey]}
      />
    </div>
  )
})}

{/* Volunteer feed — conditionally rendered only when user has volunteer role */}
{showVolunteerTab && slices['volunteer'] && (
  <div className={activeTab === 'volunteer' ? 'flex flex-col flex-1 overflow-hidden' : 'hidden'}>
    <SliceFeedPanel
      sliceId={slices['volunteer'].id}
      sliceName="Volunteer"
      siblingIndex={slices['volunteer'].siblingIndex}
      onAuthorTap={setProfileUserId}
      activePostId={activePostIds['volunteer']}
      onNavigateToThread={(postId) => {
        setScrollToLatestMap(prev => ({ ...prev, volunteer: false }))
        setActivePostIds(prev => ({ ...prev, volunteer: postId }))
      }}
      scrollToLatest={scrollToLatestMap['volunteer']}
    />
  </div>
)}
```

### Frontend — SliceTabBar Conditional Volunteer Tab

```typescript
// Source: src/components/SliceTabBar.tsx (live codebase — modification)
interface SliceTabBarProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  slices: Partial<Record<SliceType, SliceInfo>>
  disabledTabs?: TabKey[]
  showVolunteerTab?: boolean  // NEW
}

// In render — replace RIGHT_TABS.map with conditional:
const visibleRightTabs = showVolunteerTab ? RIGHT_TABS : []
// ...
<div className="flex flex-row flex-nowrap border-l border-gray-200">
  {visibleRightTabs.map(renderTab)}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4 geo slice types only (`CHECK` constraint) | 6 slice types including unified/volunteer | Phase 7 migration | Schema migration required; assignment service extended |
| `useAllSlices` returns only geo slices | `useAllSlices` returns all slice types | Phase 7 | Frontend can display unified/volunteer feeds from same hook |
| Volunteer tab: always visible, disabled/coming-soon | Volunteer tab: conditionally rendered (absent for non-Volunteers) | Phase 7 | `showVolunteerTab` prop pattern replaces `disabledTabs` for volunteer |
| Unified/Volunteer tabs show "Coming soon" placeholder | Unified/Volunteer tabs render `SliceFeedPanel` with real slice IDs | Phase 7 | Remove `Coming soon` guard in AppShell |

**Current confirmed as-built state (Phase 6 verified):**
- `SliceTabBar.tsx` (78 lines): LEFT_TABS has 5 items (N/L/S/F/Unified); RIGHT_TABS has Volunteer; both tabs always rendered with `disabledTabs` guard
- `AppShell.tsx` (270 lines): `disabledTabs={['unified', 'volunteer']}` on SliceTabBar; explicit `Coming soon` div for `activeTab === 'unified' || 'volunteer'`; GEO_TABS array only includes 4 geo types
- `useAllSlices.ts` (70 lines): `GEO_SLICE_TYPES = ['neighborhood', 'local', 'state', 'federal']` filter active; does NOT fetch `sibling_index`; does NOT return unified or volunteer
- `sliceAssigner.ts`: SLICE_ASSIGNMENTS array has exactly 4 geo entries; no unified/volunteer logic
- Schema: CHECK constraint at `20260327000001_schema.sql` allows only 4 geo slice_type values
- `SliceType` TypeScript type: includes 'unified' already, missing 'volunteer'

---

## Open Questions

1. **RLS for `get_boosted_feed_filtered` on new slice types**
   - What we know: RPC uses SECURITY INVOKER; `posts_select_slice_member` policy gates by membership (not type); if user is assigned to unified/volunteer slice, they can read those posts.
   - What's unclear: Nothing — this is confirmed safe. No RLS changes needed.
   - Recommendation: Document the analysis in the migration comments. The planner should note this is a resolved blocker (from STATE.md).

2. **Volunteer role API field name**
   - What we know: Not confirmed. Stub as `return false`. Document with TODO comment.
   - What's unclear: The field name and whether it's a boolean, a role array, or an enum string.
   - Recommendation: The `hasVolunteerRole(accountData)` function in sliceAssigner.ts is the single change point. Structure the AccountData type to have an optional `roles?: string[]` or `is_volunteer?: boolean` placeholder that the TODO comment explains.

3. **`hasJurisdiction` rename with expanded useAllSlices**
   - What we know: `hasJurisdiction: boolean` currently means "user has any slice memberships." After the extension, it would be true if a user has ONLY a unified slice (no geo assignment).
   - What's unclear: Whether this causes unexpected UI states.
   - Recommendation: Keep `hasJurisdiction` semantics as-is but update the guard in AppShell: the `NoJurisdictionBanner` should only show if the user has no geo slices specifically (not just no memberships). Consider using `!!slices.federal` as the "real" jurisdiction check since Federal is always assigned when jurisdiction exists.

4. **Scroll ref for Volunteer panel**
   - What we know: The `scrollRefs` map in AppShell is initialized from `GEO_TABS` only. Adding volunteer means adding a scroll ref for it.
   - What's unclear: Whether the volunteer feed needs scroll position preservation (it is a single tab, user can't switch away and back to the same tab in a way that loses scroll... wait, they can if they switch to another tab).
   - Recommendation: Add a scroll ref for volunteer when it's rendered. Planner should include this in 07-04.

---

## Sources

### Primary (HIGH confidence)

- Live codebase — `supabase/migrations/20260327000001_schema.sql` — confirmed slice_type CHECK constraint values and UNIQUE constraint structure
- Live codebase — `supabase/migrations/20260327000002_rls.sql` — confirmed posts_select_slice_member policy is membership-based (not type-based)
- Live codebase — `supabase/migrations/20260328200000_phase5_moderation.sql` — confirmed get_boosted_feed_filtered uses SECURITY INVOKER and filters by p_slice_id only
- Live codebase — `supabase/migrations/20260327000003_triggers.sql` — confirmed decrement_slice_count trigger fires on DELETE, enforce_slice_cap on INSERT
- Live codebase — `services/slice-assignment/src/services/sliceAssigner.ts` — confirmed upsertSliceMember pattern, findActiveSliceForGeoid, SLICE_ASSIGNMENTS array
- Live codebase — `src/hooks/useAllSlices.ts` — confirmed GEO_SLICE_TYPES filter, missing sibling_index in select
- Live codebase — `src/types/database.ts` — confirmed SliceType has 'unified' but not 'volunteer'; SliceInfo lacks siblingIndex
- Live codebase — `src/components/AppShell.tsx` — confirmed disabledTabs pattern, Coming soon guard, GEO_TABS array
- Live codebase — `src/components/SliceTabBar.tsx` — confirmed RIGHT_TABS always renders volunteer; disabledTabs approach
- `.planning/phases/06-hub-expansion/06-VERIFICATION.md` — Phase 6 verified state confirmed (5/5 must-haves, tsc clean)
- `.planning/phases/07-new-slice-types/07-CONTEXT.md` — locked decisions on assignment strategy, role stub, visibility gating

### Secondary (MEDIUM confidence)

- None — all findings are from the live codebase.

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages needed; all patterns derived from live code
- Schema migration: HIGH — CHECK constraint structure and ALTER pattern confirmed in migration SQL
- Assignment service: HIGH — sliceAssigner.ts patterns read directly; "check before insert" rationale is domain logic from CONTEXT.md
- RLS analysis: HIGH — RPC and policy SQL read directly; SECURITY INVOKER + membership-based gate is unambiguous
- Frontend wiring: HIGH — AppShell and SliceTabBar code read directly; pitfalls confirmed from live code
- Volunteer role stub: HIGH — stub is by design (confirmed in CONTEXT.md); TODO pattern is standard

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable — no fast-moving external dependencies; only risk is accounts team confirming volunteer role field)
