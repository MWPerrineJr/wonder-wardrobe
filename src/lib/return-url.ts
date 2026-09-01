export class ReturnUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReturnUrlError";
  }
}

export const RETURN_PATHS = {
  booking: "/account",
  billingCheckout: "/owner/feedback?billing=complete",
  billingPortal: "/owner/feedback",
  payouts: "/owner?payouts=return",
} as const;

const MAX_LENGTH = 2048;

type EnvLike = Record<string, string | undefined>;

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function hasControlChars(value: string): boolean {
  // Reject ASCII control characters in untrusted URL input.
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001F\u007F\\]/.test(value);
}

function parseOriginUrl(raw: string, label: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new ReturnUrlError(`${label} is not configured`);
  if (trimmed.startsWith("//") || hasControlChars(trimmed)) {
    throw new ReturnUrlError(`${label} is invalid`);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ReturnUrlError(`${label} is invalid`);
  }

  if (url.username || url.password) throw new ReturnUrlError(`${label} is invalid`);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ReturnUrlError(`${label} is invalid`);
  }
  if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
    throw new ReturnUrlError(`${label} must use HTTPS`);
  }
  return url;
}

export function configuredAppOrigin(env: EnvLike = process.env): string {
  return parseOriginUrl(env["APP_URL"] ?? "", "APP_URL").origin;
}

export function allowedReturnOrigins(env: EnvLike = process.env): Set<string> {
  const app = parseOriginUrl(env["APP_URL"] ?? "", "APP_URL");
  const origins = new Set<string>([app.origin]);

  if (isLoopbackHost(app.hostname)) {
    const port = app.port ? `:${app.port}` : "";
    origins.add(`${app.protocol}//localhost${port}`);
    origins.add(`${app.protocol}//127.0.0.1${port}`);
    origins.add(`${app.protocol}//[::1]${port}`);
  }

  for (const part of (env["APP_URL_ALLOWLIST"] ?? "").split(",")) {
    const item = part.trim();
    if (!item) continue;
    origins.add(parseOriginUrl(item, "APP_URL_ALLOWLIST").origin);
  }

  return origins;
}

function assertAllowedReturnUrl(url: URL, allowed: Set<string>): void {
  if (url.username || url.password) throw new ReturnUrlError("Return URL is not allowed");
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ReturnUrlError("Return URL is not allowed");
  }
  if (!allowed.has(url.origin)) throw new ReturnUrlError("Return URL is not allowed");
}

export function withSearchParams(url: string, params: Record<string, string>): string {
  const resolved = new URL(url);
  for (const [key, value] of Object.entries(params)) resolved.searchParams.set(key, value);
  return resolved.toString();
}

/** Build a same-app return URL for Stripe-hosted flows. Relative paths use APP_URL. */
export function resolveAppReturnUrl(
  raw: string | null | undefined,
  options: { fallbackPath?: string; env?: EnvLike } = {},
): string {
  const env = options.env ?? process.env;
  const appOrigin = configuredAppOrigin(env);
  const allowed = allowedReturnOrigins(env);
  const fallback = options.fallbackPath ?? "/";
  const input = (raw ?? fallback).trim() || fallback;

  if (input.length > MAX_LENGTH || hasControlChars(input)) {
    throw new ReturnUrlError("Return URL is not allowed");
  }

  let resolved: URL;
  try {
    resolved = input.startsWith("/") ? new URL(input, appOrigin) : new URL(input);
  } catch {
    throw new ReturnUrlError("Return URL is not allowed");
  }

  if (input.startsWith("/")) {
    if (!allowed.has(resolved.origin) || resolved.origin !== new URL(appOrigin).origin) {
      throw new ReturnUrlError("Return URL is not allowed");
    }
  }

  assertAllowedReturnUrl(resolved, allowed);
  resolved.hash = "";
  return resolved.toString();
}
