

## Drug Ledger Page — Implementation Plan

### 1. New Route

Add `/drugs/:id/ledger` route in `App.tsx` pointing to a new `DrugLedger` page component inside `AppLayout`.

### 2. Drug Master — Link to Ledger

Add a clickable drug name or "View Ledger" icon button in the DrugMaster table actions column that navigates to `/drugs/{id}/ledger`.

### 3. New Page: `src/pages/DrugLedger.tsx`

Uses `useParams` to get drug ID, fetches drug details from Supabase `drugs` table via `useQuery`. All transaction data is **mock** (hardcoded ~15 rows).

**Page Header:**
- Back button (`ArrowLeft` → `navigate('/drugs')`)
- Drug name as title, metadata row (No. Kod, Unit, Kumpulan, Lokasi, Paras Stok)
- Baki card: large current quantity with colored alert badge (KRITIKAL red / RENDAH orange / NORMAL green / LEBIHAN blue) based on stok_min/stok_max thresholds

**Filter Bar:**
- Date range: two date pickers (start/end) using shadcn Popover + Calendar
- Type dropdown: Select (Semua / Terimaan / Keluaran)
- Search input for reference number / officer name
- "Export Excel" button (right-aligned, non-functional placeholder)

**Ledger Table:**
- Multi-level header row with grouped sub-columns (Terimaan: Kuantiti/Seunit/Jumlah, Keluaran: Kuantiti/Jumlah, Baki: Kuantiti/Jumlah)
- Mock data: 15 rows with Baki Awal first, then mix of Terimaan and Keluaran with running balance calculated correctly
- Row styling: green left border for Terimaan, purple bg tint for Baki Awal, red text when baki < stok_min, alternating shading
- Sumber badge column (Excel Import grey / Manual blue / Baki Awal purple)

**Pagination:**
- 50 per page (mock only has 15, so single page), info text "Menunjukkan 1-15 daripada 15 transaksi"

**Empty State:**
- FileText icon + "Tiada transaksi dijumpai" + "Mulakan dengan menetapkan baki awal" link

**Client-side filtering** on mock data by date range, type, and search text.

### Files Changed

| File | Action |
|------|--------|
| `src/pages/DrugLedger.tsx` | New — full ledger page with mock data |
| `src/App.tsx` | Add route `/drugs/:id/ledger` |
| `src/pages/DrugMaster.tsx` | Add "Ledger" link/button in actions column |

