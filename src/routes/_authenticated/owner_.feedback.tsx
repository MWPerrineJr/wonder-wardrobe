import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountNav } from "@/components/account-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMyShops } from "@/lib/shops.functions";
import {
  getShopReport,
  listFeedback,
  regenerateShopReport,
  updateFeedbackStatus,
  type FeedbackRow,
} from "@/lib/feedback.functions";
import {
  AnalyticsUpgradePanel,
  ManageBillingButton,
} from "@/components/analytics-upgrade-panel";
import { PaymentTestModeBanner } from "@/components/payment-test-banner";
import { getStripeEnvironment } from "@/lib/stripe";

const myShopsQuery = queryOptions({
  queryKey: ["owner", "shops"],
  queryFn: () => getMyShops(),
});

export const Route = createFileRoute("/_authenticated/owner_/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback Intelligence — The Standing Chair" },
      {
        name: "description",
        content: "AI-powered customer feedback insights for your business.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myShopsQuery),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 text-on-surface bg-background">
      <div>
        <h1 className="font-headline-md text-headline-md mb-2">Something went wrong</h1>
        <p className="text-on-surface-variant">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-on-surface">Not found.</div>,
  component: FeedbackPage,
});

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const SOURCES = ["all", "web", "email_survey", "google", "yelp", "instagram", "walk_in"] as const;
const SENTIMENTS = [
  "all",
  "very_positive",
  "positive",
  "neutral",
  "negative",
  "very_negative",
] as const;
const URGENCIES = ["all", "low", "medium", "high"] as const;
const STATUSES = ["all", "new", "reviewed", "responded", "archived"] as const;

