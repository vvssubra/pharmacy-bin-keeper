# Auth & User Management Fix — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Project:** pharmacy-bin-keeper (Digital Bin Card)

---

## Problem Statement

Three categories of bugs make user management completely broken:

1. **Login/Signup broken** — new users (email or Google) auto-get `staff` role which the frontend doesn't recognise, leaving them with no access and no explanation
2. **Role Management save button unresponsive** — RLS on `user_roles` only permits pharmacists to mutate rows; admins are silently blocked
3. **User list never loads** — `RoleManagement.tsx` calls `get_all_users_with_roles` RPC that doesn't exist in the database
4. **`fms` and `mo` roles missing from DB enum** — assigning these roles throws a DB-level enum violation
5. **No way to manually create users** — admin has no in-app path to pre-create accounts

---

## Goals

- Authenticated users with no assigned role see a **Pending Approval** screen
- Admins can view all users and assign/change roles from within the app
- Admins can create new email+password accounts with a role in one step
- Users can reset their own password via email link
- Login page supports both email/password and Google sign-in with Sign Up tab

---

## Role Enum Clarification

The `app_role` DB enum will have: `admin`, `pharmacist`, `staff`, `doctor`, `specialist`, `fms`, `mo` after this migration. However:
- `staff` and `doctor` are legacy values — existing rows are NOT migrated; those users will see the Pending Approval screen (effectively demoted to unassigned) until an admin reassigns them
- `specialist` is retained in the DB enum and in `AppRole` TypeScript type for any existing `specialist` rows
- The frontend `ASSIGNABLE_ROLES` in `RoleManagement.tsx` only exposes `["admin", "fms", "mo", "pharmacist"]` — admins cannot assign `staff`, `doctor`, or `specialist` via the UI
- `AuthContext.tsx AppRole` type must include `fms` and `mo`

## Non-Goals

- Multi-facility support
- Bulk user import
- Role history / audit log for role changes
- Email notifications when a role is assigned

---

## Architecture

### Auth Flow

```
User signs up (Google or email/password)
  → Supabase trigger: create profile row, NO role assigned
  → Frontend: role === null → show PendingApproval screen
  → Admin opens Role Management → assigns role
  → User refreshes → redirected to their role's home page
```

### Manual User Creation Flow

```
Admin clicks "Add User" in Role Management
  → Dialog: Full Name + Email + Password + Role
  → POST /admin-user-mgmt (Edge Function, service role)
  → auth.admin.createUser() + user_roles upsert
  → Query invalidated → user appears in list immediately
```

### Password Reset Flow

```
User clicks "Forgot Password?" on login page
  → supabase.auth.resetPasswordForEmail(email)
  → Supabase sends email with magic link → /reset-password
  → User sets new password via supabase.auth.updateUser({ password })
  → Redirect to /login
```

---

## Database Changes

### Migration 1 — Enum + Trigger Fix
```sql
-- Add missing roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fms';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mo';

-- Fix trigger: no auto-role for new users (pending approval)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  -- No role assigned: user lands on pending approval screen
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### Migration 2 — Admin RLS + RPC
```sql
-- is_admin() helper (SECURITY DEFINER, mirrors is_pharmacist())
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

-- Fix SELECT: admins see all users
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
CREATE POLICY "Admins can view all user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- Fix INSERT/UPDATE/DELETE: allow admins
DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
CREATE POLICY "Admins can insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
CREATE POLICY "Admins can update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.is_admin() AND user_id != auth.uid());

DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;
CREATE POLICY "Admins can delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_admin() AND user_id != auth.uid());

