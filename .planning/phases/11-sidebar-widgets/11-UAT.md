---
status: complete
phase: 11-sidebar-widgets
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md, 11-04-SUMMARY.md]
started: 2026-04-09T00:00:00Z
updated: 2026-04-09T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Desktop sidebar visible
expected: On desktop (wide viewport), a sidebar column is visible to the right of the feed containing the three widget areas (Compass, Representatives, Tools).
result: pass

### 2. Mobile collapsible sidebar
expected: On mobile (narrow viewport), the sidebar is not visible by default. A collapsible section appears below the hero banner that can be expanded to show the widgets.
result: issue
reported: "I'm almost able to pass this, but there is way too much text on the Hero Banner on mobile, the words don't fit. Maybe get rid of the bottom 'Sentence' in mobile? Or put it elsewhere?"
severity: minor

### 3. Compass widget — calibration state
expected: If you have calibrated your Compass (answered 3+ topics at compassv2.empowered.vote), the sidebar shows a purple radar/spider chart. If uncalibrated, it shows a "Calibrate Now" prompt with a button linking to the Compass.
result: pass

### 4. Representatives widget — rep cards
expected: The "Representing This Community" widget shows elected official cards with name, title, and photo (or a silhouette fallback if no photo). No party label or affiliation appears anywhere on the cards.
result: pass

### 5. Tab-aware representatives
expected: Switching slice tabs changes which representatives appear. Federal tab shows US Congress/President. State tab shows Indiana legislators/Governor. County tab shows county officials. Local tab shows city council/Mayor. Unified tab shows no representatives widget.
result: pass

### 6. Volunteer tab — sidebar hidden
expected: Switching to the Volunteer tab (if you have it) hides the entire sidebar — no widget cards appear at all on that tab.
result: pass

### 7. Tools widget
expected: A "Tools" widget appears in the sidebar with at least two tool links: one for Compass (compassv2.empowered.vote) and one for Essentials. Each opens in a new browser tab. No "coming soon" or disabled tools appear.
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Mobile collapsible sidebar accessible below hero banner without hero text overflow"
  status: failed
  reason: "User reported: too much text on the Hero Banner on mobile, the words don't fit. Suggested: hide the description sentence on mobile, or move it elsewhere."
  severity: minor
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
