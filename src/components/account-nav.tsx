import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { lovable } from "@/integrations/lovable/index";
import { ConfirmSignOutDialog } from "@/components/confirm-sign-out";

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

export function AccountNav() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (loading) {
    return <div className="h-9 w-24 rounded bg-surface-container animate-pulse" />;
  }

  if (!user) {
    const handleGoogle = async () => {
      setGoogleError(null);
      setGoogleLoading(true);
      try {
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
          extraParams: { prompt: "select_account" },
        });
        if (result.error) {
          setGoogleError(result.error.message ?? "Could not sign in with Google.");
          setGoogleLoading(false);
          return;
        }
        if (result.redirected) return;
      } catch (e) {
        setGoogleError(e instanceof Error ? e.message : "Could not sign in with Google.");
        setGoogleLoading(false);
      }
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="font-label-md text-label-md text-on-surface hover:text-primary transition-colors px-3 py-2 rounded"
            aria-label="Sign in menu"
          >
            Sign in
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-2">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-label-md text-label-md py-2.5 rounded-lg font-bold hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.7 19 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 43.5c5.1 0 9.7-2 13.2-5.2l-6.1-5.2c-2 1.5-4.5 2.4-7.1 2.4-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 39.1 16.2 43.5 24 43.5z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.1 5.2c-.4.4 6.8-4.9 6.8-14.8 0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>
          {googleError ? (
            <p className="mt-2 text-center text-body-sm text-red-600">{googleError}</p>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/auth" className="cursor-pointer">
              <Icon name="mail" className="text-[18px] mr-2" /> Sign in with email
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/auth" search={{ mode: "sign_up" }} className="cursor-pointer">
              <Icon name="person_add" className="text-[18px] mr-2" /> Create an account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/auth/google-test" className="cursor-pointer">
              <Icon name="science" className="text-[18px] mr-2" /> Test Google sign-in
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const initial = (user.email ?? "?").slice(0, 1).toUpperCase();

  const doSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface hover:border-primary transition-colors px-2 py-1"
          aria-label="Account menu"
        >
          <span className="h-7 w-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-md text-label-md font-bold">
            {initial}
          </span>
          <Icon name="expand_more" className="text-on-surface-variant text-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">Signed in as</span>
          <span className="truncate font-medium">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/owner" className="cursor-pointer">
            <Icon name="dashboard" className="text-[18px] mr-2" /> Owner dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/onboarding/owner" className="cursor-pointer">
            <Icon name="storefront" className="text-[18px] mr-2" /> Become a shop owner
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/auth/google-test" className="cursor-pointer">
            <Icon name="science" className="text-[18px] mr-2" /> Test Google sign-in
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setConfirmOpen(true);
          }}
          className="cursor-pointer"
        >
          <Icon name="logout" className="text-[18px] mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmSignOutDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={doSignOut} />
    </>
  );
}