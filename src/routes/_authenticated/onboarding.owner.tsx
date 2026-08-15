import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { createOwnerShop } from "@/lib/owner.functions";
import { SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/categories";


export const Route = createFileRoute("/_authenticated/onboarding/owner")({
  head: () => ({
    meta: [
      { title: "Become a shop owner — The Standing Chair" },
      {
        name: "description",
        content: "Create your shop and start accepting bookings on The Standing Chair.",
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
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [services, setServices] = useState<
    Array<{ name: string; duration: string; price: string; category: ServiceCategory }>
  >([
    { name: "Classic Haircut", duration: "30", price: "35", category: "hair_barber" },
    { name: "Beard Trim", duration: "20", price: "20", category: "hair_barber" },
    { name: "Cut & Beard", duration: "45", price: "50", category: "hair_barber" },
  ]);

  function updateService(i: number, patch: Partial<(typeof services)[number]>) {
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addService() {
    if (services.length >= 10) return;
    setServices((prev) => [...prev, { name: "", duration: "30", price: "0", category: "hair_barber" }]);
  }
  function removeService(i: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== i));
  }

  function toggleCategory(cat: ServiceCategory) {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const cleanedServices = services
        .map((s) => ({
          name: s.name.trim(),
          duration_minutes: parseInt(s.duration, 10),
          price_cents: Math.round(parseFloat(s.price || "0") * 100),
          category: s.category,
        }))
        .filter(
          (s) =>
            s.name.length > 0 &&
            Number.isFinite(s.duration_minutes) &&
            s.duration_minutes > 0 &&
            Number.isFinite(s.price_cents) &&
            s.price_cents >= 0,
        );
      const shop = await createOwnerShop({
        data: {
          name,
          slug: slug || slugify(name),
          description: description || null,
          address: address || null,
          categories,
          services: cleanedServices,
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
            The Standing Chair
          </Link>
          <h1 className="mt-6 font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Set up your shop
          </h1>
          <p className="mt-2 text-on-surface-variant text-body-md">
            Tell us about your shop. You can add providers and services after this.
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
              <span className="text-on-surface-variant text-body-md">thestandingchair.app/shop/</span>

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
              placeholder="A welcoming studio in the heart of downtown…"

            />
          </div>

          <div>
            <label className="font-label-md text-label-md text-on-surface-variant block mb-2">
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => toggleCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-label-sm transition ${
                    categories.includes(cat.value)
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-surface border-border-subtle text-on-surface-variant hover:border-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>

            <div className="flex items-center justify-between mb-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Starter services
              </label>
              <button
                type="button"
                onClick={addService}
                className="text-primary text-label-sm hover:underline"
              >
                + Add service
              </button>
            </div>
            <p className="mb-3 text-label-sm text-on-surface-variant">
              Add a few services now — you can edit them later from your dashboard.
            </p>
            <div className="flex flex-col gap-2">
              {services.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => updateService(i, { name: e.target.value })}
                    placeholder="Service name"
                    className="col-span-5 bg-surface-container border border-border-subtle rounded p-2 text-on-surface focus:border-primary focus:outline-none text-body-md"
                  />
                  <input
                    type="number"
                    min={1}
                    value={s.duration}
                    onChange={(e) => updateService(i, { duration: e.target.value })}
                    placeholder="Min"
                    className="col-span-2 bg-surface-container border border-border-subtle rounded p-2 text-on-surface focus:border-primary focus:outline-none text-body-md"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={s.price}
                    onChange={(e) => updateService(i, { price: e.target.value })}
                    placeholder="Price"
                    className="col-span-2 bg-surface-container border border-border-subtle rounded p-2 text-on-surface focus:border-primary focus:outline-none text-body-md"
                  />
                  <select
                    value={s.category}
                    onChange={(e) => updateService(i, { category: e.target.value as ServiceCategory })}
                    className="col-span-2 bg-surface-container border border-border-subtle rounded p-2 text-on-surface focus:border-primary focus:outline-none text-body-md"
                  >
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeService(i)}
                    className="col-span-1 text-on-surface-variant hover:text-primary"
                    aria-label="Remove service"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

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