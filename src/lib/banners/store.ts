import { collection, limit, onSnapshot, query, type Firestore, type Unsubscribe } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firestore";
import { normalizeBannerSection } from "@/lib/banners/sections";

export type BannerDoc = {
  id: string;
  title?: string;
  section?: string;
  mobileImage?: string;
  websiteImage?: string;
  image?: string;
  imageUrl?: string;
  redirectLink?: string;
  link?: string;
  displayOrder?: number;
  enabled?: boolean;
  active?: boolean;
  startAt?: unknown;
  endAt?: unknown;
  _src?: string;
};

const MAX_BANNERS = 200;
const MAX_OFFERS = 40;

type Listener = (rows: BannerDoc[]) => void;

const listeners = new Set<Listener>();
let cached: BannerDoc[] | null = null;
let unsub: Unsubscribe | null = null;

function attach(db: Firestore) {
  if (unsub) return;
  let offers: BannerDoc[] = [];
  let banners: BannerDoc[] = [];
  const emit = () => {
    cached = [...banners, ...offers];
    listeners.forEach((fn) => fn(cached!));
  };
  const u1 = onSnapshot(query(collection(db, "banners"), limit(MAX_BANNERS)), (snap) => {
    banners = snap.docs.map((d) => ({ id: d.id, ...d.data(), _src: "banners" }) as BannerDoc);
    emit();
  });
  const u2 = onSnapshot(query(collection(db, "offers"), limit(MAX_OFFERS)), (snap) => {
    offers = snap.docs.map((d) => ({ id: d.id, ...d.data(), _src: "offers" }) as BannerDoc);
    emit();
  });
  unsub = () => {
    u1();
    u2();
    unsub = null;
    cached = null;
  };
}

/** One banners+offers listener for the whole website. */
export function subscribeAllBanners(onNext: Listener): () => void {
  const db = getDb();
  if (!db) {
    onNext([]);
    return () => {};
  }
  listeners.add(onNext);
  attach(db);
  if (cached) onNext(cached);
  return () => {
    listeners.delete(onNext);
    if (listeners.size === 0 && unsub) unsub();
  };
}

function bannerScheduleActive(o: BannerDoc, now = Date.now()): boolean {
  const toMillis = (raw: unknown): number | null => {
    if (!raw) return null;
    if (typeof (raw as { toDate?: () => Date })?.toDate === "function") {
      const d = (raw as { toDate: () => Date }).toDate();
      return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
    }
    if (typeof raw === "object" && raw !== null && "seconds" in raw) {
      return Number((raw as { seconds: number }).seconds) * 1000;
    }
    const t = new Date(raw as string | number | Date).getTime();
    return Number.isFinite(t) ? t : null;
  };
  const start = toMillis(o.startAt);
  const end = toMillis(o.endAt);
  if (start != null && now < start) return false;
  if (end != null && now > end) return false;
  return true;
}

export type NormalizedBanner = BannerDoc & {
  image: string;
  section: string;
  enabled: boolean;
  href: string;
  order: number;
};

export function normalizeBanners(
  rows: BannerDoc[],
  preferWebsite: boolean,
  sections: string[] | null,
): NormalizedBanner[] {
  const wanted = sections
    ? new Set(sections.map((s) => normalizeBannerSection(s)))
    : null;

  return rows
    .map((o) => {
      const image = preferWebsite
        ? o.websiteImage || o.image || o.imageUrl || o.mobileImage || ""
        : o.mobileImage || o.image || o.imageUrl || o.websiteImage || "";
      const section = normalizeBannerSection(
        o.section || (o._src === "offers" ? "offers" : "home"),
      );
      return {
        ...o,
        image,
        section,
        enabled: o.enabled !== false && o.active !== false,
        href: o.redirectLink || o.link || "/services",
        order: Number(o.displayOrder ?? 999),
      };
    })
    .filter((o) => o.enabled && o.image)
    .filter((o) => bannerScheduleActive(o))
    .filter((o) => (wanted ? wanted.has(o.section) : true))
    .sort((a, b) => a.order - b.order);
}
