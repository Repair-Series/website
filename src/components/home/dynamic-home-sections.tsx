"use client";

import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";
import {
  filterHomeSectionsForPlatform,
  resolveHomeSectionItems,
  type HomeSectionDoc,
  type HomeSectionPlatform,
} from "@/lib/home-sections/resolve";
import {
  getCategoryPath,
  getComingSoonPath,
  getServicePath,
} from "@/lib/catalog/slug";
import { ServicePrice } from "@/components/services/service-price";
import {
  PromoBannerSection,
  SectionPromoBanner,
} from "@/components/home/promo-banner";
import { bannerSectionsForHomeCmsSection } from "@/lib/banners/sections";

type CategoryDoc = {
  id: string;
  name?: string;
  title?: string;
  icon?: string;
  desc?: string;
  active?: boolean;
  isActive?: boolean;
};

type ServiceDoc = {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  image?: string;
  imageUrl?: string;
  homeImage?: string;
  featured?: boolean;
  isFeatured?: boolean;
};

function viewAllHref(section: HomeSectionDoc) {
  const custom = String(section.viewAllPath || "").trim();
  if (custom) return custom;
  if (section.contentType === "categories") return "/categories";
  return "/services";
}

function isComingSoonMode(section: HomeSectionDoc) {
  return String(section.selectionMode || "").startsWith("coming_soon");
}

function itemHref(section: HomeSectionDoc, item: CategoryDoc | ServiceDoc) {
  if (section.contentType === "categories") {
    return getCategoryPath(item as CategoryDoc);
  }
  if (isComingSoonMode(section) || String((item as ServiceDoc).status) === "Coming Soon") {
    return getComingSoonPath(item as ServiceDoc);
  }
  return getServicePath(item as ServiceDoc);
}

function sectionBadge(section: HomeSectionDoc) {
  if (section.selectionMode === "coming_soon_main") return "Coming Soon";
  if (section.selectionMode === "coming_soon_commercial") return "Coming Soon";
  if (section.selectionMode === "coming_soon") return "Coming Soon";
  return null;
}

function itemImage(section: HomeSectionDoc, item: CategoryDoc | ServiceDoc) {
  if (section.contentType === "categories") {
    return String((item as CategoryDoc).icon || "");
  }
  const s = item as ServiceDoc;
  return String(s.homeImage || s.imageUrl || s.image || "");
}

function CmsBannerSlot({
  section,
  variant,
}: {
  section: HomeSectionDoc;
  variant: "mobile" | "desktop";
}) {
  const keys = bannerSectionsForHomeCmsSection(section);
  if (!keys.length) return null;
  if (variant === "desktop") {
    return <PromoBannerSection section={keys} className="py-0 md:py-4" />;
  }
  return (
    <div className="-mx-4 mb-3">
      <SectionPromoBanner section={keys} />
    </div>
  );
}

function mobileGridCols(columns: number) {
  if (columns <= 1) return "grid-cols-1";
  if (columns === 2) return "grid-cols-2";
  if (columns === 3) return "grid-cols-3";
  return "grid-cols-4";
}

