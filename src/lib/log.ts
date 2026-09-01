// Structured JSON-line logging for the worker.
//
// Every line is a single JSON object so a log drain can alert on
// `"level":"error"` or `"event":"job.alert"`. Values are redacted before they
// are written: never log Authorization headers, JOB_SECRET, Stripe secrets or
// raw webhook bodies.

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const SENSITIVE_KEY = /(secret|token|authorization|apikey|api_key|password|cookie|signature|key)$/i;

const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /\bBearer\s+\S+/gi,
  /\bsk_(?:test|live)_[A-Za-z0-9]+/g,
  /\bwhsec_[A-Za-z0-9]+/g,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

function scrubString(value: string): string {
  let out = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) out = out.replace(pattern, "[redacted]");
  return out.length > 2000 ? `${out.slice(0, 2000)}…` : out;
}

/** Recursively redact secret-looking keys and values. Depth-capped. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (value instanceof Error) return scrubString(value.message);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(item, depth + 1);
    }
    return out;
  }
  return "[unloggable]";
}

export function logEvent(level: LogLevel, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    ...(redact(fields) as LogFields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (fields: LogFields) => logEvent("debug", fields),
  info: (fields: LogFields) => logEvent("info", fields),
  warn: (fields: LogFields) => logEvent("warn", fields),
  error: (fields: LogFields) => logEvent("error", fields),
  /** Operational alert a human should see in the drain. */
  alert: (fields: LogFields) => logEvent("error", { event: "job.alert", ...fields }),
};

/** Reuse an inbound request id when present so traces stitch together. */
export function requestId(request?: Request): string {
  const inbound =
    request?.headers.get("x-request-id") ?? request?.headers.get("cf-ray") ?? null;
  if (inbound && /^[A-Za-z0-9_.:-]{6,80}$/.test(inbound)) return inbound;
  return crypto.randomUUID();
}
