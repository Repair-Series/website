import { clampNonNegativePaise, toPaise, toRupees } from "./money";

export type CouponInput = {
  valid?: boolean;
  discountType?: "percentage" | "flat" | string;
  discountValue?: number;
  maxDiscount?: number;
  minOrderAmount?: number;
};

/**
 * Existing coupon rule (website + Expo):
 * - percentage: Math.round(subtotalRupees * pct / 100), capped by maxDiscount
 * - flat: Math.round(flatValue)
 * - never exceed subtotal, never negative
 *
 * Discount is computed on the pre-tax checkout subtotal.
 * v1: service + visiting charge.
 * v2: service + convenience/platform fee (visiting charge replacement).
 * Additional services and spare parts are not in the coupon base.
 */
export function calculateDiscountPaise(
  subtotalPaise: number,
  coupon: CouponInput | null | undefined,
): number {
  const totalPaise = clampNonNegativePaise(subtotalPaise);
  if (!coupon || coupon.valid === false || totalPaise <= 0) return 0;

  const totalRupees = toRupees(totalPaise);
  const minOrder = Number(coupon.minOrderAmount ?? 0);
  if (Number.isFinite(minOrder) && minOrder > 0 && totalRupees < minOrder) {
    return 0;
  }

  if (coupon.discountType === "percentage") {
    const pct = Number(coupon.discountValue || 0);
    if (!Number.isFinite(pct) || pct <= 0) return 0;
    let rupees = Math.round((totalRupees * pct) / 100);
    const cap = Number(coupon.maxDiscount);
    if (Number.isFinite(cap) && cap > 0) {
      rupees = Math.min(rupees, Math.round(cap));
    }
    return Math.min(totalPaise, toPaise(Math.max(0, rupees)));
  }

  const flat = Math.round(Number(coupon.discountValue || 0));
  if (!Number.isFinite(flat) || flat <= 0) return 0;
  return Math.min(totalPaise, toPaise(Math.max(0, flat)));
}

export function applyStoredDiscountPaise(
  subtotalPaise: number,
  storedDiscountRupees: unknown,
): number {
  const total = clampNonNegativePaise(subtotalPaise);
  const stored = toPaise(storedDiscountRupees);
  return Math.min(total, stored);
}
