import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AccountNav } from "@/components/account-nav";
import { getDiagnostics } from "@/lib/diagnostics.functions";

export const Route = createFileRoute("/_authenticated/owner_/diagnostics")({
  head: () => ({
    meta: [
      { title: "Deployment diagnostics — The Standing Chair" },
      {
        name: "description",
        content:
          "Deployment health for shop owners: payment environment, webhook delivery, background jobs, and calendar sync backlog.",
      },
      { property: "og:title", content: "Deployment diagnostics — The Standing Chair" },
      {
        property: "og:description",
        content: "Payment environment, webhook delivery, background jobs, and calendar sync backlog.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background text-on-surface">
      <p className="text-on-surface-variant">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: DiagnosticsPage,
});

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
      }`}
    >
      <Icon name={ok ? "check_circle" : "error"} className="text-[16px]" />
      {label}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DiagnosticsPage() {
  const fetchDiagnostics = useServerFn(getDiagnostics);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["owner", "diagnostics"],
    queryFn: () => fetchDiagnostics({ data: undefined as never }),
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/owner" className="text-sm text-muted-foreground hover:text-foreground">
              ← Dashboard
            </Link>
            <h1 className="text-lg font-semibold">Deployment diagnostics</h1>
          </div>
          <AccountNav />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Configuration names and counts only — no keys or secrets are shown here.
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading diagnostics…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

        {data && (
          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Payments">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium uppercase">
                  {data.environment}
                </span>
                <Pill ok={data.paymentsDeclared} label={data.paymentsDeclared ? "Declared" : "Inferred"} />
                <Pill
                  ok={data.paymentsConfigured}
                  label={data.paymentsConfigured ? "Ready" : "Not ready"}
                />
              </div>
              {data.paymentsMissing.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-destructive">
                  {data.paymentsMissing.map((name) => (
                    <li key={name}>{name} is not configured</li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Origins & scheduler">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Worker APP_URL</dt>
                  <dd className="font-medium break-all">{data.appUrl ?? "not set"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Cron target</dt>
                  <dd className="font-medium break-all">{data.cronAppUrl ?? "not set"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Job secret</dt>
                  <dd>
                    <Pill ok={data.jobSecretOk} label={data.jobSecretOk ? "Usable" : "Invalid"} />
                  </dd>
                </div>
                {data.appUrl && data.cronAppUrl && data.appUrl !== data.cronAppUrl && (
                  <p className="text-xs text-destructive">
                    Cron target does not match the worker origin — scheduled jobs will hit a
                    different deployment.
                  </p>
                )}
              </dl>
            </Card>

            <Card title="Payment webhook (ledger)">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  ["Completed 24h", data.webhook.completed24h, false],
                  ["Processing", data.webhook.processing, data.webhook.processing > 0],
                  ["Failed", data.webhook.failed, data.webhook.failed > 0],
                ].map(([label, value, bad]) => (
                  <div key={String(label)} className="rounded-lg bg-muted/50 p-3">
                    <p
                      className={`text-2xl font-semibold ${bad ? "text-destructive" : "text-foreground"}`}
                    >
                      {String(value)}
                    </p>
                    <p className="text-xs text-muted-foreground">{String(label)}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Backlogs">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Unpaid holds outstanding</dt>
                  <dd className="font-medium">{data.holdsPending}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Calendar outbox pending</dt>
                  <dd className="font-medium">{data.calendarOutboxPending}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Calendar outbox failed</dt>
                  <dd
                    className={`font-medium ${data.calendarOutboxFailed > 0 ? "text-destructive" : ""}`}
                  >
                    {data.calendarOutboxFailed}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Survey dead letters</dt>
                  <dd
                    className={`font-medium ${data.surveyDeadLetters > 0 ? "text-destructive" : ""}`}
                  >
                    {data.surveyDeadLetters}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card title="Background jobs">
              <ul className="divide-y divide-border text-sm">
                {data.jobs.map((job) => (
                  <li key={job.job} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-medium">{job.job}</span>
                    <span className="flex items-center gap-2">
                      <Pill ok={job.status !== "paused"} label={job.status} />
                      <span className="text-xs text-muted-foreground">
                        {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "never run"}
                      </span>
                    </span>
                    {job.pausedReason && (
                      <span className="w-full text-xs text-destructive">{job.pausedReason}</span>
                    )}
                  </li>
                ))}
                {data.jobs.length === 0 && (
                  <li className="py-2 text-muted-foreground">No jobs registered.</li>
                )}
              </ul>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
