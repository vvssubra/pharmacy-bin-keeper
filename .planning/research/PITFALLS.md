# Pitfalls Research: Pharmacy Bin Keeper v2.0

**Researched:** 2026-03-16
**Focus:** Common mistakes when adding English UI, user management, drug sync fix, and PDF to existing React + Supabase app

---

## Critical Pitfalls

### P1: Service Role Key Exposed in Browser Bundle

**What goes wrong:** Developer creates `VITE_SUPABASE_SERVICE_ROLE_KEY` to call admin APIs from the browser. Vite bakes every `VITE_` variable into the JS bundle — anyone with DevTools can read it. Service role bypasses all RLS.

**Prevention:**
- Never use `VITE_SERVICE_ROLE_KEY` — grep `dist/` for `service_role` after build
- Use Supabase Edge Function as proxy; service key stored as a Supabase server-side secret
- Edge Function verifies caller JWT and `user_roles` before executing admin operations

**Phase:** User Management (Phase 4)

---

### P2: Edge Function Checks Request Body for Role (Not JWT)

**What goes wrong:** Edge Function checks `body.callerRole === "pharmacist"` instead of verifying the caller's JWT. Any user can send `{ callerRole: "pharmacist" }`.

**Prevention:**
- Extract caller's user ID from `Authorization` header JWT: `supabaseAdmin.auth.getUser(token)`
- Query `user_roles` for that user ID, assert role === "pharmacist" before any admin operation
- Return HTTP 403 immediately on failure

**Phase:** User Management (Phase 4)

---

### P3: Orphaned Auth User When Profile/Role Insert Fails

**What goes wrong:** `auth.admin.createUser` succeeds but subsequent `user_roles` insert fails. Auth account exists but user hits `NoPermission` on every route with no way to fix from the UI.

**Prevention:**
- In Edge Function: wrap create + insert in try/catch; on any insert failure call `auth.admin.deleteUser` to roll back
- Only show success toast on client if HTTP response is 200

**Phase:** User Management (Phase 4)

---

## Moderate Pitfalls

### P4: Malay Strings Survive the English Switch (Zod + toasts + date-fns)

**Known locations in codebase:**
- `DoctorRequest.tsx`: Zod messages (`"Nama pesakit diperlukan"`, `"No. IC tidak lengkap"`), toast (`"Gagal menghantar permintaan"`), confirmation card text
- `PharmacistFulfilment.tsx`: `import { ms } from "date-fns/locale"` — relative timestamps render in Malay
- `AppSidebar.tsx`: `"Pengurusan Peranan"` nav label
- `RoleManagement.tsx`: `ROLE_LABELS` map with Malay display names

**Prevention:**
- After each file, grep: `grep -r "Ubat\|Pesakit\|Doktor\|perlu\|berjaya\|gagal\|Pilih\|Cari\|tarikh\|Kemaskini\|Tambah" src/`
- Zod schema `.min()` / `.regex()` messages need a separate pass from JSX content
- Replace all `ms` locale with `enGB` in `date-fns` calls
- Test every form's error state after switch

**Phase:** English UI (Phase 1)

---

### P5: Drug Sync Fix Confused With Cache Staleness

**What goes wrong:** Developer adds `staleTime: 0` or `refetchOnMount: "always"` to fix "new drugs not appearing" — the filter is the actual root cause. Drugs still hidden after the "fix".

**Root cause:** `DoctorRequest.tsx` queryFn filters to drugs with `baki_awal` transaction (lines ~61–69). Newly added drugs have no transactions → silently excluded.

**Prevention:** Two explicit separate tasks:
1. Remove the `baki_awal` filter from `DoctorRequest.tsx` queryFn
2. Add `invalidateQueries({ queryKey: ["drugs-for-request"] })` in `DrugFormDialog` onSuccess

**Phase:** Drug Sync (Phase 2)

---

### P6: `["drugs"]` and `["drugs-for-request"]` Are Independent Cache Keys

**What goes wrong:** `DrugFormDialog` invalidates `["drugs"]` on drug creation. `DoctorRequest` uses `["drugs-for-request"]`. New drug never appears in doctor's form.

**Prevention:** Add `invalidateQueries({ queryKey: ["drugs-for-request"] })` to `DrugFormDialog` `onSuccess`. Or restructure to `["drugs", "master"]` + `["drugs", "for-request"]` so prefix invalidation covers both.

**Phase:** Drug Sync (Phase 2)

---

### P7: PDF Data Re-Fetched at Print Time (Snapshot Mismatch)

**What goes wrong:** PDF generation handler fetches antibiotic form data at click time — can return a different snapshot than what's on screen.

**Prevention:** Pass data already in React Query cache into the PDF generation function. Do not re-fetch at print time. Read from `queryClient.getQueryData(["antibiotic-forms", formId])` or pass `formData` as a prop.

**Phase:** Antibiotic PDF (Phase 3)

---

### P8: PDF Library Statically Imported — Inflates Initial Bundle

**What goes wrong:** `import { pdf } from "@react-pdf/renderer"` at top of file adds ~700KB to the initial bundle for all users.

**Prevention:** Dynamic import at click time:
```typescript
const handleDownloadPdf = async () => {
  const { pdf } = await import("@react-pdf/renderer");
  // generate and download
};
```

**Phase:** Antibiotic PDF (Phase 3)

---

### P9: `AppRole` Type Doesn't Include `"admin"` If Role Model Changes

**Current state:** `AppRole = "pharmacist" | "doctor" | "specialist"`. Admin functionality is gated by `role === "pharmacist"`. DB `user_roles` CHECK constraint only allows these 3 values.

**Prevention:** Do NOT add a 4th `admin` role for v2 — user management belongs to `pharmacist`. Decide before writing code; if ever adding `admin` role: update `AppRole` type, DB CHECK constraint, all RLS policies, and all `role === "pharmacist"` admin guards simultaneously.

**Phase:** User Management (Phase 4)

---

## Phase-Specific Warning Summary

| Phase | Pitfall | Prevention |
|-------|---------|------------|
| English UI | Zod messages missed | Separate pass for schema files |
| English UI | `date-fns` still `ms` locale | Grep `date-fns/locale` codebase-wide |
| English UI | Partial pass leaves mixed language | Grep for Malay vocab after each file |
| Drug sync | Cache fix masks filter bug | Remove filter first, then fix invalidation |
| Drug sync | Wrong query key invalidated | Invalidate `["drugs-for-request"]` explicitly |
| Antibiotic PDF | Data re-fetched at print time | Pass cached data into PDF function |
| Antibiotic PDF | Static import inflates bundle | Dynamic `import()` at click |
| User management | Service key in browser | Edge Function only; never `VITE_SERVICE_ROLE_KEY` |
| User management | Role guard bypassed via body | Verify JWT in Edge Function |
| User management | Orphaned auth user on failure | Rollback via `auth.admin.deleteUser` |
