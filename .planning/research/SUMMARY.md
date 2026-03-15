# Project Research Summary

**Project:** Pharmacy Bin Keeper v2.0
**Domain:** Clinical pharmacy inventory management (Malaysian public health facility)
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

Pharmacy Bin Keeper v2.0 is a targeted enhancement release on an already-functional React 18 + Supabase application. The four planned features — English UI switch, drug-request sync fix, antibiotic PDF download, and admin user management — all integrate cleanly into the existing architecture without requiring new pages, routing paradigms, or major data model changes. The recommended approach is additive: fix a filter bug, replace strings, add a hook + PDF component, and deploy one Edge Function. No greenfield rewrites are needed.

The most important architectural decision is already confirmed: user management requires a Supabase Edge Function because the service role key must never reach the browser bundle. This is the only genuinely new infrastructure piece in v2.0. Everything else builds directly on existing patterns — TanStack React Query mutations, Supabase RPC calls, and the existing `ProtectedRoute` + `AppLayout` system. The risk profile is low for three of the four features and medium for user management due to Edge Function deployment.

The recommended build order (English UI first, then drug sync, then PDF, then user management) is driven by two principles: zero-risk changes first so all subsequent features ship with correct UI language, and the most operationally complex feature last so deployment issues do not block earlier wins.

## Key Findings

### Recommended Stack

The existing stack requires only one new npm package. `@react-pdf/renderer` ^3.x is the correct choice for antibiotic PDF generation because the codebase already has `AntibioticFormReadOnly` as a JSX component — the React-component-as-PDF paradigm is a direct structural fit. All other features are achieved through code changes only: string replacement for the English switch, two-line React Query fix for drug sync, and a Deno Edge Function (no npm package) for user management.

**Core technologies:**
- `@react-pdf/renderer` ^3.x: antibiotic PDF generation — only library that matches the existing JSX-component layout pattern; requires `optimizeDeps` Vite config and dynamic import at click time to avoid ~700KB bundle bloat
- Supabase Edge Function (Deno): admin user management proxy — mandatory because `auth.admin.*` APIs require the service role key, which must never appear in the browser bundle or any `VITE_` environment variable
- TanStack React Query (existing): cache invalidation fix for drug sync — no new library, just correcting the query key alignment between `DrugFormDialog` and `DoctorRequest`

### Expected Features

**Must have (table stakes for v2.0):**
- English UI across all pages — page titles, nav labels, form fields, status badges, Zod validation messages, toast text, and `date-fns` locale (replace `ms` with `enGB`); DB values are already English, so no migration needed
- Drug-request sync fix — remove the `baki_awal` transaction filter from `DoctorRequest.tsx` queryFn; newly created drugs are silently excluded today, which directly blocks clinical workflow
- Antibiotic PDF download — "Download PDF" button on approved antibiotic forms in `PharmacistFulfilment`; pharmacist-only, uses cached React Query data, downloads as a named file
- Admin user management — create user (name, email, role, temp password), edit user (name + role), deactivate user (100-year ban via Supabase Auth Admin API); extends existing `RoleManagement` page

**Should have (v2.0 scope confirmed):**
- Reactivation of deactivated users (`ban_duration: "none"`) — trivial addition to the same Edge Function, can be bundled with deactivation

**Defer (v3+):**
- Language switcher UI — not requested; permanent English switch is the requirement
- Runtime i18n (i18next, react-intl) — overkill for a one-way switch
- Invite-by-email flow — admin sets passwords directly; self-registration is a security risk in this clinical setting
- Adding a 4th `admin` role — user management belongs to `pharmacist`; adding a new role requires simultaneous updates to `AppRole` type, DB CHECK constraint, all RLS policies, and all admin guards

### Architecture Approach

All four features integrate into the existing layered architecture (Supabase → React Query hooks → page components → `AppLayout`). Feature 2 (user management) is the only one requiring new infrastructure files: one Deno Edge Function, one new page (`UserManagement.tsx`), one new hook (`useUserManagement.ts`), and route + sidebar additions. Features 1, 3, and 4 are modifications to existing files only.

