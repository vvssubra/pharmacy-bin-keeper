# Phase 1 — Drug Quota Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an annual patient quota system for controlled drugs and a tablet stock forecast for non-controlled drugs, displayed on FMS and MO dashboards.

**Architecture:** New `drug_quotas` DB table stores admin-set annual quotas per controlled drug. Quota usage (patients served YTD) is computed at read-time by counting fulfilled dispensing requests — no stored counter that can drift. Non-controlled drug forecast is pure math on the existing `transactions` ledger. All logic is client-side SQL queries via React Query; no Edge Functions in this phase.

**Tech Stack:** React 18 + TypeScript, TanStack React Query, Supabase PostgREST, shadcn/ui, Vitest + React Testing Library

---

## Chunk 1: Database Migration

### Task 1: Create drug_quotas table + RLS

**Files:**
- Create: `supabase/migrations/20260317_drug_quotas.sql`

> **Context:** Supabase uses PostgreSQL. Migrations in this project live in `supabase/migrations/`. RLS (Row Level Security) is enabled on all tables. Roles are stored in `public.user_roles` as text values: `admin`, `fms`, `mo`, `pharmacist`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260317_drug_quotas.sql
-- Annual patient quota per controlled drug, set by Admin

CREATE TABLE public.drug_quotas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id    uuid NOT NULL REFERENCES public.drugs(id) ON DELETE CASCADE,
  year       integer NOT NULL CHECK (year >= 2024),
  quota_limit integer NOT NULL CHECK (quota_limit >= 0),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(drug_id, year)
);

-- RLS: enable and define policies
ALTER TABLE public.drug_quotas ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read quotas (needed by MO to see remaining)
CREATE POLICY "Authenticated users can read drug_quotas"
  ON public.drug_quotas FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert/update/delete quotas
CREATE POLICY "Admin can insert drug_quotas"
  ON public.drug_quotas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admin can update drug_quotas"
  ON public.drug_quotas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admin can delete drug_quotas"
  ON public.drug_quotas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
```

- [ ] **Step 2: Apply via Supabase MCP or dashboard**

Apply using the Supabase MCP `apply_migration` tool, or paste into the Supabase SQL editor. Confirm the `drug_quotas` table appears in the Table Editor with the `UNIQUE(drug_id, year)` constraint.

- [ ] **Step 3: Regenerate Supabase TypeScript types**

After the migration is applied, regenerate types so `drug_quotas` is fully typed (removes the need for `as any` casts in later steps):

```bash
# Using Supabase MCP generate_typescript_types tool, OR:
npx supabase gen types typescript --project-id <your-project-id> \
  > src/integrations/supabase/types.ts
```

Verify the generated file contains `drug_quotas` in the `Tables` union. Commit the updated types file together with the migration.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260317_drug_quotas.sql src/integrations/supabase/types.ts
git commit -m "feat(db): add drug_quotas table with RLS policies + regenerate types"
```

---

## Chunk 2: Quota Management UI in DrugMaster

### Task 2: DrugQuotaDialog component

**Files:**
- Create: `src/components/DrugQuotaDialog.tsx`

> **Context:** DrugMaster (`src/pages/DrugMaster.tsx`) already has `DrugFormDialog` and `OpeningBalanceDialog` as modal patterns — follow the same pattern. shadcn/ui Dialog is used. Admin check in DrugMaster currently reads `role === "pharmacist"` (existing bug, do not change it — just pass `isAdmin` prop correctly). The new quota button should only render when `role === "admin"`.

- [ ] **Step 1: Write test first**

Create `src/components/DrugQuotaDialog.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DrugQuotaDialog from "./DrugQuotaDialog";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({ data: { quota_limit: 60 }, error: null })
            ),
          })),
        })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("DrugQuotaDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders dialog title when open", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <DrugQuotaDialog
          open={true}
          onOpenChange={vi.fn()}
          drugId="drug-1"
          drugName="Morphine"
        />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Annual Quota — Morphine/i)).toBeInTheDocument();
  });

  it("renders quota input field", () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <DrugQuotaDialog
          open={true}
          onOpenChange={vi.fn()}
          drugId="drug-1"
          drugName="Morphine"
        />
      </QueryClientProvider>
    );
    expect(screen.getByLabelText(/Annual Patient Quota/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/components/DrugQuotaDialog.test.tsx
```

