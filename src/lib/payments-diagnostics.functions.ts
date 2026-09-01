import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { inspectPaymentsConfig, type PaymentsDiagnostic } from "@/lib/payments-env";

export type PaymentsDiagnosticsView = PaymentsDiagnostic & {
  appUrlConfigured: boolean;
};

export const getPaymentsDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PaymentsDiagnosticsView> => {
    const diagnostic = inspectPaymentsConfig();
    return {
      ...diagnostic,
      appUrlConfigured: Boolean(process.env["APP_URL"]?.trim()),
    };
  });
