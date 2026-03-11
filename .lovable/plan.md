

## Dashboard Page — Implementation Plan

### Full Rewrite of `src/pages/Index.tsx`

Single page component fetching real data from the database via `useQuery`.

**Data Queries:**
1. All drugs from `drugs` table (name, unit, stok_min, stok_reorder, stok_max, id)
2. All transactions from `transactions` table to compute current baki per drug (sum terimaan/baki_awal minus keluaran)
3. Last 10 transactions (joined with drug name) for activity feed

**Stock Status Calculation (per drug):**
- Compute `baki` from transactions: sum(kuantiti where jenis in ['terimaan','baki_awal']) - sum(kuantiti where jenis='keluaran')
- Status: baki < stok_min → KRITIKAL, baki < stok_reorder → RENDAH, baki > stok_max → LEBIHAN, else NORMAL
- If stok_min/max are null/0 → TIADA PARAS

**Section 1 — 4 Stat Cards:** Count drugs per status category. Icons: AlertTriangle (red), TrendingDown (orange), CheckCircle (green), TrendingUp (blue).

**Section 2 — Alert Banner:** Dismissible red Alert if KRITIKAL count > 0.

**Section 3 — Drug Stock Table:** Full-width table sorted by severity. Columns: Drug Name (link to ledger), Unit, Baki Semasa, Min/Reorder/Max, Status Badge, Progress bar (baki/max %), Last Updated, Quick Actions (Lihat Kad + Tambah Terimaan links).

**Section 4 — Recent Activity Feed:** Card with last 10 transactions. Each row: drug name, type badge, quantity, pegawai, relative time (date-fns `formatDistanceToNow`).

**Section 5 — Import Status Card:** Mock data card showing last import date and current week status, with "Upload Sekarang" button linking to `/upload`.

**Mock data strategy:** Generate 50 mock drugs with varied stock levels inline (since we want realistic display regardless of DB state), but also attempt real DB fetch — use mock as fallback if DB is empty.

### Files Changed

| File | Action |
|------|--------|
| `src/pages/Index.tsx` | Full rewrite — all 5 sections with real+mock data |

