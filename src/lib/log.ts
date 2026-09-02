/** Shared structured logging. Never write secrets, tokens, or raw request bodies. */

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk_(live|test)_[A-Za-z0-9]+/g, "[redacted]"],
  [/pk_(live|test)_[A-Za-z0-9]+/g, "[redacted]"],
  [/whsec_[A-Za-z0-9]+/g, "[redacted]"],
  [/sb_secret_[A-Za-z0-9]+/g, "[redacted]"],
  [/Bearer\s+\S+/gi, "Bearer [redacted]"],
];

export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function redactSecrets(value: string): string {
  let out = value;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out.slice(0, 500);
}

export function redactUnknown(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value);
  return redactSecrets(raw);
}

export function logEvent(level: LogLevel, fields: LogFields): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
