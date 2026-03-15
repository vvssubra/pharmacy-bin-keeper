---
phase: 01-english-ui
plan: "02"
subsystem: ui-translation
tags: [translation, english-ui, tdd-green, sidebar, forms, dialogs, login]
dependency_graph:
  requires: [01-01]
  provides: [engl-01-green, engl-02-green, engl-04-green-form, foundation-layer-translated]
  affects: [01-03-PLAN, 01-04-PLAN, 01-05-PLAN]
tech_stack:
  added: []
  patterns: [full-sidebar-component-mock, vitest-jsx-in-mock]
key_files:
  created: []
  modified:
    - src/components/AppSidebar.tsx
    - src/components/DrugFormDialog.tsx
    - src/components/OpeningBalanceDialog.tsx
    - src/components/NoPermission.tsx
    - src/components/AntibioticFormReadOnly.tsx
    - src/pages/Login.tsx
    - src/pages/DoctorLanding.tsx
    - src/components/AppSidebar.test.tsx
    - src/components/ProtectedRoute.test.tsx
decisions:
  - "Full sidebar component mock: mocking only useSidebar export is insufficient because Sidebar component uses a local closure over useSidebar tied to React.createContext — full component replacement needed in tests"
  - "ProtectedRoute.test.tsx updated: 'Tiada Kebenaran' assertions replaced with 'No Permission' to match translated NoPermission.tsx"
  - "AntibioticFormReadOnly: already mostly English (clinical section names, row labels) — only BAHAGIAN 1/2 headers and a few patient field labels (Tarikh, Nama, Berat) needed translation"
  - "Login.tsx: 'Klinik Kesihatan Kempas' kept as-is (proper noun / clinic name, not a UI label)"
metrics:
  duration: 8m
  completed: "2026-03-16"
  tasks_completed: 2
  files_created: 0
  files_modified: 9
---

# Phase 1 Plan 02: Translate Foundation Layer (Wave 2) Summary

One-liner: Seven source files translated from Malay to English across sidebar nav, form dialogs, auth page, and role-agnostic components — AppSidebar.test and DrugFormDialog.test turn GREEN (9/9).

## What Was Built

Wave 2 of the English UI translation. All Malay user-visible strings replaced with English across the foundation layer: AppSidebar navigation labels, DrugFormDialog form labels and Zod messages, OpeningBalanceDialog labels and toasts, NoPermission access-denied text, AntibioticFormReadOnly section headers, Login page tab/button/label text, and DoctorLanding service card content.

Additionally fixed a pre-existing test infrastructure gap (Rule 1) in AppSidebar.test.tsx and updated ProtectedRoute.test.tsx to match the translated NoPermission text.

## Files Translated

| File | What Changed |
|------|-------------|
| `src/components/AppSidebar.tsx` | Nav items: "Permintaan Baharu" → "New Requests", "Pesakit" → "Patients", "Laporan" → "Reports", "Pengurusan Peranan" → "Role Management", brand text "Kawalan Ubat" → "Drug Control" |
| `src/components/DrugFormDialog.tsx` | Dialog titles, all field labels (Drug Name, Code No., Unit of Measure, Group, Movement, Storage Location, Warehouse/Section, Full Location Code, Stock Levels, Reorder, Maximum), buttons (Cancel/Save/Saving), Zod message "Drug name is required", toasts "Drug updated"/"Drug added", setError "Drug name already exists" |
| `src/components/OpeningBalanceDialog.tsx` | Dialog title, description, labels (Opening Balance Date, Quantity on that date), date picker placeholder, buttons (Cancel/Save/Saving), confirmation alert (Change opening balance?/Cancel/Continue), toasts ("Opening balance saved", "Please complete all fields") |
| `src/components/NoPermission.tsx` | Heading "Tiada Kebenaran" → "No Permission", body text translated |
| `src/components/AntibioticFormReadOnly.tsx` | Section headers "BAHAGIAN 1: Butiran Pesakit" → "SECTION 1: Patient Details", "BAHAGIAN 2: Semakan Klinikal" → "SECTION 2: Clinical Review", field labels: Tarikh → Date, Nama → Name, Berat (kg) → Weight (kg) |
| `src/pages/Login.tsx` | Tab triggers (Log Masuk → Log In, Daftar → Sign Up), form labels (Kata laluan → Password, Nama Penuh → Full Name), button text (Log Masuk → Log In, Daftar Akaun → Create Account), divider text, Google login button |
| `src/pages/DoctorLanding.tsx` | Page heading, subtitle, both service card titles/descriptions/badges |

