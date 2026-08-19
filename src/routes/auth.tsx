import { createFileRoute, Link, useHydrated, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { ConfirmSignOutDialog } from "@/components/confirm-sign-out";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string; mode?: "sign_up" } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
    mode: s.mode === "sign_up" ? ("sign_up" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — The Standing Chair" },
      { name: "description", content: "Sign in or create your The Standing Chair account to book providers and manage appointments." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, user, loading, signOut } = useAuth();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { next, mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"sign_in" | "sign_up">(initialMode === "sign_up" ? "sign_up" : "sign_in");
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: next ? window.location.origin + next : window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
        router.invalidate();
        if (next) {
          window.location.href = next;
        } else {
          navigate({ to: "/" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        router.invalidate();
        if (next) {
          window.location.href = next;
        } else {
          navigate({ to: "/" });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setSubmitting(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: next ? window.location.origin + next : window.location.origin,
        ...(provider === "google" ? { extraParams: { prompt: "select_account" } } : {}),
      });
      if (result.error) {
        const message = result.error instanceof Error ? result.error.message : String(result.error);
        toast.error(message);
      }
      // If redirected, the browser is navigating away — nothing else to do.
    } catch (err) {
      const message = err instanceof Error ? err.message : "OAuth sign-in failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <div className="min-h-screen bg-background text-on-background flex items-center justify-center px-4 py-12 font-body-md">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
            The Standing Chair
          </Link>
          <h1 className="mt-6 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            {session ? "You're already signed in" : mode === "sign_in" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-on-surface-variant text-body-md">
            {session
              ? "Continue where you left off, or sign out to use a different account."
              : mode === "sign_in"
                ? "Sign in to book your next cut."
                : "Sign up to start booking appointments."}
          </p>
        </div>

        {!hydrated || loading ? (
          <div className="glass-panel rounded-xl p-8 text-center text-on-surface-variant">Loading…</div>
        ) : session ? (
          <div className="glass-panel rounded-xl p-6 md:p-8 flex flex-col gap-4">
            <div className="text-body-md text-on-surface">
              Signed in as <span className="font-bold">{user?.email}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg font-bold hover:bg-primary/90 transition-all"
            >
              Continue to home
            </button>
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(true)}
              className="w-full border border-border-subtle rounded-lg bg-surface hover:border-primary transition-colors py-3 text-on-surface font-label-md text-label-md"
            >
              Sign out
            </button>
          </div>
        ) : (
        <div className="glass-panel rounded-xl p-6 md:p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-3 border border-border-subtle rounded-lg bg-surface hover:border-primary transition-colors py-3 text-on-surface font-label-md text-label-md disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-3 border border-border-subtle rounded-lg bg-surface hover:border-primary transition-colors py-3 text-on-surface font-label-md text-label-md disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </button>
          </div>

          <div className="flex items-center gap-3 text-on-surface-variant text-label-sm">
            <div className="flex-1 h-px bg-border-subtle" />
            or
            <div className="flex-1 h-px bg-border-subtle" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "sign_up" && (
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Full name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg font-bold hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {submitting ? "Please wait…" : mode === "sign_in" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-center text-body-md text-on-surface-variant">
            {mode === "sign_in" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
              className="text-primary font-bold hover:underline"
            >
              {mode === "sign_in" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
        )}
      </div>
    </div>
    <ConfirmSignOutDialog
      open={signOutConfirmOpen}
      onOpenChange={setSignOutConfirmOpen}
      onConfirm={async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await signOut();
        toast.success("Signed out.");
      }}
    />
    </>
  );
}