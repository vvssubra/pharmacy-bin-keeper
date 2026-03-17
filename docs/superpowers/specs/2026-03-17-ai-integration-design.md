# AI Integration Design — Pharmacy Bin Keeper

**Date:** 2026-03-17
**Status:** Approved (v2 — post-review fixes)
**Author:** Brainstorming session

---

## Overview

Three-phase AI integration for the pharmacy management system. Phases are independent and can be shipped sequentially. All AI calls are server-side only via Supabase Edge Functions. The Claude API key never touches the browser.

**Model:** Claude Haiku (`claude-haiku-4-5-20251001`) — lowest cost, sufficient capability for all three use cases.

**Roles in codebase:** `admin`, `fms`, `mo`, `pharmacist` (stored in `user_roles` table; type `AppRole` in `src/contexts/AuthContext.tsx`).

**Routes added in Phase 1:**
- `/fms` → `FmsDashboard` (admin, fms, pharmacist)
- `/mo` → `MoDashboard` (admin, mo, pharmacist)

---

## Phase 1 — Drug Stock & Quota Dashboard

**Cost:** Zero (pure math, no AI API calls)
**Who sees it:** FMS Dashboard (`/fms`), Admin, MO Dashboard (`/mo`)

### Controlled Drugs — Annual Patient Quota

Controlled drugs (`perlu_kelulusan_pakar = true`) are tracked by **number of patients served per year**, not tablet count.

**New DB table:**
```sql
CREATE TABLE drug_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id uuid REFERENCES drugs(id) ON DELETE CASCADE,
  year integer NOT NULL,
  quota_limit integer NOT NULL CHECK (quota_limit >= 0),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(drug_id, year)
);
```

**Quota deduction:** Each fulfilled dispensing request for a controlled drug deducts 1 from the annual quota (1 patient = 1 unit of quota).

**Race condition prevention:** Quota deduction uses a PostgreSQL RPC function with `SELECT ... FOR UPDATE` to prevent double-counting under concurrent requests:
```sql
CREATE OR REPLACE FUNCTION deduct_quota(p_drug_id uuid, p_year integer)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Lock the row for update to prevent race conditions
  PERFORM id FROM drug_quotas
    WHERE drug_id = p_drug_id AND year = p_year
    FOR UPDATE;
  -- No-op: quota is read-only; patients_served_ytd is computed from transactions
END;
$$;
```
`patients_served_ytd` is always computed at read-time by counting fulfilled dispensing requests for that drug in the current year — no stored counter that can drift.

**Quota = 0 or not set behaviour:**
- If `drug_quotas` row does not exist for the current year → display "No quota set" and status = ⚠ Warning
- If `quota_limit = 0` → display "Quota exhausted" and status = 🔴 Critical
- MO Dashboard shows these states so MO knows not to request that drug

**Display columns:**

| Drug Name | Annual Quota | Patients Served (YTD) | Remaining | Projected Exhaustion | Status |
|-----------|-------------|----------------------|-----------|---------------------|--------|
| Morphine  | 60          | 42                   | 18        | Aug 2026            | ⚠ Warning |

**Status thresholds:**
- 🔴 Critical — ≤10% remaining (or quota=0 or no quota set)
- ⚠ Warning — ≤25% remaining
- ✅ Healthy — >25% remaining

**Projected exhaustion** = today + (remaining ÷ avg patients/month)
- If avg patients/month = 0 (no history) → display "No usage data"
- If remaining = 0 → display "Exhausted"

**Admin can set/update quotas** from Drug Master page (per drug, per year).

---

### Non-Controlled Drugs — Tablet Stock Forecast

Reads from existing `transactions` table — no new tables needed.

