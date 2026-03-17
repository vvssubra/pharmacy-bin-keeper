import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { BarChart2, Package, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { quotaStatus, forecastStatus, daysRemaining, projectedExhaustion } from "@/lib/quotaHelpers";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function computeStock(drugId: string, txns: { drug_id: string; jenis: string; kuantiti: number }[]) {
  let stock = 0;
  for (const t of txns.filter(t => t.drug_id === drugId)) {
    if (t.jenis === "baki_awal") stock = t.kuantiti;
    else if (t.jenis === "terimaan") stock += t.kuantiti;
    else if (t.jenis === "keluaran") stock -= t.kuantiti;
  }
  return stock;
}

function stockStatus(stock: number, min: number, reorder: number) {
  if (stock <= min) return "critical";
  if (stock <= reorder) return "low";
  return "normal";
}

const FORECAST_STATUS_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-300",
  warning:  "bg-amber-100 text-amber-700 border-amber-300",
  healthy:  "bg-green-100 text-green-700 border-green-300",
  "no-data": "",
};

const STATUS_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-300",
  low:      "bg-amber-100 text-amber-700 border-amber-300",
  normal:   "bg-green-100 text-green-700 border-green-300",
};

export default function FmsDashboard() {
  const [selectedDrugId, setSelectedDrugId] = useState<string>("all");

  // Drug stock quota
  const { data: drugStock = [], isLoading: stockLoading } = useQuery({
    queryKey: ["fms-drug-stock"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [{ data: drugs }, { data: txns }] = await Promise.all([
        supabase
          .from("drugs")
          .select("id, drug_name, unit_pengukuran, stok_min, stok_reorder, stok_max, perlu_kelulusan_pakar")
          .eq("is_active", true)
          .order("drug_name"),
        supabase
          .from("transactions")
          .select("drug_id, jenis, kuantiti"),
      ]);
      return (drugs ?? []).map(d => ({
        ...d,
        current_stock: computeStock(d.id, txns ?? []),
      }));
    },
  });

  // Pending controlled drug requests from MO
  const { data: pendingRequests = [], isLoading: reqLoading } = useQuery({
    queryKey: ["fms-pending-requests"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data: reqs } = await supabase
        .from("dispensing_requests")
        .select("*, drugs(drug_name, unit_pengukuran)")
        .eq("status", "pending_specialist")
        .order("created_at", { ascending: false });

      const ids = [...new Set((reqs ?? []).map(r => r.submitted_by).filter(Boolean))];
      const profileMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        for (const p of profiles ?? []) profileMap[p.user_id] = p.full_name;
      }

      return (reqs ?? []).map(r => ({
        ...r,
        mo_name: profileMap[r.submitted_by] ?? "Unknown MO",
      }));
    },
  });

  // Pending antibiotic forms from MO
  const { data: pendingAntibiotic = [], isLoading: abLoading } = useQuery({
    queryKey: ["fms-pending-antibiotic"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data: forms } = await supabase
        .from("antibiotic_forms" as any)
        .select("*")
        .eq("status", "pending_specialist")
        .order("created_at", { ascending: false });

      const ids = [...new Set((forms ?? []).map((f: any) => f.submitted_by).filter(Boolean))];
      const profileMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        for (const p of profiles ?? []) profileMap[p.user_id] = p.full_name;
      }

      return (forms ?? []).map((f: any) => ({
        ...f,
        mo_name: profileMap[f.submitted_by] ?? "Unknown MO",
      })) as any[];
    },
  });

  const currentYear = new Date().getFullYear();

  const { data: drugQuotas = [] } = useQuery({
    queryKey: ["fms-drug-quotas", currentYear],
    queryFn: async () => {
      const { data } = await supabase.from("drug_quotas").select("drug_id, quota_limit").eq("year", currentYear);
      return (data ?? []) as { drug_id: string; quota_limit: number }[];
    },
  });

  const { data: ytdCounts = {} } = useQuery({
    queryKey: ["fms-ytd-counts", currentYear],
    refetchInterval: 30000,
    queryFn: async () => {
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear + 1}-01-01`;
      const { data } = await supabase.from("dispensing_requests").select("drug_id").eq("status", "fulfilled").gte("created_at", yearStart).lt("created_at", yearEnd);
      const counts: Record<string, number> = {};
      for (const r of data ?? []) counts[r.drug_id] = (counts[r.drug_id] ?? 0) + 1;
      return counts;
    },
  });

  const { data: usage30 = {} } = useQuery({
    queryKey: ["fms-usage-30"],
    refetchInterval: 30000,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase.from("transactions").select("drug_id, kuantiti").eq("jenis", "keluaran").gte("created_at", since.toISOString());
      const totals: Record<string, number> = {};
      for (const t of data ?? []) totals[t.drug_id] = (totals[t.drug_id] ?? 0) + t.kuantiti;
      return totals;
    },
  });

  // Usage graph data
  const { data: usageData = [] } = useQuery({
    queryKey: ["fms-usage", selectedDrugId],
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select("drug_id, kuantiti, created_at")
        .eq("jenis", "keluaran")
        .order("created_at", { ascending: true });
      if (selectedDrugId !== "all") {
        query = query.eq("drug_id", selectedDrugId);
      }
      const { data } = await query;
      const byMonth: Record<string, number> = {};
      for (const t of data ?? []) {
        const month = (t.created_at as string).slice(0, 7);
        byMonth[month] = (byMonth[month] ?? 0) + t.kuantiti;
      }
      return Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, qty]) => ({ month, qty }));
    },
  });

  const criticalCount = drugStock.filter(d => stockStatus(d.current_stock, d.stok_min ?? 0, d.stok_reorder ?? 0) === "critical").length;
  const lowCount = drugStock.filter(d => stockStatus(d.current_stock, d.stok_min ?? 0, d.stok_reorder ?? 0) === "low").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="h-6 w-6" />
          FMS Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drug stock overview, pending MO approvals, and usage trends.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Package className="h-6 w-6 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{drugStock.length}</p>
              <p className="text-xs text-muted-foreground">Active Drugs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
            <div>
              <p className="text-2xl font-bold text-amber-700">{lowCount}</p>
              <p className="text-xs text-muted-foreground">Low Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50">
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-6 w-6 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{pendingRequests.length + pendingAntibiotic.length}</p>
              <p className="text-xs text-muted-foreground">Pending Approvals</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drug stock table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Drug Stock Quota
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stockLoading ? (
            <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drug Name</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Reorder</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drugStock.map(d => {
                  const status = stockStatus(d.current_stock, d.stok_min ?? 0, d.stok_reorder ?? 0);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.drug_name}</TableCell>
                      <TableCell className="text-right font-semibold">{d.current_stock} <span className="text-xs text-muted-foreground">{d.unit_pengukuran}</span></TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{d.stok_min ?? 0}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{d.stok_reorder ?? 0}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{d.stok_max ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_BADGE[status]}`}>
                          {status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending approvals */}
      <Tabs defaultValue="controlled">
        <TabsList>
          <TabsTrigger value="controlled">
            Controlled Drug Requests
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 text-[10px] rounded-full px-1.5">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="antibiotic">
            Antibiotic Forms
            {pendingAntibiotic.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 text-[10px] rounded-full px-1.5">{pendingAntibiotic.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="controlled" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {reqLoading ? (
                <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Drug</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Submitted By (MO)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No pending controlled drug requests</TableCell></TableRow>
                    ) : pendingRequests.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</TableCell>
                        <TableCell className="font-medium text-sm">{r.patient_name}</TableCell>
                        <TableCell className="text-sm">{(r.drugs as any)?.drug_name}</TableCell>
                        <TableCell className="text-sm">{r.quantity} {(r.drugs as any)?.unit_pengukuran}</TableCell>
                        <TableCell className="text-sm font-medium">{(r as any).mo_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="antibiotic" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {abLoading ? (
                <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead>Submitted By (MO)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAntibiotic.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No antibiotic forms pending</TableCell></TableRow>
                    ) : pendingAntibiotic.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</TableCell>
                        <TableCell className="font-medium text-sm">{f.patient_name}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{f.diagnosis}</TableCell>
                        <TableCell className="text-sm font-medium">{f.mo_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Usage graph */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Drug Usage Trend (Dispensed)</CardTitle>
            <Select value={selectedDrugId} onValueChange={setSelectedDrugId}>
              <SelectTrigger className="w-52 h-8 text-xs">
                <SelectValue placeholder="All drugs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All drugs</SelectItem>
                {drugStock.map(d => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">{d.drug_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {usageData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No dispensing records found.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={usageData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="qty" name="Units dispensed" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      {/* Controlled Drug Annual Quota */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Controlled Drug Annual Quota
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stockLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drug Name</TableHead>
                  <TableHead className="text-right">Annual Quota</TableHead>
                  <TableHead className="text-right">Patients Served YTD</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Projected Exhaustion</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drugStock.filter(d => (d as any).perlu_kelulusan_pakar).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No controlled drugs found</TableCell></TableRow>
                ) : drugStock.filter(d => (d as any).perlu_kelulusan_pakar).map(d => {
                  const quotaRow = drugQuotas.find(q => q.drug_id === d.id);
                  const quota = quotaRow ? quotaRow.quota_limit : null;
                  const served = (ytdCounts as Record<string,number>)[d.id] ?? 0;
                  const remaining = quota !== null ? quota - served : null;
                  const monthsElapsed = new Date().getMonth() + 1;
                  const avgPerMonth = monthsElapsed > 0 ? served / monthsElapsed : 0;
                  const status = quotaStatus(remaining, quota);
                  const badgeClass: Record<string, string> = {
                    critical: "bg-red-100 text-red-700 border-red-300",
                    warning: "bg-amber-100 text-amber-700 border-amber-300",
                    healthy: "bg-green-100 text-green-700 border-green-300",
                    "no-quota": "bg-gray-100 text-gray-600 border-gray-300",
                  };
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium text-sm">{d.drug_name}</TableCell>
                      <TableCell className="text-right text-sm">{quota ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">{served}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{remaining !== null ? remaining : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {quota === null ? "No quota set" : projectedExhaustion(remaining!, avgPerMonth)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] capitalize ${badgeClass[status]}`}>
                          {status === "no-quota" ? "No quota" : status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Non-Controlled Stock Forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Non-Controlled Stock Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stockLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drug Name</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Avg Daily Usage (30d)</TableHead>
                  <TableHead className="text-right">Days Left</TableHead>
                  <TableHead>Reorder By</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drugStock.filter(d => !(d as any).perlu_kelulusan_pakar).map(d => {
                  const avgDaily = ((usage30 as Record<string,number>)[d.id] ?? 0) / 30;
                  const days = daysRemaining(d.current_stock, avgDaily);
                  const fStatus = forecastStatus(days);
                  const reorderDate = days !== null && days > 0
                    ? (() => { const dt = new Date(); dt.setDate(dt.getDate() + days - 7); return dt.toLocaleDateString("en-MY", { day: "numeric", month: "short" }); })()
                    : "—";
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium text-sm">{d.drug_name}</TableCell>
                      <TableCell className="text-right text-sm">{d.current_stock} <span className="text-xs text-muted-foreground">{d.unit_pengukuran}</span></TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{avgDaily > 0 ? avgDaily.toFixed(1) : "—"}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {days !== null ? days : <span className="text-muted-foreground text-xs">No usage data</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{reorderDate}</TableCell>
                      <TableCell>
                        {fStatus === "no-data" ? (
                          <span className="text-xs text-muted-foreground">No usage data</span>
                        ) : (
                          <Badge variant="outline" className={`text-[10px] capitalize ${FORECAST_STATUS_BADGE[fStatus]}`}>{fStatus}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
