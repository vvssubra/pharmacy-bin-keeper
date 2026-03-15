import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { NoPermission } from "@/components/NoPermission";
import { PageSkeleton } from "@/components/PageSkeleton";

/** Declares which roles can access each route prefix. */
const ROUTE_PERMISSIONS: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/request",         roles: ["doctor", "pharmacist"] },
  { prefix: "/specialist",      roles: ["specialist", "pharmacist"] },
  { prefix: "/role-management", roles: ["pharmacist"] },
  { prefix: "/fulfilment",      roles: ["pharmacist"] },
  { prefix: "/drugs",           roles: ["pharmacist"] },
  { prefix: "/terimaan",        roles: ["pharmacist"] },
  { prefix: "/pesakit",         roles: ["pharmacist"] },
  { prefix: "/laporan",         roles: ["pharmacist"] },
  { prefix: "/",                roles: ["pharmacist"] },
];

function getAllowedRoles(pathname: string): AppRole[] {
  for (const { prefix, roles } of ROUTE_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(prefix === "/" ? "/?" : prefix)) {
      return roles;
    }
  }
  return ["pharmacist"];
}

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

  const allowedRoles = getAllowedRoles(location.pathname);

  if (!role || !allowedRoles.includes(role)) {
    return <AppLayout><NoPermission /></AppLayout>;
  }

  return <>{children}</>;
}
