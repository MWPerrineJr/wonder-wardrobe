import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { getMyProviderRange, setBookingStatus, type ProviderBooking } from "@/lib/provider.functions";

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

type ViewMode = "day" | "week" | "month";

const VIEW_LABELS: Record<ViewMode, string> = { day: "Day", week: "Week", month: "Month" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse a YYYY-MM-DD string as a local-time date. */
function parseDay(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function addDays(iso: string, n: number) {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function addMonths(iso: string, n: number) {
  const d = parseDay(iso);
  d.setMonth(d.getMonth() + n);
  return isoDate(d);
}

/** Monday of the week containing the given local date. */
function startOfWeekMonday(iso: string) {
  const d = parseDay(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDate(d);
}

/** First cell (a Monday) of the 6-week month grid containing the given date. */
function monthGridStart(iso: string) {
  return startOfWeekMonday(`${iso.slice(0, 8)}01`);
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function timeRange(b: ProviderBooking) {
  return `${formatTime(b.starts_at)} – ${formatTime(b.ends_at)}`;
}

const statusColor: Record<string, string> = {
  pending: "border-border-subtle text-on-surface-variant",
  confirmed: "border-primary text-primary",
  completed: "border-tertiary text-tertiary",
  cancelled: "border-error text-error",
  no_show: "border-error text-error",
};

const statusDot: Record<string, string> = {
  pending: "bg-on-surface-variant",
  confirmed: "bg-primary",
  completed: "bg-tertiary",
  cancelled: "bg-error",
  no_show: "bg-error",
};

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

export function ProviderSchedule() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const tzOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const todayIso = useMemo(() => isoDate(new Date()), []);
  const [view, setView] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(todayIso);

  // Visible date range for the active view (inclusive local dates).
  const range = useMemo(() => {
    if (view === "day") return { start: anchor, end: anchor };
    if (view === "week") {
      const start = startOfWeekMonday(anchor);
      return { start, end: addDays(start, 6) };
    }
    const start = monthGridStart(anchor);
    return { start, end: addDays(start, 41) };
  }, [view, anchor]);

  const rangeQuery = useQuery({
    queryKey: ["provider-range", range.start, range.end, tzOffsetMinutes],
    enabled: !!user,
    queryFn: () =>
      getMyProviderRange({
        data: { startDate: range.start, endDate: range.end, tzOffsetMinutes },
      }),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { bookingId: string; status: (typeof STATUSES)[number] }) =>
      setBookingStatus({ data: vars }),
    onSuccess: (saved) => {
      toast.success(`Appointment marked ${saved.status.replace("_", " ")}.`);
      qc.invalidateQueries({ queryKey: ["provider-range"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update appointment"),
  });

  const bookings = useMemo(() => rangeQuery.data?.bookings ?? [], [rangeQuery.data]);

  const byDay = useMemo(() => {
    const map = new Map<string, ProviderBooking[]>();
    for (const b of bookings) {
      const key = isoDate(new Date(b.starts_at));
      const list = map.get(key);
      if (list) list.push(b);
      else map.set(key, [b]);
    }
    return map;
  }, [bookings]);

  const title = useMemo(() => {
    if (view === "day") {
      return parseDay(anchor).toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }
    if (view === "week") {
      const s = parseDay(range.start);
      const e = parseDay(range.end);
      const ms = (d: Date) => d.toLocaleDateString([], { month: "short" });
      return `${ms(s)} ${s.getDate()} – ${ms(e)} ${e.getDate()}, ${e.getFullYear()}`;
    }
    return parseDay(anchor).toLocaleDateString([], { month: "long", year: "numeric" });
  }, [view, anchor, range]);

  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const monthCells = useMemo(() => {
    const start = monthGridStart(anchor);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const monthDaysWithBookings = useMemo(() => {
    const first = `${anchor.slice(0, 8)}01`;
    const next = addMonths(first, 1);
    const out: string[] = [];
    let d = first;
    while (d < next) {
      if ((byDay.get(d) ?? []).length > 0) out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [anchor, byDay]);

  if (!user) {
    return (
      <div className="bg-surface rounded-xl p-6 border border-border-subtle flex flex-col gap-3">
        <h3 className="font-headline-md text-headline-md text-on-surface">Sign in to see your schedule</h3>
        <p className="text-on-surface-variant text-body-md">
          {loading ? "Checking your session…" : "Your appointments load once you're signed in as a provider."}
        </p>
        <Link
          to="/auth"
          search={{ next: "/provider", mode: undefined }}
          className="self-start bg-primary text-on-primary px-4 py-2 rounded font-bold text-label-md"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const revenue = bookings
    .filter((b) => b.status !== "cancelled" && b.status !== "no_show")
    .reduce((sum, b) => sum + b.price_cents, 0);
  const done = bookings.filter((b) => b.status === "completed").length;

  const step = (dir: 1 | -1) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, 7 * dir));
    else setAnchor(addMonths(anchor, dir));
  };

  const openDay = (iso: string) => {
    setAnchor(iso);
    setView("day");
  };

  const dayBookings = byDay.get(anchor) ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
      <div className="lg:col-span-4 flex flex-col gap-gutter">
        <div className="bg-surface rounded-xl p-6 border border-border-subtle">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-4">
            {VIEW_LABELS[view]} pulse
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container p-4 rounded-lg border border-border-subtle">
              <p className="font-label-sm text-label-sm text-text-muted mb-1">Appointments</p>
              <p className="font-headline-md text-headline-md text-primary">{bookings.length}</p>
            </div>
            <div className="bg-surface-container p-4 rounded-lg border border-border-subtle">
              <p className="font-label-sm text-label-sm text-text-muted mb-1">Expected revenue</p>
              <p className="font-headline-md text-headline-md text-on-surface">{money(revenue)}</p>
            </div>
            <div className="col-span-2 bg-surface-container p-4 rounded-lg border border-border-subtle">
              <p className="font-label-sm text-label-sm text-text-muted mb-1">Completed</p>
              <p className="font-headline-md text-headline-md text-on-surface">
                {done}/{bookings.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-6 border border-border-subtle flex flex-col gap-2">
          <label className="font-label-md text-label-md text-on-surface-variant">Jump to a date</label>
          <input
            type="date"
            value={anchor}
            onChange={(e) => {
              if (e.target.value) setAnchor(e.target.value);
            }}
            className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none text-body-md"
          />
          <button
            type="button"
            onClick={() => setAnchor(todayIso)}
            className="self-start text-primary text-label-sm hover:underline"
          >
            Jump to today
          </button>
        </div>
      </div>

      <div className="lg:col-span-8 bg-surface rounded-xl border border-border-subtle overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border-subtle bg-surface-container">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
            {rangeQuery.data?.provider && (
              <span className="text-label-sm text-text-muted">
                {rangeQuery.data.provider.display_name} • {rangeQuery.data.provider.shop_name}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={`Previous ${view}`}
                className="p-2 rounded border border-border-subtle text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
              >
                <Icon name="chevron_left" className="text-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => setAnchor(todayIso)}
                className="px-3 py-2 rounded border border-border-subtle text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-label-sm font-semibold"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={`Next ${view}`}
                className="p-2 rounded border border-border-subtle text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
              >
                <Icon name="chevron_right" className="text-[18px]" />
              </button>
            </div>
            <div className="flex rounded-lg border border-border-subtle overflow-hidden">
              {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-3 py-2 text-label-sm font-semibold transition-colors ${
                    view === v
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {rangeQuery.isPending ? (
          <p className="p-4 text-on-surface-variant text-body-md">Loading your schedule…</p>
        ) : rangeQuery.isError ? (
          <p className="p-4 text-error text-body-md">
            {rangeQuery.error instanceof Error ? rangeQuery.error.message : "Could not load schedule"}
          </p>
        ) : !rangeQuery.data?.provider ? (
          <p className="p-4 text-on-surface-variant text-body-md">
            Your account isn't linked to a provider profile yet. Ask your shop owner to add you.
          </p>
        ) : view === "day" ? (
          <div className="p-4 flex flex-col gap-3">
            {dayBookings.length === 0 ? (
              <p className="text-on-surface-variant text-body-md">No appointments booked for this day.</p>
            ) : (
              dayBookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg p-4 border border-border-subtle bg-surface-container flex flex-col gap-2"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-label-md text-label-md text-on-surface">
                        {b.service?.name ?? "Service"}
                      </p>
                      <p className="font-label-sm text-label-sm text-text-muted">
                        {b.customer_name ?? "Customer"} • {timeRange(b)}
                      </p>
                      {b.customer_phone && (
                        <p className="font-label-sm text-label-sm text-text-muted">{b.customer_phone}</p>
                      )}
                      {b.notes && <p className="mt-1 text-body-md text-on-surface-variant">{b.notes}</p>}
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span className="font-label-md text-label-md text-on-surface">{money(b.price_cents)}</span>
                      <span
                        className={`text-[11px] uppercase tracking-wider border rounded px-2 py-0.5 ${
                          statusColor[b.status] ?? "border-border-subtle text-on-surface-variant"
                        }`}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border-subtle">
                    {STATUSES.filter((s) => s !== b.status).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ bookingId: b.id, status: s })}
                        className="text-label-sm border border-border-subtle rounded px-3 py-1 text-on-surface-variant hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        Mark {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : view === "week" ? (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[620px]">
              {weekDays.map((d) => {
                const dayBookingsForCell = byDay.get(d) ?? [];
                const isToday = d === todayIso;
                return (
                  <div
                    key={d}
                    className="border-r last:border-r-0 border-border-subtle min-h-[320px] flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => openDay(d)}
                      className={`p-3 border-b border-border-subtle text-left hover:bg-surface-container transition-colors ${
                        isToday ? "bg-surface-container" : ""
                      }`}
                    >
                      <p className="text-label-sm text-text-muted">
                        {parseDay(d).toLocaleDateString([], { weekday: "short" })}
                      </p>
                      <p
                        className={`font-headline-md text-headline-md ${
                          isToday ? "text-primary" : "text-on-surface"
                        }`}
                      >
                        {parseDay(d).getDate()}
                      </p>
                    </button>
                    <div className="p-2 flex flex-col gap-2">
                      {dayBookingsForCell.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => openDay(d)}
                          className="text-left rounded-lg border border-border-subtle bg-surface-container p-2 flex flex-col gap-1 hover:border-primary transition-colors"
                        >
                          <span className="flex items-center gap-1.5 text-label-sm text-on-surface font-semibold">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                statusDot[b.status] ?? "bg-on-surface-variant"
                              }`}
                            />
                            {formatTime(b.starts_at)}
                          </span>
                          <span className="text-label-sm text-on-surface-variant truncate">
                            {b.service?.name ?? "Service"}
                          </span>
                          <span className="text-[11px] text-text-muted truncate">
                            {b.customer_name ?? "Customer"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop month grid */}
            <div className="hidden md:block">
              <div className="grid grid-cols-7 border-b border-border-subtle">
                {WEEKDAYS.map((w) => (
                  <p key={w} className="p-2 text-center text-label-sm text-text-muted">
                    {w}
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((d) => {
                  const cellBookings = byDay.get(d) ?? [];
                  const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
                  const isToday = d === todayIso;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => openDay(d)}
                      className={`min-h-[96px] p-2 border-b border-r border-border-subtle text-left flex flex-col gap-1 hover:bg-surface-container transition-colors ${
                        inMonth ? "" : "opacity-40"
                      } ${isToday ? "bg-surface-container" : ""}`}
                    >
                      <span
                        className={`text-label-sm font-semibold ${
                          isToday ? "text-primary" : "text-on-surface"
                        }`}
                      >
                        {parseDay(d).getDate()}
                      </span>
                      {cellBookings.length > 0 && (
                        <>
                          <span className="self-start text-[11px] bg-primary-container text-on-primary-fixed rounded px-1.5 py-0.5">
                            {cellBookings.length} appt{cellBookings.length > 1 ? "s" : ""}
                          </span>
                          <span className="flex gap-1 flex-wrap">
                            {cellBookings.slice(0, 5).map((b) => (
                              <span
                                key={b.id}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  statusDot[b.status] ?? "bg-on-surface-variant"
                                }`}
                              />
                            ))}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile month list */}
            <div className="md:hidden p-4 flex flex-col gap-2">
              {monthDaysWithBookings.length === 0 ? (
                <p className="text-on-surface-variant text-body-md">No appointments this month.</p>
              ) : (
                monthDaysWithBookings.map((d) => {
                  const cellBookings = byDay.get(d) ?? [];
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => openDay(d)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-container p-3 hover:border-primary transition-colors"
                    >
                      <span className="text-label-md text-on-surface font-semibold">
                        {parseDay(d).toLocaleDateString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="flex gap-1">
                          {cellBookings.slice(0, 5).map((b) => (
                            <span
                              key={b.id}
                              className={`w-1.5 h-1.5 rounded-full ${
                                statusDot[b.status] ?? "bg-on-surface-variant"
                              }`}
                            />
                          ))}
                        </span>
                        <span className="text-label-sm text-text-muted">
                          {cellBookings.length} appt{cellBookings.length > 1 ? "s" : ""}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
