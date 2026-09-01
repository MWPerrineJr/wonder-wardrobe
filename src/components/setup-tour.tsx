import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export type TourStep = {
  id: string;
  tab: string;
  title: string;
  body: string;
  status?: string;
  done?: boolean;
};

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;

function readState(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw
      ? (JSON.parse(raw) as { step?: number; completed?: boolean; dismissed?: boolean })
      : null;
  } catch {
    return null;
  }
}

export function useSetupTour(shopId: string) {
  const key = `tsc.setup-tour.${shopId}`;
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readState(key);
    setStep(saved?.step ?? 0);
    setActive(!saved?.completed && !saved?.dismissed);
    setReady(true);
  }, [key]);

  const persist = useCallback(
    (patch: { step?: number; completed?: boolean; dismissed?: boolean }) => {
      try {
        localStorage.setItem(key, JSON.stringify({ ...(readState(key) ?? {}), ...patch }));
      } catch {
        /* storage unavailable — tour still works for this visit */
      }
    },
    [key],
  );

  return {
    active: ready && active,
    step,
    start: () => {
      setStep(0);
      persist({ step: 0, completed: false, dismissed: false });
      setActive(true);
    },
    goTo: (next: number) => {
      setStep(next);
      persist({ step: next });
    },
    dismiss: () => {
      persist({ dismissed: true });
      setActive(false);
    },
    complete: () => {
      persist({ completed: true, step: 0 });
      setActive(false);
    },
  };
}

export function SetupTour({
  steps,
  step,
  onStep,
  onDismiss,
  onComplete,
}: {
  steps: TourStep[];
  step: number;
  onStep: (next: number) => void;
  onDismiss: () => void;
  onComplete: () => void;
}) {
  const current = steps[Math.min(step, steps.length - 1)];
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${current.id}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current.id]);

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${current.id}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = window.setTimeout(measure, 350);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current.id, measure]);

  const next = useCallback(
    () => (step >= steps.length - 1 ? onComplete() : onStep(step + 1)),
    [step, steps.length, onComplete, onStep],
  );
  const back = useCallback(() => onStep(Math.max(0, step - 1)), [step, onStep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onDismiss]);

  const spotlight: Rect | null = rect
    ? {
        top: Math.max(rect.top - PAD, 4),
        left: Math.max(rect.left - PAD, 4),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  const tooltipTop = spotlight
    ? spotlight.top + spotlight.height + 12 + 220 > window.innerHeight
      ? Math.max(spotlight.top - 12 - 200, 12)
      : spotlight.top + spotlight.height + 12
    : 120;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Setup tour">
      <button
        type="button"
        aria-label="Close tour"
        onClick={onDismiss}
        className="absolute inset-0 w-full h-full bg-on-surface/60 cursor-default"
      />
      {spotlight && (
        <div
          className="absolute rounded-xl border-2 border-primary pointer-events-none transition-all duration-200"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(28,25,23,0.6)",
          }}
        />
      )}
      <div
        className="absolute bg-surface border border-border-subtle rounded-xl shadow-lg p-5 flex flex-col gap-3 w-[min(360px,calc(100vw-24px))]"
        style={{
          top: tooltipTop,
          left: spotlight
            ? Math.min(Math.max(spotlight.left, 12), Math.max(window.innerWidth - 372, 12))
            : 12,
        }}
      >
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Step {step + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm"
          >
            Skip tour
          </button>
        </div>
        <h3 className="font-headline-md text-headline-md text-on-surface">{current.title}</h3>
        <p className="text-on-surface-variant text-body-md">{current.body}</p>
        {current.status && (
          <p
            className={`text-body-md flex items-center gap-1 ${current.done ? "text-primary" : "text-on-surface-variant"}`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {current.done ? "check_circle" : "radio_button_unchecked"}
            </span>
            {current.status}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="border border-border-subtle rounded-lg px-4 py-2 text-on-surface hover:border-primary transition-colors font-label-md"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="bg-primary text-on-primary rounded-lg px-4 py-2 font-label-md font-bold hover:opacity-90 transition-opacity"
          >
            {step >= steps.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
