import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { ConfirmSignOutDialog } from "@/components/confirm-sign-out";

export const Route = createFileRoute("/auth/google-test")({
  head: () => ({
    meta: [
      { title: "Google sign-in test — The Standing Chair" },
      {
        name: "description",
        content: "Verify the Google sign-in round trip and see the selected account email.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GoogleTestPage,
});

function GoogleTestPage() {
  const { user, loading, signOut } = useAuth();
  const [lastEvent, setLastEvent] = useState<string>("(none yet)");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      setLastEvent(event);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const startGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/google-test`,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        const msg = result.error instanceof Error ? result.error.message : String(result.error);
        setError(msg);
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  const tryAnother = async () => {
    await signOut();
    await startGoogle();
  };

  const identityEmail = user?.identities?.[0]?.identity_data?.email as string | undefined;
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? undefined;
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? undefined;
  const provider = user?.app_metadata?.provider as string | undefined;

  return (
    <>
      <div className="min-h-screen bg-background text-on-background flex items-center justify-center px-4 py-12 font-body-md">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link
              to="/"
              className="font-headline-md text-headline-md font-bold text-primary tracking-tight"
            >
              The Standing Chair
            </Link>
            <h1 className="mt-6 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
              Google sign-in test
            </h1>
            <p className="mt-2 text-on-surface-variant text-body-md">
              Forces the Google account chooser, then shows the email of whichever account you pick.
            </p>
          </div>

          <div className="glass-panel rounded-xl p-6 md:p-8 flex flex-col gap-4">
            {loading ? (
              <div className="text-center text-on-surface-variant">Loading…</div>
            ) : user ? (
              <>
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold">
                      {(user.email ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-label-sm text-on-surface-variant">Signed in as</div>
                    <div
                      className="truncate font-bold text-on-surface"
                      data-testid="signed-in-email"
                    >
                      {user.email}
                    </div>
                    {fullName ? (
                      <div className="text-body-sm text-on-surface-variant truncate">
                        {fullName}
                      </div>
                    ) : null}
                  </div>
                </div>

                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm">
                  <dt className="text-on-surface-variant">Provider</dt>
                  <dd className="text-on-surface">{provider ?? "unknown"}</dd>
                  <dt className="text-on-surface-variant">Identity email</dt>
                  <dd className="text-on-surface truncate">{identityEmail ?? "(none)"}</dd>
                  <dt className="text-on-surface-variant">Last auth event</dt>
                  <dd className="text-on-surface">{lastEvent}</dd>
                </dl>

                <button
                  type="button"
                  onClick={tryAnother}
                  disabled={busy}
                  className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg font-bold hover:bg-primary/90 transition-all disabled:opacity-60"
                >
                  {busy ? "Redirecting…" : "Try another Google account"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="w-full border border-border-subtle rounded-lg bg-surface hover:border-primary transition-colors py-3 text-on-surface font-label-md text-label-md"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startGoogle}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-3 bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg font-bold hover:bg-primary/90 transition-all disabled:opacity-60"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#FFC107"
                      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.3 14.7l6.6 4.8C14.7 15.7 19 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 43.5c5.1 0 9.7-2 13.2-5.2l-6.1-5.2c-2 1.5-4.5 2.4-7.1 2.4-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 39.1 16.2 43.5 24 43.5z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.1 5.2c-.4.4 6.8-4.9 6.8-14.8 0-1.2-.1-2.3-.4-3.5z"
                    />
                  </svg>
                  {busy ? "Redirecting…" : "Continue with Google"}
                </button>
                <p className="text-center text-body-sm text-on-surface-variant">
                  You'll see Google's account picker even if you're already signed into one Google
                  account.
                </p>
                <div className="text-body-sm text-on-surface-variant text-center">
                  Last auth event: <span className="text-on-surface">{lastEvent}</span>
                </div>
              </>
            )}
            {error ? <p className="text-center text-body-sm text-red-600">{error}</p> : null}
          </div>

          <p className="mt-6 text-center text-body-sm text-on-surface-variant">
            <Link to="/" className="hover:text-primary">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
      <ConfirmSignOutDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={async () => {
          await signOut();
        }}
      />
    </>
  );
}
