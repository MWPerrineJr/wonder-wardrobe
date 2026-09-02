import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AccountNav } from "@/components/account-nav";
import { PublicLinkCard } from "@/components/public-link-card";
import { PaymentsPanel } from "@/components/payments-panel";
import { CalendarPanel } from "@/components/calendar-panel";

import { ShopLinksPanel, type ShopLinkValues } from "@/components/shop-links-panel";
import { SetupTour, useSetupTour, type TourStep } from "@/components/setup-tour";
import { parseCustomLinks } from "@/lib/social-links";
import { getMyShops, getShopDetail } from "@/lib/shops.functions";
import {
  createService,
  deleteService,
  deleteShop,
  getShopHours,
  updateService,
  updateShop,
  upsertShopHours,
} from "@/lib/owner.functions";
import { categoryLabel, SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/categories";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const myShopsQuery = queryOptions({
  queryKey: ["owner", "shops"],
  queryFn: () => getMyShops(),
});

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Shop Owner Dashboard — The Standing Chair" },
      { name: "description", content: "Manage your shops, services and bookings." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myShopsQuery),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 text-on-surface bg-background">
      <div>
        <h1 className="font-headline-md text-headline-md mb-2">Something went wrong</h1>
        <p className="text-on-surface-variant">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-on-surface">Not found.</div>
  ),
  component: OwnerPage,
});

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

function OwnerPage() {
  const { data: shops } = useSuspenseQuery(myShopsQuery);

  if (shops.length === 0) {
    return (
      <div className="min-h-screen bg-background text-on-background flex items-center justify-center px-4">
        <div className="max-w-md text-center flex flex-col gap-4">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            You don't have a shop yet
          </h1>
          <p className="text-on-surface-variant text-body-md">
            Create your first shop to start accepting bookings.
          </p>
          <Link
            to="/onboarding/owner"
            className="mx-auto bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-all"
          >
            Set up your shop
          </Link>
        </div>
      </div>
    );
  }

  return <OwnerDashboard shops={shops} />;
}

