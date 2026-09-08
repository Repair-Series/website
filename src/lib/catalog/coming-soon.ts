/** Mirrors adminpanel-repairseries `normalizeComingSoonCategory`. */

export function normalizeComingSoonCategory(value: unknown): "main" | "commercial" {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "commercial" || v === "commercial services") return "commercial";
  return "main";
}

export function splitComingSoonByCategory<T extends { comingSoonCategory?: unknown }>(
  list: T[] | null | undefined,
) {
  const main: T[] = [];
  const commercial: T[] = [];
  for (const svc of Array.isArray(list) ? list : []) {
    if (normalizeComingSoonCategory(svc?.comingSoonCategory) === "commercial") {
      commercial.push(svc);
    } else {
      main.push(svc);
    }
  }
  return { main, commercial };
}