**Major components (new or modified):**
1. `supabase/functions/admin-user-management/index.ts` — Deno Edge Function; verifies caller JWT against `user_roles`, executes `auth.admin.createUser / updateUserById / listUsers`, rolls back on partial failure
2. `src/hooks/useAntibioticPdf.ts` + `src/components/AntibioticPdfDocument.tsx` — PDF generation hook with dynamic import and download trigger; mirrors `AntibioticFormReadOnly` layout
3. `src/pages/DoctorRequest.tsx` + `src/components/DrugFormDialog.tsx` — two-file fix; remove filter, align cache keys

### Critical Pitfalls

1. **Service role key in browser bundle (P1)** — never create `VITE_SUPABASE_SERVICE_ROLE_KEY`; it gets baked into the JS bundle and bypasses all RLS. Exclusively use the Supabase Edge Function as proxy with the key stored as a server-side secret. Verify post-build: `grep -r "service_role" dist/`.

2. **Edge Function role guard bypassed via request body (P2)** — do not check `body.callerRole`; extract the caller's user ID from the Authorization header JWT (`supabaseAdmin.auth.getUser(token)`), query `user_roles`, and assert `role === "pharmacist"` before any admin operation. Return HTTP 403 immediately on failure.

3. **Orphaned auth user on partial failure (P3)** — if `auth.admin.createUser` succeeds but the subsequent `user_roles` insert fails, the auth account exists but the user hits `NoPermission` on every route. Wrap the entire create sequence in try/catch and call `auth.admin.deleteUser` to roll back on any insert failure.

4. **Malay strings surviving the English switch (P4)** — Zod schema `.min()` / `.regex()` messages, `date-fns` locale import (`ms` → `enGB`), and toast strings need a separate explicit pass from JSX content. Run `grep -r "Ubat\|Pesakit\|Doktor\|perlu\|berjaya\|gagal\|Pilih\|Cari\|tarikh\|Kemaskini\|Tambah" src/` after each file and again at the end.

5. **Drug sync fix confused with cache staleness (P5/P6)** — the root cause is a filter bug (`baki_awal` transaction check), not React Query staleness. Adding `staleTime: 0` or `refetchOnMount: "always"` will not fix it. Two tasks required: remove the filter, then invalidate `["drugs-for-request"]` in `DrugFormDialog` onSuccess. Note that `["drugs"]` and `["drugs-for-request"]` are independent cache keys.

## Implications for Roadmap

Based on research, the natural phase structure follows risk and dependency order.

### Phase 1: English UI

**Rationale:** Zero-risk, pure view-layer change with no data flow impact. Doing this first ensures all subsequent features ship with correct English labels rather than requiring a second language cleanup pass.

**Delivers:** All pages, nav, forms, status badges, toasts, Zod messages, and date formatting in English. No DB migration required.

**Addresses:** ENGL-01..05 from FEATURES.md; approximately 15 files modified.

**Avoids:** P4 (partial Malay strings surviving) — mitigated by running grep verification after each file.

### Phase 2: Drug-Request Sync Fix

**Rationale:** Highest user-impact-to-effort ratio in v2.0. Three to six lines changed. Unblocks doctors from seeing newly added drugs immediately. Does not touch any infrastructure and carries no deployment risk.

**Delivers:** Newly created drugs appear in the doctor's request form without requiring a page reload or manual intervention.

**Uses:** Existing React Query setup — no new packages.

**Implements:** Filter removal in `DoctorRequest.tsx` queryFn + cache key alignment in `DrugFormDialog`.

**Avoids:** P5/P6 — must treat as two distinct tasks (filter removal first, then cache invalidation) to avoid confusing the root cause.

### Phase 3: Antibiotic PDF

**Rationale:** Introduces the only new npm dependency (`@react-pdf/renderer`) in an isolated, self-contained way. The feature touches one page (`PharmacistFulfilment`) and adds two new files. If PDF generation has issues, it does not affect other features.

**Delivers:** "Download PDF" button on approved antibiotic forms in `PharmacistFulfilment`; generates a named, structured PDF from cached form data.

**Uses:** `@react-pdf/renderer` ^3.x with dynamic import; `AntibioticFormReadOnly` as layout reference; existing React Query cache (no re-fetch at print time).

**Implements:** `useAntibioticPdf` hook + `AntibioticPdfDocument` component + `vite.config.ts` update.

**Avoids:** P7 (data re-fetched at print time — snapshot mismatch) and P8 (static import inflating initial bundle by ~700KB).

### Phase 4: Admin User Management

**Rationale:** Highest complexity feature; reserved for last to avoid blocking earlier wins on Edge Function deployment issues. Requires new infrastructure (Deno Edge Function), a new page, a new hook, and route/sidebar changes.

