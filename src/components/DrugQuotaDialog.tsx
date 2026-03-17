import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drugId: string;
  drugName: string;
}

export default function DrugQuotaDialog({ open, onOpenChange, drugId, drugName }: Props) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [quotaInput, setQuotaInput] = useState<string>("");

  const { data: existing } = useQuery({
    queryKey: ["drug-quota", drugId, currentYear],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("drug_quotas")
        .select("quota_limit")
        .eq("drug_id", drugId)
        .eq("year", currentYear)
        .maybeSingle();
      return data as { quota_limit: number } | null;
    },
  });

  useEffect(() => {
    setQuotaInput(existing ? String(existing.quota_limit) : "");
  }, [existing, open]);

  const save = useMutation({
    mutationFn: async () => {
      const limit = parseInt(quotaInput, 10);
      if (isNaN(limit) || limit < 0) throw new Error("Invalid quota value");
      const { error } = await supabase
        .from("drug_quotas")
        .upsert({ drug_id: drugId, year: currentYear, quota_limit: limit }, { onConflict: "drug_id,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drug-quota"] });
      queryClient.invalidateQueries({ queryKey: ["fms-drug-quotas"] });
      queryClient.invalidateQueries({ queryKey: ["mo-drug-quotas"] });
      toast.success("Quota saved.");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to save quota."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Annual Quota — {drugName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Set the maximum number of patients that may receive this controlled drug in {currentYear}.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="quota-input">Annual Patient Quota</Label>
            <Input
              id="quota-input"
              type="number"
              min={0}
              value={quotaInput}
              onChange={e => setQuotaInput(e.target.value)}
              placeholder="e.g. 60"
            />
          </div>
          {existing && (
            <p className="text-xs text-muted-foreground">
              Current quota for {currentYear}: {existing.quota_limit} patients
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || quotaInput === ""}>
            {save.isPending ? "Saving..." : "Save Quota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
