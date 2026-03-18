-- supabase/migrations/20260318_auth_fix.sql

-- ── 1. Add missing role values to enum ──────────────────────────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fms';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mo';

-- ── 2. Fix handle_new_user: create profile only, no auto-role ────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  -- No role assigned — user sees Pending Approval screen until admin assigns one
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 2b. Ensure user_roles has a single-column unique on user_id (required for upsert onConflict: "user_id") ──
-- Each user holds exactly one role — this also drops the old composite unique
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- ── 3. is_admin() helper (SECURITY DEFINER — bypasses RLS safely) ────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ── 4. Fix user_roles SELECT: admins see all rows ────────────────────────────
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
CREATE POLICY "Admins can view all user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ── 5. Fix user_roles INSERT/UPDATE/DELETE: allow admins ────────────────────
-- Remove overly-broad pharmacist write policies from previous migration
DROP POLICY IF EXISTS "Pharmacists can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Pharmacists can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Pharmacists can delete user_roles" ON public.user_roles;

DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
CREATE POLICY "Admins can insert user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
CREATE POLICY "Admins can update user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_admin() AND user_id != auth.uid());

DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;
CREATE POLICY "Admins can delete user_roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_admin() AND user_id != auth.uid());

-- ── 6. Fix profiles SELECT: admins see all profiles ─────────────────────────
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ── 7. get_all_users_with_roles RPC (admin-only, SECURITY DEFINER) ──────────
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE (
  user_id  uuid,
  email    text,
  full_name text,
  facility  text,
  role      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
    SELECT
      p.user_id,
      u.email::text,
      p.full_name,
      p.facility,
      ur.role::text
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
    ORDER BY p.full_name;
END;
$$;
