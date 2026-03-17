# Phase 3 — Live Antibiotic Pathway Checker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live NAG (National Antibiotic Guidelines) pathway checker inside the antibiotic form — MO gets real-time feedback on whether their antibiotic request is supported by guidelines, and FMS sees the compliance badge when reviewing submissions.

**Architecture:** A Supabase Edge Function (`pathway-check`) loads the NAG document from Supabase Storage, uses Anthropic prompt caching to send it as a cached system prompt, and returns one of four verdict states. The result is stored on the `antibiotic_forms` row at submit time. FMS reads the stored result as a badge — no second AI call. The live checker in the form uses a 1.5s debounce hook to avoid spamming the API while MO is typing.

**Tech Stack:** React 18 + TypeScript, Supabase Edge Functions (Deno), Claude Haiku (`claude-haiku-4-5-20251001`) + Anthropic prompt caching, Supabase Storage, React custom hook (usePathwayCheck), Vitest + React Testing Library

---

## Pre-requisites

Before starting, ensure:
1. Phase 1 and Phase 2 are deployed (shared security module exists at `supabase/functions/_shared/security.ts`)
2. NAG document is ready as a plain text file (user will provide — save as `nag-2024.txt`)
3. Supabase Storage bucket `nag-documents` is created (public: false, authenticated read only)
4. The `nag-2024.txt` file is uploaded to `nag-documents/nag/nag-2024.txt` in Supabase Storage

---

## Chunk 1: Database Migration

### Task 1: Add pathway_check_result column to antibiotic_forms

**Files:**
- Create: `supabase/migrations/20260317_antibiotic_pathway_check.sql`

> **Context:** `antibiotic_forms` is an existing table. We add a nullable text column to store the last pathway check result when MO submits. Valid values: `supported`, `review`, `not_supported`, `refer_specialist`, `unavailable`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260317_antibiotic_pathway_check.sql
ALTER TABLE public.antibiotic_forms
  ADD COLUMN IF NOT EXISTS pathway_check_result text
    CHECK (pathway_check_result IN ('supported', 'review', 'not_supported', 'refer_specialist', 'unavailable'));
```

- [ ] **Step 2: Apply migration**

Apply via Supabase MCP `apply_migration` tool or SQL editor. Confirm `antibiotic_forms` has the new column.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260317_antibiotic_pathway_check.sql
git commit -m "feat(db): add pathway_check_result column to antibiotic_forms"
```

---

## Chunk 2: Supabase Storage Setup

### Task 2: Create NAG document bucket + upload document

> **Context:** Supabase Storage is accessed in Edge Functions via the service role key. The bucket name is `nag-documents`. The file path within the bucket is `nag/nag-2024.txt`.

- [ ] **Step 1: Create the storage bucket**

In Supabase Dashboard → Storage → New Bucket:
- Name: `nag-documents`
- Public: OFF (private)
- File size limit: 10MB

- [ ] **Step 2: Upload the NAG document**

Upload the user-provided `nag-2024.txt` to path `nag/nag-2024.txt` inside the `nag-documents` bucket.

If using Supabase MCP or CLI:
```bash
# CLI approach (if supabase CLI is authenticated)
supabase storage cp ./nag-2024.txt ss://nag-documents/nag/nag-2024.txt
```

- [ ] **Step 3: Verify upload**

