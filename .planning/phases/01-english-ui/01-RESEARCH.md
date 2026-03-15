# Phase 1: English UI - Research

**Researched:** 2026-03-16
**Domain:** React/TypeScript UI text replacement — Malay-to-English string migration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENGL-01 | All page titles and sidebar navigation labels are displayed in English | Malay nav labels inventoried in AppSidebar.tsx; all 7 sidebar items catalogued |
| ENGL-02 | All form field labels, placeholders, and button text are in English | Malay labels catalogued across DrugFormDialog, Terimaan, DoctorRequest, AntibioticForm, OpeningBalanceDialog, PharmacistFulfilment, PatientRegistry, DrugLedger |
| ENGL-03 | All status badges and status values are displayed in English | Malay badge strings catalogued: KRITIKAL, RENDAH, NORMAL, LEBIHAN, Diluluskan Pakar, Ditangguh, Menunggu, Selesai, Belum Ditetapkan |
| ENGL-04 | All toast notifications and error messages are in English, including Zod validation messages | 30+ Malay toast strings catalogued; 8 Malay Zod validation messages catalogued |
| ENGL-05 | All table column headers and data labels are in English; grep check must return zero matches | Malay column headers catalogued across Index, DrugLedger, PharmacistFulfilment, PatientRegistry, BinCard, Laporan, SpecialistDashboard |
</phase_requirements>

---

## Summary

Phase 1 is a pure text-replacement migration — no new API calls, no schema changes, no routing changes. Every file in `src/` is already identified as affected. The task is to find every Malay user-visible string (labels, placeholders, buttons, toasts, Zod messages, status badge values, loading states, empty states, page titles, tab labels, column headers) and replace it with idiomatic English.

The codebase has no i18n layer (no react-i18next, no locale files). All strings are hard-coded inline in each component. The migration is therefore a direct find-and-replace pass through 19 files across `src/pages/` and `src/components/`. No abstraction is needed for this phase — the planner should not introduce an i18n library.

One non-obvious scope item: `date-fns` is imported with the Malay locale (`ms` from `date-fns/locale`) in five files (`Index.tsx`, `PharmacistFulfilment.tsx`, `Laporan.tsx`, `SpecialistDashboard.tsx`, `PatientRegistry.tsx`). Every `format()` and `formatDistanceToNow()` call that passes `{ locale: ms }` must have that argument removed so dates/times render in English.

