/** Shared revisit policy helpers (mirrors adminpanel / user app). */

export const DEFAULT_REVISIT_POLICY = Object.freeze({
  enabled: false,
  type: "fixed_count" as const,
  freeRevisitCount: 2,
  maxRevisitsInPeriod: 0,
  validityValue: 30,
  validityUnit: "days" as const,
});

export function normalizeRevisitPolicy(raw: Record<string, unknown> = {}) {
  const type =
    String(raw.type || "").trim() === "time_based" ? "time_based" : "fixed_count";
  const validityUnit = ["days", "weeks", "months"].includes(String(raw.validityUnit))
    ? String(raw.validityUnit)
    : "days";
  const freeRevisitCount = Math.max(0, Math.round(Number(raw.freeRevisitCount) || 0));
  const maxRevisitsInPeriod = Math.max(0, Math.round(Number(raw.maxRevisitsInPeriod) || 0));
  const validityValue = Math.max(1, Math.round(Number(raw.validityValue) || 30));
  return {
    enabled: raw.enabled === true,
    type,
    freeRevisitCount: type === "fixed_count" ? freeRevisitCount || 2 : freeRevisitCount,
    maxRevisitsInPeriod,
    validityValue,
    validityUnit,
  };
}

export function validityToDays(value: number, unit: string) {
  const n = Math.max(1, Math.round(Number(value) || 1));
  if (unit === "weeks") return n * 7;
  if (unit === "months") return n * 30;
  return n;
}

function resolveCompletedAt(booking: Record<string, unknown>) {
  const raw = booking.completedAt as
    | { toDate?: () => Date; seconds?: number }
    | string
    | Date
    | undefined;
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null && "toDate" in raw && typeof raw.toDate === "function") {
    const d = raw.toDate();
    return d && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    const d = new Date((raw.seconds || 0) * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw as string | Date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isWithinValidityWindow(
  booking: Record<string, unknown>,
  policy: ReturnType<typeof normalizeRevisitPolicy>,
) {
  if (policy.type !== "time_based") return true;
  const completedAt = resolveCompletedAt(booking);
  if (!completedAt) return true;
  const windowDays = validityToDays(policy.validityValue, policy.validityUnit);
  const expires = completedAt.getTime() + windowDays * 24 * 60 * 60 * 1000;
  return Date.now() <= expires;
}

function readDirectRemaining(booking: Record<string, unknown>) {
  const direct =
    booking.revisitRemaining ??
    booking.remainingRevisits ??
    booking.freeRevisitsRemaining ??
    (booking.revisitEligibility as { remaining?: number } | undefined)?.remaining;
  if (direct == null || !Number.isFinite(Number(direct))) return null;
  return Math.max(0, Math.round(Number(direct)));
}

export function getRevisitRemaining(
  booking: Record<string, unknown> | null | undefined,
  servicePolicy?: Record<string, unknown>,
) {
  if (!booking) return 0;
  const policy = normalizeRevisitPolicy(
    (booking.revisitPolicy as Record<string, unknown>) ||
      servicePolicy ||
      DEFAULT_REVISIT_POLICY,
  );

  const direct = readDirectRemaining(booking);
  const history = Array.isArray(booking.revisitHistory) ? booking.revisitHistory : [];
  const used = history.length;

  const policyActive =
    policy.enabled === true ||
    (direct != null && (booking.revisitPolicy != null || servicePolicy != null)) ||
    (direct != null && direct > 0);

  if (!policyActive && direct == null) return 0;

  if (direct != null) {
    if (!isWithinValidityWindow(booking, policy)) return 0;
    return direct;
  }

  if (!policy.enabled) return 0;

  if (policy.type === "fixed_count") {
    return Math.max(0, policy.freeRevisitCount - used);
  }

  const completedAt = resolveCompletedAt(booking);
  if (!completedAt) return 0;
  if (!isWithinValidityWindow(booking, policy)) return 0;
  if (policy.maxRevisitsInPeriod > 0) {
    return Math.max(0, policy.maxRevisitsInPeriod - used);
  }
  return Math.max(0, (policy.freeRevisitCount || 1) - used);
}

export function getBookingTechnicianId(booking: Record<string, unknown> | null | undefined) {
  if (!booking) return "";
  const candidates = [
    booking.technicianId,
    booking.assignedTechnicianId,
    booking.techId,
    (booking.technician as { id?: string } | undefined)?.id,
    booking.technicianUid,
  ];
  for (const c of candidates) {
    const id = c != null ? String(c).trim() : "";
    if (id) return id;
  }
  return "";
}

export function isBookingCompleted(booking: Record<string, unknown> | null | undefined) {
  return String(booking?.status || "").trim().toLowerCase() === "completed";
}

export function canClaimRevisit(
  booking: Record<string, unknown> | null | undefined,
  servicePolicy?: Record<string, unknown>,
) {
  if (!booking) return false;
  if (!isBookingCompleted(booking)) return false;
  if (booking.isRevisit === true) return false;
  if (!getBookingTechnicianId(booking)) return false;
  return getRevisitRemaining(booking, servicePolicy) > 0;
}
