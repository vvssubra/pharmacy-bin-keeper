import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function DoctorLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b bg-card px-6">
        <p className="text-sm font-semibold text-foreground">Klinik Kesihatan Kempas</p>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">{profile?.full_name || "Doctor"}</span>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
