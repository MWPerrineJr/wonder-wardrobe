import { createFileRoute } from "@tanstack/react-router";

import { healthResponse, livenessReport } from "@/lib/health";

export const Route = createFileRoute("/api/public/health")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => healthResponse(livenessReport(), 200),
    },
  },
});
