import { useState } from "react";
import { format } from "date-fns";
import { ms } from "date-fns/locale";
import {
  FileDown, FileSpreadsheet, Search, CalendarIcon, ChevronDown, ChevronUp,
  Clock, CheckCircle2, AlertCircle, RotateCcw, Eye,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Mock quarterly data
const mockQuarterlyData = [
  { drug: "Paracetamol 500mg", terimaan: 5000, keluaran: 4200, baki: 800 },
  { drug: "Amoxicillin 250mg", terimaan: 3000, keluaran: 2800, baki: 200 },
  { drug: "Metformin 500mg", terimaan: 4000, keluaran: 3500, baki: 500 },
  { drug: "Amlodipine 5mg", terimaan: 2000, keluaran: 1800, baki: 200 },
  { drug: "Omeprazole 20mg", terimaan: 2500, keluaran: 2100, baki: 400 },
  { drug: "Atorvastatin 20mg", terimaan: 1500, keluaran: 1300, baki: 200 },
];

// Mock movement data
const mockMovementData = [
  { drug: "Paracetamol 500mg", totalQty: 4200, totalRM: 840.00, count: 42, avg: 100, lastDate: "2026-03-10" },
  { drug: "Amoxicillin 250mg", totalQty: 2800, totalRM: 1680.00, count: 28, avg: 100, lastDate: "2026-03-09" },
  { drug: "Metformin 500mg", totalQty: 3500, totalRM: 525.00, count: 35, avg: 100, lastDate: "2026-03-11" },
  { drug: "Amlodipine 5mg", totalQty: 1800, totalRM: 720.00, count: 18, avg: 100, lastDate: "2026-03-08" },
  { drug: "Omeprazole 20mg", totalQty: 2100, totalRM: 1050.00, count: 21, avg: 100, lastDate: "2026-03-07" },
];

// Mock import history
const mockImportHistory = [
  {
    id: "1", tarikh: "2026-03-10", oleh: "Pn. Siti Aminah", fail: 3, berjaya: 147, ralat: 2,
    details: [
      { drug: "Paracetamol 500mg", qty: 500, status: "Berjaya" },
      { drug: "Amoxicillin 250mg", qty: 300, status: "Berjaya" },
      { drug: "Unknown Drug X", qty: 100, status: "Ralat — ubat tidak dijumpai" },
    ],
  },
  {
    id: "2", tarikh: "2026-03-03", oleh: "En. Ahmad Faiz", fail: 2, berjaya: 98, ralat: 0,
    details: [
      { drug: "Metformin 500mg", qty: 400, status: "Berjaya" },
      { drug: "Amlodipine 5mg", qty: 200, status: "Berjaya" },
    ],
  },
  {
    id: "3", tarikh: "2026-02-24", oleh: "Pn. Siti Aminah", fail: 4, berjaya: 203, ralat: 5,
    details: [
      { drug: "Omeprazole 20mg", qty: 250, status: "Berjaya" },
      { drug: "Atorvastatin 20mg", qty: 150, status: "Berjaya" },
      { drug: "Bad Format Row", qty: 0, status: "Ralat — format tidak sah" },
    ],
  },
  {
    id: "4", tarikh: "2026-02-17", oleh: "En. Ahmad Faiz", fail: 1, berjaya: 52, ralat: 0,
    details: [
      { drug: "Losartan 50mg", qty: 300, status: "Berjaya" },
    ],
  },
  {
    id: "5", tarikh: "2026-02-10", oleh: "Pn. Noraini", fail: 2, berjaya: 110, ralat: 1,
    details: [
      { drug: "Simvastatin 20mg", qty: 200, status: "Berjaya" },
      { drug: "Duplicate Entry", qty: 50, status: "Ralat — rekod pendua" },
    ],
  },
];

function DatePickerField({ label, date, onSelect }: { label: string; date?: Date; onSelect: (d?: Date) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm h-9", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {date ? format(date, "dd/MM/yyyy") : "Pilih tarikh"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function comingSoon() {
  toast({ title: "Akan datang", description: "Ciri ini sedang dalam pembangunan." });
}

export default function Laporan() {
  // Card 1 state
  const [selectedDrug, setSelectedDrug] = useState("");
  const [drugOpen, setDrugOpen] = useState(false);
  const [pdfFrom, setPdfFrom] = useState<Date>();
  const [pdfTo, setPdfTo] = useState<Date>();

  // Card 2 state
  const [year, setYear] = useState("2026");
  const [quarter, setQuarter] = useState("all");

  // Card 3 state
  const [movFrom, setMovFrom] = useState<Date>();
  const [movTo, setMovTo] = useState<Date>();
  const [showMovement, setShowMovement] = useState(false);

  // Import history expand state
  const [expandedImport, setExpandedImport] = useState<string | null>(null);

  // Fetch drugs for combobox
  const { data: drugs = [] } = useQuery({
    queryKey: ["drugs-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drugs").select("id, drug_name").eq("is_active", true).order("drug_name");
      if (error) throw error;
      return data;
    },
  });

  const selectedDrugName = drugs.find((d) => d.id === selectedDrug)?.drug_name;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Laporan</h1>
        <p className="text-sm text-muted-foreground">Jana laporan dan eksport data</p>
      </div>

      {/* 3 Report Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CARD 1 — KEW.PS-3 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kad Stok Digital (KEW.PS-3)</CardTitle>
            <CardDescription>Jana PDF kad stok dalam format KEW.PS-3 untuk kegunaan audit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Ubat</Label>
              <Popover open={drugOpen} onOpenChange={setDrugOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between text-sm h-9 font-normal">
                    {selectedDrugName || "Pilih ubat..."}
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                  <Command>
                    <CommandInput placeholder="Cari ubat..." />
                    <CommandList>
                      <CommandEmpty>Tiada ubat dijumpai.</CommandEmpty>
                      <CommandGroup>
                        {drugs.map((d) => (
                          <CommandItem key={d.id} value={d.drug_name} onSelect={() => { setSelectedDrug(d.id); setDrugOpen(false); }}>
                            {d.drug_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField label="Dari Tarikh" date={pdfFrom} onSelect={setPdfFrom} />
              <DatePickerField label="Hingga Tarikh" date={pdfTo} onSelect={setPdfTo} />
            </div>
            <Button className="w-full" onClick={comingSoon}>
              <FileDown className="mr-2 h-4 w-4" />
              Jana PDF
            </Button>
            <p className="text-xs text-muted-foreground">PDF akan mengandungi Bahagian A dan Bahagian B dalam format KEW.PS-3</p>
          </CardContent>
        </Card>

        {/* CARD 2 — Quarterly Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ringkasan Suku Tahun</CardTitle>
            <CardDescription>Agregat terimaan dan keluaran stok mengikut suku tahun</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tahun</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Suku</Label>
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Suku</SelectItem>
                    <SelectItem value="Q1">Q1 Jan–Mac</SelectItem>
                    <SelectItem value="Q2">Q2 Apr–Jun</SelectItem>
                    <SelectItem value="Q3">Q3 Jul–Sep</SelectItem>
                    <SelectItem value="Q4">Q4 Okt–Dis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={comingSoon}>Jana Laporan</Button>
              <Button variant="secondary" onClick={comingSoon}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Export Excel
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ubat</TableHead>
                  <TableHead className="text-xs text-right">Terima</TableHead>
                  <TableHead className="text-xs text-right">Keluar</TableHead>
                  <TableHead className="text-xs text-right">Baki</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockQuarterlyData.map((r) => (
                  <TableRow key={r.drug}>
                    <TableCell className="text-xs font-medium">{r.drug}</TableCell>
                    <TableCell className="text-xs text-right">{r.terimaan.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right">{r.keluaran.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{r.baki.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* CARD 3 — Drug Movement Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ringkasan Pergerakan Ubat</CardTitle>
            <CardDescription>Jumlah keluaran stok mengikut tempoh yang dipilih</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField label="Dari Tarikh" date={movFrom} onSelect={setMovFrom} />
              <DatePickerField label="Hingga Tarikh" date={movTo} onSelect={setMovTo} />
            </div>
            <Button className="w-full" onClick={() => setShowMovement(true)}>
              <Search className="mr-2 h-4 w-4" />
              Cari
            </Button>
            {showMovement && (
              <div className="overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Ubat</TableHead>
                      <TableHead className="text-xs text-right">Qty</TableHead>
                      <TableHead className="text-xs text-right">RM</TableHead>
                      <TableHead className="text-xs text-right">Bil.</TableHead>
                      <TableHead className="text-xs text-right">Avg</TableHead>
                      <TableHead className="text-xs">Terakhir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockMovementData.map((r) => (
                      <TableRow key={r.drug}>
                        <TableCell className="text-xs font-medium">{r.drug}</TableCell>
                        <TableCell className="text-xs text-right">{r.totalQty.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right">{r.totalRM.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right">{r.count}</TableCell>
                        <TableCell className="text-xs text-right">{r.avg}</TableCell>
                        <TableCell className="text-xs">{r.lastDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Sejarah Import
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarikh</TableHead>
                <TableHead>Diupload Oleh</TableHead>
                <TableHead className="text-center">Bil. Fail</TableHead>
                <TableHead className="text-center">Berjaya</TableHead>
                <TableHead className="text-center">Ralat</TableHead>
                <TableHead>Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockImportHistory.map((row) => (
                <Collapsible key={row.id} open={expandedImport === row.id} onOpenChange={(open) => setExpandedImport(open ? row.id : null)} asChild>
                  <>
                    <TableRow>
                      <TableCell className="font-medium">{row.tarikh}</TableCell>
                      <TableCell>{row.oleh}</TableCell>
                      <TableCell className="text-center">{row.fail}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle2 className="mr-1 h-3 w-3" />{row.berjaya}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {row.ralat > 0 ? (
                          <Badge variant="destructive">
                            <AlertCircle className="mr-1 h-3 w-3" />{row.ralat}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              <Eye className="mr-1 h-3 w-3" />
                              {expandedImport === row.id ? "Tutup" : "Butiran"}
                            </Button>
                          </CollapsibleTrigger>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => toast({ title: "Akan datang", description: "Ciri rollback sedang dalam pembangunan." })}>
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Rollback
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <tr>
                        <td colSpan={6} className="p-0">
                          <div className="bg-muted/50 px-8 py-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Ubat</TableHead>
                                  <TableHead className="text-xs text-right">Kuantiti</TableHead>
                                  <TableHead className="text-xs">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {row.details.map((d, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="text-xs">{d.drug}</TableCell>
                                    <TableCell className="text-xs text-right">{d.qty}</TableCell>
                                    <TableCell className="text-xs">
                                      {d.status === "Berjaya" ? (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">{d.status}</Badge>
                                      ) : (
                                        <Badge variant="destructive" className="text-xs">{d.status}</Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </td>
                      </tr>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
