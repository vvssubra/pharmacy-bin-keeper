ALTER TABLE public.antibiotic_forms
  ADD COLUMN IF NOT EXISTS pathway_check_result text
    CHECK (pathway_check_result IN ('supported', 'review', 'not_supported', 'refer_specialist', 'unavailable'));
