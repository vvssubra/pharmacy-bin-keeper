---
phase: 05-controlled-drug-approval-flow-to-specialist-with-patient-based-quota-and-pesara-category
verified: 2026-03-24T07:51:00Z
status: passed
score: 10/10 must-haves verified
gaps: []
---

# Phase 5: Controlled Drug Quota & Pesara Verification Report

**Phase Goal:** Implement controlled drug approval flow to specialist with patient-based quota tracking and Pesara (Government Retiree) category support
**Verified:** 2026-03-24T07:51:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Doctor form renders a Pesara checkbox below the IC field | VERIFIED | `DoctorRequest.tsx` line 206-224: `<FormField name="is_pesara">` with `Checkbox` + label "Pesara (Government Retiree)" and helper text "Pesara Kerajaan" |
| 2 | Submitting sends `is_pesara: false/true` to `dispensing_requests` insert | VERIFIED | `DoctorRequest.tsx` line 110: `is_pesara: values.is_pesara` in the `supabase.from("dispensing_requests").insert({...})` payload |
| 3 | Specialist sees Regular and Pesara sub-tabs inside the Controlled Drug tab | VERIFIED | `SpecialistDashboard.tsx` lines 300-430: nested `<Tabs defaultValue="regular">` with `TabsTrigger value="regular"` and `TabsTrigger value="pesara"` |
| 4 | Regular sub-tab rows show quota usage badge (healthy/warning/exhausted) | VERIFIED | `SpecialistDashboard.tsx` lines 344-363: `quotaBadgeState(usedCount, quotaLimit)` → `QUOTA_BADGE_CLASS[badgeState]` / `QUOTA_BADGE_LABEL[badgeState](usedCount, quotaLimit)` per row |
| 5 | Pesara sub-tab rows show a blue "Unlimited" badge | VERIFIED | `SpecialistDashboard.tsx` line 416: `<Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">Unlimited</Badge>` |
| 6 | Approve dialog shows quota exhausted alert and borrow-from-facility field when quota is exhausted | VERIFIED | `SpecialistDashboard.tsx` lines 568-584: `{isQuotaExhausted && (<><Alert variant="destructive">...quota exhausted...</Alert><Input id="borrow-facility" .../></>)}` |
| 7 | Approve button disabled until borrow facility is filled when quota is exhausted | VERIFIED | `SpecialistDashboard.tsx` line 597: `disabled={approveMutation.isPending \|\| (isQuotaExhausted && borrowFacility.trim() === "")}` |
| 8 | Approved request saves `borrowed_from_facility` to the record | VERIFIED | `SpecialistDashboard.tsx` line 205: `borrowed_from_facility: borrowFacility.trim() \|\| null` in `.update({...})` mutation |
| 9 | Pesara approve dialog does NOT show quota alert or borrow field | VERIFIED | `isApproveTargetPesara` guard (`line 192-193`) makes `isQuotaExhausted` false for Pesara patients — alert and borrow field are fully conditional on `isQuotaExhausted` |
| 10 | FmsDashboard annual quota table shows Pesara column with count and "(Unlimited)" | VERIFIED | `FmsDashboard.tsx` line 468: `<TableHead className="text-right">Pesara</TableHead>`; lines 503-508: `{pesaraCount} (Unlimited)` cell rendered per controlled drug row |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/integrations/supabase/types.ts` | `is_pesara` and `borrowed_from_facility` on Row/Insert/Update | VERIFIED | Lines 117-118 (Row), 138-139 (Insert), 159-160 (Update): both fields present with correct types (`boolean`, `string \| null`) |
| `src/lib/quotaHelpers.ts` | `quotaBadgeState`, `QUOTA_BADGE_CLASS`, `QUOTA_BADGE_LABEL` exports | VERIFIED | Lines 34-55: all four exports present (`QuotaBadgeState` type, `quotaBadgeState` function, `QUOTA_BADGE_CLASS` record, `QUOTA_BADGE_LABEL` record); original helpers untouched |
| `src/lib/quotaHelpers.test.ts` | Tests for `quotaBadgeState` at boundary thresholds | VERIFIED | 27 tests pass; `quotaBadgeState`, `QUOTA_BADGE_CLASS`, `QUOTA_BADGE_LABEL` all covered |
| `src/pages/DoctorRequest.tsx` | Pesara checkbox in form; `is_pesara` in Zod schema and insert payload | VERIFIED | Line 32: `is_pesara: z.boolean().default(false)`; line 73: `is_pesara: false` in defaultValues; line 110: in insert payload; line 154: reset includes `is_pesara: false`; uses `onCheckedChange` not `onChange` |
| `src/pages/DoctorRequest.test.tsx` | Pesara label, helper text, and `is_pesara: false` payload tests | VERIFIED | Lines 111-159: three tests in `describe("DoctorRequest Pesara checkbox")` — all 8 tests pass |
| `src/pages/SpecialistDashboard.tsx` | Regular/Pesara sub-tabs; quota badge per row; borrow field; extended approve mutation | VERIFIED | Lines 28-430: `quotaBadgeState` imported and used; sub-tabs present; `borrowFacility` state wired; `borrowed_from_facility` in update mutation |
| `src/pages/SpecialistDashboard.test.tsx` | Tests for sub-tabs, quota badge, Unlimited badge, empty states | VERIFIED | Lines 102-247: 5 tests in `describe("Controlled Drug sub-tabs")` — all 6 tests pass |
| `src/pages/FmsDashboard.tsx` | Pesara column in quota table; ytdCounts excludes Pesara; pesaraCounts query | VERIFIED | Lines 141-185: ytdCounts uses `.eq("is_pesara", false)` + Set dedup; pesaraCounts uses `.eq("is_pesara", true)`; line 468: Pesara table header; lines 503-508: Pesara cell |
| `src/pages/FmsDashboard.test.tsx` | Test for Pesara column header | VERIFIED | Lines 61-64: `it("renders Pesara column header in annual quota table")` — all 3 tests pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DoctorRequest.tsx` | `supabase.from('dispensing_requests').insert` | `is_pesara: values.is_pesara` in payload | WIRED | Line 110 confirmed; test at line 124-158 asserts `is_pesara: false` in mock insert call |
| `SpecialistDashboard.tsx` | `supabase.from('dispensing_requests').select` | quota count query with `.eq("is_pesara", false/true)` | WIRED | Lines 97-111: two parallel `Promise.all` queries filtering by `is_pesara` |
| `SpecialistDashboard.tsx` | `src/lib/quotaHelpers.ts` | `import { quotaBadgeState, QUOTA_BADGE_CLASS, QUOTA_BADGE_LABEL }` | WIRED | Line 28: import confirmed; lines 348, 361-362: all three used in Regular tab row rendering |
| `SpecialistDashboard.tsx` | `supabase.from('dispensing_requests').update` | `borrowed_from_facility: borrowFacility.trim() \|\| null` in approve mutation | WIRED | Line 205: field included in update; `setBorrowFacility("")` in onSuccess (line 214) |
| `FmsDashboard.tsx` | `supabase.from('dispensing_requests').select` | ytdCounts refined with `.eq("is_pesara", false)` + separate pesaraCounts query | WIRED | Lines 151 and 177: both `is_pesara` filters confirmed; `new Set()` dedup on lines 154-161 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CDQ-01 | 05-01 | Doctor can mark patient as Pesara; `is_pesara` saved to dispensing_requests | SATISFIED | `DoctorRequest.tsx`: checkbox, Zod field, insert payload; `types.ts`: column typed; test coverage |
| CDQ-02 | 05-02 | Specialist sees Regular/Pesara sub-tabs with quota badges and "Unlimited" badges | SATISFIED | `SpecialistDashboard.tsx`: nested Tabs, `quotaBadgeState` per Regular row, blue Unlimited badge in Pesara tab; tests cover both sub-tabs |
| CDQ-03 | 05-02 | Specialist approve dialog shows borrow-from-facility field when quota exhausted; button disabled; `borrowed_from_facility` saved | SATISFIED | `SpecialistDashboard.tsx`: `isQuotaExhausted` guard, Alert + Input in dialog, disabled prop, `borrowed_from_facility` in update |
| CDQ-04 | 05-03 | FmsDashboard quota table has Pesara column; regular YTD excludes Pesara | SATISFIED | `FmsDashboard.tsx`: Pesara `<TableHead>`, pesara cell per row, ytdCounts `.eq("is_pesara", false)`, pesaraCounts `.eq("is_pesara", true)` |

No orphaned requirements — all four CDQ IDs declared in plan frontmatter, all four confirmed covered.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | — |

No stub implementations, empty returns, TODO/FIXME comments, or console-only handlers found in Phase 5 files.

---

### Test Run Results

```
npx vitest run src/lib/quotaHelpers.test.ts src/pages/DoctorRequest.test.tsx
                src/pages/SpecialistDashboard.test.tsx src/pages/FmsDashboard.test.tsx

Test Files  4 passed (4)
     Tests  44 passed (44)
  Duration  1.68s
```

TypeScript build: `npm run build` — 3217 modules transformed, 0 type errors.

Note: `AppSidebar.test.tsx` has a pre-existing failure (pharmacist role missing admin-only Role Management nav) that predates Phase 5 — excluded from this verification as directed.

---

### Human Verification

Visual flow checkpoint completed by user prior to this verification (approved checkpoint documented in 05-03-PLAN.md Task 2 checkpoint). No further human verification required.

---

## Gaps Summary

No gaps. All 10 observable truths verified, all 4 artifacts substantive and wired, all 4 CDQ requirements satisfied, build clean, 44 tests green.

---

_Verified: 2026-03-24T07:51:00Z_
_Verifier: Claude (gsd-verifier)_