Expected: FAIL — `DrugQuotaDialog` not found.

- [ ] **Step 3: Implement DrugQuotaDialog**

```typescript
// src/components/DrugQuotaDialog.tsx
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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

  // Fetch existing quota for this drug + current year
  const { data: existing } = useQuery({
    queryKey: ["drug-quota", drugId, currentYear],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("drug_quotas" as any)
        .select("quota_limit")
        .eq("drug_id", drugId)
        .eq("year", currentYear)
        .maybeSingle();
      return data as { quota_limit: number } | null;
    },
  });

  useEffect(() => {
    if (existing) {
      setQuotaInput(String(existing.quota_limit));
    } else {
      setQuotaInput("");
    }
  }, [existing, open]);

  const save = useMutation({
    mutationFn: async () => {
      const limit = parseInt(quotaInput, 10);
      if (isNaN(limit) || limit < 0) throw new Error("Invalid quota value");
      const { error } = await (supabase
        .from("drug_quotas" as any) as any)
        .upsert(
          { drug_id: drugId, year: currentYear, quota_limit: limit },
          { onConflict: "drug_id,year" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drug-quota"] });
      queryClient.invalidateQueries({ queryKey: ["fms-drug-stock"] });
      queryClient.invalidateQueries({ queryKey: ["mo-drug-quota"] });
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
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || quotaInput === ""}
          >
            {save.isPending ? "Saving..." : "Save Quota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/components/DrugQuotaDialog.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 5: Add quota button to DrugMaster**

In `src/pages/DrugMaster.tsx`:

**5a.** Add import at top of file:
```typescript
import DrugQuotaDialog from "@/components/DrugQuotaDialog";
```

**5b.** Add state for the quota dialog (after the existing state declarations, around line 55):
```typescript
const [quotaTarget, setQuotaTarget] = useState<Drug | null>(null);
```

**5c.** Add the dialog at the bottom of the JSX (just before the closing `</div>` of the return):
```tsx
<DrugQuotaDialog
  open={!!quotaTarget}
  onOpenChange={open => { if (!open) setQuotaTarget(null); }}
  drugId={quotaTarget?.id ?? ""}
  drugName={quotaTarget?.drug_name ?? ""}
