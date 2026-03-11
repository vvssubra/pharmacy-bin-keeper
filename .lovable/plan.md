

## Plan: Remove Upload Mingguan & Update Dashboard + Laporan

### 1. Remove Upload Mingguan

| File | Change |
|------|--------|
| `src/pages/UploadMingguan.tsx` | Delete file |
| `src/components/AppSidebar.tsx` | Remove "Upload Mingguan" menu item |
| `src/App.tsx` | Remove `/upload` route and UploadMingguan import |

### 2. Update Dashboard (`src/pages/Index.tsx`)

Replace the bottom row's "Import Status" card (Section 5) with a new "Aktiviti Terkini" card showing a compact table of last 10 keluaran transactions:

- Columns: Drug | Pesakit | IC | Kuantiti | Pegawai | Masa
- "Lihat Semua" link navigates to `/terimaan`
- Uses mock data (with patient names and IC numbers) as fallback
- Remove `Upload` icon import and `/upload` navigation references

The existing "Aktiviti Terkini" feed (Section 4, `lg:col-span-2`) stays. The new card replaces the Import Status card in the same grid position.

### 3. Update Laporan (`src/pages/Laporan.tsx`)

- Remove the entire "Sejarah Import" section (lines 301-396) and related mock data/state (`mockImportHistory`, `expandedImport`)
- Remove unused imports (`Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`, `RotateCcw`, `Eye`, `Clock`, `CheckCircle2`, `AlertCircle`)
- Add new 4th report card: **"Laporan Pengeluaran Harian"**
  - Date picker defaulting to today
  - Mock table: Drug | Pesakit | IC | Kuantiti | Pegawai | Masa
  - "Export Excel" button (toast "Akan datang")
- Change grid from `lg:grid-cols-3` to `lg:grid-cols-2` (4 cards, 2×2 layout)

### Files Changed

| File | Action |
|------|--------|
| `src/pages/UploadMingguan.tsx` | Delete |
| `src/components/AppSidebar.tsx` | Remove Upload item |
| `src/App.tsx` | Remove upload route |
| `src/pages/Index.tsx` | Replace Import Status card |
| `src/pages/Laporan.tsx` | Remove import history, add daily dispensing report |

