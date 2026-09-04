import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { sendTemplateEmail } from "@/lib/email-templates/send-email";

// Internal app-email dispatch. Only called by this app's own server routes
// (e.g. /api/public/emails/survey-invite), which authenticate their callers
// first. Not reachable from the browser in any meaningful way: an unknown
// template name is rejected and the payload shape is fixed.

const payloadSchema = z.object({
  templateName: z.string().min(1),
  recipientEmail: z.string().email(),
  idempotencyKey: z.string().min(8),
  templateData: z.record(z.unknown()).optional(),
});

const ALLOWED = new Set(["survey-invite"]);

export const Route = createFileRoute("/lovable/email/transactional/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });
        if (!ALLOWED.has(parsed.data.templateName)) {
          return new Response("Unknown template", { status: 400 });
        }

        try {
          const result = await sendTemplateEmail(
            parsed.data.templateName,
            parsed.data.recipientEmail,
            {
              templateData: parsed.data.templateData ?? {},
              idempotencyKey: parsed.data.idempotencyKey,
            },
          );
          // A suppressed recipient is a final, non-retryable outcome.
          return Response.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return new Response(message.slice(0, 500), { status: 502 });
        }
      },
    },
  },
});
