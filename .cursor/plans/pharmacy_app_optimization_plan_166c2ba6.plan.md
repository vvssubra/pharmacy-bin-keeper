---
name: Pharmacy app optimization plan
overview: "Optimize Pharmacy Bin Keeper using UI/UX Pro Max, Supabase auth best practices (React/Vite), and Postgres best practices: design system alignment, accessibility and interaction fixes, auth session handling, and database indexes."
todos: []
isProject: false
---

# Pharmacy Bin Keeper — Optimization Plan

## Context

- **Stack**: Vite + React + React Router + Supabase (client-only). This is **not** Next.js, so auth optimizations follow Supabase + React principles (session handling, protected routes), not Next.js middleware or App Router.
- **Skills applied**: ui-ux-pro-max (design, a11y, interaction), nextjs-supabase-auth (principles only: session, tokens, guards), postgres-best-practices (indexes, query patterns).

---

## Goal

Improve usability, accessibility, auth reliability, and database query performance without changing the overall architecture (no migration to Next.js).

---

## 1. UI/UX (ui-ux-pro-max)

### 1.1 Design system and tokens

- Run the design-system search for **healthcare / pharmacy / clinic dashboard** (from the ui-ux-pro-max skill: `python3 <skill_path>/scripts/search.py "healthcare pharmacy clinic dashboard" --design-system -p "Pharmacy Bin Keeper"`). Skill scripts live under your Cursor skills directory (e.g. `~/.cursor/skills/ui-ux-pro-max/`); if the script is not present, use the skill’s rule tables and quick reference to derive recommendations.
- Apply the recommended palette and typography to [src/index.css](src/index.css) (CSS variables in `:root`) and [tailwind.config.ts](tailwind.config.ts) so they match the product type (healthcare, professional, readable).
- Verify contrast: body text and muted text meet 4.5:1 (e.g. `--foreground` and `--muted-foreground`). Ensure borders are visible in light mode (e.g. `--border` not too light).

### 1.2 Accessibility (critical)

- **Focus states**: Confirm all interactive elements (buttons, tabs, inputs, nav links, cards that open dialogs) have visible focus rings. shadcn/Radix usually provide this; add `focus-visible:ring-2` (or equivalent) where custom components omit it.
- **Form labels**: Audit forms beyond Login (e.g. [DrugFormDialog.tsx](src/components/DrugFormDialog.tsx), [OpeningBalanceDialog.tsx](src/components/OpeningBalanceDialog.tsx), [Terimaan.tsx](src/pages/Terimaan.tsx), [AntibioticForm.tsx](src/pages/AntibioticForm.tsx)): every input must have a `<Label htmlFor="...">` and matching `id`; use `autoComplete` where appropriate.
- **Error feedback**: Ensure error messages are associated with inputs (e.g. `aria-describedby` or inline message with `id` and `aria-describedby` on input). Login already shows errors; replicate pattern in other forms.
- **Reduced motion**: Add a `prefers-reduced-motion: reduce` block in [src/index.css](src/index.css) to tone down or disable non-essential animations (e.g. `animation: none`, `transition-duration: 0.01ms`).

### 1.3 Touch and interaction

- **cursor-pointer**: Add `cursor-pointer` to every clickable element that doesn’t have it: dashboard cards that navigate, table rows that select or open details, sidebar nav (if not already from shadcn), and any custom clickable `<div>`/`<Card>`. Key files: [Index.tsx](src/pages/Index.tsx) (stock table rows, stat cards), [DrugMaster.tsx](src/pages/DrugMaster.tsx) (table rows), [SpecialistDashboard.tsx](src/pages/SpecialistDashboard.tsx) (cards), [PatientRegistry.tsx](src/pages/PatientRegistry.tsx) (already has cursor-pointer on rows).
- **Touch targets**: Ensure buttons and nav items meet minimum 44×44px (use `min-h-[44px] min-w-[44px]` or padding so tap area is sufficient), especially on mobile.
- **Loading states**: Buttons that trigger async actions must show loading and be disabled during submit (Login already does). Audit [DrugFormDialog](src/components/DrugFormDialog.tsx), [OpeningBalanceDialog](src/components/OpeningBalanceDialog.tsx), Terimaan submit, and Specialist approve/reject buttons; use `disabled={isPending}` and a spinner or “Loading…” text.

### 1.4 Icons and consistency

- Replace decorative Unicode “✓” used as UI indicators with an SVG check icon (e.g. Lucide `Check`) in [PharmacistFulfilment.tsx](src/pages/PharmacistFulfilment.tsx) (badges “Diluluskan Pakar ✓”) and [AntibioticFormReadOnly.tsx](src/components/AntibioticFormReadOnly.tsx) (checked state). Keep “✓” only inside copy/text (e.g. instructions in AntibioticForm) if it’s part of the sentence.
- Ensure all icons come from one set (Lucide already used in [AppSidebar](src/components/AppSidebar.tsx)); no emoji as icons elsewhere.

### 1.5 Layout and responsive

- Confirm viewport meta and that there is no horizontal scroll on narrow viewports (e.g. 375px). Check [AppLayout](src/components/AppLayout.tsx), [Login](src/pages/Login.tsx), and main content areas.
- Reserve space for async content (skeletons or min-height) to avoid layout jump when data loads (e.g. dashboard stats, tables).

### 1.6 Pre-delivery checklist (from skill)

- Run through the skill’s Pre-Delivery Checklist: no emoji icons, consistent icon set, cursor-pointer on clickables, hover feedback, transitions 150–300ms, contrast in light/dark, no content behind fixed nav, and a11y (alt text, labels, reduced-motion).

---

## 2. Auth (Supabase + React — principles from nextjs-supabase-auth)

### 2.1 Initial session and loading