Confirm file appears at `nag-documents/nag/nag-2024.txt` in the Storage dashboard. The Edge Function will download it using the service role key.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: NAG document uploaded to Supabase Storage nag-documents/nag/nag-2024.txt"
```

---

## Chunk 3: Edge Function — pathway-check

### Task 3: Implement pathway-check Edge Function

**Files:**
- Create: `supabase/functions/pathway-check/index.ts`

> **Context:** This function receives the antibiotic form state as JSON. It:
> 1. Validates JWT + role (only `mo` role can call this)
> 2. Checks rate limit (10/user/hour)
> 3. Validates input with Zod
> 4. Downloads NAG text from Supabase Storage (with in-memory cache for the process lifetime — Deno modules are singletons per isolate)
> 5. Calls Claude Haiku with the NAG document as a cached system prompt prefix
> 6. Returns `{ verdict: "supported" | "review" | "not_supported" | "refer_specialist", explanation: string }`
>
> **Anthropic prompt caching:** Prefix the NAG document in the system prompt with `{"type": "text", "text": "...", "cache_control": {"type": "ephemeral"}}`. This caches the NAG tokens across requests (5-minute TTL, renewed on each use). Use the `anthropic-beta: prompt-caching-2024-07-31` header.

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/pathway-check/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  verifyJWT,
  getUserRole,
  checkRateLimit,
  sanitizeInput,
  corsHeaders,
  writeAuditLog,
} from "../_shared/security.ts";

const RATE_LIMIT = 10; // per user per hour
const FUNCTION_NAME = "pathway-check";

// In-memory cache for NAG document (survives across requests in same Deno isolate)
let nagDocumentCache: string | null = null;

const RequestSchema = z.object({
  diagnosis:      z.string().max(500).optional(),
  antibiotic:     z.string().max(200).optional(),
  indication:     z.string().max(1000).optional(),
  duration_days:  z.number().int().min(0).max(365).optional(),
  allergy_status: z.string().max(200).optional(),
  checklist:      z.record(z.unknown()).optional(),
  patient_age:    z.number().int().min(0).max(150).optional(),
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors, status: 204 });
  }

  // ── 1. JWT verification ──────────────────────────────────────────────────
  const { userId, error: jwtError } = await verifyJWT(req.headers.get("authorization"));
  if (jwtError) {
    return new Response(JSON.stringify({ error: jwtError }), { status: 401, headers: cors });
  }

  // ── 2. Role check — only 'mo' role can use pathway-check ─────────────────
  const role = await getUserRole(userId!);
  if (role !== "mo") {
    return new Response(JSON.stringify({ error: "Unauthorized: only MO role can use pathway check" }), { status: 403, headers: cors });
  }

  // ── 3. Rate limit ─────────────────────────────────────────────────────────
  const { allowed, retryAfterSeconds } = await checkRateLimit(userId!, FUNCTION_NAME, RATE_LIMIT);
  if (!allowed) {
    await writeAuditLog({ userId: userId!, role, functionName: FUNCTION_NAME, statusCode: 429, errorMessage: "rate_limit_exceeded" });
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", retry_after_seconds: retryAfterSeconds }),
      { status: 429, headers: cors },
    );
  }

  // ── 4. Input validation ───────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.issues }), { status: 400, headers: cors });
  }

  // ── 5. Load NAG document ──────────────────────────────────────────────────
  if (!nagDocumentCache) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data, error } = await supabase.storage
        .from("nag-documents")
        .download("nag/nag-2024.txt");
      if (error || !data) throw new Error("Storage fetch failed");
      nagDocumentCache = await data.text();
    } catch {
      await writeAuditLog({ userId: userId!, role, functionName: FUNCTION_NAME, statusCode: 503, errorMessage: "nag_document_unavailable" });
      return new Response(
        JSON.stringify({ error: "NAG document unavailable. Please try again later." }),
        { status: 503, headers: cors },
      );
    }
  }

  // ── 6. Build form summary ─────────────────────────────────────────────────
  const formData = parsed.data;
  const formSummary = sanitizeInput(
    `Diagnosis: ${formData.diagnosis ?? "not specified"}
Antibiotic requested: ${formData.antibiotic ?? "not specified"}
Indication/symptoms: ${formData.indication ?? "not specified"}
Checklist findings: ${JSON.stringify(formData.checklist ?? {})}
Duration: ${formData.duration_days ?? "not specified"} days
Allergy status: ${formData.allergy_status ?? "not specified"}
Patient age: ${formData.patient_age ?? "not specified"} years`
  );

  // ── 7. Claude API call with prompt caching ────────────────────────────────
  const anthropic = new Anthropic({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
    defaultHeaders: {
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
  });

  let verdict: "supported" | "review" | "not_supported" | "refer_specialist" = "refer_specialist";
  let explanation = "";
  let tokensUsed = 0;

  const systemPrompt = `You are a strict clinical pathway checker for a Malaysian government clinic.
