

## Terimaan Page — Implementation Plan

### 1. Database Migration

The `transactions` table needs additional columns for Terimaan data:

```sql
ALTER TABLE public.transactions
  ADD COLUMN jenis_rujukan text,
  ADD COLUMN no_rujukan text,
  ADD COLUMN terima_daripada text,
  ADD COLUMN harga_seunit numeric(12,4) DEFAULT 0,
  ADD COLUMN jumlah_rm numeric(12,2) DEFAULT 0,
  ADD COLUMN nama_pegawai text,
  ADD COLUMN catatan text;
```

All nullable with defaults — won't break existing baki_awal rows.

### 2. Full Rewrite: `src/pages/Terimaan.tsx`

**Layout:** Two-column grid on desktop (`grid-cols-1 lg:grid-cols-2`).

**Left — Entry Form (Card):**
- Drug combobox: fetches from `drugs` table via useQuery, uses shadcn Command/Popover pattern for searchable select
- Date picker (Popover + Calendar, defaults to today)
- Jenis Rujukan: Select (PK / BTB / BPSS / BPSI / BPIN)
- No. Rujukan, Terima Daripada, Kuantiti, Harga Seunit (4dp), Jumlah RM (auto-calc, read-only)
- Nama Pegawai (defaults to `profile.full_name` from AuthContext)
- Catatan textarea
- Zod validation schema, react-hook-form
- On submit: insert into `transactions` with `jenis = 'terimaan'`, invalidate queries, toast success
- Live preview card: "Selepas simpan, baki [Drug] akan berubah dari X kepada X+Kuantiti" — fetches current baki from transactions sum

**Right — Recent Log (Card):**
- useQuery: last 20 transactions where `jenis = 'terimaan'`, joined with drug name, ordered by created_at desc
- Table: Tarikh, Ubat, Kuantiti, Jumlah RM, No. Rujukan, Pegawai, Actions
- Edit button (pencil): visible if admin role AND entry < 24hrs old — opens Dialog with pre-filled form
- Edit uses update mutation

### 3. Files Changed

| File | Action |
|------|--------|
| `supabase/migrations/...` | Add columns to transactions |
| `src/pages/Terimaan.tsx` | Full rewrite — form + log |

No route/sidebar changes needed — already configured.

