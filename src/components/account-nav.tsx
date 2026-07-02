import { Link, useNavigate } from "@tanstack/react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

export function AccountNav() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="h-9 w-24 rounded bg-surface-container animate-pulse" />;
  }

  if (!user) {
    return (
      <Link
        to="/auth"
        className="font-label-md text-label-md text-on-surface hover:text-primary transition-colors px-3 py-2 rounded"
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.email ?? "?").slice(0, 1).toUpperCase();

  return (
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="cursor-pointer"
        >
          <Icon name="logout" className="text-[18px] mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}