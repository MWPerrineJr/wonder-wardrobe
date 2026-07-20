import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { useAuth } from "@/hooks/use-auth";

const GUEST_KEY = "cnc_guest";

export function WelcomeGate() {
  const { user, loading } = useAuth();
  const [decided, setDecided] = useState<boolean | null>(null);

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
          <Link
            to="/auth"
            className="w-full text-center bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg font-bold hover:bg-primary/90 transition-all"
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
        </div>
      </div>
    </div>
  );
}