function desktopGridCols(columns: number) {
  if (columns <= 1) return "grid-cols-1";
  if (columns === 2) return "grid-cols-1 sm:grid-cols-2";
  if (columns === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
}

function MobileSections({
  sections,
  categories,
  services,
  comingSoon,
}: {
  sections: HomeSectionDoc[];
  categories: CategoryDoc[];
  services: ServiceDoc[];
  comingSoon: ServiceDoc[];
}) {
  return (
    <>
      {sections.map((section) => {
        if (section.layout === "static" || section.contentType === "static") {
          return (
            <section key={section.id} className="mt-7 px-4">
              <h2 className="mb-1 text-lg font-extrabold text-[#1A1A1A]">{section.title}</h2>
              {section.subtitle ? (
                <p className="mb-3 text-xs font-medium text-[#6B6B6B]">{section.subtitle}</p>
              ) : null}
              <div className="overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E8E4E0]">
                {section.staticImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={section.staticImage}
                    alt=""
                    className="mb-3 h-36 w-full rounded-xl object-cover"
                  />
                ) : null}
                {section.staticBody ? (
                  <p className="text-sm leading-relaxed text-[#3A3A3A]">{section.staticBody}</p>
                ) : null}
                {section.staticCtaLabel && section.staticCtaLink ? (
                  <Link
                    href={section.staticCtaLink}
                    className="mt-3 inline-flex text-sm font-bold text-[#C45508]"
                  >
                    {section.staticCtaLabel}
                  </Link>
                ) : null}
              </div>
            </section>
          );
        }

        const items = resolveHomeSectionItems(section, {
          categories,
          services,
          comingSoon,
        }) as Array<CategoryDoc | ServiceDoc>;
        if (!items.length) return null;

        const columns = Math.min(4, Math.max(1, Number(section.columns) || 4));
        const badge = sectionBadge(section);

        return (
          <section key={section.id} className="mt-7 px-4">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#1A1A1A]">{section.title}</h2>
                {section.subtitle ? (
                  <p className="mt-0.5 text-xs font-medium text-[#6B6B6B]">{section.subtitle}</p>
                ) : null}
              </div>
              {section.showViewAll ? (
                <Link
                  href={viewAllHref(section)}
                  className="shrink-0 text-xs font-bold text-[#C45508]"
                >
                  See all
                </Link>
              ) : null}
            </div>
            <CmsBannerSlot section={section} variant="mobile" />

            {section.layout === "list" ? (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <Link
                    key={item.id}
                    href={itemHref(section, item)}
                    className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#E8E4E0]"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-[#FDE7DD] text-xs font-extrabold text-[#C45508]">
                      {idx + 1}
                    </span>
                    <div className="size-11 overflow-hidden rounded-xl bg-[#F4F5F7]">
                      {itemImage(section, item) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={itemImage(section, item)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#1A1A1A]">
                        {item.name || item.title}
                      </p>
                      {section.contentType === "services" ? (
                        <div className="mt-0.5 text-[11px] font-semibold text-[#C45508]">
                          <ServicePrice service={item as never} />
                        </div>
                      ) : (
                        <p className="text-[11px] font-medium text-[#6B6B6B]">Browse services</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}

            {section.layout === "slider" ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {items.map((item) =>
                  section.contentType === "categories" ? (
                    <Link
                      key={item.id}
                      href={itemHref(section, item)}
                      className="flex w-[88px] shrink-0 flex-col items-center gap-2"
                    >
                      <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4E0]">
                        {(item as CategoryDoc).icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={(item as CategoryDoc).icon}
                            alt=""
                            className="size-10 object-contain"
                          />
                        ) : (
                          <span className="text-lg">🔧</span>
                        )}
                      </div>
                      <span className="line-clamp-2 text-center text-[11px] font-bold text-[#1A1A1A]">
                        {item.name || item.title}
                      </span>
                    </Link>
                  ) : (
                    <Link
                      key={item.id}
                      href={itemHref(section, item)}
                      className="w-[148px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4E0]"
                    >
                      <div className="aspect-[4/3] bg-[#F4F5F7]">
                        {itemImage(section, item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={itemImage(section, item)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="p-2.5">
                        <p className="line-clamp-2 text-xs font-bold text-[#1A1A1A]">
                          {item.name || item.title}
                        </p>
                        {badge ? (
                          <p className="mt-1 text-[10px] font-semibold uppercase text-[#C45508]">
                            {badge}
                          </p>
                        ) : (
                          <div className="mt-1 text-[11px] font-semibold text-[#C45508]">
                            <ServicePrice service={item as never} />
                          </div>
                        )}
                      </div>
                    </Link>
                  ),
                )}
              </div>
            ) : null}

            {section.layout === "grid" ? (
              <div className={`grid gap-3 ${mobileGridCols(columns)}`}>
                {items.map((item) =>
                  section.contentType === "categories" ? (
                    <Link
                      key={item.id}
                      href={itemHref(section, item)}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4E0]">
                        {(item as CategoryDoc).icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={(item as CategoryDoc).icon}
                            alt=""
                            className="size-10 object-contain"
                          />
                        ) : (
                          <span className="text-lg">🔧</span>
                        )}
                      </div>
                      <span className="line-clamp-2 text-center text-[11px] font-bold text-[#1A1A1A]">
                        {item.name || item.title}
                      </span>
                    </Link>
                  ) : (
                    <Link
                      key={item.id}
                      href={itemHref(section, item)}
                      className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4E0]"
                    >
                      <div className="aspect-[4/3] bg-[#F4F5F7]">
                        {itemImage(section, item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={itemImage(section, item)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <p className="line-clamp-2 p-2 text-xs font-bold text-[#1A1A1A]">
                        {item.name || item.title}
                      </p>
                    </Link>
                  ),
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}

function DesktopSections({
  sections,
  categories,
  services,
  comingSoon,
}: {
  sections: HomeSectionDoc[];
  categories: CategoryDoc[];
  services: ServiceDoc[];
  comingSoon: ServiceDoc[];
}) {
  return (
    <>
      {sections.map((section, sectionIdx) => {
        const tone = sectionIdx % 2 === 0 ? "muted" : "white";
        const shell =
          tone === "muted"
            ? "border-b border-gray-100 bg-[#f8fafc] py-16 lg:py-20"
            : "border-b border-gray-100 bg-white py-16 lg:py-20";

        if (section.layout === "static" || section.contentType === "static") {
          return (
            <section key={section.id} className={shell}>
              <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 lg:grid-cols-[1.1fr_0.9fr] lg:px-0">
                <div>
                  <span className="mb-2 block text-sm font-bold uppercase tracking-wide text-[#f96316]">
                    Spotlight
                  </span>
                  <h2 className="text-3xl font-bold tracking-tight text-[#0a0f1c] sm:text-4xl">
                    {section.title}
                  </h2>
                  {section.subtitle ? (
                    <p className="mt-3 text-lg text-[#64748b]">{section.subtitle}</p>
                  ) : null}
                  {section.staticBody ? (
                    <p className="mt-5 text-base leading-relaxed text-[#475569]">
                      {section.staticBody}
                    </p>
                  ) : null}
                  {section.staticCtaLabel && section.staticCtaLink ? (
                    <Link
                      href={section.staticCtaLink}
                      className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f96316] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(249,99,22,0.25)] transition hover:-translate-y-0.5 hover:bg-[#ea580c]"
                    >
                      {section.staticCtaLabel}
                      <ArrowRight className="size-4" />
                    </Link>
                  ) : null}
                </div>
                {section.staticImage ? (
                  <div className="overflow-hidden rounded-[28px] border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={section.staticImage}
                      alt=""
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </div>
                ) : null}
              </div>
            </section>
          );
        }

        const items = resolveHomeSectionItems(section, {
          categories,
          services,
          comingSoon,
        }) as Array<CategoryDoc | ServiceDoc>;
        if (!items.length) return null;

        const columns = Math.min(4, Math.max(1, Number(section.columns) || 4));
        const badge = sectionBadge(section);
        const isCategory = section.contentType === "categories";
        const isComing = isComingSoonMode(section);

        return (
          <section key={section.id} id={sectionIdx === 0 ? "services" : undefined} className={shell}>
            <div className="mx-auto max-w-6xl px-4 lg:px-0">
              <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div className="max-w-2xl">
                  <span className="mb-2 block text-sm font-bold uppercase tracking-wide text-[#f96316]">
                    {isComing ? "Coming Soon" : isCategory ? "Browse" : "Services"}
                  </span>
                  <h2 className="text-3xl font-bold tracking-tight text-[#0a0f1c] sm:text-4xl">
                    {section.title}
                  </h2>
                  {section.subtitle ? (
                    <p className="mt-3 text-lg text-[#64748b]">{section.subtitle}</p>
                  ) : null}
                </div>
                {section.showViewAll ? (
                  <Link
                    href={viewAllHref(section)}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#f96316] transition hover:underline"
                  >
                    View all
                    <ArrowRight className="size-4" />
                  </Link>
                ) : null}
              </div>
              <CmsBannerSlot section={section} variant="desktop" />

              {section.layout === "list" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {items.map((item, idx) => (
                    <Link
                      key={item.id}
                      href={itemHref(section, item)}
                      className="group flex items-center gap-4 rounded-[22px] border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.03)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.08)]"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#fff1e8] text-sm font-extrabold text-[#f96316]">
                        {idx + 1}
                      </span>
                      <div className="size-16 shrink-0 overflow-hidden rounded-2xl bg-[#f1f5f9]">
                        {itemImage(section, item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={itemImage(section, item)}
                            alt=""
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Wrench className="size-6 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-bold text-[#0a0f1c] group-hover:text-[#f96316]">
                          {item.name || item.title}
                        </p>
                        {section.contentType === "services" ? (
                          <div className="mt-1 text-sm font-semibold text-[#f96316]">
                            <ServicePrice service={item as never} />
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-[#64748b]">Explore services in this category</p>
                        )}
                      </div>
                      <ArrowRight className="size-5 shrink-0 text-[#f96316] opacity-0 transition group-hover:opacity-100" />
                    </Link>
                  ))}
                </div>
              ) : null}

              {section.layout === "slider" ? (
                <div className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] lg:mx-0 lg:px-0">
                  {items.map((item) =>
                    isCategory ? (
                      <Link
                        key={item.id}
                        href={itemHref(section, item)}
                        className="group w-[220px] shrink-0 overflow-hidden rounded-[22px] border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.03)] transition hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
                      >
                        <div className="relative flex h-[150px] items-center justify-center bg-[#f1f5f9]">
                          {(item as CategoryDoc).icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={(item as CategoryDoc).icon}
                              alt=""
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <Wrench className="size-12 text-gray-300" />
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="text-base font-bold text-[#0a0f1c] group-hover:text-[#f96316]">
                            {item.name || item.title}
                          </h3>
                        </div>
                      </Link>
                    ) : (
                      <Link
                        key={item.id}
                        href={itemHref(section, item)}
                        className="group w-[260px] shrink-0 overflow-hidden rounded-[22px] border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.03)] transition hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
                      >
                        <div className="relative aspect-[4/3] bg-[#f1f5f9]">
                          {itemImage(section, item) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={itemImage(section, item)}
                              alt=""
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Wrench className="size-12 text-gray-300" />
                            </div>
                          )}
                          {badge ? (
                            <span className="absolute right-3 top-3 rounded-full bg-[#f96316] px-3 py-1 text-xs font-bold text-white">
                              {badge}
                            </span>
                          ) : null}
                        </div>
                        <div className="p-4">
                          <h3 className="line-clamp-2 text-base font-bold text-[#0a0f1c] group-hover:text-[#f96316]">
                            {item.name || item.title}
                          </h3>
                          {!badge ? (
                            <div className="mt-2 text-sm font-semibold text-[#f96316]">
                              <ServicePrice service={item as never} />
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              ) : null}

              {section.layout === "grid" ? (
                <div className={`grid gap-6 ${desktopGridCols(columns)}`}>
                  {items.map((item) =>
                    isCategory ? (
                      <Link
                        key={item.id}
                        href={itemHref(section, item)}
                        className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
                      >
                        <div className="relative flex h-[200px] w-full items-center justify-center overflow-hidden bg-gray-100">
                          {(item as CategoryDoc).icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={(item as CategoryDoc).icon}
                              alt={item.name || item.title || "Category"}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                              loading="lazy"
                            />
                          ) : (
                            <Wrench className="size-16 text-gray-300 transition-transform duration-500 group-hover:scale-110" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        </div>
                        <div className="bg-white p-5">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="text-lg font-bold text-[#0a0f1c]">
                              {item.name || item.title}
                            </h3>
                            <ArrowRight className="size-5 -translate-x-2 text-[#f96316] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                          </div>
                          <p className="line-clamp-2 text-sm text-[#64748b]">
                            {(item as CategoryDoc).desc ||
                              "Explore this service and book an expert today."}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <Link
                        key={item.id}
                        href={itemHref(section, item)}
                        className="group overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.02)] transition hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
                      >
                        <div className="relative aspect-[4/3] bg-[#f1f5f9]">
                          {itemImage(section, item) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={itemImage(section, item)}
                              alt=""
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Wrench className="size-12 text-gray-300" />
                            </div>
                          )}
                          {badge ? (
                            <span className="absolute right-3 top-3 rounded-full bg-[#f96316] px-3 py-1 text-xs font-bold text-white">
                              {badge}
                            </span>
                          ) : null}
                        </div>
                        <div className="p-4">
                          <h3 className="line-clamp-2 font-bold text-[#0a0f1c] group-hover:text-[#f96316]">
                            {item.name || item.title}
                          </h3>
                          {!badge ? (
                            <div className="mt-2 text-sm font-semibold text-[#f96316]">
                              <ServicePrice service={item as never} />
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </>
  );
}

export function DynamicHomeSections({
  sections,
  categories,
  services,
  comingSoon,
  variant = "mobile",
  platform,
}: {
  sections: HomeSectionDoc[];
  categories: CategoryDoc[];
  services: ServiceDoc[];
  comingSoon: ServiceDoc[];
  /** `mobile` = app-like phone UI; `desktop` = marketing homepage */
  variant?: "mobile" | "desktop";
  /** CMS visibility: mobileWeb / desktopWeb (defaults from variant) */
  platform?: HomeSectionPlatform;
}) {
  const resolvedPlatform: HomeSectionPlatform =
    platform ?? (variant === "desktop" ? "desktopWeb" : "mobileWeb");
  const visible = filterHomeSectionsForPlatform(sections, resolvedPlatform);
  if (!visible.length) return null;

  if (variant === "desktop") {
    return (
      <DesktopSections
        sections={visible}
        categories={categories}
        services={services}
        comingSoon={comingSoon}
      />
    );
  }

  return (
    <MobileSections
      sections={visible}
      categories={categories}
      services={services}
      comingSoon={comingSoon}
    />
  );
}
