---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: English UI & Admin Features
status: unknown
stopped_at: Completed 05-02-PLAN.md
last_updated: "2026-03-22T10:29:36Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 9
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** Every drug movement is traceable and every dispensing request is accountable.
**Current focus:** Phase 05 — controlled-drug-approval-flow-to-specialist-with-patient-based-quota-and-pesara-category

## Current Position

Phase: 05 (controlled-drug-approval-flow-to-specialist-with-patient-based-quota-and-pesara-category) — EXECUTING
Plan: 2 of 3

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
| Phase 01-english-ui P01 | 2m | 2 tasks | 4 files |
| Phase 01-english-ui P02 | 8m | 2 tasks | 9 files |
| Phase 01-english-ui P03 | 8m | 2 tasks | 4 files |
| Phase 01-english-ui P04 | 15m | 2 tasks | 3 files |
| Phase 01-english-ui P05 | 53m | 2 tasks | 5 files |
| Phase 01-english-ui P06 | 15m | 2 tasks | 9 files |
| Phase 05 P01 | 3 | 2 tasks | 6 files |
| Phase 05 P02 | 3m | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: English UI first — ensures all subsequent phases ship with correct labels; avoids late Malay-string cleanup pass
- [Roadmap]: Drug sync before PDF — 3-6 line fix with highest clinical value; no deployment risk
- [Roadmap]: User management last — only feature requiring new infrastructure (Edge Function); highest security risk
- [Roadmap]: Service role key must never appear in browser bundle or VITE_ env vars — use Edge Function as proxy
- [Phase 01-english-ui]: useSidebar mocked from ui/sidebar to avoid SidebarProvider requirement — pattern for downstream sidebar tests
- [Phase 01-english-ui]: date-fns locale ms must NOT be mocked — real locale object required for format() preprocessor property
- [Phase 01-english-ui]: Sidebar component mock: mocking useSidebar export alone is insufficient — Sidebar component uses internal closure over React context; full component replacement needed in tests
- [Phase 01-english-ui]: ProtectedRoute.test updated to No Permission — NoPermission.tsx translation requires test assertions to use English heading text
- [Phase 01-english-ui]: StockStatus type values changed to English (CRITICAL/LOW/EXCESS/NO LEVEL) — type, STATUS_CONFIG, STATUS_ORDER, and getStatus() all updated together
- [Phase 01-english-ui]: date-fns ms locale removed from Index.tsx — format() defaults to English without locale option
- [Phase 01-english-ui P04]: date-fns ms locale removal pattern — remove import and strip { locale: ms } from all formatDistanceToNow() call sites; no replacement needed, English is default
- [Phase 01-english-ui P04]: JSX code comments with Malay UI labels also translated — grep-based acceptance criteria catches comments as well as rendered strings
- [Phase 01-english-ui]: RHF submit button onClick pattern: adding onClick handler with form.handleSubmit() alongside type=submit ensures fireEvent.click in JSDOM triggers Zod validation in tests
- [Phase 01-english-ui]: Grep-first verification gate: primary ENGL-05 pattern must return zero matches before any human checkpoint — enforces completeness objectively and caught 9 files missed by Plans 01-05
- [Phase 01-english-ui]: TypeScript variable names derived from Malay DB column names (currentBaki, tarikh, isBakiAwal) are NOT display strings — they match DB schema identifiers and are excluded from translation scope
- [Phase 05-01]: onCheckedChange (not onChange) must be used on Radix Checkbox — silently ignores onChange
- [Phase 05-01]: ResizeObserver polyfill added to src/test/setup.ts to unblock Radix UI tests in JSDOM
- [Phase 05-01]: quotaBadgeState threshold: >=80% = warning, >=100% = exhausted (patient-based quota semantics)
- [Phase 05-02]: quotaCounts.regular[drug_id] uses unique patient IC set — same patient dispensed twice counts once toward quota
- [Phase 05-02]: Pesara approve dialog skips quota exhausted alert — isApproveTargetPesara gates the exhaustion check
- [Phase 05-02]: borrowFacility reset on both dialog onOpenChange and Cancel click to prevent stale state across dialogs

### Roadmap Evolution

- Phase 5 added: Controlled drug approval flow to specialist with patient-based quota and Pesara category

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 4]: Edge Function local testing requires `supabase start` — verify local dev stack is initialised before Phase 4 planning
- [Phase 4]: `get_all_users_with_roles()` RPC has no pagination — acceptable for now; revisit if user list grows
- [Phase 3]: `@react-pdf/renderer` has known Vite compatibility quirks — verify `optimizeDeps` config in dev build before production

## Session Continuity

Last session: 2026-03-22T10:25:02.915Z
Stopped at: Completed 05-01-PLAN.md
Resume file: None
