import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/barber")({
  beforeLoad: () => {
    throw redirect({ to: "/provider" });
  },
});
