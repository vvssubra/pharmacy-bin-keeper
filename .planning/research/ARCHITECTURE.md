# Architecture Research: Pharmacy Bin Keeper v2.0

**Researched:** 2026-03-16
**Focus:** Integration points for 4 v2 features into existing React + Supabase architecture

---

## Existing Architecture Summary

- **Auth:** `AuthContext` fetches `profiles` + `user_roles` after login; `AppRole = "pharmacist" | "doctor" | "specialist"`
- **Routing:** `ProtectedRoute` enforces role-based access; all routes in `App.tsx`
- **Layout:** `AppLayout` → `AppSidebar` + `TopNavbar` + content
- **State:** TanStack React Query for all server state; mutations call `invalidateQueries`
- **DB:** Supabase with RLS enabled; client at `src/integrations/supabase/client.ts`
- **Role model:** `pharmacist` acts as admin (creates/manages roles, approves requests)

---

## Feature 1: English UI — No New Components

**Integration:** Pure view layer change — no data flow changes.

**Files to modify (~15):**
- `src/components/AppSidebar.tsx` — nav labels
- `src/pages/DoctorRequest.tsx` — form labels, Zod messages, toast text, confirmation card
- `src/pages/PharmacistFulfilment.tsx` — table headers, status labels, `date-fns` locale (`ms` → `enGB`)
- `src/pages/RoleManagement.tsx` — `ROLE_LABELS` map, table content
- `src/pages/DrugMaster.tsx` — column headers, dialogs
- `src/pages/Terimaan.tsx`, `Laporan.tsx`, `AntibioticForm.tsx`, `SpecialistDashboard.tsx`, `PatientRegistry.tsx`, `BinCard.tsx`, `DrugLedger.tsx` — various labels
- `src/components/ui/*` — any Malay placeholder text
- `src/integrations/supabase/` — no changes needed (DB values already English)

**Grep to verify completeness:**
```bash
grep -r "Ubat\|Pesakit\|Doktor\|perlu\|berjaya\|gagal\|Pilih\|Cari\|tarikh\|Nama\|Kemaskini\|Tambah" src/
```

---

## Feature 2: Admin User Management — New Page + Edge Function

**New files:**
- `supabase/functions/admin-user-management/index.ts` — Deno Edge Function (handles create + deactivate actions)
- `src/pages/UserManagement.tsx` — new admin page with user list, create/edit/deactivate actions
- `src/hooks/useUserManagement.ts` — React Query mutations wrapping `supabase.functions.invoke`

**Modified files:**
- `src/App.tsx` — add `/users` route, `pharmacist`-only protected
- `src/components/AppSidebar.tsx` — add "User Management" nav item for pharmacist

**Data flow:**
```
UserManagement page
  → useUserManagement hook
    → supabase.functions.invoke("admin-user-management", { body: { action, ...params } })
      → Edge Function verifies caller JWT → checks user_roles for pharmacist role
        → supabase.auth.admin.createUser / updateUserById / listUsers
          → on create: insert into user_roles
            → invalidateQueries(["users"])
```

**Edge Function structure:**
```
POST /admin-user-management
body: { action: "create" | "update" | "deactivate", userId?, email?, password?, full_name?, role? }
Auth: Bearer <caller JWT> — verified server-side, role checked against user_roles
Service key: SUPABASE_SERVICE_ROLE_KEY — injected as Supabase secret, never in browser
```

**RLS note:** Existing `get_all_users_with_roles()` RPC can list users for the management page.

---

## Feature 3: Drug-Request Sync — Single File Fix

**Root cause:** `DoctorRequest.tsx` queryFn filters to drugs with `baki_awal` transaction only.

**Modified files:**
- `src/pages/DoctorRequest.tsx` — remove `baki_awal` filter from queryFn (lines ~61–69)
- `src/components/DrugFormDialog.tsx` — add `invalidateQueries({ queryKey: ["drugs-for-request"] })` in mutation `onSuccess`

**No new components or data flow changes needed.**

**Cache key note:** `["drugs"]` and `["drugs-for-request"]` are separate keys. After adding a drug, both must be invalidated. Use prefix arrays: `queryKey: ["drugs", "master"]` and `queryKey: ["drugs", "for-request"]` so `invalidateQueries({ queryKey: ["drugs"] })` covers both.

---

## Feature 4: Antibiotic PDF — New Hook + Button

**New files:**
- `src/hooks/useAntibioticPdf.ts` — handles dynamic import of `@react-pdf/renderer`, PDF generation, and file download
- `src/components/AntibioticPdfDocument.tsx` — `@react-pdf/renderer` `<Document>` component (mirrors `AntibioticFormReadOnly` layout)

**Modified files:**
- `src/pages/PharmacistFulfilment.tsx` — add "Download PDF" button in antibiotic form row/detail, visible only when `status === "approved"`
- `vite.config.ts` — add `optimizeDeps: { include: ['@react-pdf/renderer'] }`

**Data flow:**
```
PharmacistFulfilment (approved antibiotic row)
  → "Download PDF" button click
    → useAntibioticPdf(formData) — data from existing React Query cache
      → dynamic import @react-pdf/renderer
        → generate AntibioticPdfDocument with cached data
          → blob URL → anchor click → download
```

---

## Suggested Build Order

| Order | Feature | Rationale |
|-------|---------|-----------|
| 1 | English UI | Zero-risk; all subsequent features ship in English |
| 2 | Drug-request sync | Tiny fix; low risk, high user value |
| 3 | Antibiotic PDF | New dependency; isolated to one page |
| 4 | Admin user management | Highest complexity; Edge Function deployment last |
