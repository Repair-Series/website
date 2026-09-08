const DEFAULT_ADDON_FEE_PERCENT = 10;

function clampPct(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function safeMoney(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(typeof value === "string" ? value.trim() : value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Platform fee applies ONLY on service price. Visiting charge goes to company.
 */
export function buildInitialBookingFinanceFields(
  platformFeePercent: number,
  addonFeePercent: number,
  servicePrice: number,
  visitingCharge: number,
) {
  const svc = safeMoney(servicePrice);
  const visit = safeMoney(visitingCharge);
  const p = clampPct(platformFeePercent, 30);
  const a = clampPct(addonFeePercent, DEFAULT_ADDON_FEE_PERCENT);
  const customerBaseTotal = svc + visit;
  const platformFeeAmount = Math.round(svc * (p / 100));
  const addonFeeAmount = 0;
  const addedServicesAmount = 0;
  const finalBookingAmount = customerBaseTotal;
  const technicianFinalEarning = svc - platformFeeAmount;
  const companyEarnings = platformFeeAmount + visit;
  const totalDeduction = finalBookingAmount - technicianFinalEarning;

  return {
    platformFeePercent: p,
    addonFeePercent: a,
    servicePrice: svc,
    visitingCharge: visit,
    originalBookingAmount: svc,
    customerBaseTotal,
    addedServicesAmount,
    finalBookingAmount,
    platformFeeAmount,
    addonFeeAmount,
    totalDeduction,
    technicianFinalEarning,
    companyEarnings,
    totalAmount: finalBookingAmount,
    finalAmount: finalBookingAmount,
    technicianEarning: technicianFinalEarning,
    platformCommission: platformFeeAmount,
    platformFinalEarning: companyEarnings,
  };
}

export function getCustomerTotal(booking: {
  finalBookingAmount?: number;
  totalAmount?: number;
  amount?: number;
  visitingCharge?: number;
}): number {
  const v =
    booking.finalBookingAmount ?? booking.totalAmount ?? booking.amount ?? 0;
  const base = safeMoney(v);
  if (base > 0) return base;
  const svc = safeMoney(booking.amount);
  const visit = safeMoney(booking.visitingCharge);
  return svc + visit;
}

export function getPlatformCharges(booking: {
  platformFeeAmount?: number;
  platformCommission?: number;
}): number {
  return safeMoney(booking.platformFeeAmount ?? booking.platformCommission);
}

export function getCompanyEarnings(booking: {
  companyEarnings?: number;
  platformFeeAmount?: number;
  platformCommission?: number;
  visitingCharge?: number;
  addonFeeAmount?: number;
}): number {
  const stored = safeMoney(booking.companyEarnings);
  if (stored > 0) return stored;
  return (
    safeMoney(booking.platformFeeAmount ?? booking.platformCommission) +
    safeMoney(booking.visitingCharge) +
    safeMoney(booking.addonFeeAmount)
  );
}