**Delivers:** Admin-controlled user lifecycle — create (name, email, role, temp password), edit (name + role), deactivate (100-year ban). Extends existing `RoleManagement` page.

**Uses:** Supabase Edge Function with `SUPABASE_SERVICE_ROLE_KEY` as a server-side secret; `supabase.functions.invoke` from the browser client; existing `get_all_users_with_roles()` RPC for user listing.

**Implements:** `admin-user-management` Edge Function + `UserManagement.tsx` page + `useUserManagement.ts` hook + route and sidebar additions.

**Avoids:** P1 (service key in browser), P2 (role guard bypassed via body), P3 (orphaned auth user on partial failure), P9 (4th admin role not introduced).

### Phase Ordering Rationale

- English first because all other features have UI components that should ship in English from the start; a late language pass risks missing new strings added in Phases 2-4.
- Drug sync second because it is the fastest fix with the highest immediate clinical value and no deployment dependencies.
- PDF third because it introduces the only new npm dependency in isolation; any Vite config or bundler issues are contained to one feature.
- User management last because it is the only feature requiring external infrastructure (Edge Function deployment, Supabase secrets configuration) and carries the highest security risk if implemented incorrectly.

### Research Flags

Phases needing closer attention during implementation:

- **Phase 4 (User Management):** Edge Function deployment and Supabase secrets configuration require explicit testing in both local (`supabase functions serve`) and production environments. JWT verification pattern in Deno must be validated. Rollback on partial failure (P3) requires careful implementation.
- **Phase 3 (Antibiotic PDF):** Dynamic import pattern with `@react-pdf/renderer` and Vite's `optimizeDeps` should be verified in a dev build before production — library has known Vite compatibility quirks.

Phases with standard, well-documented patterns (implementation can proceed directly):

- **Phase 1 (English UI):** Plain string replacement; grep-verifiable. No new patterns.
- **Phase 2 (Drug Sync):** React Query cache invalidation is a solved pattern in this codebase; root cause is confirmed in source code.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | One new package (`@react-pdf/renderer`); all others are existing dependencies. Service role key approach is Supabase-documented canonical pattern. |
| Features | HIGH | Root cause of drug sync bug confirmed in source code (lines 61-69 of `DoctorRequest.tsx`). Other features are clearly scoped from existing codebase structure. |
| Architecture | HIGH | Integration points confirmed against actual file structure. Edge Function data flow is well-understood. Component file list is explicit. |
| Pitfalls | HIGH | Security pitfalls (P1, P2, P3) are canonical Supabase patterns. Code-level pitfalls (P4, P5, P6) are confirmed against actual source code. |

**Overall confidence:** HIGH

### Gaps to Address

- **Edge Function local testing setup:** Research confirms the pattern but does not specify whether the local Supabase dev stack is running or needs initialization (`supabase start`). Verify during Phase 4 planning.
- **`get_all_users_with_roles()` RPC pagination:** If the user list grows, the existing RPC may need a LIMIT/OFFSET. Acceptable to defer until Phase 4 implementation reveals actual user count.
- **Reactivation UI:** Deactivating users is in scope; reactivating is trivial (`ban_duration: "none"`) but not explicitly requested. Confirm scope during Phase 4 planning before implementation.

## Sources

### Primary (HIGH confidence)
- Supabase official docs — Auth Admin API (`auth.admin.createUser`, `updateUserById`, `ban_duration` pattern), Edge Functions JWT verification, service role key security
- TanStack React Query docs — cache key invalidation, `queryClient.invalidateQueries` behavior
- `@react-pdf/renderer` official docs — dynamic import pattern, Vite `optimizeDeps` requirement
- Codebase direct inspection — `DoctorRequest.tsx` lines 61-69 (filter bug confirmed), `AuthContext.tsx` (role model), `App.tsx` (route structure), `RoleManagement.tsx` (existing admin page)

### Secondary (MEDIUM confidence)
- Vite docs — `optimizeDeps.include` for CJS/ESM compatibility with `@react-pdf/renderer`
- Community consensus on Supabase permanent deactivation — `ban_duration: "876600h"` (100-year ban) as canonical pattern

### Tertiary (LOW confidence)
- Bundle size estimate for `@react-pdf/renderer` (~700KB) — based on community reports; verify with actual build analysis during Phase 3

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
