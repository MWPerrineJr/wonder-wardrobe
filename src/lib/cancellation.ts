/** Shared cancellation-policy math and copy, used by both client and server. */

export type CancellationPolicy = {
  freeHours: number;
  lateFeePercent: number;
  rescheduleAllowed: boolean;
  rescheduleMinHours: number;
};

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  freeHours: 24,
  lateFeePercent: 50,
  rescheduleAllowed: true,
  rescheduleMinHours: 24,
};

function hoursLabel(hours: number): string {
  if (hours <= 0) return "any time";
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "24 hours" : `${days} days`;
  }
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

function hoursUntil(startsAt: string | Date, now: number = Date.now()): number {
  const start = typeof startsAt === "string" ? new Date(startsAt).getTime() : startsAt.getTime();
  return (start - now) / 3_600_000;
}

export type RefundOutcome = {
  /** Cents returned to the client. */
  refundCents: number;
  /** Cents the shop keeps as a late-cancellation fee. */
  feeCents: number;
  /** True when the cancellation falls inside the free window. */
  free: boolean;
};

export function refundForCancellation(
  amountPaidCents: number,
  startsAt: string | Date,
  policy: CancellationPolicy,
  now: number = Date.now(),
): RefundOutcome {
  const paid = Math.max(0, amountPaidCents || 0);
  const free = hoursUntil(startsAt, now) >= policy.freeHours;
  if (paid === 0) return { refundCents: 0, feeCents: 0, free };
  if (free) return { refundCents: paid, feeCents: 0, free: true };
  const fee = Math.min(paid, Math.round((paid * policy.lateFeePercent) / 100));
  return { refundCents: paid - fee, feeCents: fee, free: false };
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Plain-language policy sentences shown to clients before they book. */
export function policySentences(policy: CancellationPolicy): string[] {
  const lines: string[] = [];
  if (policy.freeHours <= 0) {
    lines.push("Cancel any time before your appointment for a full refund of your deposit.");
  } else {
    lines.push(
      `Cancel at least ${hoursLabel(policy.freeHours)} before your appointment for a full refund of your deposit.`,
    );
    lines.push(
      policy.lateFeePercent >= 100
        ? "Cancel later than that and the deposit is non-refundable."
        : policy.lateFeePercent <= 0
          ? "Later cancellations are also refunded in full."
          : `Cancel later than that and the shop keeps ${policy.lateFeePercent}% of the deposit; the rest is refunded.`,
    );
  }
  lines.push(
    policy.rescheduleAllowed
      ? policy.rescheduleMinHours <= 0
        ? "Rescheduling is allowed any time before your appointment."
        : `Rescheduling is allowed up to ${hoursLabel(policy.rescheduleMinHours)} before your appointment.`
      : "This shop does not allow rescheduling — cancel and rebook instead.",
  );
  return lines;
}

export function canReschedule(
  startsAt: string | Date,
  policy: CancellationPolicy,
  now: number = Date.now(),
): boolean {
  if (!policy.rescheduleAllowed) return false;
  return hoursUntil(startsAt, now) >= policy.rescheduleMinHours;
}
