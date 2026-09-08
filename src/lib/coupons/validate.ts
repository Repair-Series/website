import {
  collection,
  getDocs,
  query,
  where,
  type Firestore,
} from "firebase/firestore";

export type CouponResult = {
  valid: boolean;
  code?: string;
  discountType?: "percentage" | "flat";
  discountValue?: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  message: string;
};

function normalizeCode(code: string) {
  return String(code || "").trim().toUpperCase();
}

function isExpired(expiresAt: unknown) {
  if (!expiresAt) return false;
  if (typeof expiresAt === "object" && expiresAt !== null && "toDate" in expiresAt) {
    const d = (expiresAt as { toDate: () => Date }).toDate();
    return d.getTime() < Date.now();
  }
  const ts = new Date(expiresAt as string | Date).getTime();
  return Number.isFinite(ts) ? ts < Date.now() : false;
}

export async function validateCoupon(
  db: Firestore,
  rawCode: string,
  orderSubtotal = 0,
): Promise<CouponResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { valid: false, message: "Please enter a promo code." };

  let data: Record<string, unknown> | null = null;
  try {
    const snap = await getDocs(query(collection(db, "coupons"), where("code", "==", code)));
    if (!snap.empty) {
      const d = snap.docs[0];
      data = { id: d.id, ...d.data() };
    } else {
      const offersSnap = await getDocs(
        query(collection(db, "offers"), where("code", "==", code)),
      );
      if (!offersSnap.empty) {
        const d = offersSnap.docs[0];
        data = { id: d.id, ...d.data() };
      }
    }
  } catch {
    return { valid: false, message: "Could not verify promo code. Try again." };
  }

  if (!data) return { valid: false, message: "Invalid promo code." };
  if (data.active === false) return { valid: false, message: "This promo code is inactive." };
  if (isExpired(data.expiresAt)) {
    return { valid: false, message: "This promo code has expired." };
  }

  const minOrderAmount = Number(
    data.minOrderAmount ?? data.minOrder ?? data.minimumOrder ?? 0,
  );
  if (minOrderAmount > 0 && Number(orderSubtotal) < minOrderAmount) {
    return {
      valid: false,
      message: `Minimum order of ₹${minOrderAmount} required for this code.`,
    };
  }

  const discountType =
    (data.discountType as string) ||
    (typeof data.discountPercent === "number" ? "percentage" : "flat");
  const discountValue =
    discountType === "percentage"
      ? Number(data.discountPercent ?? data.percentage ?? data.value ?? 0)
      : Number(data.discountFlat ?? data.amount ?? data.flatAmount ?? data.value ?? 0);

  if (!discountValue || !Number.isFinite(discountValue)) {
    return { valid: false, message: "This promo code has no discount value." };
  }

  const maxDiscount = Number(data.maxDiscount ?? data.maxDiscountAmount ?? 0);

  return {
    valid: true,
    code,
    discountType: discountType === "percentage" ? "percentage" : "flat",
    discountValue,
    minOrderAmount: minOrderAmount > 0 ? minOrderAmount : undefined,
    maxDiscount: Number.isFinite(maxDiscount) && maxDiscount > 0 ? maxDiscount : undefined,
    message: "Promo code applied successfully.",
  };
}

export function calculateDiscount(amount: number, coupon: CouponResult | null) {
  const total = Number(amount || 0);
  if (!coupon?.valid || total <= 0) return 0;
  const minOrder = Number(coupon.minOrderAmount ?? 0);
  if (minOrder > 0 && total < minOrder) return 0;

  if (coupon.discountType === "percentage") {
    const pct = Number(coupon.discountValue || 0);
    let rupees = Math.round((total * pct) / 100);
    const cap = Number(coupon.maxDiscount);
    if (Number.isFinite(cap) && cap > 0) {
      rupees = Math.min(rupees, Math.round(cap));
    }
    return Math.min(total, Math.max(0, rupees));
  }

  const flat = Math.round(Number(coupon.discountValue || 0));
  return Math.min(total, Math.max(0, flat));
}
