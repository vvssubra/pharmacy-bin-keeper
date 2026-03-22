# Phase 5: Controlled Drug Approval Flow with Patient-Based Quota and Pesara Category — Research

**Researched:** 2026-03-22
**Domain:** React/TypeScript UI enhancement + Supabase schema migration (controlled drug quota flow)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pesara category definition:**
- Pesara = Malaysian government retiree (Pesara Kerajaan)
- Captured as a checkbox on the DoctorRequest form — doctor ticks "Pesara (Government Retiree)" when submitting a controlled drug request for a Pesara patient
- The `is_pesara` flag must be added to the `dispensing_requests` table
- Pesara requests go through the same specialist approval flow — no bypass, no extra approval step
- Pesara patients have unlimited quota — no quota check is performed for them
- Pesara dispensings are tracked separately from regular quota patients (separate sub-tab in SpecialistDashboard, separate counter in FmsDashboard)

**Quota enforcement point and rules:**
- Quota is enforced at specialist approval — specialist sees quota context when reviewing each pending request
- Quota counts unique patients per drug per year — each patient IC is counted once per drug per year regardless of how many times they receive it. Matches existing `drug_quotas` design ("maximum patients that may receive this drug")
- Pesara patient ICs are excluded from the regular quota count
- Quota is an indicator only — no hard block; specialist can always approve

**Quota exceeded behavior:**
- When quota is exhausted: show a clear "Quota Exhausted" warning badge on the request row and in the approval dialog — specialist can still proceed
- When approving a request that exceeds quota, a "Borrow from facility" field appears in the approval dialog — specialist enters/selects the facility name they are borrowing quota from
- The borrow facility name is saved on the specific `dispensing_request` record (new `borrowed_from_facility` column) — audit trail only, no cross-system sync or quota arithmetic
- No hard block, no auto-reject — specialist remains the decision-maker at all times

**Specialist approval view — Controlled Drug tab:**
- The existing Controlled Drug tab in SpecialistDashboard gets two sub-tabs:
  - "Regular" — non-Pesara pending requests, each row shows a quota usage badge (e.g. "45/60 patients"), amber when ≥80% used, red when at/over limit
  - "Pesara" — Pesara pending requests, no quota counter, "Unlimited" label
- Quota usage badge is visible in the pending list row (not just in the approval dialog)
- Approval dialog for over-quota requests gains a "Borrowing quota from facility" input field

**FmsDashboard quota display:**
- The drug quota table in FmsDashboard shows both counts per drug:
  - Regular: `{used}/{limit} patients` (existing, enhanced)
  - Pesara: `{pesara_count} (Unlimited)` (new column)

