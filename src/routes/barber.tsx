import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/barber")({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: "/provider" });
  },
});
