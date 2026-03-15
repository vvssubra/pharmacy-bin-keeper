-- ============================================================
-- Migration: Role Consolidation (admin + pharmacist → pharmacist)
-- Date: 2026-03-16
-- Reduces roles to 3: pharmacist, doctor, specialist
-- ============================================================

-- 1. Migrate existing data: admin → pharmacist, remove staff
UPDATE public.user_roles SET role = 'pharmacist' WHERE role = 'admin';
DELETE FROM public.user_roles WHERE role = 'staff';

-- 2. Add CHECK constraint to prevent future use of admin/staff
--    (Postgres enums cannot have values removed, so we enforce at constraint level)
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_valid_role;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_valid_role
  CHECK (role IN ('pharmacist', 'doctor', 'specialist'));

-- 3. Update handle_new_user() so new signups get NO default role
--    (unassigned until a pharmacist promotes them)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  -- No default role: pharmacist must assign via Role Management page
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. RLS: Allow pharmacist to read ALL user_roles rows
DROP POLICY IF EXISTS "Pharmacists can view all user_roles" ON public.user_roles;
CREATE POLICY "Pharmacists can view all user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacist'
    )
    OR user_id = auth.uid()  -- users can always read their own role
  );

-- 5. RLS: Allow pharmacist to INSERT user_roles
DROP POLICY IF EXISTS "Pharmacists can insert user_roles" ON public.user_roles;
CREATE POLICY "Pharmacists can insert user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacist'
    )
  );

-- 6. RLS: Allow pharmacist to UPDATE user_roles
DROP POLICY IF EXISTS "Pharmacists can update user_roles" ON public.user_roles;
CREATE POLICY "Pharmacists can update user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacist'
    )
    AND user_id != auth.uid()  -- pharmacist cannot change their own role
  );

-- 7. RLS: Allow pharmacist to DELETE user_roles
DROP POLICY IF EXISTS "Pharmacists can delete user_roles" ON public.user_roles;
CREATE POLICY "Pharmacists can delete user_roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacist'
    )
    AND user_id != auth.uid()  -- pharmacist cannot delete their own role
  );

-- 8. RLS: Allow pharmacist to read ALL profiles (needed for role management page)
DROP POLICY IF EXISTS "Pharmacists can view all profiles" ON public.profiles;
CREATE POLICY "Pharmacists can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacist'
    )
  );

-- 9. SECURITY DEFINER function to list all users with roles + email from auth.users
--    Required because auth.users is not directly queryable from the client.
DROP FUNCTION IF EXISTS public.get_all_users_with_roles();
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE (
  user_id  UUID,
  email    TEXT,
  full_name TEXT,
  facility  TEXT,
  role      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    u.email::TEXT,
    p.full_name,
    p.facility,
    ur.role::TEXT
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  ORDER BY p.full_name;
$$;
