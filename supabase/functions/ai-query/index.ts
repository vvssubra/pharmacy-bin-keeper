// supabase/functions/ai-query/index.ts
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

const RequestSchema = z.object({
  question: z.string().min(1).max(500),
});

const RATE_LIMIT = 20; // per user per hour
const FUNCTION_NAME = "ai-query";

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

  // ── 2. Role check ─────────────────────────────────────────────────────────
  const role = await getUserRole(userId!);
  if (!role) {
    return new Response(JSON.stringify({ error: "Unauthorized: no role assigned" }), { status: 403, headers: cors });
  }

  // ── 3. Rate limit ─────────────────────────────────────────────────────────
  const { allowed, retryAfterSeconds } = await checkRateLimit(userId!, FUNCTION_NAME, RATE_LIMIT);
  if (!allowed) {
    try {
      await writeAuditLog({ userId: userId!, role, functionName: FUNCTION_NAME, statusCode: 429, errorMessage: "rate_limit_exceeded" });
    } catch {
      // Audit log failure must not abort the primary response
    }
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

  // ── 5. Sanitize input ─────────────────────────────────────────────────────
  const question = sanitizeInput(parsed.data.question);

  // ── 6. Fetch role-scoped data ─────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const dataContext = await fetchDataContext(supabase, userId!, role);

  // ── 7. Build system prompt ────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(role, dataContext);

  // ── 8. Claude API call ────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

  let tokensUsed = 0;
  let answer = "";

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    });
    tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    answer = response.content[0].type === "text" ? response.content[0].text : "";
  } catch (err) {
    try {
      await writeAuditLog({ userId: userId!, role, functionName: FUNCTION_NAME, statusCode: 500, errorMessage: "claude_api_error" });
    } catch {
      // Audit log failure must not abort the primary response
    }
    return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), { status: 500, headers: cors });
  }

  // ── 9. Audit log ──────────────────────────────────────────────────────────
  try {
    await writeAuditLog({ userId: userId!, role, functionName: FUNCTION_NAME, statusCode: 200, tokensUsed });
  } catch {
    // Audit log failure must not abort the primary response
  }

  return new Response(JSON.stringify({ answer }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

// ── NAG document cache (in-memory, survives across requests in same Deno isolate) ──
let nagDocCache: { text: string; fetchedAt: number } | null = null;
const NAG_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function loadNagDocument(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const now = Date.now();
  if (nagDocCache && (now - nagDocCache.fetchedAt) < NAG_CACHE_TTL_MS) {
    return nagDocCache.text;
  }
  try {
    const { data, error } = await supabase.storage
      .from("nag-documents")
      .download("nag/nag-2024.txt");
    if (error || !data) return nagDocCache?.text ?? null; // Return stale cache on fetch failure
    const text = await data.text();
    nagDocCache = { text, fetchedAt: now };
    return text;
  } catch {
    return nagDocCache?.text ?? null; // Return stale cache on exception
  }
}

// ── Data fetchers ─────────────────────────────────────────────────────────────
async function fetchDataContext(supabase: ReturnType<typeof createClient>, userId: string, role: string): Promise<object> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();
  const currentYear = new Date().getFullYear();

  if (role === "admin" || role === "fms") {
    const [drugsResult, requestsResult, antibioticResult, quotasResult] = await Promise.all([
      supabase.from("drugs").select("drug_name, unit_pengukuran, perlu_kelulusan_pakar, is_active").eq("is_active", true).order("drug_name"),
      supabase.from("dispensing_requests").select("patient_name, status, created_at, drugs(drug_name)").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("antibiotic_forms").select("patient_name, status, diagnosis, created_at").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("drug_quotas").select("quota_limit, year, drugs(drug_name)").eq("year", currentYear),
    ]);
    if (drugsResult.error) console.error("Supabase drugs query error:", drugsResult.error.message);
    if (requestsResult.error) console.error("Supabase dispensing_requests query error:", requestsResult.error.message);
    if (antibioticResult.error) console.error("Supabase antibiotic_forms query error:", antibioticResult.error.message);
    if (quotasResult.error) console.error("Supabase drug_quotas query error:", quotasResult.error.message);
    return {
      drugs: drugsResult.data ?? [],
      dispensing_requests_last_30d: requestsResult.data ?? [],
      antibiotic_forms_last_30d: antibioticResult.data ?? [],
      drug_quotas_current_year: quotasResult.data ?? [],
    };
  }

  if (role === "pharmacist") {
    const [drugsResult, requestsResult] = await Promise.all([
      supabase.from("drugs").select("drug_name, unit_pengukuran, is_active").eq("is_active", true).order("drug_name"),
      supabase.from("dispensing_requests").select("patient_name, status, created_at, drugs(drug_name)").gte("created_at", since),
    ]);
    if (drugsResult.error) console.error("Supabase drugs query error:", drugsResult.error.message);
    if (requestsResult.error) console.error("Supabase dispensing_requests query error:", requestsResult.error.message);
    return {
      drugs: drugsResult.data ?? [],
      dispensing_requests_last_30d: requestsResult.data ?? [],
    };
  }

  if (role === "mo") {
    const [myRequestsResult, quotasResult, nagText] = await Promise.all([
      supabase.from("dispensing_requests").select("patient_name, status, created_at, drugs(drug_name)").eq("submitted_by", userId).gte("created_at", since),
      supabase.from("drug_quotas").select("quota_limit, year, drugs(drug_name)").eq("year", currentYear),
      loadNagDocument(supabase),
    ]);
    if (myRequestsResult.error) console.error("Supabase dispensing_requests query error:", myRequestsResult.error.message);
    if (quotasResult.error) console.error("Supabase drug_quotas query error:", quotasResult.error.message);
    return {
      my_requests_last_30d: myRequestsResult.data ?? [],
      controlled_drug_quotas_current_year: quotasResult.data ?? [],
      _nag_text: nagText,
    };
  }

  return {};
}

function buildSystemPrompt(role: string, dataContext: object): string {
  if (role === "mo") {
    const ctx = dataContext as { _nag_text?: string | null; my_requests_last_30d?: unknown; controlled_drug_quotas_current_year?: unknown };
    const nagText = ctx._nag_text ?? null;
    const cleanData = {
      my_requests_last_30d: ctx.my_requests_last_30d,
      controlled_drug_quotas_current_year: ctx.controlled_drug_quotas_current_year,
    };
    const dataStr = JSON.stringify(cleanData);

    const clinicalBlock = nagText
      ? "For clinical questions: answer ONLY based on the NAG guidelines provided below. If the case does not match any pathway, say \"Refer to specialist\" — never suggest outside the guidelines. Cite the specific NAG pathway when giving clinical advice."
      : "Clinical guidelines are temporarily unavailable. For quota/request questions, I can still help.";

    const nagSection = nagText
      ? `\n\n## NAG (National Antibiotic Guidelines) — use ONLY for clinical questions:\n${nagText}`
      : "";

    return `You are a clinical and pharmacy assistant for a Malaysian government clinic.
${clinicalBlock}
For quota/request questions: answer from the pharmacy data provided.
Be concise and factual. Only use data explicitly present.
If the answer is not in the data, say "I don't have that information."

## Pharmacy Data (current snapshot):
${dataStr}${nagSection}`;
  }

  const dataStr = JSON.stringify(dataContext);
  return `You are a pharmacy management assistant. Answer ONLY from the data provided below.
Do not make up numbers or infer data not present. If the answer is not in the data, say "I don't have that information."
Be concise. Use numbers directly from the data.

## Pharmacy Data (current snapshot):
${dataStr}`;
}
