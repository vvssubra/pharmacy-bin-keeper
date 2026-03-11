
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Plus, Search, Pencil, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DrugFormDialog } from "@/components/DrugFormDialog";

type Drug = {
  id: string;
  drug_name: string;
  no_kod: string;
  unit_pengukuran: string;
  kumpulan: string;
  pergerakan: string;
  gudang_seksyen: string;
  baris: string;
  rak: string;
  tingkat: string;
  petak: string;
  kod_lokasi_penuh: string;
  stok_min: number;
  stok_reorder: number;
  stok_max: number;
  is_active: boolean;
};

export default function DrugMaster() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editDrug, setEditDrug] = useState<Drug | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Drug | null>(null);
  const queryClient = useQueryClient();

  const { data: drugs = [], isLoading } = useQuery({
    queryKey: ["drugs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drugs")
        .select("*")
        .order("drug_name");
      if (error) throw error;
      return data as Drug[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("drugs").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drugs"] });
      toast.success("Status dikemaskini");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = drugs.filter((d) =>
    d.drug_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (drug: Drug) => {
    setEditDrug(drug);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditDrug(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Drug Master</h1>
          <p className="text-sm text-muted-foreground">Senarai ubat yang dipantau (KEW.PS-3)</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-1 h-4 w-4" /> Tambah Ubat
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari ubat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drug Name</TableHead>
                <TableHead>No. Kod</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Kumpulan</TableHead>
                <TableHead>Storage Location</TableHead>
                <TableHead>Paras Stok</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Memuatkan...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="mb-2 h-8 w-8" />
                      <p className="text-sm">
                        {search ? "Tiada ubat ditemui." : "Klik 'Tambah Ubat' untuk mula."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((drug) => (
                  <TableRow key={drug.id} className={drug.is_active ? "" : "opacity-50"}>
                    <TableCell className="font-medium">{drug.drug_name}</TableCell>
                    <TableCell>{drug.no_kod}</TableCell>
                    <TableCell className="capitalize">{drug.unit_pengukuran}</TableCell>
                    <TableCell>{drug.kumpulan}</TableCell>
                    <TableCell className="text-xs">{drug.kod_lokasi_penuh}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {drug.stok_min} / {drug.stok_reorder} / {drug.stok_max}
                    </TableCell>
                    <TableCell>
                      <Badge variant={drug.is_active ? "default" : "secondary"}>
                        {drug.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(drug)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            drug.is_active
                              ? setDeactivateTarget(drug)
                              : toggleMutation.mutate({ id: drug.id, is_active: true })
                          }
                        >
                          {drug.is_active ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <DrugFormDialog open={formOpen} onOpenChange={setFormOpen} drug={editDrug} />

      {/* Deactivate Confirmation */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nyahaktif ubat ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Ubat <strong>{deactivateTarget?.drug_name}</strong> akan dinyahaktifkan. Ia masih boleh diaktifkan semula.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivateTarget) {
                  toggleMutation.mutate({ id: deactivateTarget.id, is_active: false });
                  setDeactivateTarget(null);
                }
              }}
            >
              Nyahaktif
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
