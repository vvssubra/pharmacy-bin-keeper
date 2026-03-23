# Auth & User Management Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken login/signup/role-management by patching the DB schema, adding an admin Edge Function for user creation, and wiring up a pending-approval flow in the frontend.

**Architecture:** A single DB migration fixes the `app_role` enum, removes the auto-role trigger, adds an `is_admin()` helper, fixes RLS policies, and adds the missing `get_all_users_with_roles` RPC. A new `admin-user-mgmt` Edge Function (using the existing `_shared/security.ts` pattern) lets admins create users server-side. Frontend changes add a `PendingApproval` screen for role-less users, a `ResetPassword` page, and an "Add User" dialog in `RoleManagement`.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase (PostgreSQL + Auth + Edge Functions/Deno), TanStack React Query, React Router v6, shadcn/ui, Sonner toasts, Vitest

**Spec:** `docs/superpowers/specs/2026-03-18-auth-user-management-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260318_auth_fix.sql` | Create | DB enum fix, trigger fix, is_admin(), RLS policies, get_all_users_with_roles RPC |
| `supabase/functions/admin-user-mgmt/index.ts` | Create | Edge Function — admin creates users with role |
| `src/contexts/AuthContext.tsx` | Modify | Add `fms` and `mo` to `AppRole` type |
| `src/pages/Login.tsx` | Modify | Add Forgot Password link; remove dead `getRoleRedirect` function |
| `src/pages/ResetPassword.tsx` | Create | Handles Supabase PASSWORD_RECOVERY event, new password form |
| `src/components/PendingApproval.tsx` | Create | Standalone screen for authenticated users with no role |
| `src/components/ProtectedRoute.tsx` | Modify | Show `<PendingApproval />` when `role === null`, outside AppLayout |
| `src/pages/RoleManagement.tsx` | Modify | Add "Add User" dialog that calls the Edge Function |
| `src/App.tsx` | Modify | Add public `/reset-password` route |

---

## Task 1: DB Migration — Enum, Trigger, RLS, RPC

**Files:**
- Create: `supabase/migrations/20260318_auth_fix.sql`

- [ ] **Step 1: Create the migration file**

```sql
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
  );
  -- No role assigned — user sees Pending Approval screen until admin assigns one
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the Supabase MCP tool `apply_migration` with the SQL above. Confirm it runs without errors.

- [ ] **Step 3: Verify enum values exist**

Run via `execute_sql`:
```sql
SELECT enumlabel FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'app_role'
ORDER BY enumlabel;
```
Expected output includes: `admin`, `fms`, `mo`, `pharmacist`, `specialist`, `staff`

- [ ] **Step 4: Verify RPC exists**

Run via `execute_sql`:
```sql
SELECT proname FROM pg_proc WHERE proname = 'get_all_users_with_roles';
```
Expected: 1 row returned.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260318_auth_fix.sql
git commit -m "feat(db): add fms/mo to role enum, fix RLS for admins, add get_all_users_with_roles RPC"
```

---

## Task 2: Edge Function — `admin-user-mgmt`

**Files:**
- Create: `supabase/functions/admin-user-mgmt/index.ts`

This function follows the exact same structure as `supabase/functions/ai-query/index.ts`. Read that file before implementing.

- [ ] **Step 1: Create the Edge Function file**

```typescript
// supabase/functions/admin-user-mgmt/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  verifyJWT,
  getUserRole,
  corsHeaders,
} from "../_shared/security.ts";

const ALLOWED_ROLES = ["admin", "fms", "mo", "pharmacist"] as const;

const CreateUserSchema = z.object({
  action: z.literal("create_user"),
  full_name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(72),
  role: z.enum(ALLOWED_ROLES),
});

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // ── 1. JWT verification ────────────────────────────────────────────────────
  const { userId, error: jwtError } = await verifyJWT(req.headers.get("authorization"));
  if (jwtError) {
    return new Response(
      JSON.stringify({ error: jwtError }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // ── 2. Role check: admin only ──────────────────────────────────────────────
  const callerRole = await getUserRole(userId!);
  if (callerRole !== "admin") {
    return new Response(
      JSON.stringify({ error: "Unauthorized: admin role required" }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // ── 3. Parse + validate body ───────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const { full_name, email, password, role } = parsed.data;
  const supabase = adminClient();

  // ── 4. Create auth user ────────────────────────────────────────────────────
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError) {
    const status = createError.message.includes("already registered") ? 409 : 500;
    return new Response(
      JSON.stringify({ error: createError.message }),
      { status, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // ── 5. Assign role ─────────────────────────────────────────────────────────
  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert({ user_id: newUser.user.id, role }, { onConflict: "user_id" });

  if (roleError) {
    // User was created but role assignment failed — clean up to avoid orphan
    await supabase.auth.admin.deleteUser(newUser.user.id);
    return new Response(
      JSON.stringify({ error: "Failed to assign role. User creation rolled back." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ user_id: newUser.user.id, email: newUser.user.email }),
    { status: 201, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
```

