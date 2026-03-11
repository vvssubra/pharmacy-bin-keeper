

## Digital Bin Card Page — Implementation Plan

### 1. New File: `src/pages/BinCard.tsx`

Full page mimicking the physical KEW.PS-3 bin card layout.

**Bahagian A — Drug Info Card:**
- Dark navy (#1A3C6E) header bar with "KEW.PS-3 | DAFTAR STOK" left, facility name right
- Grid of drug info: Drug Name (bold, light blue bg), No. Kod, Unit, Kumpulan, Pergerakan
- Inner table for storage location (Gudang/Baris/Rak/Tingkat/Petak/Kod Lokasi)
- Inner table for Paras Stok (Tahun/Maksimum/Menokok/Minimum)
- Baki Semasa strip with colored status badge (KRITIKAL/RENDAH/NORMAL/LEBIHAN)

**Filter Bar:** Date range pickers, transaction type dropdown, search input (patient name/no. rujukan), reset link.

**Bahagian B — Transaction Table:**
- Grouped column headers: Terimaan (Kuantiti/Seunit RM/Jumlah RM), Keluaran (Kuantiti/Jumlah RM), Baki (Kuantiti/Jumlah RM)
- Row color rules: green bg + green left border for Keluaran, red bg + red left border for Terimaan, purple bg for Baki Awal
- Patient name with prescription number in grey text below for Keluaran rows
- "BAKI DIBAWA KE HADAPAN" italic for Baki Awal row
- Empty cells show em dash "—"
- Footer row with JUMLAH sums, pinned style
- Pagination: 50 rows per page
- Sorted ascending by date

**Mock Data:** 20 rows for "Empagliflozin 25mg Tablet" — 1 baki awal (500), 3 terimaan, 16 keluaran. Running baki mathematically correct, final rows drop below min threshold (100).

**Header Actions:** Back button "← Senarai Ubat" → /drugs, "Jana PDF" (outlined, toast coming soon), "Tambah Terimaan" (primary, navigates to /terimaan).

Data: Fetches real drug info from Supabase by `:id` param, uses mock transactions.

### 2. Update: `src/App.tsx`

Add route `/drugs/:id/bincard` pointing to new BinCard component.

### 3. Update: `src/pages/DrugMaster.tsx`

- Make drug name in table a clickable link (`navigate(/drugs/${id}/bincard)`)
- Add "Lihat Kad" button in Actions column linking to `/drugs/:id/bincard`

### Files Changed

| File | Action |
|------|--------|
| `src/pages/BinCard.tsx` | New file |
| `src/App.tsx` | Add bincard route |
| `src/pages/DrugMaster.tsx` | Clickable drug names + Lihat Kad button |

