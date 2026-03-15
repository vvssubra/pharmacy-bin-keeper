-- Fix: circular RLS on user_roles causes infinite recursion.
-- Postgres evaluates ALL permissive SELECT policies together (OR),
-- so the self-referential EXISTS triggers recursion even though
-- "Users can view their own roles" alone would be sufficient.
--
-- Solution: use a SECURITY DEFINER helper that bypasses RLS
-- to break the circular dependency.

-- 1. Create a non-recursive helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_pharmacist()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'pharmacist'
  );
$$;

-- 2. Fix SELECT policy (was self-referential → infinite recursion)
DROP POLICY IF EXISTS "Pharmacists can view all user_roles" ON public.user_roles;
CREATE POLICY "Pharmacists can view all user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_pharmacist());

-- 3. Fix INSERT policy
DROP POLICY IF EXISTS "Pharmacists can insert user_roles" ON public.user_roles;
CREATE POLICY "Pharmacists can insert user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_pharmacist());

-- 4. Fix UPDATE policy
DROP POLICY IF EXISTS "Pharmacists can update user_roles" ON public.user_roles;
CREATE POLICY "Pharmacists can update user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_pharmacist() AND user_id != auth.uid());

-- 5. Fix DELETE policy
DROP POLICY IF EXISTS "Pharmacists can delete user_roles" ON public.user_roles;
CREATE POLICY "Pharmacists can delete user_roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_pharmacist() AND user_id != auth.uid());

-- 6. Fix profiles policy (also had self-referential recursion risk)
DROP POLICY IF EXISTS "Pharmacists can view all profiles" ON public.profiles;
CREATE POLICY "Pharmacists can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_pharmacist());
