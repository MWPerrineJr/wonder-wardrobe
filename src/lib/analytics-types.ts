// Client-safe DTO shapes for the owner analytics dashboard.

export type Granularity = "day" | "week" | "month";

export type TrendValue = { current: number; previous: number };

export type AnalyticsKpis = {
  revenueBookedCents: TrendValue;
  revenueCollectedCents: TrendValue;
  appointments: TrendValue;
  avgTicketCents: TrendValue;
  completionRate: TrendValue;
  avgRating: TrendValue;
};

export type SeriesPoint = {
  bucket: string;
  label: string;
  revenueBookedCents: number;
  revenueCollectedCents: number;
  total: number;
  completed: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  noShow: number;
  lostRatePct: number;
  returningSharePct: number | null;
};

export type ServiceRow = {
  id: string;
  name: string;
  bookings: number;
  revenueCents: number;
  avgPriceCents: number;
  sharePct: number;
};

export type ProviderRow = {
  id: string;
  name: string;
  appointments: number;
  revenueCents: number;
  avgTicketCents: number;
  avgRating: number | null;
  sharePct: number;
};

export type SurveyStats = {
  invitesSent: number;
  responses: number;
  completionRatePct: number;
  avgRating: number | null;
  ratingCounts: { rating: number; count: number }[];
  sentiment: { label: string; count: number }[];
};

export type HeatmapCell = { weekday: number; hour: number; count: number; open: boolean };

export type Utilization = {
  cells: HeatmapCell[];
  openHours: { weekday: number; openHour: number; closeHour: number; closed: boolean }[];
  bookedMinutes: number;
  openMinutes: number;
  capacityUsedPct: number;
  busiest: { weekday: number; hour: number; count: number } | null;
};

export type Retention = {
  newCustomers: number;
  returningCustomers: number;
  returningSharePct: number;
  topRepeat: { name: string; visits: number; revenueCents: number }[];
};

export type ShopAnalytics = {
  locked: boolean;
  range: { start: string; end: string; days: number; granularity: Granularity };
  kpis: AnalyticsKpis;
  series: SeriesPoint[];
  services: ServiceRow[];
  providers: ProviderRow[];
  surveys: SurveyStats;
  utilization: Utilization;
  retention: Retention;
};

export const ANALYTICS_RANGES = [7, 30, 90, 365] as const;

export function granularityForDays(days: number): Granularity {
  if (days <= 90) return "day";
  if (days <= 180) return "week";
  return "month";
}

export function emptyAnalytics(days: number): ShopAnalytics {
  const zero: TrendValue = { current: 0, previous: 0 };
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  return {
    locked: true,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
      days,
      granularity: granularityForDays(days),
    },
    kpis: {
      revenueBookedCents: zero,
      revenueCollectedCents: zero,
      appointments: zero,
      avgTicketCents: zero,
      completionRate: zero,
      avgRating: zero,
    },
    series: [],
    services: [],
    providers: [],
    surveys: {
      invitesSent: 0,
      responses: 0,
      completionRatePct: 0,
      avgRating: null,
      ratingCounts: [],
      sentiment: [],
    },
    utilization: {
      cells: [],
      openHours: [],
      bookedMinutes: 0,
      openMinutes: 0,
      capacityUsedPct: 0,
      busiest: null,
    },
    retention: { newCustomers: 0, returningCustomers: 0, returningSharePct: 0, topRepeat: [] },
  };
}