function OwnerDashboard({ shops }: { shops: Awaited<ReturnType<typeof getMyShops>> }) {
  const [selectedId, setSelectedId] = useState<string | null>(shops[0]?.id ?? null);
  const [tab, setTab] = useState("overview");

  const selected = shops.find((s) => s.id === selectedId) ?? shops[0];

  const tour = useSetupTour(selected?.id ?? "none");
  const steps = buildTourSteps(selected);
  const qc = useQueryClient();

  const deleteShopMutation = useMutation({
    mutationFn: (shopId: string) => deleteShop({ data: { shopId } }),
    onSuccess: () => {
      toast.success("Shop deleted.");
      qc.invalidateQueries({ queryKey: ["owner", "shops"] });
      qc.invalidateQueries({ queryKey: ["public"] });
      setSelectedId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (tour.active) setTab(steps[Math.min(tour.step, steps.length - 1)].tab);
  }, [tour.active, tour.step, steps]);

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <header className="border-b border-border-subtle bg-surface">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-headline-md text-headline-md text-primary tracking-tight">
              The Standing Chair
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-label-md">
              <Link to="/owner" className="text-primary font-semibold">
                Dashboard
              </Link>
              <Link to="/owner/analytics" className="text-on-surface-variant hover:text-on-surface">
                Analytics
              </Link>
              <Link to="/owner/feedback" className="text-on-surface-variant hover:text-on-surface">
                Feedback
              </Link>
              <Link to="/owner/support" className="text-on-surface-variant hover:text-on-surface">
                Support
              </Link>
              <Link to="/owner/subscribe" className="text-on-surface-variant hover:text-on-surface">
                Plans
              </Link>
              <Link to="/owner/contact" className="text-on-surface-variant hover:text-on-surface">
                Contact
              </Link>
              <Link
                to="/owner/diagnostics"
                className="text-on-surface-variant hover:text-on-surface"
              >
                Diagnostics
              </Link>
            </nav>
          </div>
          <AccountNav />
        </div>
      </header>

      <main className="max-w-container-max mx-auto p-margin-mobile md:p-margin-desktop flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              {selected.name}
            </h1>
            {selected.address && (
              <p className="text-on-surface-variant text-body-md mt-1 flex items-center gap-1">
                <Icon name="location_on" className="text-[16px]" /> {selected.address}
              </p>
            )}
          </div>

          {shops.length > 1 && (
            <select
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-surface border border-border-subtle rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={tour.start}
            className="bg-surface border border-border-subtle text-on-surface rounded-lg px-4 py-2 hover:border-primary transition-colors font-label-md self-start"
          >
            <Icon name="school" className="text-[16px] mr-1 align-middle" />
            Take the setup tour
          </button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-surface border border-border-subtle">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Shop details</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="hours">Hours</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>


          <TabsContent value="overview" className="mt-6 flex flex-col gap-6">
            <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              <StatCard icon="event_available" label="Bookings today" value={selected.today_bookings} />
              <StatCard icon="content_cut" label="Active services" value={selected.services_count} />
              <StatCard icon="groups" label="Team providers" value={selected.providers_count} />
            </section>
            <div data-tour="public-link">
              <PublicLinkCard slug={selected.slug} shopName={selected.name} />
            </div>
            <div data-tour="growth" className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-wrap items-center gap-3 shadow-sm">
              <span className="text-on-surface-variant text-body-md flex-grow">
                Analytics and AI feedback reports live on the paid plan.
              </span>
              <Link
                to="/owner/analytics"
                className="bg-surface border border-border-subtle text-on-surface rounded-lg px-4 py-2 hover:border-primary transition-colors font-label-md"
              >
                Analytics
              </Link>
              <Link
                to="/owner/feedback"
                className="bg-surface border border-border-subtle text-on-surface rounded-lg px-4 py-2 hover:border-primary transition-colors font-label-md"
              >
                Feedback
              </Link>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/shop/$slug"
                params={{ slug: selected.slug }}
                className="bg-surface border border-border-subtle text-on-surface rounded-lg px-4 py-2 hover:border-primary transition-colors font-label-md"
              >
                <Icon name="visibility" className="text-[16px] mr-1 align-middle" />
                View public page
              </Link>
              <Link
                to="/onboarding/owner"
                className="bg-surface border border-border-subtle text-on-surface rounded-lg px-4 py-2 hover:border-primary transition-colors font-label-md"
              >
                + Create another shop
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="border border-error/50 text-error rounded-lg px-4 py-2 hover:bg-error/10 transition-colors font-label-md">
                    <Icon name="delete" className="text-[16px] mr-1 align-middle" />
                    Delete shop
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{selected.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the shop, its services, providers, bookings, feedback,
                      and all related settings. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteShopMutation.mutate(selected.id)}
                      className="bg-error text-on-error hover:bg-error/90"
                    >
                      Delete shop
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TabsContent>

          <TabsContent value="details" className="mt-6">
            <div data-tour="details">
              <DetailsPanel shop={selected} />
            </div>
          </TabsContent>

          <TabsContent value="services" className="mt-6">
            <div data-tour="services">
              <ServicesPanel shopId={selected.id} />
            </div>
          </TabsContent>

          <TabsContent value="hours" className="mt-6">
            <div data-tour="hours">
              <HoursPanel shopId={selected.id} />
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <div data-tour="payments">
              <PaymentsPanel
                shopId={selected.id}
                prepayMode={(selected.prepay_mode ?? "off") as "off" | "deposit" | "full"}
                depositPercent={selected.deposit_percent ?? 50}
                cancelFreeHours={selected.cancel_free_hours ?? 24}
                lateCancelFeePercent={selected.late_cancel_fee_percent ?? 50}
                rescheduleAllowed={selected.reschedule_allowed ?? true}
                rescheduleMinHours={selected.reschedule_min_hours ?? 24}
              />
            </div>
          </TabsContent>

          <TabsContent value="links" className="mt-6">
            <div data-tour="links">
              <ShopLinksPanel shopId={selected.id} shopName={selected.name} shop={selected} />
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <CalendarPanel />
          </TabsContent>
        </Tabs>

      </main>

      {tour.active && (
        <SetupTour
          steps={steps}
          step={tour.step}
          onStep={tour.goTo}
          onDismiss={tour.dismiss}
          onComplete={tour.complete}
        />
      )}
    </div>
  );
}

function buildTourSteps(shop: ShopSummary & { services_count?: number }): TourStep[] {
  const detailsDone = !!shop.description && !!shop.address && !!shop.cover_image_url;
  const categoriesDone = (shop.categories ?? []).length > 0;
  const servicesDone = (shop.services_count ?? 0) > 0;
  const prepayDone = (shop.prepay_mode ?? "off") !== "off";
  const linksDone =
    !!shop.instagram_url ||
    !!shop.facebook_url ||
    !!shop.tiktok_url ||
    !!shop.x_url ||
    !!shop.youtube_url ||
    !!shop.website_url ||
    !!shop.contact_phone ||
    !!shop.whatsapp ||
    parseCustomLinks(shop.social_links).length > 0;

  return [
    {
      id: "details",
      tab: "details",
      title: "Start with your shop details",
      body: "Your name, a short description, your address and a cover photo. This is the first thing clients see.",
      status: detailsDone ? "Details look complete" : "Description, address or cover photo still missing",
      done: detailsDone,
    },
    {
      id: "details",
      tab: "details",
      title: "Pick your categories",
      body: "Tick every service type you offer — hair, nails, waxing, massage and more. Categories are how clients find you in the marketplace.",
      status: categoriesDone ? "Categories selected" : "No categories selected yet",
      done: categoriesDone,
    },
    {
      id: "services",
      tab: "services",
      title: "Add your service menu",
      body: "Each service needs a name, how long it takes and what it costs. Durations drive the booking slots clients can pick.",
      status: servicesDone ? `${shop.services_count} active service(s)` : "No active services yet",
      done: servicesDone,
    },
    {
      id: "hours",
      tab: "hours",
      title: "Set your weekly hours",
      body: "Opening and closing times per day, and mark the days you're closed. Clients can only book inside these hours.",
    },
    {
      id: "payments",
      tab: "payments",
      title: "Get paid up front",
      body: "Connect payouts, then choose whether clients pay a deposit or the full amount when they book. It cuts no-shows dramatically.",
      status: prepayDone ? "Prepayment is on" : "Prepayment is off",
      done: prepayDone,
    },
    {
      id: "links",
      tab: "links",
      title: "Add your social and contact links",
      body: "Instagram, Facebook, TikTok, X, YouTube, your website, phone and WhatsApp — plus up to 5 custom links. They show as buttons on your public page.",
      status: linksDone ? "Links added" : "No links added yet",
      done: linksDone,
    },
    {
      id: "public-link",
      tab: "overview",
      title: "Share your page",
      body: "This is the link you hand to clients. Copy it into your bio, or download the QR code to print on a window decal or a card.",
    },
    {
      id: "growth",
      tab: "overview",
      title: "Then watch it grow",
      body: "Analytics shows sales per service and provider, busiest hours and repeat clients. Feedback collects reviews after every appointment and summarises what clients love or want fixed.",
    },
  ];
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name={icon} className="text-primary" />
        <span className="font-label-md text-label-md">{label}</span>
      </div>
      <span className="font-headline-lg text-headline-lg text-on-surface">{value}</span>
    </div>
  );
}

// -------------------- Shop details --------------------

type ShopSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  cover_image_url: string | null;
  google_review_url?: string | null;
  categories: ServiceCategory[] | null;
  prepay_mode?: string | null;
  deposit_percent?: number | null;
  cancel_free_hours?: number | null;
  late_cancel_fee_percent?: number | null;
  reschedule_allowed?: boolean | null;
  reschedule_min_hours?: number | null;
} & ShopLinkValues;


