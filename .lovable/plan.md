

## Drug Master Page — Implementation Plan

### 1. Database Migration

Create a `drugs` table with all required fields:

```sql
CREATE TABLE public.drugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name text NOT NULL UNIQUE,
  no_kod text DEFAULT '',
  unit_pengukuran text NOT NULL DEFAULT 'tablet',
  kumpulan text DEFAULT '',
  pergerakan text DEFAULT '',
  gudang_seksyen text DEFAULT '',
  baris text DEFAULT '',
  rak text DEFAULT '',
  tingkat text DEFAULT '',
  petak text DEFAULT '',
  kod_lokasi_penuh text GENERATED ALWAYS AS (
    concat_ws('-', nullif(gudang_seksyen,''), nullif(baris,''), nullif(rak,''), nullif(tingkat,''), nullif(petak,''))
  ) STORED,
  stok_min integer DEFAULT 0,
  stok_reorder integer DEFAULT 0,
  stok_max integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

RLS policies: authenticated users can SELECT, INSERT, UPDATE. Add `update_updated_at` trigger. Seed 3 sample drugs via insert tool.

### 2. Route Update

Change sidebar and `App.tsx` route from `/drug-master` to `/drugs` (or keep `/drug-master` — the user said `/drugs`). Update sidebar nav link.

### 3. Drug Master Page (`src/pages/DrugMaster.tsx`)

Full rewrite:
- **Header**: title "Drug Master", subtitle "Senarai ubat yang dipantau (KEW.PS-3)", "Tambah Ubat" button top-right
- **Search**: Input with Search icon to filter by drug name (client-side filter on fetched data)
- **Table**: 8 columns as specified. Inactive rows get `opacity-50`. Status column uses Badge (green for Active, muted for Inactive). Actions column has Edit and Deactivate/Activate buttons.
- **Data**: React Query `useQuery` to fetch from `drugs` table, `useMutation` for insert/update
- **Empty state**: FileText icon + message when no drugs

### 4. Add/Edit Drug Dialog (`src/components/DrugFormDialog.tsx`)

- shadcn Dialog + react-hook-form + zod validation
- Fields as specified, with storage location 5-input grid auto-concatenating into read-only Kod Lokasi Penuh
- Unit Pengukuran as shadcn Select (tablet/vial/sachet/capsule/other)
- On save: insert or update via Supabase, invalidate query cache
- Duplicate drug name check: query Supabase on submit, show inline form error if exists

### 5. Deactivate Confirmation Dialog

- shadcn AlertDialog triggered from Actions column
- On confirm: update `is_active = false` for that drug, invalidate cache

### 6. Seed Data

Insert 3 sample drugs after migration via insert tool:
- Paracetamol 500mg Tablet
- Amoxicillin 250mg Capsule
- Normal Saline 0.9% 500ml

### Files Changed

| File | Action |
|------|--------|
| `supabase/migrations/...` | New migration for `drugs` table + RLS |
| `src/App.tsx` | Update route `/drug-master` → `/drugs` |
| `src/components/AppSidebar.tsx` | Update nav URL to `/drugs` |
| `src/pages/DrugMaster.tsx` | Full rewrite with table, search, queries |
| `src/components/DrugFormDialog.tsx` | New — Add/Edit form dialog |