- [ ] **Step 2: Deploy the Edge Function via Supabase MCP**

Use the Supabase MCP tool `deploy_edge_function` with:
- `name`: `admin-user-mgmt`
- `files`: the file content above

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-user-mgmt/index.ts
git commit -m "feat(edge): add admin-user-mgmt Edge Function for admin user creation"
```

---

## Task 3: AuthContext — Verify AppRole Type ✅ Already Done

**Files:**
- `src/contexts/AuthContext.tsx:5` — already contains `"fms"` and `"mo"`

**No code change needed.** `AppRole` at line 5 already reads:
```typescript
export type AppRole = "admin" | "fms" | "mo" | "pharmacist" | "specialist";
```

- [ ] **Step 1: Confirm and move on**

Read `src/contexts/AuthContext.tsx` line 5. Confirm `fms` and `mo` are present. No commit needed.

---

## Task 4: Login.tsx — Add Forgot Password, Remove Dead Code

**Files:**
- Modify: `src/pages/Login.tsx`

The current file has a `getRoleRedirect` function (lines 11–17) that maps `doctor` and `specialist` roles — both legacy values. `App.tsx` already has a `RoleRedirect` component that handles `fms` and `mo` correctly. `getRoleRedirect` in `Login.tsx` is only used on line 36 (`if (user) return <Navigate to={getRoleRedirect(role)} replace />;`).

- [ ] **Step 1: Remove `getRoleRedirect` and fix the redirect**

Replace the `getRoleRedirect` function and its usage with a simple redirect to `/`:

Remove lines 11–17 (the `getRoleRedirect` function):
```typescript
function getRoleRedirect(role: string | null): string {
  switch (role) {
    case "doctor": return "/request";
    case "specialist": return "/specialist";
    default: return "/";
  }
}
```

Replace line 36:
```typescript
// OLD:
if (user) return <Navigate to={getRoleRedirect(role)} replace />;
// NEW:
if (user) return <Navigate to="/" replace />;
```

> **Why:** `App.tsx` already has `<RoleRedirect />` at the `/` route that sends `fms → /fms`, `mo → /mo`, and everyone else to the dashboard. The login page redirect just needs to send to `/` and let `RoleRedirect` handle the rest.

- [ ] **Step 2: Add Forgot Password UI**

Add state and handler. After the existing state declarations (around line 26), add:
```typescript
const [forgotMode, setForgotMode] = useState(false);
const [forgotEmail, setForgotEmail] = useState("");
const [forgotSent, setForgotSent] = useState(false);
const [forgotLoading, setForgotLoading] = useState(false);
```

Add handler after `handleGoogleLogin`:
```typescript
const handleForgotPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setForgotLoading(true);
  const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) {
    setError(error.message);
  } else {
    setForgotSent(true);
  }
  setForgotLoading(false);
};
```

- [ ] **Step 3: Add Forgot Password UI to the login tab**

In the login tab form, add a "Forgot password?" link below the password field (before the error message):
```tsx
<div className="flex justify-end">
  <button
    type="button"
    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
    onClick={() => { setForgotMode(true); setError(null); }}
  >
    Forgot password?
  </button>
