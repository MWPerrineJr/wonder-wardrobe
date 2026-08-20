import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { buildIcs } from "@/lib/calendar";

// Public, read-only: everything needed for the file comes from the query
// string, so there is nothing to authorize and no stored data is exposed.
const Query = z.object({
  title: z.string().trim().min(1).max(200),
  start: z.string().datetime(),
  end: z.string().datetime(),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(300).optional(),
  url: z.string().url().max(500).optional(),
  uid: z.string().trim().max(120).optional(),
});

export const Route = createFileRoute("/api/public/calendar-event")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          return new Response("Invalid calendar request", { status: 400 });
        }
        const { title, start, end, description, location, url: link, uid } = parsed.data;
        const ics = buildIcs({
          title,
          startsAt: start,
          endsAt: end,
          description: description ?? null,
          location: location ?? null,
          url: link ?? null,
          uid: uid ?? null,
        });
        return new Response(ics, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="appointment.ics"',
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
