---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/NotificationBell.tsx
autonomous: true

must_haves:
  truths:
    - "Mobile notification Sheet renders without TypeScript errors"
    - "NotificationList in mobile path receives only props it accepts"
  artifacts:
    - path: "src/components/NotificationBell.tsx"
      provides: "NotificationBell with clean mobile Sheet path"
  key_links: []
---

<objective>
Remove the stale `onOpenProfile={onOpenProfile}` prop from the mobile Sheet's NotificationList call in NotificationBell.tsx.

Purpose: Phase 8 removed the `onOpenProfile` prop from NotificationList's interface but the mobile Sheet path still passes it, causing a TypeScript error. The desktop popover path already omits it correctly.
Output: Clean NotificationBell.tsx with no stale props.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/NotificationBell.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove stale onOpenProfile prop from mobile NotificationList</name>
  <files>src/components/NotificationBell.tsx</files>
  <action>
    Delete line 115 (`onOpenProfile={onOpenProfile}`) from the mobile Sheet's NotificationList call (around lines 113-118).

    The resulting NotificationList call inside Sheet.Content should look like:
    ```
    <NotificationList
      onClose={() => setIsOpen(false)}
      onNavigateToThread={onNavigateToThread}
      onNavigateToSliceThread={onNavigateToSliceThread}
    />
    ```

    Also check if `onOpenProfile` is declared/destructured earlier in the component. If removing line 115 makes it unused, remove the declaration too to avoid unused-variable lint errors.
  </action>
  <verify>Run `npx tsc --noEmit` and confirm no errors in NotificationBell.tsx. Run `npx eslint src/components/NotificationBell.tsx` and confirm no unused variable warnings.</verify>
  <done>NotificationBell.tsx compiles cleanly with no stale props passed to NotificationList in the mobile path.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors related to NotificationBell.tsx
- Mobile Sheet NotificationList call matches desktop popover pattern (no onOpenProfile)
</verification>

<success_criteria>
- Line 115 (`onOpenProfile={onOpenProfile}`) removed from mobile Sheet path
- No unused variables remain from the removal
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/001-remove-stale-onopenprofile-mobile-not/001-SUMMARY.md`
</output>
