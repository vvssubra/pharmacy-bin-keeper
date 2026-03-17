# AI Integration Design — Pharmacy Bin Keeper

**Date:** 2026-03-17
**Status:** Approved
**Author:** Brainstorming session

---

## Overview

Three-phase AI integration for the pharmacy management system. Phases are independent and can be shipped sequentially. All AI calls are server-side only via Supabase Edge Functions. The Claude API key never touches the browser.

**Model:** Claude Haiku (`claude-haiku-4-5-20251001`) — lowest cost, sufficient capability for all three use cases.

---

## Phase 1 — Drug Stock & Quota Dashboard

**Cost:** Zero (pure math, no AI API calls)
**Who sees it:** FMS Dashboard, Admin, MO Dashboard

### Controlled Drugs — Annual Patient Quota

Controlled drugs (`perlu_kelulusan_pakar = true`) are tracked by **number of patients served per year**, not tablet count.

**New DB table:**
```sql
CREATE TABLE drug_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id uuid REFERENCES drugs(id) ON DELETE CASCADE,
  year integer NOT NULL,
  quota_limit integer NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(drug_id, year)
);
```

**Quota deduction:** Each fulfilled dispensing request for a controlled drug deducts 1 from the annual quota (1 patient = 1 unit of quota).

**Display columns:**

| Drug Name | Annual Quota | Patients Served (YTD) | Remaining | Projected Exhaustion | Status |
|-----------|-------------|----------------------|-----------|---------------------|--------|
| Morphine  | 60          | 42                   | 18        | Aug 2026            | ⚠ Warning |

**Status thresholds:**
- 🔴 Critical — ≤10% remaining
- ⚠ Warning — ≤25% remaining
- ✅ Healthy — >25% remaining

**Projected exhaustion** = today + (remaining ÷ avg patients/month)

**Admin can set/update quotas** from Drug Master page (per drug, per year).

---

### Non-Controlled Drugs — Tablet Stock Forecast

Reads from existing `transactions` table — no new tables needed.

**Calculations:**
```
used_today        = SUM(kuantiti) WHERE jenis='keluaran' AND DATE(created_at) = today
current_stock     = running ledger total (existing logic)
remaining_today   = current_stock - used_today
avg_daily_usage   = SUM(keluaran last 30 days) ÷ 30
days_remaining    = current_stock ÷ avg_daily_usage
reorder_by_date   = today + days_remaining - 7  (7-day lead time)
```

**Display columns:**

| Drug Name | Current Stock | Used Today | Remaining | Days Left | Reorder By | Status |
|-----------|--------------|------------|-----------|-----------|------------|--------|

**Status thresholds:**
- 🔴 Critical — <7 days remaining
- ⚠ Warning — <14 days remaining
- ✅ Healthy — ≥14 days remaining

---

### MO Dashboard Integration

MO Dashboard shows controlled drug quota remaining so MO knows before submitting a request whether quota is available for that drug.

---

## Phase 2 — Natural Language Chat Widget

**Cost:** Claude Haiku per query (~$0.0001 per query at typical length)
**Edge Function:** `ai-query`
**Access:** All roles (floating button in AppLayout — visible on every page)

### Chat Widget UI

- Floating button fixed to bottom-right corner, rendered inside `AppLayout`
- Click opens a slide-up panel: conversation history + input box
- "Thinking..." indicator while awaiting response
- Max 500 characters per question (enforced client-side + server-side)
- Conversation history kept in React state only — not persisted to DB (privacy)

### Role-Scoped Data Context

The Edge Function fetches only data the user's role is permitted to see:

| Role | Data sent to Claude |
|------|-------------------|
| Admin | All stock, all requests, all approvals, all quotas |
| FMS | All stock, all MO requests, approvals, quotas |
| Pharmacist | Stock, requests, fulfilment, approvals |
| MO | Own requests only + drug quota remaining + NAG guidelines |

**MO chat** includes the NAG document in the system prompt (cached) — MO can ask clinical questions alongside quota queries.

### Example Queries

- *"Which drugs are critically low right now?"*
- *"How many MO requests were rejected this month?"*
- *"Which controlled drug is closest to exhausting its annual quota?"*
- *"For a patient with fever, dysuria, positive nitrite — which antibiotic per NAG?"* (MO only)
- *"How many antibiotic forms are pending approval?"*

