import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, TrendingDown, CheckCircle, TrendingUp, X,
  FileText, Upload, ExternalLink, Plus,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ms } from "date-fns/locale";

type StockStatus = "KRITIKAL" | "RENDAH" | "NORMAL" | "LEBIHAN" | "TIADA PARAS";

interface DrugStock {
  id: string;
  drug_name: string;
  unit_pengukuran: string;
  stok_min: number;
  stok_reorder: number;
  stok_max: number;
  baki: number;
  status: StockStatus;
  lastUpdated: string | null;
}

// ---------- mock data for 50 drugs ----------
const MOCK_DRUG_NAMES = [
  "Paracetamol 500mg","Amoxicillin 250mg","Metformin 500mg","Amlodipine 5mg","Losartan 50mg",
  "Omeprazole 20mg","Atorvastatin 20mg","Aspirin 100mg","Hydrochlorothiazide 25mg","Simvastatin 20mg",
  "Clopidogrel 75mg","Metoprolol 50mg","Gliclazide 80mg","Prednisolone 5mg","Cetirizine 10mg",
  "Salbutamol Inhaler","Insulin Mixtard 30/70","Lovastatin 20mg","Captopril 25mg","Diclofenac 50mg",
  "Ranitidine 150mg","Furosemide 40mg","Warfarin 2mg","Enalapril 5mg","Nifedipine 30mg",
  "Ciprofloxacin 500mg","Doxycycline 100mg","Erythromycin 250mg","Ibuprofen 400mg","Chlorpheniramine 4mg",
  "Promethazine 25mg","Domperidone 10mg","Loperamide 2mg","Mefenamic Acid 500mg","Tramadol 50mg",
  "Gabapentin 300mg","Carbamazepine 200mg","Phenytoin 100mg","Fluoxetine 20mg","Risperidone 2mg",
  "Haloperidol 5mg","Diazepam 5mg","Alprazolam 0.5mg","Vitamin B Complex","Folic Acid 5mg",
  "Ferrous Fumarate 200mg","Calcium Carbonate 500mg","Methyldopa 250mg","Glyceryl Trinitrate 0.5mg","Isosorbide Dinitrate 10mg",
];

function generateMockDrugs(): DrugStock[] {
  return MOCK_DRUG_NAMES.map((name, i) => {
    const min = 50 + (i % 5) * 20;
    const reorder = min + 30;
    const max = reorder + 100;
    // distribute statuses
    let baki: number;
    if (i % 10 === 0) baki = Math.floor(min * 0.5); // KRITIKAL
    else if (i % 7 === 0) baki = min + Math.floor((reorder - min) * 0.3); // RENDAH
    else if (i % 13 === 0) baki = max + 20; // LEBIHAN
    else baki = reorder + Math.floor(Math.random() * (max - reorder));

    const status = getStatus(baki, min, reorder, max);
    const daysAgo = Math.floor(Math.random() * 14);
    const lastUpdated = new Date(Date.now() - daysAgo * 86400000).toISOString();

    return {
      id: `mock-${i}`,
      drug_name: name,
      unit_pengukuran: i % 3 === 0 ? "vial" : i % 5 === 0 ? "sachet" : "tablet",
      stok_min: min,
      stok_reorder: reorder,
      stok_max: max,
      baki,
      status,
      lastUpdated,
    };
  });
}

function getStatus(baki: number, min: number, reorder: number, max: number): StockStatus {
  if (!min && !max) return "TIADA PARAS";
  if (baki < min) return "KRITIKAL";
  if (baki < reorder) return "RENDAH";
  if (baki > max) return "LEBIHAN";
  return "NORMAL";
}