**Calculations:**
```
used_today        = SUM(kuantiti) WHERE drug_id=X AND jenis='keluaran' AND DATE(created_at) = today
current_stock     = running ledger total (baki_awal + terimaan - keluaran across all time)
avg_daily_usage   = SUM(kuantiti) WHERE jenis='keluaran' AND created_at >= today-30 days, divided by 30
days_remaining    = current_stock ÷ avg_daily_usage   [if avg_daily_usage = 0, show "No usage data"]
reorder_by_date   = today + days_remaining - 7         (7-day procurement lead time)
```

Edge cases:
- `avg_daily_usage = 0` (no dispensing in last 30 days) → `days_remaining = ∞`, display "No recent usage"
- `current_stock ≤ 0` → `days_remaining = 0`, status = 🔴 Critical

**Display columns:**

| Drug Name | Current Stock | Used Today | Days Left | Reorder By | Status |
|-----------|--------------|------------|-----------|------------|--------|

**Status thresholds:**
- 🔴 Critical — <7 days remaining (or stock ≤ 0)
- ⚠ Warning — <14 days remaining
- ✅ Healthy — ≥14 days remaining

---

### MO Dashboard Integration

MO Dashboard shows controlled drug quota remaining so MO knows before submitting a request whether quota is available for that drug. If quota is not set or exhausted, the drug row shows a warning badge.

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
- **Rate limit 429 response:** Widget shows inline message "You've reached the limit (20 queries/hour). Please try again later." — no toast, no crash

### Conversation Context

Each request to `ai-query` is **single-turn**: the frontend sends only the current question plus fresh pharmacy data fetched server-side. Prior conversation messages are NOT sent to Claude. The widget shows conversation history visually for UX continuity, but each query is independent.

### Role-Scoped Data Context

The Edge Function fetches only data the user's role is permitted to see. Data is serialised as a JSON summary — no raw SQL, no PII beyond patient name/age where needed.

| Role | Data sent to Claude |
|------|-------------------|
| Admin | All drugs (stock, status, quota), all dispensing_requests (last 30 days), all antibiotic_forms (last 30 days), all drug_quotas |
| FMS | All drugs (stock, status, quota), all dispensing_requests (last 30 days), all antibiotic_forms (last 30 days), drug_quotas |
| Pharmacist | All drugs (stock, status), dispensing_requests (pending + last 30 days), fulfilment log (last 30 days) |
| MO | Own dispensing_requests (last 30 days), controlled drug quotas (drug name + remaining quota), NAG guidelines text |

**MO chat** includes the NAG document text in the system prompt (loaded from Supabase Storage, Anthropic prompt caching applied) — MO can ask clinical questions alongside quota queries.

**NAG document not loaded fallback:** If Supabase Storage fetch fails, MO chat responds: "Clinical guidelines are temporarily unavailable. For quota/request questions, I can still help." Quota data is served normally.

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
**Access:** MO (live in form) + FMS Approvals page (`/specialist`) result shown per submission

### NAG Document Storage

