# Requirements: Pharmacy Bin Keeper

**Defined:** 2026-03-16
**Core Value:** Every drug movement is traceable and every dispensing request is accountable.

## v2 Requirements

Requirements for v2.0 milestone.

### English UI

- [x] **ENGL-01**: All page titles and sidebar navigation labels are displayed in English
- [x] **ENGL-02**: All form field labels, placeholders, and button text are in English
- [x] **ENGL-03**: All status badges and status values are displayed in English
- [x] **ENGL-04**: All toast notifications and error messages are in English
- [x] **ENGL-05**: All table column headers and data labels are in English

### User Management

- [ ] **USR-01**: Admin can create a new user account with name, email, role, and temporary password
- [ ] **USR-02**: Admin can edit an existing user's name and role
- [ ] **USR-03**: Admin can deactivate a user account

### Drug Sync

- [ ] **SYNC-01**: Doctor's drug request form always loads the live drug master list on open (no stale cache)

### Antibiotic PDF

- [ ] **PDF-01**: Pharmacist can download an approved antibiotic form as a PDF containing full form data (patient info, drug, dose, indication, approval status, approver name, date)

### Controlled Drug Quota & Pesara

- [x] **CDQ-01**: Doctor can mark a patient as Pesara (Government Retiree) on the drug dispensing request form via a checkbox; the is_pesara flag is saved to dispensing_requests
- [x] **CDQ-02**: Specialist sees Regular and Pesara sub-tabs in the Controlled Drug tab, with quota usage badges (healthy/warning/exhausted) on each Regular request row and an "Unlimited" badge on Pesara rows
- [x] **CDQ-03**: Specialist approve dialog shows a borrow-from-facility field when quota is exhausted; approve button disabled until field is filled; borrowed_from_facility saved on the dispensing_request record
- [x] **CDQ-04**: FmsDashboard annual quota table shows a Pesara column with patient count and "(Unlimited)" label per controlled drug, and the regular YTD count excludes Pesara patients

## Future Requirements

### User Management

- **USR-F01**: Admin can re-activate a deactivated user account
- **USR-F02**: Admin can reset a user's password

### Reporting

- **RPT-F01**: Admin can export transaction reports as PDF or Excel

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time notifications | Polling sufficient; WebSocket complexity not justified yet |
| Multi-facility support | Single facility deployment |
| Mobile native app | Web-first |
| Doctor/specialist PDF download | Pharmacist-only per v2 scope decision |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENGL-01 | Phase 1 | Complete |
| ENGL-02 | Phase 1 | Complete |
| ENGL-03 | Phase 1 | Complete |
| ENGL-04 | Phase 1 | Complete |
| ENGL-05 | Phase 1 | Complete |
| SYNC-01 | Phase 2 | Pending |
| PDF-01 | Phase 3 | Pending |
| USR-01 | Phase 4 | Pending |
| USR-02 | Phase 4 | Pending |
| USR-03 | Phase 4 | Pending |
| CDQ-01 | Phase 5 | Complete |
| CDQ-02 | Phase 5 | Complete |
| CDQ-03 | Phase 5 | Complete |
| CDQ-04 | Phase 5 | Complete |

**Coverage:**
- v2 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-22 — added CDQ-01 through CDQ-04 for Phase 5 (Controlled Drug Quota & Pesara)*