/>
```

**5d.** Add `perlu_kelulusan_pakar: boolean;` to the `Drug` type (lines 24–41 of DrugMaster.tsx). This field is NOT currently in the type — it must be added or the quota button will cause a TypeScript error:

```typescript
type Drug = {
  // ... existing fields ...
  perlu_kelulusan_pakar: boolean;  // ADD THIS LINE
};
```

The existing `select("*")` query already fetches this field from the DB, so no query change is needed.

**5e.** Add `CalendarRange` to the lucide-react import at the top of DrugMaster.tsx (do NOT use `BookOpen` — it is already used for the "View Ledger" action on the same row, which would create two identical icons side by side).

**5f.** In the drug table action buttons area, add a "Set Quota" button that only appears for controlled drugs when role is admin. Find the row action buttons (near the Pencil/Ban/RotateCcw buttons) and add:
```tsx
{role === "admin" && d.perlu_kelulusan_pakar && (
  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7"
    title="Set Annual Quota"
    onClick={() => setQuotaTarget(d)}
  >
    <CalendarRange className="h-3.5 w-3.5" />
  </Button>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/DrugQuotaDialog.tsx src/components/DrugQuotaDialog.test.tsx src/pages/DrugMaster.tsx
git commit -m "feat(phase1): add quota management dialog + DrugMaster button"
```

---

## Chunk 3: FMS Dashboard — Quota & Forecast Sections

### Task 3: Controlled drug quota table on FmsDashboard

**Files:**
- Modify: `src/pages/FmsDashboard.tsx`
- Create: `src/pages/FmsDashboard.test.tsx`

> **Context:** `FmsDashboard` already fetches all drugs + transactions for the existing stock table. We need to add two new sections below the existing "Drug Stock Quota" card:
> 1. **Controlled Drug Annual Quota** — shows annual quota, patients served YTD, remaining, projected exhaustion for `perlu_kelulusan_pakar = true` drugs
> 2. **Non-Controlled Stock Forecast** — shows days remaining, reorder date for `perlu_kelulusan_pakar = false` drugs
>
> `patients_served_ytd` = count of fulfilled `dispensing_requests` for that drug where `created_at` is in the current calendar year.
>
> `avg_daily_usage` = SUM of `keluaran` transactions in last 30 days ÷ 30.

- [ ] **Step 1: Write tests first**

Create `src/pages/FmsDashboard.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FmsDashboard from "./FmsDashboard";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            gte: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ role: "fms", profile: null, user: null, loading: false })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderFms() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={makeQC()}>
        <FmsDashboard />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("FmsDashboard sections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders 'Controlled Drug Annual Quota' section heading", () => {
    renderFms();
    expect(screen.getByText(/Controlled Drug Annual Quota/i)).toBeInTheDocument();
  });

  it("renders 'Non-Controlled Stock Forecast' section heading", () => {
    renderFms();
    expect(screen.getByText(/Non-Controlled Stock Forecast/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/pages/FmsDashboard.test.tsx
```

Expected: FAIL — headings not present.

- [ ] **Step 3: Add quota query to FmsDashboard**

In `src/pages/FmsDashboard.tsx`, add a new React Query block after the `usageData` query:

```typescript
const currentYear = new Date().getFullYear();

// Controlled drug quotas
const { data: drugQuotas = [] } = useQuery({
  queryKey: ["fms-drug-quotas", currentYear],
  queryFn: async () => {
    const { data } = await supabase
      .from("drug_quotas" as any)
      .select("drug_id, quota_limit")
      .eq("year", currentYear);
    return (data ?? []) as { drug_id: string; quota_limit: number }[];
  },
});

// Patients served YTD per controlled drug (count of fulfilled dispensing_requests)
const { data: ytdCounts = [] } = useQuery({
  queryKey: ["fms-ytd-counts", currentYear],
  refetchInterval: 30000,
  queryFn: async () => {
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear + 1}-01-01`; // upper bound prevents future-dated rows skewing count
    const { data } = await supabase
      .from("dispensing_requests")
      .select("drug_id")
      .eq("status", "fulfilled")
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd);
    // Group by drug_id
    const counts: Record<string, number> = {};
    for (const r of data ?? []) {
      counts[r.drug_id] = (counts[r.drug_id] ?? 0) + 1;
    }
    return counts;
  },
});

// 30-day keluaran totals for forecast
const { data: usage30 = [] } = useQuery({
  queryKey: ["fms-usage-30"],
  refetchInterval: 30000,
  queryFn: async () => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data } = await supabase
      .from("transactions")
      .select("drug_id, kuantiti")
      .eq("jenis", "keluaran")
      .gte("created_at", since.toISOString());
    const totals: Record<string, number> = {};
    for (const t of data ?? []) {
      totals[t.drug_id] = (totals[t.drug_id] ?? 0) + t.kuantiti;
    }
    return totals;
  },
});
```

- [ ] **Step 4: Add quota display helpers + unit tests**

First create a dedicated test file for the pure helpers:

Create `src/lib/quotaHelpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { quotaStatus, forecastStatus, projectedExhaustion, daysRemaining } from "./quotaHelpers";

describe("quotaStatus", () => {
  it("returns 'no-quota' when quota row does not exist (null quota)", () => {
    expect(quotaStatus(null, null)).toBe("no-quota");
  });
  it("returns 'critical' when quota_limit is 0 (exhausted)", () => {
    expect(quotaStatus(0, 0)).toBe("critical");
  });
  it("returns 'critical' when ≤10% remaining", () => {
    expect(quotaStatus(5, 60)).toBe("critical");   // 8.3%
  });
  it("returns 'warning' when ≤25% remaining", () => {
    expect(quotaStatus(12, 60)).toBe("warning");   // 20%
  });
  it("returns 'healthy' when >25% remaining", () => {
    expect(quotaStatus(20, 60)).toBe("healthy");   // 33%
  });
});

describe("forecastStatus", () => {
  it("returns 'no-data' when days is null (no usage data)", () => {
    expect(forecastStatus(null)).toBe("no-data");
  });
  it("returns 'critical' when <7 days", () => {
    expect(forecastStatus(6)).toBe("critical");
  });
  it("returns 'warning' when <14 days", () => {
    expect(forecastStatus(10)).toBe("warning");
  });
  it("returns 'healthy' when ≥14 days", () => {
    expect(forecastStatus(14)).toBe("healthy");
  });
});

describe("daysRemaining", () => {
  it("returns null when avgDaily is 0", () => {
    expect(daysRemaining(100, 0)).toBeNull();
  });
  it("returns floor of stock / avgDaily", () => {
    expect(daysRemaining(100, 10)).toBe(10);
  });
});

describe("projectedExhaustion", () => {
  it("returns 'Exhausted' when remaining ≤ 0", () => {
    expect(projectedExhaustion(0, 5)).toBe("Exhausted");
  });
  it("returns 'No usage data' when avgPerMonth is 0", () => {
    expect(projectedExhaustion(10, 0)).toBe("No usage data");
  });
});
```

Run tests to confirm they fail:
```bash
npx vitest run src/lib/quotaHelpers.test.ts
```
Expected: FAIL — module not found.

Now create `src/lib/quotaHelpers.ts`:

```typescript
// src/lib/quotaHelpers.ts
// Pure helper functions for drug quota and stock forecast calculations.
// All functions are side-effect free and unit-testable.

/**
 * Quota status for controlled drugs.
 * - quota_limit=null means no quota row exists → "no-quota" (Warning in UI)
 * - quota_limit=0 means quota is explicitly set to 0 (exhausted) → "critical"
 * - ≤10% remaining → "critical"; ≤25% → "warning"; else → "healthy"
 */
export function quotaStatus(
  remaining: number | null,
  total: number | null,
): "critical" | "warning" | "healthy" | "no-quota" {
  if (total === null || remaining === null) return "no-quota"; // no quota row
  if (total === 0) return "critical"; // quota_limit explicitly set to 0
  const pct = remaining / total;
  if (pct <= 0.1) return "critical";
  if (pct <= 0.25) return "warning";
  return "healthy";
}

/**
 * Forecast status for non-controlled drugs.
 * - null (no usage data in last 30d) → "no-data" (neutral — not alarming)
 * - <7 days → "critical"; <14 → "warning"; ≥14 → "healthy"
 */
export function forecastStatus(days: number | null): "critical" | "warning" | "healthy" | "no-data" {
  if (days === null) return "no-data";
  if (days < 7) return "critical";
  if (days < 14) return "warning";
  return "healthy";
}

/** Returns null when avgDaily is 0 (no dispensing in last 30d). */
export function daysRemaining(stock: number, avgDaily: number): number | null {
  if (avgDaily === 0) return null;
  return Math.floor(stock / avgDaily);
}

export function projectedExhaustion(remaining: number, avgPerMonth: number): string {
  if (remaining <= 0) return "Exhausted";
  if (avgPerMonth === 0) return "No usage data";
  const monthsLeft = remaining / avgPerMonth;
  const date = new Date();
  date.setDate(date.getDate() + Math.ceil(monthsLeft * 30));
  return date.toLocaleDateString("en-MY", { month: "short", year: "numeric" });
}
```

Run tests to confirm they pass:
```bash
npx vitest run src/lib/quotaHelpers.test.ts
```
Expected: PASS (all tests).

Import and use these helpers in FmsDashboard.tsx (add at top of file):
```typescript
import { quotaStatus, forecastStatus, daysRemaining, projectedExhaustion } from "@/lib/quotaHelpers";
```

Remove the inline helper functions from FmsDashboard.tsx if you had previously added them — use the imported ones instead.

Update the STATUS_BADGE map to handle the new states:
```typescript
const FORECAST_STATUS_BADGE: Record<string, string> = {
  critical:  "bg-red-100 text-red-700 border-red-300",
  warning:   "bg-amber-100 text-amber-700 border-amber-300",
  healthy:   "bg-green-100 text-green-700 border-green-300",
  "no-data": "",  // no badge — render text only
};
```

- [ ] **Step 5: Add the two new sections to JSX**

Add these two Card sections at the end of the FmsDashboard JSX, before the closing `</div>`:

```tsx
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
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                No controlled drugs found
              </TableCell>
            </TableRow>
          ) : drugStock
              .filter(d => (d as any).perlu_kelulusan_pakar)
              .map(d => {
                const quotaRow = drugQuotas.find(q => q.drug_id === d.id);
                // null quota means no row exists (no quota set); 0 means explicitly exhausted
                const quota = quotaRow ? quotaRow.quota_limit : null;
                const served = ytdCounts[d.id] ?? 0;
                const remaining = quota !== null ? quota - served : null;
                // avg patients per month = served / months elapsed this year
                const monthsElapsed = new Date().getMonth() + 1;
                const avgPerMonth = monthsElapsed > 0 ? served / monthsElapsed : 0;
                const status = quotaStatus(remaining, quota);
                const badgeClass: Record<string, string> = {
                  critical:  "bg-red-100 text-red-700 border-red-300",
                  warning:   "bg-amber-100 text-amber-700 border-amber-300",
                  healthy:   "bg-green-100 text-green-700 border-green-300",
                  "no-quota":"bg-gray-100 text-gray-600 border-gray-300",
                };
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-sm">{d.drug_name}</TableCell>
                    <TableCell className="text-right text-sm">{quota ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{served}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {remaining !== null ? remaining : "—"}
                    </TableCell>
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
          {drugStock
            .filter(d => !(d as any).perlu_kelulusan_pakar)
            .map(d => {
              const avgDaily = (usage30[d.id] ?? 0) / 30;
              const days = daysRemaining(d.current_stock, avgDaily);
              const fStatus = forecastStatus(days);
              const reorderDate = days !== null && days > 0
                ? (() => { const dt = new Date(); dt.setDate(dt.getDate() + days - 7); return dt.toLocaleDateString("en-MY", { day: "numeric", month: "short" }); })()
                : "—";
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-sm">{d.drug_name}</TableCell>
                  <TableCell className="text-right text-sm">{d.current_stock} <span className="text-xs text-muted-foreground">{d.unit_pengukuran}</span></TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {avgDaily > 0 ? avgDaily.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm">
                    {days !== null ? days : <span className="text-muted-foreground text-xs">No usage data</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{reorderDate}</TableCell>
                  <TableCell>
                    {fStatus === "no-data" ? (
                      <span className="text-xs text-muted-foreground">No usage data</span>
                    ) : (
                      <Badge variant="outline" className={`text-[10px] capitalize ${FORECAST_STATUS_BADGE[fStatus]}`}>
                        {fStatus}
                      </Badge>
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
```

Also add `ShieldCheck` to the lucide-react import at the top of FmsDashboard.tsx.

Also update the `fms-drug-stock` queryFn to include `perlu_kelulusan_pakar` in the select:
```typescript
supabase
  .from("drugs")
  .select("id, drug_name, unit_pengukuran, stok_min, stok_reorder, stok_max, perlu_kelulusan_pakar")
  .eq("is_active", true)
  .order("drug_name"),
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npx vitest run src/pages/FmsDashboard.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/pages/FmsDashboard.tsx src/pages/FmsDashboard.test.tsx
git commit -m "feat(phase1): add controlled quota + stock forecast sections to FMS dashboard"
```

---

## Chunk 4: MO Dashboard — Quota Column

### Task 4: Add quota remaining to MO drug table

**Files:**
- Modify: `src/pages/MoDashboard.tsx`
- Create: `src/pages/MoDashboard.test.tsx`

> **Context:** MO Dashboard already fetches all active drugs. We need to add two new queries: drug_quotas for the current year + YTD served counts. The drug table should show a "Quota Remaining" column only visible for controlled drugs (`perlu_kelulusan_pakar = true`).

- [ ] **Step 1: Write test first**

Create `src/pages/MoDashboard.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MoDashboard from "./MoDashboard";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "mo-1" },
    role: "mo",
    profile: { full_name: "Dr. Azman" },
    loading: false,
  })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("MoDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders 'Quota Remaining' column header", () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={makeQC()}>
          <MoDashboard />
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/Quota Remaining/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/pages/MoDashboard.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Add quota queries + column to MoDashboard**

In `src/pages/MoDashboard.tsx`:

**3a.** Add quota queries after the existing `drugStock` query:

```typescript
const currentYear = new Date().getFullYear();

const { data: drugQuotas = [] } = useQuery({
  queryKey: ["mo-drug-quotas", currentYear],
  queryFn: async () => {
    const { data } = await supabase
      .from("drug_quotas" as any)
      .select("drug_id, quota_limit")
      .eq("year", currentYear);
    return (data ?? []) as { drug_id: string; quota_limit: number }[];
  },
});

const { data: ytdCounts = {} } = useQuery({
  queryKey: ["mo-ytd-counts", currentYear],
  refetchInterval: 30000,
  queryFn: async () => {
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear + 1}-01-01`; // upper bound to exclude future-dated rows
    const { data } = await supabase
      .from("dispensing_requests")
      .select("drug_id")
      .eq("status", "fulfilled")
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd);
    const counts: Record<string, number> = {};
    for (const r of data ?? []) counts[r.drug_id] = (counts[r.drug_id] ?? 0) + 1;
    return counts;
  },
});
```

**3b.** Add a `Quota Remaining` column header to the table:
```tsx
<TableHead>Quota Remaining</TableHead>
```
(Add after the `Requires Approval` head)

**3c.** Add the cell in the table body:
```tsx
<TableCell>
  {d.perlu_kelulusan_pakar ? (() => {
    const quotaRow = drugQuotas.find(q => q.drug_id === d.id);
    if (!quotaRow) return <Badge variant="outline" className="text-[10px] text-muted-foreground">No quota set</Badge>;
    const remaining = quotaRow.quota_limit - (ytdCounts[d.id] ?? 0);
    const pct = quotaRow.quota_limit > 0 ? remaining / quotaRow.quota_limit : 0;
    const cls = pct <= 0.1 ? "bg-red-100 text-red-700 border-red-300"
               : pct <= 0.25 ? "bg-amber-100 text-amber-700 border-amber-300"
               : "bg-green-100 text-green-700 border-green-300";
    return <Badge variant="outline" className={`text-[10px] ${cls}`}>{remaining} / {quotaRow.quota_limit}</Badge>;
  })() : <span className="text-xs text-muted-foreground">—</span>}
</TableCell>
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/pages/MoDashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MoDashboard.tsx src/pages/MoDashboard.test.tsx
git commit -m "feat(phase1): add quota remaining column to MO dashboard drug table"
```

---

## Chunk 5: Smoke Test & Final Commit

- [ ] **Step 1: Manual smoke test**

1. Log in as admin. Go to `/drugs`. Find a controlled drug (Requires Specialist Approval = true). Click the quota icon. Set annual quota = 60. Save. Confirm toast "Quota saved."
2. Go to `/fms`. Scroll to "Controlled Drug Annual Quota" section. Confirm the drug appears with quota 60, served count, remaining count.
3. Go to `/mo`. Confirm the "Quota Remaining" column shows the correct badge for the same drug.
4. Log in as fms. Confirm quota sections are visible but quota management button is absent.
5. Log in as mo. Confirm only the MO dashboard is accessible and quota column shows.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: Completes with no TypeScript errors.

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat(phase1): complete drug quota dashboard — Phase 1 done"
```
