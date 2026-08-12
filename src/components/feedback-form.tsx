import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { submitFeedback } from "@/lib/feedback.functions";

const inputClass =
  "w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md";

export function FeedbackForm({ shopId, slug }: { shopId: string; slug: string }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      submitFeedback({
        data: {
          shopId,
          rating,
          message: message.trim(),
          customerName: name.trim() || null,
          customerEmail: email.trim() || null,
        },
      }),
    onSuccess: () => {
      setSent(true);
      setMessage("");
      toast.success("Thanks — your feedback was saved.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save feedback"),
  });

  const valid = message.trim().length >= 5 && rating >= 1 && rating <= 5;

  if (!user) {
    return (
      <div className="glass-panel rounded-xl p-6 flex flex-col gap-3">
        <h2 className="font-headline-md text-headline-md text-on-surface">Leave feedback</h2>
        <p className="text-on-surface-variant text-body-md">Sign in to share your experience with this shop.</p>
        <Link
          to="/auth"
          search={{ next: `/shop?slug=${slug}`, mode: undefined }}
          className="self-start bg-primary text-on-primary px-4 py-2 rounded font-bold text-label-md"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="glass-panel rounded-xl p-6 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) mutation.mutate();
      }}
    >
      <h2 className="font-headline-md text-headline-md text-on-surface">Leave feedback</h2>
      {sent && <p className="text-primary text-body-md">Your feedback is with the shop owner.</p>}
      <div>
        <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Rating *</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              aria-label={`${r} star${r > 1 ? "s" : ""}`}
              className={`w-10 h-10 rounded border transition-colors ${
                r <= rating ? "border-primary text-primary font-bold" : "border-border-subtle text-on-surface-variant"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Your feedback *</label>
        <textarea
          required
          rows={4}
          minLength={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How was your visit?"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
      </div>
      <button
        type="submit"
        disabled={!valid || mutation.isPending}
        className="self-start bg-primary text-on-primary px-6 py-3 rounded font-bold text-label-md disabled:opacity-50"
      >
        {mutation.isPending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
