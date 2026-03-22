---
phase: 05-controlled-drug-approval-flow-to-specialist-with-patient-based-quota-and-pesara-category
plan: 02
subsystem: specialist-dashboard
tags: [react, tanstack-query, supabase, quota, pesara, controlled-drug]
dependency_graph:
  requires: [05-01]
  provides: [specialist-sub-tabs, quota-badge-display, borrow-facility-flow]
  affects: [SpecialistDashboard, dispensing_requests]
tech_stack:
  added: []
  patterns:
    - Nested Tabs (Regular/Pesara sub-tabs inside Controlled Drug tab)
    - Quota count query using unique IC set per drug_id (deduplication in-memory)
    - Conditional dialog content based on is_pesara and quota exhaustion state
key_files:
  created: []
  modified:
    - src/pages/SpecialistDashboard.tsx
    - src/pages/SpecialistDashboard.test.tsx
decisions:
  - "quotaCounts.regular[drug_id] uses unique patient IC set — same patient dispensed twice counts once toward quota"
  - "Pesara approve dialog skips quota exhausted alert and borrow field — isApproveTargetPesara gates the check"
  - "borrowFacility reset on both dialog onOpenChange and explicit Cancel click to prevent stale state across dialogs"
  - "approveMutation invalidates both specialist-quota-counts and specialist-drug-quotas to force fresh badge calculations"
metrics:
  duration: 3m
  completed: "2026-03-22T10:29:36Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 05 Plan 02: Specialist Dashboard Regular/Pesara Sub-tabs and Quota Badge Summary

**One-liner:** Regular/Pesara sub-tabs with per-row quota usage badges and conditional borrow-from-facility input in the specialist approve dialog.

## What Was Built

Added nested sub-tabs inside the Controlled Drug tab of SpecialistDashboard:

- **Regular sub-tab** shows controlled drug requests where `is_pesara = false`. Each row displays a quota badge (healthy/warning/exhausted/no-quota) computed from `quotaCounts.regular[drug_id]` (unique patient IC count) vs the drug's annual `quota_limit` from `drug_quotas`.
- **Pesara sub-tab** shows requests where `is_pesara = true`. Each row shows a blue "Unlimited" badge — Pesara patients are exempt from annual quotas.
- **Approve dialog** conditionally shows a destructive `Alert` and "Borrowing quota from facility" `Input` when quota is exhausted and the request is not for a Pesara patient. The Confirm Approval button is disabled until the borrow field is filled.
- **approveMutation** now saves `borrowed_from_facility` (null when empty) and invalidates quota-counts + drug-quotas query keys on success.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add quota count query + Regular/Pesara sub-tabs with quota badges | 18aba59 | src/pages/SpecialistDashboard.tsx |
| 2 | Add SpecialistDashboard tests for sub-tabs, quota badges, and borrow field | 667d679 | src/pages/SpecialistDashboard.test.tsx |

## Verification

- `npx vitest run src/pages/SpecialistDashboard.test.tsx src/lib/quotaHelpers.test.ts` — 33 tests passed
- `npm run build` — production build succeeded (1,367 kB bundle, 0 errors)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/pages/SpecialistDashboard.tsx exists and contains all required patterns
- src/pages/SpecialistDashboard.test.tsx exists with 6 tests (5 new + 1 existing)
- Commit 18aba59 exists (Task 1)
- Commit 667d679 exists (Task 2)
