# Pharmacy Bin Keeper — Repository Overview

## What It Is

**Pharmacy Bin Keeper** ("Kawalan Ubat KK Kempas") is a clinic pharmacy stock and dispensing app. It tracks drug stock (bin-card style), receipts (terimaan), dispensing requests, antibiotic forms, and specialist approvals. Built with **React + Vite + TypeScript**, **Supabase** (auth + DB), **shadcn/ui**, **Tailwind**, and **TanStack Query**.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, React Router 6, TanStack Query |
| UI | shadcn/ui (Radix), Tailwind CSS, Lucide icons, Recharts |
| Backend / data | Supabase (Auth, Postgres) |
| Forms / validation | React Hook Form, Zod, @hookform/resolvers |
| Build / test | Vite, Vitest, Playwright |

---

## App Structure

- **`src/App.tsx`** — Route tree: `/login`, doctor (`/request`, `/request/ubat`, `/request/antibiotik`), specialist (`/specialist`), pharmacist/admin (dashboard, drugs, ledger, bincard, terimaan, fulfilment, pesakit, laporan). All except `/login` are behind `ProtectedRoute`.
- **`src/contexts/AuthContext.tsx`** — Supabase auth; exposes `user`, `session`, `profile` (full_name, facility), `role` from `user_roles`, `loading`, `signOut`.
- **`src/components/ProtectedRoute.tsx`** — Redirects to `/login` if not authenticated; shows loading while auth is resolving.
- **`src/components/AppLayout.tsx`** + **`AppSidebar.tsx`** — Main layout and sidebar ("Kawalan Ubat KK Kempas") with nav to Dashboard, Permintaan Baharu, Drug Master, Terimaan, Pesakit, Laporan, Doctor Request, Specialist. Badge counts for pending dispensing + antibiotic acknowledgements.

---

## User Roles (Supabase)

- **`app_role`** (enum): `admin`, `pharmacist`, `staff`, `doctor`, `specialist` (latter two added in a later migration).
- **`profiles`** — `user_id`, `full_name`, `facility`.
- **`user_roles`** — `user_id`, `role` (one row per user/role).
- **Login** (`src/pages/Login.tsx`) redirects by role: `doctor` → `/request`, `specialist` → `/specialist`; others go to `/` (dashboard). There is no route-level guard by role; the sidebar is the same for everyone.

---

## Main Flows and Pages

1. **Dashboard (`/`, `Index.tsx`)**
   - Stock status (KRITIKAL / RENDAH / NORMAL / LEBIHAN / TIADA PARAS) from `drugs` + `transactions` (baki from terimaan/keluaran/baki_awal).
   - Stat cards, "Permintaan Menunggu" (pending dispensing + antibiotic forms), drug stock table with links to Lejar and Terima, recent activity and "Pengeluaran Terkini" (partially mock).

2. **Drug Master (`/drugs`)**, **Drug Ledger (`/drugs/:id/ledger`)**, **Bin Card (`/drugs/:id/bincard`)**
   - Drug list and per-drug ledger; Bin Card is a bin-card style view (some mock data in `BinCard.tsx` for demo).

3. **Terimaan (`/terimaan`)**
   - Record receipts (terimaan) to update stock.

4. **Doctor**
   - `/request` — landing; `/request/ubat` — submit dispensing request (patient, drug, qty); if drug has `perlu_kelulusan_pakar`, status is `pending_specialist`, else `pending_pharmacy`.
   - `/request/antibiotik` — antibiotic form (patient, diagnosis, regimen, checklist, etc.) → status `pending_specialist`.

5. **Specialist (`/specialist`, `SpecialistDashboard.tsx`)**
   - Lists `dispensing_requests` and `antibiotic_forms` in `pending_specialist` / `approved` / `rejected`.
   - Approve/reject with notes; sets `specialist_id`, `specialist_action_at`, `specialist_notes`. Approved dispensing → `pending_pharmacy`; approved antibiotic form → ready for pharmacist acknowledgement.

6. **Pharmacist fulfilment (`/fulfilment`)**
   - Process items in `pending_pharmacy` (dispensing + acknowledged antibiotic forms).

7. **Pesakit (`/pesakit`)**
   - Patient registry (`patient_registry`).

8. **Laporan (`/laporan`)**
   - Reports.

---

## Supabase Data Model (Main Tables)

- **`drugs`** — name, no_kod, unit_pengukuran, stok_min/reorder/max, storage fields (gudang_seksyen, rak, tingkat, etc.), `perlu_kelulusan_pakar`.
- **`transactions`** — `drug_id`, `jenis` (e.g. baki_awal, terimaan, keluaran), `kuantiti`, `nama_pegawai`, amounts, etc.
- **`dispensing_requests`** — patient (no_ic, patient_name), drug_id, quantity, status (e.g. pending_specialist → pending_pharmacy → fulfilled), prescriber, specialist fields, fulfilled_at/by.
- **`antibiotic_forms`** — patient, diagnosis, regimen, checklist, status (e.g. pending_specialist → approved/rejected), specialist action and acknowledgement (acknowledged_at/by).
- **`profiles`**, **`user_roles`** — as above.
- **`patient_registry`**, **`patient_drug_history`** — for patient list and dispensing history.

Migrations under **`supabase/migrations/`** define these tables, RLS, and triggers (e.g. `handle_new_user` for profile + default `staff` role).

---

## Notable Implementation Details

- **Dashboard** uses real `drugs` + `transactions` for stock and falls back to **mock data** when there are no drugs/transactions (e.g. `generateMockDrugs()`, `MOCK_ACTIVITY`). "Pengeluaran Terkini" table is still hardcoded mock.
- **BinCard** mixes real drug data with **mock ledger rows** for the bin-card table when needed.
- **AppSidebar** has two queries for antibiotic pending count (one with `head: true` and a fallback that always returns 0; the other actually fetches rows and uses `.length`).
- **AuthContext** uses `setTimeout(..., 0)` when loading profile/role after session change to avoid a possible deadlock.
- **ProtectedRoute** does not check `role`; any logged-in user can open any route. Role is only used for login redirect and UI (e.g. sidebar is the same for all).

---

## Tests and Tooling

- **Vitest** + **Testing Library** — `src/test/setup.ts`, `src/test/example.test.ts`.
- **Playwright** — `playwright.config.ts`, `playwright-fixture.ts` for E2E.
- **ESLint** — `eslint.config.js`.

---

## Quick Reference: Routes

| Path | Page | Purpose |
|------|------|---------|
| `/login` | Login | Auth; redirect by role |
| `/` | Dashboard (Index) | Stock overview, pending requests, activity |
| `/drugs` | DrugMaster | Drug list |
| `/drugs/:id/ledger` | DrugLedger | Per-drug ledger |
| `/drugs/:id/bincard` | BinCard | Bin card view |
| `/terimaan` | Terimaan | Record receipts |
| `/fulfilment` | PharmacistFulfilment | Process pending_pharmacy |
| `/pesakit` | PatientRegistry | Patient registry |
| `/laporan` | Laporan | Reports |
| `/request` | DoctorLanding | Doctor entry |
| `/request/ubat` | DoctorRequest | Submit dispensing request |
| `/request/antibiotik` | AntibioticForm | Submit antibiotic form |
| `/specialist` | SpecialistDashboard | Approve/reject requests & antibiotic forms |
