---
phase: 05-controlled-drug-approval-flow-to-specialist-with-patient-based-quota-and-pesara-category
plan: 03
subsystem: ui
tags: [react, supabase, tanstack-query, tailwind, shadcn-ui]

# Dependency graph
requires:
  - phase: 05-01
    provides: is_pesara column on dispensing_requests, DoctorRequest Pesara checkbox
  - phase: 05-02
    provides: SpecialistDashboard Regular/Pesara sub-tabs, quota badge, borrow facility field
provides:
  - FmsDashboard Pesara column in annual quota table showing count with (Unlimited) suffix
  - Refined ytdCounts query excluding Pesara patients and deduplicating by unique IC
  - Separate pesaraCounts query counting Pesara fulfilled requests per drug
affects: [phase-05-visual-verification, FmsDashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [unique-IC-deduplication-via-Set, dual-supabase-query-for-pesara-vs-regular]

key-files:
  created: []
  modified:
    - src/pages/FmsDashboard.tsx
    - src/pages/FmsDashboard.test.tsx

key-decisions:
  - "waitFor() needed in Pesara header test — stockLoading guard delays table render until async query resolves"
  - "ytdCounts uses Set for unique patient IC deduplication (same patient dispensed twice counts once toward quota)"
  - "pesaraCounts uses simple increment (not Set) because Pesara quota is unlimited and we track volume not unique patients"

patterns-established:
  - "Dual query pattern: separate eq('is_pesara', false) and eq('is_pesara', true) queries for regular vs Pesara counts"
  - "IIFE in JSX cell for inline conditional styling without extracting a helper component"

requirements-completed: [CDQ-04]

# Metrics
duration: 12min
completed: 2026-03-23
---

# Phase 05 Plan 03: FmsDashboard Pesara Column Summary

**Pesara column added to FmsDashboard annual quota table with unique-IC-deduplicated ytdCounts and separate unlimited Pesara count query**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-23T06:19:15Z
- **Completed:** 2026-03-23T06:31:15Z
- **Tasks:** 1 of 1 auto tasks (checkpoint pending user verification)
- **Files modified:** 2

## Accomplishments

- Refined ytdCounts query to exclude Pesara patients (`.eq("is_pesara", false)`) and count unique patient ICs via `Set` so the same patient dispensed multiple times counts once toward quota
- Added separate pesaraCounts query selecting Pesara fulfilled requests (`.eq("is_pesara", true)`) per drug for the year
- Added "Pesara" column header to the Controlled Drug Annual Quota table
- Each row now shows pesaraCount with "(Unlimited)" suffix — bold when count > 0, muted when 0
- Updated empty-state `colSpan` from 6 to 7
- Updated FmsDashboard.test.tsx to handle three-level `.eq()` mock chain and added async Pesara header assertion

## Task Commits

1. **Task 1: Add Pesara count query + Pesara column to FmsDashboard quota table** - `5d6ede7` (feat)

## Files Created/Modified

- `src/pages/FmsDashboard.tsx` — dual Pesara/regular queries, Pesara column header and cell in annual quota table
- `src/pages/FmsDashboard.test.tsx` — extended mock chain for triple .eq() calls, async Pesara header test

## Decisions Made

- `waitFor()` required for Pesara header test: the quota table is guarded by `stockLoading ? <Skeleton> : <Table>`, so the `<TableHeader>` only renders after the drugStock query resolves. Synchronous `getByText` fails; async `waitFor` works.
- pesaraCounts uses a simple counter (not Set) because the Pesara category has no quota ceiling — tracking unique patients is not semantically meaningful here, volume is sufficient.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed Pesara header test from sync to async**
- **Found during:** Task 1 (test authoring)
- **Issue:** `screen.getByText("Pesara")` failed synchronously because `stockLoading=true` during initial render shows `<Skeleton>` instead of `<Table>`, hiding the header until the mock query resolves
- **Fix:** Wrapped assertion in `waitFor(() => expect(...))` and made test async; imported `waitFor` from `@testing-library/react`
- **Files modified:** src/pages/FmsDashboard.test.tsx
- **Verification:** npx vitest run — 3 tests pass
- **Committed in:** 5d6ede7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test timing)
**Impact on plan:** Minor fix to test approach only. Production code unchanged from plan spec.

## Issues Encountered

None beyond the async test timing fix documented above.

## User Setup Required

None — no external service configuration required. DB migration (is_pesara column) was handled in Plan 05-01.

## Next Phase Readiness

- Full Phase 05 implementation complete pending visual checkpoint confirmation
- DoctorRequest Pesara checkbox, SpecialistDashboard sub-tabs and quota badges, FmsDashboard Pesara column all implemented
- Visual checkpoint (Task 2) requires user to verify the integrated flow end-to-end in the browser

---
*Phase: 05-controlled-drug-approval-flow-to-specialist-with-patient-based-quota-and-pesara-category*
*Completed: 2026-03-23*

## Self-Check: PASSED

- FOUND: src/pages/FmsDashboard.tsx
- FOUND: src/pages/FmsDashboard.test.tsx
- FOUND: commit 5d6ede7
