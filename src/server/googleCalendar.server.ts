import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import {
  getConnectionKeyForUser,
  touchLastSynced,
} from "@/server/appUserConnections.server";

/**
 * Server-only Google Calendar helpers used by confirmed-booking outbox and
 * cancel/reschedule flows.
 * Every function is best-effort: a Google failure is logged and swallowed so a
 * booking never fails because a provider's calendar was unreachable.
 */

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const CALENDAR_CONNECTOR_ID = "google_calendar";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export function calendarClientApiKey(): string | null {
  return process.env["GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY"] ?? null;
}

async function call(
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CALENDAR_CONNECTOR_ID,
    path,
    init,
  });
}

/** The Google account email behind a connection, or null when unavailable. */
export async function fetchAccountEmail(connectionAPIKey: string): Promise<string | null> {
  try {
    const res = await call(connectionAPIKey, "/oauth2/v2/userinfo");
    if (!res.ok) {
      console.error("[gcal] userinfo failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const body = (await res.json()) as { email?: string };
    return body.email ?? null;
  } catch (e) {
    console.error("[gcal] userinfo error", e);
    return null;
  }
}

/** Which app user (auth user id) owns a provider row. */
async function providerUserId(providerId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("providers")
    .select("user_id")
    .eq("id", providerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export type CalendarEventPayload = {
  summary: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
};

/** Create the event on the provider's primary calendar; stores the event id. */
export async function syncBookingToCalendar(
  bookingId: string,
  providerId: string | null | undefined,
  event: CalendarEventPayload,
): Promise<"synced" | "skipped" | "failed"> {
  if (!providerId) return "skipped";
  try {
    const userId = await providerUserId(providerId);
    if (!userId) return "skipped";
    const connectionAPIKey = await getConnectionKeyForUser(userId, CALENDAR_CONNECTOR_ID);
    if (!connectionAPIKey) return "skipped";

    const res = await call(connectionAPIKey, "/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description ?? undefined,
        location: event.location ?? undefined,
        start: { dateTime: new Date(event.startsAt).toISOString() },
        end: { dateTime: new Date(event.endsAt).toISOString() },
      }),
    });
    if (!res.ok) {
      console.error("[gcal] event insert failed", res.status, (await res.text()).slice(0, 300));
      return "failed";
    }
    const body = (await res.json()) as { id?: string };
    if (body.id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("bookings")
        .update({ google_event_id: body.id })
        .eq("id", bookingId);
    }
    await touchLastSynced(userId, CALENDAR_CONNECTOR_ID);
    return "synced";
  } catch (e) {
    console.error("[gcal] sync error", e);
    return "failed";
  }
}

/** Remove the mirrored event after a cancellation. */
export async function removeBookingFromCalendar(
  providerId: string | null | undefined,
  googleEventId: string | null | undefined,
): Promise<void> {
  if (!providerId || !googleEventId) return;
  try {
    const userId = await providerUserId(providerId);
    if (!userId) return;
    const connectionAPIKey = await getConnectionKeyForUser(userId, CALENDAR_CONNECTOR_ID);
    if (!connectionAPIKey) return;
    const res = await call(
      connectionAPIKey,
      `/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
      { method: "DELETE" },
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.error("[gcal] event delete failed", res.status, (await res.text()).slice(0, 200));
    }
    await touchLastSynced(userId, CALENDAR_CONNECTOR_ID);
  } catch (e) {
    console.error("[gcal] delete error", e);
  }
}

/** Move the mirrored event after a reschedule. */
export async function moveBookingEvent(
  providerId: string | null | undefined,
  googleEventId: string | null | undefined,
  startsAt: string,
  endsAt: string,
): Promise<void> {
  if (!providerId || !googleEventId) return;
  try {
    const userId = await providerUserId(providerId);
    if (!userId) return;
    const connectionAPIKey = await getConnectionKeyForUser(userId, CALENDAR_CONNECTOR_ID);
    if (!connectionAPIKey) return;
    const res = await call(
      connectionAPIKey,
      `/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { dateTime: new Date(startsAt).toISOString() },
          end: { dateTime: new Date(endsAt).toISOString() },
        }),
      },
    );
    if (!res.ok) {
      console.error("[gcal] event patch failed", res.status, (await res.text()).slice(0, 200));
    }
    await touchLastSynced(userId, CALENDAR_CONNECTOR_ID);
  } catch (e) {
    console.error("[gcal] move error", e);
  }
}

/**
 * Busy windows already on the provider's own Google Calendar, so personal
 * commitments block public booking slots. Returns [] on any failure.
 */
export async function listGoogleBusy(
  providerId: string | null | undefined,
  fromIso: string,
  toIso: string,
): Promise<Array<{ start: number; end: number }>> {
  if (!providerId) return [];
  try {
    const userId = await providerUserId(providerId);
    if (!userId) return [];
    const connectionAPIKey = await getConnectionKeyForUser(userId, CALENDAR_CONNECTOR_ID);
    if (!connectionAPIKey) return [];
    const res = await call(connectionAPIKey, "/calendar/v3/freeBusy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: fromIso, timeMax: toIso, items: [{ id: "primary" }] }),
    });
    if (!res.ok) {
      console.error("[gcal] freeBusy failed", res.status, (await res.text()).slice(0, 200));
      return [];
    }
    const body = (await res.json()) as {
      calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
    };
    const busy = body.calendars?.["primary"]?.busy ?? [];
    return busy
      .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
      .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end));
  } catch (e) {
    console.error("[gcal] freeBusy error", e);
    return [];
  }
}
