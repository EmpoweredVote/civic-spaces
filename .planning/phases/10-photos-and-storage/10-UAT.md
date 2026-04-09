---
status: complete
phase: 10-photos-and-storage
source: [10-01-SUMMARY.md, 10-02-SUMMARY.md]
started: 2026-04-09T00:00:00Z
updated: 2026-04-09T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Wikipedia hero images load for geo slices
expected: On the State tab, hero shows Indiana State Capitol. On Federal tab, US Capitol. On County tab, Monroe County Courthouse. Photos load automatically with no broken image state.
result: pass

### 2. Jurisdiction display names in hero banner
expected: The hero banner pill / label shows human-readable jurisdiction names (e.g. "Monroe County", "Indiana", "United States") — NOT raw geoid strings like "18097" or "18".
result: pass

### 3. Tab labels renamed
expected: The two city-level tabs are now labeled "Local" (neighborhood slice) and "County" (local/district slice) — not "Neighborhood" or "Local" as they were before.
result: pass

### 4. Tabs hidden for unjoined slices
expected: You only see tab buttons for slices you actually belong to. If a user has no Volunteer slice, the Volunteer tab does not appear in the tab bar at all.
result: pass

### 5. Unified tab visible
expected: A "Unified" tab appears in the tab bar (you were backfilled into the unified slice). Switching to it shows the unified slice forum feed with hero banner.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
