
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
  kod_lokasi_penuh text DEFAULT '',
  stok_min integer DEFAULT 0,
  stok_reorder integer DEFAULT 0,
  stok_max integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view drugs"
ON public.drugs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert drugs"
ON public.drugs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update drugs"
ON public.drugs FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.compute_kod_lokasi_penuh()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.kod_lokasi_penuh := array_to_string(
    ARRAY(SELECT unnest(ARRAY[NEW.gudang_seksyen, NEW.baris, NEW.rak, NEW.tingkat, NEW.petak]) AS v WHERE v IS NOT NULL AND v <> ''),
    '-'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_kod_lokasi_penuh
  BEFORE INSERT OR UPDATE ON public.drugs
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_kod_lokasi_penuh();

CREATE TRIGGER update_drugs_updated_at
  BEFORE UPDATE ON public.drugs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
