import type { ServiceDoc } from "@/lib/booking/types";
import { getServiceCategoryId } from "@/lib/booking/slot-availability";

export const CART_STORAGE_KEY = "rs_website_cart_v1";

export type CartItem = {
  lineId: string;
  serviceId: string;
  name: string;
  price: number;
  visitingCharge: number;
  quantity: number;
  imageUrl: string;
  variationId?: string;
  variationTitle?: string;
  slug?: string;
  categoryId?: string;
};

export function buildLineId(serviceId: string, variationId?: string): string {
  return variationId ? `${serviceId}::${variationId}` : serviceId;
}

export function cartItemFromService(
  service: ServiceDoc,
  quantity = 1,
  variation?: { id: string; title: string; price: number; imageUrl?: string },
): CartItem {
  const name = service.name ?? service.title ?? "Service";
  const price =
    variation?.price ??
    (typeof service.price === "number"
      ? service.price
      : typeof service.amount === "number"
        ? service.amount
        : 0);
  const visitingCharge = 0;

  const variationImage =
    variation && "imageUrl" in variation
      ? String((variation as { imageUrl?: string }).imageUrl || "").trim()
      : "";
  const fromServiceVars = variation?.id
    ? (service.variations || []).find((v) => String(v.id) === variation.id)
    : null;
  const varImg = String(
    variationImage ||
      fromServiceVars?.imageUrl ||
      fromServiceVars?.image ||
      "",
  ).trim();

  return {
    lineId: buildLineId(service.id, variation?.id),
    serviceId: service.id,
    name: variation ? `${name} — ${variation.title}` : name,
    price,
    visitingCharge,
    quantity: Math.max(1, quantity),
    imageUrl: varImg || service.imageUrl || service.image || "",
    variationId: variation?.id,
    variationTitle: variation?.title,
    slug: service.slug,
    categoryId: getServiceCategoryId(service) || undefined,
  };
}

export function loadCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCartToStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function cartVisitingCharge(items: CartItem[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((i) => i.visitingCharge));
}

export function cartTotal(items: CartItem[]): number {
  return cartSubtotal(items) + cartVisitingCharge(items);
}
