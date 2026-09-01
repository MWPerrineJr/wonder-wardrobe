// Server-only aggregation for the owner analytics dashboard. Everything is
// computed here so the browser only receives finished, serializable DTOs.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { dbError } from "@/lib/db-error";
import {
  granularityForDays,
  type Granularity,
  type HeatmapCell,
  type ProviderRow,
  type SeriesPoint,
  type ServiceRow,
  type ShopAnalytics,
  type SurveyStats,
  type TrendValue,
} from "@/lib/analytics-types";

type Client = SupabaseClient<Database>;

const BOOKED_STATUSES = new Set(["completed", "confirmed"]);

type BookingRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number;
  amount_paid_cents: number;
  payment_status: string;
  service_id: string;
  provider_id: string | null;
  customer_id: string;
  customer_name: string | null;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function bucketKey(iso: string, granularity: Granularity): string {
  const d = new Date(iso);
  if (granularity === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  const day = startOfUtcDay(d);
  if (granularity === "week") {
    // Monday-based week start
    const shift = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - shift);
  }
  return day.toISOString().slice(0, 10);
}

function bucketLabel(key: string, granularity: Granularity): string {
  const d = new Date(`${key}T00:00:00Z`);
  if (granularity === "month") {
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function bucketKeys(start: Date, end: Date, granularity: Granularity): string[] {
  const keys: string[] = [];
  const cursor = new Date(bucketKey(start.toISOString(), granularity) + "T00:00:00Z");
  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10));
    if (granularity === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + (granularity === "week" ? 7 : 1));
  }
  return keys;
}

