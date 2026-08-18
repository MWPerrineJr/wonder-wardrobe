// Keeps raw Postgres/PostgREST error text server-side. Clients get a generic
// message unless the database raised one of our own user-facing validations.
const SAFE_MESSAGES = new Set([
  "Appointment must end after it starts",
  "Selected service does not belong to this shop",
  "Selected provider does not belong to this shop",
  "That time slot is already booked for this provider",
]);

const GENERIC = "Something went wrong, please try again.";

export function dbError(error: unknown, context: string): Error {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  console.error(`[db:${context}]`, error);

  return new Error(SAFE_MESSAGES.has(raw.trim()) ? raw.trim() : GENERIC);
}
