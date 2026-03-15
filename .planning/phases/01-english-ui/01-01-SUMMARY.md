---
phase: 01-english-ui
plan: "01"
subsystem: testing
tags: [tdd, red-phase, translation, english-ui]
dependency_graph:
  requires: []
  provides: [failing-tests-engl-01, failing-tests-engl-02, failing-tests-engl-03, failing-tests-engl-04]
  affects: [01-02-PLAN, 01-03-PLAN, 01-04-PLAN, 01-05-PLAN]
tech_stack:
  added: []
  patterns: [vitest-react-testing-library, supabase-mock, tanstack-query-mock, auth-context-mock]
key_files:
  created:
    - src/components/AppSidebar.test.tsx
    - src/components/DrugFormDialog.test.tsx
    - src/pages/Index.test.tsx
    - src/pages/DoctorRequest.test.tsx
  modified: []
decisions:
  - "Sidebar mock: useSidebar is mocked from ui/sidebar to avoid SidebarProvider requirement — pattern for downstream tests"
  - "Index test: date-fns/locale ms import is NOT mocked (real locale needed for format() preprocessor); avoided mocking it"
  - "DrugFormDialog save button: Zod validation test uses /save|simpan/i regex to find button in both RED and GREEN states"
  - "DoctorRequest submit button: regex /submit request|hantar permintaan/i for forward/backward compat"
metrics:
  duration: 2m
  completed: "2026-03-16"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 1 Plan 01: TDD Red Phase — Failing Translation Test Scaffolds Summary

One-liner: Four failing Vitest/RTL test files asserting English UI strings across sidebar nav, form labels, status badges, and Zod validation messages.

## What Was Built

Four failing test files that form the automated verification layer for the ENGL-01 through ENGL-04 translation requirements. Every file imports the real component under test (no component mocking) and asserts on English strings that do not yet exist in the codebase. Plans 02-05 will make them pass.

### Test Files Created

| File | Requirements | Assertions | Failure Reason |
|------|-------------|------------|----------------|
| `src/components/AppSidebar.test.tsx` | ENGL-01 | 4 nav labels | Source has Malay: "Permintaan Baharu", "Pesakit", "Laporan", "Pengurusan Peranan" |
| `src/components/DrugFormDialog.test.tsx` | ENGL-02, ENGL-04 | 5 form labels + Zod | Source has "Tambah Ubat", "Nama Ubat *", "Unit Pengukuran", "Simpan", Zod "Nama ubat diperlukan" |
| `src/pages/Index.test.tsx` | ENGL-03 | 5 badges + headers | Source has "KRITIKAL", "RENDAH", "LEBIHAN", "Nama Ubat", "Tindakan" |
| `src/pages/DoctorRequest.test.tsx` | ENGL-04 | 5 labels + Zod | Source has "Nama Pesakit *", "Ubat *", "Hantar Permintaan", Zod Malay messages |

**Total: 19 failing assertions across 4 test files. All fail with "Unable to find element" — not TypeScript or import errors.**

## Exact Failure Messages (RED State Evidence)

From `npx vitest run` output:

```
Test Files  4 failed (4)
Tests  19 failed (19)
```

Representative failures:
- `Unable to find an element with the text: New Requests`
- `Unable to find an element with the text: Add Drug`
- `Unable to find an element with the text: CRITICAL`
- `Unable to find an element with the text: Patient name is required`

## Mock Patterns Established

These patterns should be reused by Plans 02-05 when writing GREEN-phase tests or additional test files.

### 1. Supabase Client Mock (all files)
```ts
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
        })),
      })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));
```

### 2. AuthContext Mock
```ts
vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
const { useAuth } = await import("@/contexts/AuthContext");
// Then in each test:
(useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
  user: { id: "user-1" }, role: "pharmacist",
  profile: { full_name: "Test User", facility: "KK Kempas" },
  loading: false, session: null, signOut: vi.fn(),
});
```

### 3. useSidebar Mock (AppSidebar only)
```ts
vi.mock("@/components/ui/sidebar", async () => {
  const actual = await vi.importActual("@/components/ui/sidebar");
  return {
    ...actual,
    useSidebar: vi.fn(() => ({ state: "expanded", open: true, setOpen: vi.fn(),
      openMobile: false, setOpenMobile: vi.fn(), isMobile: false, toggleSidebar: vi.fn() })),
  };
});
```

### 4. QueryClient Wrapper
```ts
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}
// Wrap each render in <QueryClientProvider client={makeQueryClient()}>
```

### Important: date-fns locale
Do NOT mock `date-fns/locale` — the `ms` locale object has internal structure that `format()` requires (`preprocessor` property). Import it via the real module or the test will crash with `TypeError: Cannot read properties of undefined (reading 'preprocessor')`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed invalid date-fns/locale mock in Index.test.tsx**
- **Found during:** Task 2 execution
- **Issue:** Mocking `date-fns/locale` with `{ ms: {} }` caused `format()` to crash with `TypeError: Cannot read properties of undefined (reading 'preprocessor')` — a runtime crash, not the expected element-not-found test failure
- **Fix:** Removed the mock entirely; the real `ms` locale is imported by the component and works correctly in jsdom
- **Files modified:** `src/pages/Index.test.tsx`
- **Commit:** included in 77cf8e2

## Commits

| Hash | Message |
|------|---------|
| 5b794f5 | test(01-01): add failing RED tests for AppSidebar and DrugFormDialog |
| 77cf8e2 | test(01-01): add failing RED tests for Index and DoctorRequest |

## Self-Check: PASSED
