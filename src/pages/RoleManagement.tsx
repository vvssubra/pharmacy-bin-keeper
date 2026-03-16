import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { UserCog, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type UserWithRole = {
  user_id: string;
  email: string;
  full_name: string;
  facility: string | null;
  role: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  fms: "FMS",
  mo: "Medical Officer",
  pharmacist: "Pharmacist",
};

const ASSIGNABLE_ROLES = ["admin", "fms", "mo", "pharmacist"] as const;

const ROLE_BADGE_CLASSES: Record<string, string> = {
  admin:      "bg-purple-100 text-purple-700 border-purple-300",
  fms:        "bg-blue-100 text-blue-700 border-blue-300",
  mo:         "bg-teal-100 text-teal-700 border-teal-300",
  pharmacist: "bg-green-100 text-green-700 border-green-300",
};

export default function RoleManagement() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});

  const { data: users = [], isLoading } = useQuery<UserWithRole[]>({
    queryKey: ["all-users-with-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_users_with_roles" as any);
      if (error) throw error;
      return (data as UserWithRole[]) ?? [];
    },
  });

  const assignRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (role === "unassigned") {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .upsert({ user_id: userId, role }, { onConflict: "user_id" });
        if (error) throw error;
      }
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      setPendingRole(prev => { const next = { ...prev }; delete next[userId]; return next; });
      toast.success("Role updated successfully.");
    },
    onError: () => toast.error("Failed to update role."),
  });

  const isSelf = (userId: string) => userId === currentUser?.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UserCog className="h-6 w-6" />
          Role Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign roles to registered users. Only admins can access this page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" />
            All Users
            {!isLoading && (
              <Badge variant="secondary" className="ml-1">{users.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            <div className="divide-y">
              {users.map((u) => {
                const selectedRole = pendingRole[u.user_id] ?? u.role ?? "unassigned";
                const hasChange = pendingRole[u.user_id] !== undefined &&
                  pendingRole[u.user_id] !== (u.role ?? "unassigned");

                return (
                  <div key={u.user_id} className="flex items-center justify-between py-3 gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      {u.facility && (
                        <p className="text-xs text-muted-foreground">{u.facility}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {u.role && ROLE_BADGE_CLASSES[u.role] && (
                        <Badge variant="outline" className={`text-[11px] ${ROLE_BADGE_CLASSES[u.role]}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      )}

                      <Select
                        value={selectedRole}
                        onValueChange={(val) =>
                          setPendingRole(prev => ({ ...prev, [u.user_id]: val }))
                        }
                        disabled={isSelf(u.user_id)}
                      >
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                          <SelectItem value="unassigned" className="text-xs text-muted-foreground">
                            Unassigned
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!hasChange || assignRole.isPending || isSelf(u.user_id)}
                        onClick={() =>
                          assignRole.mutate({ userId: u.user_id, role: selectedRole })
                        }
                      >
                        Save
                      </Button>
                    </div>

                    {isSelf(u.user_id) && (
                      <span className="text-xs text-muted-foreground italic shrink-0">you</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
