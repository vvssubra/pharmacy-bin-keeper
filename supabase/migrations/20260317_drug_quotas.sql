-- Annual patient quota per controlled drug, set by Admin
CREATE TABLE public.drug_quotas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id    uuid NOT NULL REFERENCES public.drugs(id) ON DELETE CASCADE,
  year       integer NOT NULL CHECK (year >= 2024),
  quota_limit integer NOT NULL CHECK (quota_limit >= 0),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(drug_id, year)
);

ALTER TABLE public.drug_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read drug_quotas"
  ON public.drug_quotas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert drug_quotas"
  ON public.drug_quotas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY "Admin can update drug_quotas"
  ON public.drug_quotas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY "Admin can delete drug_quotas"
  ON public.drug_quotas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
