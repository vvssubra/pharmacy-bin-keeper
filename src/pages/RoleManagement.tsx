import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { UserCog, UserPlus, UserMinus, Users, Stethoscope, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type UserWithRole = {
  user_id: string;
  email: string;
  full_name: string;
  facility: string | null;
  role: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  pharmacist: "Pharmacist",
  doctor: "Doctor",
  specialist: "Specialist",
};

export default function RoleManagement() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

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
      // Upsert: insert or update role
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      toast.success("Role updated successfully.");
    },
    onError: () => toast.error("Failed to update role."),
  });

  const removeRole = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      toast.success("Role removed successfully.");
    },
    onError: () => toast.error("Failed to remove role."),
  });

  const isSelf = (userId: string) => userId === currentUser?.id;

  const doctors      = users.filter((u) => u.role === "doctor");
  const specialists  = users.filter((u) => u.role === "specialist");
  const unassigned   = users.filter((u) => !u.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UserCog className="h-6 w-6" />
          Role Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign roles to registered users.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Doctors group */}
        <RoleGroup
          title="Doctor"
          icon={<Stethoscope className="h-4 w-4" />}
          users={doctors}
          isLoading={isLoading}
          emptyMessage="No doctors assigned."
          onRemove={(userId) => removeRole.mutate(userId)}
          onChangeTo={(userId) => assignRole.mutate({ userId, role: "specialist" })}
          changeToLabel="Make Specialist"
          isSelf={isSelf}
        />

        {/* Specialists group */}
        <RoleGroup
          title="Specialist"
          icon={<ShieldCheck className="h-4 w-4" />}
          users={specialists}
          isLoading={isLoading}
          emptyMessage="No specialists assigned."
          onRemove={(userId) => removeRole.mutate(userId)}
          onChangeTo={(userId) => assignRole.mutate({ userId, role: "doctor" })}
          changeToLabel="Make Doctor"
          isSelf={isSelf}
        />
      </div>

      {/* Unassigned users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" />
            Unassigned Users
            {unassigned.length > 0 && (
              <Badge variant="secondary" className="ml-1">{unassigned.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
            </div>
          ) : unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">All users have been assigned a role.</p>
          ) : (
            <div className="divide-y">
              {unassigned.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => assignRole.mutate({ userId: u.user_id, role: "doctor" })}
                      disabled={assignRole.isPending}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                      Doctor
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => assignRole.mutate({ userId: u.user_id, role: "specialist" })}
                      disabled={assignRole.isPending}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                      Specialist
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

type RoleGroupProps = {
  title: string;
  icon: React.ReactNode;
  users: UserWithRole[];
  isLoading: boolean;
  emptyMessage: string;
  onRemove: (userId: string) => void;
  onChangeTo: (userId: string) => void;
  changeToLabel: string;
  isSelf: (userId: string) => boolean;
};

function RoleGroup({
  title, icon, users, isLoading, emptyMessage,
  onRemove, onChangeTo, changeToLabel, isSelf,
}: RoleGroupProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-1">{users.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="divide-y">
            {users.map((u) => (
              <div key={u.user_id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                {!isSelf(u.user_id) && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => onChangeTo(u.user_id)}
                    >
                      {changeToLabel}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove role?</AlertDialogTitle>
                          <AlertDialogDescription>
                            <strong>{u.full_name || u.email}</strong> will become a user without a role and will not be able to access the system.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onRemove(u.user_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
                {isSelf(u.user_id) && (
                  <Badge variant="outline" className="text-xs shrink-0">Anda</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
