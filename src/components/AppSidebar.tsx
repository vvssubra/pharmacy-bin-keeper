import { Home, Pill, PackagePlus, FileText, Bell, Users, Stethoscope, ShieldCheck, UserCog } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  showBadge?: boolean;
  roles: AppRole[];
};

const items: NavItem[] = [
  { title: "Dashboard",           url: "/",               icon: Home,        roles: ["pharmacist"] },
  { title: "Permintaan Baharu",   url: "/fulfilment",     icon: Bell,        showBadge: true, roles: ["pharmacist"] },
  { title: "Drug Master",         url: "/drugs",          icon: Pill,        roles: ["pharmacist"] },
  { title: "Terimaan",            url: "/terimaan",       icon: PackagePlus, roles: ["pharmacist"] },
  { title: "Pesakit",             url: "/pesakit",        icon: Users,       roles: ["pharmacist"] },
  { title: "Laporan",             url: "/laporan",        icon: FileText,    roles: ["pharmacist"] },
  { title: "Pengurusan Peranan",  url: "/role-management",icon: UserCog,     roles: ["pharmacist"] },
  { title: "Doctor Request",      url: "/request",        icon: Stethoscope, roles: ["doctor", "pharmacist"] },
  { title: "Specialist",          url: "/specialist",     icon: ShieldCheck, roles: ["specialist", "pharmacist"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { role } = useAuth();
  const collapsed = state === "collapsed";

  const visibleItems = role ? items.filter((item) => item.roles.includes(role)) : [];

  // Pending ubat kawalan count (pharmacist only)
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-requests-count"],
    enabled: role === "pharmacist",
    refetchInterval: 15000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("dispensing_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_pharmacy");
      if (error) return 0;
      return count ?? 0;
    },
  });

  // Pending antibiotic acknowledgement count (pharmacist only)
  const { data: abCount = 0 } = useQuery({
    queryKey: ["pending-antibiotic-ack-count-v2"],
    enabled: role === "pharmacist",
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("antibiotic_forms" as any)
        .select("id")
        .eq("status", "approved")
        .is("acknowledged_at", null);
      if (error) return 0;
      return (data as any[])?.length ?? 0;
    },
  });

  const totalBadge = pendingCount + abCount;

  return (
    <Sidebar collapsible="icon">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/20">
          <Pill className="h-4 w-4 text-sidebar-primary" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-sidebar-primary leading-tight">
            Kawalan Ubat<br />
            <span className="text-xs font-normal text-sidebar-foreground/70">KK Kempas</span>
          </span>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="ml-2 truncate">{item.title}</span>}
                      {item.showBadge && totalBadge > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 min-w-5 text-[10px] flex items-center justify-center rounded-full px-1.5"
                        >
                          {totalBadge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
