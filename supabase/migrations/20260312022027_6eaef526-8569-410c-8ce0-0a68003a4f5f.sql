
-- 1. Add doctor and specialist to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'specialist';

-- 2. Add perlu_kelulusan_pakar to drugs table
ALTER TABLE public.drugs ADD COLUMN IF NOT EXISTS perlu_kelulusan_pakar boolean NOT NULL DEFAULT false;

-- 3. Add nama_pesakit, no_ic, sumber to transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS nama_pesakit text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS no_ic text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS sumber text DEFAULT 'manual';

-- 4. Create dispensing_requests table
CREATE TABLE IF NOT EXISTS public.dispensing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id uuid NOT NULL REFERENCES public.drugs(id),
  patient_name text NOT NULL,
  no_ic text NOT NULL,
  quantity integer NOT NULL,
  prescriber_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending_pharmacy',
  submitted_by uuid REFERENCES auth.users(id),
  specialist_id uuid,
  specialist_action_at timestamp with time zone,
  specialist_notes text,
  fulfilled_by uuid,
  fulfilled_at timestamp with time zone,
  rejection_reason text,
  deferred_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dispensing_requests ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated can view
CREATE POLICY "Authenticated users can view dispensing_requests" ON public.dispensing_requests
  FOR SELECT TO authenticated USING (true);

-- RLS: Authenticated can insert
CREATE POLICY "Authenticated users can insert dispensing_requests" ON public.dispensing_requests
  FOR INSERT TO authenticated WITH CHECK (true);

-- RLS: Authenticated can update
CREATE POLICY "Authenticated users can update dispensing_requests" ON public.dispensing_requests
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 5. Create patient_registry table
CREATE TABLE IF NOT EXISTS public.patient_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL,
  no_ic text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view patient_registry" ON public.patient_registry
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert patient_registry" ON public.patient_registry
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update patient_registry" ON public.patient_registry
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 6. Create patient_drug_history table
CREATE TABLE IF NOT EXISTS public.patient_drug_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patient_registry(id),
  drug_id uuid NOT NULL REFERENCES public.drugs(id),
  quantity integer NOT NULL,
  method text NOT NULL DEFAULT 'appointment',
  officer_name text,
  stock_after integer,
  dispensed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_drug_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view patient_drug_history" ON public.patient_drug_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert patient_drug_history" ON public.patient_drug_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Updated_at triggers
CREATE TRIGGER update_dispensing_requests_updated_at
  BEFORE UPDATE ON public.dispensing_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_registry_updated_at
  BEFORE UPDATE ON public.patient_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