- In [AuthContext.tsx](src/contexts/AuthContext.tsx): Use the result of `getSession()` to set `session` and `user` immediately so the first paint is correct when the user is already logged in. Today only `onAuthStateChange` and a bare `getSession().then(...)` that sets `loading = false` when there’s no session are used; initial session is never applied to state.
- **Change**: In the same `useEffect`, call `supabase.auth.getSession()` and in its `.then()`, set `setSession`/`setUser` from `data.session`; if `data.session` exists, load profile and role once (reuse the same logic as in `onAuthStateChange`) and then set `loading(false)`. Ensure `onAuthStateChange` still updates session/user on sign-in/sign-out so you don’t duplicate logic unnecessarily (e.g. single helper `loadProfileAndRole(session)` called from both getSession callback and onAuthStateChange).

### 2.2 Profile/role loading

- Remove the `setTimeout(..., 0)` workaround in [AuthContext.tsx](src/contexts/AuthContext.tsx) if possible: use a single async path that loads profile + role after session is set, and call it from both initial getSession and onAuthStateChange. If a race persists, consider a small delay or a ref guard instead of relying on setTimeout(0).
- Ensure `loading` is set to `false` in all branches (no session; session with profile/role loaded; session with profile/role error).

### 2.3 Optional: role-based route guard

- [ProtectedRoute](src/components/ProtectedRoute.tsx) only checks `user`. Optionally add a role check so that routes like `/specialist` and `/fulfilment` only render for `role === 'specialist'` and pharmacist/admin respectively; others redirect to `/` or `/login`. Document as optional if you don’t want to enforce strict role routes yet.

### 2.4 Token handling

- No change needed: app uses Supabase client in the browser with `localStorage` and `autoRefreshToken: true`; there is no server-side session or custom token storage. Just ensure no auth tokens are logged or sent to non-Supabase endpoints.

---

## 3. Postgres (postgres-best-practices)

### 3.1 Indexes (new migration)

Add one new migration under `supabase/migrations/` with:

- **transactions**: Composite index for ledger and activity queries (filter by `drug_id`, order by `tarikh` or `created_at`):
  - `CREATE INDEX idx_transactions_drug_id_created_at ON public.transactions(drug_id, created_at DESC);`
- **dispensing_requests**: Status filters used on dashboard and specialist/fulfilment:
  - `CREATE INDEX idx_dispensing_requests_status_created_at ON public.dispensing_requests(status, created_at DESC);`
- **drugs**: Active drug lists used in Dashboard, DrugMaster, Terimaan:
  - `CREATE INDEX idx_drugs_is_active_drug_name ON public.drugs(is_active, drug_name) WHERE is_active = true;`
- **antibiotic_forms**: Already has `antibiotic_forms_status_idx`. If you have queries that filter by `status` and `acknowledged_at IS NULL`, consider:
  - `CREATE INDEX idx_antibiotic_forms_approved_unack ON public.antibiotic_forms(acknowledged_at) WHERE status = 'approved';`
  (only if the “approved and not acknowledged” query is hot.)

### 3.2 RLS and connection

- RLS is enabled and policies are in place; no change required for this optimization. Connection management is handled by Supabase (client pool); no app-side connection changes.

### 3.3 Verification

- After applying the migration, run typical queries (e.g. dashboard drugs + transactions, ledger by drug_id, dispensing_requests by status) and confirm `EXPLAIN (ANALYZE, BUFFERS)` uses the new indexes where expected.

---

## 4. Verification and done criteria

- **UI**: Design tokens applied; a11y (focus, labels, errors, reduced-motion) and interaction (cursor-pointer, touch targets, loading buttons) verified on Login, Dashboard, Drug Master, Terimaan, Specialist, and Fulfilment; no emoji icons; checklist passed.
- **Auth**: Reload with existing session shows correct user/role without unnecessary loading flash; sign out clears state; optional role guard works if implemented.
- **Postgres**: New migration applies cleanly; no duplicate index names; query plans use new indexes for the main filters above.

---

## Task summary (short)


| #   | Task                                                                                                                                    | Verify                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | Run design-system (healthcare pharmacy), apply palette/typography to `index.css` and `tailwind.config.ts`                               | Visual check; contrast 4.5:1                            |
| 2   | A11y: focus rings, form labels + ids, error association, `prefers-reduced-motion` in CSS                                                | Keyboard nav, screen reader / a11y pass                 |
| 3   | Add `cursor-pointer` and 44px touch targets where needed; ensure loading/disabled on async buttons                                      | Click through main flows                                |
| 4   | Replace “✓” with Lucide Check in badges/read-only component; keep one icon set                                                          | No emoji/Unicode as UI icons                            |
| 5   | AuthContext: set initial state from `getSession()`, single profile/role load path, remove setTimeout(0) if possible                     | Reload while logged in: no flash; sign out clears state |
| 6   | (Optional) Role-based guard in ProtectedRoute for `/specialist` and `/fulfilment`                                                       | Wrong role redirects                                    |
| 7   | New migration: indexes on `transactions(drug_id, created_at)`, `dispensing_requests(status, created_at)`, `drugs(is_active, drug_name)` | Migration up; EXPLAIN uses indexes                      |
| 8   | Pre-delivery checklist (skill): icons, contrast, layout, a11y                                                                           | Full checklist passed                                   |


---

## Notes

- **Scope**: No migration to Next.js; no new backend API. All changes are in existing React/Vite app, AuthContext, and one new Supabase migration.
- **Design script**: If the ui-ux-pro-max Python script is not in the repo, run it from the Cursor skill path or manually apply the skill’s product/style/color/typography rules for “healthcare” and “dashboard”.
- **Order**: Design system and indexes can be done in parallel; a11y and auth can follow. Finish with the full UI checklist and a quick regression pass on main flows.

