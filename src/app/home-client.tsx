"use client";

import Link from "next/link";
import { Container } from "@/components/container";
import {
  Search,
  ShieldCheck,
  ArrowRight,
  MapPin,
  Star,
  Clock,
  UserCheck,
  Tag,
  Settings,
  MessageCircle,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { ServicePrice } from "@/components/services/service-price";
import {
  ApplianceRepairSection,
  CleaningEssentialsSection,
  MostBookedSection,
} from "@/components/home/service-sections";
import { PromoBannerSection } from "@/components/home/promo-banner";
import { MobileAppHome } from "@/components/home/mobile-app-home";
import { DynamicHomeSections } from "@/components/home/dynamic-home-sections";
import { SERVICE_CITIES } from "@/lib/seo/site";
import { getDb } from "@/lib/firebase/firestore";
import type { ServiceDoc as FirestoreServiceDoc } from "@/lib/booking/types";
import { serviceHasVariations } from "@/lib/services/pricing";
import { getBookPath, getCategoryPath, getComingSoonPath, getServicePath } from "@/lib/catalog/slug";
import { splitComingSoonByCategory } from "@/lib/catalog/coming-soon";
import {
  filterHomeSectionsForPlatform,
  type HomeSectionDoc,
} from "@/lib/home-sections/resolve";

type CategoryDoc = {
  id: string;
  name?: string;
  title?: string;
  icon?: string;
  slug?: string;
  desc?: string;
  active?: boolean;
  isActive?: boolean;
};

type ServiceDoc = FirestoreServiceDoc;

type HomeReview = {
  name: string;
  area: string;
  rating: number;
  text: string;
  reviewDate?: string;
};

export function HomePageClient() {
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [comingSoon, setComingSoon] = useState<ServiceDoc[]>([]);
  const [homeReviews, setHomeReviews] = useState<HomeReview[]>([]);
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [cmsSections, setCmsSections] = useState<HomeSectionDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoadError(null);
        const db = getDb();
        if (!db) throw new Error("Firebase is not configured");

        const [catSnap, svcSnap, soonSnap] = await Promise.all([
          getDocs(query(collection(db, "categories"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "services"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "services"), where("status", "==", "Coming Soon"))),
        ]);

        const fetchedCategories = catSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CategoryDoc[];

        setCategories(
          fetchedCategories.filter(
            (cat) => cat.active !== false && cat.isActive !== false,
          ),
        );
        setServices(
          svcSnap.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
            .filter((s) => String((s as ServiceDoc).status ?? "Active") === "Active") as ServiceDoc[],
        );
        setComingSoon(
          soonSnap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }) as ServiceDoc)
            .filter((s) => String((s as { previewStatus?: string }).previewStatus ?? "Active") !== "Inactive"),
        );
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Could not load services. Please refresh the page.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    const db = getDb();
    if (!db) return;
    const unsub = onSnapshot(doc(db, "settings", "general"), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const url = String(data.googleReviewUrl ?? "").trim();
      setGoogleReviewUrl(url);
      const rows = Array.isArray(data.homeReviews) ? data.homeReviews : [];
      const parsed = rows
        .filter((r) => r && typeof r === "object")
        .map((r) => ({
          name: String(r.name ?? "").trim(),
          area: String(r.area ?? "").trim(),
          rating: Math.min(5, Math.max(1, Number(r.rating) || 5)),
          text: String(r.text ?? r.review ?? "").trim(),
          reviewDate: String(r.reviewDate ?? r.date ?? "").trim(),
        }))
        .filter((r) => r.name && r.text);
      if (parsed.length) setHomeReviews(parsed);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const db = getDb();
    if (!db) return;
    const unsub = onSnapshot(collection(db, "homeSections"), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HomeSectionDoc);
      setCmsSections(filterHomeSectionsForPlatform(rows, "desktopWeb"));
    });
    return () => unsub();
  }, []);

  const features = [
    {
      title: "Same Day Service",
      desc: "Technician arrives in 60-90 minutes at your doorstep.",
      icon: Clock,
    },
    {
      title: "Verified Experts",
      desc: "Background-checked, highly trained & professional Technicians.",
      icon: UserCheck,
    },
    {
      title: "Transparent Pricing",
      desc: "No hidden fees. Upfront cost estimates before we start.",
      icon: Tag,
    },
    {
      title: "Genuine Parts",
      desc: "We only use OEM & certified spare parts for longevity.",
      icon: Settings,
    },
  ];

  const coverageAreas = [
    "DLF Phase 1-5", "Sushant Lok", "Golf Course Road", "Sohna Road",
    "Cyber City", "MG Road", "Palam Vihar", "New Gurugram",
    "Gachibowli", "Madhapur", "Banjara Hills", "Aligarh City",
  ];

  const cityLabel = SERVICE_CITIES.join(", ");

  const brands = [
    "LG", "SAMSUNG", "Whirlpool", "Bosch", "IFB", "Haier", "Godrej", 
    "Panasonic", "Elica", "Faber", "Glen", "Moda", "Sunflame"
  ];

  const faqs = [
    {
      q: "What are your visiting charges?",
      a: "Our standard visiting and inspection charge is ₹199. This fee is completely waived off if you proceed with the repair service with us."
    },
    {
      q: "Do you provide a warranty on repairs?",
      a: "Yes, we offer a strict 30-day service warranty on our repairs and up to 90 days of warranty on specific spare parts replaced by our technicians."
    },
    {
      q: "How long does a repair usually take?",
      a: "Most standard repairs are completed within 1 to 2 hours right at your doorstep. For severe issues requiring specific parts, it may take 24-48 hours."
    },
    {
      q: "What payment methods do you accept?",
      a: "We accept Cash, UPI (Google Pay, PhonePe, Paytm), and major Credit/Debit cards after the service is successfully completed."
    }
  ];

  const [searchQuery, setSearchQuery] = useState("");

  const { main: comingSoonMain, commercial: comingSoonCommercial } = useMemo(
    () => splitComingSoonByCategory(comingSoon),
    [comingSoon],
  );
  const useCms = cmsSections.length > 0;

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { categories: categories.slice(0, 4), services: services.slice(0, 4) };
    return {
      categories: categories
        .filter((c) => (c.name ?? c.title ?? "").toLowerCase().includes(q))
        .slice(0, 4),
      services: services
        .filter((s) => (s.name ?? s.title ?? "").toLowerCase().includes(q))
        .slice(0, 4),
    };
  }, [categories, services, searchQuery]);

  const popularServices = services.slice(0, 8);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden font-sans text-[#1e293b] bg-[#F8F6F4] md:bg-white">
      {/* Phone width only — app-identical shell */}
      <div className="md:hidden">
        <MobileAppHome />
      </div>

      {/* Laptop / desktop — full marketing website */}
      <div className="hidden md:block">
      {loadError ? (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
          {loadError}{" "}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <PromoBannerSection section={["home", "offers"]} />
      
      {/* Hero Section */}
      <section className="relative pt-[20px] pb-20 lg:pt-12 lg:pb-28 bg-gradient-to-br from-[#f8fafc] to-[#edf2f8] overflow-hidden min-h-[100vh] flex items-center">
        <div className="absolute top-[-50%] right-[-10%] w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(249,99,22,0.05)_0%,rgba(255,255,255,0)_70%)] -z-0" />
        
        <Container className="relative z-10">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
            <div className="flex flex-col space-y-6">
              
              {/* Glass Badge */}
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/80 px-4 py-2 text-sm text-[#0a0f1c] shadow-[0_4px_15px_rgba(0,0,0,0.05)] backdrop-blur-[10px]">
                <MapPin className="size-4 text-[#f96316]" />
                <span className="font-medium">Serving {cityLabel}</span>
              </div>
              
              <div>
                <h1 className="text-balance text-4xl font-bold tracking-tight text-[#0a0f1c] sm:text-5xl lg:text-6xl mb-4">
                  Premium Appliance Repair You Can{" "}
                  <span className="relative inline-block text-[#f96316]">
                    Trust
                    <span className="absolute bottom-2 left-0 -z-10 h-3 w-full rounded bg-[#f96316]/20"></span>
                  </span>
                </h1>
                <p className="max-w-xl text-pretty text-[1.125rem] leading-relaxed text-[#64748b]">
                  Same-day AC repair, washing machine service, RO service, electrician & plumber across {cityLabel}. Trained, background-verified professionals at your doorstep.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/services"
                  className="inline-flex h-14 items-center justify-center rounded-full bg-[#0a0f1c] px-8 text-base font-medium text-white shadow-[0_8px_20px_rgba(10,15,28,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#162032] hover:shadow-[0_10px_25px_rgba(10,15,28,0.3)]"
                >
                  Book Service
                </Link>
                <a
                  href="https://wa.me/918796299677"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-gray-300 bg-transparent px-6 text-base font-medium text-[#1e293b] transition-all hover:bg-gray-50"
                >
                  <MessageCircle className="size-5 text-[#1DA851]" />
                  WhatsApp Now
                </a>
              </div>

              {/* Trust Badges - Glass Card */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <div className="flex items-center gap-3 rounded-full border border-white/40 bg-white/90 px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-[12px]">
                  <div className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-blue-500">
                    <ShieldCheck className="size-4" />
                  </div>
                  <span className="text-sm font-semibold text-[#1e293b]">Verified Technicians</span>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-white/40 bg-white/90 px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-[12px]">
                  <div className="flex size-8 items-center justify-center rounded-full bg-orange-100 text-[#f96316]">
                    <Clock className="size-4" />
                  </div>
                  <span className="text-sm font-semibold text-[#1e293b]">Same-Day Service</span>
                </div>
              </div>
            </div>

            {/* Hero Search Block */}
            {/* Hero Search Block */}
<div className="relative mx-auto w-full max-w-md lg:ml-auto lg:mr-0 animate-[float_4s_ease-in-out_infinite]">
  <div className="relative rounded-3xl border border-white/40 bg-white/90 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.08)] backdrop-blur-[12px] sm:p-8">
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-[#0a0f1c]">What do you need help with?</h3>
        <p className="text-sm text-[#64748b]">Search for appliances, plumbing, and more.</p>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748b]" />
        <input
          type="text"
          placeholder="AC repair, washing machine..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm outline-none transition-all focus-visible:border-[#f96316] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#f96316]"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-[#64748b]">
            Popular Services
          </div>
          {/* View More Button - Smooth scrolls to #services section */}
          <button 
            onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-xs font-bold text-[#f96316] transition-colors hover:text-[#ea580c] hover:underline"
          >
            View more
          </button>
        </div>
        
        {searchResults.services.length > 0 || searchResults.categories.length > 0 ? (
          <div className="space-y-3">
            {searchResults.services.map((s) => (
              <Link
                key={s.id}
                href={getServicePath(s)}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 transition-all hover:border-[#f96316]/30 hover:shadow-sm"
              >
                <span className="truncate text-sm font-semibold text-[#1e293b]">
                  {s.name ?? s.title}
                </span>
                <span className="text-xs font-bold text-[#f96316]">Book</span>
              </Link>
            ))}
            {searchResults.categories.map((category) => (
              <Link
                key={category.id}
                href={getCategoryPath(category)}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 transition-all hover:border-[#f96316]/30 hover:shadow-sm"
              >
                <span className="truncate text-sm font-semibold text-[#1e293b]">
                  {category.name ?? category.title}
                </span>
                <span className="text-xs text-[#64748b]">Category</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-[#64748b]">
            No services found.
          </div>
        )}
      </div>
    </div>
  </div>
</div>
          </div>
        </Container>
      </section>

      {useCms ? (
        <DynamicHomeSections
          variant="desktop"
          platform="desktopWeb"
          sections={cmsSections}
          categories={categories}
          services={services}
          comingSoon={comingSoon}
        />
      ) : (
        <>
            {/* Categories Section */}
            <section id="services" className="bg-[#f8fafc] py-20 relative">
        <Container>
          <div className="mx-auto max-w-[700px] text-center mb-12">
            <span className="text-sm font-bold uppercase tracking-wide text-[#f96316] block mb-2">Our Expertise</span>
            <h2 className="text-3xl font-bold text-[#0a0f1c] sm:text-4xl mb-3">Premium Services at Your Doorstep</h2>
            <p className="text-[#64748b] text-lg">We repair all major home appliances with genuine spare parts and a standard service warranty.</p>
          </div>
          <PromoBannerSection section="categories" />

          {isLoading ? (
            <div className="flex justify-center py-10">
               <div className="size-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#f96316]"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No categories found.</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={getCategoryPath(category)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] border border-black/5 bg-white p-0 shadow-[0_10px_30px_rgba(0,0,0,0.02)] transition-all duration-400 hover:-translate-y-2.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
                >
                  <div className="relative overflow-hidden h-[200px] w-full bg-gray-100 flex items-center justify-center">
                    
                    {category.icon ? (
                      <img
                        src={category.icon}
                        alt={category.name || category.title || "Service"}
                        className="h-full w-full object-cover transition-transform duration-600 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <Wrench className="size-16 text-gray-300 transition-transform duration-600 group-hover:scale-110" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 opacity-0 transition-opacity duration-400 group-hover:opacity-100" />
                  </div>
                  
                  <div className="p-5 bg-white">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[#0a0f1c]">{category.name || category.title}</h3>
                      <ArrowRight className="size-5 text-[#f96316] opacity-0 -translate-x-2.5 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                    <p className="text-sm text-[#64748b] line-clamp-2">
                      {category.desc || "Explore this service and book an expert today."}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </section>

      <MostBookedSection services={services} />
      <CleaningEssentialsSection services={services} />
      <ApplianceRepairSection services={services} />

      {/* Popular Services */}
      <section id="popular" className="border-b border-gray-100 bg-white py-16">
        <Container>
          <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <span className="text-sm font-bold uppercase tracking-wide text-[#f96316]">Popular Services</span>
              <h2 className="mt-2 text-3xl font-bold text-[#0a0f1c]">Book directly — no extra steps</h2>
            </div>
            <Link href="/services" className="text-sm font-bold text-[#f96316] hover:underline">
              View all services
            </Link>
          </div>
          <PromoBannerSection section={["popular_services", "featured"]} />
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="size-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#f96316]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
              {popularServices.map((s) => (
                <Link
                  key={s.id}
                  href={
                    serviceHasVariations(s) ? getServicePath(s) : getBookPath(s)
                  }
                  className="group rounded-2xl border border-gray-100 bg-[#f8fafc] p-4 transition-all hover:-translate-y-1 hover:border-[#f96316]/30 hover:shadow-md"
                >
                  <div className="font-bold text-[#0a0f1c] group-hover:text-[#f96316]">
                    {s.name ?? s.title}
                  </div>
                  <ServicePrice service={s} className="mt-1" />
                </Link>
              ))}
            </div>
          )}
        </Container>
      </section>

      {comingSoonMain.length > 0 ? (
        <section id="coming-soon" className="border-b border-gray-100 bg-[#fff7f0] py-16">
          <Container>
            <div className="mb-6">
              <PromoBannerSection section={["coming_soon_main", "coming_soon"]} />
            </div>
            <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-sm font-bold uppercase tracking-wide text-[#f96316]">
                  Coming Soon
                </span>
                <h2 className="mt-1 text-3xl font-bold text-[#0a0f1c]">Upcoming home services</h2>
                <p className="mt-2 text-[#64748b]">New home offerings launching soon across Gurugram, Hyderabad & Aligarh.</p>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {comingSoonMain.map((s) => {
                const img = s.homeImage || s.imageUrl || s.image;
                return (
                  <Link
                    key={s.id}
                    href={getComingSoonPath(s)}
                    className="block overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-gray-100">
                      {img ? (
                        <img src={img} alt={s.name ?? ""} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Wrench className="size-12 text-gray-300" />
                        </div>
                      )}
                      <span className="absolute right-3 top-3 rounded-full bg-[#f96316] px-3 py-1 text-xs font-bold text-white">
                        Coming Soon
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#0a0f1c]">{s.name ?? s.title}</h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Container>
        </section>
      ) : null}

      {comingSoonCommercial.length > 0 ? (
        <section id="coming-soon-commercial" className="border-b border-gray-100 bg-[#fff7f0] py-16">
          <Container>
            <div className="mb-6">
              <PromoBannerSection section="coming_soon_commercial" />
            </div>
            <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-sm font-bold uppercase tracking-wide text-[#f96316]">
                  Coming Soon
                </span>
                <h2 className="mt-1 text-3xl font-bold text-[#0a0f1c]">Upcoming business services</h2>
                <p className="mt-2 text-[#64748b]">Business & commercial offerings launching soon across Gurugram, Hyderabad & Aligarh.</p>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {comingSoonCommercial.map((s) => {
                const img = s.homeImage || s.imageUrl || s.image;
                return (
                  <Link
                    key={s.id}
                    href={getComingSoonPath(s)}
                    className="block overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-gray-100">
                      {img ? (
                        <img src={img} alt={s.name ?? ""} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Wrench className="size-12 text-gray-300" />
                        </div>
                      )}
                      <span className="absolute right-3 top-3 rounded-full bg-[#f96316] px-3 py-1 text-xs font-bold text-white">
                        Coming Soon
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#0a0f1c]">{s.name ?? s.title}</h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Container>
        </section>
      ) : null}
        </>
      )}

      {/* Why Choose Us Section */}
      <section id="why-us" className="py-20 overflow-hidden bg-white">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="pr-0 lg:pr-12">
              <span className="text-sm font-bold uppercase tracking-wide text-[#f96316] block mb-2">Why Choose Us</span>
              <h2 className="text-3xl font-bold tracking-tight text-[#0a0f1c] sm:text-4xl mb-4">Why {cityLabel} Trusts Repair Series</h2>
              <p className="text-lg text-[#64748b] mb-8">
                We are committed to bringing transparency, quality, and convenience back into the appliance repair industry. No hidden fees, just honest work.
              </p>
              <Link
                href="/services"
                className="inline-flex items-center justify-center rounded-full bg-[#f96316] px-8 py-3.5 text-base font-medium text-white shadow-[0_8px_20px_rgba(249,99,22,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#ea580c] hover:shadow-[0_10px_25px_rgba(249,99,22,0.35)]"
              >
                Book a Technician <ArrowRight className="ml-2 size-4" />
              </Link>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2">
              {features.map((item) => (
                <div 
                  key={item.title} 
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-[5px] hover:border-[#f96316]/10 hover:shadow-[0_15px_30px_rgba(0,0,0,0.05)]"
                >
                  <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f96316]">
                    <item.icon className="size-6" />
                  </div>
                  <h3 className="mb-2 font-bold text-[#0a0f1c]">{item.title}</h3>
                  <p className="text-sm text-[#64748b] m-0">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Coverage Section */}
      <section id="coverage" className="relative overflow-hidden bg-[#0a0f1c] py-20">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(249,99,22,0.15)_0%,rgba(0,0,0,0)_70%)] z-0" />
        
        <Container className="relative z-10 text-center">
          <h3 className="mb-3 text-3xl font-bold text-white sm:text-4xl">Fast Service Across Gurugram, Hyderabad & Aligarh</h3>
          <p className="mb-10 text-lg text-[#94a3b8]">Technician arrives within <span className="font-bold text-[#f96316]">60–90 minutes</span> in most areas.</p>
          
          <div className="mx-auto flex max-w-[800px] flex-wrap justify-center gap-3">
            {coverageAreas.map((area) => (
              <span key={area} className="rounded-full border border-white/10 bg-white/10 px-5 py-2 text-base font-medium text-white backdrop-blur-[12px]">
                {area}
              </span>
            ))}
          </div>
        </Container>
      </section>

      {/* Brands Marquee Slider */}
      <section className="border-b border-gray-100 bg-white py-12">
        <Container className="text-center">
          <h6 className="mb-6 text-xs font-bold uppercase tracking-wide text-[#64748b]">We Repair All Major Brands</h6>
          
          <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="flex w-max animate-[scrollBrands_35s_linear_infinite] gap-[80px] py-2">
              {[...brands, ...brands].map((brand, i) => (
                <h3 
                  key={i} 
                  className="m-0 cursor-default text-[1.4rem] font-bold text-[#cbd5e1] transition-all duration-300 hover:scale-110 hover:text-[#0a0f1c]"
                >
                  {brand}
                </h3>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Reviews Section */}
      {homeReviews.length > 0 || googleReviewUrl ? (
      <section id="reviews" className="bg-white py-20">
        <Container>
          <div className="mx-auto max-w-[700px] text-center mb-12">
            <span className="mb-2 block text-sm font-bold uppercase tracking-wide text-[#f96316]">Reviews</span>
            <h2 className="text-3xl font-bold text-[#0a0f1c] sm:text-4xl">Trusted by households in {cityLabel}</h2>
          </div>
          {homeReviews.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3">
            {homeReviews.map((review) => (
              <div
                key={`${review.name}-${review.text.slice(0, 24)}`}
                className="rounded-[20px] border border-black/5 bg-white/90 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] backdrop-blur-sm"
              >
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="size-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-[#64748b]">&ldquo;{review.text}&rdquo;</p>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="font-bold text-[#0a0f1c]">{review.name}</div>
                  <div className="text-xs text-[#64748b]">
                    {[review.area, review.reviewDate].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : null}
          {googleReviewUrl ? (
            <div className={`${homeReviews.length > 0 ? "mt-10" : ""} text-center`}>
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#f96316] px-8 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#e55510]"
              >
                Write a Review
                <ArrowRight className="size-4" />
              </a>
            </div>
          ) : null}
        </Container>
      </section>
      ) : null}

      {/* FAQ Section */}
      <section id="faq" className="bg-[#f8fafc] py-20">
        <Container>
          <div className="mx-auto max-w-[700px] text-center mb-12">
            <span className="mb-2 block text-sm font-bold uppercase tracking-wide text-[#f96316]">Got Questions?</span>
            <h2 className="mb-3 text-3xl font-bold text-[#0a0f1c] sm:text-4xl">Frequently Asked Questions</h2>
          </div>
          
          <div className="mx-auto max-w-[800px] space-y-4">
            {faqs.map((faq, index) => (
              <details key={index} className="group overflow-hidden rounded-2xl border-0 bg-white shadow-sm transition-all duration-300 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-5 text-[1.05rem] font-bold text-[#0a0f1c] group-open:text-[#f96316]">
                  {faq.q}
                  <span className="transition-transform duration-300 group-open:rotate-180">
                    <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                  </span>
                </summary>
                <div className="px-6 pb-6 text-[#64748b] leading-[1.6]">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </Container>
      </section>



      {/* Mobile Bottom Bar removed — app chrome uses MobileBottomNav */}
      </div>
    </div>
  );
}