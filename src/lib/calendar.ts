/**
 * Calendar helpers shared by client and server.
 * Builds a Google Calendar template URL and an RFC 5545 .ics document
 * for a single appointment. No dependencies, safe in the browser.
 */

export type CalendarEvent = {
  title: string;
  description?: string | null;
  location?: string | null;
  /** ISO instant */
  startsAt: string;
  /** ISO instant */
  endsAt: string;
  /** Absolute link back to the shop page */
  url?: string | null;
  /** Stable id so re-adding updates instead of duplicating */
  uid?: string | null;
};

/** 20260820T140000Z — the only timestamp form both Google and Apple accept everywhere. */
export function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid appointment time");
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}${String(
    d.getUTCMinutes(),
  ).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`;
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const details = [event.description, event.url].filter(Boolean).join("\n\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(event.startsAt)}/${toUtcStamp(event.endsAt)}`,
  });
  if (details) params.set("details", details);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: new Date(event.startsAt).toISOString(),
    enddt: new Date(event.endsAt).toISOString(),
  });
  const body = [event.description, event.url].filter(Boolean).join("\n\n");
  if (body) params.set("body", body);
  if (event.location) params.set("location", event.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long lines at 75 octets as required by RFC 5545. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

export function buildIcs(event: CalendarEvent): string {
  const description = [event.description, event.url].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Standing Chair//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid || `${toUtcStamp(event.startsAt)}-${Math.random().toString(36).slice(2)}`}@thestandingchair.app`,
    `DTSTAMP:${toUtcStamp(new Date().toISOString())}`,
    `DTSTART:${toUtcStamp(event.startsAt)}`,
    `DTEND:${toUtcStamp(event.endsAt)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push("STATUS:CONFIRMED", "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Appointment reminder", "END:VALARM", "END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n");
}

/** Query string for the .ics download route. */
export function icsDownloadHref(event: CalendarEvent, origin = ""): string {
  const params = new URLSearchParams({
    title: event.title,
    start: new Date(event.startsAt).toISOString(),
    end: new Date(event.endsAt).toISOString(),
  });
  if (event.description) params.set("description", event.description);
  if (event.location) params.set("location", event.location);
  if (event.url) params.set("url", event.url);
  if (event.uid) params.set("uid", event.uid);
  return `${origin}/api/public/calendar-event?${params.toString()}`;
}
