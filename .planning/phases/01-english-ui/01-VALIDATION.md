---
phase: 1
slug: english-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 + @testing-library/react 16 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + grep check returns zero matches
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | ENGL-01 | unit | `npx vitest run src/components/AppSidebar.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | ENGL-02 | unit | `npx vitest run src/components/DrugFormDialog.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 0 | ENGL-03 | unit | `npx vitest run src/pages/Index.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | ENGL-01 | unit | `npx vitest run src/components/AppSidebar.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | ENGL-02 | unit | `npx vitest run src/components/DrugFormDialog.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 1 | ENGL-03 | unit | `npx vitest run src/pages/Index.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 1 | ENGL-04 | unit | `npx vitest run src/pages/DoctorRequest.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-08 | 01 | 2 | ENGL-05 | smoke | `grep -r "Ubat\|Pesakit\|Doktor\|berjaya\|gagal\|Pilih\|Cari\|Kemaskini\|Tambah" src/ \| grep -v "node_modules\|test\|RESEARCH"` | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/AppSidebar.test.tsx` — stubs for ENGL-01 (nav labels in English)
- [ ] `src/components/DrugFormDialog.test.tsx` — stubs for ENGL-02 (form labels in English, Zod messages in English)
- [ ] `src/pages/Index.test.tsx` — stubs for ENGL-03 (status badge values in English)
- [ ] `src/pages/DoctorRequest.test.tsx` — stubs for ENGL-04 (Zod validation messages in English)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| grep returns zero Malay matches | ENGL-05 | Shell command, not a unit test | Run: `grep -r "Ubat\|Pesakit\|Doktor\|berjaya\|gagal\|Pilih\|Cari\|Kemaskini\|Tambah" src/` — must return zero matches |
| Toast notifications in English | ENGL-04 | Sonner toasts are imperative, triggered by mutations | Trigger a create/update/delete action and verify toast text is English |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
