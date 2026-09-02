const MIN_SECRET_LENGTH = 32;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_FAILURES = 20;

export type JobAuthReason =
  "missing_server_secret" | "insecure_secret" | "missing_bearer" | "mismatch" | "rate_limited";

export type JobAuthResult =
  { ok: true } | { ok: false; status: 401 | 429 | 503; reason: JobAuthReason };

export type JobRateLimitBucket = { count: number; resetAt: number };

export type JobAuthOptions = {
  secret?: string | null;
  publishableKey?: string | null;
  now?: number;
  buckets?: Map<string, JobRateLimitBucket>;
};

const defaultBuckets = new Map<string, JobRateLimitBucket>();

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  return match?.[1] ?? null;
}

function clientKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Constant-time compare that does not log either side. */
export function secretsEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) {
    let acc = 0;
    for (const byte of a) acc ^= byte;
    void acc;
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i]! ^ b[i]!;
  return mismatch === 0;
}

function recordFailure(
  buckets: Map<string, JobRateLimitBucket>,
  key: string,
  now: number,
): boolean {
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX_FAILURES;
}

function isRateLimited(
  buckets: Map<string, JobRateLimitBucket>,
  key: string,
  now: number,
): boolean {
  const current = buckets.get(key);
  return Boolean(current && now < current.resetAt && current.count > RATE_LIMIT_MAX_FAILURES);
}

/**
 * Authorize a scheduled-job caller. Public Supabase keys are never accepted.
 * Fail closed when JOB_SECRET is missing, too short, or equal to the publishable key.
 */
export function authorizeJobCall(request: Request, options: JobAuthOptions = {}): JobAuthResult {
  const now = options.now ?? Date.now();
  const buckets = options.buckets ?? defaultBuckets;
  const secret = (options.secret === undefined ? process.env["JOB_SECRET"] : options.secret) ?? "";
  const publishable =
    (options.publishableKey === undefined
      ? (process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"])
      : options.publishableKey) ?? "";

  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return { ok: false, status: 503, reason: "missing_server_secret" };
  }
  if (publishable && secretsEqual(secret, publishable)) {
    return { ok: false, status: 503, reason: "insecure_secret" };
  }

  const key = clientKey(request);
  if (isRateLimited(buckets, key, now)) {
    return { ok: false, status: 429, reason: "rate_limited" };
  }

  const presented = readBearerToken(request);
  if (!presented) {
    const limited = recordFailure(buckets, key, now);
    if (limited) return { ok: false, status: 429, reason: "rate_limited" };
    return { ok: false, status: 401, reason: "missing_bearer" };
  }
  if (!secretsEqual(presented, secret)) {
    const limited = recordFailure(buckets, key, now);
    if (limited) return { ok: false, status: 429, reason: "rate_limited" };
    return { ok: false, status: 401, reason: "mismatch" };
  }

  buckets.delete(key);
  return { ok: true };
}

export function jobAuthResponse(result: Exclude<JobAuthResult, { ok: true }>): Response {
  const body =
    result.status === 503
      ? "Job scheduler is not configured"
      : result.status === 429
        ? "Too many requests"
        : "Unauthorized";
  return new Response(body, { status: result.status });
}