-- Fix profiles SELECT: admins see all
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- get_all_users_with_roles RPC
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE (user_id uuid, email text, full_name text, facility text, role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
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
```

---

## Edge Function: `admin-user-mgmt`

**Route:** `POST /functions/v1/admin-user-mgmt`
**Auth:** Bearer JWT (admin role required)

**Request body:**
```json
{
  "action": "create_user",
  "full_name": "Dr. Ahmad",
  "email": "ahmad@kkkempas.gov.my",
  "password": "SecurePass123",
  "role": "mo"
}
```

**Logic:**
1. Verify JWT → check role = `admin` (via `auth.admin.getUserById`)
2. Validate inputs:
   - `email`: valid email format
   - `password`: minimum 6 characters
   - `role`: must be one of `["admin", "fms", "mo", "pharmacist"]` — reject any other value with 400
   - `full_name`: non-empty string
3. `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`
4. Upsert `user_roles` with the new user's id and role
5. Return `{ user_id, email }`

**Error responses:** 401 Unauthorized, 400 Bad Request (validation), 409 Conflict (email exists), 500 Internal Error

---

## Frontend Changes

### `Login.tsx`
- Keep Google sign-in button AND Sign Up tab (email/password)
- Add "Forgot Password?" link below the password field on the login tab
- On click: call `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`, show success message "Check your email for a reset link"
- **Fix `getRoleRedirect`:** update role-to-path mapping — `mo → /request`, `fms → /fms`, `admin/pharmacist → /`, `specialist → /specialist` (retain for existing rows)

### `ResetPassword.tsx` (new page)
- Route: `/reset-password` (public, outside ProtectedRoute)
- On mount: subscribe to `supabase.auth.onAuthStateChange` — when event is `PASSWORD_RECOVERY`, the session is available
- Render form only after `PASSWORD_RECOVERY` event fires; show loading spinner until then
- Form: new password + confirm password fields
- On submit: `supabase.auth.updateUser({ password })`
- On success: redirect to `/login` with toast "Password updated. Please log in."
- On error or no recovery event within timeout: show "Invalid or expired link. Please request a new one."

### `ProtectedRoute.tsx`
- Add check BEFORE the `allowedRoles` check: if `user` exists AND `role === null` AND `!loading` → return `<PendingApproval />` rendered **outside `<AppLayout>`** (standalone, no sidebar/navbar)
- This applies to ALL protected routes universally

### `PendingApproval.tsx` (new component)
- Simple centred card: clinic logo, "Account Pending Approval", "Your account has been created. Please contact your administrator to be assigned a role.", Sign Out button

### `RoleManagement.tsx`
- Add "Add User" button (top right of card header)
- Dialog: Full Name, Email, Password (with show/hide toggle), Role dropdown
- On submit: POST to `admin-user-mgmt` Edge Function
- On success: toast "User created", invalidate `all-users-with-roles` query
- Existing role save already works once RLS is fixed (no code change needed for save button)

### `App.tsx`
- Add route: `<Route path="/reset-password" element={<ResetPassword />} />`
- Route is public (outside ProtectedRoute)

---

## Files Changed

| File | Type |
|------|------|
| `supabase/migrations/20260318_auth_fix.sql` | New migration |
| `supabase/functions/admin-user-mgmt/index.ts` | New Edge Function |
| `src/pages/Login.tsx` | Modified |
| `src/pages/ResetPassword.tsx` | New |
| `src/components/PendingApproval.tsx` | New |
| `src/components/ProtectedRoute.tsx` | Modified |
| `src/pages/RoleManagement.tsx` | Modified |
| `src/App.tsx` | Modified |

---

## Security Considerations

- Service role key used only inside Edge Function (never client-side)
- `get_all_users_with_roles` RPC enforces admin check server-side
- `is_admin()` is SECURITY DEFINER — bypasses RLS safely (same pattern as existing `is_pharmacist()`)
- Anyone can sign up but cannot access any data until role assigned (pending screen)
- Password reset uses Supabase's built-in secure email flow

---

## Testing Checklist

- [ ] New email signup → pending screen shown
- [ ] New Google signup → pending screen shown
- [ ] Admin assigns role → user refreshes → correct page loads
- [ ] Admin save button works for all roles (admin, fms, mo, pharmacist)
- [ ] Admin creates new user → appears in list immediately
- [ ] Forgot password email → reset link → new password works
- [ ] Non-admin cannot access Role Management page
- [ ] `fms` and `mo` roles assignable without DB error
