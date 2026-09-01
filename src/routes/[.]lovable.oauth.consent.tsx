import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AuthorizationDetails = {
  client?: { name?: string; redirect_uri?: string } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

// Narrow local typed wrapper — the supabase.auth.oauth beta namespace isn't in the
// generated types yet. Cast at the call site rather than editing the generated client.
function oauth() {
  return (
    supabase.auth as unknown as {
      oauth: {
        getAuthorizationDetails: (
          id: string,
        ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
        approveAuthorization: (
          id: string,
        ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
        denyAuthorization: (
          id: string,
        ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
      };
    }
  ).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center bg-background p-6 text-on-surface">
      <div className="max-w-md text-center">
        <h1 className="font-headline-md text-headline-md">
          Could not load this authorization request
        </h1>
        <p className="mt-3 text-body-md text-on-surface-variant">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setErr(null);
    const res = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (res.error) {
      setBusy(false);
      setErr(res.error.message);
      return;
    }
    const target = res.data?.redirect_url ?? res.data?.redirect_to;
    if (!target) {
      setBusy(false);
      setErr("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6 text-on-surface">
      <div className="w-full max-w-md glass-panel rounded-xl p-6 md:p-8 flex flex-col gap-5">
        <div>
          <h1 className="font-headline-md text-headline-md">
            Connect {clientName} to The Standing Chair
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {clientName} will be able to call The Standing Chair&rsquo;s enabled tools as you while
            you&rsquo;re signed in. This does not bypass The Standing Chair&rsquo;s permissions or
            backend policies.
          </p>
        </div>
        {details?.scope && (
          <div className="text-body-sm text-on-surface-variant">
            Requested scopes: <span className="font-mono">{details.scope}</span>
          </div>
        )}
        {err && (
          <p role="alert" className="text-body-sm text-red-500">
            {err}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg font-bold hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 border border-border-subtle rounded-lg bg-surface hover:border-primary transition-colors py-3 text-on-surface font-label-md text-label-md disabled:opacity-60"
          >
            Cancel connection
          </button>
        </div>
      </div>
    </main>
  );
}
