import { LogOut } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const devLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/request", label: "Doctor Request" },
  { to: "/specialist", label: "Specialist" },
  { to: "/fulfilment", label: "Fulfilment" },
  { to: "/drugs", label: "Drug Master" },
  { to: "/pesakit", label: "Patient Registry" },
];

export function SpecialistLayout({ children }: { children: React.ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b bg-card px-6">
        <p className="text-sm font-semibold text-foreground">Specialist Dashboard</p>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">{profile?.full_name || "Specialist"}</span>
          {role && <Badge variant="secondary" className="text-xs capitalize">{role}</Badge>}
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <nav className="flex gap-1 border-b bg-muted/50 px-6 py-1.5 overflow-x-auto">
        {devLinks.map(l => (
          <Link key={l.to} to={l.to} className={cn("text-xs px-2.5 py-1 rounded-md transition-colors", location.pathname === l.to ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
            {l.label}
          </Link>
        ))}
        <Badge variant="outline" className="ml-auto text-[10px] self-center">DEV NAV</Badge>
      </nav>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