### Claude's Discretion
- Exact list of facility names for the borrow dropdown (hardcoded list or free-text input)
- DB migration specifics (column names beyond what's stated)
- Styling details beyond the color rules stated above
- Whether the Pesara count in FmsDashboard is a new column or a secondary line in an existing cell

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 5 is a focused enhancement to the existing controlled drug specialist approval workflow. It involves two database column additions, checkbox UI on the doctor request form, sub-tab splitting in SpecialistDashboard, quota-aware badge logic in the specialist pending list, conditional borrow-from-facility input in the approval dialog, a new quota count query that counts unique patient ICs (excluding Pesara), and a new "Pesara" column in the FmsDashboard annual quota table.

All the technology needed already exists in the codebase. The Supabase client, React Query mutation/query patterns, shadcn/ui components (Tabs, Badge, Checkbox, Alert, Input, Dialog), and quota helper utilities are all present and proven. No new libraries are required. The primary challenge is correctly computing the unique-patient quota count per drug per year (excluding Pesara ICs) and threading that count into the specialist view efficiently.

The recommended approach is to compute quota usage with a targeted Supabase query that fetches fulfilled `dispensing_requests` with `is_pesara = false` and counts distinct `no_ic` per `drug_id` for the current year. The TypeScript generated types file will need updating after the DB migration, and all query mocks in test files must be extended to handle the new columns.

**Primary recommendation:** Two-wave delivery — Wave 1 handles DB migration + DoctorRequest checkbox; Wave 2 handles SpecialistDashboard sub-tabs + quota badge + borrow field + FmsDashboard Pesara column — each wave independently verifiable.

---

## Standard Stack

### Core (all already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 18.x / 5.x | Component logic and type safety | Project baseline |
| `@tanstack/react-query` | 5.x | Server state, query/mutation, cache invalidation | All data fetching in project uses this |
| `@supabase/supabase-js` | 2.x | DB reads/writes, RLS enforcement | Project's only backend client |
| `shadcn/ui` (Radix UI) | installed | Tabs, Badge, Checkbox, Alert, Input, Dialog | All UI components sourced from here |
| `react-hook-form` + `zod` | installed | Form validation (DoctorRequest form) | Existing form pattern in DoctorRequest |
| `sonner` | installed | Toast notifications | All toasts use this |
| `lucide-react` | installed | Icons | All icons sourced from here |

**Installation:** None required. All libraries confirmed present in the codebase.

---

## Architecture Patterns

### Recommended Project Structure for Phase 5

No new files/folders required. All changes are modifications to existing files plus extension of existing test files:

```
src/
├── pages/
│   ├── DoctorRequest.tsx            # Add is_pesara checkbox + Zod field
│   ├── SpecialistDashboard.tsx      # Split Controlled Drug tab into Regular/Pesara sub-tabs; add quota badges; extend approve mutation
│   └── FmsDashboard.tsx             # Add Pesara column to annual quota table; extend ytd counts query
├── lib/
│   └── quotaHelpers.ts              # No change needed; existing functions cover badge color logic
└── integrations/supabase/
    └── types.ts                     # Update after DB migration to add is_pesara + borrowed_from_facility to dispensing_requests
```

### Pattern 1: Supabase DB Migration (new columns)

**What:** Add two nullable columns to `dispensing_requests` using a Supabase SQL migration.

**When to use:** Any time the schema needs to evolve — execute migration via Supabase Dashboard SQL editor or migration file.

**Migration SQL:**
```sql
-- Add Pesara flag (default false, not null)
ALTER TABLE dispensing_requests
  ADD COLUMN IF NOT EXISTS is_pesara boolean NOT NULL DEFAULT false;

-- Add borrow facility field (nullable — only populated when quota exceeded)
ALTER TABLE dispensing_requests
  ADD COLUMN IF NOT EXISTS borrowed_from_facility text;
```

**RLS note:** The existing RLS policy on `dispensing_requests` grants `mo` INSERT access and `fms`/`pharmacist`/`admin` SELECT+UPDATE. The new columns inherit these policies automatically — no new RLS rules required. However, the planner should verify via Supabase dashboard that the `mo` role can write `is_pesara` and `fms` can read it after migration.

### Pattern 2: Unique-patient quota count query

**What:** Count distinct `no_ic` values per drug per year for fulfilled non-Pesara requests. This is the "unique patients served" metric used to evaluate quota usage.

**When to use:** SpecialistDashboard must load this count to render quota badges; FmsDashboard must load this count to render the Regular + Pesara split.

**Confirmed approach — two separate counts via Supabase queries:**

For regular quota count (unique ICs, non-Pesara, fulfilled, current year):
```typescript
// Pattern derived from existing ytdCounts query in FmsDashboard.tsx
const yearStart = `${currentYear}-01-01`;
const yearEnd   = `${currentYear + 1}-01-01`;
const { data } = await supabase
  .from("dispensing_requests")
  .select("drug_id, no_ic")
  .eq("status", "fulfilled")
  .eq("is_pesara", false)
  .gte("created_at", yearStart)
  .lt("created_at",  yearEnd);

// Compute unique patients per drug in JS
const uniquePerDrug: Record<string, Set<string>> = {};
for (const r of data ?? []) {
  if (!uniquePerDrug[r.drug_id]) uniquePerDrug[r.drug_id] = new Set();
  uniquePerDrug[r.drug_id].add(r.no_ic);
}
const regularCounts: Record<string, number> = {};
for (const [drugId, icSet] of Object.entries(uniquePerDrug)) {
  regularCounts[drugId] = icSet.size;
}
```

For Pesara count per drug:
```typescript
const { data: pesaraData } = await supabase
  .from("dispensing_requests")
  .select("drug_id, no_ic")
  .eq("status", "fulfilled")
  .eq("is_pesara", true)
  .gte("created_at", yearStart)
  .lt("created_at",  yearEnd);

const pesaraCounts: Record<string, number> = {};
for (const r of pesaraData ?? []) {
  if (!pesaraCounts[r.drug_id]) pesaraCounts[r.drug_id] = 0;
  pesaraCounts[r.drug_id]++;
}
```

**Note:** Supabase PostgREST does not expose `COUNT(DISTINCT)` directly via the JS client without an RPC. The JS-side deduplication approach (using a `Set`) is the correct pattern here — row volume per year is bounded and acceptable.

### Pattern 3: Quota badge helper (adapts existing quotaHelpers.ts)

The existing `quotaHelpers.ts` `quotaStatus()` function uses remaining/total to derive critical/warning/healthy. Phase 5 uses a different threshold (≥80% used = amber, ≥100% = red). A dedicated badge helper should be used instead of repurposing `quotaStatus()`:

```typescript
// Source: 05-CONTEXT.md badge color specification
type QuotaBadgeState = "healthy" | "warning" | "exhausted" | "no-quota";

function quotaBadgeState(used: number, limit: number | null): QuotaBadgeState {
  if (limit === null) return "no-quota";
  if (used >= limit)         return "exhausted";
  if (used >= limit * 0.8)   return "warning";
  return "healthy";
}

const QUOTA_BADGE_CLASS: Record<QuotaBadgeState, string> = {
  healthy:   "bg-green-100 text-green-700 border-green-300",
  warning:   "bg-amber-100 text-amber-700 border-amber-300",
  exhausted: "bg-red-100 text-red-700 border-red-300",
  "no-quota": "bg-gray-100 text-gray-600 border-gray-300",
};

const QUOTA_BADGE_LABEL: Record<QuotaBadgeState, (used: number, limit: number | null) => string> = {
  healthy:    (u, l) => `${u}/${l} patients`,
  warning:    (u, l) => `${u}/${l} patients`,
  exhausted:  (u, l) => `Quota Exhausted: ${u}/${l}`,
  "no-quota": () => "No quota set",
};
```

### Pattern 4: Extend approveMutation to include borrowed_from_facility

**Current approve mutation payload:**
```typescript
{ status: "pending_pharmacy", specialist_id: user?.id, specialist_action_at: new Date().toISOString(), specialist_notes: notes || null }
```

**Extended payload (add borrowed_from_facility):**
```typescript
{
  status: "pending_pharmacy",
  specialist_id: user?.id,
  specialist_action_at: new Date().toISOString(),
  specialist_notes: notes || null,
  borrowed_from_facility: borrowFacility || null,   // only populated when quota exhausted
}
```

The `borrowFacility` state variable is only required when `quotaBadgeState(used, limit) === "exhausted"`. The approve button should be disabled until the field is filled in that case.

### Pattern 5: React Hook Form + Zod — adding is_pesara to DoctorRequest

The existing `formSchema` uses `z.object(...)`. Add the `is_pesara` field:

```typescript
const formSchema = z.object({
  patient_name: z.string().min(1, "Patient name is required"),
  no_ic: z.string().min(14, "IC number is incomplete"),
  is_pesara: z.boolean().default(false),          // new field
  drug_id: z.string().min(1, "Please select a drug"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  prescriber_name: z.string().min(1, "Doctor name is required"),
});
```

The Checkbox component with RHF requires using `Controller`/`FormField` with `field.value` and `onCheckedChange` (not `onChange`):

```tsx
<FormField control={form.control} name="is_pesara" render={({ field }) => (
  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
    <FormControl>
      <Checkbox
        id="is_pesara"
        checked={field.value}
        onCheckedChange={field.onChange}
      />
    </FormControl>
    <div className="space-y-1 leading-none">
      <Label htmlFor="is_pesara" className="font-normal cursor-pointer">
        Pesara (Government Retiree)
      </Label>
      <p className="text-xs text-muted-foreground">
        Tick if this patient is a retired government employee (Pesara Kerajaan). Pesara patients are exempt from annual quota limits.
      </p>
    </div>
  </FormItem>
)} />
```

**The key pitfall:** Radix Checkbox uses `onCheckedChange` (not `onChange`). Using `onChange` silently does nothing.

### Pattern 6: Nested Tabs for Regular/Pesara sub-tabs

The existing SpecialistDashboard already uses `<Tabs defaultValue="ubat">` at the top level. The "Controlled Drug" tab content becomes a nested `<Tabs>`:

```tsx
<TabsContent value="ubat" className="space-y-4 mt-4">
  <Tabs defaultValue="regular">
    <TabsList>
      <TabsTrigger value="regular" className="gap-1">
        Regular
        {regularPending.length > 0 && (
          <Badge className="bg-amber-500 text-white rounded-full text-xs px-1.5 ml-1">
            {regularPending.length}
          </Badge>
        )}
      </TabsTrigger>
      <TabsTrigger value="pesara" className="gap-1">
        Pesara
        {pesaraPending.length > 0 && (
          <Badge className="bg-amber-500 text-white rounded-full text-xs px-1.5 ml-1">
            {pesaraPending.length}
          </Badge>
        )}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="regular">
      {/* Regular table with quota badge column */}
    </TabsContent>
    <TabsContent value="pesara">
      {/* Pesara table with Unlimited badge column */}
    </TabsContent>
  </Tabs>
  {/* Drug Approval History collapsible stays below the sub-tabs */}
</TabsContent>
```

### Anti-Patterns to Avoid

- **Counting all dispensings instead of unique patients:** The quota counts unique patient ICs. Using `COUNT(*)` or counting all rows (including multiple dispensings for the same patient) overcounts and breaks the quota metric. Always use a `Set` to deduplicate `no_ic` before counting.
- **Hardcoding quota limit checks at submit time:** Quota is enforced at specialist approval only — not at doctor submission. Do not add quota checks to DoctorRequest submit flow.
- **Showing borrow field unconditionally:** The "Borrowing quota from facility" input must be conditionally rendered only when `used_count >= quota_limit`. Showing it always creates confusion.
- **Using onChange on Radix Checkbox:** Radix Checkbox uses `onCheckedChange`. Using `onChange` silently does nothing and the field stays false.
- **Forgetting to invalidate quota query keys after approve:** After the approveMutation succeeds, the quota count queries (`["specialist-quota-counts"]`, `["fms-ytd-counts"]`, `["fms-drug-quotas"]`) must be invalidated so the badge refreshes immediately.
- **Mutating the existing `ytdCounts` query in FmsDashboard:** FmsDashboard currently counts all fulfilled requests with no distinction for Pesara. After Phase 5, the existing count should be refined to non-Pesara to match the quota display. If the query is left unchanged, the "Patients Served YTD" column will include Pesara patients and misrepresent the quota status.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Badge styling | Custom CSS classes | Existing Tailwind badge classes (`bg-green/amber/red/blue-100 text-*-700 border-*-300`) | Already defined in FmsDashboard + SpecialistDashboard, enforced in UI-SPEC |
| Quota threshold logic | Inline ternary chains | `quotaBadgeState()` helper (define once, reuse across row + dialog) | Used in two places (row badge, dialog alert); centralise to avoid drift |
| Checkbox + form integration | Raw HTML checkbox | shadcn `<Checkbox>` + RHF `<FormField>` | Handles WCAG touch targets, checked state, error display |
| Modal confirm for destructive action | Custom confirm UI | `<Dialog>` with rejection reason textarea | Existing reject dialog pattern already implemented in SpecialistDashboard |
| DB COUNT DISTINCT | Supabase RPC | JS-side `Set` deduplication after `.select("drug_id, no_ic")` | Simpler, no new RPC needed, bounded row volume |

**Key insight:** This phase is entirely additive. Every UI component, query pattern, and badge class already exists. The work is wiring them together, not inventing anything new.

---

## Common Pitfalls

### Pitfall 1: TypeScript types not updated after DB migration

**What goes wrong:** After adding `is_pesara` and `borrowed_from_facility` to the `dispensing_requests` table, TypeScript will not know about these columns until `types.ts` is regenerated or manually updated. Any access to `r.is_pesara` will produce a TS error, and the supabase client select may miss the column.

**Why it happens:** `src/integrations/supabase/types.ts` is auto-generated and reflects the schema at the time of last generation. It does not auto-update when the DB changes.

**How to avoid:** After running the migration, update `types.ts` manually (or run `supabase gen types typescript`) to add `is_pesara: boolean` and `borrowed_from_facility: string | null` to the `dispensing_requests` Row, Insert, and Update types. Do this before writing any component code.

**Warning signs:** TS error `Property 'is_pesara' does not exist on type...`

### Pitfall 2: Quota count query includes Pesara patients

**What goes wrong:** The existing `ytdCounts` query in FmsDashboard counts all fulfilled dispensings without filtering `is_pesara`. After the new columns are added, both FmsDashboard and SpecialistDashboard must use separate counts for regular (non-Pesara) and Pesara patients.

**Why it happens:** The existing query predates the Pesara category. It will not automatically filter.

**How to avoid:** Create a new React Query key `["specialist-quota-counts", currentYear]` that fetches both regular and Pesara counts in one query function. Update FmsDashboard's `ytdCounts` query to add `.eq("is_pesara", false)` to the regular patient count.

**Warning signs:** FmsDashboard "Patients Served YTD" column inflated by Pesara patients; quota badges in SpecialistDashboard show higher numbers than expected.

### Pitfall 3: approveMutation payload missing borrowed_from_facility for normal approvals

**What goes wrong:** If the approve mutation always sends `borrowed_from_facility: borrowFacility`, and the state is initialised to `""`, this may write an empty string to the column when quota is not exhausted.

**Why it happens:** Forgot to null-coalesce the borrow field for non-exhausted approvals.

**How to avoid:** Always send `borrowed_from_facility: borrowFacility.trim() || null`. Confirm the borrow field state is reset to `""` each time `setApproveTarget(null)` is called.

**Warning signs:** `borrowed_from_facility` column populated with empty strings in DB.

### Pitfall 4: Sub-tab state leaks between open/close

**What goes wrong:** If a specialist opens a Regular request approve dialog, then closes it and switches to the Pesara sub-tab, lingering dialog state (notes, borrow field, approveTarget) may show on the Pesara approval dialog.

**Why it happens:** Both sub-tabs share the same `approveTarget` / `notes` / `borrowFacility` state in the parent component.

**How to avoid:** Call `setNotes("")`, `setBorrowFacility("")`, and `setApproveTarget(null)` together in the `onOpenChange` handler of the approve dialog. This is already the pattern for `rejectReason` in the reject dialog.

### Pitfall 5: React Query mock chain does not handle .eq("is_pesara", ...) in tests

**What goes wrong:** Existing SpecialistDashboard and FmsDashboard test mocks chain `.eq().order()`. The new quota count queries chain `.eq("status").eq("is_pesara").gte().lt()`. If the mock does not handle the additional `.eq()` call, the mock returns `undefined` instead of `{ data: [], error: null }`, causing the component to crash in tests.

**Why it happens:** The mock builder `from().select().eq().gte().lt()` must return the terminal promise at the right depth.

**How to avoid:** Update test mocks to handle the full chain depth. The safest pattern is a deep mock that always returns `{ data: [], error: null }` at any depth. See the existing `FmsDashboard.test.tsx` for the double-`.eq()` chain pattern already handled there — extend that pattern for the new triple-chain.

---

## Code Examples

### Verified Pattern: FormField with Checkbox (shadcn + RHF)

```tsx
// Source: shadcn/ui checkbox docs + DoctorRequest.tsx existing FormField pattern
<FormField
  control={form.control}
  name="is_pesara"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
      <FormControl>
        <Checkbox
          id="is_pesara"
          checked={field.value}
          onCheckedChange={field.onChange}   // NOT onChange — Radix uses onCheckedChange
        />
      </FormControl>
      <div className="space-y-1 leading-none">
        <Label htmlFor="is_pesara" className="font-normal cursor-pointer">
          Pesara (Government Retiree)
        </Label>
      </div>
    </FormItem>
  )}
/>
```

### Verified Pattern: Conditional Alert + Input in Dialog

```tsx
// Source: 05-UI-SPEC.md interaction contract + existing Dialog pattern in SpecialistDashboard
{isQuotaExhausted && (
  <>
    <Alert variant="destructive">
      <AlertDescription>
        Quota exhausted: {usedCount}/{quotaLimit} patients for {drugName} this year.
        Approval will exceed the annual patient quota.
      </AlertDescription>
    </Alert>
    <div className="space-y-2">
      <Label htmlFor="borrow-facility">Borrowing quota from facility</Label>
      <Input
        id="borrow-facility"
        placeholder="Enter facility name"
        value={borrowFacility}
        onChange={e => setBorrowFacility(e.target.value)}
      />
    </div>
  </>
)}
```

### Verified Pattern: Approve button disabled when borrow required but empty

```tsx
// Source: existing rejectMutation disabled pattern in SpecialistDashboard.tsx (line 423)
<Button
  className="bg-green-600 hover:bg-green-700 text-white"
  onClick={() => approveMutation.mutate()}
  disabled={
    approveMutation.isPending ||
    (isQuotaExhausted && borrowFacility.trim() === "")
  }
>
  {approveMutation.isPending ? "Processing..." : "Confirm Approval"}
</Button>
```

### Verified Pattern: Quota count query (new)

```typescript
// Source: adapted from FmsDashboard.tsx ytdCounts query
const { data: quotaCounts = { regular: {}, pesara: {} } } = useQuery({
  queryKey: ["specialist-quota-counts", currentYear],
  refetchInterval: 30000,
  queryFn: async () => {
    const yearStart = `${currentYear}-01-01`;
    const yearEnd   = `${currentYear + 1}-01-01`;

    const [{ data: regular }, { data: pesara }] = await Promise.all([
      supabase
        .from("dispensing_requests")
        .select("drug_id, no_ic")
        .eq("status", "fulfilled")
        .eq("is_pesara", false)
        .gte("created_at", yearStart)
        .lt("created_at",  yearEnd),
      supabase
        .from("dispensing_requests")
        .select("drug_id, no_ic")
        .eq("status", "fulfilled")
        .eq("is_pesara", true)
        .gte("created_at", yearStart)
        .lt("created_at",  yearEnd),
    ]);

    const regularCounts: Record<string, number> = {};
    const uniqueICs: Record<string, Set<string>> = {};
    for (const r of regular ?? []) {
      if (!uniqueICs[r.drug_id]) uniqueICs[r.drug_id] = new Set();
      uniqueICs[r.drug_id].add(r.no_ic);
    }
    for (const [drugId, s] of Object.entries(uniqueICs)) {
      regularCounts[drugId] = s.size;
    }

    const pesaraCounts: Record<string, number> = {};
    for (const r of pesara ?? []) {
      pesaraCounts[r.drug_id] = (pesaraCounts[r.drug_id] ?? 0) + 1;
    }

    return { regular: regularCounts, pesara: pesaraCounts };
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ytdCounts` counts all fulfilled requests | `ytdCounts` must filter `is_pesara = false` for regular quota | Phase 5 migration | FmsDashboard quota accuracy |
| Single pending list in Controlled Drug tab | Regular + Pesara sub-tabs | Phase 5 | Specialist workflow clarity |
| No quota context at approval time | Quota badge on row + dialog alert | Phase 5 | Specialist informed decision-making |
| No borrow-from-facility audit trail | `borrowed_from_facility` column on approval | Phase 5 | Audit trail for quota exceedances |

**No deprecated approaches in this phase.** All changes are additive.

---

## Open Questions

1. **Quota count scope: pending vs. fulfilled**
   - What we know: CONTEXT.md states "quota counts unique patients per drug per year" and the existing `ytdCounts` query in FmsDashboard filters `status = "fulfilled"`.
   - What's unclear: Should the quota badge in SpecialistDashboard also count `pending_specialist` or `pending_pharmacy` requests toward the quota (i.e., reserved quota), or only `fulfilled`?
   - Recommendation: Count only `fulfilled` (matching the existing FmsDashboard pattern). Counting pending requests would require resetting the count when requests are rejected, adding complexity. If the user wants reservation semantics, that is a deferred enhancement.

2. **Facility names for borrow dropdown**
   - What we know: CONTEXT.md leaves this to Claude's discretion (free-text or dropdown).
   - What's unclear: Are there a known set of facilities to offer as suggestions?
   - Recommendation: Use a free-text `<Input>` field. No facility master list exists in the codebase. The field is an audit trail note, not a relational reference. Free-text minimises risk of an incomplete dropdown and matches the low-frequency use case.

3. **Types.ts update timing**
   - What we know: `src/integrations/supabase/types.ts` is auto-generated. It does not yet include `is_pesara` or `borrowed_from_facility`.
   - What's unclear: Is the Supabase CLI available in the local dev environment to regenerate types, or must they be edited manually?
   - Recommendation: The Wave 1 plan should include a manual `types.ts` update as a task, with a note that `supabase gen types typescript --local` can replace the manual update if the CLI is available.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts detected) |
