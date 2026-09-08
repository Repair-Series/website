import { getAdminDb } from "@/lib/firebase/admin";
import type { Firestore } from "firebase-admin/firestore";

export type ServerCoupon = {
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
    try {
      return (expiresAt as { toDate: () => Date }).toDate().getTime() < Date.now();
    } catch {
      return false;
    }
  }
  if (typeof expiresAt === "object" && expiresAt !== null && "seconds" in expiresAt) {
    return Number((expiresAt as { seconds: number }).seconds) * 1000 < Date.now();
  }
  const ts = new Date(expiresAt as string | Date).getTime();
  return Number.isFinite(ts) ? ts < Date.now() : false;
}

async function findCouponDoc(
  db: Firestore,
  code: string,
): Promise<Record<string, unknown> | null> {
  const coupons = await db.collection("coupons").where("code", "==", code).limit(1).get();
  if (!coupons.empty) {
    const d = coupons.docs[0];
    return { id: d.id, ...d.data() };
  }
  const offers = await db.collection("offers").where("code", "==", code).limit(1).get();
  if (!offers.empty) {
    const d = offers.docs[0];
    return { id: d.id, ...d.data() };
  }
  return null;
}

export async function loadServerCoupon(
  codeRaw: string,
  orderSubtotal = 0,
): Promise<ServerCoupon> {
  const code = normalizeCode(codeRaw);
  if (!code) return { valid: false, message: "Please enter a promo code." };

  const db = getAdminDb();
  let data: Record<string, unknown> | null = null;
  try {
    data = await findCouponDoc(db, code);
  } catch {
    return { valid: false, message: "Could not verify promo code. Try again." };
  }

  if (!data) return { valid: false, message: "Invalid promo code." };
  if (data.active === false) return { valid: false, message: "This promo code is inactive." };
  if (isExpired(data.expiresAt ?? data.expiryDate)) {
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
      ? Number(data.discountPercent ?? data.percentage ?? data.discountValue ?? data.value ?? 0)
      : Number(data.discountFlat ?? data.amount ?? data.flatAmount ?? data.discountValue ?? data.value ?? 0);

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
