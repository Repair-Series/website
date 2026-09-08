import { splitComingSoonByCategory } from "@/lib/catalog/coming-soon";

export type HomeSectionLayout = "slider" | "list" | "grid" | "static";
export type HomeSectionContentType = "categories" | "services" | "static";
export type HomeSectionSelectionMode =
  | "manual"
  | "all"
  | "featured"
  | "coming_soon"
  | "coming_soon_main"
  | "coming_soon_commercial";

/**
 * Platform visibility for CMS home sections.
 *
 * Field names (Firestore `homeSections`):
 * - `showOnApp` — native mobile app
 * - `showOnWebsite` — legacy / generic website flag (both web surfaces when
 *   mobile/desktop web flags are undefined)
 * - `showOnMobileWeb` — phone-width website home (`MobileAppHome`)
 * - `showOnDesktopWeb` — desktop marketing homepage
 *
 * When `showOnMobileWeb` / `showOnDesktopWeb` are undefined, clients fall back
 * to `showOnWebsite` for backward compatibility.
 */
export type HomeSectionDoc = {
  id: string;
  title?: string;
  subtitle?: string;
  layout?: HomeSectionLayout | string;
  contentType?: HomeSectionContentType | string;
  selectionMode?: HomeSectionSelectionMode | string;
  itemIds?: string[];
  columns?: number;
  rows?: number;
  maxItems?: number;
  enabled?: boolean;
  /** Native app home. Default true when omitted. */
  showOnApp?: boolean;
  /** Legacy website flag. Used as fallback for mobile/desktop web. */
  showOnWebsite?: boolean;
  /** Phone-width website home. Falls back to `showOnWebsite` if undefined. */
  showOnMobileWeb?: boolean;
  /** Desktop marketing home. Falls back to `showOnWebsite` if undefined. */
  showOnDesktopWeb?: boolean;
  displayOrder?: number;
  showViewAll?: boolean;
  viewAllPath?: string;
  staticBody?: string;
  staticImage?: string;
  staticCtaLabel?: string;
  staticCtaLink?: string;
};

export type HomeSectionPlatform =
  | "mobileWeb"
  | "desktopWeb"
  | "website"
  | "app";

function isShown(
  value: boolean | undefined,
  fallback?: boolean | undefined,
): boolean {
  if (value !== undefined) return value !== false;
  if (fallback !== undefined) return fallback !== false;
  return true;
}

export function filterHomeSectionsForPlatform(
  sections: HomeSectionDoc[],
  platform: HomeSectionPlatform = "website",
) {
  return (sections || [])
    .filter((s) => {
      if (!s || s.enabled === false) return false;
      if (platform === "app") return isShown(s.showOnApp);
      if (platform === "mobileWeb") {
        return isShown(s.showOnMobileWeb, s.showOnWebsite);
      }
      if (platform === "desktopWeb") {
        return isShown(s.showOnDesktopWeb, s.showOnWebsite);
      }
      // "website" — legacy generic website flag
      return isShown(s.showOnWebsite);
    })
    .sort((a, b) => {
      const oa = Number(a.displayOrder ?? 0);
      const ob = Number(b.displayOrder ?? 0);
      if (oa !== ob) return oa - ob;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
}

export function getHomeSectionMaxItems(section: HomeSectionDoc) {
  const maxItems = Number(section?.maxItems) || 0;
  if (maxItems > 0) return maxItems;
  const columns = Math.max(1, Number(section?.columns) || 1);
  const rows = Number(section?.rows) || 0;
  if (section?.layout === "grid" && rows > 0) return columns * rows;
  return 50;
}

type CategoryLike = {
  id: string;
  active?: boolean;
  isActive?: boolean;
};

type ServiceLike = {
  id: string;
  status?: string;
  featured?: boolean;
  isFeatured?: boolean;
  comingSoonCategory?: unknown;
};

export function resolveHomeSectionItems<
  C extends CategoryLike,
  S extends ServiceLike,
>(
  section: HomeSectionDoc,
  {
    categories = [],
    services = [],
    comingSoon = [],
  }: {
    categories?: C[];
    services?: S[];
    comingSoon?: S[];
  },
): Array<C | S> {
  if (!section || section.contentType === "static") return [];

  const mode = String(section.selectionMode || "all");
  const max = getHomeSectionMaxItems(section);
  const ids = Array.isArray(section.itemIds) ? section.itemIds.map(String) : [];

  if (section.contentType === "categories") {
    const active = (categories || []).filter(
      (c) => c.active !== false && c.isActive !== false,
    );
    if (mode === "manual") {
      const map = new Map(active.map((c) => [String(c.id), c]));
      return ids.map((id) => map.get(id)).filter(Boolean).slice(0, max) as C[];
    }
    return active.slice(0, max);
  }

  if (section.contentType === "services") {
    const activeServices = (services || []).filter(
      (s) => String(s.status || "Active") === "Active",
    );
    const soon = Array.isArray(comingSoon) ? comingSoon : [];
    const { main, commercial } = splitComingSoonByCategory(soon);

    let pool: S[] = activeServices;
    if (mode === "featured") {
      const featured = activeServices.filter((s) => s.featured || s.isFeatured);
      pool = featured.length > 0 ? featured : activeServices;
    } else if (mode === "coming_soon") {
      pool = soon;
    } else if (mode === "coming_soon_main") {
      pool = main;
    } else if (mode === "coming_soon_commercial") {
      pool = commercial;
    } else if (mode === "manual") {
      const all = [...activeServices, ...soon];
      const map = new Map(all.map((s) => [String(s.id), s]));
      return ids.map((id) => map.get(id)).filter(Boolean).slice(0, max) as S[];
    }

    return pool.slice(0, max);
  }

  return [];
}
