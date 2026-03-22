---
phase: 5
slug: controlled-drug-approval-flow-to-specialist-with-patient-based-quota-and-pesara-category
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts (vitest config inline) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | DB migration | manual | `npx supabase db push` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | types.ts update | unit | `npm run build` | ✅ | ⬜ pending |
| 5-02-01 | 02 | 1 | is_pesara checkbox | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 2 | Quota logic | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 2 | SpecialistDashboard sub-tabs | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 5-05-01 | 05 | 2 | FmsDashboard Pesara column | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 5-06-01 | 06 | 3 | Borrow facility dialog | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/DoctorRequest.pesara.test.tsx` — is_pesara checkbox renders and submits correctly
- [ ] `src/pages/__tests__/SpecialistDashboard.quota.test.tsx` — sub-tabs render, quota badge displays, borrow dialog appears when over quota
- [ ] `src/pages/__tests__/FmsDashboard.pesara.test.tsx` — Pesara column displays count

*Existing infrastructure (vitest) covers framework requirements; only new test stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DB migration applies cleanly | is_pesara + borrowed_from_facility columns | Requires live Supabase connection | Run `npx supabase db push`, verify columns in dashboard |
| Quota badge color thresholds | Amber ≥80%, Red ≥100% | Visual rendering | Load SpecialistDashboard with seeded quota data, verify badge colors |
| Borrow field appears only when over quota | Approval dialog behavior | Conditional UI state | Approve a request where quota used ≥ limit, confirm field appears |
| Pesara unlimited label | No quota counter for Pesara tab | Visual check | Switch to Pesara sub-tab, confirm no quota counter shown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
