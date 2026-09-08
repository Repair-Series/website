import type { Firestore } from "firebase/firestore";
import type { ServiceDoc } from "@/lib/booking/types";
import { resolveServiceByPath } from "@/lib/catalog/resolve";

export function getServiceName(s: ServiceDoc) {
  return s.name ?? s.title ?? "Service";
}

export function getServiceImage(s: ServiceDoc) {
  return s.imageUrl ?? s.image ?? null;
}

export {
  getServicePrice,
  getActiveVariations,
  getServicePriceDisplay,
  getSelectedVariationPrice,
  serviceHasVariations,
} from "@/lib/services/pricing";

export function getVisitingCharge(_s: ServiceDoc): number {
  return 0;
}

export async function loadService(
  db: Firestore,
  serviceIdOrSlug: string,
): Promise<ServiceDoc | null> {
  const row = await resolveServiceByPath(db, serviceIdOrSlug);
  return row as ServiceDoc | null;
}
