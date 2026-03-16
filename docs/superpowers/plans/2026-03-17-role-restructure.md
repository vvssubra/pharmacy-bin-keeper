# Role Restructure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing 3-role system (pharmacist/doctor/specialist) with a 4-role system (admin/fms/mo/pharmacist) with role-appropriate dashboards and access control.

**Architecture:** Add new enum values to Supabase, update AppRole type and all role gates, create FMS dashboard and MO dashboard as new pages, update SpecialistDashboard (now FMS approval page) to show submitter name, restrict RoleManagement to admin only.

**Tech Stack:** React 18 + TypeScript, Supabase (PostgreSQL enum migration via MCP), React Query, Recharts (graphs), shadcn/ui, React Router v6

---

## Role Access Matrix

| Route | admin | fms | mo | pharmacist |
|-------|-------|-----|----|------------|
| `/` (Admin dashboard) | ✓ | — | — | ✓ |
| `/fms` (FMS dashboard) | ✓ | ✓ | — | ✓ |
| `/mo` (MO dashboard) | ✓ | — | ✓ | ✓ |
| `/drugs` | ✓ | ✓ | — | ✓ |
| `/terimaan` | ✓ | ✓ | — | ✓ |
| `/fulfilment` | ✓ | ✓ | — | ✓ |
| `/pesakit` | ✓ | ✓ | — | ✓ |
| `/laporan` | ✓ | ✓ | — | ✓ |
| `/role-management` | ✓ | — | — | — |
| `/request` | ✓ | — | ✓ | ✓ |
| `/request/ubat` | ✓ | — | ✓ | ✓ |
| `/request/antibiotik` | ✓ | — | ✓ | ✓ |
| `/specialist` (approvals) | ✓ | ✓ | — | ✓ |

Default landing after login: admin→`/`, pharmacist→`/`, fms→`/fms`, mo→`/mo`

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/pages/FmsDashboard.tsx` | CREATE — drug usage, quota, pending approvals, usage graph |
| `src/pages/MoDashboard.tsx` | CREATE — remaining quota per drug |
| `src/contexts/AuthContext.tsx` | MODIFY — update AppRole type |
| `src/components/ProtectedRoute.tsx` | MODIFY — new role permission matrix |
| `src/components/AppSidebar.tsx` | MODIFY — nav items per role |
| `src/App.tsx` | MODIFY — add /fms and /mo routes, role-based redirect |
| `src/pages/RoleManagement.tsx` | MODIFY — show all 4 roles, admin-only |
| `src/pages/SpecialistDashboard.tsx` | MODIFY — show MO name (from profiles via submitted_by) |
| Supabase enum | MIGRATE — add admin, fms, mo values |

---

## Chunk 1: Database + Types + Infrastructure

### Task 1: Supabase enum migration

Apply SQL migration to add new role values.

- [ ] Apply migration via Supabase MCP:
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fms';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mo';
```

### Task 2: Update AppRole type

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

