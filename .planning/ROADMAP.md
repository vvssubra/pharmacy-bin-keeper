# Roadmap: Pharmacy Bin Keeper

## Milestones

- ✅ **v1.0 Foundation** - Phases 1-N (shipped 2026-03-16, built organically before GSD tracking)
- 🚧 **v2.0 English UI & Admin Features** - Phases 1-4 (in progress)

## Phases

<details>
<summary>✅ v1.0 Foundation - SHIPPED 2026-03-16</summary>

Built organically before GSD planning was introduced. Shipped: role-based access control, drug master management, stock ledger via transaction log, doctor dispensing requests workflow, antibiotic approval forms (NAG 2024), patient registry and drug history, bin card and ledger views, Google OAuth + email/password auth, Role Management page, dashboard and reports.

</details>

### v2.0 English UI & Admin Features (In Progress)

**Milestone Goal:** Switch all UI text to English, fix the drug-request sync bug, add antibiotic PDF download for pharmacists, and give admins full control over user account lifecycle.

- [ ] **Phase 1: English UI** - Replace all Malay text across pages, nav, forms, status badges, toasts, and Zod validation messages with English
- [ ] **Phase 2: Drug-Request Sync** - Fix the filter bug that hides newly added drugs from the doctor's request form
- [ ] **Phase 3: Antibiotic PDF** - Add a "Download PDF" button on approved antibiotic forms in pharmacist fulfilment
- [ ] **Phase 4: Admin User Management** - Enable admins to create, edit, and deactivate user accounts via a Supabase Edge Function

## Phase Details

### Phase 1: English UI
**Goal**: All visible text in the application is in English — no Malay strings survive in any page, component, toast, or validation message
**Depends on**: Nothing (first phase)
**Requirements**: ENGL-01, ENGL-02, ENGL-03, ENGL-04, ENGL-05
**Success Criteria** (what must be TRUE):
  1. Every sidebar navigation label and page title displays in English
  2. Every form field label, placeholder, and button reads in English (no Malay words remain)
  3. Every status badge value (e.g. "Pending", "Approved", "Fulfilled") displays in English
  4. Every toast notification and inline error message appears in English, including Zod validation messages
  5. Every table column header and data label is in English; running `grep -r "Ubat\|Pesakit\|Doktor\|berjaya\|gagal\|Pilih\|Cari\|Kemaskini\|Tambah" src/` returns zero matches
**Plans**: 6 plans

Plans:
- [ ] 01-01-PLAN.md — Write failing test scaffolds for ENGL-01 through ENGL-04 (Wave 0 / TDD RED)
- [ ] 01-02-PLAN.md — Translate shared components: AppSidebar, DrugFormDialog, OpeningBalanceDialog, NoPermission, AntibioticFormReadOnly, Login, DoctorLanding
- [ ] 01-03-PLAN.md — Translate core pages set A: Index (Dashboard), DrugMaster, BinCard, DrugLedger
- [ ] 01-04-PLAN.md — Translate pharmacist pages: Terimaan, PharmacistFulfilment, Laporan
- [ ] 01-05-PLAN.md — Translate remaining pages: SpecialistDashboard, PatientRegistry, DoctorRequest, AntibioticForm, RoleManagement
- [ ] 01-06-PLAN.md — Final grep verification + human visual sign-off checkpoint

### Phase 2: Drug-Request Sync
**Goal**: Doctors see all drugs from the master list the moment they open the drug request form — newly added drugs appear immediately without any manual refresh
**Depends on**: Phase 1
**Requirements**: SYNC-01
**Success Criteria** (what must be TRUE):
  1. When a pharmacist adds a new drug via Drug Master, a doctor can immediately see that drug in the request form on the next open — no page reload required
  2. The doctor's drug request form fetches the live drug master list on every mount, not a stale cached result
  3. Adding a drug in `DrugFormDialog` invalidates the correct React Query cache key so the request form reflects the change
**Plans**: TBD

### Phase 3: Antibiotic PDF
**Goal**: A pharmacist can download a complete, named PDF of any approved antibiotic form directly from the fulfilment page
**Depends on**: Phase 2
**Requirements**: PDF-01
**Success Criteria** (what must be TRUE):
  1. An approved antibiotic form in the pharmacist fulfilment view shows a "Download PDF" button
  2. Clicking the button downloads a PDF file named after the form (e.g. patient name + date) containing: patient info, drug, dose, indication, approval status, approver name, and approval date
  3. The PDF downloads from cached data without triggering a new network request — no snapshot mismatch possible
  4. The initial page load is not bloated by the PDF library (dynamic import used; `@react-pdf/renderer` is not in the main bundle)
**Plans**: TBD

### Phase 4: Admin User Management
**Goal**: An admin can create new user accounts, edit existing user details, and deactivate users — all from a dedicated User Management page without needing Supabase dashboard access
**Depends on**: Phase 3
**Requirements**: USR-01, USR-02, USR-03
**Success Criteria** (what must be TRUE):
  1. Admin can create a user by entering name, email, role, and temporary password — the account appears immediately in the user list and the user can log in
  2. Admin can edit an existing user's name and role — changes persist and the user's access reflects the updated role on their next page load
  3. Admin can deactivate a user — the deactivated user cannot log in and is visually marked as inactive in the admin list
  4. The service role key is never present in the browser bundle or any `VITE_` environment variable — all admin operations route through a Supabase Edge Function verified by JWT
  5. If user creation fails mid-sequence (auth created, role insert fails), the orphaned auth account is automatically deleted and the admin sees a clear error
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. English UI | 2/6 | In Progress|  | - |
| 2. Drug-Request Sync | v2.0 | 0/? | Not started | - |
| 3. Antibiotic PDF | v2.0 | 0/? | Not started | - |
| 4. Admin User Management | v2.0 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-16*
*Milestone: v2.0 English UI & Admin Features*
*Phase 1 plans created: 2026-03-16*
