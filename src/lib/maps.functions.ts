import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

    // The origin the browser iframe will send as its Referer. Behind the
    // sandbox's localhost rewrite the public host lives in x-forwarded-host;
    // elsewhere the request URL is authoritative (the header is spoofable).
    let origin: string | null = null;
    const request = getRequest();
    if (request) {
      const requestUrl = new URL(request.url);
      const sandboxHost =
        requestUrl.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
      origin = sandboxHost ? `https://${sandboxHost}` : requestUrl.origin;
    }

    // Google rejects embeds when the Maps Embed API isn't enabled for the key or
    // when the key's website restrictions exclude this domain. Probe first so
    // the page can show a graceful fallback instead of Google's error frame.
    // Keys with website restrictions reject empty-referer requests, so the probe
    // must send the same Referer the browser iframe will send.
    try {
      const probe = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: origin ? { Referer: `${origin}/` } : undefined,
        signal: AbortSignal.timeout(4000),
      });
      if (!probe.ok) {
        console.error("[maps] embed rejected by Google", probe.status, "origin:", origin);
        return { ok: false as const, reason: "rejected" as const };
      }
    } catch (error) {
      console.error("[maps] embed probe failed", error);
      return { ok: false as const, reason: "rejected" as const };
    }

    return { ok: true as const, url };
  });
