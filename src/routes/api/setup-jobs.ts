import { createFileRoute } from "@tanstack/react-router";

import { provisionJobScheduler } from "@/lib/jobs-provision.functions";

/** Temporary setup-only endpoint. Removed immediately after provisioning. */
export const Route = createFileRoute("/api/setup-jobs")({
  server: {
    handlers: {
      POST: async () => {
        const result = await provisionJobScheduler();
        return Response.json(result);
      },
    },
  },
});
