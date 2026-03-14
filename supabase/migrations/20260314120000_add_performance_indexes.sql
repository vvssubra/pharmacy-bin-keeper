-- Performance indexes for common query patterns (postgres-best-practices)
-- transactions: ledger and activity by drug_id, ordered by created_at
CREATE INDEX IF NOT EXISTS idx_transactions_drug_id_created_at
  ON public.transactions(drug_id, created_at DESC);

-- dispensing_requests: filter by status, order by created_at (dashboard, specialist, fulfilment)
CREATE INDEX IF NOT EXISTS idx_dispensing_requests_status_created_at
  ON public.dispensing_requests(status, created_at DESC);

-- drugs: active drug lists (Dashboard, DrugMaster, Terimaan)
CREATE INDEX IF NOT EXISTS idx_drugs_is_active_drug_name
  ON public.drugs(is_active, drug_name)
  WHERE is_active = true;

-- antibiotic_forms: approved and not yet acknowledged (fulfilment/sidebar counts)
CREATE INDEX IF NOT EXISTS idx_antibiotic_forms_approved_unack
  ON public.antibiotic_forms(acknowledged_at)
  WHERE status = 'approved';