| Config file | `vitest.config.ts` — jsdom environment, setupFiles: `./src/test/setup.ts` |
| Quick run command | `npx vitest run src/pages/SpecialistDashboard.test.tsx src/pages/DoctorRequest.test.tsx src/pages/FmsDashboard.test.tsx src/lib/quotaHelpers.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P5-01 | DoctorRequest renders Pesara checkbox with correct label | unit | `npx vitest run src/pages/DoctorRequest.test.tsx` | Yes — extend existing |
| P5-02 | DoctorRequest submit includes `is_pesara: false` by default | unit | `npx vitest run src/pages/DoctorRequest.test.tsx` | Yes — extend existing |
| P5-03 | DoctorRequest submit includes `is_pesara: true` when checkbox ticked | unit | `npx vitest run src/pages/DoctorRequest.test.tsx` | Yes — extend existing |
| P5-04 | SpecialistDashboard renders Regular and Pesara sub-tabs inside Controlled Drug tab | unit | `npx vitest run src/pages/SpecialistDashboard.test.tsx` | Yes — extend existing |
| P5-05 | Regular tab rows show quota badge (healthy/warning/exhausted) | unit | `npx vitest run src/pages/SpecialistDashboard.test.tsx` | Yes — extend existing |
| P5-06 | Approve dialog shows borrow field when quota is exhausted | unit | `npx vitest run src/pages/SpecialistDashboard.test.tsx` | Yes — extend existing |
| P5-07 | Approve button disabled until borrow field filled when quota exhausted | unit | `npx vitest run src/pages/SpecialistDashboard.test.tsx` | Yes — extend existing |
| P5-08 | Pesara tab rows show Unlimited badge, no quota badge | unit | `npx vitest run src/pages/SpecialistDashboard.test.tsx` | Yes — extend existing |
| P5-09 | FmsDashboard annual quota table renders Pesara column header | unit | `npx vitest run src/pages/FmsDashboard.test.tsx` | Yes — extend existing |
| P5-10 | quotaBadgeState() returns correct state at 0%, 79%, 80%, 100% thresholds | unit | `npx vitest run src/lib/quotaHelpers.test.ts` | Yes — extend existing |

### Sampling Rate
- **Per task commit:** `npx vitest run src/pages/SpecialistDashboard.test.tsx src/pages/DoctorRequest.test.tsx src/pages/FmsDashboard.test.tsx`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. All test files listed above already exist. New test cases are additions to existing `describe` blocks, not new files.

---

## Sources

### Primary (HIGH confidence)

- `src/pages/SpecialistDashboard.tsx` — authoritative existing approve/reject mutation pattern, tab structure, query keys
- `src/pages/DoctorRequest.tsx` — authoritative existing form schema, submit mutation, FormField patterns
- `src/pages/FmsDashboard.tsx` — authoritative existing ytdCounts query, quota table, FORECAST_STATUS_BADGE/STATUS_BADGE classes
- `src/components/DrugQuotaDialog.tsx` — authoritative upsert pattern for drug_quotas table
- `src/lib/quotaHelpers.ts` — authoritative quota status helper functions
- `src/integrations/supabase/types.ts` — authoritative schema types for dispensing_requests and drug_quotas
- `05-CONTEXT.md` — locked decisions, badge specs, exact copy strings
- `05-UI-SPEC.md` — component inventory, interaction contract, copywriting contract
- `vitest.config.ts` — test framework config
- `CLAUDE.md` — project conventions, RLS guidance, React Query patterns

### Secondary (MEDIUM confidence)

- shadcn/ui Checkbox docs — `onCheckedChange` vs `onChange` distinction (consistent with project usage in existing Checkbox imports)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in codebase, no new installs
- Architecture: HIGH — all patterns derived from existing production code in the repo
- Pitfalls: HIGH — all derived from direct code inspection of affected files
- DB migration: HIGH — two simple ALTER TABLE statements; no foreign keys or constraints involved
- Quota count logic: HIGH — derived from existing ytdCounts pattern in FmsDashboard

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack — Supabase, React Query, shadcn/ui all stable)