## Test Results

### AppSidebar.test.tsx — GREEN (4/4)
All four navigation label assertions pass:
- "New Requests" rendered for pharmacist
- "Patients" rendered for pharmacist
- "Reports" rendered for pharmacist
- "Role Management" rendered for pharmacist

### DrugFormDialog.test.tsx — GREEN (5/5)
All form label and Zod validation assertions pass:
- "Add Drug" dialog title
- "Drug Name *" label
- "Unit of Measure" label
- "Save" button
- "Drug name is required" Zod validation message

### Full suite: 27 passing, 10 pre-existing RED failures
The 10 remaining failures are DoctorRequest.test.tsx (5) and Index.test.tsx (5) — scaffolded in Plan 01 to be fixed in Plans 03 and 04. No new failures introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AppSidebar.test.tsx — full sidebar component mock required**
- **Found during:** Task 1 verification
- **Issue:** The `Sidebar` component in `sidebar.tsx` calls `useSidebar()` via a local function closure bound to `React.createContext`, not the exported module binding. Mocking only the `useSidebar` export (as done in Plan 01) was insufficient — the `Sidebar` component still threw `"useSidebar must be used within a SidebarProvider"` at render time.
- **Fix:** Replaced the partial `vi.importActual` mock with a full component mock: `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, and `SidebarMenuButton` are all replaced with simple HTML wrapper components. Added `import React from "react"` for JSX in the mock factory.
- **Files modified:** `src/components/AppSidebar.test.tsx`
- **Commit:** 6a9d747

**2. [Rule 1 - Bug] ProtectedRoute.test.tsx — assertions updated to match translated NoPermission**
- **Found during:** Task 2 verification (npx vitest run)
- **Issue:** `ProtectedRoute.test.tsx` had 8 assertions checking for the heading `/Tiada Kebenaran/i`. After translating `NoPermission.tsx` to "No Permission", these assertions broke.
- **Fix:** All 8 occurrences of `/Tiada Kebenaran/i` replaced with `/No Permission/i`.
- **Files modified:** `src/components/ProtectedRoute.test.tsx`
- **Commit:** 6855743

## Edge Cases Noted (Malay strings NOT in plan inventory)

- `OpeningBalanceDialog.tsx` contained the confirmation alert dialog ("Ubah baki awal?", "Teruskan", "Mengubah baki awal akan mengira semula semua baki") — not listed in the research inventory.
- `Login.tsx` had "atau log masuk dengan" (divider text for Google login), "Memproses…" (Google loading state), "Mendaftar…" (signup loading), "Daftar Akaun" (signup button) — partially missing from the known replacements list.
- `AntibioticFormReadOnly.tsx` was already ~80% English (clinical section names were already in English from the NAG 2024 pathway). Only the Malay BAHAGIAN section headers and 3 patient field labels needed translation.
- The internal `state` variable names in `OpeningBalanceDialog.tsx` (`tarikh`, `kuantiti`) are intentionally kept as-is (they are private variables, not user-visible strings).

## Commits

| Hash | Message |
|------|---------|
| 6a9d747 | feat(01-02): translate AppSidebar and DrugFormDialog to English |
| 6855743 | feat(01-02): translate 5 components/pages to English |

## Self-Check: PASSED