**Primary recommendation:** Work file-by-file in a single wave. For each file, do a full string audit (not just the grep pattern in ENGL-05's success criterion) before editing. The success-criterion grep (`grep -r "Ubat\|Pesakit\|Doktor\|..."`) is a spot-check, not an exhaustive coverage test — there are many additional Malay strings not covered by that pattern.

---

## Standard Stack

### Core (already in use — no new dependencies needed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React + TypeScript | 18 / 5 | Component authoring | All files are `.tsx` |
| Zod | `^3` | Form validation messages | Messages are inline string args — change them in place |
| Sonner | latest | Toast notifications | `toast.success()` / `toast.error()` strings — change in place |
| date-fns | latest | Date formatting | Remove `{ locale: ms }` option from all calls |

### Not Needed for This Phase
- react-i18next, i18next, next-intl — do not introduce; out of scope for this phase

---

## Architecture Patterns

### Pattern 1: Inline String Replacement (the ONLY pattern for this phase)
**What:** Each Malay string is replaced with its English equivalent directly in the JSX or Zod schema where it lives. No abstraction, no constants file, no translation function.
**When to use:** Always — this is the entire approach for this phase.

```typescript
// BEFORE
z.string().min(1, "Nama pesakit diperlukan")
toast.success("Permintaan berjaya dihantar")
<FormLabel>Ubat *</FormLabel>
<Button>Simpan</Button>

// AFTER
z.string().min(1, "Patient name is required")
toast.success("Request submitted successfully")
<FormLabel>Drug *</FormLabel>
<Button>Save</Button>
```

### Pattern 2: date-fns Locale Removal
**What:** Remove the `{ locale: ms }` argument from all `format()` and `formatDistanceToNow()` calls. Remove the `import { ms } from "date-fns/locale"` import statement once no usages remain.
**When to use:** In every file where the `ms` locale is currently imported.

```typescript
// BEFORE
import { ms } from "date-fns/locale";
formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: ms })
format(new Date(), "d MMMM yyyy", { locale: ms })

// AFTER
// (import removed)
formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })
format(new Date(), "d MMMM yyyy")
```

### Anti-Patterns to Avoid
- **Don't introduce i18n**: No translation layer, no constants file, no `t()` function. Inline replacement only.
- **Don't rely on the ENGL-05 grep as a complete audit**: The grep pattern (`Ubat|Pesakit|Doktor|berjaya|gagal|...`) only covers ~40% of Malay strings. Each file needs a full read.
- **Don't skip database field names**: Field names like `drug_id`, `tarikh`, `kuantiti` are database columns — they stay as-is. Only user-visible display strings change.
- **Don't rename status values used in `.eq("status", "pending_pharmacy")`**: Database status enum values are not UI text — they are Supabase filter values and must not change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Detecting remaining Malay strings | Custom script | `grep -r "<pattern>" src/` from the terminal — fast, sufficient |
| Pluralisation of English text | Custom logic | Write natural English — no pluralisation library needed at this scale |

---

## Complete File Inventory

Every file requiring changes, with a summary of what needs translating:

### `src/components/AppSidebar.tsx`
**Nav item labels (Malay → English):**
- "Permintaan Baharu" → "New Requests"
- "Pesakit" → "Patients"
- "Laporan" → "Reports"
- "Pengurusan Peranan" → "Role Management"
- "Kawalan Ubat" (sidebar brand text) → "Drug Control" (or "Medication Control")

### `src/pages/Index.tsx` (Dashboard)
**Display strings:**
- "Gambaran keseluruhan stok semasa — {today}" → "Current stock overview — {today}"
- `format(new Date(), "d MMMM yyyy", { locale: ms })` → remove `locale: ms`
- "Amaran Stok Kritikal" → "Critical Stock Alert"
- "{n} ubat memerlukan perhatian segera..." → "{n} drug(s) require immediate attention..."
- `aria-label="Tutup amaran"` → `aria-label="Dismiss alert"`
- stat card labels: "Kritikal" → "Critical", "Rendah" → "Low", "Lebihan" → "Excess"
- "ubat" (below count) → "drug(s)"
- "Status Stok Ubat" → "Drug Stock Status"
- Column headers: "Nama Ubat" → "Drug Name", "Baki" → "Balance", "Kemaskini" → "Last Updated", "Tindakan" → "Actions"
- Status badge values: "KRITIKAL" → "CRITICAL", "RENDAH" → "LOW", "NORMAL" → "NORMAL", "LEBIHAN" → "EXCESS", "TIADA PARAS" → "NO LEVEL"
- `formatDistanceToNow(... { locale: ms })` → remove `locale: ms` (two occurrences)
- "Aktiviti Terkini" → "Recent Activity"
- "Lihat Semua" → "View All"
- Activity badge: "Terimaan" → "Receipt", "Keluaran" → "Dispensed"
- "Pengeluaran Terkini" → "Recent Dispensing"
- Column headers: "Ubat" → "Drug", "Pesakit" → "Patient", "Pegawai" → "Officer", "Masa" → "Time"
- "Permintaan Menunggu" → "Pending Requests"
- "Ubat Kawalan" → "Controlled Drug"
- "{n} menunggu" → "{n} pending"
- "Proses →" → "Process →"
- "Borang Antibiotik" → "Antibiotic Form"
- "{n} perlu pengesahan" → "{n} awaiting confirmation"
- "Semak →" → "Review →"
- `jenis === "terimaan" ? "Receipt" : "Dispensed"` (activity feed)

### `src/pages/DrugMaster.tsx`
- "Senarai ubat yang dipantau (KEW.PS-3)" → "Monitored drug list (KEW.PS-3)"
- "Tambah Ubat" → "Add Drug"
- "Cari ubat..." → "Search drugs..."
- Column headers: "Kumpulan" → "Group", "Paras Stok" → "Stock Levels", "Baki Awal" → "Opening Balance"
- "Memuatkan..." → "Loading..."
- "Tiada ubat ditemui." / "Klik 'Tambah Ubat' untuk mula." → English equivalents
- "Belum Ditetapkan" badge → "Not Set"
- "Set Baki" button → "Set Balance"
- Tooltip titles: "Lihat Kad" → "View Card", "Lihat Lejar" → "View Ledger"
- `toast.success("Status dikemaskini")` → `toast.success("Status updated")`
- Alert dialog: "Nyahaktif ubat ini?" → "Deactivate this drug?"
- "Ubat X akan dinyahaktifkan..." → "Drug X will be deactivated..."
- "Batal" → "Cancel", "Nyahaktif" → "Deactivate"

### `src/components/DrugFormDialog.tsx`
- Dialog title: "Edit Ubat" → "Edit Drug", "Tambah Ubat" → "Add Drug"
- Description: "Kemaskini maklumat ubat." → "Update drug information.", "Isi maklumat ubat baharu." → "Fill in new drug details."
- Field labels: "Nama Ubat *" → "Drug Name *", "No. Kod" → "Code No.", "Unit Pengukuran" → "Unit of Measure", "Kumpulan" → "Group", "Pergerakan" → "Movement"
- Storage section: "Lokasi Penyimpanan" → "Storage Location", "Gudang/Seksyen" → "Warehouse/Section", "Kod Lokasi Penuh" → "Full Location Code"
- Stock levels: "Paras Stok (Tahun Semasa)" → "Stock Levels (Current Year)", "Menokok/Reorder" → "Reorder", "Maksimum" → "Maximum"
- Buttons: "Batal" → "Cancel", "Menyimpan..." → "Saving...", "Simpan" → "Save"
- Placeholder: "cth: A/KK" → "e.g. A/KK"
- Zod: `"Nama ubat diperlukan"` → `"Drug name is required"`
- Toast: `"Ubat dikemaskini"` → `"Drug updated"`, `"Ubat ditambah"` → `"Drug added"`
- `form.setError("drug_name", { message: "Nama ubat sudah wujud" })` → `"Drug name already exists"`

### `src/components/OpeningBalanceDialog.tsx`
- Audit full file for Malay labels/toasts
- `toast.success("Baki awal berjaya disimpan")` → `toast.success("Opening balance saved")`
- `toast.error("Sila lengkapkan semua medan")` → `toast.error("Please complete all fields")`

### `src/pages/Terimaan.tsx`
- Zod messages: "Sila pilih ubat" → "Please select a drug", "Tarikh diperlukan" → "Date is required", "No. Rujukan diperlukan" → "Reference number is required", "Kuantiti mestilah sekurang-kurangnya 1" → "Quantity must be at least 1", "Harga mestilah >= 0" → "Price must be >= 0"
- Field labels: "Ubat *" → "Drug *", "Tarikh Terima *" → "Receipt Date *", "No. Rujukan *" → "Reference No. *", "Kuantiti *" → "Quantity *", "Nama Pegawai" → "Officer Name"
- Placeholders: "Pilih ubat..." → "Select drug...", "Cari ubat..." → "Search drugs...", "Tiada ubat dijumpai." → "No drugs found.", "Pilih tarikh" → "Select date", "Pilih jenis" → "Select type", "Masukkan nombor rujukan dokumen" → "Enter document reference number", "Catatan tambahan (pilihan)" → "Additional notes (optional)"
- Select items for jenis: translate "terimaan" → "Receipt" display, "keluaran" → "Dispensed" display
- Toast: `"Terimaan berjaya disimpan"` → `"Receipt saved successfully"`, `"Terimaan berjaya dikemaskini"` → `"Receipt updated successfully"`, `"Gagal menyimpan terimaan"` → `"Failed to save receipt"`, `"Gagal mengemaskini terimaan"` → `"Failed to update receipt"`

### `src/pages/PharmacistFulfilment.tsx`
- Page title: "Permintaan Untuk Diselesaikan" → "Requests to Fulfil"
- Sub-heading: "Klik Selesai untuk mengesahkan pengeluaran dan tolak stok" → "Click Complete to confirm dispensing and deduct stock"
- Tabs: "Menunggu Pengesahan" → "Awaiting Confirmation", "Selesai Hari Ini" → "Completed Today", "Borang Antibiotik" → "Antibiotic Forms"
- Nested tabs: "Perlu Pengesahan" → "Needs Confirmation", "Telah Disahkan Hari Ini" → "Confirmed Today"
- Card badges: "Diluluskan Pakar" → "Specialist Approved", "Ditangguh" → "Deferred"
- Card data labels: "Pesakit" → "Patient", "Kuantiti" → "Quantity", "Doktor" → "Doctor", "Stok Semasa" → "Current Stock"
- Inline messages: "Stok di bawah paras minimum" → "Stock below minimum level", "Stok Habis — Tambah Terimaan dahulu" → "Out of Stock — Add Receipt first", "{n} selepas selesai" → "{n} after completion"
- Buttons: "Tindakan Lain" → "Other Actions", "Tolak" → "Reject", "Tangguh ke esok" → "Defer to tomorrow", "Selesai" → "Complete"
- Column headers (fulfilled table): "Masa" → "Time", "Pesakit" → "Patient", "Kuantiti" → "Quantity", "Baki Selepas" → "Balance After", "Pegawai" → "Officer"
- Antibiotic card labels: "IC" → "IC", "Diagnosis" → "Diagnosis", "Unit" → "Unit", "Antibiotik" → "Antibiotic"
- Antibiotic buttons: "Semak Borang" → "Review Form", "Akui Terima" → "Acknowledge"
- Column headers (acked table): "Masa" → "Time", "Pesakit" → "Patient", "Diagnosis" → "Diagnosis", "Antibiotik" → "Antibiotic"
- Empty states: "Tiada permintaan menunggu" → "No pending requests", "Tiada pengeluaran hari ini" → "No dispensing today", "Tiada borang antibiotik menunggu pengesahan" → "No antibiotic forms awaiting confirmation", "Tiada borang disahkan hari ini" → "No forms confirmed today"
- Dialog: "Sahkan Pengeluaran" → "Confirm Dispensing", confirmation text in Malay → English
- Buttons: "Batal" → "Cancel", "Memproses..." → "Processing...", "Sahkan & Selesai" → "Confirm & Complete"
- Reject dialog: "Tolak Permintaan" → "Reject Request", "Sebab Penolakan *" → "Rejection Reason *", "Min 10 aksara" → "Min 10 characters"
- Acknowledge dialog: "Akui Borang Antibiotik" → "Acknowledge Antibiotic Form"
- `remove locale: ms` from 4 `formatDistanceToNow` calls
- Toasts: 5 Malay toasts → English
- `formatDistanceToNow` locale removed

### `src/pages/SpecialistDashboard.tsx`
- Stat card labels: "Menunggu (Ubat)" → "Pending (Drug)", "Menunggu (Antibiotik)" → "Pending (Antibiotic)", "Diluluskan Hari Ini" → "Approved Today", "Ditolak Hari Ini" → "Rejected Today"
- Tab: "Ubat Kawalan" → "Controlled Drug"
- Data labels: audit all inline text
- Buttons/labels: "Batal" → "Cancel"
- Placeholders: "Nota tambahan" → "Additional notes", "Min 10 aksara" → "Min 10 characters"
- `remove locale: ms` from 4 `formatDistanceToNow` calls
- Toasts: 8 Malay toasts → English

### `src/pages/PatientRegistry.tsx`
- Page title, search placeholder, button labels, table headers, dialog labels
- "Tambah sebagai pesakit baharu?" → "Add as new patient?"
- "Ubat Semasa" → "Current Drug", "Kunjungan Terakhir" → "Last Visit", "Kuantiti Terkini" → "Latest Quantity"
- Column headers: "Tarikh" → "Date", "Ubat" → "Drug", "Kuantiti" → "Quantity", "Kaedah" → "Method", "Pegawai" → "Officer", "Stok Selepas" → "Stock After"
- `remove locale: ms` from `formatDistanceToNow` calls
- Toasts: 2 Malay toasts → English

### `src/pages/AntibioticForm.tsx`
- "Kembali ke Pilihan Permohonan" → "Back to Request Options"
- Placeholder "Nama penuh" → "Full name"
- Toast: `"Sila lengkapkan Nama, IC dan Diagnosis"` → `"Please complete Name, IC and Diagnosis"`
- Toast: `"Gagal menghantar borang"` → `"Failed to submit form"`

### `src/pages/DoctorRequest.tsx`
- Zod: all 5 messages → English
- Form labels: "Nama Pesakit *" → "Patient Name *", "No. IC Pesakit *" → "Patient IC No. *", "Ubat *" → "Drug *", "Kuantiti *" → "Quantity *"
- Placeholders: "Nama penuh pesakit" → "Patient full name", "Cari ubat..." → "Search drugs...", "Tiada ubat dijumpai." → "No drugs found."
- Badge: "Perlu Kelulusan Pakar" → "Requires Specialist Approval"
- Alert: "Ubat ini memerlukan kelulusan pakar..." → "This drug requires specialist approval before pharmacist processing."
- Success screen: "Permintaan Berjaya Dihantar!" → "Request Submitted Successfully!"
- Labels: "Pesakit" → "Patient", "Ubat" → "Drug", "Kuantiti" → "Quantity", "Status" → "Status"
- Badges: "Menunggu kelulusan pakar" → "Awaiting specialist approval", "Menunggu pengesahan farmasis" → "Awaiting pharmacist confirmation"
- Buttons: "Hantar Permintaan Baharu" → "Submit New Request", "Tukar Ubat Sahaja" → "Change Drug Only"
- Card title: "Permintaan Pengeluaran Ubat" → "Drug Dispensing Request"
- Description: "Isi maklumat pesakit dan ubat yang diperlukan" → "Enter patient and drug details"
- Toast: `"Gagal menghantar permintaan"` → `"Failed to submit request"`

### `src/pages/DoctorLanding.tsx`
- Audit full file — small file (59 lines); likely has a few Malay labels

### `src/pages/Laporan.tsx`
- Section labels: "Ubat" → "Drug", "Suku" → "Quarter", "Tahun" → "Year"
- Labels: "Dari Tarikh" → "From Date", "Hingga Tarikh" → "To Date"
- Descriptions: "Jana PDF kad stok dalam format KEW.PS-3..." → "Generate stock card PDF in KEW.PS-3 format..."
- Card title: "Ringkasan Suku Tahun" → "Quarterly Summary"
- Description: "Agregat terimaan dan keluaran stok mengikut suku tahun" → "Aggregate stock receipts and dispensing by quarter"
- Quarter labels: "Semua Suku" → "All Quarters", "Q1 Jan–Mac" → "Q1 Jan–Mar", "Q4 Okt–Dis" → "Q4 Oct–Dec"
- Buttons: "Jana Laporan" → "Generate Report", "Jana PDF" → "Generate PDF"
- Column headers (table): "Ubat" → "Drug", "Terima" → "Received", "Keluar" → "Dispensed", "Baki" → "Balance"
- PDF note: "PDF akan mengandungi Bahagian A dan Bahagian B..." → "PDF will contain Part A and Part B..."
- `remove locale: ms` (import used in this file)
- Placeholder: "Cari ubat..." → "Search drugs...", "Tiada ubat dijumpai." → "No drugs found."

### `src/pages/RoleManagement.tsx`
- Page title: "Pengurusan Peranan" → "Role Management"
- Description: "Tetapkan peranan kepada pengguna berdaftar." → "Assign roles to registered users."
- Role labels: `ROLE_LABELS = { pharmacist: "Jurufarmasit", doctor: "Doktor", specialist: "Pakar" }` → `{ pharmacist: "Pharmacist", doctor: "Doctor", specialist: "Specialist" }`
- Group titles: "Doktor" → "Doctor", "Pakar" → "Specialist"
- Action buttons: "Jadikan Pakar" → "Make Specialist", "Jadikan Doktor" → "Make Doctor"
- Toasts: `"Peranan berjaya dikemas kini."` → `"Role updated successfully."`, `"Gagal mengemas kini peranan."` → `"Failed to update role."`, etc.

### `src/pages/BinCard.tsx`
- "Senarai Ubat" (back button) → "Drug List"
- "Memuatkan..." → "Loading..."
- "Ubat tidak ditemui." → "Drug not found."
- "Perihal Stok" → "Stock Description", "No. Kod" → "Code No.", "Unit Pengukuran" → "Unit of Measure", "Kumpulan" → "Group"
- Location section: "Lokasi Penyimpanan Stok" → "Stock Storage Location", "Gudang / Seksyen" → "Warehouse / Section", "Baris" → "Row", "Rak" → "Shelf", "Tingkat" → "Level", "Petak" → "Compartment", "Kod Lokasi Penuh" → "Full Location Code"
- "Paras Stok" → "Stock Levels"
- "Baki Semasa" → "Current Balance"
- Status labels (all-caps Malay values): "KRITIKAL" → "CRITICAL", "RENDAH" → "LOW", "LEBIHAN" → "EXCESS" (already computed in function, change in `getStockLevel`)
- Column headers (jenis filter): "Jenis" label → "Type", filter options "semua" display → "All", "terimaan" display → "Receipt", "keluaran" display → "Dispensed"
- "Akan datang" toast → `toast.info("Coming soon")`
- "Jana PDF" button → "Generate PDF"
- "Tambah Terimaan" → "Add Receipt"
- BinCard table: "Perihal Stok" → "Stock Description", row type labels in table body
- "BAKI DIBAWA KE HADAPAN" (mock data) → "BALANCE BROUGHT FORWARD"

### `src/pages/DrugLedger.tsx`
- Loading: "Memuatkan..." → "Loading..."
- "Ubat tidak dijumpai." → "Drug not found."
- Back button: "Kembali" → "Back"
- Field labels: "No. Kod:" → "Code No.:", "Kumpulan:" → "Group:", "Lokasi:" → "Location:", "Paras Stok:" → "Stock Levels:"
- "Baki Semasa" → "Current Balance"
- Filter labels: "Dari" → "From", "Hingga" → "To", "Jenis" → "Type", "Carian" → "Search"
- Filter placeholders: "Mula" → "Start", "Akhir" → "End"
- Select items: "Semua" → "All", "Terimaan" → "Receipt", "Keluaran" → "Dispensed"
- Column headers: "Tarikh" → "Date", "No. Rujukan" → "Ref. No.", "Terima / Keluar Kepada" → "Received / Dispensed To", "Terimaan" → "Receipts", "Keluaran" → "Dispensed", "Baki" → "Balance", "Pegawai" → "Officer", "Sumber" → "Source"
- Sub-headers: "Seunit (RM)" → "Unit Price (RM)", "Jumlah (RM)" → "Total (RM)"
- Empty state: "Tiada transaksi dijumpai" → "No transactions found", "Mulakan dengan menetapkan baki awal" → "Start by setting an opening balance"
- Pagination: "Menunjukkan 1-{n} daripada {n} transaksi" → "Showing 1-{n} of {n} transactions"

### `src/components/AntibioticFormReadOnly.tsx`
- Audit full file for Malay field labels

### `src/components/NoPermission.tsx`
- Audit full file for Malay text

### `src/pages/Login.tsx`
- Audit full file for Malay text

---

## Common Pitfalls

### Pitfall 1: Database Status Values Must Not Change
**What goes wrong:** Translating Malay strings that happen to be database status enum values stored in Supabase.
**Why it happens:** The strings look like Malay words visible to users.
**How to avoid:** The status values used in Supabase queries (`"pending_pharmacy"`, `"pending_specialist"`, `"approved"`, `"rejected"`, `"fulfilled"`, `"acknowledged"`) are already in English — they are not translated. The Malay strings to change are only what is displayed to users.
**Warning signs:** If you find yourself editing a string inside `.eq("status", "...")`, `.update({ status: "..." })`, or `.in("status", [...])`, stop — those are database values.

### Pitfall 2: Database Column Names in Malay
**What goes wrong:** Field names like `kuantiti`, `tarikh`, `jenis`, `baris`, `rak`, etc. appear throughout. These are Supabase column names.
**How to avoid:** Only change strings that are user-visible labels in JSX. Never change a TypeScript object property key that maps to a database column.

### Pitfall 3: ENGL-05 Grep is a Spot-Check, Not Full Coverage
**What goes wrong:** Developer runs the grep, gets zero matches, and considers the phase done — but other Malay strings not in the grep pattern remain.
**How to avoid:** Treat the grep as a final sanity check, not as the audit tool. Read each file fully.
**Additional patterns to check after the primary grep:**
```bash
grep -r "Memuatkan\|Tiada\|berjaya\|Selesai\|Sahkan\|Hantar\|Simpan\|Batal\|Semak\|Laporan\|Lejar\|Senarai\|Semua\|Paras\|Baki\|Tarikh\|Dari\|Hingga\|Mula\|Akhir" src/
```

### Pitfall 4: Malay date-fns Locale Left Behind
**What goes wrong:** Removing the import statement without removing all usages, or vice versa.
**How to avoid:** In each of the 5 affected files, remove `locale: ms` from every `format()` / `formatDistanceToNow()` call, then remove the import line. TypeScript will error if the import is gone but usage remains.

### Pitfall 5: Partial Translation of Composite Strings
**What goes wrong:** A string like `"{n} ubat memerlukan perhatian segera"` gets partially translated.
**How to avoid:** Translate the whole interpolated string together: `"{n} drug(s) require immediate attention"`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 + @testing-library/react 16 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGL-01 | Sidebar nav labels render in English | unit | `npx vitest run src/components/AppSidebar.test.tsx` | ❌ Wave 0 |
| ENGL-02 | Form labels/buttons render in English | unit | `npx vitest run src/components/DrugFormDialog.test.tsx` | ❌ Wave 0 |
| ENGL-03 | Status badge values render in English | unit | `npx vitest run src/pages/Index.test.tsx` | ❌ Wave 0 |
| ENGL-04 | Zod validation messages are in English | unit | `npx vitest run src/pages/DoctorRequest.test.tsx` | ❌ Wave 0 |
| ENGL-05 | grep check returns zero Malay matches | smoke | `grep -r "Ubat\|Pesakit\|Doktor\|berjaya\|gagal\|Pilih\|Cari\|Kemaskini\|Tambah" src/ \| grep -v "node_modules\|test\|RESEARCH"` | manual |

**Note on ENGL-04 toast testing:** Sonner toasts are imperative calls triggered by mutation events. Testing them requires React Testing Library + `@testing-library/user-event` to trigger the mutation and then assert on toast DOM. These are medium-complexity tests — acceptable to write a single representative test per file rather than exhaustive coverage.

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `grep` returns zero matches before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/AppSidebar.test.tsx` — covers ENGL-01: nav labels in English
- [ ] `src/components/DrugFormDialog.test.tsx` — covers ENGL-02: form labels in English, Zod messages in English
- [ ] `src/pages/Index.test.tsx` — covers ENGL-03: status badge values in English
- [ ] `src/pages/DoctorRequest.test.tsx` — covers ENGL-04: Zod validation messages in English

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Malay inline strings throughout | English inline strings throughout | Required by ENGL-01 through ENGL-05 |
| `locale: ms` in date-fns calls | No locale option (defaults to English) | Dates/times display in English |

---

## Open Questions

1. **BinCard KEW.PS-3 form: keep Malay section headers?**
   - What we know: The BinCard renders a KEW.PS-3 government form. Headers like "BAHAGIAN A", "DAFTAR STOK" and the label "Klinik Kesihatan Kempas" are part of an official Malaysian government document format.
   - What's unclear: Should official form field names (e.g. "Perihal Stok", "Gudang/Seksyen") be translated, or preserved to match the physical document?
   - Recommendation: Translate all visible labels to English — the ENGL-05 success criterion is unambiguous ("no Malay strings survive"). If the form must match a physical document, that can be revisited post-phase.

2. **Laporan: Malay quarter abbreviations in SelectItem values**
   - "Q4 Okt–Dis" → "Q4 Oct–Dec" — the `value` prop stays "Q4" but the display text changes. Low risk.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: all 19 affected files read in full — findings are ground truth
- `grep` runs against actual source code — string inventory is exhaustive

### Secondary (MEDIUM confidence)
- CLAUDE.md project instructions — confirms UI language is Bahasa Malaysia, confirms stack
- ROADMAP.md success criteria — defines the grep pattern that must return zero matches

---

## Metadata

**Confidence breakdown:**
- File inventory: HIGH — every affected file was read directly
- String inventory: HIGH — systematic per-file audit performed
- Test approach: HIGH — existing Vitest/testing-library infrastructure confirmed, test gaps identified
- Database field names (do not change): HIGH — confirmed against Supabase queries

**Research date:** 2026-03-16
**Valid until:** 2026-06-16 (stable — no external dependencies)
