import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY verification route. Signs a synthetic event with the configured
// webhook secret and posts it twice to confirm signature acceptance and
// idempotency. Returns status codes only. Deleted immediately after use.
export const Route = createFileRoute("/api/public/tmp-webhook-check")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const secret = process.env["PAYMENTS_LIVE_WEBHOOK_SECRET"];
        if (!secret) return Response.json({ error: "no secret" }, { status: 500 });
        const eventId = `evt_test_${Date.now()}`;
        const body = JSON.stringify({
          id: eventId,
          type: "ping.test",
          data: { object: {} },
        });
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const signed = await crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(`${timestamp}.${body}`),
        );
        const sig = Array.from(new Uint8Array(signed))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const url = new URL("/api/public/payments/webhook?env=live", request.url);
        const post = async () => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "stripe-signature": `t=${timestamp},v1=${sig}`, "content-type": "application/json" },
            body,
          });
          return { status: res.status, body: await res.text() };
        };
        const first = await post();
        const second = await post();
        const tampered = await fetch(url, {
          method: "POST",
          headers: { "stripe-signature": `t=${timestamp},v1=${"0".repeat(64)}` },
          body,
        });
        return Response.json({ eventId, first, second, tamperedStatus: tampered.status });
      },
    },
  },
});
