

## Plan: Antibiotic Form Feature (Prompts A-D)

Four changes that add a full antibiotic checklist workflow: Doctor submits → Specialist reviews → Pharmacist acknowledges (no stock deduction).

---

### Database Migration

Create `antibiotic_forms` table:
- Patient fields: `tarikh`, `patient_name`, `patient_ic`, `patient_weight_kg`, `diagnosis`, `prescription_unit` (OPD/FEVER/MCH)
- Allergy: `drug_allergy`, `drug_allergy_detail`
- Treatment: `antibiotic_regimen`, `fms_code`
- Health ed: `health_ed_compliance`, `health_ed_sideeffect`, `health_ed_tca`
- Clinical checklist: `checklist_data` (JSONB — all Bahagian 2 checkboxes/scores)
- `prescriber_notes`
- Workflow: `status` (pending_specialist/approved/rejected), `submitted_by`, `specialist_id`, `specialist_action_at`, `specialist_notes`, `acknowledged_by`, `acknowledged_at`, `created_at`
- RLS: authenticated users can insert/select/update
- Indexes on `status` and `submitted_by`

---

### Prompt A — Doctor Landing Page (service selector)

**Edit** `/request` route to show a selection screen with two cards instead of going directly to the dispensing form:
- Card 1: "Permintaan Ubat Kawalan" → navigates to `/request/ubat`
- Card 2: "Borang Antibiotik" → navigates to `/request/antibiotik`

**Move** existing `DoctorRequest.tsx` form to route `/request/ubat`.

**Files:** Create `src/pages/DoctorLanding.tsx`, update `src/App.tsx` routes.

---

### Prompt B — Antibiotic Checklist Form (`/request/antibiotik`)

**Create** `src/pages/AntibioticForm.tsx` — a large scrollable form mirroring the KEW checklist:

- **Bahagian 1**: Patient details — date, name, IC (auto-format), weight (conditional on age < 12 from IC), diagnosis, prescription unit radio (OPD/FEVER/MCH), drug allergy (radio + conditional text), antibiotic regimen textarea, FMS code, health education checkboxes
- **Bahagian 2**: Clinical checklist in two-column layout:
  - Left: Pneumonia (checkboxes), Acute Otitis Media (checkboxes + otoscopy radio), Pharyngitis (Centor score with auto-sum), Rhinosinusitis (checkboxes + advisory text)
  - Right: SSTI (checkboxes for abscess/impetigo/cellulitis), UTI (urinalysis checkboxes, symptom checkboxes, pregnancy text input, pyelonephritis advisory)
- **Prescriber notes** textarea
- **Submit**: saves to `antibiotic_forms` with `status='pending_specialist'`, shows success screen with summary

All Bahagian 2 data stored as `checklist_data` JSONB.

---

### Prompt C — Specialist Antibiotic Tab (`/specialist`)

**Edit** `SpecialistDashboard.tsx`:
- Wrap existing content in Tab 1 "Ubat Kawalan"
- Add Tab 2 "Borang Antibiotik" with pending count badge
- Update stats strip: Menunggu (Ubat) | Menunggu (Antibiotik) | Diluluskan Hari Ini | Ditolak Hari Ini
- Tab 2 content: pending antibiotic forms table with "Semak & Lulus" and "Tolak" buttons
- "Semak & Lulus" opens a scrollable review dialog showing the full read-only form, optional notes, then approves
- "Tolak" dialog with required reason
- Collapsible history section for last 20 processed forms
- Auto-refresh every 30s

---

### Prompt D — Pharmacist Acknowledgement (`/fulfilment` + `/`)

**Edit** `PharmacistFulfilment.tsx`:
- Add 3rd tab "Borang Antibiotik" with count badge
- Sub-tabs: "Perlu Pengesahan" (approved, not yet acknowledged) | "Telah Disahkan Hari Ini"
- Cards with teal left border (#0891B2), showing patient/diagnosis/regimen/specialist info
- "Semak Borang" button opens read-only form dialog
- "Akui Terima" sets `acknowledged_by` + `acknowledged_at`, no stock deduction
- Today's acknowledged forms in simple table

**Edit** `Index.tsx` dashboard:
- Split "Permintaan Menunggu" card into two rows: Ubat Kawalan count + Borang Antibiotik count

**Edit** `AppSidebar.tsx`:
- Update badge to include unacknowledged antibiotic forms in total count

---

### Files Summary

| File | Action |
|------|--------|
| Migration SQL | Create `antibiotic_forms` table |
| `src/pages/DoctorLanding.tsx` | Create — service selector |
| `src/pages/AntibioticForm.tsx` | Create — full checklist form |
| `src/pages/DoctorRequest.tsx` | No changes (moves to `/request/ubat` route) |
| `src/App.tsx` | Edit — add routes `/request` (landing), `/request/ubat`, `/request/antibiotik` |
| `src/pages/SpecialistDashboard.tsx` | Edit — add tabs + antibiotic queue |
| `src/pages/PharmacistFulfilment.tsx` | Edit — add 3rd tab for acknowledgement |
| `src/pages/Index.tsx` | Edit — split pending card |
| `src/components/AppSidebar.tsx` | Edit — update badge count |

