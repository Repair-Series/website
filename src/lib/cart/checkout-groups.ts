import type { CartItem } from "@/lib/cart/storage";
import { techMatchesCategory } from "@/lib/booking/slot-allocation";
import type { TechnicianDoc } from "@/lib/booking/types";

export type CheckoutGroup = {
  /** Stable key for UI */
  key: string;
  categoryIds: string[];
  items: CartItem[];
  /** True when a single technician can cover every category in this group */
  sharedTechnicianPossible: boolean;
};

function uniqueCategories(items: CartItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const c = String(item.categoryId || "").trim();
    if (c) set.add(c);
  }
  return [...set];
}

function techCoversAll(
  tech: TechnicianDoc,
  categoryIds: string[],
): boolean {
  if (!categoryIds.length) return false;
  const data = tech as unknown as Record<string, unknown>;
  return categoryIds.every((c) => techMatchesCategory(data, c));
}

/**
 * Partition cart lines for multi-service checkout.
 * - If any technician covers every category → one group.
 * - Else group by categoryId (incompatible categories become separate bookings).
 */
export function groupCartForCheckout(
  items: CartItem[],
  technicians: TechnicianDoc[],
): CheckoutGroup[] {
  if (!items.length) return [];

  const allCats = uniqueCategories(items);
  const canShareAll =
    allCats.length > 0 &&
    technicians.some((t) => techCoversAll(t, allCats));

  if (canShareAll || allCats.length <= 1) {
    return [
      {
        key: "all",
        categoryIds: allCats,
        items: [...items],
        sharedTechnicianPossible: canShareAll || allCats.length <= 1,
      },
    ];
  }

  const byCat = new Map<string, CartItem[]>();
  const noCat: CartItem[] = [];
  for (const item of items) {
    const c = String(item.categoryId || "").trim();
    if (!c) {
      noCat.push(item);
      continue;
    }
    const list = byCat.get(c) || [];
    list.push(item);
    byCat.set(c, list);
  }

  const groups: CheckoutGroup[] = [];
  for (const [cat, groupItems] of byCat) {
    groups.push({
      key: `cat-${cat}`,
      categoryIds: [cat],
      items: groupItems,
      sharedTechnicianPossible: true,
    });
  }
  for (const item of noCat) {
    groups.push({
      key: `line-${item.lineId}`,
      categoryIds: [],
      items: [item],
      sharedTechnicianPossible: false,
    });
  }
  return groups;
}
