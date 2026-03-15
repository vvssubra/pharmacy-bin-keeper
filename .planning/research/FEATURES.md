# Features Research: Pharmacy Bin Keeper v2.0

**Researched:** 2026-03-16
**Focus:** English UI, admin user management, drug sync, antibiotic PDF patterns

---

## Feature 1 — English UI (ENGL-01..05)

**Approach:** Direct in-place string replacement. No i18n library.

- `i18next` / `react-intl` are overkill — this is a permanent one-way switch, not multi-language support
- ~15 files contain hardcoded Malay strings
- DB status values (`pending`, `approved`, `rejected`, `fulfilled`, `deferred`) are already English — no DB migration needed
- Only display labels in JSX, Zod validation messages, toast text, and `date-fns` locale need changing

**Table stakes (must do):**
- Page titles, nav labels, button text
- Form field labels and placeholders
- Status badge labels
- Toast messages (success + error)
- Zod validation error messages (often missed — separate pass needed)
- `date-fns` locale: replace `ms` with `enGB` in `PharmacistFulfilment.tsx`

**Anti-features (avoid):**
- Language switcher UI — not requested
- Runtime i18n — not needed

**Recommended order:** Do first. All subsequent features should ship in English.

---

## Feature 2 — Admin User Management (USR-01..03)

**Approach:** Extend existing RoleManagement page + Supabase Edge Function proxy.

**Table stakes:**
- Create user: name, email, role, temporary password
- Edit user: change name and role
- Deactivate user: ban via Supabase Auth Admin API

**Critical constraint:**
- Supabase Admin API requires `service_role` key — must never be in the browser bundle
- Mandatory: Supabase Edge Function as server-side proxy
- Existing `RoleManagement` page + `get_all_users_with_roles()` RPC can be extended — don't build from scratch

**User creation flow:**
- Admin fills name, email, role, temp password → calls Edge Function → Edge Function calls `auth.admin.createUser({ email_confirm: true })` → inserts role into `user_roles` → returns success
- `handle_new_user()` trigger auto-inserts into `profiles`

**User deactivation:**
- `auth.admin.updateUserById(userId, { ban_duration: "876600h" })` — 100-year ban = permanent deactivation
- `ban_duration: "none"` to reactivate (future)

**Highest complexity feature in v2** — Edge Function deployment is the critical path.

**Anti-features:**
- Invite-by-email flow (admin wants to set the password directly)
- User self-registration (security risk in clinical setting)

---

## Feature 3 — Drug Request Form Sync (SYNC-01)

**Root cause confirmed in code:**
- `DoctorRequest.tsx` lines 61–69 filter drugs to only those with a `baki_awal` transaction
- Newly added drugs have no transactions → silently hidden
- This is **not** a React Query cache staleness issue — it's a filter bug

**Fix:**
- Remove `baki_awal` filter from `DoctorRequest.tsx` queryFn
- Add `queryClient.invalidateQueries({ queryKey: ["drugs-for-request"] })` in `DrugFormDialog` `onSuccess`
- Note: `["drugs"]` and `["drugs-for-request"]` are independent cache keys — must invalidate both

**Lowest complexity fix in v2** — ~3–6 lines changed + 1 line added.

---

## Feature 4 — Antibiotic PDF (PDF-01)

**Approach:** `@react-pdf/renderer` with dynamic import at click time.

**Table stakes:**
- Full form data: patient details, clinical checklist, antibiotic regimen, specialist approval (name, date, notes)
- Download triggered by pharmacist only when form status is `approved`
- "Download PDF" button in `PharmacistFulfilment` page, visible only for approved antibiotic forms
- `AntibioticFormReadOnly` component already renders the complete form data — use as reference for PDF layout

**Implementation pattern:**
- Dynamic import at click time: `const { pdf } = await import("@react-pdf/renderer")` — avoids bloating initial bundle
- Pass React Query cached data into PDF function — do NOT re-fetch at print time
- Vite requires `optimizeDeps: { include: ['@react-pdf/renderer'] }` in `vite.config.ts`

**Anti-features:**
- `jspdf + html2canvas` — produces rasterized image, not searchable text
- `window.print()` — no filename control, layout unpredictable
- Server-side PDF generation — no backend server in this architecture
