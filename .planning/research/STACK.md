# Stack Research: Pharmacy Bin Keeper v2.0

**Researched:** 2026-03-16
**Focus:** PDF generation, Supabase Admin user management, drug sync fix, English UI switch

---

## New Libraries Required

### PDF Generation — `@react-pdf/renderer` ^3.x

**Why this library:**
- The antibiotic form already has a `AntibioticFormReadOnly` JSX component. `@react-pdf/renderer` uses React components to declare PDFs — a direct structural match.
- Generates real PDFs (not screenshots), giving consistent layout and filename control.

**What NOT to use:**
- `jspdf` — imperative coordinate-based API, poor fit for component-based layout
- `html2canvas + jspdf` — screenshot approach, fragile with Tailwind CSS classes
- `window.print()` — no filename control, browser-dependent formatting

**Install:** `npm install @react-pdf/renderer`

**Vite config required:**
```ts
// vite.config.ts
optimizeDeps: {
  include: ['@react-pdf/renderer']
}
```

---

## No New Libraries — Backend Approach Change

### User Creation & Deactivation — Supabase Edge Function (Deno)

**Why Edge Function (not a new npm package):**
- `supabase.auth.admin.createUser()` and `supabase.auth.admin.updateUserById()` require the **service role key**.
- The existing browser client uses the anon/publishable key — calling admin APIs from it returns 403.
- The service role key must **never** be in the browser bundle.

**Solution:** Deno Edge Function at `supabase/functions/admin-user-management/index.ts`
- Uses `SUPABASE_SERVICE_ROLE_KEY` injected as a Supabase secret
- Called from frontend via `supabase.functions.invoke("admin-user-management", { body: { action, ...params } })`

**User creation:** `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`
- `email_confirm: true` skips confirmation email for admin-created accounts
- Existing `handle_new_user()` trigger auto-inserts into `profiles`
- Edge Function also inserts role into `user_roles`

**User deactivation:** `supabase.auth.admin.updateUserById(userId, { ban_duration: "876600h" })`
- 100-year ban = canonical Supabase permanent deactivation pattern
- `ban_duration: "none"` to reactivate

---

## No New Libraries — Code Changes Only

### English UI Switch

- No i18n library (i18next, react-intl) needed — this is a one-way switch to English, not multi-language support
- Text replacement pass across all JSX files with hardcoded Malay strings

### Drug-Request Cache Fix

- No new packages — React Query already installed
- Fix: ensure drug master creation mutation calls `queryClient.invalidateQueries({ queryKey: ["drugs"] })` and that the doctor's request form uses the same `queryKey: ["drugs"]`

---

## Summary

| Feature | Package | Action |
|---------|---------|--------|
| Antibiotic PDF | `@react-pdf/renderer` ^3.x | `npm install` |
| User create/deactivate | None (Edge Function) | Create Supabase Edge Function |
| English UI | None | Text replacement in JSX |
| Drug sync | None | React Query key alignment |
