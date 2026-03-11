

## Opening Balance Feature

### 1. Database: Create `transactions` table

```sql
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id uuid NOT NULL REFERENCES public.drugs(id) ON DELETE CASCADE,
  jenis text NOT NULL,
  kuantiti integer NOT NULL,
  tarikh date NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(drug_id, jenis) -- only one baki_awal per drug
);
```

- The UNIQUE constraint on `(drug_id, jenis)` where `jenis = 'baki_awal'` is enforced by a partial unique index instead: `CREATE UNIQUE INDEX idx_one_baki_awal_per_drug ON transactions(drug_id) WHERE jenis = 'baki_awal';`
- RLS: authenticated can SELECT, INSERT, UPDATE. Admin-only enforcement for baki_awal done client-side (role check from AuthContext).
- Add `update_updated_at` trigger.

### 2. Drug Master Page Changes (`DrugMaster.tsx`)

- Fetch opening balances: second query from `transactions` where `jenis = 'baki_awal'`, keyed by `drug_id`.
- Add new table column **"Baki Awal"** between Paras Stok and Status:
  - If balance exists: green text showing `"500 tab — 01/01/2026"` (quantity + unit + formatted date)
  - If not set: yellow Badge "Belum Ditetapkan" + "Set Baki" Button (only shown to admin role)
  - If already set and user is admin: show pencil icon to edit
- **Sorting**: drugs without baki_awal sort to top, then alphabetical by name.
- Update `colSpan` from 8 to 9 for empty/loading states.

### 3. New Component: `OpeningBalanceDialog.tsx`

- Dialog title: "Tetapkan Baki Awal — [Drug Name]"
- Fields: Tarikh Baki Awal (date picker using shadcn Popover + Calendar), Kuantiti Baki (number input)
- Helper text as specified
- If editing existing balance: show AlertDialog warning "Mengubah baki awal akan mengira semula semua baki. Teruskan?" before saving
- On save: upsert into `transactions` (insert or update where `drug_id` and `jenis = 'baki_awal'`)
- Invalidate both `["drugs"]` and `["transactions-baki-awal"]` queries

### 4. Files Changed

| File | Action |
|------|--------|
| `supabase/migrations/...` | New — transactions table + RLS + index |
| `src/pages/DrugMaster.tsx` | Add Baki Awal column, fetch transactions, sorting, dialog trigger |
| `src/components/OpeningBalanceDialog.tsx` | New — date picker + quantity form with edit warning |

