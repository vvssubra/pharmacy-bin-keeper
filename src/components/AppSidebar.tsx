import { Home, Pill, PackagePlus, FileText, Bell, Users, Stethoscope, ShieldCheck } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar } from
"@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const items = [
{ title: "Dashboard", url: "/", icon: Home },
{ title: "Permintaan Baharu", url: "/fulfilment", icon: Bell, showBadge: true },
{ title: "Drug Master", url: "/drugs", icon: Pill },
{ title: "Terimaan", url: "/terimaan", icon: PackagePlus },
{ title: "Pesakit", url: "/pesakit", icon: Users },
{ title: "Laporan", url: "/laporan", icon: FileText },
{ title: "Doctor Request", url: "/request", icon: Stethoscope },
{ title: "Specialist", url: "/specialist", icon: ShieldCheck }];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  // Pending ubat kawalan count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-requests-count"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { count, error } = await supabase.
      from("dispensing_requests").
      select("*", { count: "exact", head: true }).
      eq("status", "pending_pharmacy");
      if (error) return 0;
      return count ?? 0;
    }
  });

  // Pending antibiotic acknowledgement count
  const { data: abPendingCount = 0 } = useQuery({
    queryKey: ["pending-antibiotic-ack-count"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.
      from("antibiotic_forms" as any).
      select("id", { count: "exact", head: true }).
      eq("status", "approved").
      is("acknowledged_at", null);
      if (error) return 0;
      // When using head:true the count comes from the response headers
      // but the JS client returns data as null. Use a workaround:
      return 0; // fallback
    }
  });

  // Better approach: count without head
  const { data: abCount = 0 } = useQuery({
    queryKey: ["pending-antibiotic-ack-count-v2"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.
      from("antibiotic_forms" as any).
      select("id").
      eq("status", "approved").
      is("acknowledged_at", null);
      if (error) return 0;
      return (data as any[])?.length ?? 0;
    }
  });

  const totalBadge = pendingCount + abCount;

  return (
    <Sidebar collapsible="icon">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        {!collapsed &&
        <span className="text-sm font-bold tracking-tight text-sidebar-primary">
            Kawalan Ubat KK Kempas   
          </span>
        }
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) =>
              <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                    to={item.url}
                    end={item.url === "/"}
                    className="hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                      {item.showBadge && totalBadge > 0 &&
                    <Badge variant="destructive" className="ml-auto h-5 min-w-5 text-[10px] flex items-center justify-center rounded-full px-1.5">
                          {totalBadge}
                        </Badge>
                    }
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>);

}