</div>
```

Add the forgot password mode UI. Wrap the entire `<Card>` content section — add a conditional render before the `<Tabs>` block:
```tsx
{forgotMode && (
  <div className="space-y-4">
    {forgotSent ? (
      <div className="space-y-3 text-center">
        <p className="text-sm text-foreground">Check your email for a reset link.</p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(""); }}
        >
          Back to Login
        </Button>
      </div>
    ) : (
      <form onSubmit={handleForgotPassword} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter your email and we'll send you a reset link.
        </p>
        <div className="space-y-2">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            value={forgotEmail}
            onChange={e => setForgotEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <Button type="submit" className="w-full" disabled={forgotLoading}>
          {forgotLoading ? "Sending…" : "Send Reset Link"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => { setForgotMode(false); setError(null); }}
        >
          Cancel
        </Button>
      </form>
    )}
  </div>
)}
{!forgotMode && (
  // existing <Tabs> block goes here (move it inside this condition)
)}
```

- [ ] **Step 4: Verify TypeScript + lint**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Login.tsx
git commit -m "fix(login): remove dead getRoleRedirect, add forgot password flow"
```

---

## Task 5: `PendingApproval.tsx` — New Standalone Component

**Files:**
- Create: `src/components/PendingApproval.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/PendingApproval.tsx
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PendingApproval() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-start justify-center bg-background pt-24 px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-xl">Akaun Dalam Proses Kelulusan</CardTitle>
          <CardDescription>Digital Bin Card — Klinik Kesihatan Kempas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Akaun anda telah didaftarkan. Sila hubungi pentadbir sistem untuk
            mendapatkan akses. Anda akan dapat log masuk setelah peranan ditetapkan.
          </p>
          <Button variant="outline" className="w-full" onClick={signOut}>
            Log Keluar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PendingApproval.tsx
git commit -m "feat(ui): add PendingApproval standalone screen for users without a role"
```

---

## Task 6: `ProtectedRoute.tsx` — Wire Up Pending Approval

**Files:**
- Modify: `src/components/ProtectedRoute.tsx`

- [ ] **Step 1: Add PendingApproval import and branch**

Add import at the top:
```typescript
import { PendingApproval } from "@/components/PendingApproval";
```

In the `ProtectedRoute` function, add this block **after** the `!user` check and **before** the `allowedRoles` check:

```typescript
// Authenticated but no role assigned — show pending screen outside AppLayout
if (!role) {
  return <PendingApproval />;
}
```

The final `ProtectedRoute` function body should read:
```typescript
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // NEW: authenticated but no role → pending approval (outside AppLayout)
  if (!role) {
    return <PendingApproval />;
  }

  const allowedRoles = getAllowedRoles(location.pathname);

  if (!allowedRoles.includes(role)) {
    return <AppLayout><NoPermission /></AppLayout>;
  }

  return <>{children}</>;
}
```

Note the condition changed from `!role || !allowedRoles.includes(role)` to two separate checks so that `null` role shows `PendingApproval` (no sidebar/nav) and wrong-but-assigned role shows `NoPermission` (within AppLayout).

- [ ] **Step 2: Update `ProtectedRoute.test.tsx` before running**

The existing test file at `src/components/ProtectedRoute.test.tsx` needs 3 changes:

**A) Add `PendingApproval` mock** (add after the `PageSkeleton` mock, around line 13):
```typescript
vi.mock("@/components/PendingApproval", () => ({
  PendingApproval: () => <div>Pending Approval</div>,
}));
```

**B) Replace the `"unassigned user (role = null)"` describe block** (currently lines 47–60, expects `NoPermission` — wrong after our change):
```typescript
describe("unassigned user (role = null)", () => {
  it("shows PendingApproval on /specialist", () => {
    renderWithRouter("/specialist", { user: { id: "1" }, role: null, loading: false });
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
  });
  it("shows PendingApproval on /drugs", () => {
    renderWithRouter("/drugs", { user: { id: "1" }, role: null, loading: false });
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
  });
  it("shows PendingApproval on /request", () => {
    renderWithRouter("/request", { user: { id: "1" }, role: null, loading: false });
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
  });
});
```

