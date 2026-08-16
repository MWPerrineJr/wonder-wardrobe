import { useState } from "react";
import { queryOptions, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { getSurveyInvite, submitSurveyFeedback } from "@/lib/survey.functions";

const inputClass =
  "w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md";

const inviteQuery = (token: string) =>
  queryOptions({
    queryKey: ["survey", "invite", token],
    queryFn: () => getSurveyInvite({ data: { token } }),
  });

export const Route = createFileRoute("/survey/$token")({
  head: () => ({
    meta: [
      { title: "How was your visit? — The Standing Chair" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ params, context }) => context.queryClient.ensureQueryData(inviteQuery(params.token)),
  errorComponent: ({ error }) => (
    <Shell>
      <p className="text-on-surface-variant text-body-md">
        Couldn't load this survey: {error.message}
      </p>
    </Shell>
  ),
  component: SurveyPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-panel rounded-xl p-6 sm:p-8 w-full max-w-lg flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

function SurveyPage() {
  const { token } = Route.useParams();
  const { data: invite } = useSuspenseQuery(inviteQuery(token));

  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => submitSurveyFeedback({ data: { token, rating, message: message.trim() } }),
    onSuccess: () => setSent(true),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save your feedback"),
  });

  if (invite.status !== "ok") {
    const copy =
      invite.status === "used"
        ? "This survey has already been submitted — thank you!"
        : invite.status === "expired"
          ? "This survey link has expired."
          : "This survey link isn't valid.";
    return (
      <Shell>
        <h1 className="font-headline-md text-headline-md text-on-surface">
          Thanks for stopping by
        </h1>
        <p className="text-on-surface-variant text-body-md">{copy}</p>
        <Link to="/" className="self-start text-primary font-bold text-label-md">
          Browse shops
        </Link>
      </Shell>
    );
  }

  if (sent) {
    return (
      <Shell>
        <h1 className="font-headline-md text-headline-md text-on-surface">Thank you!</h1>
        <p className="text-on-surface-variant text-body-md">
          Your feedback is on its way to {invite.shopName}. They read every response.
        </p>
      </Shell>
    );
  }

  const valid = message.trim().length >= 5 && rating >= 1 && rating <= 5;

  return (
    <Shell>
      <h1 className="font-headline-md text-headline-md text-on-surface">
        {invite.customerName ? `${invite.customerName}, how` : "How"} was your visit to{" "}
        {invite.shopName}?
      </h1>
      {invite.providerName && (
        <p className="text-on-surface-variant text-body-md">You saw {invite.providerName}.</p>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) mutation.mutate();
        }}
      >
        <div>
          <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
            Rating *
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRating(r)}
                aria-label={`${r} star${r > 1 ? "s" : ""}`}
                className={`w-10 h-10 rounded border transition-colors ${
                  r <= rating
                    ? "border-primary text-primary font-bold"
                    : "border-border-subtle text-on-surface-variant"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
            Tell us about it *
          </label>
          <textarea
            required
            rows={4}
            minLength={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What stood out? What could be better?"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={!valid || mutation.isPending}
          className="self-start bg-primary text-on-primary px-6 py-3 rounded font-bold text-label-md disabled:opacity-50"
        >
          {mutation.isPending ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </Shell>
  );
}
