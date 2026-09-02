import { createFileRoute } from "@tanstack/react-router";

import { healthResponse, readinessReport } from "@/lib/health";
import { inspectPaymentsConfig } from "@/lib/payments-env";

export const Route = createFileRoute("/api/public/ready")({
  server: {
    handlers: {
      GET: async () => {
        const diagnostic = inspectPaymentsConfig();
        const body = readinessReport(diagnostic.ok, diagnostic.issues);
        return healthResponse(body, diagnostic.serverOk ? 200 : 503);
      },
    },
  },
});
