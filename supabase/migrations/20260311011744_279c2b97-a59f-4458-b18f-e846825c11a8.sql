
CREATE OR REPLACE FUNCTION public.compute_kod_lokasi_penuh()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  parts text[];
  val text;
BEGIN
  parts := ARRAY[]::text[];
  FOREACH val IN ARRAY ARRAY[NEW.gudang_seksyen, NEW.baris, NEW.rak, NEW.tingkat, NEW.petak]
  LOOP
    IF val IS NOT NULL AND val <> '' THEN
      parts := array_append(parts, val);
    END IF;
  END LOOP;
  NEW.kod_lokasi_penuh := array_to_string(parts, '-');
  RETURN NEW;
END;
$$;
