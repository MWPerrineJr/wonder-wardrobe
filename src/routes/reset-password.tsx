import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your password | The Standing Chair" },
      {
        name: "description",
        content:
          "Choose a new password for your The Standing Chair account and get back to booking appointments.",
      },
      { property: "og:title", content: "Reset your password | The Standing Chair" },
      {
        property: "og:description",
        content: "Set a new password for your The Standing Chair account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkValid, setLinkValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase delivers the recovery session either via the URL hash or via
    // a code exchange handled by the client; either way a session must exist.
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setLinkValid(Boolean(data.session));
      setReady(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setLinkValid(true);
        setReady(true);
      }
    });
    void check();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      // Recovery sessions are exempt from the current-password requirement.
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="font-headline-md text-headline-md font-bold text-primary tracking-tight"
          >
            The Standing Chair
          </Link>
          <h1 className="mt-6 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Set a new password
          </h1>
        </div>

        {!ready ? (
          <div className="glass-panel rounded-xl p-8 text-center text-on-surface-variant">
            Checking your link…
          </div>
        ) : !linkValid ? (
          <div className="glass-panel rounded-xl p-6 md:p-8 flex flex-col gap-4">
            <p className="text-body-md text-on-surface-variant">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Link
              to="/auth"
              className="w-full text-center bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg font-bold hover:bg-primary/90 transition-all"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="glass-panel rounded-xl p-6 md:p-8 flex flex-col gap-4"
          >
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
                New password
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
                Confirm new password
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg font-bold hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {submitting ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
