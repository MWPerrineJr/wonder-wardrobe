/** Calendar outbox helpers with no path aliases so Node's test runner can import them. */

export const CALENDAR_MAX_ATTEMPTS = 8;

type InsertResult = {
  error: { message: string; code?: string } | null;
};

type AdminLike = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<InsertResult> | InsertResult;
  };
};

/** Queue a Google Calendar sync after a booking is confirmed. Duplicate booking ids are ignored. */
export async function enqueueCalendarSync(admin: AdminLike, bookingId: string): Promise<void> {
  const inserted = await admin.from("booking_calendar_outbox").insert({ booking_id: bookingId });
  if (inserted.error && inserted.error.code !== "23505") {
    throw new Error(inserted.error.message || "Could not enqueue calendar sync");
  }
}
