import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AccountNav } from "@/components/account-nav";
import { getPaymentsDiagnostics } from "@/lib/payments-diagnostics.functions";

const diagnosticsQuery = queryOptions({
  queryKey: ["payments-diagnostics"],
  queryFn: () => getPaymentsDiagnostics(),
});

export const Route = createFileRoute("/_authenticated/owner_/diagnostics")({
  head: () => ({
    meta: [
      { title: "Payment diagnostics — The Standing Chair" },
      {
        name: "description",
        content: "See which Stripe payment mode this deployment is running.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(diagnosticsQuery),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 text-on-surface bg-background">
      <div>
        <h1 className="font-headline-md text-headline-md mb-2">Something went wrong</h1>
        <p className="text-on-surface-variant">{error.message}</p>
      </div>
    </div>
  ),
  component: DiagnosticsPage,
});

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border-subtle last:border-0">
      <span className="text-on-surface-variant text-body-md">{label}</span>
      <span
        className={`text-right font-label-md text-label-md ${
          ok === false ? "text-destructive" : "text-on-surface"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function DiagnosticsPage() {
  const { data } = useSuspenseQuery(diagnosticsQuery);
  const mode = data.environment ?? "not set";

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <header className="border-b border-border-subtle bg-surface">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-4">
          <Link to="/" className="font-headline-md text-headline-md text-primary tracking-tight">
            The Standing Chair
          </Link>
          <AccountNav />
        </div>
      </header>

      <main className="max-w-xl mx-auto p-margin-mobile md:p-margin-desktop flex flex-col gap-6">
        <div>
          <Link to="/owner" className="text-label-sm text-on-surface-variant hover:text-on-surface">
            ← Dashboard
          </Link>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mt-2">
            Payment diagnostics
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            This deployment has one payment mode. Live charges are never turned on just because a
            live Stripe key exists.
          </p>
        </div>

        <section className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm">
          <Row label="PAYMENTS_ENV" value={mode} ok={data.ok} />
          <Row
            label="Status"
            value={data.ok ? "Ready" : "Incomplete"}
            ok={data.ok}
          />
          <Row
            label="Stripe connection"
            value={data.stripeKeyConfigured ? "Configured" : "Missing"}
            ok={data.stripeKeyConfigured}
          />
          <Row
            label="Webhook secret"
            value={data.webhookSecretConfigured ? "Configured" : "Missing"}
            ok={data.webhookSecretConfigured}
          />
          <Row
            label="Lovable API key"
            value={data.lovableApiKeyConfigured ? "Configured" : "Missing"}
            ok={data.lovableApiKeyConfigured}
          />
          <Row
            label="APP_URL"
            value={data.appUrlConfigured ? "Configured" : "Missing"}
            ok={data.appUrlConfigured}
          />
          <Row
            label="Client token"
            value={data.clientToken}
            ok={data.clientToken !== "missing"}
          />
          <Row label="Webhook path" value={data.webhookPath ?? "—"} />
        </section>

        {!data.ok && data.issues.length > 0 && (
          <section className="bg-destructive/10 border border-destructive/30 rounded-xl p-6">
            <h2 className="font-headline-md text-headline-md text-destructive mb-2">Fix these</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1 text-body-md text-on-surface">
              {data.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
