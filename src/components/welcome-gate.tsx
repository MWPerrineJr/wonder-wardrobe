import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { useAuth } from "@/hooks/use-auth";
import { lovable } from "@/integrations/lovable/index";

const GUEST_KEY = "cnc_guest";

export function WelcomeGate() {
  const { user, loading } = useAuth();
  const [decided, setDecided] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    try {
      setDecided(window.localStorage.getItem(GUEST_KEY) === "1");
    } catch {
      setDecided(true);
    }
  }, []);

  if (loading || decided === null) return null;
  if (user) return null;
  if (decided) return null;

  const continueAsGuest = () => {
    try {
      window.localStorage.setItem(GUEST_KEY, "1");
    } catch {
      /* ignore */
    }
    setDecided(true);
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        setError(result.error.message ?? "Could not sign in with Google.");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in with Google.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-8 flex flex-col gap-6 shadow-2xl">
        <div className="text-center">
          <div className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
            Crown &amp; Cut
          </div>
          <h2 className="mt-3 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Welcome
          </h2>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Sign in to book faster and track your appointments — or keep browsing as a guest.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg font-bold hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.7 19 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 43.5c5.1 0 9.7-2 13.2-5.2l-6.1-5.2c-2 1.5-4.5 2.4-7.1 2.4-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 39.1 16.2 43.5 24 43.5z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.1 5.2c-.4.4 6.8-4.9 6.8-14.8 0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>
          <Link
            to="/auth"
            className="w-full text-center border border-border-subtle bg-surface rounded-lg py-3 text-on-surface font-label-md text-label-md hover:border-primary transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "sign_up" }}
            className="w-full text-center border border-border-subtle bg-surface rounded-lg py-3 text-on-surface font-label-md text-label-md hover:border-primary transition-colors"
          >
            Create an account
          </Link>
          <button
            type="button"
            onClick={continueAsGuest}
            className="w-full text-center py-2 text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors"
          >
            Continue as guest
          </button>
          {error ? (
            <p className="text-center text-body-sm text-red-600">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}