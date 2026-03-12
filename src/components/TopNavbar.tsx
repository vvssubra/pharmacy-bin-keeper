import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

export function TopNavbar() {
  const { profile, role, signOut } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-foreground">Digital Drug Control </p>
          <p className="text-xs text-muted-foreground">
            {profile?.facility ?? "Klinik Kesihatan Kempas"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {profile &&
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {profile.full_name || "User"}
            </span>
            {role &&
          <Badge variant="secondary" className="text-xs capitalize">
                {role}
              </Badge>
          }
          </div>
        }
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>);

}