- Source: user-provided structured text (URL: https://sites.google.com/moh.gov.my/nag/home)
- Stored in: Supabase Storage, bucket `nag-documents`, path `nag/nag-2024.txt`
- Loaded as: cached system prompt prefix in `pathway-check` Edge Function using Anthropic prompt caching headers
- **Strictly grounded** — Claude is instructed never to deviate from document content
- If document fails to load from Storage: Edge Function returns HTTP 503 with body `{"error": "NAG document unavailable. Please try again later."}` — client shows amber banner "Pathway check unavailable"

### Antibiotic Form Fields That Trigger Check

The live checker fires when any of these `AntibioticForm` fields change (1.5s debounce):
- `diagnosis` (text)
- `antibiotic_name` (select)
- `indication` / checklist items (checkboxes)
- `allergy_status` (radio/select)
- `duration_days` (number)

Fields that do NOT trigger a check: patient name, IC number, age (demographic only).

### Live Form Checker

Triggers automatically inside `AntibioticForm` page:
- 1.5 second debounce after MO changes any trigger field (see above)
- Sends current form state to `pathway-check` Edge Function
- Result displayed as a banner inside the form (above submit button)

**Result states:**

| State | Banner | Meaning |
|-------|--------|---------|
| ✅ Supported | Green | Checklist matches NAG pathway |
| ⚠ Review | Amber | Partial match — specific weak criterion flagged |
| ❌ Not supported | Red | Does not justify antibiotic per NAG — pathway cited |
| 💬 Refer specialist | Blue | Case complexity exceeds pathway scope |
| ⏳ Checking... | Grey | Request in flight |
| — Unavailable | Amber outline | NAG document or Edge Function unreachable |

**Advisory only** — MO can still submit regardless of result. Banner informs, does not block.

### Pathway Check Result Persistence

When MO submits the antibiotic form, the last pathway check result (`supported` / `review` / `not_supported` / `refer_specialist` / `unavailable`) is stored in `antibiotic_forms.pathway_check_result` (new column, nullable text). This allows FMS to see the result without making a second AI call.

### Approvals Page Integration

FMS Approvals page (`/specialist`) shows the `pathway_check_result` badge alongside each antibiotic form — FMS sees NAG compliance status before approving. No live AI call on this page; badge reads from stored column.

---

## Security Architecture

Applied to **every** Edge Function. Requests are rejected at the earliest failing check.

```
1. CORS                → Allow-Origin: APP_ORIGIN env var (production)
                          + http://localhost:8080 allowed in dev (NODE_ENV=development)
2. JWT verification    → supabase.auth.getUser(token) — rejects expired/invalid tokens
3. Role check          → queries user_roles table — rejects unauthorised roles
4. Rate limiting       → Upstash Redis sliding window per (user_id, function_name)
                          → 429 response: {"error": "Rate limit exceeded", "retry_after_seconds": N}
5. Input validation    → Zod schema — rejects malformed/oversized payloads
6. Prompt sanitization → strips known injection patterns:
                          - "ignore previous instructions"
                          - "you are now" / "pretend you are"
                          - "system:" / "assistant:" prefixes injected in user text
                          - Excess whitespace/newlines used as padding attacks
7. Claude API call     → server-side only, key in Edge Function secrets
8. Audit log write     → ai_audit_logs table
```

### Rate Limits

| Function | Limit | Window | 429 Response |
|----------|-------|--------|-------------|
| `ai-query` | 20 requests | per user per hour | `{"error": "Rate limit exceeded", "retry_after_seconds": N}` |
| `pathway-check` | 10 requests | per user per hour | `{"error": "Rate limit exceeded", "retry_after_seconds": N}` |

### Audit Logging

New table `ai_audit_logs`:
```sql
CREATE TABLE ai_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  role text NOT NULL,                  -- role at time of call (admin/fms/mo/pharmacist)
  function_name text NOT NULL,         -- 'ai-query' or 'pathway-check'
  status_code integer NOT NULL,        -- HTTP status returned (200, 429, 500, etc.)
  tokens_used integer,                 -- null if request was rejected before Claude call
  error_message text,                  -- null on success; error type on failure
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
| `APP_ORIGIN` | Supabase Edge Function secret | CORS allowed origin (production URL) |

---

## New DB Tables Summary

| Table | Purpose |
|-------|---------|
| `drug_quotas` | Annual patient quota per controlled drug, set by admin |
| `ai_audit_logs` | AI call audit trail — user, role, function, status, token count, timestamp |

**New column on existing table:**
| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `antibiotic_forms` | `pathway_check_result` | `text` (nullable) | Last pathway check result stored at submit time |

---

## Implementation Order

1. **Phase 1** — `drug_quotas` table + forecasting UI on FMS + MO dashboards (zero API cost, ship first)
2. **Phase 2** — `ai-query` Edge Function + Upstash setup + chat widget in AppLayout
3. **Phase 3** — `pathway-check` Edge Function + NAG document storage + live form checker + approvals badge

Each phase is independently deployable.
