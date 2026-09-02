// Keeps raw Postgres/PostgREST error text server-side. Clients get a generic
// message unless the database raised one of our own user-facing validations.

import { logEvent, redactUnknown } from "./log.ts";

const GENERIC = "Something went wrong, please try again.";

const SAFE_MESSAGES = new Set([
  "Appointment must end after it starts",
  "Selected service does not belong to this shop",
  "Selected provider does not belong to this shop",
  "That time slot is already booked for this provider",
  "No providers are free at that time",
  "Providers cannot change shop assignment, account link, or active status",
  "Providers can only be moved to a shop you own",
  "Providers can only update booking status",
  "Shop ownership cannot be transferred this way",
  "Customers can only cancel a pending or confirmed booking",
  "Customers may only cancel their booking, not modify other fields",
]);

export function dbError(error: unknown, context: string): Error {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  logEvent("error", { component: "db", event: context, error: redactUnknown(error) });

  return new Error(SAFE_MESSAGES.has(raw.trim()) ? raw.trim() : GENERIC);
}
