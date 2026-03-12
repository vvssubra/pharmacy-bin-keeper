import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow, startOfDay, format } from "date-fns";
import { ms } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatIC(ic: string) {
  const d = ic.replace(/\D/g, "");
  if (d.length === 12) return `${d.slice(0, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
  return ic;
}

export default function PharmacistFulfilment() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [fulfillTarget, setFulfillTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests = [] } = useQuery({
    queryKey: ["fulfilment-requests"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispensing_requests")
        .select("*, drugs(id, drug_name, unit_pengukuran, stok_min, perlu_kelulusan_pakar)")
        .in("status", ["pending_pharmacy", "fulfilled"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all transaction data for stock calculations
  const { data: allTx = [] } = useQuery({
    queryKey: ["all-transactions-for-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("drug_id, jenis, kuantiti");
      if (error) throw error;
      return data;
    },
  });

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of allTx) {
      const curr = map.get(tx.drug_id) ?? 0;
      if (tx.jenis === "terimaan" || tx.jenis === "baki_awal") map.set(tx.drug_id, curr + tx.kuantiti);
      else if (tx.jenis === "keluaran") map.set(tx.drug_id, curr - tx.kuantiti);
    }
    return map;
  }, [allTx]);

  const todayStart = startOfDay(new Date()).toISOString();
  const pending = useMemo(() => requests.filter(r => r.status === "pending_pharmacy"), [requests]);
  const fulfilledToday = useMemo(() =>
    requests.filter(r => r.status === "fulfilled" && r.fulfilled_at && r.fulfilled_at >= todayStart),
    [requests, todayStart]);

  const fulfillMutation = useMutation({
    mutationFn: async () => {
      const req = fulfillTarget;
      const drug = req.drugs as any;

      // Update request status
      const { error: reqErr } = await supabase
        .from("dispensing_requests")
        .update({ status: "fulfilled", fulfilled_by: user?.id, fulfilled_at: new Date().toISOString() })
        .eq("id", req.id);
      if (reqErr) throw reqErr;

      // Create keluaran transaction
      const { error: txErr } = await supabase.from("transactions").insert({
        drug_id: req.drug_id,
        jenis: "keluaran",
        kuantiti: req.quantity,
        tarikh: format(new Date(), "yyyy-MM-dd"),
        nama_pesakit: req.patient_name,
        no_ic: req.no_ic,
        nama_pegawai: profile?.full_name || "—",
        sumber: "request",
        created_by: user?.id,
      });
      if (txErr) throw txErr;

      // Upsert patient registry
      const { data: existingPatient } = await supabase
        .from("patient_registry")
        .select("id")
        .eq("no_ic", req.no_ic)
        .maybeSingle();

      let patientId: string;
      if (existingPatient) {
        patientId = existingPatient.id;
        await supabase.from("patient_registry").update({ patient_name: req.patient_name }).eq("id", patientId);
      } else {
        const { data: newPatient, error: pErr } = await supabase
          .from("patient_registry")
          .insert({ patient_name: req.patient_name, no_ic: req.no_ic })
          .select("id")
          .single();
        if (pErr) throw pErr;
        patientId = newPatient.id;
      }

      // Create patient drug history
      const currentStock = stockMap.get(req.drug_id) ?? 0;
      const stockAfter = currentStock - req.quantity;
      await supabase.from("patient_drug_history").insert({
        patient_id: patientId,
        drug_id: req.drug_id,
        quantity: req.quantity,
        method: "appointment",
        officer_name: profile?.full_name || "—",
        stock_after: stockAfter,
      });

      return { drugName: drug.drug_name, stockAfter, unit: drug.unit_pengukuran };
    },
    onSuccess: (result) => {
      toast.success(`Selesai. Baki baharu ${result.drugName}: ${result.stockAfter} ${result.unit}`);
      setFulfillTarget(null);
      queryClient.invalidateQueries({ queryKey: ["fulfilment-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-transactions-for-stock"] });
    },
    onError: () => toast.error("Gagal memproses permintaan"),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dispensing_requests")
        .update({ status: "rejected", rejection_reason: rejectReason })
        .eq("id", rejectTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permintaan ditolak");
      setRejectTarget(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["fulfilment-requests"] });
    },
    onError: () => toast.error("Gagal menolak"),
  });

  const deferMutation = useMutation({
    mutationFn: async (id: string) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const { error } = await supabase
        .from("dispensing_requests")
        .update({ deferred_date: format(tomorrow, "yyyy-MM-dd") })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permintaan ditangguh ke esok");
      queryClient.invalidateQueries({ queryKey: ["fulfilment-requests"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Permintaan Untuk Diselesaikan</h1>
        <p className="text-sm text-muted-foreground">Klik Selesai untuk mengesahkan pengeluaran dan tolak stok</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Menunggu Pengesahan ({pending.length})</TabsTrigger>
          <TabsTrigger value="fulfilled">Selesai Hari Ini ({fulfilledToday.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {pending.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Tiada permintaan menunggu</CardContent></Card>
          ) : pending.map(req => {
            const drug = req.drugs as any;
            const currentStock = stockMap.get(req.drug_id) ?? 0;
            const afterStock = currentStock - req.quantity;
            const belowMin = afterStock < (drug?.stok_min ?? 0);
            const outOfStock = currentStock <= 0;
            const isSpecialistApproved = drug?.perlu_kelulusan_pakar;
            const isDeferred = !!req.deferred_date;

            return (
              <Card
                key={req.id}
                className="overflow-hidden"
                style={{ borderLeft: `4px solid ${outOfStock ? '#dc2626' : belowMin ? '#dc2626' : isSpecialistApproved ? '#16A34A' : '#2E75B6'}` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{drug?.drug_name}</CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: ms })}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {isSpecialistApproved && <Badge className="bg-green-100 text-green-700 border-green-300 text-[10px]">Diluluskan Pakar ✓</Badge>}
                      {isDeferred && <Badge variant="secondary" className="text-[10px]">Ditangguh</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-4">
                    <div><span className="text-muted-foreground text-xs">Pesakit</span><p className="font-medium">{req.patient_name}</p></div>
                    <div><span className="text-muted-foreground text-xs">IC</span><p>{formatIC(req.no_ic)}</p></div>
                    <div><span className="text-muted-foreground text-xs">Kuantiti</span><p>{req.quantity} {drug?.unit_pengukuran}</p></div>
                    <div><span className="text-muted-foreground text-xs">Doktor</span><p>{req.prescriber_name}</p></div>
                    <div>
                      <span className="text-muted-foreground text-xs">Stok Semasa</span>
                      <p className={belowMin ? "text-destructive font-medium" : ""}>
                        {currentStock} → {afterStock} selepas selesai
                      </p>
                    </div>
                  </div>

                  {belowMin && !outOfStock && (
                    <p className="text-xs text-destructive flex items-center gap-1 mb-3">
                      <AlertTriangle className="h-3 w-3" />
                      Pengeluaran ini akan membawa stok di bawah paras minimum ({drug?.stok_min} {drug?.unit_pengukuran})
                    </p>
                  )}
                  {outOfStock && (
                    <p className="text-xs text-destructive font-medium mb-3">Stok Habis — Tambah Terimaan dahulu</p>
                  )}

                  <div className="flex items-center justify-between">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">Tindakan Lain</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setRejectTarget(req)}>Tolak</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deferMutation.mutate(req.id)}>Tangguh ke esok</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={() => setFulfillTarget(req)} disabled={outOfStock}>Selesai</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="fulfilled" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Masa</TableHead>
                    <TableHead>Pesakit</TableHead>
                    <TableHead>IC</TableHead>
                    <TableHead>Ubat</TableHead>
                    <TableHead>Kuantiti</TableHead>
                    <TableHead>Baki Selepas</TableHead>
                    <TableHead>Pegawai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fulfilledToday.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tiada pengeluaran hari ini</TableCell></TableRow>
                  ) : fulfilledToday.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.fulfilled_at ? formatDistanceToNow(new Date(r.fulfilled_at), { addSuffix: true, locale: ms }) : "—"}</TableCell>
                      <TableCell>{r.patient_name}</TableCell>
                      <TableCell className="text-xs">{formatIC(r.no_ic)}</TableCell>
                      <TableCell>{(r.drugs as any)?.drug_name}</TableCell>
                      <TableCell>{r.quantity}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="text-xs">—</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fulfill Dialog */}
      <Dialog open={!!fulfillTarget} onOpenChange={(o) => !o && setFulfillTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sahkan Pengeluaran</DialogTitle></DialogHeader>
          {fulfillTarget && (
            <p className="text-sm">
              Sahkan pengeluaran <strong>{fulfillTarget.quantity} {(fulfillTarget.drugs as any)?.unit_pengukuran}</strong> {" "}
              <strong>{(fulfillTarget.drugs as any)?.drug_name}</strong> untuk <strong>{fulfillTarget.patient_name}</strong>?
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFulfillTarget(null)}>Batal</Button>
            <Button onClick={() => fulfillMutation.mutate()} disabled={fulfillMutation.isPending}>
              {fulfillMutation.isPending ? "Memproses..." : "Sahkan & Selesai"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tolak Permintaan</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Sebab Penolakan *</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Min 10 aksara" />
          </div>
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
