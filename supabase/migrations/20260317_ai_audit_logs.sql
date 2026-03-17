-- supabase/migrations/20260317_ai_audit_logs.sql
CREATE TABLE public.ai_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id),
  role          text NOT NULL,
  function_name text NOT NULL,
  status_code   integer NOT NULL,
  tokens_used   integer,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- No RLS SELECT for regular users (audit only — admin can query directly in Supabase dashboard)
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Edge Function writes using service_role key (bypasses RLS) — no INSERT policy needed for authenticated users
-- Admin can read all logs via Supabase dashboard using service_role
