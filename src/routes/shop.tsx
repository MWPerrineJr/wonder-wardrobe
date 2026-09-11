import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/shop")({
  staticData: { sitemap: false },
  component: () => <Outlet />,
});