- [ ] Change `AppRole` type to:
```typescript
export type AppRole = "admin" | "fms" | "mo" | "pharmacist" | "specialist";
```
(Keep `specialist` for backward compatibility — existing specialist users won't break)

### Task 3: Update ProtectedRoute

**Files:**
- Modify: `src/components/ProtectedRoute.tsx`

- [ ] Replace ROUTE_PERMISSIONS with:
```typescript
const ROUTE_PERMISSIONS: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/role-management", roles: ["admin"] },
  { prefix: "/fulfilment",      roles: ["admin", "fms", "pharmacist"] },
  { prefix: "/drugs",           roles: ["admin", "fms", "pharmacist"] },
  { prefix: "/terimaan",        roles: ["admin", "fms", "pharmacist"] },
  { prefix: "/pesakit",         roles: ["admin", "fms", "pharmacist"] },
  { prefix: "/laporan",         roles: ["admin", "fms", "pharmacist"] },
  { prefix: "/specialist",      roles: ["admin", "fms", "pharmacist"] },
  { prefix: "/fms",             roles: ["admin", "fms", "pharmacist"] },
  { prefix: "/mo",              roles: ["admin", "mo", "pharmacist"] },
  { prefix: "/request",         roles: ["admin", "mo", "pharmacist"] },
  { prefix: "/",                roles: ["admin", "pharmacist"] },
];
```

### Task 4: Update AppSidebar

**Files:**
- Modify: `src/components/AppSidebar.tsx`

- [ ] Replace items array with:
```typescript
const items: NavItem[] = [
  { title: "Dashboard",      url: "/",               icon: Home,        roles: ["admin", "pharmacist"] },
  { title: "FMS Dashboard",  url: "/fms",            icon: BarChart2,   roles: ["admin", "fms", "pharmacist"] },
  { title: "MO Dashboard",   url: "/mo",             icon: Stethoscope, roles: ["admin", "mo", "pharmacist"] },
  { title: "New Requests",   url: "/fulfilment",     icon: Bell,        showBadge: true, roles: ["admin", "fms", "pharmacist"] },
  { title: "Approvals",      url: "/specialist",     icon: ShieldCheck, showBadge: true, roles: ["admin", "fms", "pharmacist"] },
  { title: "Drug Master",    url: "/drugs",          icon: Pill,        roles: ["admin", "fms", "pharmacist"] },
  { title: "Terimaan",       url: "/terimaan",       icon: PackagePlus, roles: ["admin", "fms", "pharmacist"] },
  { title: "Patients",       url: "/pesakit",        icon: Users,       roles: ["admin", "fms", "pharmacist"] },
  { title: "Reports",        url: "/laporan",        icon: FileText,    roles: ["admin", "fms", "pharmacist"] },
  { title: "Drug Request",   url: "/request/ubat",   icon: ClipboardList, roles: ["admin", "mo", "pharmacist"] },
  { title: "Antibiotic Form",url: "/request/antibiotik", icon: Pill,   roles: ["admin", "mo", "pharmacist"] },
  { title: "Role Management",url: "/role-management",icon: UserCog,     roles: ["admin"] },
];
```
Note: Import `BarChart2` and `ClipboardList` from lucide-react.

### Task 5: Update App.tsx — add routes + default redirect

**Files:**
- Modify: `src/App.tsx`

- [ ] Add import for `FmsDashboard` and `MoDashboard`
- [ ] Add routes:
```tsx
<Route path="/fms" element={<ProtectedRoute><FmsDashboard /></ProtectedRoute>} />
<Route path="/mo" element={<ProtectedRoute><MoDashboard /></ProtectedRoute>} />
```
- [ ] Add default redirect component that redirects fms→/fms and mo→/mo on the root route:
```tsx
// In the root "/" route, render a RoleRedirect that checks role
// If role === "fms" → <Navigate to="/fms" />
// If role === "mo" → <Navigate to="/mo" />
// Otherwise → render <Index />
```
Create inline helper in App.tsx:
```tsx
function RoleRedirect() {
  const { role } = useAuth();
  if (role === "fms") return <Navigate to="/fms" replace />;
  if (role === "mo") return <Navigate to="/mo" replace />;
  return <Index />;
}
```
Replace `<Index />` with `<RoleRedirect />` on the root route.

---

## Chunk 2: Role Management Page

### Task 6: Update RoleManagement — all 4 roles, admin-only

**Files:**
- Modify: `src/pages/RoleManagement.tsx`

- [ ] Update `ROLE_LABELS`:
```typescript
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  fms: "FMS",
  mo: "Medical Officer",
  pharmacist: "Pharmacist",
};
const ASSIGNABLE_ROLES = ["admin", "fms", "mo", "pharmacist"] as const;
```

- [ ] Update the UI grouping to show all users with their current roles, and allow changing any user's role to any of the 4 assignable roles via a Select dropdown.

- [ ] Remove the old doctor/specialist grouping. Replace with a flat table:

| Name | Email | Facility | Current Role | Actions |
|------|-------|----------|--------------|---------|
| ...  | ...   | ...      | Select▼     | Save   |

Role select options: Admin, FMS, Medical Officer, Pharmacist, (Unassigned)

- [ ] Self-role change protection remains: current user cannot change their own role.

---

## Chunk 3: FMS Dashboard

### Task 7: Create FMS Dashboard page

**Files:**
- Create: `src/pages/FmsDashboard.tsx`

The FMS Dashboard has 4 sections:

**Section 1 — Drug Stock Quota Cards**
Query: Compute current stock per drug (sum transactions: terimaan adds, keluaran subtracts, baki_awal sets).
Show top drugs with stock level, color-coded: red (below stok_min), amber (below stok_reorder), green (normal).

```typescript
const { data: drugStock = [] } = useQuery({
  queryKey: ["fms-drug-stock"],
  refetchInterval: 30000,
  queryFn: async () => {
    const { data: drugs } = await supabase
      .from("drugs")
      .select("id, drug_name, stok_min, stok_reorder, stok_max, unit_pengukuran")
      .eq("is_active", true)
      .order("drug_name");
    const { data: txns } = await supabase
      .from("transactions")
      .select("drug_id, jenis, kuantiti");

    return (drugs ?? []).map(drug => {
      const drugTxns = (txns ?? []).filter(t => t.drug_id === drug.id);
      let stock = 0;
      for (const t of drugTxns) {
        if (t.jenis === "baki_awal") stock = t.kuantiti;
        else if (t.jenis === "terimaan") stock += t.kuantiti;
        else if (t.jenis === "keluaran") stock -= t.kuantiti;
      }
      return { ...drug, current_stock: stock };
    });
  },
});
```

**Section 2 — Pending Requests from MO**
Show pending dispensing_requests (controlled drugs) + pending antibiotic_forms side by side.
Each row shows: patient name, drug/antibiotic, MO name (from profiles join), submitted time.

```typescript
const { data: pendingRequests = [] } = useQuery({
  queryKey: ["fms-pending-requests"],
  refetchInterval: 15000,
  queryFn: async () => {
    const { data } = await supabase
      .from("dispensing_requests")
      .select("*, drugs(drug_name), profiles!submitted_by(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    return data ?? [];
  },
});

const { data: pendingAntibiotic = [] } = useQuery({
  queryKey: ["fms-pending-antibiotic"],
  refetchInterval: 15000,
  queryFn: async () => {
    const { data } = await supabase
      .from("antibiotic_forms" as any)
      .select("*, profiles!submitted_by(full_name)")
      .eq("status", "pending_specialist")
      .order("created_at", { ascending: false });
    return (data ?? []) as any[];
  },
});
```

**Section 3 — Usage Graph (Recharts)**
Monthly drug dispensing (keluaran) counts, filterable by drug via a Select.

```typescript
const { data: usageData = [] } = useQuery({
  queryKey: ["fms-usage", selectedDrugId],
  queryFn: async () => {
    let q = supabase
      .from("transactions")
      .select("drug_id, kuantiti, created_at, drugs(drug_name)")
      .eq("jenis", "keluaran")
      .order("created_at", { ascending: true });
    if (selectedDrugId) q = q.eq("drug_id", selectedDrugId);
    const { data } = await q;
    // Group by month
    const byMonth: Record<string, number> = {};
    for (const t of data ?? []) {
      const month = t.created_at.slice(0, 7); // "YYYY-MM"
      byMonth[month] = (byMonth[month] ?? 0) + t.kuantiti;
    }
    return Object.entries(byMonth).map(([month, qty]) => ({ month, qty }));
  },
});
```

Use `<LineChart>` from recharts with month on X axis, quantity on Y axis.

**Layout:**
```
┌─────────────────────────────────────────┐
│ FMS Dashboard                           │
├──────────────┬──────────────┬──────────┤
│ Drug Quota   │ Drug Quota   │ Drug Quota│
│ (card grid)  │              │          │
├──────────────┴──────────────┴──────────┤
│ Pending Controlled  │ Pending Antibiotic│
│ Requests from MO    │ Approvals from MO │
├────────────────────────────────────────┤
│ Drug Usage Graph                        │
│ [Select Drug ▼]  [LineChart]           │
└────────────────────────────────────────┘
```

---

## Chunk 4: MO Dashboard

### Task 8: Create MO Dashboard page

**Files:**
- Create: `src/pages/MoDashboard.tsx`

Show remaining stock quota for all active drugs in a clean table/card layout.
MO sees: drug name, unit, current stock level, and a status badge.

```typescript
const { data: drugStock = [] } = useQuery({
  queryKey: ["mo-drug-quota"],
  refetchInterval: 30000,
  queryFn: async () => {
    // Same stock computation as FMS dashboard
    const { data: drugs } = await supabase
      .from("drugs")
      .select("id, drug_name, unit_pengukuran, stok_min, stok_reorder, stok_max, perlu_kelulusan_pakar")
      .eq("is_active", true)
      .order("drug_name");
    const { data: txns } = await supabase
      .from("transactions")
      .select("drug_id, jenis, kuantiti");
    return (drugs ?? []).map(drug => {
      let stock = 0;
      for (const t of (txns ?? []).filter(t => t.drug_id === drug.id)) {
        if (t.jenis === "baki_awal") stock = t.kuantiti;
        else if (t.jenis === "terimaan") stock += t.kuantiti;
        else if (t.jenis === "keluaran") stock -= t.kuantiti;
      }
      return { ...drug, current_stock: stock };
    });
  },
});
```

Also show MO's own recent requests:
```typescript
const { data: myRequests = [] } = useQuery({
  queryKey: ["mo-my-requests"],
  queryFn: async () => {
    const { data } = await supabase
      .from("dispensing_requests")
      .select("*, drugs(drug_name)")
      .eq("submitted_by", user?.id)
      .order("created_at", { ascending: false })
      .limit(10);
    return data ?? [];
  },
});
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ MO Dashboard  [Welcome, Dr. Name]       │
├──────────────────────────────────────── ┤
│ Available Drug Quota                    │
│ Drug Name    │ Stock │ Unit │ Status    │
│ Amoxicillin  │  500  │ tab  │ ● Normal  │
│ Metformin    │   20  │ tab  │ ● Low     │
├─────────────────────────────────────────┤
│ My Recent Requests                      │
│ [table of recent dispensing requests]   │
└─────────────────────────────────────────┘
```

Quick action buttons: "New Drug Request" → /request/ubat, "Antibiotic Form" → /request/antibiotik

---

## Chunk 5: Specialist/Approval Page — Show MO Name

### Task 9: Update SpecialistDashboard to show MO name

**Files:**
- Modify: `src/pages/SpecialistDashboard.tsx`

- [ ] Update controlled drug query to join profiles:
```typescript
const { data: requests = [] } = useQuery({
  queryKey: ["specialist-requests"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("dispensing_requests")
      .select("*, drugs(drug_name, unit_pengukuran), profiles!submitted_by(full_name)")
      .in("status", ["pending_specialist", "approved", "rejected"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});
```

- [ ] Update antibiotic query to join profiles:
```typescript
const { data: abForms = [] } = useQuery({
  queryKey: ["specialist-antibiotic-forms"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("antibiotic_forms" as any)
      .select("*, profiles!submitted_by(full_name)")
      .in("status", ["pending_specialist", "approved", "rejected"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as any[];
  },
});
```

- [ ] Add "Submitted by" column to both the pending controlled drugs table and pending antibiotic forms table:
```tsx
<TableCell>{row.profiles?.full_name ?? "Unknown MO"}</TableCell>
```

---

## Commit Plan

After each chunk is complete:
```
feat(roles): add admin/fms/mo roles — DB enum + types + routing
feat(roles): update role management page for 4 roles
feat(fms): add FMS dashboard with quota, pending requests, usage graph
feat(mo): add MO dashboard with drug quota and recent requests
feat(approvals): show submitting MO name in approval page
```
