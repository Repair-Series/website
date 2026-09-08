"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useRotatingSearchPlaceholder } from "@/lib/search/use-rotating-placeholder";
import {
  Search,
  MapPin,
  Wrench,
  CalendarDays,
  ShoppingCart,
  UserRound,
  Navigation,
  Pencil,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  PromoBannerSection,
  SectionPromoBanner,
} from "@/components/home/promo-banner";
import {
  BookingApprovalBanner,
  BookingPaymentHomeBanner,
} from "@/components/home/booking-home-banners";
import { DynamicHomeSections } from "@/components/home/dynamic-home-sections";
import { getDb } from "@/lib/firebase/firestore";
import { useLocation } from "@/context/location-context";
import { useAuth } from "@/hooks/use-auth";
import { getCategoryPath, getComingSoonPath, getServicePath } from "@/lib/catalog/slug";
import { splitComingSoonByCategory } from "@/lib/catalog/coming-soon";
import {
  filterHomeSectionsForPlatform,
  type HomeSectionDoc,
} from "@/lib/home-sections/resolve";
import { ServicePrice } from "@/components/services/service-price";
import type { BookingDoc } from "@/lib/booking/types";
import { useGuestBrowse } from "@/context/guest-browse-context";

type CategoryDoc = {
  id: string;
  name?: string;
  title?: string;
  icon?: string;
  active?: boolean;
  isActive?: boolean;
};

