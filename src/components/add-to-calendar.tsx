import { useState } from "react";

import {
  googleCalendarUrl,
  icsDownloadHref,
  outlookCalendarUrl,
  type CalendarEvent,
} from "@/lib/calendar";

const item =
  "flex items-center gap-2 px-3 py-2 text-left text-body-sm text-on-surface hover:bg-surface-container rounded-md";

/**
 * "Add to calendar" for clients — no sign-in, works with Google, Apple and Outlook.
 */
export function AddToCalendar({
  event,
  variant = "solid",
}: {
  event: CalendarEvent;
  variant?: "solid" | "link";
}) {
  const [open, setOpen] = useState(false);

  const trigger =
    variant === "solid"
      ? "bg-surface border border-border-subtle text-on-surface px-4 py-2 rounded font-bold text-label-md hover:border-primary transition-colors inline-flex items-center gap-2"
      : "text-label-md text-primary font-bold hover:underline inline-flex items-center gap-1";

  return (
    <div className="relative">
      <button type="button" className={trigger} onClick={() => setOpen((v) => !v)}>
        <span className="material-symbols-outlined text-[18px]">event</span>
        Add to calendar
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-2 w-56 rounded-lg border border-border-subtle bg-surface p-1 shadow-lg">
            <a
              className={item}
              href={googleCalendarUrl(event)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              Google Calendar
            </a>
            <a
              className={item}
              href={outlookCalendarUrl(event)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              <span className="material-symbols-outlined text-[18px]">mail</span>
              Outlook.com
            </a>
            <a className={item} href={icsDownloadHref(event)} onClick={() => setOpen(false)}>
              <span className="material-symbols-outlined text-[18px]">download</span>
              Apple / other (.ics)
            </a>
          </div>
        </>
      )}
    </div>
  );
}
