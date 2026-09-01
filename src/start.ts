import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { inspectPaymentsConfig, logPaymentsConfigOnce } from "./lib/payments-env";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const paymentsConfigMiddleware = createMiddleware().server(async ({ next }) => {
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
    console.error(error);
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
