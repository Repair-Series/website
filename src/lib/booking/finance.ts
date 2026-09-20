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
  quotedFinalAmount?: number;
  finalBookingAmount?: number;
  customerTotal?: number;
  totalAmount?: number;
  amount?: number;
  servicePrice?: number;
  customerPlatformFee?: number;
  quotedConvenienceFee?: number;
  visitingCharge?: number;
}): number {
  const quoted = safeMoney(booking.quotedFinalAmount);
  if (quoted > 0) return quoted;
  const frozen = safeMoney(booking.finalBookingAmount ?? booking.customerTotal);
  if (frozen > 0) return frozen;
  const storedTotal = safeMoney(booking.totalAmount);
  if (storedTotal > 0) return storedTotal;
  const svc = safeMoney(booking.servicePrice ?? booking.amount);
  const fee = safeMoney(
    booking.customerPlatformFee ?? booking.quotedConvenienceFee ?? booking.visitingCharge,
  );
  return svc + fee;
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
  customerPlatformFee?: number;
  quotedConvenienceFee?: number;
  visitingCharge?: number;
  addonFeeAmount?: number;
}): number {
  const stored = safeMoney(booking.companyEarnings);
  if (stored > 0) return stored;
  const customerFee = safeMoney(
    booking.customerPlatformFee ?? booking.quotedConvenienceFee ?? booking.visitingCharge,
  );
  return (
    safeMoney(booking.platformFeeAmount ?? booking.platformCommission) +
    customerFee +
    safeMoney(booking.addonFeeAmount)
  );
}
