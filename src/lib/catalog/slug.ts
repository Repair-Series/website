/** URL-safe slug from display name (e.g. "AC Repair" → "ac-repair"). */
export function slugify(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** True when service is marked Coming Soon in Firestore. */
export function isComingSoonService(service: { status?: string | null }): boolean {
  return String(service.status ?? "").trim() === "Coming Soon";
}

function getServiceSegment(service: {
  id: string;
  slug?: string | null;
  name?: string | null;
  title?: string | null;
}): string {
  const explicit = String(service.slug ?? "").trim();
  if (explicit) return explicit;
  const name = String(service.name ?? service.title ?? "").trim();
  if (name) return slugify(name);
  return service.id;
}

export function getComingSoonPath(service: {
  id: string;
  slug?: string | null;
  name?: string | null;
  title?: string | null;
}): string {
  return `/coming-soon/${getServiceSegment(service)}`;
}

export function getServicePath(service: {
  id: string;
  slug?: string | null;
  name?: string | null;
  title?: string | null;
  status?: string | null;
}): string {
  if (isComingSoonService(service)) return getComingSoonPath(service);
  return `/services/${getServiceSegment(service)}`;
}

export function getBookPath(service: {
  id: string;
  slug?: string | null;
  name?: string | null;
  title?: string | null;
  status?: string | null;
}): string {
  if (isComingSoonService(service)) return getComingSoonPath(service);
  return getServicePath(service).replace("/services/", "/book/");
}

export function getCategoryPath(category: {
  id: string;
  slug?: string | null;
  name?: string | null;
  title?: string | null;
}): string {
  const explicit = String(category.slug ?? "").trim();
  if (explicit) return `/categories/${explicit}`;
  const name = String(category.name ?? category.title ?? "").trim();
  if (name) return `/categories/${slugify(name)}`;
  return `/categories/${category.id}`;
}

/** Legacy singular path — supported via /category/[id] route. */
export function getCategoryPathLegacy(category: {
  id: string;
  slug?: string | null;
  name?: string | null;
  title?: string | null;
}): string {
  const explicit = String(category.slug ?? "").trim();
  if (explicit) return `/category/${explicit}`;
  const name = String(category.name ?? category.title ?? "").trim();
  if (name) return `/category/${slugify(name)}`;
  return `/category/${category.id}`;
}
