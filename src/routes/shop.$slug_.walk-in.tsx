import { useEffect, useState } from "react";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { getBookingContext } from "@/lib/booking.functions";
import { createWalkInBooking, getWalkInSlots } from "@/lib/walk-in.functions";

const ctxQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public", "booking-context", slug],
    queryFn: () => getBookingContext({ data: { slug } }),
  });

export const Route = createFileRoute("/shop/$slug_/walk-in")({
  staticData: { sitemap: false },
  loader: async ({ params, context }) => {
    const ctx = await context.queryClient.ensureQueryData(ctxQuery(params.slug));
    if (!ctx) throw notFound();
    return { name: ctx.shop.name };
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `Walk-in sign-in — ${loaderData.name} | The Standing Chair`
      : "Walk-in sign-in — The Standing Chair";
    const description = "Sign in for a walk-in appointment and pick an open time.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background flex items-center justify-center text-on-surface p-8">
      Shop not found.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background flex items-center justify-center text-on-surface p-8">
      Couldn't load sign-in: {(error as Error).message}
    </div>
  ),
  component: WalkInPage,
});

function localDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hh = (h ?? 0) % 12 || 12;
  return `${hh}:${String(m ?? 0).padStart(2, "0")} ${(h ?? 0) < 12 ? "AM" : "PM"}`;
}

const btn =
  "rounded-xl border-2 px-5 py-4 text-left transition-colors font-label-md text-label-md";
const on = "border-primary bg-primary/10 text-on-surface";
const off = "border-border-subtle bg-surface text-on-surface hover:border-primary";

function WalkInPage() {
  const { slug } = Route.useParams();
  const { data: ctx } = useSuspenseQuery(ctxQuery(slug));
  const slotsFn = useServerFn(getWalkInSlots);
  const createFn = useServerFn(createWalkInBooking);

  const [providerId, setProviderId] = useState<string | null | undefined>(undefined);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { when: string; who: string | null; what: string }>(null);
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => setDates([localDate(0), localDate(1), localDate(2)]), []);

  const date = dates[dayOffset];
  const ready = !!ctx && providerId !== undefined && !!serviceId && !!date;
  const slotsQ = useQuery({
    queryKey: ["walk-in-slots", ctx?.shop.id, providerId, serviceId, date],
    enabled: ready,
    refetchInterval: 30_000,
    queryFn: () =>
      slotsFn({
        data: {
          shopId: ctx!.shop.id,
          serviceId: serviceId!,
          providerId: providerId ?? null,
          date: date!,
          tzOffsetMinutes: new Date().getTimezoneOffset(),
        },
      }),
  });

  const reset = () => {
    setProviderId(undefined);
    setServiceId(null);
    setDayOffset(0);
    setTime(null);
    setName("");
    setPhone("");
    setError(null);
    setDone(null);
  };

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(reset, 8000);
    return () => clearTimeout(t);
  }, [done]);

  if (!ctx) return null;

  const submit = async () => {
    if (!time || !serviceId || !date) return;
    setBusy(true);
    setError(null);
    try {
      const r = await createFn({
        data: {
          shopId: ctx.shop.id,
          serviceId,
          providerId: providerId ?? null,
          date,
          time,
          tzOffsetMinutes: new Date().getTimezoneOffset(),
          customerName: name,
          customerPhone: phone,
        },
      });
      setDone({
        when: new Date(r.startsAt).toLocaleString([], {
          weekday: "long",
          hour: "numeric",
          minute: "2-digit",
        }),
        who: r.providerName,
        what: r.serviceName,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not sign you in";
      setError(msg.startsWith("[") ? "Please check your name and phone number." : msg);
      setTime(null);
      void slotsQ.refetch();
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="material-symbols-outlined text-primary text-[72px]">check_circle</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">You're checked in</h1>
        <p className="text-body-lg text-on-surface-variant">
          {done.what} · {done.when}
          {done.who ? ` with ${done.who}` : ""}
        </p>
        <button type="button" onClick={reset} className="mt-4 bg-primary text-on-primary rounded-xl px-8 py-4 font-bold">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-10">
        <header className="text-center">
          <p className="text-on-surface-variant font-label-md text-label-md uppercase tracking-wide">
            Walk-in sign-in
          </p>
          <h1 className="font-headline-lg text-headline-lg mt-1">{ctx.shop.name}</h1>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="font-headline-md text-headline-md">1. Who would you like?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button type="button" className={`${btn} ${providerId === null ? on : off}`} onClick={() => { setProviderId(null); setTime(null); }}>
              First available
            </button>
            {ctx.providers.map((p) => (
              <button key={p.id} type="button" className={`${btn} ${providerId === p.id ? on : off}`} onClick={() => { setProviderId(p.id); setTime(null); }}>
                {p.display_name}
              </button>
            ))}
          </div>
        </section>

        {providerId !== undefined && (
          <section className="flex flex-col gap-3">
            <h2 className="font-headline-md text-headline-md">2. Pick a service</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {ctx.services.map((s) => (
                <button key={s.id} type="button" className={`${btn} ${serviceId === s.id ? on : off}`} onClick={() => { setServiceId(s.id); setTime(null); }}>
                  <div>{s.name}</div>
                  <div className="text-on-surface-variant text-body-sm">
                    {s.duration_minutes} min · ${(s.price_cents / 100).toFixed(0)}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {ready && (
          <section className="flex flex-col gap-3">
            <h2 className="font-headline-md text-headline-md">3. Pick an open time</h2>
            <div className="flex gap-2">
              {["Today", "Tomorrow", "Next day"].map((l, i) => (
                <button key={l} type="button" className={`px-4 py-2 rounded-lg border ${dayOffset === i ? on : off}`} onClick={() => { setDayOffset(i); setTime(null); }}>
                  {l}
                </button>
              ))}
            </div>
            {slotsQ.isLoading ? (
              <p className="text-on-surface-variant">Checking the calendar…</p>
            ) : slotsQ.isError ? (
              <p className="text-on-surface-variant">Couldn't load times. Please ask the front desk.</p>
            ) : slotsQ.data?.closed ? (
              <p className="text-on-surface-variant">Closed this day.</p>
            ) : (slotsQ.data?.slots.length ?? 0) === 0 ? (
              <p className="text-on-surface-variant">No open times left this day. Try another day or provider.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {slotsQ.data!.slots.map((t) => (
                  <button key={t} type="button" className={`rounded-lg border-2 py-3 font-label-md ${time === t ? on : off}`} onClick={() => setTime(t)}>
                    {fmtTime(t)}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {time && (
          <section className="flex flex-col gap-3">
            <h2 className="font-headline-md text-headline-md">4. Your details</h2>
            <input aria-label="Your name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="bg-surface border border-border-subtle rounded-xl px-4 py-4 text-body-lg focus:border-primary focus:outline-none" />
            <input aria-label="Phone number" placeholder="Phone number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-surface border border-border-subtle rounded-xl px-4 py-4 text-body-lg focus:border-primary focus:outline-none" />
            {error && <p className="text-destructive">{error}</p>}
            <button type="button" disabled={busy || name.trim().length < 2 || phone.trim().length < 7} onClick={submit} className="bg-primary text-on-primary rounded-xl py-4 font-bold text-body-lg disabled:opacity-50">
              {busy ? "Signing you in…" : `Sign in for ${fmtTime(time)}`}
            </button>
          </section>
        )}
        {!time && error && <p className="text-destructive text-center">{error}</p>}
      </main>
    </div>
  );
}
