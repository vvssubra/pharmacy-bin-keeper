

## Laporan Page — Implementation Plan

### Full Rewrite: `src/pages/Laporan.tsx`

Single file rewrite. Route already exists at `/laporan`.

**Page Header:** Title "Laporan" + subtitle "Jana laporan dan eksport data"

**3 Report Cards** in a responsive grid (`grid-cols-1 lg:grid-cols-3`):

1. **Kad Stok Digital (KEW.PS-3):** Drug combobox (fetches from `drugs` table), date range pickers, "Jana PDF" button (toast "Coming soon"), preview note text.

2. **Ringkasan Suku Tahun:** Year select (2024-2026), Quarter select (Q1-Q4 + Semua), "Jana Laporan" + "Export Excel" buttons (toast), mock quarterly summary table below (5-6 drugs with terimaan/keluaran totals per quarter).

3. **Ringkasan Pergerakan Ubat:** Date range pickers, "Cari" button, results table: Drug Name, Total Keluaran Qty, Total Nilai RM, Bilangan Transaksi, Avg per Transaction, Last Dispensed — populated with mock data.

**Import History Section** below cards: Full-width Card with table of mock import batches (5 rows). Columns: Tarikh, Diupload Oleh, Bilangan Fail, Transaksi Berjaya, Ralat, Tindakan. "View Details" uses Collapsible to expand inner per-drug breakdown table. "Rollback" shows confirmation toast.

All buttons show "Akan datang" toast. Drug combobox uses Command/Popover pattern (same as Terimaan page). Date pickers use Popover + Calendar with `pointer-events-auto`.

### Files Changed

| File | Action |
|------|--------|
| `src/pages/Laporan.tsx` | Full rewrite |