function trend(current: number, previous: number): TrendValue {
  return { current, previous };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function bookedRevenue(rows: BookingRow[]): number {
  return sum(rows.filter((b) => BOOKED_STATUSES.has(b.status)).map((b) => b.price_cents));
}

function collectedRevenue(rows: BookingRow[]): number {
  return sum(rows.filter((b) => b.payment_status === "paid").map((b) => b.amount_paid_cents));
}

function ratingAverage(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export async function buildShopAnalytics(
  supabase: Client,
  options: { shopId: string; days: number },
): Promise<Omit<ShopAnalytics, "locked">> {
  const { shopId, days } = options;
  const granularity = granularityForDays(days);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const prevStart = new Date(start.getTime() - days * 86400000);

  const sel = (s: string): string => s;

  const [bookingsRes, servicesRes, providersRes, hoursRes, invitesRes, priorRes] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(
          sel(
            "id, starts_at, ends_at, status, price_cents, amount_paid_cents, payment_status, service_id, provider_id, customer_id, customer_name",
          ),
        )
        .eq("shop_id", shopId)
        .gte("starts_at", prevStart.toISOString())
        .lte("starts_at", end.toISOString())
        .order("starts_at", { ascending: true })
        .limit(5000)
        .returns<BookingRow[]>(),
      supabase
        .from("services")
        .select(sel("id, name"))
        .eq("shop_id", shopId)
        .returns<{ id: string; name: string }[]>(),
      supabase
        .from("providers")
        .select(sel("id, display_name"))
        .eq("shop_id", shopId)
        .returns<{ id: string; display_name: string }[]>(),
      supabase
        .from("shop_hours")
        .select(sel("weekday, open_time, close_time, is_closed"))
        .eq("shop_id", shopId)
        .returns<
          { weekday: number; open_time: string; close_time: string; is_closed: boolean }[]
        >(),
      supabase
        .from("survey_invites")
        .select(sel("id, provider_id, sent_at, responded_at, feedback_id, rating_hint"))
        .eq("shop_id", shopId)
        .gte("sent_at", start.toISOString())
        .returns<
          {
            id: string;
            provider_id: string | null;
            sent_at: string;
            responded_at: string | null;
            feedback_id: string | null;
            rating_hint: number | null;
          }[]
        >(),
      supabase
        .from("bookings")
        .select(sel("customer_id"))
        .eq("shop_id", shopId)
        .lt("starts_at", start.toISOString())
        .limit(5000)
        .returns<{ customer_id: string }[]>(),
    ]);

  for (const res of [bookingsRes, servicesRes, providersRes, hoursRes, invitesRes, priorRes]) {
    if (res.error) throw dbError(res.error, "analytics");
  }

  const all = (bookingsRes.data ?? []) as BookingRow[];
  const current = all.filter((b) => new Date(b.starts_at) >= start);
  const previous = all.filter((b) => new Date(b.starts_at) < start);

  const serviceNames = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name] as const));
  const providerNames = new Map(
    (providersRes.data ?? []).map((p) => [p.id, p.display_name] as const),
  );

  // ---------- feedback (ratings + sentiment) ----------
  const { data: feedbackRows, error: fbErr } = await supabase
    .from("customer_feedback")
    .select(sel("id, rating, sentiment_label, created_at"))
    .eq("shop_id", shopId)
    .gte("created_at", start.toISOString())
    .returns<{ id: string; rating: number | null; sentiment_label: string | null }[]>();
  if (fbErr) throw dbError(fbErr, "analytics");
  const feedback = feedbackRows ?? [];
  const feedbackRating = new Map(feedback.map((f) => [f.id, f.rating]));

  // ---------- time series ----------
  const keys = bucketKeys(start, end, granularity);
  const byBucket = new Map<string, BookingRow[]>(keys.map((k) => [k, []]));
  for (const b of current) {
    const key = bucketKey(b.starts_at, granularity);
    const list = byBucket.get(key);
    if (list) list.push(b);
    else byBucket.set(key, [b]);
  }

  const priorCustomers = new Set((priorRes.data ?? []).map((r) => r.customer_id));
  const seenCustomers = new Set(priorCustomers);

  const series: SeriesPoint[] = keys.map((key) => {
    const rows = byBucket.get(key) ?? [];
    const cancelled = rows.filter((b) => b.status === "cancelled").length;
    const noShow = rows.filter((b) => b.status === "no_show").length;
    let returning = 0;
    for (const b of rows) {
      if (seenCustomers.has(b.customer_id)) returning += 1;
      seenCustomers.add(b.customer_id);
    }
    return {
      bucket: key,
      label: bucketLabel(key, granularity),
      revenueBookedCents: bookedRevenue(rows),
      revenueCollectedCents: collectedRevenue(rows),
      total: rows.length,
      completed: rows.filter((b) => b.status === "completed").length,
      confirmed: rows.filter((b) => b.status === "confirmed").length,
      pending: rows.filter((b) => b.status === "pending").length,
      cancelled,
      noShow,
      lostRatePct: rows.length === 0 ? 0 : ((cancelled + noShow) / rows.length) * 100,
      returningSharePct: rows.length === 0 ? null : (returning / rows.length) * 100,
    };
  });

  // ---------- per-service ----------
  const serviceTotals = new Map<string, { bookings: number; revenue: number }>();
  for (const b of current) {
    const entry = serviceTotals.get(b.service_id) ?? { bookings: 0, revenue: 0 };
    entry.bookings += 1;
    if (BOOKED_STATUSES.has(b.status)) entry.revenue += b.price_cents;
    serviceTotals.set(b.service_id, entry);
  }
  const serviceRevenueTotal = sum([...serviceTotals.values()].map((s) => s.revenue));
  const services: ServiceRow[] = [...serviceTotals.entries()]
    .map(([id, s]) => ({
      id,
      name: serviceNames.get(id) ?? "Removed service",
      bookings: s.bookings,
      revenueCents: s.revenue,
      avgPriceCents: s.bookings === 0 ? 0 : Math.round(s.revenue / s.bookings),
      sharePct: serviceRevenueTotal === 0 ? 0 : (s.revenue / serviceRevenueTotal) * 100,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  // ---------- per-provider ----------
  const providerRatings = new Map<string, number[]>();
  for (const invite of invitesRes.data ?? []) {
    if (!invite.provider_id) continue;
    const rating =
      (invite.feedback_id ? feedbackRating.get(invite.feedback_id) : null) ?? invite.rating_hint;
    if (typeof rating !== "number") continue;
    const list = providerRatings.get(invite.provider_id) ?? [];
    list.push(rating);
    providerRatings.set(invite.provider_id, list);
  }

  const providerTotals = new Map<string, { appointments: number; revenue: number }>();
  for (const b of current) {
    const key = b.provider_id ?? "unassigned";
    const entry = providerTotals.get(key) ?? { appointments: 0, revenue: 0 };
    entry.appointments += 1;
    if (BOOKED_STATUSES.has(b.status)) entry.revenue += b.price_cents;
    providerTotals.set(key, entry);
  }
  const providerRevenueTotal = sum([...providerTotals.values()].map((p) => p.revenue));
  const providers: ProviderRow[] = [...providerTotals.entries()]
    .map(([id, p]) => {
      const ratings = providerRatings.get(id) ?? [];
      return {
        id,
        name: id === "unassigned" ? "Unassigned" : (providerNames.get(id) ?? "Former provider"),
        appointments: p.appointments,
        revenueCents: p.revenue,
        avgTicketCents: p.appointments === 0 ? 0 : Math.round(p.revenue / p.appointments),
        avgRating: ratings.length === 0 ? null : ratingAverage(ratings),
        sharePct: providerRevenueTotal === 0 ? 0 : (p.revenue / providerRevenueTotal) * 100,
      };
    })
    .sort((a, b) => b.revenueCents - a.revenueCents);

  // ---------- surveys ----------
  const invites = invitesRes.data ?? [];
  const rated = feedback.filter((f) => typeof f.rating === "number") as { rating: number }[];
  const ratingCounts = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: rated.filter((f) => f.rating === rating).length,
  }));
  const sentimentOrder = ["very_positive", "positive", "neutral", "negative", "very_negative"];
  const surveys: SurveyStats = {
    invitesSent: invites.length,
    responses: invites.filter((i) => i.responded_at !== null).length,
    completionRatePct:
      invites.length === 0
        ? 0
        : (invites.filter((i) => i.responded_at !== null).length / invites.length) * 100,
    avgRating: rated.length === 0 ? null : ratingAverage(rated.map((f) => f.rating)),
    ratingCounts,
    sentiment: sentimentOrder
      .map((label) => ({
        label,
        count: feedback.filter((f) => f.sentiment_label === label).length,
      }))
      .filter((s) => s.count > 0),
  };

  // ---------- utilization ----------
  const openHours = Array.from({ length: 7 }, (_, weekday) => {
    const row = (hoursRes.data ?? []).find((h) => h.weekday === weekday);
    if (!row || row.is_closed) return { weekday, openHour: 9, closeHour: 17, closed: true };
    return {
      weekday,
      openHour: Number(row.open_time.slice(0, 2)),
      closeHour: Math.max(
        Number(row.close_time.slice(0, 2)),
        Number(row.open_time.slice(0, 2)) + 1,
      ),
      closed: false,
    };
  });

  const minHour = Math.min(...openHours.filter((h) => !h.closed).map((h) => h.openHour), 8);
  const maxHour = Math.max(...openHours.filter((h) => !h.closed).map((h) => h.closeHour), 18);
  const counts = new Map<string, number>();
  for (const b of current) {
    if (b.status === "cancelled" || b.status === "no_show") continue;
    const d = new Date(b.starts_at);
    counts.set(
      `${d.getUTCDay()}-${d.getUTCHours()}`,
      (counts.get(`${d.getUTCDay()}-${d.getUTCHours()}`) ?? 0) + 1,
    );
  }
  const cells: HeatmapCell[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const day = openHours[weekday];
    for (let hour = minHour; hour < maxHour; hour += 1) {
      cells.push({
        weekday,
        hour,
        count: counts.get(`${weekday}-${hour}`) ?? 0,
        open: !day.closed && hour >= day.openHour && hour < day.closeHour,
      });
    }
  }
  const busiestCell = cells.reduce<HeatmapCell | null>(
    (best, cell) => (cell.count > 0 && (!best || cell.count > best.count) ? cell : best),
    null,
  );
  const bookedMinutes = sum(
    current
      .filter((b) => BOOKED_STATUSES.has(b.status))
      .map((b) => (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000),
  );
  const weeks = days / 7;
  const openMinutes = Math.round(
    sum(openHours.filter((h) => !h.closed).map((h) => (h.closeHour - h.openHour) * 60)) * weeks,
  );

  // ---------- retention ----------
  const customersInRange = new Map<string, { name: string; visits: number; revenue: number }>();
  for (const b of current) {
    const entry = customersInRange.get(b.customer_id) ?? {
      name: b.customer_name?.trim() || "Guest",
      visits: 0,
      revenue: 0,
    };
    entry.visits += 1;
    if (BOOKED_STATUSES.has(b.status)) entry.revenue += b.price_cents;
    if (b.customer_name?.trim()) entry.name = b.customer_name.trim();
    customersInRange.set(b.customer_id, entry);
  }
  const returningCustomers = [...customersInRange.entries()].filter(
    ([id, c]) => priorCustomers.has(id) || c.visits > 1,
  ).length;
  const newCustomers = customersInRange.size - returningCustomers;
  const topRepeat = [...customersInRange.values()]
    .filter((c) => c.visits > 1)
    .sort((a, b) => b.visits - a.visits || b.revenue - a.revenue)
    .slice(0, 5)
    .map((c) => ({ name: c.name, visits: c.visits, revenueCents: c.revenue }));

  // ---------- KPIs ----------
  const completedShare = (rows: BookingRow[]) => {
    const finished = rows.filter((b) => new Date(b.ends_at) <= end);
    return finished.length === 0
      ? 0
      : (finished.filter((b) => b.status === "completed").length / finished.length) * 100;
  };
  const avgTicket = (rows: BookingRow[]) => {
    const booked = rows.filter((b) => BOOKED_STATUSES.has(b.status));
    return booked.length === 0 ? 0 : Math.round(bookedRevenue(rows) / booked.length);
  };

  const { data: prevFeedback, error: prevFbErr } = await supabase
    .from("customer_feedback")
    .select(sel("rating"))
    .eq("shop_id", shopId)
    .gte("created_at", prevStart.toISOString())
    .lt("created_at", start.toISOString())
    .returns<{ rating: number | null }[]>();
  if (prevFbErr) throw dbError(prevFbErr, "analytics");
  const prevRatings = (prevFeedback ?? [])
    .map((f) => f.rating)
    .filter((r): r is number => typeof r === "number");

  return {
    range: { start: start.toISOString(), end: end.toISOString(), days, granularity },
    kpis: {
      revenueBookedCents: trend(bookedRevenue(current), bookedRevenue(previous)),
      revenueCollectedCents: trend(collectedRevenue(current), collectedRevenue(previous)),
      appointments: trend(current.length, previous.length),
      avgTicketCents: trend(avgTicket(current), avgTicket(previous)),
      completionRate: trend(completedShare(current), completedShare(previous)),
      avgRating: trend(ratingAverage(rated.map((f) => f.rating)), ratingAverage(prevRatings)),
    },
    series,
    services,
    providers,
    surveys,
    utilization: {
      cells,
      openHours,
      bookedMinutes: Math.round(bookedMinutes),
      openMinutes,
      capacityUsedPct: openMinutes === 0 ? 0 : Math.min((bookedMinutes / openMinutes) * 100, 100),
      busiest: busiestCell
        ? { weekday: busiestCell.weekday, hour: busiestCell.hour, count: busiestCell.count }
        : null,
    },
    retention: {
      newCustomers,
      returningCustomers,
      returningSharePct:
        customersInRange.size === 0 ? 0 : (returningCustomers / customersInRange.size) * 100,
      topRepeat,
    },
  };
}
