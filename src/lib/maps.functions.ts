import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getMapEmbedUrl = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ address: z.string().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key || key.trim() === "") {
      return { ok: false as const, reason: "missing" as const };
    }
    const url = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
      key.trim(),
    )}&q=${encodeURIComponent(data.address)}`;

    // Google rejects embeds when the Maps Embed API isn't enabled for the key or
    // when referrer restrictions exclude this domain. Probe first so the page can
    // show a graceful fallback instead of Google's error frame.
    try {
      const probe = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
      });
      if (!probe.ok) {
        console.error("[maps] embed rejected by Google", probe.status);
        return { ok: false as const, reason: "rejected" as const };
      }
    } catch (error) {
      console.error("[maps] embed probe failed", error);
      return { ok: false as const, reason: "rejected" as const };
    }

    return { ok: true as const, url };
  });