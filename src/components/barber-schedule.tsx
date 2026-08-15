import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { getMyBarberDay, setBookingStatus, type BarberBooking } from "@/lib/barber.functions";

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function timeRange(b: BarberBooking) {
  const f = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${f(b.starts_at)} – ${f(b.ends_at)}`;
}

const statusColor: Record<string, string> = {
  pending: "border-border-subtle text-on-surface-variant",
  confirmed: "border-primary text-primary",
  completed: "border-tertiary text-tertiary",
  cancelled: "border-error text-error",
  no_show: "border-error text-error",
};

export function BarberSchedule() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const tzOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const [date, setDate] = useState(() => isoDate(new Date()));

  const dayQuery = useQuery({
    queryKey: ["barber-day", date, tzOffsetMinutes],
    enabled: !!user,
    queryFn: () => getMyBarberDay({ data: { date, tzOffsetMinutes } }),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { bookingId: string; status: (typeof STATUSES)[number] }) =>
      setBookingStatus({ data: vars }),
    onSuccess: (saved) => {
      toast.success(`Appointment marked ${saved.status.replace("_", " ")}.`);
      qc.invalidateQueries({ queryKey: ["barber-day"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update appointment"),
  });

  if (!user) {
    return (
      <div className="bg-surface rounded-xl p-6 border border-border-subtle flex flex-col gap-3">
        <h3 className="font-headline-md text-headline-md text-on-surface">Sign in to see your schedule</h3>
        <p className="text-on-surface-variant text-body-md">
          {loading ? "Checking your session…" : "Your appointments load once you're signed in as a barber."}
        </p>
        <Link
          to="/auth"
          search={{ next: "/barber", mode: undefined }}
          className="self-start bg-primary text-on-primary px-4 py-2 rounded font-bold text-label-md"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const bookings = dayQuery.data?.bookings ?? [];
  const revenue = bookings
    .filter((b) => b.status !== "cancelled" && b.status !== "no_show")
    .reduce((sum, b) => sum + b.price_cents, 0);
  const done = bookings.filter((b) => b.status === "completed").length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
      <div className="lg:col-span-4 flex flex-col gap-gutter">
        <div className="bg-surface rounded-xl p-6 border border-border-subtle">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Day pulse</h3>
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
          <label className="font-label-md text-label-md text-on-surface-variant">Pick a day</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none text-body-md"
          />
          <button
            type="button"
            onClick={() => setDate(isoDate(new Date()))}
            className="self-start text-primary text-label-sm hover:underline"
          >
            Jump to today
          </button>
        </div>
      </div>

      <div className="lg:col-span-8 bg-surface rounded-xl border border-border-subtle overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-container">
          <h3 className="font-headline-md text-headline-md text-on-surface">
            {new Date(`${date}T00:00`).toLocaleDateString([], {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h3>
          {dayQuery.data?.barber && (
            <span className="text-label-sm text-text-muted">
              {dayQuery.data.barber.display_name} • {dayQuery.data.barber.shop_name}
            </span>
          )}
        </div>

        <div className="p-4 flex flex-col gap-3">
          {dayQuery.isPending ? (
            <p className="text-on-surface-variant text-body-md">Loading your day…</p>
          ) : dayQuery.isError ? (
            <p className="text-error text-body-md">
              {dayQuery.error instanceof Error ? dayQuery.error.message : "Could not load schedule"}
            </p>
          ) : !dayQuery.data?.barber ? (
            <p className="text-on-surface-variant text-body-md">
              Your account isn't linked to a barber profile yet. Ask your shop owner to add you.
            </p>
          ) : bookings.length === 0 ? (
            <p className="text-on-surface-variant text-body-md">No appointments booked for this day.</p>
          ) : (
            bookings.map((b) => (
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
      </div>
    </div>
  );
}
