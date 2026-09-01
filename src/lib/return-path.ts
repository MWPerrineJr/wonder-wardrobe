import { z } from "zod";

import { CANONICAL_ORIGIN } from "./site-origin";

/**
 * Return addresses for hosted payment flows (checkout, billing portal, payout
 * onboarding) are never accepted as absolute URLs from the browser — that is an
 * open redirect a phishing link can abuse. Callers send a relative path only and
 * the server composes the final URL against the deployment's own origin.
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Normalize a client-supplied return path, or return null when unusable. */
export function normalizeReturnPath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > 512) return null;
  if (CONTROL_CHARS.test(raw)) return null;
  // Reject anything that could escape the current origin.
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("\\")) return null;
  if (raw.includes("://")) return null;
  return raw;
}

export const returnPathSchema = z
  .string()
  .transform((value, ctx) => {
    const normalized = normalizeReturnPath(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Return path must be a relative path on this site, e.g. /owner?tab=payments",
      });
      return z.NEVER;
    }
    return normalized;
  });

/** Server-side base origin for hosted-flow return URLs. Always https in production. */
export function returnUrlBase(): string {
  const configured = process.env["APP_URL"]?.trim();
  const base = configured && configured.length > 0 ? configured : CANONICAL_ORIGIN;
  const url = new URL(base);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("APP_URL must be an https origin");
  }
  return url.origin;
}

/** Compose a safe absolute return URL from a validated relative path. */
export function resolveReturnUrl(path: string, extraParams?: Record<string, string>): string {
  const safe = normalizeReturnPath(path) ?? "/";
  const url = new URL(safe, returnUrlBase());
  if (url.origin !== returnUrlBase()) throw new Error("Invalid return path");
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
