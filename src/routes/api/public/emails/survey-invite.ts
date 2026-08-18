import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { isAuthorizedJobCall } from "@/lib/jobs.server";

const payloadSchema = z.object({
  templateName: z.literal("survey-invite"),
  recipientEmail: z.string().email(),
  idempotencyKey: z.string().min(8),
  templateData: z.record(z.unknown()),
});

/**
 * Server-side trigger for the review-request email. The survey job is not a
 * signed-in user, so it posts here and this route sends with project
 * credentials after verifying the caller.
 *
 * Sending needs an email domain configured for the project. Until then the
 * project has no transactional send endpoint, so we answer 501 and the job
 * records the invite as blocked with that reason instead of losing it.
 */
export const Route = createFileRoute("/api/public/emails/survey-invite")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedJobCall(request)) return new Response("Unauthorized", { status: 401 });

        const parsed = payloadSchema.safeParse(await request.json());
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });

        const origin = process.env["APP_URL"] ?? new URL(request.url).origin;
        const sendUrl = `${origin.replace(/\/$/, "")}/lovable/email/transactional/send`;

        const probe = await fetch(sendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });

        // No transactional endpoint yet => email domain not configured.
        if (probe.status === 404) {
          return new Response(
            "Email sending is not set up for this project yet — configure an email domain.",
            { status: 501 },
          );
        }
        if (!probe.ok) {
          return new Response((await probe.text()).slice(0, 500), { status: 502 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});