import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { createOwnerShop } from "@/lib/owner.functions";

export const Route = createFileRoute("/_authenticated/onboarding/owner")({
  head: () => ({
    meta: [
      { title: "Become a shop owner — Crown & Cut" },
      {
        name: "description",
        content: "Create your shop and start accepting bookings on Crown & Cut.",
      },
    ],
  }),
  component: OnboardingOwnerPage,
});

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function OnboardingOwnerPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const shop = await createOwnerShop({
        data: {
          name,
          slug: slug || slugify(name),
          description: description || null,
          address: address || null,
        },
      });
      toast.success(`${shop.name} is live. Welcome, owner.`);
      navigate({ to: "/owner" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create shop");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-background px-4 py-12 font-body-md">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <Link to="/" className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
            Crown &amp; Cut
          </Link>
          <h1 className="mt-6 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Set up your shop
          </h1>
          <p className="mt-2 text-on-surface-variant text-body-md">
            Tell us about your shop. You can add barbers and services after this.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-panel rounded-xl p-6 md:p-8 flex flex-col gap-5"
        >
          <div>
            <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
              Shop name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md"
              placeholder="The Sharp Edge"
            />
          </div>

          <div>
            <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
              Shop URL
            </label>
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant text-body-md">crown-cut.app/shop/</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
                className="flex-1 bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md"
                placeholder="the-sharp-edge"
              />
            </div>
            <p className="mt-1 text-label-sm text-on-surface-variant">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          <div>
            <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md"
              placeholder="123 Main St, Downtown"
            />
          </div>

          <div>
            <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md"
              placeholder="Premium barbershop in the heart of downtown…"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !name || !slug}
            className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg font-bold hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            {submitting ? "Creating shop…" : "Create shop"}
          </button>
        </form>
      </div>
    </div>
  );
}