const STATUS_CONFIG: Record<StockStatus, { color: string; badgeClass: string }> = {
  KRITIKAL: { color: "text-destructive", badgeClass: "bg-destructive/15 text-destructive border-destructive/30" },
  RENDAH: { color: "text-warning", badgeClass: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700" },
  NORMAL: { color: "text-green-600", badgeClass: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700" },
  LEBIHAN: { color: "text-blue-600", badgeClass: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700" },
  "TIADA PARAS": { color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-border" },
};

const STATUS_ORDER: Record<StockStatus, number> = {
  KRITIKAL: 0, RENDAH: 1, NORMAL: 2, LEBIHAN: 3, "TIADA PARAS": 4,
};

// ---------- mock activity ----------
const MOCK_ACTIVITY = [
  { drug_name: "Paracetamol 500mg", jenis: "terimaan", kuantiti: 500, nama_pegawai: "Pn. Siti", created_at: new Date(Date.now() - 3600000).toISOString() },
  { drug_name: "Amoxicillin 250mg", jenis: "keluaran", kuantiti: 120, nama_pegawai: "En. Ahmad", created_at: new Date(Date.now() - 7200000).toISOString() },
  { drug_name: "Metformin 500mg", jenis: "terimaan", kuantiti: 300, nama_pegawai: "Pn. Siti", created_at: new Date(Date.now() - 18000000).toISOString() },
  { drug_name: "Amlodipine 5mg", jenis: "keluaran", kuantiti: 60, nama_pegawai: "Dr. Lee", created_at: new Date(Date.now() - 36000000).toISOString() },
  { drug_name: "Losartan 50mg", jenis: "terimaan", kuantiti: 200, nama_pegawai: "Pn. Siti", created_at: new Date(Date.now() - 86400000).toISOString() },
  { drug_name: "Omeprazole 20mg", jenis: "keluaran", kuantiti: 80, nama_pegawai: "En. Ahmad", created_at: new Date(Date.now() - 172800000).toISOString() },
  { drug_name: "Atorvastatin 20mg", jenis: "terimaan", kuantiti: 150, nama_pegawai: "Pn. Siti", created_at: new Date(Date.now() - 259200000).toISOString() },
  { drug_name: "Aspirin 100mg", jenis: "keluaran", kuantiti: 45, nama_pegawai: "Dr. Lee", created_at: new Date(Date.now() - 345600000).toISOString() },
  { drug_name: "Simvastatin 20mg", jenis: "terimaan", kuantiti: 400, nama_pegawai: "En. Ahmad", created_at: new Date(Date.now() - 432000000).toISOString() },
  { drug_name: "Clopidogrel 75mg", jenis: "keluaran", kuantiti: 30, nama_pegawai: "Pn. Siti", created_at: new Date(Date.now() - 518400000).toISOString() },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Fetch drugs
  const { data: drugs } = useQuery({
    queryKey: ["drugs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drugs").select("id, drug_name, unit_pengukuran, stok_min, stok_reorder, stok_max").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch all transactions for baki calc
  const { data: transactions } = useQuery({
    queryKey: ["transactions-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("drug_id, jenis, kuantiti, created_at");
      if (error) throw error;
      return data;
    },
  });

  // Fetch last 10 transactions with drug info
  const { data: recentTx } = useQuery({
    queryKey: ["recent-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, jenis, kuantiti, nama_pegawai, created_at, drug_id, drugs(drug_name)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Compute drug stocks
  const drugStocks: DrugStock[] = useMemo(() => {
    if (!drugs || drugs.length === 0 || !transactions) return generateMockDrugs();

    const bakiMap = new Map<string, { baki: number; lastDate: string | null }>();
    for (const tx of transactions) {
      const entry = bakiMap.get(tx.drug_id) || { baki: 0, lastDate: null };
      if (tx.jenis === "terimaan" || tx.jenis === "baki_awal") {
        entry.baki += tx.kuantiti;
      } else if (tx.jenis === "keluaran") {
        entry.baki -= tx.kuantiti;
      }
      if (!entry.lastDate || tx.created_at > entry.lastDate) entry.lastDate = tx.created_at;
      bakiMap.set(tx.drug_id, entry);
    }

    return drugs.map((d) => {
      const entry = bakiMap.get(d.id) || { baki: 0, lastDate: null };
      const status = getStatus(entry.baki, d.stok_min ?? 0, d.stok_reorder ?? 0, d.stok_max ?? 0);
      return {
        id: d.id,
        drug_name: d.drug_name,
        unit_pengukuran: d.unit_pengukuran,
        stok_min: d.stok_min ?? 0,
        stok_reorder: d.stok_reorder ?? 0,
        stok_max: d.stok_max ?? 0,
        baki: entry.baki,
        status,
        lastUpdated: entry.lastDate,
      };
    }).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [drugs, transactions]);

  // Activity feed
  const activityFeed = useMemo(() => {
    if (!recentTx || recentTx.length === 0) return MOCK_ACTIVITY;
    return recentTx.map((tx) => ({
      drug_name: (tx.drugs as any)?.drug_name ?? "—",
      jenis: tx.jenis,
      kuantiti: tx.kuantiti,
      nama_pegawai: tx.nama_pegawai ?? "—",
      created_at: tx.created_at,
    }));
  }, [recentTx]);

  // Counts
  const counts = useMemo(() => {
    const c = { KRITIKAL: 0, RENDAH: 0, NORMAL: 0, LEBIHAN: 0 };
    for (const d of drugStocks) {
      if (d.status in c) c[d.status as keyof typeof c]++;
    }
    return c;
  }, [drugStocks]);

  const today = format(new Date(), "d MMMM yyyy", { locale: ms });

  const statCards = [
    { label: "Kritikal", count: counts.KRITIKAL, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Rendah", count: counts.RENDAH, icon: TrendingDown, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/20" },
    { label: "Normal", count: counts.NORMAL, icon: CheckCircle, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/20" },
    { label: "Lebihan", count: counts.LEBIHAN, icon: TrendingUp, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/20" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Gambaran keseluruhan stok semasa — {today}</p>
      </div>

      {/* Section 2 — Alert Banner */}
      {counts.KRITIKAL > 0 && !alertDismissed && (
        <Alert variant="destructive" className="relative">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Amaran Stok Kritikal</AlertTitle>
          <AlertDescription>
            {counts.KRITIKAL} ubat memerlukan perhatian segera — stok di bawah paras minimum
          </AlertDescription>
          <button onClick={() => setAlertDismissed(true)} className="absolute right-3 top-3 text-destructive hover:text-destructive/80">
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}

      {/* Section 1 — Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <div className={`rounded-md p-2 ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{s.count}</p>
              <p className="text-xs text-muted-foreground mt-1">ubat</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section 3 — Drug Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Status Stok Ubat</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Ubat</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Baki</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="text-right">Max</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">% Max</TableHead>
                <TableHead>Kemaskini</TableHead>
                <TableHead>Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drugStocks.map((d) => {
                const pct = d.stok_max > 0 ? Math.min(Math.round((d.baki / d.stok_max) * 100), 100) : 0;
                const cfg = STATUS_CONFIG[d.status];
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{d.drug_name}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{d.unit_pengukuran}</TableCell>
                    <TableCell className="text-right font-bold">{d.baki}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{d.stok_min}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{d.stok_reorder}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{d.stok_max}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cfg.badgeClass}>{d.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Progress value={pct} className="h-2" />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {d.lastUpdated ? formatDistanceToNow(new Date(d.lastUpdated), { addSuffix: true, locale: ms }) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate(`/drugs/${d.id}/ledger`)}>
                          <ExternalLink className="h-3 w-3 mr-1" /> Lejar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate(`/terimaan?drug=${d.id}`)}>
                          <Plus className="h-3 w-3 mr-1" /> Terima
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bottom row: Activity Feed + Import Status */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Section 4 — Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Aktiviti Terkini</CardTitle>
            <Button variant="link" size="sm" className="text-xs" onClick={() => navigate("/terimaan")}>
              Lihat Semua
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityFeed.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge
                    variant="outline"
                    className={
                      a.jenis === "terimaan"
                        ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                        : "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700"
                    }
                  >
                    {a.jenis === "terimaan" ? "Terimaan" : "Keluaran"}
                  </Badge>
                  <span className="font-medium truncate">{a.drug_name}</span>
                  <span className="text-muted-foreground">×{a.kuantiti}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-muted-foreground text-xs">
                  <span>{a.nama_pegawai}</span>
                  <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ms })}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Section 5 — Import Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" /> Status Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Import Terakhir</span>
                <span className="font-medium">4 Mac 2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Minggu Semasa</span>
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700">
                  Belum diupload
                </Badge>
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={() => navigate("/upload")}>
              <Upload className="h-4 w-4 mr-2" /> Upload Sekarang
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
