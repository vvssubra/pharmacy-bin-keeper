# Phase 5: Controlled Drug Approval Flow with Patient-Based Quota and Pesara Category - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the controlled drug specialist approval flow to:
1. Add a Pesara (government retiree) patient category on the drug request form — Pesara patients are quota-exempt and tracked in a separate list
2. Enforce annual patient-based quota in the specialist approval view — quota is an indicator with borrow-from-facility support, not a hard block
3. Surface quota context (usage badge) on the SpecialistDashboard and update FmsDashboard to show Pesara counts alongside regular quota

This phase does NOT change the antibiotic approval flow, patient registry, or stock calculations.

</domain>

<decisions>
## Implementation Decisions

### Pesara category definition
- Pesara = Malaysian government retiree (Pesara Kerajaan)
- Captured as a **checkbox on the DoctorRequest form** — doctor ticks "Pesara (Government Retiree)" when submitting a controlled drug request for a Pesara patient
- The `is_pesara` flag must be added to the `dispensing_requests` table
- Pesara requests go through the **same specialist approval flow** — no bypass, no extra approval step
- Pesara patients have **unlimited quota** — no quota check is performed for them
- Pesara dispensings are tracked **separately** from regular quota patients (separate sub-tab in SpecialistDashboard, separate counter in FmsDashboard)

### Quota enforcement point & rules
- Quota is enforced **at specialist approval** — specialist sees quota context when reviewing each pending request
- Quota counts **unique patients per drug per year** — each patient IC is counted once per drug per year regardless of how many times they receive it. Matches existing `drug_quotas` design ("maximum patients that may receive this drug")
- Pesara patient ICs are **excluded** from the regular quota count
- Quota is an **indicator only** — no hard block; specialist can always approve

### Quota exceeded behavior
- When quota is exhausted: show a clear **"Quota Exhausted" warning badge** on the request row and in the approval dialog — specialist can still proceed
- When approving a request that exceeds quota, a **"Borrow from facility" field** appears in the approval dialog — specialist enters/selects the facility name they are borrowing quota from
- The borrow facility name is saved on the specific `dispensing_request` record (new `borrowed_from_facility` column) — audit trail only, no cross-system sync or quota arithmetic
- No hard block, no auto-reject — specialist remains the decision-maker at all times

### Specialist approval view — Controlled Drug tab
- The existing **Controlled Drug tab** in SpecialistDashboard gets two sub-tabs:
  - **"Regular"** — non-Pesara pending requests, each row shows a quota usage badge (e.g. "45/60 patients"), amber when ≥80% used, red when at/over limit
  - **"Pesara"** — Pesara pending requests, no quota counter, "Unlimited" label
- Quota usage badge is visible **in the pending list row** (not just in the approval dialog)
- Approval dialog for over-quota requests gains a "Borrowing quota from facility" input field

### FmsDashboard quota display
- The drug quota table in FmsDashboard shows both counts per drug:
  - Regular: `{used}/{limit} patients` (existing, enhanced)
  - Pesara: `{pesara_count} (Unlimited)` (new column)

### Claude's Discretion
- Exact list of facility names for the borrow dropdown (hardcoded list or free-text input)
- DB migration specifics (column names beyond what's stated)
- Styling details beyond the color rules stated above
- Whether the Pesara count in FmsDashboard is a new column or a secondary line in an existing cell

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing controlled drug flow
- `src/pages/DoctorRequest.tsx` — where `perlu_kelulusan_pakar` routes to `pending_specialist`; Pesara checkbox must be added here
- `src/pages/SpecialistDashboard.tsx` — existing specialist approval UI; Pesara sub-tab and quota badge added here
- `src/components/DrugQuotaDialog.tsx` — existing quota management dialog (admin sets annual patient limit)
- `src/pages/FmsDashboard.tsx` — existing quota overview; Pesara column added here

### Database schema
- `src/integrations/supabase/types.ts` — authoritative TypeScript types; `dispensing_requests` and `drug_quotas` tables
- `CLAUDE.md` §Database Schema — `dispensing_requests`, `drug_quotas`, `drugs.perlu_kelulusan_pakar` field descriptions

### Project constraints
- `CLAUDE.md` — RLS must be respected for all DB changes; React Query invalidation patterns; Supabase client usage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DrugQuotaDialog` — already handles upsert on `drug_quotas` table; can be referenced for quota read pattern
- `dispensing_requests` query in `SpecialistDashboard` — already filters by `pending_specialist`; extend with `is_pesara` field
- Approval/reject mutation pattern in `SpecialistDashboard` — add `borrowed_from_facility` to the approve mutation payload when over quota
- Quota usage helpers in `src/lib/quotaHelpers.ts` — `quotaStatus`, `forecastStatus`, `daysRemaining` — reusable for badge color logic

### Established Patterns
- React Query with `refetchInterval: 15000–30000` on specialist/FMS pages — follow same pattern
- `useMutation` + `queryClient.invalidateQueries` for all writes — follow existing pattern
- Badge color classes: `bg-amber-100 text-amber-700` (warning), `bg-red-100 text-red-700` (critical), `bg-green-100 text-green-700` (healthy)
- Tabs with `TabsList`/`TabsTrigger`/`TabsContent` already used in SpecialistDashboard — use same pattern for Regular/Pesara sub-tabs

### Integration Points
- `dispensing_requests` table — needs `is_pesara boolean default false` and `borrowed_from_facility text nullable` columns (DB migration required)
- `DoctorRequest.tsx` form — add Pesara checkbox before/after existing patient fields
- `SpecialistDashboard.tsx` Controlled Drug tab — split into Regular/Pesara sub-tabs
- `FmsDashboard.tsx` quota table — add Pesara count column
- Supabase RLS — new columns must be accessible to `mo` (write `is_pesara`), `fms`/`pharmacist` (read), `admin` (read)

</code_context>

<specifics>
## Specific Ideas

- Quota badge format: `"45/60 patients"` — amber at ≥80% (e.g. 48+/60), red at ≥100% (60+/60)
- Borrow field only appears in the approve dialog when `used_count >= quota_limit` (not shown when quota is healthy)
- Pesara sub-tab label: `"Pesara"` with pending count badge (same pattern as Antibiotic Form tab)
- FmsDashboard: `"Regular: 45/60 | Pesara: 12 (Unlimited)"` or separate columns — Claude's discretion on layout

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-controlled-drug-approval-flow-to-specialist-with-patient-based-quota-and-pesara-category*
*Context gathered: 2026-03-22*
