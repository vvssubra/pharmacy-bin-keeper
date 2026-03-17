// supabase/functions/_shared/security.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Lazy-initialized singleton clients — constructed once per Deno isolate on first use
let _anonClient: ReturnType<typeof createClient> | null = null;
let _adminClient: ReturnType<typeof createClient> | null = null;

function _supabaseAnon() {
  if (!_anonClient) {
    _anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
  }
  return _anonClient;
}

function _supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _adminClient;
}

// ── JWT verification ────────────────────────────────────────────────────────
export async function verifyJWT(authHeader: string | null): Promise<{
  userId: string;
  error?: never;
} | {
  userId?: never;
  error: string;
}> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header" };
  }
  const token = authHeader.slice(7);
  const supabase = _supabaseAnon();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: "Invalid or expired token" };
  return { userId: user.id };
}

// ── Role check ──────────────────────────────────────────────────────────────
export async function getUserRole(userId: string): Promise<string | null> {
  const supabase = _supabaseAdmin();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

// ── Rate limiting (Upstash Redis sliding window) ────────────────────────────
export async function checkRateLimit(
  userId: string,
  functionName: string,
  limitPerHour: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL")!;
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!;

  const key = `rate:${functionName}:${userId}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const windowStart = now - windowMs;

  // Step 1: Clean old entries + check current count + get oldest entry (all in one pipeline)
  const checkPipeline = [
    ["zremrangebyscore", key, "-inf", String(windowStart)],
    ["zcard", key],
    ["zrange", key, "0", "0", "WITHSCORES"],
  ];

  const checkResp = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(checkPipeline),
  });

  if (!checkResp.ok) {
    // Redis unavailable — fail open (allow request)
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const checkResults = await checkResp.json();
  const count = checkResults[1]?.result ?? 0;

  if (count >= limitPerHour) {
    // Over limit — compute retry-after from oldest entry
    const oldestData = checkResults[2]?.result;
    const oldestTimestamp =
      Array.isArray(oldestData) && oldestData[1]
        ? parseInt(oldestData[1])
        : now;
    const retryAfterSeconds = Math.ceil(
      (oldestTimestamp + windowMs - now) / 1000,
    );
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  // Under limit — now add this request
  const addPipeline = [
    ["zadd", key, String(now), String(now)],
    ["pexpire", key, String(windowMs)],
  ];

  const addResp = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(addPipeline),
  });

  if (!addResp.ok) {
    // Redis write failed — allow request anyway (fail open)
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

// ── Prompt injection sanitization ──────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore (all |the )?(previous|prior|above) instructions?/gi,
  /you are now/gi,
  /pretend (you are|to be)/gi,
  /^system:/gim,
  /^assistant:/gim,
  /\n{5,}/g, // excess newline padding
];

export function sanitizeInput(text: string): string {
  let sanitized = text;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[removed]");
  }
  return sanitized.trim().slice(0, 500); // enforce max length server-side
}

// ── CORS headers ────────────────────────────────────────────────────────────
export function corsHeaders(origin: string | null): HeadersInit {
  const appOrigin = Deno.env.get("APP_ORIGIN") ?? "";
  const allowedOrigins = [appOrigin, "http://localhost:8080", "http://localhost:5173"];
  const allowed =
    origin && allowedOrigins.includes(origin) ? origin : (appOrigin || "null");
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ── Audit log writer ────────────────────────────────────────────────────────
export async function writeAuditLog(entry: {
  userId: string;
  role: string;
  functionName: string;
  statusCode: number;
  tokensUsed?: number;
  errorMessage?: string;
}): Promise<void> {
  const supabase = _supabaseAdmin();
  const { error } = await supabase.from("ai_audit_logs").insert({
    user_id:       entry.userId,
    role:          entry.role,
    function_name: entry.functionName,
    status_code:   entry.statusCode,
    tokens_used:   entry.tokensUsed ?? null,
    error_message: entry.errorMessage ?? null,
  });
  if (error) throw new Error(`Audit log write failed: ${error.message}`);
}
