import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow, startOfDay } from "date-fns";
import { ms } from "date-fns/locale";
import { Clock, CheckCircle, XCircle, ChevronDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

function formatIC(ic: string) {
  const d = ic.replace(/\D/g, "");
  if (d.length === 12) return `${d.slice(0, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
  return ic;
}

export default function SpecialistDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests = [] } = useQuery({
    queryKey: ["specialist-requests"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispensing_requests")
        .select("*, drugs(drug_name, unit_pengukuran)")
        .in("status", ["pending_specialist", "approved", "rejected"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const pending = useMemo(() => requests.filter(r => r.status === "pending_specialist"), [requests]);
  const todayStart = startOfDay(new Date()).toISOString();
  const processedToday = useMemo(() =>
    requests.filter(r =>
      (r.status === "approved" || r.status === "pending_pharmacy" || r.status === "rejected") &&
      r.specialist_action_at && r.specialist_action_at >= todayStart
    ), [requests, todayStart]);
  const approvedToday = processedToday.filter(r => r.status === "pending_pharmacy" || r.status === "approved").length;
  const rejectedToday = processedToday.filter(r => r.status === "rejected").length;

  const history = useMemo(() =>
    requests.filter(r => r.specialist_action_at).slice(0, 20),
    [requests]);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dispensing_requests")
        .update({
          status: "pending_pharmacy",
          specialist_id: user?.id,
          specialist_action_at: new Date().toISOString(),
          specialist_notes: notes || null,
        })
        .eq("id", approveTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permintaan diluluskan — farmasis telah dimaklumkan");
      setApproveTarget(null);
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["specialist-requests"] });
    },
    onError: () => toast.error("Gagal meluluskan permintaan"),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dispensing_requests")
        .update({
          status: "rejected",
          specialist_id: user?.id,
          specialist_action_at: new Date().toISOString(),
          specialist_notes: rejectReason,
        })
        .eq("id", rejectTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permintaan ditolak");
      setRejectTarget(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["specialist-requests"] });
    },
    onError: () => toast.error("Gagal menolak permintaan"),
  });

  const stats = [
    { label: "Menunggu Kelulusan", count: pending.length, icon: Clock, bg: "bg-yellow-100 dark:bg-yellow-900/30", color: "text-yellow-700 dark:text-yellow-400" },
    { label: "Diluluskan Hari Ini", count: approvedToday, icon: CheckCircle, bg: "bg-green-100 dark:bg-green-900/30", color: "text-green-700 dark:text-green-400" },
    { label: "Ditolak Hari Ini", count: rejectedToday, icon: XCircle, bg: "bg-red-100 dark:bg-red-900/30", color: "text-red-700 dark:text-red-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(s => (
          <Card key={s.label} className={s.bg}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className={`h-6 w-6 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Permintaan Menunggu Kelulusan</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Masa Dihantar</TableHead>
                <TableHead>Nama Pesakit</TableHead>
                <TableHead>No. IC</TableHead>
                <TableHead>Ubat</TableHead>
                <TableHead>Kuantiti</TableHead>
                <TableHead>Doktor</TableHead>
                <TableHead>Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Tiada permintaan menunggu kelulusan
                  </TableCell>
                </TableRow>
              ) : pending.map(r => (
                <TableRow key={r.id} className="animate-in fade-in duration-500">
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ms })}
                  </TableCell>
                  <TableCell className="font-medium">{r.patient_name}</TableCell>
                  <TableCell className="text-xs">{formatIC(r.no_ic)}</TableCell>
                  <TableCell>
                    {(r.drugs as any)?.drug_name}
                    <Badge className="ml-1 bg-yellow-100 text-yellow-700 border-yellow-300 text-[10px]">Pakar</Badge>
                  </TableCell>
                  <TableCell>{r.quantity} {(r.drugs as any)?.unit_pengukuran}</TableCell>
                  <TableCell className="text-xs">{r.prescriber_name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-white" onClick={() => setApproveTarget(r)}>Lulus</Button>
                      <Button size="sm" variant="destructive" className="h-7" onClick={() => setRejectTarget(r)}>Tolak</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* History */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Sejarah Kelulusan</CardTitle>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Masa</TableHead>
                    <TableHead>Pesakit</TableHead>
                    <TableHead>Ubat</TableHead>
                    <TableHead>Kuantiti</TableHead>
                    <TableHead>Keputusan</TableHead>
                    <TableHead>Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">
                        {formatDistanceToNow(new Date(r.specialist_action_at), { addSuffix: true, locale: ms })}
                      </TableCell>
                      <TableCell>{r.patient_name}</TableCell>
                      <TableCell>{(r.drugs as any)?.drug_name}</TableCell>
                      <TableCell>{r.quantity}</TableCell>
                      <TableCell>
                        {r.status === "rejected" ? (
                          <Badge variant="destructive" className="text-xs">Ditolak</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">Diluluskan</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.specialist_notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Approve Dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Luluskan Permintaan</DialogTitle></DialogHeader>
          {approveTarget && (
            <div className="space-y-4">
              <div className="rounded border p-3 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Pesakit:</span> {approveTarget.patient_name}</p>
                <p><span className="text-muted-foreground">IC:</span> {formatIC(approveTarget.no_ic)}</p>
                <p><span className="text-muted-foreground">Ubat:</span> {(approveTarget.drugs as any)?.drug_name}</p>
                <p><span className="text-muted-foreground">Kuantiti:</span> {approveTarget.quantity}</p>
              </div>
              <div className="space-y-2">
                <Label>Nota Kelulusan (pilihan)</Label>
                <Textarea placeholder="Nota tambahan jika perlu" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Batal</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              Sahkan Kelulusan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tolak Permintaan</DialogTitle></DialogHeader>
          {rejectTarget && (
            <div className="space-y-4">
              <div className="rounded border p-3 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Pesakit:</span> {rejectTarget.patient_name}</p>
                <p><span className="text-muted-foreground">IC:</span> {formatIC(rejectTarget.no_ic)}</p>
                <p><span className="text-muted-foreground">Ubat:</span> {(rejectTarget.drugs as any)?.drug_name}</p>
                <p><span className="text-muted-foreground">Kuantiti:</span> {rejectTarget.quantity}</p>
              </div>
              <div className="space-y-2">
                <Label>Sebab Penolakan *</Label>
                <Textarea placeholder="Nyatakan sebab (min 10 aksara)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending || rejectReason.length < 10}>
              Sahkan Penolakan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