function DetailsPanel({ shop }: { shop: ShopSummary }) {
  const qc = useQueryClient();
  const [name, setName] = useState(shop.name);
  const [address, setAddress] = useState(shop.address ?? "");
  const [description, setDescription] = useState(shop.description ?? "");
  const [coverUrl, setCoverUrl] = useState(shop.cover_image_url ?? "");
  const [reviewUrl, setReviewUrl] = useState(shop.google_review_url ?? "");
  const [categories, setCategories] = useState<ServiceCategory[]>(shop.categories ?? []);

  // Reset local state when the selected shop changes
  useEffect(() => {
    setName(shop.name);
    setAddress(shop.address ?? "");
    setDescription(shop.description ?? "");
    setCoverUrl(shop.cover_image_url ?? "");
    setReviewUrl(shop.google_review_url ?? "");
    setCategories(shop.categories ?? []);
  }, [
    shop.id,
    shop.name,
    shop.address,
    shop.description,
    shop.cover_image_url,
    shop.google_review_url,
    shop.categories,
  ]);

  const mutation = useMutation({
    mutationFn: () =>
      updateShop({
        data: {
          shopId: shop.id,
          patch: {
            name,
            address: address || null,
            description: description || null,
            cover_image_url: coverUrl || null,
            google_review_url: reviewUrl.trim() || null,
            categories,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Shop updated.");
      qc.invalidateQueries({ queryKey: ["owner", "shops"] });
      qc.invalidateQueries({ queryKey: ["public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteShop({ data: { shopId: shop.id } }),
    onSuccess: () => {
      toast.success("Shop deleted.");
      qc.invalidateQueries({ queryKey: ["owner", "shops"] });
      qc.invalidateQueries({ queryKey: ["public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  function toggleCategory(cat: ServiceCategory) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  return (
    <section className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm max-w-2xl">
      <h2 className="font-headline-md text-[20px] font-semibold text-on-surface mb-4">Shop details</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Field label="Name">
          <input
            value={name}
            required
            minLength={2}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Address">
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={inputCls}
          />
        </Field>
        <Field label="Categories">
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
                <Icon name={cat.icon} className="text-[16px]" />
                {cat.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Cover image URL">
          <input
            value={coverUrl}
            placeholder="https://…"
            onChange={(e) => setCoverUrl(e.target.value)}
            className={inputCls}
          />
          {coverUrl && (
            <img
              src={coverUrl}
              alt="Cover preview"
              className="mt-2 h-32 w-full object-cover rounded border border-border-subtle"
              onError={(e) => ((e.currentTarget.style.display = "none"))}
            />
          )}
        </Field>
        <Field label="Google review link">
          <input
            value={reviewUrl}
            placeholder="https://g.page/r/…/review"
            onChange={(e) => setReviewUrl(e.target.value)}
            className={inputCls}
          />
          <p className="text-on-surface-variant text-body-sm mt-1">
            Paste your Google "write a review" link. Customers who rate you 4 or 5 stars in the
            follow-up survey are invited to post it publicly here.
          </p>
        </Field>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="self-start bg-primary text-on-primary font-label-md text-label-md px-5 py-2 rounded-lg font-bold hover:bg-primary/90 transition disabled:opacity-60"
        >
          {mutation.isPending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="mt-8 border-t border-border-subtle pt-6">
        <h3 className="font-label-md text-label-md font-semibold text-error mb-1">Danger zone</h3>
        <p className="text-on-surface-variant text-body-sm mb-3">
          Permanently delete this shop and everything attached to it — services, providers,
          bookings, feedback, hours, and payment settings.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="border border-error/50 text-error rounded-lg px-4 py-2 hover:bg-error/10 transition-colors font-label-md"
            >
              <Icon name="delete" className="text-[16px] mr-1 align-middle" />
              Delete shop
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{shop.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the shop, its services, providers, bookings, feedback,
                and all related settings. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-error text-on-error hover:bg-error/90"
              >
                Delete shop
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}



// -------------------- Services --------------------

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
  category: ServiceCategory;
};


function ServicesPanel({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const queryKey = ["owner", "shop", shopId] as const;
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey,
      queryFn: () => getShopDetail({ data: { shopId } }),
    }),
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["owner", "shops"] });
    qc.invalidateQueries({ queryKey: ["public"] });
  };

  const del = useMutation({
    mutationFn: (serviceId: string) => deleteService({ data: { serviceId } }),
    onSuccess: () => { toast.success("Service deleted."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (s: ServiceRow) =>
      updateService({ data: { serviceId: s.id, fields: { is_active: !s.is_active } } }),
    onSuccess: () => { toast.success("Updated."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-4">
        <h2 className="font-headline-md text-[20px] font-semibold text-on-surface">Services</h2>
        <ServiceDialog
          shopId={shopId}
          onSaved={invalidate}
          trigger={
            <button className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded-lg font-bold hover:bg-primary/90 transition">
              + Add service
            </button>
          }
        />
      </div>
      {data.services.length === 0 ? (
        <p className="text-on-surface-variant text-body-md">No services yet. Add your first one.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle">
          {data.services.map((s) => (
            <li key={s.id} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex-1">
                <p className="font-label-md text-label-md text-on-surface">
                  {s.name}
                  {!s.is_active && <span className="ml-2 text-label-sm text-on-surface-variant">(inactive)</span>}
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  {categoryLabel(s.category)} · {s.duration_minutes} min · ${(s.price_cents / 100).toFixed(2)}
                </p>
                {s.description && (
                  <p className="text-label-sm text-on-surface-variant mt-1 line-clamp-2">{s.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive.mutate(s)}
                  className="text-label-sm border border-border-subtle px-3 py-1.5 rounded hover:border-primary transition"
                >
                  {s.is_active ? "Deactivate" : "Activate"}
                </button>
                <ServiceDialog
                  shopId={shopId}
                  service={s}
                  onSaved={invalidate}
                  trigger={
                    <button className="text-label-sm border border-border-subtle px-3 py-1.5 rounded hover:border-primary transition">
                      Edit
                    </button>
                  }
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-label-sm border border-border-subtle px-3 py-1.5 rounded hover:border-destructive hover:text-destructive transition">
                      Delete
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{s.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This can't be undone. Existing bookings for this service won't be removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => del.mutate(s.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ServiceDialog({
  shopId,
  service,
  trigger,
  onSaved,
}: {
  shopId: string;
  service?: ServiceRow;
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [durationMin, setDurationMin] = useState(service?.duration_minutes ?? 30);
  const [priceDollars, setPriceDollars] = useState(((service?.price_cents ?? 3500) / 100).toFixed(2));
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const [category, setCategory] = useState<ServiceCategory>(service?.category ?? "hair_barber");

  const isEdit = !!service;

  // Reset form when opening for a different service
  useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setDurationMin(service?.duration_minutes ?? 30);
    setPriceDollars(((service?.price_cents ?? 3500) / 100).toFixed(2));
    setIsActive(service?.is_active ?? true);
    setCategory(service?.category ?? "hair_barber");
  }, [open, service?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      const price_cents = Math.round(parseFloat(priceDollars) * 100);
      if (Number.isNaN(price_cents) || price_cents < 0) throw new Error("Invalid price");
      const fields = {
        name,
        description: description || null,
        duration_minutes: Number(durationMin),
        price_cents,
        is_active: isActive,
        category,
      };
      if (isEdit && service) {
        return updateService({ data: { serviceId: service.id, fields } });
      }
      return createService({ data: { shopId, fields } });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Service updated." : "Service added.");
      onSaved();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit service" : "Add service"}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Name">
            <input required minLength={1} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Description">
            <textarea rows={3} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Duration (min)">
              <input
                type="number"
                min={5}
                max={600}
                required
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Price ($)">
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ServiceCategory)}
              className={inputCls}
            >
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-body-md text-on-surface">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Active (bookable by customers)
          </label>
          <DialogFooter>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2 rounded-lg font-bold hover:bg-primary/90 transition disabled:opacity-60"
            >
              {mutation.isPending ? "Saving…" : isEdit ? "Save" : "Add service"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Hours --------------------

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type HourRow = { weekday: number; open_time: string; close_time: string; is_closed: boolean };

function defaultHours(): HourRow[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    open_time: "09:00",
    close_time: "18:00",
    is_closed: weekday === 0, // closed Sunday by default
  }));
}

function normalizeTime(t: string) {
  // API may return "09:00:00" — trim to HH:MM for <input type="time">
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function HoursPanel({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const queryKey = ["owner", "hours", shopId] as const;
  const { data: existing } = useSuspenseQuery(
    queryOptions({
      queryKey,
      queryFn: () => getShopHours({ data: { shopId } }),
    }),
  );

  const [rows, setRows] = useState<HourRow[]>(() => {
    const base = defaultHours();
    for (const r of existing ?? []) {
      base[r.weekday] = {
        weekday: r.weekday,
        open_time: normalizeTime(r.open_time),
        close_time: normalizeTime(r.close_time),
        is_closed: r.is_closed,
      };
    }
    return base;
  });

  useEffect(() => {
    const base = defaultHours();
    for (const r of existing ?? []) {
      base[r.weekday] = {
        weekday: r.weekday,
        open_time: normalizeTime(r.open_time),
        close_time: normalizeTime(r.close_time),
        is_closed: r.is_closed,
      };
    }
    setRows(base);
  }, [shopId, existing]);

  const save = useMutation({
    mutationFn: () => upsertShopHours({ data: { shopId, hours: rows } }),
    onSuccess: () => {
      toast.success("Schedule saved.");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function updateRow(weekday: number, patch: Partial<HourRow>) {
    setRows((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  }

  return (
    <section className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm max-w-2xl">
      <h2 className="font-headline-md text-[20px] font-semibold text-on-surface mb-4">Weekly hours</h2>
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div
            key={r.weekday}
            className="grid grid-cols-[110px_auto_1fr_auto_1fr] items-center gap-3 py-2 border-b border-border-subtle last:border-0"
          >
            <span className="font-label-md text-label-md text-on-surface">{WEEKDAYS[r.weekday]}</span>
            <label className="flex items-center gap-2 text-label-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={r.is_closed}
                onChange={(e) => updateRow(r.weekday, { is_closed: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              Closed
            </label>
            <input
              type="time"
              disabled={r.is_closed}
              value={r.open_time}
              onChange={(e) => updateRow(r.weekday, { open_time: e.target.value })}
              className={`${inputCls} disabled:opacity-40`}
            />
            <span className="text-on-surface-variant">to</span>
            <input
              type="time"
              disabled={r.is_closed}
              value={r.close_time}
              onChange={(e) => updateRow(r.weekday, { close_time: e.target.value })}
              className={`${inputCls} disabled:opacity-40`}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-6 bg-primary text-on-primary font-label-md text-label-md px-5 py-2 rounded-lg font-bold hover:bg-primary/90 transition disabled:opacity-60"
      >
        {save.isPending ? "Saving…" : "Save schedule"}
      </button>
    </section>
  );
}

// -------------------- Shared helpers --------------------

const inputCls =
  "w-full bg-surface-container border border-border-subtle rounded p-2 text-on-surface focus:border-primary focus:outline-none font-body-md text-body-md";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}
