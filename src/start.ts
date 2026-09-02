import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { logEvent, redactUnknown } from "./lib/log";
import { inspectPaymentsConfig, logPaymentsConfigOnce } from "./lib/payments-env";
import { readRequestId } from "./lib/request-id";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const paymentsConfigMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    const path = new URL(getRequest().url).pathname;
    if (path === "/api/public/health" || path === "/api/public/ready") {
      return next();
    }
  } catch {
    // Request context is unavailable for some serverFn calls; keep fail-closed.
  }
  logPaymentsConfigOnce();
  const diagnostic = inspectPaymentsConfig();
  if (!diagnostic.ok) {
    return new Response(diagnostic.issues.join("\n"), {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    let requestId = "unknown";
    try {
      requestId = readRequestId(getRequest());
    } catch {
      requestId = "unknown";
    }
    logEvent("error", {
      component: "request",
      event: "unhandled",
      request_id: requestId,
      error: redactUnknown(error),
    });
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [paymentsConfigMiddleware, errorMiddleware],
}));
