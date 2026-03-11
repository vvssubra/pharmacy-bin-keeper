ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS jenis_rujukan text,
  ADD COLUMN IF NOT EXISTS no_rujukan text,
  ADD COLUMN IF NOT EXISTS terima_daripada text,
  ADD COLUMN IF NOT EXISTS harga_seunit numeric(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jumlah_rm numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nama_pegawai text,
  ADD COLUMN IF NOT EXISTS catatan text;