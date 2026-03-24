-- Add is_pesara column to dispensing_requests
-- Required for Phase 05 Pesara (government retiree) patient classification

ALTER TABLE public.dispensing_requests
  ADD COLUMN IF NOT EXISTS is_pesara boolean NOT NULL DEFAULT false;