### System Prompt (Non-MO roles)

```
You are a pharmacy management assistant. Answer ONLY from the data provided below.
Do not make up numbers or infer data not present. If the answer is not in the data, say "I don't have that information."
Be concise. Use numbers directly from the data.
```

### System Prompt (MO role)

```
You are a clinical assistant for a Malaysian government clinic.
For clinical questions: answer ONLY based on the NAG guidelines provided. If the case does not match any pathway, say "Refer to specialist" — never suggest outside the guidelines.
For quota/request questions: answer from the pharmacy data provided.
Be concise and cite the specific NAG pathway when giving clinical advice.
```

---

## Phase 3 — Live Antibiotic Form Checker

**Cost:** Claude Haiku + Anthropic prompt caching (~90% cost reduction on repeated NAG document calls)
**Edge Function:** `pathway-check`
**Access:** MO (live in form) + FMS/Approvals page (result shown per submission)

### NAG Document

- Source: https://sites.google.com/moh.gov.my/nag/home (user will provide full document)
- Stored in: Supabase Storage as structured text
- Loaded as: cached system prompt in `pathway-check` Edge Function
- **Strictly grounded** — Claude is instructed never to deviate from document content

### Live Form Checker

Triggers automatically inside `AntibioticForm` page:
- 1.5 second debounce after MO changes diagnosis, checklist, or patient details
- Sends current form state to `pathway-check` Edge Function
- Result displayed as a banner inside the form (above submit button)

**Result states:**

| State | Banner | Meaning |
|-------|--------|---------|
| ✅ Supported | Green | Checklist matches NAG pathway |
| ⚠ Review | Amber | Partial match — specific weak criterion flagged |
| ❌ Not supported | Red | Does not justify antibiotic per NAG — pathway cited |
| 💬 Refer specialist | Blue | Case complexity exceeds pathway scope |

**Advisory only** — MO can still submit regardless of result. Banner informs, does not block.

### Approvals Page Integration

FMS Approvals page (`/specialist`) shows the pathway check result badge alongside each antibiotic form — FMS sees NAG compliance status before approving.

---

## Security Architecture

Applied to **every** Edge Function. Requests are rejected at the earliest failing check.

```
1. CORS                → Allow-Origin: APP_ORIGIN env var only
2. JWT verification    → supabase.auth.getUser(token) — rejects expired/invalid tokens
3. Role check          → queries user_roles table — rejects unauthorised roles
4. Rate limiting       → Upstash Redis sliding window per (user_id, function_name)
5. Input validation    → Zod schema — rejects malformed/oversized payloads
6. Prompt sanitization → strips injection patterns before Claude call
7. Claude API call     → server-side only, key in Edge Function secrets
8. Audit log write     → ai_audit_logs table
```

### Rate Limits

| Function | Limit | Window |
|----------|-------|--------|
| `ai-query` | 20 requests | per user per hour |
| `pathway-check` | 10 requests | per user per hour |

### Audit Logging

New table `ai_audit_logs`:
```sql
CREATE TABLE ai_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  function_name text NOT NULL,
  tokens_used integer,
  created_at timestamptz DEFAULT now()
);
```
No raw prompts or responses stored — privacy compliant.

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `ANTHROPIC_API_KEY` | Supabase Edge Function secret | Claude API — never in frontend |
| `UPSTASH_REDIS_REST_URL` | Supabase Edge Function secret | Rate limiter |
| `UPSTASH_REDIS_REST_TOKEN` | Supabase Edge Function secret | Rate limiter auth |
| `APP_ORIGIN` | Supabase Edge Function secret | CORS allowed origin |

---

## New DB Tables Summary

| Table | Purpose |
|-------|---------|
| `drug_quotas` | Annual patient quota per controlled drug, set by admin |
| `ai_audit_logs` | AI call audit trail — user, function, token count, timestamp |

---

## Implementation Order

1. **Phase 1** — `drug_quotas` table + forecasting UI on FMS + MO dashboards (zero API cost, ship first)
2. **Phase 2** — `ai-query` Edge Function + Upstash setup + chat widget in AppLayout
3. **Phase 3** — `pathway-check` Edge Function + NAG document storage + live form checker + approvals badge

Each phase is independently deployable.
