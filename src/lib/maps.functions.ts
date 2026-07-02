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
    return { ok: true as const, url };
  });