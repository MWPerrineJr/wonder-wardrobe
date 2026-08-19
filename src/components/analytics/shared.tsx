import type { ReactNode } from "react";

import type { TrendValue } from "@/lib/analytics-types";

export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
] as const;

export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

/** Compact currency for chart axes: $0, $850, $1.2k, $14k. */
export function moneyAxis(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
  }
  return `$${Math.round(dollars)}`;
}

/** Integer-only ticks so low-volume shops never see "1.5 appointments". */
export function countAxis(value: number): string {
  return Number.isInteger(value) ? String(value) : "";
}

export function pct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function changePct(trend: TrendValue): number | null {
  if (trend.previous === 0) return trend.current === 0 ? 0 : null;
  return ((trend.current - trend.previous) / Math.abs(trend.previous)) * 100;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "p" : "a";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${suffix}`;
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-surface border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col gap-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface leading-tight">
            {title}
          </h2>
          {subtitle && <p className="text-label-sm text-on-surface-variant mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-48 flex items-center justify-center text-center text-on-surface-variant text-body-md border border-dashed border-border-subtle rounded-lg">
      {message}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  trend,
  invertTrend = false,
  hint,
}: {
  label: string;
  value: string;
  trend?: TrendValue;
  invertTrend?: boolean;
  hint?: string;
}) {
  const delta = trend ? changePct(trend) : null;
  const positive = delta === null ? null : invertTrend ? delta < 0 : delta > 0;
  const tone =
    delta === null || delta === 0
      ? "text-on-surface-variant"
      : positive
        ? "text-positive"
        : "text-negative";

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col gap-1">
      <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">{label}</p>
      <p className="font-headline-md text-headline-md text-on-surface">{value}</p>
      {delta === null ? (
        <p className="text-label-sm text-on-surface-variant">
          {hint ?? "No comparable data last period"}
        </p>
      ) : (
        <p className={`text-label-sm ${tone}`}>
          {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`} vs previous
          period
        </p>
      )}
    </div>
  );
}

type TooltipRow = { name?: string; value?: number | string; color?: string; dataKey?: string };

export function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  format?: (value: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border-subtle rounded-lg px-3 py-2 shadow-md text-label-sm">
      {label !== undefined && <p className="text-on-surface font-semibold mb-1">{label}</p>}
      <ul className="flex flex-col gap-1">
        {payload.map((row, i) => (
          <li key={`${row.dataKey ?? row.name}-${i}`} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-on-surface-variant">{row.name}</span>
            <span className="text-on-surface ml-auto font-semibold">
              {format && typeof row.value === "number"
                ? format(row.value, String(row.dataKey ?? ""))
                : String(row.value ?? "")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}