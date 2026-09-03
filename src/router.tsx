import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { captureCampaign } from "./lib/campaign";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // Capture sign-up campaign links (?utm_source=…) before any route gate can
  // redirect to /auth and drop the query string.
  if (typeof window !== "undefined") {
    captureCampaign(window.location.search, document.referrer);
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
