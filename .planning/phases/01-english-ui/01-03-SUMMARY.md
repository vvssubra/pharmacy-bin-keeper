---
phase: 01-english-ui
plan: 03
subsystem: ui
tags: [react, typescript, translation, i18n, dashboard, drug-master, bin-card, ledger]

# Dependency graph
requires:
  - phase: 01-english-ui/01-02
    provides: "AppSidebar, DrugFormDialog, OpeningBalanceDialog, ProtectedRoute, NoPermission — all translated to English"
provides:
  - "Index.tsx (Dashboard) fully in English — status badges CRITICAL/LOW/EXCESS, column headers, activity labels, pending requests"
  - "DrugMaster.tsx fully in English — Add Drug button, search, column headers, deactivation dialog"
  - "BinCard.tsx fully in English — Stock Storage Location, Current Balance, bin card table headers"
  - "DrugLedger.tsx fully in English — filter labels, column headers, pagination text"
  - "date-fns ms locale removed from Index.tsx"
  - "Index.test.tsx passes GREEN"
affects:
  - "01-english-ui/01-04: doctor-facing pages that may reference shared status label patterns"
  - "01-english-ui/01-05: any remaining pages using similar status badge patterns"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "StockStatus union type uses English values (CRITICAL, LOW, EXCESS, NO LEVEL, NORMAL) — must be used consistently across all pages"
    - "date-fns format() calls use no locale option — English month names rendered by default"
    - "Filter select options use DB values as select item values, display labels in English"

key-files:
  created: []
  modified:
    - src/pages/Index.tsx
    - src/pages/DrugMaster.tsx
    - src/pages/BinCard.tsx
    - src/pages/DrugLedger.tsx

key-decisions:
  - "StockStatus type values changed from Malay (KRITIKAL/RENDAH/LEBIHAN/TIADA PARAS) to English (CRITICAL/LOW/EXCESS/NO LEVEL) — type, STATUS_CONFIG keys, STATUS_ORDER keys, and getStatus() return values all updated together"
  - "date-fns ms locale import removed entirely from Index.tsx — no mock or replacement needed, format() defaults to English"
  - "TypeScript object keys, DB field names (tarikh, jenis, namaPegawai, sumber, terimaan, keluaran), and Supabase filter values left unchanged as instructed"
  - "BinCard pagination strings, section headers, and table column headers translated beyond the plan's minimum list — all visible Malay strings found and replaced"

patterns-established:
  - "Status badge display strings must always use English (CRITICAL/LOW/EXCESS/NORMAL) matching the StockStatus type"
  - "Select items: use DB/code values for value= attributes, English labels for display text"

requirements-completed: [ENGL-01, ENGL-03, ENGL-05]

# Metrics
duration: 8min
completed: 2026-03-16
---

# Phase 01 Plan 03: Dashboard and Drug Inventory Pages Summary

**Four core pharmacy UI pages (Index, DrugMaster, BinCard, DrugLedger) fully translated to English with date-fns locale removed and Index.test.tsx GREEN (5/5 tests)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T22:46:07Z
- **Completed:** 2026-03-15T22:54:07Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Dashboard (Index.tsx): All stat card labels, status badges, column headers, activity labels, pending requests section translated; date-fns `ms` locale import and all usages removed; `StockStatus` type values changed to English throughout
- DrugMaster.tsx: Subtitle, buttons, search placeholder, column headers, empty states, tooltips, toast, deactivation dialog all translated
- BinCard.tsx: Status labels, navigation, PDF/receipt buttons, drug detail field labels, storage location section, stock levels table, filter bar, bin card table headers, pagination fully translated; "BAKI DIBAWA KE HADAPAN" changed to "BALANCE BROUGHT FORWARD"
- DrugLedger.tsx: Status labels, loading state, back button, field labels, filter bar, table headers, empty state, pagination text all translated
- Index.test.tsx passes GREEN (5/5 tests confirm ENGL-03 status badge translations)

## Task Commits

Each task was committed atomically:

1. **Task 1: Translate Index.tsx (Dashboard)** - `8533e33` (feat)
2. **Task 2: Translate DrugMaster.tsx, BinCard.tsx, DrugLedger.tsx** - `64472a1` (feat)

## Files Created/Modified

- `src/pages/Index.tsx` - Dashboard page: all Malay user-visible strings replaced; StockStatus type, STATUS_CONFIG, STATUS_ORDER updated to English keys; date-fns ms locale removed
- `src/pages/DrugMaster.tsx` - Drug master list page: all Malay UI strings replaced
- `src/pages/BinCard.tsx` - Bin card / stock register page: all Malay UI strings replaced including table headers, section labels, pagination
- `src/pages/DrugLedger.tsx` - Drug ledger page: all Malay UI strings replaced including filter labels, column headers, empty state, pagination

## Decisions Made

- Changed `StockStatus` union type values from Malay literals to English (`CRITICAL`, `LOW`, `EXCESS`, `NO LEVEL`) — required updating STATUS_CONFIG keys, STATUS_ORDER keys, getStatus() return values, and the counts useMemo in one atomic change
- Removed date-fns `ms` locale entirely rather than replacing with `enUS` — `format()` and `formatDistanceToNow()` default to English locale when no `locale` option is provided
- BinCard.tsx had additional Malay strings beyond the plan's inventory (table section header, pagination buttons, Stock Levels table column headers like "Tahun", "Maksimum", "JUMLAH") — all were translated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Coverage] Translated additional Malay strings in BinCard.tsx not in the plan's inventory**
- **Found during:** Task 2 (BinCard.tsx translation)
- **Issue:** Plan's string list for BinCard was not exhaustive — additional Malay strings found: "Tahun" (Year), "Maksimum (Kuantiti)" (Maximum (Quantity)), "Menokok (Kuantiti)" (Reorder (Quantity)), "Minimum (Kuantiti)" (Minimum (Quantity)), "JUMLAH" (TOTAL), "Bahagian B — Transaksi Stok" (Section B — Stock Transactions), "Nama Pesakit / Terima Daripada" (Patient Name / Received From), pagination buttons "Sebelumnya"/"Seterusnya", date picker placeholder "Pilih tarikh"
- **Fix:** Translated all discovered Malay strings to English equivalents
- **Files modified:** src/pages/BinCard.tsx
- **Verification:** No Malay user-visible strings remain in the file
- **Committed in:** 64472a1 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed comment "Baki Semasa strip" to pass acceptance criteria grep**
- **Found during:** Task 2 verification
- **Issue:** The acceptance criteria grep pattern matched the comment "Baki Semasa strip" — while not user-visible, it would cause the grep check to fail
- **Fix:** Changed comment to "Current Balance strip"
- **Files modified:** src/pages/BinCard.tsx
- **Committed in:** 64472a1 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing coverage — additional strings, 1 minor comment fix)
**Impact on plan:** Both auto-fixes necessary for completeness and verification. No scope creep.

## Issues Encountered

- `DoctorRequest.test.tsx` has 5 pre-existing failures for ENGL-04 (future plan) — these are intentional and not caused by this plan's changes. All other tests (32) pass.

## Next Phase Readiness

- Dashboard, Drug Master, BinCard, DrugLedger pages fully in English
- Index.test.tsx GREEN — ENGL-03 requirement confirmed
- StockStatus English type established as pattern for any new status badge pages
- Ready for Plan 04: doctor-facing pages (DoctorRequest, AntibioticForm)

---
*Phase: 01-english-ui*
*Completed: 2026-03-16*
