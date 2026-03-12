import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, CheckCircle, AlertCircle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  patient_name: z.string().min(1, "Nama pesakit diperlukan"),
  no_ic: z.string().min(14, "No. IC tidak lengkap"),
  drug_id: z.string().min(1, "Sila pilih ubat"),
  quantity: z.coerce.number().int().min(1, "Kuantiti mestilah sekurang-kurangnya 1"),
  prescriber_name: z.string().min(1, "Nama doktor diperlukan"),
});

type FormValues = z.infer<typeof formSchema>;

function formatIC(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

export default function DoctorRequest() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [drugPopoverOpen, setDrugPopoverOpen] = useState(false);
  const [submitted, setSubmitted] = useState<FormValues & { drug_name: string; is_specialist: boolean; status: string } | null>(null);

  // Fetch active drugs with baki awal
  const { data: drugs = [] } = useQuery({
    queryKey: ["drugs-for-request"],
    queryFn: async () => {
      const { data: drugList, error: drugError } = await supabase
        .from("drugs")
        .select("id, drug_name, unit_pengukuran, perlu_kelulusan_pakar")
        .eq("is_active", true)
        .order("drug_name");
      if (drugError) throw drugError;

      // Get baki awal to filter only drugs with opening balance
      const { data: bakiData } = await supabase
        .from("transactions")
        .select("drug_id")
        .eq("jenis", "baki_awal");

      const bakiSet = new Set((bakiData ?? []).map(b => b.drug_id));
      return (drugList ?? []).filter(d => bakiSet.has(d.id));
    },
  });

  // Compute current stock for selected drug
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_name: "",
      no_ic: "",
      drug_id: "",
      quantity: 0,
      prescriber_name: profile?.full_name || "",
    },
  });

  const watchDrugId = form.watch("drug_id");
  const watchQty = form.watch("quantity");
  const selectedDrug = useMemo(() => drugs.find(d => d.id === watchDrugId), [drugs, watchDrugId]);

  const { data: currentStock } = useQuery({
    queryKey: ["drug-stock", watchDrugId],
    enabled: !!watchDrugId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("jenis, kuantiti")
        .eq("drug_id", watchDrugId);
      if (error) throw error;
      let baki = 0;
      for (const tx of data || []) {
        if (tx.jenis === "terimaan" || tx.jenis === "baki_awal") baki += tx.kuantiti;
        else if (tx.jenis === "keluaran") baki -= tx.kuantiti;
      }
      return baki;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const drug = drugs.find(d => d.id === values.drug_id);
      const status = drug?.perlu_kelulusan_pakar ? "pending_specialist" : "pending_pharmacy";
      const { error } = await supabase.from("dispensing_requests").insert({
        drug_id: values.drug_id,
        patient_name: values.patient_name,
        no_ic: values.no_ic,
        quantity: values.quantity,
        prescriber_name: values.prescriber_name,
        status,
        submitted_by: user?.id,
      });
      if (error) throw error;
      return { status, drug_name: drug?.drug_name || "", is_specialist: drug?.perlu_kelulusan_pakar || false };
    },
    onSuccess: (result, values) => {
      setSubmitted({ ...values, ...result });
      queryClient.invalidateQueries({ queryKey: ["drug-stock"] });
    },
    onError: () => toast.error("Gagal menghantar permintaan"),
  });

  const onSubmit = (values: FormValues) => submitMutation.mutate(values);

  const stockExceeded = currentStock !== undefined && watchQty > currentStock;

  if (submitted) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="space-y-6 py-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Permintaan Berjaya Dihantar!</h2>
            <div className="rounded-lg border p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Pesakit</span><span className="font-medium">{submitted.patient_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">IC</span><span className="font-medium">{submitted.no_ic}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ubat</span><span className="font-medium">{submitted.drug_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Kuantiti</span><span className="font-medium">{submitted.quantity}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                {submitted.is_specialist ? (
                  <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Menunggu kelulusan pakar</Badge>
                ) : (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-300">Menunggu pengesahan farmasis</Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => { setSubmitted(null); form.reset({ patient_name: "", no_ic: "", drug_id: "", quantity: 0, prescriber_name: profile?.full_name || "" }); }}>
                Hantar Permintaan Baharu
              </Button>
              <Button variant="link" onClick={() => { setSubmitted(null); form.reset({ ...form.getValues(), drug_id: "", quantity: 0 }); }}>
                Tukar Ubat Sahaja
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-[600px]">
        <CardHeader>
          <CardTitle>Permintaan Pengeluaran Ubat</CardTitle>
          <CardDescription>Isi maklumat pesakit dan ubat yang diperlukan</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="patient_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Pesakit *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nama penuh pesakit"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="no_ic" render={({ field }) => (
                <FormItem>
                  <FormLabel>No. IC Pesakit *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="000000-00-0000"
                      inputMode="numeric"
                      {...field}
                      onChange={(e) => field.onChange(formatIC(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="drug_id" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Ubat *</FormLabel>
                  <Popover open={drugPopoverOpen} onOpenChange={setDrugPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                          {field.value ? drugs.find(d => d.id === field.value)?.drug_name ?? "Pilih ubat..." : "Pilih ubat..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari ubat..." />
                        <CommandList>
                          <CommandEmpty>Tiada ubat dijumpai.</CommandEmpty>
                          <CommandGroup>
                            {drugs.map(d => (
                              <CommandItem key={d.id} value={d.drug_name} onSelect={() => { field.onChange(d.id); setDrugPopoverOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", field.value === d.id ? "opacity-100" : "opacity-0")} />
                                {d.drug_name}
                                {d.perlu_kelulusan_pakar && (
                                  <Badge className="ml-2 bg-yellow-100 text-yellow-700 border-yellow-300 text-[10px]">Perlu Kelulusan Pakar</Badge>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              {selectedDrug?.perlu_kelulusan_pakar && (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 dark:text-blue-400">
                    Ubat ini memerlukan kelulusan pakar sebelum diproses oleh farmasis.
                  </AlertDescription>
                </Alert>
              )}

              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kuantiti *</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  {selectedDrug && (
                    <p className="text-xs text-muted-foreground">
                      Unit: {selectedDrug.unit_pengukuran} · Stok semasa: {currentStock ?? "—"} {selectedDrug.unit_pengukuran}
                    </p>
                  )}
                  {stockExceeded && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Kuantiti melebihi stok semasa ({currentStock} {selectedDrug?.unit_pengukuran})
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="prescriber_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Doktor / Preskriber *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full" style={{ backgroundColor: "#1A3C6E" }} disabled={submitMutation.isPending || stockExceeded}>
                {submitMutation.isPending ? "Menghantar..." : "Hantar Permintaan"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
