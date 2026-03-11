
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isWithinInterval, parseISO } from "date-fns";
import {
  ArrowLeft, CalendarIcon, Search, Download, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type MockRow = {
  id: string;
  tarikh: string;
  noRujukan: string;
  pihak: string;
  jenis: "terimaan" | "keluaran" | "baki_awal";
  kuantiti: number;
  seunit?: number;
  jumlahRM?: number;
  namaPegawai: string;
  sumber: "Excel Import" | "Manual" | "Baki Awal";
};

const MOCK_ROWS: MockRow[] = [
  { id: "1", tarikh: "2025-01-02", noRujukan: "BA-001", pihak: "-", jenis: "baki_awal", kuantiti: 500, seunit: 0.25, jumlahRM: 125.0, namaPegawai: "Pn. Siti", sumber: "Baki Awal" },
  { id: "2", tarikh: "2025-01-08", noRujukan: "DO-20250108-A", pihak: "Stor Utama JKNJ", jenis: "terimaan", kuantiti: 200, seunit: 0.25, jumlahRM: 50.0, namaPegawai: "En. Ahmad", sumber: "Excel Import" },
  { id: "3", tarikh: "2025-01-10", noRujukan: "KEL-001", pihak: "Bilik Rawatan 1", jenis: "keluaran", kuantiti: 50, jumlahRM: 12.5, namaPegawai: "Pn. Lina", sumber: "Manual" },
  { id: "4", tarikh: "2025-01-15", noRujukan: "KEL-002", pihak: "Bilik Rawatan 2", jenis: "keluaran", kuantiti: 80, jumlahRM: 20.0, namaPegawai: "En. Razak", sumber: "Excel Import" },
  { id: "5", tarikh: "2025-01-22", noRujukan: "DO-20250122-B", pihak: "Stor Utama JKNJ", jenis: "terimaan", kuantiti: 300, seunit: 0.25, jumlahRM: 75.0, namaPegawai: "En. Ahmad", sumber: "Excel Import" },
  { id: "6", tarikh: "2025-02-01", noRujukan: "KEL-003", pihak: "Farmasi Pesakit Luar", jenis: "keluaran", kuantiti: 120, jumlahRM: 30.0, namaPegawai: "Pn. Siti", sumber: "Manual" },
  { id: "7", tarikh: "2025-02-05", noRujukan: "KEL-004", pihak: "Bilik Rawatan 1", jenis: "keluaran", kuantiti: 60, jumlahRM: 15.0, namaPegawai: "Pn. Lina", sumber: "Excel Import" },
  { id: "8", tarikh: "2025-02-12", noRujukan: "DO-20250212-C", pihak: "Stor Utama JKNJ", jenis: "terimaan", kuantiti: 150, seunit: 0.28, jumlahRM: 42.0, namaPegawai: "En. Ahmad", sumber: "Excel Import" },
  { id: "9", tarikh: "2025-02-18", noRujukan: "KEL-005", pihak: "Bilik Rawatan 3", jenis: "keluaran", kuantiti: 90, jumlahRM: 25.2, namaPegawai: "En. Razak", sumber: "Manual" },
  { id: "10", tarikh: "2025-02-25", noRujukan: "KEL-006", pihak: "Farmasi Pesakit Luar", jenis: "keluaran", kuantiti: 200, jumlahRM: 56.0, namaPegawai: "Pn. Siti", sumber: "Excel Import" },
  { id: "11", tarikh: "2025-03-01", noRujukan: "DO-20250301-D", pihak: "Stor Utama JKNJ", jenis: "terimaan", kuantiti: 400, seunit: 0.28, jumlahRM: 112.0, namaPegawai: "En. Ahmad", sumber: "Excel Import" },
  { id: "12", tarikh: "2025-03-05", noRujukan: "KEL-007", pihak: "Bilik Rawatan 2", jenis: "keluaran", kuantiti: 150, jumlahRM: 42.0, namaPegawai: "Pn. Lina", sumber: "Manual" },
  { id: "13", tarikh: "2025-03-08", noRujukan: "KEL-008", pihak: "Bilik Rawatan 1", jenis: "keluaran", kuantiti: 100, jumlahRM: 28.0, namaPegawai: "Pn. Siti", sumber: "Excel Import" },
  { id: "14", tarikh: "2025-03-10", noRujukan: "DO-20250310-E", pihak: "Stor Utama JKNJ", jenis: "terimaan", kuantiti: 250, seunit: 0.30, jumlahRM: 75.0, namaPegawai: "En. Ahmad", sumber: "Manual" },
  { id: "15", tarikh: "2025-03-11", noRujukan: "KEL-009", pihak: "Farmasi Pesakit Luar", jenis: "keluaran", kuantiti: 70, jumlahRM: 21.0, namaPegawai: "En. Razak", sumber: "Excel Import" },
];

function getBakiLevel(qty: number, min: number, max: number) {
  if (qty <= 0 || qty < min * 0.5) return { label: "KRITIKAL", className: "bg-destructive text-destructive-foreground" };
  if (qty < min) return { label: "RENDAH", className: "bg-orange-500 text-white" };
  if (qty > max) return { label: "LEBIHAN", className: "bg-blue-500 text-white" };
  return { label: "NORMAL", className: "bg-green-600 text-white" };
}

function sumberBadge(sumber: string) {
  switch (sumber) {
    case "Baki Awal":
      return <Badge className="bg-purple-600 text-white border-transparent text-[10px]">{sumber}</Badge>;
    case "Manual":
      return <Badge className="bg-blue-500 text-white border-transparent text-[10px]">{sumber}</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">{sumber}</Badge>;
  }
}

export default function DrugLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [typeFilter, setTypeFilter] = useState("semua");
  const [search, setSearch] = useState("");

  const { data: drug, isLoading } = useQuery({
    queryKey: ["drug", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drugs")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const filteredRows = useMemo(() => {
    let rows = [...MOCK_ROWS];
    if (typeFilter === "terimaan") rows = rows.filter((r) => r.jenis === "terimaan");
    else if (typeFilter === "keluaran") rows = rows.filter((r) => r.jenis === "keluaran");

    if (startDate || endDate) {
      rows = rows.filter((r) => {
        const d = parseISO(r.tarikh);
        if (startDate && endDate) return isWithinInterval(d, { start: startDate, end: endDate });
        if (startDate) return d >= startDate;
        if (endDate) return d <= endDate;
        return true;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.noRujukan.toLowerCase().includes(q) ||
          r.namaPegawai.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [typeFilter, startDate, endDate, search]);

  // Compute running balance over ALL mock rows, then map to filtered
  const rowsWithBaki = useMemo(() => {
    const balanceMap = new Map<string, { bakiQty: number; bakiRM: number }>();
    let runQty = 0;
    let runRM = 0;
    for (const row of MOCK_ROWS) {
      if (row.jenis === "baki_awal" || row.jenis === "terimaan") {
        runQty += row.kuantiti;
        runRM += row.jumlahRM ?? 0;
      } else {
        runQty -= row.kuantiti;
        runRM -= row.jumlahRM ?? 0;
      }
      balanceMap.set(row.id, { bakiQty: runQty, bakiRM: Math.max(0, runRM) });
    }
    return filteredRows.map((r) => ({
      ...r,
      ...(balanceMap.get(r.id) ?? { bakiQty: 0, bakiRM: 0 }),
    }));
  }, [filteredRows]);

  const currentBaki = useMemo(() => {
    let qty = 0;
    for (const row of MOCK_ROWS) {
      if (row.jenis === "baki_awal" || row.jenis === "terimaan") qty += row.kuantiti;
      else qty -= row.kuantiti;
    }
    return qty;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Memuatkan...
      </div>
    );
  }

  if (!drug) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/drugs")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Kembali
        </Button>
        <p className="text-muted-foreground">Ubat tidak dijumpai.</p>
      </div>
    );
  }

  const level = getBakiLevel(currentBaki, drug.stok_min ?? 0, drug.stok_max ?? 9999);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate("/drugs")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Drug Master
        </Button>
        <h1 className="text-2xl font-bold text-foreground">{drug.drug_name}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>No. Kod: <strong className="text-foreground">{drug.no_kod || "-"}</strong></span>
          <span>Unit: <strong className="text-foreground capitalize">{drug.unit_pengukuran}</strong></span>
          <span>Kumpulan: <strong className="text-foreground">{drug.kumpulan || "-"}</strong></span>
          <span>Lokasi: <strong className="text-foreground">{drug.kod_lokasi_penuh || "-"}</strong></span>
          <span>Paras Stok: <strong className="text-foreground">{drug.stok_min}/{drug.stok_reorder}/{drug.stok_max}</strong></span>
        </div>
      </div>

      {/* Baki Card */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div>
            <p className="text-sm text-muted-foreground">Baki Semasa</p>
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {currentBaki} <span className="text-base font-normal text-muted-foreground">{drug.unit_pengukuran}</span>
            </p>
          </div>
          <Badge className={cn("text-xs px-3 py-1", level.className)}>{level.label}</Badge>
        </CardContent>
      </Card>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Dari</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-4 w-4" />
                {startDate ? format(startDate, "dd/MM/yyyy") : "Mula"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Hingga</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yyyy") : "Akhir"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Jenis</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua</SelectItem>
              <SelectItem value="terimaan">Terimaan</SelectItem>
              <SelectItem value="keluaran">Keluaran</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <label className="text-xs text-muted-foreground mb-1 block">Carian</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="No. rujukan / pegawai"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
        </div>
        <div className="ml-auto">
          <label className="text-xs text-muted-foreground mb-1 block invisible">_</label>
          <Button variant="outline">
            <Download className="mr-1 h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      {/* Ledger Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="align-bottom border-r">Tarikh</TableHead>
                <TableHead rowSpan={2} className="align-bottom border-r">No. Rujukan</TableHead>
                <TableHead rowSpan={2} className="align-bottom border-r">Terima / Keluar Kepada</TableHead>
                <TableHead colSpan={3} className="text-center border-b border-r">Terimaan</TableHead>
                <TableHead colSpan={2} className="text-center border-b border-r">Keluaran</TableHead>
                <TableHead colSpan={2} className="text-center border-b border-r">Baki</TableHead>
                <TableHead rowSpan={2} className="align-bottom border-r">Pegawai</TableHead>
                <TableHead rowSpan={2} className="align-bottom">Sumber</TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="text-center text-xs border-r">Kuantiti</TableHead>
                <TableHead className="text-center text-xs border-r">Seunit (RM)</TableHead>
                <TableHead className="text-center text-xs border-r">Jumlah (RM)</TableHead>
                <TableHead className="text-center text-xs border-r">Kuantiti</TableHead>
                <TableHead className="text-center text-xs border-r">Jumlah (RM)</TableHead>
                <TableHead className="text-center text-xs border-r">Kuantiti</TableHead>
                <TableHead className="text-center text-xs">Jumlah (RM)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsWithBaki.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12}>
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <FileText className="mb-2 h-8 w-8" />
                      <p className="text-sm font-medium">Tiada transaksi dijumpai</p>
                      <Button variant="link" size="sm" className="mt-1" onClick={() => navigate("/drugs")}>
                        Mulakan dengan menetapkan baki awal
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rowsWithBaki.map((row, idx) => {
                  const isTerimaan = row.jenis === "terimaan";
                  const isBakiAwal = row.jenis === "baki_awal";
                  const isKeluaran = row.jenis === "keluaran";
                  const bakiBelowMin = row.bakiQty < (drug.stok_min ?? 0);

                  return (
                    <TableRow
                      key={row.id}
                      className={cn(
                        idx % 2 === 1 && "bg-muted/30",
                        isBakiAwal && "bg-purple-50 dark:bg-purple-950/20",
                        isTerimaan && "border-l-4 border-l-green-500"
                      )}
                    >
                      <TableCell className="text-xs tabular-nums border-r">{format(parseISO(row.tarikh), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-xs border-r">{row.noRujukan}</TableCell>
                      <TableCell className="text-xs border-r">{row.pihak}</TableCell>
                      {/* Terimaan cols */}
                      <TableCell className="text-center text-xs tabular-nums border-r">
                        {(isTerimaan || isBakiAwal) ? row.kuantiti : ""}
                      </TableCell>
                      <TableCell className="text-center text-xs tabular-nums border-r">
                        {(isTerimaan || isBakiAwal) && row.seunit ? row.seunit.toFixed(2) : ""}
                      </TableCell>
                      <TableCell className="text-center text-xs tabular-nums border-r">
                        {(isTerimaan || isBakiAwal) && row.jumlahRM ? row.jumlahRM.toFixed(2) : ""}
                      </TableCell>
                      {/* Keluaran cols */}
                      <TableCell className="text-center text-xs tabular-nums border-r">
                        {isKeluaran ? row.kuantiti : ""}
                      </TableCell>
                      <TableCell className="text-center text-xs tabular-nums border-r">
                        {isKeluaran && row.jumlahRM ? row.jumlahRM.toFixed(2) : ""}
                      </TableCell>
                      {/* Baki cols */}
                      <TableCell className={cn("text-center text-xs tabular-nums font-semibold border-r", bakiBelowMin && "text-destructive")}>
                        {row.bakiQty}
                      </TableCell>
                      <TableCell className="text-center text-xs tabular-nums border-r">
                        {row.bakiRM.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs border-r">{row.namaPegawai}</TableCell>
                      <TableCell>{sumberBadge(row.sumber)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination info */}
      {rowsWithBaki.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Menunjukkan 1-{rowsWithBaki.length} daripada {rowsWithBaki.length} transaksi
        </p>
      )}
    </div>
  );
}
