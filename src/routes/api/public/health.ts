import { createFileRoute } from "@tanstack/react-router";

/**
 * Liveness probe. Always 200 while the worker can run JavaScript — it must not
 * depend on payments, database or email configuration, so an uptime monitor can
 * tell "process down" apart from "process up but misconfigured" (see /ready).
 */
function ok(request: Request): Response {
  const body = {
    status: "ok",
    service: "the-standing-chair",
    time: new Date().toISOString(),
  };
  return Response.json(body, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "x-request-id": request.headers.get("x-request-id") ?? crypto.randomUUID(),
    },
  });
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: ({ request }) => ok(request),
      HEAD: ({ request }) => new Response(null, { status: 200, headers: ok(request).headers }),
      POST: ({ request }) => ok(request),
    },
  },
});
