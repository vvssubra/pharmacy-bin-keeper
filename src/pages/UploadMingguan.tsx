import { useState, useRef, useCallback } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { ms } from "date-fns/locale";
import { CloudUpload, X, ChevronDown, ChevronRight, RotateCcw, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// --- Types ---
type PreviewStatus = "sedia" | "duplikasi" | "ralat_ubat" | "ralat_baki" | "ralat_format";

interface PreviewRow {
  id: string;
  drugName: string;
  filename: string;
  transaksi: number;
  jumlahKuantiti: number;
  jumlahNilai: number;
  duplikasi: number;
  status: PreviewStatus;
  errors?: { row: number; field: string; reason: string }[];
}

interface HistoryRow {
  id: string;
  tarikhUpload: string;
  diuploadOleh: string;
  fail: number;
  transaksiBerjaya: number;
  ralat: number;
}

// --- Mock Data ---
const MOCK_PREVIEW: PreviewRow[] = [
  { id: "1", drugName: "Paracetamol 500mg Tab", filename: "paracetamol_w10.xlsx", transaksi: 142, jumlahKuantiti: 3200, jumlahNilai: 128.00, duplikasi: 0, status: "sedia" },
  { id: "2", drugName: "Amoxicillin 250mg Cap", filename: "amoxicillin_w10.xlsx", transaksi: 87, jumlahKuantiti: 1540, jumlahNilai: 215.60, duplikasi: 3, status: "duplikasi" },
  { id: "3", drugName: "Metformin 500mg Tab", filename: "metformin_w10.xlsx", transaksi: 0, jumlahKuantiti: 0, jumlahNilai: 0, duplikasi: 0, status: "ralat_ubat", errors: [{ row: 0, field: "Nama Ubat", reason: "Ubat 'Metformin 500mg' tidak dijumpai dalam Drug Master" }] },
  { id: "4", drugName: "Amlodipine 5mg Tab", filename: "amlodipine_w10.xlsx", transaksi: 0, jumlahKuantiti: 0, jumlahNilai: 0, duplikasi: 0, status: "ralat_baki", errors: [{ row: 0, field: "Baki Awal", reason: "Baki awal belum ditetapkan untuk ubat ini" }] },
  { id: "5", drugName: "—", filename: "report_corrupt.xlsx", transaksi: 0, jumlahKuantiti: 0, jumlahNilai: 0, duplikasi: 0, status: "ralat_format", errors: [{ row: 1, field: "Format", reason: "Lajur 'Tarikh' tidak dijumpai" }, { row: 2, field: "Format", reason: "Lajur 'Kuantiti' tidak dijumpai" }] },
];

const MOCK_HISTORY: HistoryRow[] = [
  { id: "h1", tarikhUpload: "2026-02-28T10:30:00", diuploadOleh: "Pn. Siti", fail: 12, transaksiBerjaya: 1024, ralat: 2 },
  { id: "h2", tarikhUpload: "2026-02-21T09:15:00", diuploadOleh: "En. Ahmad", fail: 10, transaksiBerjaya: 870, ralat: 0 },
  { id: "h3", tarikhUpload: "2026-02-14T11:00:00", diuploadOleh: "Pn. Siti", fail: 11, transaksiBerjaya: 956, ralat: 1 },
];

const STATUS_CONFIG: Record<PreviewStatus, { label: string; color: string }> = {
  sedia: { label: "Sedia", color: "bg-green-100 text-green-800 border-green-200" },
  duplikasi: { label: "Duplikasi Dilangkau", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  ralat_ubat: { label: "Ralat: Ubat Tidak Dijumpai", color: "bg-red-100 text-red-800 border-red-200" },
  ralat_baki: { label: "Ralat: Tiada Baki Awal", color: "bg-red-100 text-red-800 border-red-200" },
  ralat_format: { label: "Ralat: Format Tidak Sah", color: "bg-red-100 text-red-800 border-red-200" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isError(status: PreviewStatus) {
  return status === "ralat_ubat" || status === "ralat_baki" || status === "ralat_format";
}

export default function UploadMingguan() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // State
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<"idle" | "preview">("idle");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<HistoryRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // When entering preview, pre-check eligible rows
  const enterPreview = () => {
    const eligible = new Set(MOCK_PREVIEW.filter(r => !isError(r.status)).map(r => r.id));
    setChecked(eligible);
    setExpanded(new Set());
    setPhase("preview");
  };

  const resetAll = () => {
    setFiles([]);
    setPhase("idle");
    setChecked(new Set());
    setExpanded(new Set());
  };

  // File handling
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(f =>
      f.name.endsWith(".xls") || f.name.endsWith(".xlsx")
    );
    setFiles(prev => [...prev, ...arr]);
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  // Checkbox logic
  const eligibleRows = MOCK_PREVIEW.filter(r => !isError(r.status));
  const allChecked = eligibleRows.length > 0 && eligibleRows.every(r => checked.has(r.id));

  const toggleAll = () => {
    if (allChecked) {
      setChecked(new Set());
    } else {
      setChecked(new Set(eligibleRows.map(r => r.id)));
    }
  };

  const toggleRow = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Summary for confirm bar
  const selectedRows = MOCK_PREVIEW.filter(r => checked.has(r.id));
  const totalTransaksi = selectedRows.reduce((s, r) => s + r.transaksi, 0);

  const handleConfirm = () => {
    toast.success(`Berjaya! ${selectedRows.length} fail diimport — ${totalTransaksi} transaksi direkodkan.`);
    resetAll();
  };

  const handleRollback = () => {
    if (rollbackTarget) {
      toast.success(`${rollbackTarget.transaksiBerjaya} transaksi dari import ${format(new Date(rollbackTarget.tarikhUpload), "dd/MM/yyyy")} telah dipadamkan.`);
      setRollbackTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Upload Mingguan</h1>
        <p className="text-sm text-muted-foreground">Muat naik fail Excel keluaran stok mingguan</p>
      </div>

      <div className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
        Minggu: {format(weekStart, "dd MMM yyyy")} – {format(weekEnd, "dd MMM yyyy")}
      </div>

      {/* Section 1 — Drop Zone */}
      {phase === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Muat Naik Fail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <CloudUpload className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 text-sm font-medium text-foreground">
                Seret fail Excel ke sini atau klik untuk pilih fail
              </p>
              <p className="text-xs text-muted-foreground">
                Terima .xls dan .xlsx — pilih semua fail sekaligus (satu fail per ubat)
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".xls,.xlsx"
                className="hidden"
                onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {/* Selected files list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">{f.name}</span>
                      <span className="text-muted-foreground">{formatFileSize(f.size)}</span>
                    </div>
                    <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={enterPreview} disabled={files.length === 0}>
              Proses Fail
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Section 2 — Import Preview Table */}
      {phase === "preview" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pratonton Import</CardTitle>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {allChecked ? "Nyahpilih Semua" : "Pilih Semua"}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="w-10" />
                  <TableHead>Drug Name</TableHead>
                  <TableHead>Fail</TableHead>
                  <TableHead className="text-right">Transaksi</TableHead>
                  <TableHead className="text-right">Jml Kuantiti</TableHead>
                  <TableHead className="text-right">Jml Nilai (RM)</TableHead>
                  <TableHead className="text-right">Duplikasi</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_PREVIEW.map(row => {
                  const err = isError(row.status);
                  const cfg = STATUS_CONFIG[row.status];
                  const isExpanded = expanded.has(row.id);
                  return (
                    <>
                      <TableRow key={row.id} className={err ? "bg-destructive/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={checked.has(row.id)}
                            disabled={err}
                            onCheckedChange={() => toggleRow(row.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {row.errors && row.errors.length > 0 && (
                            <button onClick={() => toggleExpand(row.id)} className="text-muted-foreground hover:text-foreground">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.drugName}</TableCell>
                        <TableCell className="text-muted-foreground">{row.filename}</TableCell>
                        <TableCell className="text-right">{row.transaksi}</TableCell>
                        <TableCell className="text-right">{row.jumlahKuantiti.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.jumlahNilai.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.duplikasi}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && row.errors && (
                        <TableRow key={`${row.id}-errors`}>
                          <TableCell colSpan={9} className="bg-muted/30 p-0">
                            <div className="px-12 py-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-8 text-xs">Baris</TableHead>
                                    <TableHead className="h-8 text-xs">Medan</TableHead>
                                    <TableHead className="h-8 text-xs">Sebab Ralat</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {row.errors.map((err, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="py-1.5 text-xs">{err.row || "—"}</TableCell>
                                      <TableCell className="py-1.5 text-xs">{err.field}</TableCell>
                                      <TableCell className="py-1.5 text-xs text-destructive">{err.reason}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Section 3 — Confirm Bar */}
      {phase === "preview" && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{selectedRows.length} fail</span> sedia untuk import —{" "}
              <span className="font-semibold">{totalTransaksi.toLocaleString()} transaksi</span> akan direkodkan
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetAll}>Batal</Button>
              <Button onClick={handleConfirm} disabled={selectedRows.length === 0}>Sahkan Import</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4 — Import History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Sejarah Import</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarikh Upload</TableHead>
                <TableHead>Diupload Oleh</TableHead>
                <TableHead className="text-right">Fail</TableHead>
                <TableHead className="text-right">Transaksi Berjaya</TableHead>
                <TableHead className="text-right">Ralat</TableHead>
                <TableHead>Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_HISTORY.map(row => (
                <TableRow key={row.id}>
                  <TableCell>{format(new Date(row.tarikhUpload), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>{row.diuploadOleh}</TableCell>
                  <TableCell className="text-right">{row.fail}</TableCell>
                  <TableCell className="text-right">{row.transaksiBerjaya.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {row.ralat > 0 ? (
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">{row.ralat}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setRollbackTarget(row)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rollback Confirmation */}
      <AlertDialog open={!!rollbackTarget} onOpenChange={open => !open && setRollbackTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Import</AlertDialogTitle>
            <AlertDialogDescription>
              Ini akan memadamkan {rollbackTarget?.transaksiBerjaya.toLocaleString()} transaksi dari import ini. Teruskan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ya, Rollback
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
