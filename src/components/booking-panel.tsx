import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import {
  createBooking,
  getAvailableSlots,
  type BookingContext,
  type SavedBooking,
} from "@/lib/booking.functions";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function label12h(time: string) {
  const [hh, mm] = time.split(":").map(Number);
  const h = hh ?? 0;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm ?? 0).padStart(2, "0")} ${suffix}`;
}

const inputClass =
  "w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md";

export function BookingPanel({ ctx, slug }: { ctx: BookingContext; slug: string }) {
  const { user, loading } = useAuth();
  const tzOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);

  const [providerId, setBarberId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(ctx.services[0]?.id ?? null);
  const [date, setDate] = useState<string>(() => isoDate(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [time, setTime] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState<SavedBooking | null>(null);

  const service = ctx.services.find((s) => s.id === serviceId) ?? null;

  useEffect(() => {
    setTime(null);
  }, [providerId, serviceId, date]);

  const slotsQuery = useQuery({
    queryKey: ["slots", ctx.shop.id, serviceId, providerId, date, tzOffsetMinutes],
    enabled: !!user && !!serviceId,
    queryFn: () =>
      getAvailableSlots({
        data: {
          shopId: ctx.shop.id,
          serviceId: serviceId!,
          providerId,
          date,
          tzOffsetMinutes,
        },
      }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      createBooking({
        data: {
          shopId: ctx.shop.id,
          serviceId: serviceId!,
          providerId,
          date,
          time: time!,
          tzOffsetMinutes,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes: notes.trim() || null,
        },
      }),
    onSuccess: (saved) => {
      // Success is only shown after the database returns the saved row.
      setConfirmed(saved);
      setTime(null);
      slotsQuery.refetch();
      toast.success("Appointment confirmed.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save booking"),
  });

  const nameValid = customerName.trim().length >= 2;
  const phoneValid = /^[+()\d\s.-]{7,30}$/.test(customerPhone.trim());
  const canSubmit = !!user && !!serviceId && !!time && nameValid && phoneValid && !mutation.isPending;

  if (confirmed) {
    return (
      <div className="glass-panel rounded-xl p-6 md:p-8 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-primary">Booking confirmed</h2>
        <p className="text-on-surface text-body-md">
          {confirmed.service?.name} at {confirmed.shop?.name}
        </p>
        <p className="text-on-surface-variant text-body-md">
          {new Date(confirmed.starts_at).toLocaleString()} • {confirmed.service?.duration_minutes} mins
        </p>
        <p className="text-on-surface-variant text-body-md">
          {confirmed.provider?.display_name ?? "No provider preference"} • {formatPrice(confirmed.price_cents)} •{" "}
          {confirmed.status}
        </p>
        <div className="flex gap-3 mt-2">
          <Link to="/account" className="bg-primary text-on-primary px-4 py-2 rounded font-bold text-label-md">
            View my bookings
          </Link>
          <button
            type="button"
            onClick={() => setConfirmed(null)}
            className="border border-border-subtle text-on-surface px-4 py-2 rounded text-label-md"
          >
            Book another
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col gap-10">
      {/* Step 1: provider */}
      <section className="glass-panel rounded-xl p-6 md:p-8">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-6">1. Select provider</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setBarberId(null)}
            className={`flex flex-col items-center gap-3 p-4 rounded-lg border bg-surface-container transition-all ${
              providerId === null ? "border-primary" : "border-border-subtle hover:border-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant">group</span>
            <span className="font-label-md text-label-md text-on-surface">No preference</span>
          </button>
          {ctx.providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => setBarberId(provider.id)}
              className={`flex flex-col items-center gap-3 p-4 rounded-lg border bg-surface-container transition-all ${
                providerId === provider.id ? "border-primary" : "border-border-subtle hover:border-primary"
              }`}
            >
              <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-container-high flex items-center justify-center text-primary">
                {provider.avatar_url ? (
                  <img src={provider.avatar_url} alt={provider.display_name} className="w-full h-full object-cover" />
                ) : (
                  provider.display_name.charAt(0)
                )}
              </div>
              <span className="font-label-md text-label-md text-on-surface">{provider.display_name}</span>
            </button>
          ))}
        </div>
        {ctx.providers.length === 0 && (
          <p className="mt-4 text-on-surface-variant text-body-md">
            This shop hasn't added providers yet — book with no preference.
          </p>
        )}
      </section>


      {/* Step 2: service */}
      <section className="glass-panel rounded-xl p-6 md:p-8">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-6">2. Choose a service</h2>
        <div className="flex flex-col gap-2">
          {ctx.services.length === 0 ? (
            <div className="p-4 rounded-lg bg-surface-container border border-border-subtle text-on-surface-variant text-body-md">
              This shop hasn't added any services yet.
            </div>
          ) : (
            ctx.services.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => setServiceId(svc.id)}
                className={`flex items-center justify-between text-left p-4 rounded-lg bg-surface-container border transition-all ${
                  serviceId === svc.id ? "border-primary" : "border-border-subtle hover:border-primary/50"
                }`}
              >
                <span className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-on-surface">{svc.name}</span>
                  <span className="font-body-md text-body-md text-on-surface-variant text-sm">
                    {svc.duration_minutes} mins{svc.category ? ` • ${svc.category}` : ""}{svc.description ? ` • ${svc.description}` : ""}
                  </span>
                </span>

                <span className={`font-headline-md text-headline-md ${serviceId === svc.id ? "text-primary" : "text-on-surface"}`}>
                  {formatPrice(svc.price_cents)}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Step 3: date & time */}
      <section className="glass-panel rounded-xl p-6 md:p-8 flex flex-col gap-6">
        <h2 className="font-headline-md text-headline-md text-on-surface">3. Date &amp; time</h2>
        <div>
          <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Date</label>
          <input
            type="date"
            required
            min={isoDate(new Date())}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>
        {!user ? (
          <p className="text-on-surface-variant text-body-md">
            {loading ? "Checking your session…" : "Sign in to see live availability and book."}
          </p>
        ) : !serviceId ? (
          <p className="text-on-surface-variant text-body-md">Choose a service to see open slots.</p>
        ) : slotsQuery.isPending ? (
          <p className="text-on-surface-variant text-body-md">Loading available times…</p>
        ) : slotsQuery.data?.closed ? (
          <p className="text-on-surface-variant text-body-md">The shop is closed on this day.</p>
        ) : (slotsQuery.data?.slots.length ?? 0) === 0 ? (
          <p className="text-on-surface-variant text-body-md">No open slots left on this day.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slotsQuery.data!.slots.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={`p-2 border rounded font-body-md text-body-md transition-colors ${
                  time === t
                    ? "border-primary text-primary font-bold bg-surface"
                    : "border-border-subtle bg-surface-container text-on-surface hover:border-primary"
                }`}
              >
                {label12h(t)}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Step 4: details + confirm */}
      <section className="glass-panel rounded-xl p-6 md:p-8 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">4. Your details</h2>
        {!user ? (
          <div className="flex flex-col gap-3">
            <p className="text-on-surface-variant text-body-md">Sign in to book this appointment.</p>
            <Link
              to="/auth"
              search={{ next: `/shop?slug=${slug}`, mode: undefined }}
              className="bg-primary text-on-primary px-4 py-3 rounded font-bold text-label-md text-center"
            >
              Sign in to book
            </Link>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) mutation.mutate();
            }}
          >
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Full name *</label>
              <input
                required
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Doe"
                className={inputClass}
              />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Phone number *</label>
              <input
                required
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className={inputClass}
              />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything your barber should know?"
                className={inputClass}
              />
            </div>

            <div className="border-t border-border-subtle pt-4 flex flex-col gap-2">
              <div className="flex justify-between text-body-md text-on-surface">
                <span>{service ? service.name : "No service selected"}</span>
                <span className="text-primary font-bold">{service ? formatPrice(service.price_cents) : "—"}</span>
              </div>
              <div className="text-on-surface-variant text-body-md">
                {time
                  ? `${new Date(`${date}T${time}`).toLocaleDateString()} at ${label12h(time)}${
                      service ? ` (${service.duration_minutes}m)` : ""
                    }`
                  : "Pick a time slot"}
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-primary text-on-primary font-headline-md text-headline-md py-4 rounded-lg font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Confirm booking"}
            </button>
            <p className="font-label-sm text-label-sm text-center text-on-surface-variant">
              By booking, you agree to our cancellation policy.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
