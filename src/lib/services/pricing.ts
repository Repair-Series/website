import type { ServiceDoc } from "@/lib/booking/types";

export type ServiceVariation = {
  id: string;
  title: string;
  price: number;
  image?: string | null;
  imageUrl?: string | null;
  status?: string;
  name?: string;
  rating?: number | null;
  originalPrice?: number | null;
};

export function getVariationImage(variation: ServiceVariation): string | null {
  const url = String(variation.imageUrl || variation.image || "").trim();
  return url || null;
}

export function isVariationActive(variation: {
  status?: string;
}): boolean {
  const st = String(variation.status ?? "Active")
    .trim()
    .toLowerCase();
  return st !== "inactive" && st !== "disabled" && st !== "deleted";
}

export function normalizeVariation(
  raw: Record<string, unknown>,
): ServiceVariation | null {
  const id = String(raw.id ?? "").trim();
  const title = String(raw.title ?? raw.name ?? "").trim();
  const price = Number(raw.price ?? raw.amount);
  if (!id || !title || !Number.isFinite(price) || price < 0) return null;
  if (!isVariationActive(raw)) return null;
  const imageUrl = String(raw.imageUrl ?? raw.image ?? "").trim() || null;
  const ratingRaw = raw.rating ?? raw.stars ?? raw.avgRating ?? raw.starRating;
  const ratingNum = Number(ratingRaw);
  const rating =
    ratingRaw != null && Number.isFinite(ratingNum) && ratingNum > 0
      ? ratingNum
      : null;
  const mrp = Number(
    raw.originalPrice ?? raw.mrp ?? raw.oldPrice ?? raw.listPrice ?? raw.compareAtPrice ?? 0,
  );
  const originalPrice =
    Number.isFinite(mrp) && mrp > price ? mrp : null;
  return {
    id,
    title,
    price,
    image: imageUrl,
    imageUrl,
    status: raw.status != null ? String(raw.status) : undefined,
    name: raw.name != null ? String(raw.name) : undefined,
    rating,
    originalPrice,
  };
}

export function getActiveVariations(service: ServiceDoc): ServiceVariation[] {
  const raw = service.variations;
  if (!Array.isArray(raw)) return [];
  const out: ServiceVariation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const v = normalizeVariation(item as Record<string, unknown>);
    if (v && v.price > 0) out.push(v);
  }
  return out;
}

export function serviceHasVariations(service: ServiceDoc): boolean {
  return Boolean(service.hasVariations) || getActiveVariations(service).length > 0;
}

function positiveBasePrice(service: ServiceDoc): number | null {
  const v =
    typeof service.price === "number"
      ? service.price
      : typeof service.amount === "number"
        ? service.amount
        : null;
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

export function getMinVariationPrice(service: ServiceDoc): number | null {
  const prices = getActiveVariations(service)
    .map((v) => v.price)
    .filter((p) => Number.isFinite(p) && p > 0);
  if (!prices.length) return null;
  return Math.min(...prices);
}

/** Lowest bookable price — variations first, then base price. Never returns 0. */
export function getServicePrice(service: ServiceDoc): number | null {
  const fromVariations = getMinVariationPrice(service);
  if (fromVariations != null) return fromVariations;
  return positiveBasePrice(service);
}

export type ServicePriceDisplay = {
  /** e.g. "₹499" or "₹499 - ₹1199" */
  label: string | null;
  /** e.g. "3 Options Available" */
  optionsLabel: string | null;
  min: number | null;
  max: number | null;
  variationCount: number;
};

export function getServicePriceDisplay(service: ServiceDoc): ServicePriceDisplay {
  const active = getActiveVariations(service);
  const count = active.length;

  if (count > 0) {
    const prices = active.map((v) => v.price).filter((p) => p > 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const label = min === max ? `₹${min}` : `₹${min} - ₹${max}`;
    const optionsLabel =
      count === 1 ? "1 Option Available" : `${count} Options Available`;
    return { label, optionsLabel, min, max, variationCount: count };
  }

  const base = positiveBasePrice(service);
  if (base != null) {
    return {
      label: `₹${base}`,
      optionsLabel: null,
      min: base,
      max: base,
      variationCount: 0,
    };
  }

  return {
    label: null,
    optionsLabel: null,
    min: null,
    max: null,
    variationCount: 0,
  };
}

export function getSelectedVariationPrice(
  service: ServiceDoc,
  variationId: string | null | undefined,
): number | null {
  if (variationId) {
    const v = getActiveVariations(service).find((x) => x.id === variationId);
    if (v && v.price > 0) return v.price;
  }
  return getServicePrice(service);
}