type ServiceDoc = {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  categoryId?: string;
  status?: string;
  comingSoonCategory?: string;
  price?: number;
  image?: string;
  imageUrl?: string;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type SavedAddress = {
  id?: string;
  label?: string;
  type?: string;
  city?: string;
  state?: string;
  pincode?: string;
  street?: string;
  area?: string;
  fullAddress?: string;
  lat?: number;
  lng?: number;
};

/** Phone-width home that mirrors the Repair Series user app shell. */
export function MobileAppHome() {
  const { user, customer } = useAuth();
  const { getLoginHref, endGuestBrowse } = useGuestBrowse();
  const { label, loading: locationLoading, refreshFromGps, applySavedAddress } =
    useLocation();
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [comingSoon, setComingSoon] = useState<ServiceDoc[]>([]);
  const [bookings, setBookings] = useState<BookingDoc[]>([]);
  const [cmsSections, setCmsSections] = useState<HomeSectionDoc[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationError, setLocationError] = useState("");
  const locationRef = useRef<HTMLDivElement>(null);
  const searchPlaceholder = useRotatingSearchPlaceholder(false);

  const savedAddresses = (Array.isArray(customer?.addresses)
    ? customer.addresses
    : []) as SavedAddress[];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!locationRef.current?.contains(e.target as Node)) {
        setLocationOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const db = getDb();
    if (!db) return;
    void getDocs(query(collection(db, "categories"), orderBy("name", "asc"))).then((snap) => {
      setCategories(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CategoryDoc)
          .filter((c) => c.active !== false && c.isActive !== false),
      );
    });
    void getDocs(query(collection(db, "services"), orderBy("name", "asc"))).then((snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceDoc);
      setServices(all.filter((s) => String(s.status || "Active") === "Active"));
    });
    const unsubSoon = onSnapshot(
      query(collection(db, "services"), where("status", "==", "Coming Soon")),
      (snap) => {
        setComingSoon(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as ServiceDoc & { previewStatus?: string })
            .filter(
              (s) => String(s.previewStatus ?? "Active") !== "Inactive",
            ),
        );
      },
    );
    const unsubSections = onSnapshot(collection(db, "homeSections"), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HomeSectionDoc);
      setCmsSections(filterHomeSectionsForPlatform(rows, "mobileWeb"));
    });
    return () => {
      unsubSoon();
      unsubSections();
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setBookings([]);
      return;
    }
    const db = getDb();
    if (!db) return;
    const unsub = onSnapshot(
      query(collection(db, "bookings"), where("customerId", "==", user.uid)),
      (snap) => {
        setBookings(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BookingDoc),
        );
      },
      () => setBookings([]),
    );
    return () => unsub();
  }, [user?.uid]);

  const accountHref = user ? "/dashboard" : getLoginHref("/dashboard");
  const bookingsHref = user
    ? "/dashboard/bookings"
    : getLoginHref("/dashboard/bookings");

  const firstName = useMemo(() => {
    const n = String(customer?.name || "").trim();
    return n ? n.split(/\s+/)[0] : null;
  }, [customer?.name]);

  const { main: comingSoonMain, commercial: comingSoonCommercial } = useMemo(
    () => splitComingSoonByCategory(comingSoon),
    [comingSoon],
  );

  const featured = services.slice(0, 8);
  const useCms = cmsSections.length > 0;

  const onDetectLocation = async () => {
    setLocationError("");
    try {
      await refreshFromGps();
      setLocationOpen(false);
    } catch {
      setLocationError("Could not detect location. Try again or change manually.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8F6F4] pb-4">
      <div className="bg-gradient-to-b from-[#C45508] to-[#E07A35] px-4 pb-5 pt-3 text-white">
        <div ref={locationRef} className="relative mb-3">
          <button
            type="button"
            onClick={() => setLocationOpen((v) => !v)}
            className="flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-left text-xs font-semibold backdrop-blur"
            aria-expanded={locationOpen}
            aria-haspopup="listbox"
          >
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {label || "Set your service location"}
            </span>
            <ChevronDown
              className={`size-3.5 shrink-0 opacity-80 transition-transform ${locationOpen ? "rotate-180" : ""}`}
            />
          </button>

          {locationOpen ? (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-black/5 bg-white text-[#1A1A1A] shadow-xl">
              <div className="border-b border-gray-100 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                  Your location
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold">
                  {label || "Not set"}
                </div>
              </div>
              <div className="p-1.5">
                <button
                  type="button"
                  onClick={() => void onDetectLocation()}
                  disabled={locationLoading}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-orange-50 disabled:opacity-60"
                >
                  {locationLoading ? (
                    <Loader2 className="size-4 animate-spin text-[#C45508]" />
                  ) : (
                    <Navigation className="size-4 text-[#C45508]" />
                  )}
                  Detect current location
                </button>
                <Link
                  href="/book"
                  onClick={() => setLocationOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-orange-50"
                >
                  <Pencil className="size-4 text-[#C45508]" />
                  Change location
                </Link>
              </div>
              {savedAddresses.length > 0 ? (
                <div className="border-t border-gray-100 p-1.5">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                    Saved addresses
                  </div>
                  {savedAddresses.map((addr, idx) => {
                    const addrLabel =
                      String(addr.label ?? addr.type ?? "Address").trim() ||
                      `Address ${idx + 1}`;
                    const sub = [addr.area, addr.city, addr.pincode]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <button
                        key={addr.id ?? `${addrLabel}-${idx}`}
                        type="button"
                        onClick={() => {
                          applySavedAddress({
                            label: addrLabel,
                            lat: addr.lat,
                            lng: addr.lng,
                            city: addr.city,
                            state: addr.state,
                            pincode: addr.pincode,
                            street: addr.street,
                            area: addr.area,
                            fullAddress: addr.fullAddress,
                          });
                          setLocationOpen(false);
                        }}
                        className="flex w-full flex-col rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-orange-50"
                      >
                        <span className="font-medium">{addrLabel}</span>
                        {sub ? (
                          <span className="truncate text-xs text-[#64748b]">
                            {sub}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {locationError ? (
                <div className="border-t border-gray-100 px-3 py-2 text-xs text-red-600">
                  {locationError}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-white/90">{greeting()}</p>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">
          {firstName ? `Hi, ${firstName}` : "Repair Series"}
        </h1>
        <Link
          href="/search"
          className="mt-4 flex h-12 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[#6B6B6B] shadow-sm"
        >
          <Search className="size-5 text-[#C45508]" />
          {searchPlaceholder || "Search for AC service"}
        </Link>
      </div>

      <PromoBannerSection section={["home", "offers"]} mobileOnly />

      {user ? (
        <>
          <BookingPaymentHomeBanner bookings={bookings} />
          <BookingApprovalBanner bookings={bookings} />
        </>
      ) : null}

      <div className="mt-2 grid grid-cols-4 gap-2 px-4">
        {(
          [
            { href: "/services", label: "Services", Icon: Wrench },
            {
              href: bookingsHref,
              label: "Bookings",
              Icon: CalendarDays,
            },
            { href: "/cart", label: "Cart", Icon: ShoppingCart },
            { href: accountHref, label: "Account", Icon: UserRound },
          ] as const
        ).map((a) => (
          <Link
            key={a.label}
            href={a.href}
            onClick={() => {
              if (!user && (a.label === "Account" || a.label === "Bookings")) {
                endGuestBrowse();
              }
            }}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-3 text-center shadow-sm ring-1 ring-[#E8E4E0] transition active:scale-[0.97]"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#FDE7DD] text-[#C45508]">
              <a.Icon className="size-5" />
            </span>
            <span className="text-[11px] font-bold text-[#1A1A1A]">{a.label}</span>
          </Link>
        ))}
      </div>

      {useCms ? (
        <DynamicHomeSections
          variant="mobile"
          platform="mobileWeb"
          sections={cmsSections}
          categories={categories}
          services={services}
          comingSoon={comingSoon}
        />
      ) : (
        <>
          <section className="mt-6 px-4">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-lg font-extrabold text-[#1A1A1A]">Categories</h2>
              <Link href="/categories" className="text-xs font-bold text-[#C45508]">
                See all
              </Link>
            </div>
            <div className="-mx-4 mb-3">
              <SectionPromoBanner section="categories" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {categories.slice(0, 8).map((c) => (
                <Link
                  key={c.id}
                  href={getCategoryPath(c)}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4E0]">
                    {c.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.icon} alt="" className="size-10 object-contain" />
                    ) : (
                      <span className="text-lg">🔧</span>
                    )}
                  </div>
                  <span className="line-clamp-2 text-center text-[11px] font-bold text-[#1A1A1A]">
                    {c.name || c.title}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-7 px-4">
            <h2 className="mb-3 text-lg font-extrabold text-[#1A1A1A]">Popular services</h2>
            <div className="-mx-4 mb-3">
              <SectionPromoBanner section="popular_services" />
            </div>
            <div className="-mx-4 mb-3">
              <SectionPromoBanner section="featured" />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {featured.map((s) => (
                <Link
                  key={s.id}
                  href={getServicePath(s)}
                  className="w-[148px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4E0]"
                >
                  <div className="aspect-[4/3] bg-[#F4F5F7]">
                    {(s.image || s.imageUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image || s.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-xs font-bold text-[#1A1A1A]">
                      {s.name || s.title}
                    </p>
                    <div className="mt-1 text-[11px] font-semibold text-[#C45508]">
                      <ServicePrice service={s as never} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {comingSoonMain.length ? (
            <section className="mt-7 px-4">
              <h2 className="mb-3 text-lg font-extrabold text-[#1A1A1A]">
                Coming Soon
              </h2>
              <div className="-mx-4 mb-3">
                <SectionPromoBanner
                  section={["coming_soon_main", "coming_soon"]}
                />
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {comingSoonMain.slice(0, 6).map((s) => (
                  <Link
                    key={s.id}
                    href={getComingSoonPath(s)}
                    className="w-[140px] shrink-0 rounded-2xl bg-white p-3 opacity-80 shadow-sm ring-1 ring-[#E8E4E0]"
                  >
                    <p className="line-clamp-2 text-xs font-bold">{s.name || s.title}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase text-[#C45508]">
                      Coming Soon
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {comingSoonCommercial.length ? (
            <section className="mt-7 px-4">
              <h2 className="mb-3 text-lg font-extrabold text-[#1A1A1A]">
                Coming Soon for Business
              </h2>
              <div className="-mx-4 mb-3">
                <SectionPromoBanner section="coming_soon_commercial" />
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {comingSoonCommercial.slice(0, 6).map((s) => (
                  <Link
                    key={s.id}
                    href={getComingSoonPath(s)}
                    className="w-[140px] shrink-0 rounded-2xl bg-white p-3 opacity-80 shadow-sm ring-1 ring-[#E8E4E0]"
                  >
                    <p className="line-clamp-2 text-xs font-bold">{s.name || s.title}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase text-[#C45508]">
                      Coming Soon
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
