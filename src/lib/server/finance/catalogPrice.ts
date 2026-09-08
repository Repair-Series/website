import type { Firestore } from "firebase-admin/firestore";

function money(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function isActiveVariation(raw: Record<string, unknown>): boolean {
  const st = String(raw.status ?? "Active")
    .trim()
    .toLowerCase();
  return st !== "inactive" && st !== "disabled" && st !== "deleted";
}

/**
 * Authoritative catalog price. Never trust a client-sent serviceAmount
 * when a serviceId is present.
 */
export async function resolveCatalogServicePrice(
  db: Firestore,
  input: { serviceId?: string; variationId?: string; quantity?: unknown },
): Promise<{ serviceId: string; serviceName: string; unitPrice: number; quantity: number; amount: number }> {
  const serviceId = String(input.serviceId || "").trim();
  if (!serviceId) {
    throw Object.assign(new Error("serviceId is required"), { status: 400 });
  }
  const snap = await db.doc(`services/${serviceId}`).get();
  if (!snap.exists) {
    throw Object.assign(new Error("Service not found"), { status: 404 });
  }
  const data = (snap.data() || {}) as Record<string, unknown>;
  const serviceName = String(data.name || data.title || "Service").trim();
  const variationId = String(input.variationId || "").trim();
  let unitPrice = 0;

  const variations = Array.isArray(data.variations) ? data.variations : [];
  if (variationId) {
    const match = variations.find((row) => {
      if (!row || typeof row !== "object") return false;
      const v = row as Record<string, unknown>;
      return String(v.id || "").trim() === variationId && isActiveVariation(v);
    }) as Record<string, unknown> | undefined;
    if (!match) {
      throw Object.assign(new Error("Invalid service option"), { status: 400 });
    }
    unitPrice = money(match.price ?? match.amount);
  } else if (variations.length > 0 && (data.hasVariations === true || data.hasVariations === "true")) {
    throw Object.assign(new Error("Select a service option"), { status: 400 });
  } else {
    unitPrice = money(data.price ?? data.amount ?? data.basePrice);
  }

  if (unitPrice <= 0) {
    throw Object.assign(new Error("Service price is not configured"), { status: 400 });
  }

  const qtyRaw = Number(input.quantity);
  const quantity =
    Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.min(99, Math.round(qtyRaw)) : 1;
  return {
    serviceId,
    serviceName,
    unitPrice,
    quantity,
    amount: Math.round(unitPrice * quantity * 100) / 100,
  };
}
