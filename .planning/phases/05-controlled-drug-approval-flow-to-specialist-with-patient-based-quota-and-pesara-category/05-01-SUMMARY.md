---
phase: 05-controlled-drug-approval-flow-to-specialist-with-patient-based-quota-and-pesara-category
plan: "01"
subsystem: dispensing-requests
tags: [types, quota, pesara, form, tdd]
dependency_graph:
  requires: []
  provides: [is_pesara-db-types, quotaBadgeState-helper, pesara-checkbox-ui]
  affects: [SpecialistDashboard, FmsDashboard, dispensing_requests-inserts]
tech_stack:
  added: []
  patterns: [TDD RED-GREEN, Radix Checkbox onCheckedChange, ResizeObserver polyfill]
key_files:
  created:
    - src/lib/quotaHelpers.ts (quotaBadgeState + QUOTA_BADGE_CLASS + QUOTA_BADGE_LABEL additions)
    - src/lib/quotaHelpers.test.ts (quotaBadgeState describe blocks)
    - src/pages/DoctorRequest.test.tsx (Pesara describe block)
  modified:
    - src/integrations/supabase/types.ts
    - src/lib/quotaHelpers.ts
    - src/lib/quotaHelpers.test.ts
    - src/pages/DoctorRequest.tsx
    - src/pages/DoctorRequest.test.tsx
    - src/test/setup.ts
key_decisions:
  - "onCheckedChange (not onChange) must be used on Radix Checkbox — silently ignores onChange"
  - "ResizeObserver polyfill added to src/test/setup.ts to unblock Radix UI tests in JSDOM"
  - "quotaBadgeState threshold: >=80% = warning, >=100% = exhausted (patient-based quota semantics)"
metrics:
  duration: "3m"
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_changed: 6
---

# Phase 05 Plan 01: Data Foundation — Pesara Types, quotaBadgeState Helper, and DoctorRequest Checkbox Summary

**One-liner:** Added is_pesara/borrowed_from_facility DB types, quotaBadgeState helper with QUOTA_BADGE_CLASS/LABEL constants, and Pesara checkbox field to DoctorRequest form with TDD coverage.

## Tasks Completed

| Task | Name | Commit | Files Changed |
|------|------|--------|---------------|
| 1 | Update Supabase types + add quotaBadgeState helper with tests | 2ff9b45 | types.ts, quotaHelpers.ts, quotaHelpers.test.ts |
| 2 | Add Pesara checkbox to DoctorRequest form + test | 03034c3 | DoctorRequest.tsx, DoctorRequest.test.tsx, test/setup.ts |

## What Was Built

### Task 1: Supabase Types + quotaBadgeState Helper

**types.ts** — `dispensing_requests` Row, Insert, and Update blocks now include:
- `is_pesara: boolean` (Row); `is_pesara?: boolean` (Insert/Update)
- `borrowed_from_facility: string | null` (Row); `borrowed_from_facility?: string | null` (Insert/Update)

**quotaHelpers.ts** — new exports added at end of file:
- `QuotaBadgeState` type: `"healthy" | "warning" | "exhausted" | "no-quota"`
- `quotaBadgeState(used, limit)`: returns healthy when <80%, warning when >=80% and <100%, exhausted when >=100%, no-quota when limit is null
- `QUOTA_BADGE_CLASS`: Tailwind class strings per state (green/amber/red/gray)
- `QUOTA_BADGE_LABEL`: label factory functions per state

### Task 2: Pesara Checkbox in DoctorRequest Form

- `is_pesara: z.boolean().default(false)` added to Zod schema
- `is_pesara: false` added to `useForm` defaultValues and both `form.reset()` call sites
- Pesara `<Checkbox>` field rendered between IC field and drug selector with label "Pesara (Government Retiree)" and helper text mentioning "Pesara Kerajaan"
- `is_pesara: values.is_pesara` included in `dispensing_requests` insert payload
- `Checkbox` and `Label` imports added from shadcn/ui

## Test Results

- `quotaHelpers.test.ts`: 27 tests pass (13 existing + 14 new)
- `DoctorRequest.test.tsx`: 8 tests pass (6 existing + 2 new Pesara tests + 1 payload test)
- `npm run build`: TypeScript compilation successful

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ResizeObserver not defined in JSDOM test environment**
- **Found during:** Task 2 — first test run after adding Radix `Checkbox` component
- **Issue:** Radix UI's `@radix-ui/react-use-size` calls `new ResizeObserver()` which JSDOM does not implement, throwing `ReferenceError: ResizeObserver is not defined` and failing all 8 DoctorRequest tests
- **Fix:** Added `global.ResizeObserver` stub class to `src/test/setup.ts`
- **Files modified:** src/test/setup.ts
- **Commit:** 03034c3

## Self-Check: PASSED

All 6 key files found. Both task commits (2ff9b45, 03034c3) verified in git log. Build passes. 35 tests pass.
