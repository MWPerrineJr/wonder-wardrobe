const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://maps.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://connector-gateway.lovable.dev https://maps.googleapis.com https://*.googleapis.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://www.google.com",
].join("; ");

export function securityHeaders(request: Request): Record<string, string> {
  const https = new URL(request.url).protocol === "https:";
  const headers: Record<string, string> = {
    "content-security-policy": CSP,
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
  };
  if (https) {
    headers["strict-transport-security"] = "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}

export function applySecurityHeaders(response: Response, request: Request): Response {
  const extras = securityHeaders(request);
  try {
    for (const [key, value] of Object.entries(extras)) {
      if (!response.headers.has(key)) response.headers.set(key, value);
    }
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(extras)) {
      if (!headers.has(key)) headers.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