**C) Replace the `"doctor role"` describe block** (currently lines 62–79 — `"doctor"` is not in `AppRole` type, TypeScript will reject it). Replace with `"mo role"` tests:
```typescript
describe("mo role", () => {
  it("allows access to /request", () => {
    renderWithRouter("/request", { user: { id: "1" }, role: "mo", loading: false });
    expect(screen.getByText("Doctor Request page")).toBeInTheDocument();
  });
  it("blocks access to /drugs", () => {
    renderWithRouter("/drugs", { user: { id: "1" }, role: "mo", loading: false });
    expect(screen.getByRole("heading", { name: /No Permission/i })).toBeInTheDocument();
  });
  it("blocks access to /fulfilment", () => {
    renderWithRouter("/fulfilment", { user: { id: "1" }, role: "mo", loading: false });
    expect(screen.getByRole("heading", { name: /No Permission/i })).toBeInTheDocument();
  });
  it("blocks access to /role-management", () => {
    renderWithRouter("/role-management", { user: { id: "1" }, role: "mo", loading: false });
    expect(screen.getByRole("heading", { name: /No Permission/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests — confirm RED before implementation**

```bash
npx vitest run src/components/ProtectedRoute.test.tsx
```
Expected: the 3 `PendingApproval` tests FAIL (because `ProtectedRoute` doesn't yet render it). The other tests should still pass.

- [ ] **Step 4: Implement the ProtectedRoute change** (now make tests go GREEN)

(Proceed with Step 1 above — add the `if (!role) return <PendingApproval />;` branch.)

- [ ] **Step 5: Run tests — confirm GREEN**

```bash
npx vitest run src/components/ProtectedRoute.test.tsx
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProtectedRoute.tsx
git commit -m "fix(auth): show PendingApproval for role-less authenticated users"
```

---

## Task 7: `ResetPassword.tsx` — New Password Reset Page

**Files:**
- Create: `src/pages/ResetPassword.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/pages/ResetPassword.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user clicks the reset link.
    // This gives us a valid session to call updateUser on.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      toast.success("Password updated. Please log in.");
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-background pt-24 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Set New Password</CardTitle>
          <CardDescription>Digital Bin Card — Klinik Kesihatan Kempas</CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Verifying reset link…
              </p>
              <p className="text-xs text-muted-foreground">
                If this takes too long, the link may have expired.{" "}
                <button
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => navigate("/login")}
                >
                  Back to login
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Updating…" : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ResetPassword.tsx
git commit -m "feat(auth): add ResetPassword page for Supabase password recovery flow"
```

---

## Task 8: `App.tsx` — Add `/reset-password` Route

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import and route**

Add import near the top with other page imports:
```typescript
import ResetPassword from "@/pages/ResetPassword";
```

Add the public route after the `/login` route (line 41):
```tsx
<Route path="/reset-password" element={<ResetPassword />} />
```

The route must be **outside** `<ProtectedRoute>` — it's public, same as `/login`.

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(router): add public /reset-password route"
```

---

## Task 9: `RoleManagement.tsx` — Add User Dialog

**Files:**
- Modify: `src/pages/RoleManagement.tsx`

- [ ] **Step 1: Add imports**

Add to existing imports:
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
```

The `supabase` client is already imported. You'll need the Supabase URL for the Edge Function call. Import the env variable:
```typescript
const ADMIN_MGMT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-mgmt`;
```
Add this as a module-level constant after the imports.

- [ ] **Step 2: Add state for the dialog**

Add these states inside the `RoleManagement` component, after existing state:
```typescript
const [addUserOpen, setAddUserOpen] = useState(false);
const [newName, setNewName] = useState("");
const [newEmail, setNewEmail] = useState("");
const [newPassword, setNewPassword] = useState("");
const [newRole, setNewRole] = useState<string>("mo");
const [addUserError, setAddUserError] = useState<string | null>(null);
```

- [ ] **Step 3: Add `createUser` mutation**

Add after the existing `assignRole` mutation:
```typescript
const { data: session } = useQuery({
  queryKey: ["session"],
  queryFn: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },
});

const createUser = useMutation({
  mutationFn: async () => {
    const res = await fetch(ADMIN_MGMT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        action: "create_user",
        full_name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create user");
    return json;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
    toast.success("User created successfully.");
    setAddUserOpen(false);
    setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("mo");
    setAddUserError(null);
  },
  onError: (err: Error) => {
    setAddUserError(err.message);
  },
});
```

- [ ] **Step 4: Add "Add User" button to card header**

In the `<CardHeader>` section, change it to:
```tsx
<CardHeader className="flex flex-row items-center justify-between">
  <CardTitle className="flex items-center gap-2 text-base">
    <Users className="h-4 w-4 text-muted-foreground" />
    All Users
    {!isLoading && (
      <Badge variant="secondary" className="ml-1">{users.length}</Badge>
    )}
  </CardTitle>
  <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setAddUserOpen(true)}>
    <Plus className="h-3.5 w-3.5" />
    Add User
  </Button>
</CardHeader>
```

