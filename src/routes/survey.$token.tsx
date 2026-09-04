import { useState } from "react";
import { queryOptions, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { getSurveyInvite, submitSurveyFeedback, type SurveyInviteView } from "@/lib/survey.functions";

const inputClass =
  "w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md";

// Survey tokens are uuids. A malformed token is just a bad link, so treat it as
// an invalid invite instead of letting server-side validation throw a 500.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const inviteQuery = (token: string) =>
  queryOptions({
    queryKey: ["survey", "invite", token],
    queryFn: async (): Promise<SurveyInviteView> =>
      UUID_RE.test(token) ? getSurveyInvite({ data: { token } }) : { status: "invalid" },
  });


export const Route = createFileRoute("/survey/$token")({
  head: () => ({
    meta: [
      { title: "How was your visit? — The Standing Chair" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ params, context }) => context.queryClient.ensureQueryData(inviteQuery(params.token)),
  errorComponent: () => (
    <Shell>
      <h1 className="font-headline-md text-headline-md text-on-surface">
        We couldn&apos;t open this survey
      </h1>
      <p className="text-on-surface-variant text-body-md">
        The link may have expired. If you still want to share how your visit went, reply to the
        email we sent you and we&apos;ll pass it along.
      </p>
      <Link to="/" className="self-start text-primary font-bold text-label-md">
        Browse shops
      </Link>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="text-on-surface-variant text-body-md">This survey link isn&apos;t valid.</p>
      <Link to="/" className="self-start text-primary font-bold text-label-md">
        Browse shops
      </Link>
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

  const [rating, setRating] = useState(invite.ratingHint ?? 0);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [googleAsk, setGoogleAsk] = useState<{ url: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () => submitSurveyFeedback({ data: { token, rating, message: message.trim() } }),
    onSuccess: (result) => {
      setSent(true);
      if (result.promptGoogle && result.googleReviewUrl)
        setGoogleAsk({ url: result.googleReviewUrl });
    },
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
        {googleAsk ? (
          <>
            <p className="text-on-surface-variant text-body-md">
              So glad you had a good visit. Would you share it publicly? A Google review helps{" "}
              {invite.shopName} more than anything else.
            </p>
            <a
              href={googleAsk.url}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start bg-primary text-on-primary px-6 py-3 rounded font-bold text-label-md"
            >
              Review on Google
            </a>
            <p className="text-on-surface-variant text-body-sm">
              No pressure — your feedback already reached the shop.
            </p>
          </>
        ) : (
          <p className="text-on-surface-variant text-body-md">
            Your feedback is on its way to {invite.shopName}. They read every response, and someone
            will follow up if anything needs fixing.
          </p>
        )}
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
