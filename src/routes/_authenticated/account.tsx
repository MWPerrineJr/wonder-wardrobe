import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  getMyProfile,
  updateMyProfile,
  listMyBookings,
  cancelMyBooking,
  type MyBooking,
} from "@/lib/account.functions";
import {
  DEFAULT_CANCELLATION_POLICY,
  formatMoney,
  policySentences,
  refundForCancellation,
} from "@/lib/cancellation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddToCalendar } from "@/components/add-to-calendar";
import type { CalendarEvent } from "@/lib/calendar";

const profileQuery = queryOptions({
  queryKey: ["account", "profile"],
  queryFn: () => getMyProfile(),
});
const bookingsQuery = queryOptions({
  queryKey: ["account", "bookings"],
  queryFn: () => listMyBookings(),
});

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My account — The Standing Chair" },
      { name: "description", content: "Your profile and appointment history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(profileQuery);
    context.queryClient.ensureQueryData(bookingsQuery);
  },
  component: AccountPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center text-on-surface-variant p-8">
      {error.message}
    </div>
  ),
});

function AccountPage() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const { data: bookings } = useSuspenseQuery(bookingsQuery);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");

  const updateFn = useServerFn(updateMyProfile);
  const updateMutation = useMutation({
    mutationFn: (input: { full_name: string; phone: string; avatar_url: string }) =>
      updateFn({ data: input }),
    onSuccess: () => {
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["account", "profile"] });
      setEditing(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const now = Date.now();
  const upcoming = bookings.filter(
    (b) =>
      (b.status === "pending" || b.status === "confirmed") &&
      new Date(b.starts_at).getTime() >= now,
  );
  const past = bookings.filter((b) => !upcoming.includes(b));
  const shown = tab === "upcoming" ? upcoming : past;

  const initial = (profile.full_name ?? profile.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-on-background px-4 py-10 font-body-md">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="text-body-sm text-on-surface-variant hover:text-primary">
              ← Back to home
            </Link>
            <h1 className="mt-2 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
              My account
            </h1>
          </div>
        </div>

        {/* Profile card */}
        <section className="glass-panel rounded-xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Profile</h2>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-label-md text-primary font-bold hover:underline"
              >
                Edit
              </button>
            ) : null}
          </div>

          {!editing ? (
            <div className="flex items-center gap-4">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xl">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-bold text-on-surface truncate">
                  {profile.full_name || "Add your name"}
                </div>
                <div className="text-body-sm text-on-surface-variant truncate">{profile.email}</div>
                {profile.phone ? (
                  <div className="text-body-sm text-on-surface-variant">{profile.phone}</div>
                ) : null}
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({
                  full_name: fullName,
                  phone,
                  avatar_url: avatarUrl,
                });
              }}
              className="grid grid-cols-1 gap-4"
            >
              <div>
                <label className="block text-label-md text-on-surface-variant mb-1">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none"
                  placeholder="Your name"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="block text-label-md text-on-surface-variant mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none"
                  placeholder="(555) 123-4567"
                  maxLength={30}
                />
              </div>
              <div>
                <label className="block text-label-md text-on-surface-variant mb-1">Avatar URL</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none"
                  placeholder="https://…"
                  maxLength={500}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-primary text-on-primary font-label-md py-2.5 px-5 rounded-lg font-bold hover:bg-primary/90 disabled:opacity-60"
                >
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setFullName(profile.full_name ?? "");
                    setPhone(profile.phone ?? "");
                    setAvatarUrl(profile.avatar_url ?? "");
                  }}
                  className="border border-border-subtle rounded-lg bg-surface hover:border-primary transition-colors py-2.5 px-5 text-on-surface font-label-md"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Service history */}
        <section className="glass-panel rounded-xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Service history</h2>
            <div className="inline-flex rounded-lg border border-border-subtle bg-surface p-1">
              {(["upcoming", "past"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-md text-label-sm font-bold capitalize transition-colors ${
                    tab === t
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {t} ({t === "upcoming" ? upcoming.length : past.length})
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="text-center py-10 text-on-surface-variant">
              <p className="mb-4">
                {tab === "upcoming" ? "No upcoming appointments." : "No past appointments yet."}
              </p>
              <Link
                to="/"
                className="inline-block bg-primary text-on-primary font-label-md py-2.5 px-5 rounded-lg font-bold hover:bg-primary/90"
              >
                Find a shop
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function BookingRow({ b }: { b: MyBooking }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cancelFn = useServerFn(cancelMyBooking);
  const cancelMutation = useMutation({
    mutationFn: () => cancelFn({ data: { bookingId: b.id } }),
    onSuccess: (res) => {
      const r = res as { refundCents?: number; feeCents?: number; refundError?: string | null };
      if (r.refundError) {
        toast.warning(`Appointment cancelled. Refund needs attention: ${r.refundError}`);
      } else if ((r.refundCents ?? 0) > 0) {
        toast.success(`Appointment cancelled. ${formatMoney(r.refundCents ?? 0)} refunded.`);
      } else {
        toast.success("Appointment cancelled.");
      }
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["account", "bookings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not cancel"),
  });

  const start = new Date(b.starts_at);
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const price = b.price_cents != null ? `$${(b.price_cents / 100).toFixed(2)}` : null;
  const policy = b.cancellation ?? DEFAULT_CANCELLATION_POLICY;
  const canCancel = (b.status === "pending" || b.status === "confirmed") && start.getTime() > Date.now();
  const paid = b.payment_status === "paid" ? (b.amount_paid_cents ?? 0) : 0;
  const outcome = refundForCancellation(paid, b.starts_at, policy);
  const upcoming = start.getTime() > Date.now() && b.status !== "cancelled";
  const calendarEvent: CalendarEvent = {
    title: `${b.service?.name ?? "Appointment"} — ${b.shop?.name ?? "The Standing Chair"}`,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    location: b.shop?.address ?? null,
    uid: b.id,
    description: [
      b.provider?.display_name ? `With ${b.provider.display_name}` : null,
      ...policySentences(policy),
    ]
      .filter(Boolean)
      .join("\n"),
    url:
      typeof window !== "undefined" && b.shop?.slug
        ? `${window.location.origin}/shop/${b.shop.slug}`
        : null,
  };

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-900",
    confirmed: "bg-emerald-100 text-emerald-900",
    completed: "bg-slate-100 text-slate-800",
    cancelled: "bg-rose-100 text-rose-900",
    no_show: "bg-rose-100 text-rose-900",
  };

  return (
    <li className="border border-border-subtle rounded-lg bg-surface p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-on-surface">{b.service?.name ?? "Service"}</span>
          <span
            className={`text-label-sm font-bold px-2 py-0.5 rounded-full capitalize ${
              statusColor[b.status] ?? "bg-slate-100 text-slate-800"
            }`}
          >
            {b.status.replace("_", " ")}
          </span>
          {b.payment_status === "paid" && (
            <span className="text-label-sm font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
              Paid ${((b.amount_paid_cents ?? 0) / 100).toFixed(2)}
            </span>
          )}
          {b.payment_status === "awaiting_payment" && (
            <span className="text-label-sm font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
              Payment pending
            </span>
          )}
          {(b.refunded_cents ?? 0) > 0 && (
            <span className="text-label-sm font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-900">
              Refunded {formatMoney(b.refunded_cents ?? 0)}
            </span>
          )}
        </div>
        <div className="text-body-sm text-on-surface-variant mt-1">
          {dateStr} · {timeStr}
          {b.service?.duration_minutes ? ` · ${b.service.duration_minutes} min` : ""}
        </div>
        <div className="text-body-sm text-on-surface-variant">
          {b.shop?.name ?? "Shop"}
          {b.provider?.display_name ? ` · with ${b.provider.display_name}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {price ? <span className="font-bold text-on-surface">{price}</span> : null}
        {upcoming && <AddToCalendar event={calendarEvent} variant="link" />}
        {b.shop?.slug ? (
          <Link
            to="/shop"
            search={{ slug: b.shop.slug }}
            className="text-label-md text-primary font-bold hover:underline"
          >
            View shop
          </Link>
        ) : null}
        {canCancel && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="text-label-md text-on-surface-variant hover:text-error font-bold underline"
          >
            Cancel
          </button>
        )}
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2 text-left">
                <span>
                  {b.service?.name ?? "Service"} at {b.shop?.name ?? "the shop"} — {dateStr} ·{" "}
                  {timeStr}
                </span>
                {paid > 0 ? (
                  <span>
                    {outcome.free
                      ? `You're inside the free-cancellation window, so ${formatMoney(outcome.refundCents)} will be refunded in full.`
                      : `This is a late cancellation: the shop keeps ${formatMoney(outcome.feeCents)} and ${formatMoney(outcome.refundCents)} will be refunded.`}
                  </span>
                ) : (
                  <span>No prepayment was taken, so there is nothing to refund.</span>
                )}
                <span className="text-on-surface-variant">{policySentences(policy).join(" ")}</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancelMutation.mutate();
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel appointment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}