- [ ] **Step 5: Add Dialog component**

Add the dialog just before the closing `</div>` of the component return:
```tsx
<Dialog open={addUserOpen} onOpenChange={(open) => { setAddUserOpen(open); if (!open) setAddUserError(null); }}>
  <DialogContent className="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>Add New User</DialogTitle>
    </DialogHeader>
    <form
      onSubmit={(e) => { e.preventDefault(); createUser.mutate(); }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="add-name">Full Name</Label>
        <Input
          id="add-name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          required
          placeholder="Dr. Ahmad bin Ali"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="add-email">Email</Label>
        <Input
          id="add-email"
          type="email"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          required
          placeholder="ahmad@example.gov.my"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="add-password">Password</Label>
        <Input
          id="add-password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          required
          minLength={6}
          placeholder="Min 6 characters"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="add-role">Role</Label>
        <Select value={newRole} onValueChange={setNewRole}>
          <SelectTrigger id="add-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSIGNABLE_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {addUserError && (
        <p className="text-sm text-destructive">{addUserError}</p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setAddUserOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={createUser.isPending}>
          {createUser.isPending ? "Creating…" : "Create User"}
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

- [ ] **Step 6: Verify TypeScript + lint**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/RoleManagement.tsx
git commit -m "feat(admin): add Create User dialog to Role Management with Edge Function integration"
```

---

## Task 10: End-to-End Verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test pending approval flow**

1. Open an incognito window → go to `http://localhost:8080`
2. Sign up with a new email/password
3. **Expected:** Pending Approval screen shown (not the dashboard, not NoPermission)
4. Open the app as admin → go to `/role-management`
5. Find the new user → assign a role → Save
6. Back in incognito, refresh → **Expected:** redirected to the correct page for their role

- [ ] **Step 3: Test Google sign-in**

1. Click "Log in with Google" → complete OAuth flow
2. **Expected:** Pending Approval screen (no role assigned)
3. Admin assigns role → user refreshes → correct access

- [ ] **Step 4: Test Forgot Password**

1. On login page, click "Forgot password?" → enter email → Submit
2. **Expected:** "Check your email for a reset link" message
3. Open email → click link → lands on `/reset-password`
4. Enter new password → Submit
5. **Expected:** Redirected to `/login` with toast "Password updated"
6. Log in with new password → **Expected:** works

- [ ] **Step 5: Test Add User (admin)**

1. Log in as admin → go to `/role-management`
2. Click "Add User" → fill form → Create User
3. **Expected:** User appears in list immediately with assigned role
4. Log in as that new user → **Expected:** lands on their role's home page

- [ ] **Step 6: Test role save button (admin)**

1. Log in as admin → Role Management → change a user's role → Save
2. **Expected:** Toast "Role updated successfully" — no longer silent failure

- [ ] **Step 7: Run full test suite**

```bash
npm run test
```
Expected: all tests pass.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: auth & user management fix complete — pending approval, admin user creation, forgot password"
```

---

## Notes for Implementors

**Supabase MCP usage:** Tasks 1 and 2 use Supabase MCP tools (`apply_migration`, `deploy_edge_function`, `execute_sql`). If MCP is unavailable, use the Supabase CLI: `supabase db push` for migrations and `supabase functions deploy admin-user-mgmt` for the Edge Function.

**Edge Function env vars:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically injected by Supabase into Edge Functions. No manual configuration needed.

**Google OAuth callback URL:** Ensure `http://localhost:8080` and your production URL are in the Supabase Auth → URL Configuration → Redirect URLs allowlist. If Google login returns an error, this is the first thing to check.

**`role_consolidation.sql` is empty:** The file `supabase/migrations/20260316_role_consolidation.sql` is tracked in git but empty. Leave it as-is — the new `20260318_auth_fix.sql` handles everything it was meant to do.

**Existing users with `staff` role:** Any users who signed up before this migration was applied will have `role = 'staff'`. The frontend's `AppRole` type doesn't include `staff`, so `useAuth().role` will return `'staff'` (a string cast). `ProtectedRoute` will show `PendingApproval` for them (since `'staff'` is not in `allowedRoles` for any route), which is the correct behaviour — admin should reassign them.
