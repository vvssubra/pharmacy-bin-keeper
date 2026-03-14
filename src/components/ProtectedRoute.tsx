import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { NoPermission } from "@/components/NoPermission";

const SPECIALIST_ROLES = ["specialist"];
const PHARMACIST_ROUTES = ["/fulfilment"];
const PHARMACIST_ROLES = ["admin", "pharmacist"];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (pathname === "/specialist" && role && !SPECIALIST_ROLES.includes(role)) {
    return <AppLayout><NoPermission /></AppLayout>;
  }

  if (PHARMACIST_ROUTES.some((r) => pathname.startsWith(r)) && role && !PHARMACIST_ROLES.includes(role)) {
    return <AppLayout><NoPermission /></AppLayout>;
  }

  return <>{children}</>;
}