Your ONLY job is to assess whether an antibiotic prescription matches the NAG (National Antibiotic Guidelines) pathway.

RULES:
1. Answer ONLY based on the NAG document provided.
2. Never suggest antibiotics outside the guidelines.
3. If the case is complex or outside all pathways, return verdict: "refer_specialist".
4. Do NOT make up or infer information not present.

Respond with ONLY valid JSON in this exact format:
{
  "verdict": "supported" | "review" | "not_supported" | "refer_specialist",
  "explanation": "one sentence citing the specific NAG pathway section"
}

Verdict meanings:
- supported: checklist fully matches a NAG pathway
- review: partial match — cite the specific weak criterion
- not_supported: does not meet any NAG pathway for antibiotic use
- refer_specialist: case complexity exceeds pathway scope`;

  try {
    const response = await (anthropic.messages.create as any)({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: [
        {
          type: "text",
          text: `## NAG Guidelines Document:\n${nagDocumentCache}`,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: systemPrompt,
        },
      ] as any,
      messages: [
        {
          role: "user",
          content: `Please assess this antibiotic request:\n\n${formSummary}`,
        },
      ],
    });

    tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    const rawText = response.content[0].type === "text" ? response.content[0].text : "{}";

    // Parse Claude's JSON response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (["supported", "review", "not_supported", "refer_specialist"].includes(parsed.verdict)) {
        verdict = parsed.verdict;
        explanation = String(parsed.explanation ?? "").slice(0, 500);
      }
    }
  } catch {
    await writeAuditLog({ userId: userId!, role, functionName: FUNCTION_NAME, statusCode: 500, errorMessage: "claude_api_error" });
    return new Response(
      JSON.stringify({ error: "AI service temporarily unavailable" }),
      { status: 500, headers: cors },
    );
  }

  // ── 8. Audit log ──────────────────────────────────────────────────────────
  await writeAuditLog({ userId: userId!, role, functionName: FUNCTION_NAME, statusCode: 200, tokensUsed });

  return new Response(
    JSON.stringify({ verdict, explanation }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
```

- [ ] **Step 2: Deploy Edge Function**

```bash
supabase functions deploy pathway-check
```

Or use Supabase MCP `deploy_edge_function` tool.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/pathway-check/index.ts
git commit -m "feat(edge): add pathway-check Edge Function with NAG prompt caching"
```

---

## Chunk 4: React — Live Pathway Check Hook

### Task 4: usePathwayCheck custom hook

**Files:**
- Create: `src/hooks/usePathwayCheck.ts`
- Create: `src/hooks/usePathwayCheck.test.ts`

> **Context:** This hook takes form fields that trigger a check and returns `{ verdict, explanation, status }` where status is `"idle" | "checking" | "done" | "error" | "unavailable"`. It debounces 1.5 seconds before firing. It calls `POST /functions/v1/pathway-check` with the Supabase session token.

- [ ] **Step 1: Write tests first**

Create `src/hooks/usePathwayCheck.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePathwayCheck } from "./usePathwayCheck";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { access_token: "tok" } }, error: null })
      ),
    },
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("usePathwayCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() =>
      usePathwayCheck({ diagnosis: "", antibiotic: "", indication: "" })
    );
    expect(result.current.status).toBe("idle");
  });

  it("stays idle when no trigger fields are set", () => {
    const { result } = renderHook(() =>
      usePathwayCheck({ diagnosis: "", antibiotic: "", indication: "" })
    );
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.status).toBe("idle");
  });

  it("transitions to checking after debounce when fields are set", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ verdict: "supported", explanation: "Matches UTI pathway" }),
    });

    const { result } = renderHook(() =>
      usePathwayCheck({ diagnosis: "UTI", antibiotic: "Trimethoprim", indication: "Dysuria" })
    );

    act(() => { vi.advanceTimersByTime(1600); });

    await waitFor(() => {
      expect(result.current.status).toBe("done");
    });

    expect(result.current.verdict).toBe("supported");
    expect(result.current.explanation).toBe("Matches UTI pathway");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/hooks/usePathwayCheck.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement usePathwayCheck**

```typescript
// src/hooks/usePathwayCheck.ts
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PathwayVerdict =
  | "supported"
  | "review"
  | "not_supported"
  | "refer_specialist"
  | null;

export type PathwayStatus = "idle" | "checking" | "done" | "error" | "unavailable";

interface FormFields {
  diagnosis?: string;
  antibiotic?: string;
  indication?: string;
  duration_days?: number;
  allergy_status?: string;
  checklist?: Record<string, unknown>;
  patient_age?: number;
}

interface PathwayCheckResult {
  verdict: PathwayVerdict;
  explanation: string;
  status: PathwayStatus;
}

const DEBOUNCE_MS = 1500;

function hasContent(fields: FormFields): boolean {
  return !!(fields.diagnosis || fields.antibiotic || fields.indication);
}

export function usePathwayCheck(fields: FormFields): PathwayCheckResult {
  const [verdict, setVerdict] = useState<PathwayVerdict>(null);
  const [explanation, setExplanation] = useState("");
  const [status, setStatus] = useState<PathwayStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasContent(fields)) {
      setStatus("idle");
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setStatus("checking");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token ?? "";

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pathway-check`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(fields),
          }
        );

        if (resp.status === 503) {
          setStatus("unavailable");
          setVerdict(null);
          return;
        }

        if (resp.status === 429) {
          setStatus("unavailable");
          setVerdict(null);
          return;
        }

        if (!resp.ok) {
          setStatus("error");
          return;
        }

        const data = await resp.json();
        setVerdict(data.verdict ?? null);
        setExplanation(data.explanation ?? "");
        setStatus("done");
      } catch {
        setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    fields.diagnosis,
    fields.antibiotic,
    fields.indication,
    fields.duration_days,
    fields.allergy_status,
    fields.patient_age,
    JSON.stringify(fields.checklist),
  ]);

  return { verdict, explanation, status };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/hooks/usePathwayCheck.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePathwayCheck.ts src/hooks/usePathwayCheck.test.ts
git commit -m "feat(phase3): add usePathwayCheck debounced hook"
```

---

## Chunk 5: Antibiotic Form — Live Banner

### Task 5: Add pathway check banner to AntibioticForm

**Files:**
- Create: `src/components/PathwayCheckBanner.tsx`
- Modify: `src/pages/AntibioticForm.tsx`

> **Context:** `AntibioticForm` is the existing page at `src/pages/AntibioticForm.tsx`. It already has form state for `diagnosis`, `antibiotic_name` (inferred from checklist), `checklist` (a nested `ChecklistState` object), and patient details. When MO submits, the form inserts a row into `antibiotic_forms`. We need to:
> 1. Add a `PathwayCheckBanner` above the submit button
> 2. Store the `verdict` in the insert payload as `pathway_check_result`
>
> The `PathwayCheckBanner` is a separate component to keep AntibioticForm from growing larger.

- [ ] **Step 1: Create PathwayCheckBanner component**

Create `src/components/PathwayCheckBanner.tsx`:

```typescript
// src/components/PathwayCheckBanner.tsx
import { Loader2, CheckCircle2, AlertTriangle, XCircle, MessageSquare, WifiOff } from "lucide-react";
import type { PathwayVerdict, PathwayStatus } from "@/hooks/usePathwayCheck";

interface Props {
  status: PathwayStatus;
  verdict: PathwayVerdict;
  explanation: string;
}

const VERDICT_CONFIG = {
  supported: {
    icon: CheckCircle2,
    bg: "bg-green-50 border-green-300 text-green-800",
    label: "Supported by NAG",
  },
  review: {
    icon: AlertTriangle,
    bg: "bg-amber-50 border-amber-300 text-amber-800",
    label: "Review Recommended",
  },
  not_supported: {
    icon: XCircle,
    bg: "bg-red-50 border-red-300 text-red-800",
    label: "Not Supported by NAG",
  },
  refer_specialist: {
    icon: MessageSquare,
    bg: "bg-blue-50 border-blue-300 text-blue-800",
    label: "Refer to Specialist",
  },
};

export default function PathwayCheckBanner({ status, verdict, explanation }: Props) {
  if (status === "idle") return null;

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking NAG pathway...
      </div>
    );
  }

  if (status === "unavailable" || status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
        <WifiOff className="h-4 w-4" />
        Pathway check temporarily unavailable. You can still submit.
      </div>
    );
  }

  if (!verdict) return null;

  const config = VERDICT_CONFIG[verdict];
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${config.bg}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <span className="font-medium">{config.label}</span>
        {explanation && <p className="text-xs mt-0.5 opacity-90">{explanation}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write test for PathwayCheckBanner**

Create `src/components/PathwayCheckBanner.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PathwayCheckBanner from "./PathwayCheckBanner";

describe("PathwayCheckBanner", () => {
  it("renders nothing when idle", () => {
    const { container } = render(
      <PathwayCheckBanner status="idle" verdict={null} explanation="" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows checking indicator", () => {
    render(<PathwayCheckBanner status="checking" verdict={null} explanation="" />);
    expect(screen.getByText(/Checking NAG pathway/i)).toBeInTheDocument();
  });

  it("shows Supported by NAG when verdict is supported", () => {
    render(
      <PathwayCheckBanner status="done" verdict="supported" explanation="Matches UTI pathway Section 3.1" />
    );
    expect(screen.getByText(/Supported by NAG/i)).toBeInTheDocument();
    expect(screen.getByText(/Matches UTI pathway Section 3.1/i)).toBeInTheDocument();
  });

  it("shows Not Supported by NAG when verdict is not_supported", () => {
    render(
      <PathwayCheckBanner status="done" verdict="not_supported" explanation="No pathway supports viral pharyngitis" />
    );
    expect(screen.getByText(/Not Supported by NAG/i)).toBeInTheDocument();
  });

  it("shows unavailable message on error", () => {
    render(<PathwayCheckBanner status="error" verdict={null} explanation="" />);
    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run banner tests**

```bash
npx vitest run src/components/PathwayCheckBanner.test.tsx
```

Expected: PASS (5 tests).

- [ ] **Step 4: Integrate into AntibioticForm**

In `src/pages/AntibioticForm.tsx`:

**4a.** Add imports at the top:
```typescript
import { usePathwayCheck } from "@/hooks/usePathwayCheck";
import PathwayCheckBanner from "@/components/PathwayCheckBanner";
```

**4b.** Add the hook call inside the component (after existing state declarations). The hook needs the diagnosis, selected antibiotic, indication, duration, allergy status, checklist, and patient age. Looking at the existing form state (around line 60+), extract the relevant fields:

```typescript
// Extract current diagnosis section from form state
const [diagnosisSection, setDiagnosisSection] = useState<string>("");
// (this field already exists in the form — find the existing state and use it)

const { verdict: pathwayVerdict, explanation: pathwayExplanation, status: pathwayStatus } = usePathwayCheck({
  diagnosis: diagnosisSection,   // use whatever existing state variable holds the diagnosis category
  antibiotic: selectedAntibiotic, // use existing antibiotic state
  indication: notes,              // use existing notes/indication state
  checklist: checklist,           // existing ChecklistState
  patient_age: getAgeFromIC(icNo) ?? undefined,  // derived from IC
});
```

> **Note:** AntibioticForm's existing state variable names need to be mapped correctly. Read the full file (lines 58–end) to find the exact variable names for: diagnosis category, selected antibiotic, clinical notes, and the checklist state. Map them to the hook parameters above.

**4c.** Add the banner above the submit button. Find the submit button in the JSX and add just above it:
```tsx
<PathwayCheckBanner
  status={pathwayStatus}
  verdict={pathwayVerdict}
  explanation={pathwayExplanation}
/>
```

**4d.** Persist the verdict on submit. In the form submission handler (the function that inserts to `antibiotic_forms`), add `pathway_check_result` to the insert payload:
```typescript
pathway_check_result: pathwayVerdict ?? "unavailable",
```

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PathwayCheckBanner.tsx src/components/PathwayCheckBanner.test.tsx src/pages/AntibioticForm.tsx src/hooks/usePathwayCheck.ts
git commit -m "feat(phase3): add live NAG pathway check banner to antibiotic form"
```

---

## Chunk 6: FMS/Specialist Dashboard — Pathway Result Badge

### Task 6: Show pathway_check_result badge in SpecialistDashboard

**Files:**
- Modify: `src/pages/SpecialistDashboard.tsx`

> **Context:** `SpecialistDashboard` (`src/pages/SpecialistDashboard.tsx`) is where FMS reviews antibiotic forms. The antibiotic forms query already fetches all pending forms. We need to:
> 1. Add `pathway_check_result` to the select query
> 2. Add a badge column to the table showing the stored verdict

- [ ] **Step 1: Write test**

Add to `src/pages/SpecialistDashboard.test.tsx` (create if it doesn't exist):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SpecialistDashboard from "./SpecialistDashboard";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ role: "fms", user: { id: "u1" }, profile: null, loading: false })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

describe("SpecialistDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders 'NAG Check' column header in antibiotic forms table", () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={makeQC()}>
          <SpecialistDashboard />
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/NAG Check/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/pages/SpecialistDashboard.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Update SpecialistDashboard**

In `src/pages/SpecialistDashboard.tsx`:

**3a.** Update the antibiotic forms query to include `pathway_check_result`:
```typescript
.select("*, pathway_check_result")
// (add to the existing select string)
```

**3b.** Add a `NAG Check` column header to the antibiotic table header row:
```tsx
<TableHead>NAG Check</TableHead>
```

**3c.** Add the badge cell in the table body for each form row:
```tsx
<TableCell>
  {(() => {
    const r = (f as any).pathway_check_result;
    if (!r) return <span className="text-xs text-muted-foreground">—</span>;
    const config: Record<string, { label: string; cls: string }> = {
      supported:        { label: "✅ Supported",       cls: "bg-green-100 text-green-700 border-green-300" },
      review:           { label: "⚠ Review",           cls: "bg-amber-100 text-amber-700 border-amber-300" },
      not_supported:    { label: "❌ Not supported",   cls: "bg-red-100 text-red-700 border-red-300" },
      refer_specialist: { label: "💬 Refer specialist", cls: "bg-blue-100 text-blue-700 border-blue-300" },
      unavailable:      { label: "— Unavailable",      cls: "bg-gray-100 text-gray-600 border-gray-300" },
    };
    const c = config[r] ?? { label: r, cls: "" };
    return (
      <Badge variant="outline" className={`text-[10px] ${c.cls}`}>{c.label}</Badge>
    );
  })()}
</TableCell>
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/pages/SpecialistDashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SpecialistDashboard.tsx src/pages/SpecialistDashboard.test.tsx
git commit -m "feat(phase3): add NAG pathway check badge to specialist dashboard"
```

---

## Chunk 7: Smoke Test & Final Commit

- [ ] **Step 1: Manual smoke test**

1. Log in as MO. Navigate to `/request/antibiotik`.
2. Fill in diagnosis = "UTI", fill in checklist symptoms (dysuria, frequency). Confirm "Checking NAG pathway..." banner appears after 1.5 seconds, then resolves to a verdict badge.
3. Submit the form. Confirm the form is submitted.
4. Log in as FMS. Navigate to `/specialist`. Confirm the submitted antibiotic form has a "NAG Check" badge showing the verdict.
5. Test unavailable state: temporarily set wrong `VITE_SUPABASE_URL` → confirm "temporarily unavailable" amber banner appears, MO can still submit.

- [ ] **Step 2: Check rate limiting**

As MO, trigger pathway check 10 times rapidly. Confirm on the 11th, the banner shows "temporarily unavailable" (rate limit hit).

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: No TypeScript errors.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat(phase3): complete antibiotic pathway checker — Phase 3 done"
```