function FeedbackPage() {
  const { data: shops } = useSuspenseQuery(myShopsQuery);
  const [selectedId, setSelectedId] = useState<string | null>(shops[0]?.id ?? null);
  const [source, setSource] = useState<string>("all");
  const [sentiment, setSentiment] = useState<string>("all");
  const [urgency, setUrgency] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  if (shops.length === 0) {
    return (
      <div className="min-h-screen bg-background text-on-background flex items-center justify-center px-4">
        <div className="max-w-md text-center flex flex-col gap-4">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            You don't have a shop yet
          </h1>
          <Link
            to="/onboarding/owner"
            className="mx-auto bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-all"
          >
            Set up your shop
          </Link>
        </div>
      </div>
    );
  }

  const selected = shops.find((s) => s.id === selectedId) ?? shops[0];

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <PaymentTestModeBanner />
      <header className="border-b border-border-subtle bg-surface">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-headline-md text-headline-md text-primary tracking-tight">
              The Standing Chair
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-label-md">
              <Link to="/owner" className="text-on-surface-variant hover:text-on-surface">
                Dashboard
              </Link>
              <Link to="/owner/feedback" className="text-primary font-semibold">
                Feedback
              </Link>
            </nav>
          </div>
          <AccountNav />
        </div>
      </header>

      <main className="max-w-container-max mx-auto p-margin-mobile md:p-margin-desktop flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              Feedback Intelligence
            </h1>
            <p className="text-on-surface-variant text-body-md mt-1">
              AI-powered insights for {selected.name}.
            </p>
          </div>
          {shops.length > 1 && (
            <select
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-surface border border-border-subtle rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <FeedbackContent
          shopId={selected.id}
          filters={{ source, sentiment, urgency, status }}
          setSource={setSource}
          setSentiment={setSentiment}
          setUrgency={setUrgency}
          setStatus={setStatus}
        />
      </main>
    </div>
  );
}

type Filters = { source: string; sentiment: string; urgency: string; status: string };

function FeedbackContent({
  shopId,
  filters,
  setSource,
  setSentiment,
  setUrgency,
  setStatus,
}: {
  shopId: string;
  filters: Filters;
  setSource: (v: string) => void;
  setSentiment: (v: string) => void;
  setUrgency: (v: string) => void;
  setStatus: (v: string) => void;
}) {
  const qc = useQueryClient();
  const queryKey = useMemo(
    () => ["owner", "feedback", shopId, filters] as const,
    [shopId, filters],
  );

  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey,
      queryFn: () =>
        listFeedback({ data: { shopId, environment: getStripeEnvironment(), ...filters } }),
    }),
  );

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: "reviewed" | "responded" | "archived" }) =>
      updateFeedbackStatus({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(`Marked as ${vars.status}.`);
      qc.invalidateQueries({ queryKey: ["owner", "feedback", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { aggregates, rows } = data;

  if (data.locked) {
    return <AnalyticsUpgradePanel shopId={shopId} />;
  }

  return (
    <>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
        <StatCard icon="reviews" label="Total feedback" value={String(aggregates.total)} />
        <StatCard
          icon="sentiment_satisfied"
          label="Avg sentiment"
          value={aggregates.avgSentiment === null ? "—" : aggregates.avgSentiment.toFixed(2)}
          tone={
            aggregates.avgSentiment === null
              ? "neutral"
              : aggregates.avgSentiment >= 0.25
                ? "good"
                : aggregates.avgSentiment <= -0.25
                  ? "bad"
                  : "neutral"
          }
        />
        <StatCard
          icon="thumb_down"
          label="Negative reviews"
          value={String(aggregates.negativeCount)}
          tone={aggregates.negativeCount > 0 ? "bad" : "neutral"}
        />
        <StatCard
          icon="priority_high"
          label="High urgency"
          value={String(aggregates.highUrgencyCount)}
          tone={aggregates.highUrgencyCount > 0 ? "bad" : "neutral"}
        />
      </section>

      <section className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-wrap gap-3 items-end shadow-sm">
        <FilterSelect
          label="Source"
          value={filters.source}
          onChange={setSource}
          options={[...SOURCES]}
        />
        <FilterSelect
          label="Sentiment"
          value={filters.sentiment}
          onChange={setSentiment}
          options={[...SENTIMENTS]}
        />
        <FilterSelect
          label="Urgency"
          value={filters.urgency}
          onChange={setUrgency}
          options={[...URGENCIES]}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={setStatus}
          options={[...STATUSES]}
        />
      </section>

      {rows.length === 0 ? (
        <ShopReportPanel shopId={shopId} />
      ) : (
        <ShopReportPanel shopId={shopId} />
      )}

      {rows.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-xl p-10 text-center">
          <Icon name="inbox" className="text-[32px] text-on-surface-variant" />
          <p className="text-on-surface-variant mt-2">No feedback matches these filters.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <FeedbackCard
              key={row.id}
              row={row}
              onUpdateStatus={(next) => statusMutation.mutate({ id: row.id, status: next })}
              pending={statusMutation.isPending}
            />
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <ManageBillingButton shopId={shopId} />
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneCls =
    tone === "good" ? "text-green-600" : tone === "bad" ? "text-destructive" : "text-on-surface";
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name={icon} className="text-primary" />
        <span className="font-label-md text-label-md">{label}</span>
      </div>
      <span className={`font-headline-lg text-headline-lg ${toneCls}`}>{value}</span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt === "all" ? "All" : humanize(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FeedbackCard({
  row,
  onUpdateStatus,
  pending,
}: {
  row: FeedbackRow;
  onUpdateStatus: (status: "reviewed" | "responded" | "archived") => void;
  pending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-label-md text-on-surface font-semibold">
              {row.customer_name ?? "Anonymous"}
            </span>
            {row.source && (
              <Badge variant="outline" className="capitalize">
                {humanize(row.source)}
              </Badge>
            )}
            {row.rating !== null && <RatingStars rating={row.rating} />}
          </div>
          <span className="text-label-sm text-on-surface-variant">
            {formatDate(row.created_at)}
            {row.customer_email && <> · {row.customer_email}</>}
          </span>
        </div>
        <StatusBadge status={row.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        {row.sentiment_label && (
          <Badge className={sentimentBadgeCls(row.sentiment_label)}>
            {humanize(row.sentiment_label)}
            {row.sentiment_score !== null && ` · ${Number(row.sentiment_score).toFixed(2)}`}
          </Badge>
        )}
        {row.emotion && <Badge variant="secondary">{humanize(row.emotion)}</Badge>}
        {row.urgency && (
          <Badge className={urgencyBadgeCls(row.urgency)}>{humanize(row.urgency)} urgency</Badge>
        )}
      </div>

      {row.summary && (
        <p className="text-on-surface text-body-md">
          <span className="text-on-surface-variant font-semibold">Summary: </span>
          {row.summary}
        </p>
      )}

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
          {row.message && (
            <div>
              <p className="text-label-sm text-on-surface-variant mb-1">Full message</p>
              <p className="text-body-md text-on-surface whitespace-pre-wrap">{row.message}</p>
            </div>
          )}
          {row.explanation && (
            <div>
              <p className="text-label-sm text-on-surface-variant mb-1">AI explanation</p>
              <p className="text-body-md text-on-surface">{row.explanation}</p>
            </div>
          )}
          {row.key_phrases.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {row.key_phrases.map((phrase) => (
                <Badge key={phrase} variant="outline">
                  {phrase}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {row.recommended_response && (
        <div className="bg-background border border-border-subtle rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-label-sm text-on-surface-variant font-semibold">
              Recommended response
            </span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(row.recommended_response ?? "");
                toast.success("Copied to clipboard.");
              }}
              className="text-label-sm text-primary hover:underline"
            >
              Copy
            </button>
          </div>
          <p className="text-body-md text-on-surface">{row.recommended_response}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <button
          type="button"
          className="text-label-sm text-primary hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending || row.status === "reviewed"}
            onClick={() => onUpdateStatus("reviewed")}
          >
            Mark reviewed
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || row.status === "responded"}
            onClick={() => onUpdateStatus("responded")}
          >
            Mark responded
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || row.status === "archived"}
            onClick={() => onUpdateStatus("archived")}
          >
            Archive
          </Button>
        </div>
      </div>
    </li>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center text-amber-500" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="material-symbols-outlined text-[16px]">
          {i < rating ? "star" : "star_outline"}
        </span>
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "new"
      ? "bg-blue-100 text-blue-800"
      : status === "reviewed"
        ? "bg-amber-100 text-amber-800"
        : status === "responded"
          ? "bg-green-100 text-green-800"
          : "bg-gray-200 text-gray-700";
  return <Badge className={`${cls} border-transparent capitalize`}>{humanize(status)}</Badge>;
}

function sentimentBadgeCls(label: string) {
  switch (label) {
    case "very_positive":
      return "bg-green-200 text-green-900 border-transparent";
    case "positive":
      return "bg-green-100 text-green-800 border-transparent";
    case "neutral":
      return "bg-gray-200 text-gray-800 border-transparent";
    case "negative":
      return "bg-orange-200 text-orange-900 border-transparent";
    case "very_negative":
      return "bg-red-200 text-red-900 border-transparent";
    default:
      return "bg-gray-100 text-gray-700 border-transparent";
  }
}

function urgencyBadgeCls(urgency: string) {
  switch (urgency) {
    case "high":
      return "bg-red-100 text-red-800 border-transparent";
    case "medium":
      return "bg-amber-100 text-amber-800 border-transparent";
    default:
      return "bg-gray-100 text-gray-700 border-transparent";
  }
}

function humanize(v: string) {
  return v.replace(/_/g, " ");
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
