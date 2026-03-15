
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OpeningBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drug: { id: string; drug_name: string; unit_pengukuran: string } | null;
  existing: { id: string; kuantiti: number; tarikh: string } | null;
}

export function OpeningBalanceDialog({ open, onOpenChange, drug, existing }: OpeningBalanceDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tarikh, setTarikh] = useState<Date | undefined>(
    existing ? new Date(existing.tarikh) : undefined
  );
  const [kuantiti, setKuantiti] = useState(existing?.kuantiti?.toString() ?? "");
  const [showEditWarning, setShowEditWarning] = useState(false);

  // Reset form when dialog opens with new data
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setTarikh(existing ? new Date(existing.tarikh) : undefined);
      setKuantiti(existing?.kuantiti?.toString() ?? "");
    }
    onOpenChange(o);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!drug || !tarikh || !kuantiti) return;
      const payload = {
        drug_id: drug.id,
        jenis: "baki_awal" as const,
        kuantiti: parseInt(kuantiti),
        tarikh: format(tarikh, "yyyy-MM-dd"),
        created_by: user?.id,
      };

      if (existing) {
        const { error } = await supabase
          .from("transactions")
          .update({ kuantiti: payload.kuantiti, tarikh: payload.tarikh })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions-baki-awal"] });
      toast.success("Opening balance saved");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!tarikh || !kuantiti) {
      toast.error("Please complete all fields");
      return;
    }
    if (existing) {
      setShowEditWarning(true);
    } else {
      mutation.mutate();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Opening Balance — {drug?.drug_name}</DialogTitle>
            <DialogDescription>
              Enter the current stock quantity on the selected date. This will be the starting point for stock movement records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="opening-balance-date">Opening Balance Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="opening-balance-date"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !tarikh && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tarikh ? format(tarikh, "dd/MM/yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tarikh}
                    onSelect={setTarikh}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening-balance-qty">Quantity on that date</Label>
              <Input
                id="opening-balance-qty"
                type="number"
                min={0}
                placeholder="0"
                value={kuantiti}
                onChange={(e) => setKuantiti(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showEditWarning} onOpenChange={setShowEditWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change opening balance?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the opening balance will recalculate all balances. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowEditWarning(false); mutation.mutate(); }}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
