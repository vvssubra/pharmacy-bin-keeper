# Requirements: Pharmacy Bin Keeper

**Defined:** 2026-03-16
**Core Value:** Every drug movement is traceable and every dispensing request is accountable.

## v2 Requirements

Requirements for v2.0 milestone.

### English UI

- [ ] **ENGL-01**: All page titles and sidebar navigation labels are displayed in English
- [ ] **ENGL-02**: All form field labels, placeholders, and button text are in English
- [ ] **ENGL-03**: All status badges and status values are displayed in English
- [ ] **ENGL-04**: All toast notifications and error messages are in English
- [ ] **ENGL-05**: All table column headers and data labels are in English

### User Management

- [ ] **USR-01**: Admin can create a new user account with name, email, role, and temporary password
- [ ] **USR-02**: Admin can edit an existing user's name and role
- [ ] **USR-03**: Admin can deactivate a user account

### Drug Sync

- [ ] **SYNC-01**: Doctor's drug request form always loads the live drug master list on open (no stale cache)

### Antibiotic PDF

- [ ] **PDF-01**: Pharmacist can download an approved antibiotic form as a PDF containing full form data (patient info, drug, dose, indication, approval status, approver name, date)

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
| ENGL-01 | Phase 1 | Pending |
| ENGL-02 | Phase 1 | Pending |
| ENGL-03 | Phase 1 | Pending |
| ENGL-04 | Phase 1 | Pending |
| ENGL-05 | Phase 1 | Pending |
| USR-01 | Phase 2 | Pending |
| USR-02 | Phase 2 | Pending |
| USR-03 | Phase 2 | Pending |
| SYNC-01 | Phase 3 | Pending |
| PDF-01 | Phase 3 | Pending |

**Coverage:**
- v2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after initial v2.0 definition*
